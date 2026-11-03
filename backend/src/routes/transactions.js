import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { postDueRecurring } from "../services/recurring.js";
import { isDate } from "../utils/dates.js";
import { assertOwned, f, handler, HttpError, validate } from "../utils/http.js";

const router = Router();

const SELECT_TX = `
  SELECT t.id, t.type, t.amount, t.date, t.payee, t.notes,
         t.account_id, t.to_account_id, t.category_id, t.recurring_id,
         a.name AS account_name, a.color AS account_color,
         ta.name AS to_account_name,
         c.name AS category_name, c.color AS category_color, c.icon AS category_icon
  FROM transactions t
  JOIN accounts a ON a.id = t.account_id
  LEFT JOIN accounts ta ON ta.id = t.to_account_id
  LEFT JOIN categories c ON c.id = t.category_id`;

/** Builds a WHERE clause from query-string filters. */
export function buildFilters(userId, q) {
  const where = ["t.user_id = ?"];
  const params = [userId];
  if (q.q) {
    where.push("(t.payee LIKE ? OR t.notes LIKE ?)");
    const like = `%${String(q.q).slice(0, 100).replace(/[%_\\]/g, "\\$&")}%`;
    params.push(like, like);
  }
  if (["income", "expense", "transfer"].includes(q.type)) {
    where.push("t.type = ?");
    params.push(q.type);
  }
  if (/^\d+$/.test(q.account ?? "")) {
    where.push("(t.account_id = ? OR t.to_account_id = ?)");
    params.push(q.account, q.account);
  }
  if (q.category === "none") {
    where.push("t.category_id IS NULL AND t.type <> 'transfer'");
  } else if (/^\d+$/.test(q.category ?? "")) {
    where.push("t.category_id = ?");
    params.push(q.category);
  }
  if (isDate(q.from)) {
    where.push("t.date >= ?");
    params.push(q.from);
  }
  if (isDate(q.to)) {
    where.push("t.date <= ?");
    params.push(q.to);
  }
  return { where: where.join(" AND "), params };
}

router.get(
  "/",
  handler(async (req, res) => {
    await postDueRecurring(req.user.id, req.user.timezone);
    const { where, params } = buildFilters(req.user.id, req.query);
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(200, Math.max(1, Number.parseInt(req.query.pageSize, 10) || 50));
    const [rows, [totals]] = await Promise.all([
      // LIMIT/OFFSET are validated integers, so they're safe to inline.
      query(`${SELECT_TX} WHERE ${where} ORDER BY t.date DESC, t.id DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`, params),
      query(
        `SELECT COUNT(*) AS total,
                COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount END), 0) AS income,
                COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount END), 0) AS expense
         FROM transactions t WHERE ${where}`,
        params,
      ),
    ]);
    res.json({
      rows,
      page,
      pageSize,
      total: Number(totals.total),
      income: Number(totals.income),
      expense: Number(totals.expense),
    });
  }),
);

const escapeCsv = (v) => {
  const s = String(v ?? "");
  // Neutralize spreadsheet formula injection, then quote if needed.
  const safe = /^[=+\-@\t\r]/.test(s) && Number.isNaN(Number(s)) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

router.get(
  "/export",
  handler(async (req, res) => {
    const { where, params } = buildFilters(req.user.id, req.query);
    const rows = await query(`${SELECT_TX} WHERE ${where} ORDER BY t.date DESC, t.id DESC`, params);
    const header = ["Date", "Type", "Amount", "Currency", "Account", "To Account", "Category", "Payee", "Notes"];
    const lines = rows.map((r) =>
      [
        r.date,
        r.type,
        (r.type === "expense" ? -r.amount : r.amount).toFixed(2),
        req.user.currency,
        r.account_name,
        r.to_account_name ?? "",
        r.category_name ?? "",
        r.payee,
        r.notes,
      ]
        .map(escapeCsv)
        .join(","),
    );
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="transactions.csv"`);
    res.send([header.join(","), ...lines].join("\n"));
  }),
);

const schema = z
  .object({
    type: f.txType,
    amount: f.amount,
    date: f.date,
    account_id: f.id,
    to_account_id: f.optionalId,
    category_id: f.optionalId,
    payee: f.text(200),
    notes: f.text(1000),
  })
  .refine((v) => v.type !== "transfer" || (v.to_account_id && v.to_account_id !== v.account_id), {
    message: "Choose a different destination account for the transfer",
    path: ["to_account_id"],
  })
  .transform((v) => ({
    ...v,
    to_account_id: v.type === "transfer" ? v.to_account_id : null,
    category_id: v.type === "transfer" ? null : v.category_id,
  }));

async function checkRefs(userId, t) {
  await assertOwned("accounts", [t.account_id, t.to_account_id], userId);
  await assertOwned("categories", [t.category_id], userId);
}

router.post(
  "/",
  handler(async (req, res) => {
    const t = validate(schema, req.body);
    await checkRefs(req.user.id, t);
    const result = await query(
      `INSERT INTO transactions (user_id, type, amount, date, account_id, to_account_id, category_id, payee, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, t.type, t.amount, t.date, t.account_id, t.to_account_id, t.category_id, t.payee, t.notes],
    );
    res.status(201).json({ id: result.insertId });
  }),
);

router.put(
  "/:id",
  handler(async (req, res) => {
    const id = validate(f.id, req.params.id);
    const t = validate(schema, req.body);
    await checkRefs(req.user.id, t);
    const result = await query(
      `UPDATE transactions SET type = ?, amount = ?, date = ?, account_id = ?, to_account_id = ?, category_id = ?, payee = ?, notes = ?
       WHERE id = ? AND user_id = ?`,
      [t.type, t.amount, t.date, t.account_id, t.to_account_id, t.category_id, t.payee, t.notes, id, req.user.id],
    );
    if (result.affectedRows === 0) throw new HttpError(404, "Transaction not found");
    res.json({ ok: true });
  }),
);

router.post(
  "/bulk-delete",
  handler(async (req, res) => {
    const { ids } = validate(z.object({ ids: z.array(f.id).min(1).max(500) }), req.body);
    const result = await query(
      `DELETE FROM transactions WHERE user_id = ? AND id IN (${ids.map(() => "?").join(",")})`,
      [req.user.id, ...ids],
    );
    res.json({ deleted: result.affectedRows });
  }),
);

router.delete(
  "/:id",
  handler(async (req, res) => {
    const id = validate(f.id, req.params.id);
    await query("DELETE FROM transactions WHERE id = ? AND user_id = ?", [id, req.user.id]);
    res.json({ ok: true });
  }),
);

export default router;
