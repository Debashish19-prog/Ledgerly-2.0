import { query, withTransaction } from "../db.js";
import { addDays, addMonths, todayIn } from "../utils/dates.js";

export function nextOccurrence(date, frequency, interval) {
  switch (frequency) {
    case "daily":
      return addDays(date, interval);
    case "weekly":
      return addDays(date, 7 * interval);
    case "yearly":
      return addMonths(date, 12 * interval);
    default:
      return addMonths(date, interval);
  }
}

/** Occurrence dates from the rule's next_date up to and including `until`. */
export function occurrencesUntil(rule, until, max = 366) {
  const dates = [];
  let d = rule.next_date;
  while (d <= until && (!rule.end_date || d <= rule.end_date) && dates.length < max) {
    dates.push(d);
    d = nextOccurrence(d, rule.frequency, rule.interval_count);
  }
  return { dates, next: d };
}

/**
 * Posts a transaction for every due occurrence of the user's recurring rules.
 * Each rule is advanced with a compare-and-set inside a transaction, so two
 * simultaneous requests can never post the same occurrence twice.
 */
export async function postDueRecurring(userId, timezone) {
  const today = todayIn(timezone);
  const due = await query("SELECT * FROM recurring WHERE user_id = ? AND active = 1 AND next_date <= ?", [userId, today]);
  let created = 0;
  for (const r of due) {
    const { dates, next } = occurrencesUntil(r, today);
    const finished = !!r.end_date && next > r.end_date;
    created += await withTransaction(async (conn) => {
      const [res] = await conn.execute(
        "UPDATE recurring SET next_date = ?, active = ? WHERE id = ? AND next_date = ?",
        [next, finished ? 0 : 1, r.id, r.next_date],
      );
      if (res.affectedRows === 0 || dates.length === 0) return 0;
      const rows = dates.map((date) => [
        userId,
        r.type,
        r.amount,
        date,
        r.account_id,
        r.type === "transfer" ? r.to_account_id : null,
        r.type === "transfer" ? null : r.category_id,
        r.payee,
        r.notes,
        r.id,
      ]);
      await conn.query(
        "INSERT INTO transactions (user_id, type, amount, date, account_id, to_account_id, category_id, payee, notes, recurring_id) VALUES ?",
        [rows],
      );
      return rows.length;
    });
  }
  return created;
}
