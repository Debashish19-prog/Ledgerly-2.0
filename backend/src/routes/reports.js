import { Router } from "express";
import { query } from "../db.js";
import { postDueRecurring, occurrencesUntil } from "../services/recurring.js";
import { addDays, monthEnd, monthKeys, monthStart, todayIn } from "../utils/dates.js";
import { handler } from "../utils/http.js";
import { getAccountsWithBalances } from "./accounts.js";
import { getBudgets } from "./budgets.js";
import { getRecurring } from "./recurring.js";

const router = Router();
const num = (v) => Number(v ?? 0);

/** Income and expense totals per month for the `count` months ending with `today`'s month. */
async function monthlyCashflow(userId, today, count) {
  const keys = monthKeys(today, count);
  const rows = await query(
    `SELECT DATE_FORMAT(date, '%Y-%m') AS month,
            COALESCE(SUM(CASE WHEN type = 'income' THEN amount END), 0) AS income,
            COALESCE(SUM(CASE WHEN type = 'expense' THEN amount END), 0) AS expense
     FROM transactions
     WHERE user_id = ? AND date BETWEEN ? AND ?
     GROUP BY month`,
    [userId, `${keys[0]}-01`, monthEnd(today)],
  );
  const byMonth = new Map(rows.map((r) => [r.month, r]));
  return keys.map((month) => {
    const income = num(byMonth.get(month)?.income);
    const expense = num(byMonth.get(month)?.expense);
    return { month, income, expense, net: income - expense };
  });
}

/** Net worth (sum of account balances) at the end of each month. Transfers net to zero. */
async function netWorthSeries(userId, today, count) {
  const keys = monthKeys(today, count);
  const start = `${keys[0]}-01`;
  const signed = "CASE WHEN type = 'income' THEN amount WHEN type = 'expense' THEN -amount ELSE 0 END";
  const [[opening], [before], monthly] = await Promise.all([
    query("SELECT COALESCE(SUM(opening_balance), 0) AS total FROM accounts WHERE user_id = ?", [userId]),
    query(`SELECT COALESCE(SUM(${signed}), 0) AS total FROM transactions WHERE user_id = ? AND date < ?`, [userId, start]),
    query(
      `SELECT DATE_FORMAT(date, '%Y-%m') AS month, COALESCE(SUM(${signed}), 0) AS total
       FROM transactions WHERE user_id = ? AND date >= ? GROUP BY month`,
      [userId, start],
    ),
  ]);
  const byMonth = new Map(monthly.map((m) => [m.month, num(m.total)]));
  let running = num(opening.total) + num(before.total);
  return keys.map((month) => {
    running += byMonth.get(month) ?? 0;
    return { month, netWorth: Math.round(running * 100) / 100 };
  });
}

async function categoryTotals(userId, kind, from, to) {
  const rows = await query(
    `SELECT t.category_id, COALESCE(c.name, 'Uncategorized') AS name, COALESCE(c.color, '#94a3b8') AS color,
            COALESCE(c.icon, '🏷️') AS icon, SUM(t.amount) AS total, COUNT(*) AS count
     FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.user_id = ? AND t.type = ? AND t.date BETWEEN ? AND ?
     GROUP BY t.category_id, c.name, c.color, c.icon
     ORDER BY total DESC`,
    [userId, kind, from, to],
  );
  return rows.map((r) => ({ ...r, total: num(r.total), count: num(r.count) }));
}

async function topPayees(userId, from, to) {
  const rows = await query(
    `SELECT payee, SUM(amount) AS total, COUNT(*) AS count
     FROM transactions
     WHERE user_id = ? AND type = 'expense' AND payee <> '' AND date BETWEEN ? AND ?
     GROUP BY payee ORDER BY total DESC LIMIT 8`,
    [userId, from, to],
  );
  return rows.map((r) => ({ ...r, total: num(r.total), count: num(r.count) }));
}

router.get(
  "/dashboard",
  handler(async (req, res) => {
    const { id: userId, timezone } = req.user;
    await postDueRecurring(userId, timezone);
    const today = todayIn(timezone);
    const from = monthStart(today);
    const to = monthEnd(today);
    const [accounts, cashflow, netWorth, spending, budgets, recent, recurring, goals] = await Promise.all([
      getAccountsWithBalances(userId),
      monthlyCashflow(userId, today, 6),
      netWorthSeries(userId, today, 6),
      categoryTotals(userId, "expense", from, to),
      getBudgets(userId, today.slice(0, 7)),
      query(
        `SELECT t.id, t.type, t.amount, t.date, t.payee, t.notes, t.recurring_id,
                a.name AS account_name, ta.name AS to_account_name,
                c.name AS category_name, c.color AS category_color, c.icon AS category_icon
         FROM transactions t
         JOIN accounts a ON a.id = t.account_id
         LEFT JOIN accounts ta ON ta.id = t.to_account_id
         LEFT JOIN categories c ON c.id = t.category_id
         WHERE t.user_id = ? ORDER BY t.date DESC, t.id DESC LIMIT 8`,
        [userId],
      ),
      getRecurring(userId),
      query("SELECT * FROM goals WHERE user_id = ? ORDER BY created_at, id LIMIT 3", [userId]),
    ]);
    const upcoming = recurring
      .filter((r) => r.active)
      .flatMap((r) => occurrencesUntil(r, addDays(today, 14)).dates.map((date) => ({ ...r, date })))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5);
    res.json({ today, accounts, cashflow, netWorth, spending, budgets, recent, upcoming, goals });
  }),
);

router.get(
  "/summary",
  handler(async (req, res) => {
    const { id: userId, timezone } = req.user;
    const months = [3, 6, 12, 24].includes(Number(req.query.months)) ? Number(req.query.months) : 12;
    const today = todayIn(timezone);
    const cashflow = await monthlyCashflow(userId, today, months);
    const from = `${cashflow[0].month}-01`;
    const to = monthEnd(today);
    const [netWorth, expenseByCategory, incomeByCategory, payees] = await Promise.all([
      netWorthSeries(userId, today, months),
      categoryTotals(userId, "expense", from, to),
      categoryTotals(userId, "income", from, to),
      topPayees(userId, from, to),
    ]);
    res.json({ months, from, to, cashflow, netWorth, expenseByCategory, incomeByCategory, payees });
  }),
);

export default router;
