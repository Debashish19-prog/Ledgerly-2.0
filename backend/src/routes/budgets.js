import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { addMonths, monthEnd, todayIn } from "../utils/dates.js";
import { assertOwned, f, handler, validate } from "../utils/http.js";

const router = Router();

/** Budgets with this month's spending and the average of the previous 3 months. */
export async function getBudgets(userId, month) {
  const from = `${month}-01`;
  const to = monthEnd(from);
  const prevFrom = addMonths(from, -3);
  const rows = await query(
    `SELECT b.id, b.amount, b.category_id, c.name, c.color, c.icon,
            COALESCE(SUM(CASE WHEN t.date >= ? THEN t.amount END), 0) AS spent,
            COALESCE(SUM(CASE WHEN t.date < ? THEN t.amount END), 0) / 3 AS avg3
     FROM budgets b
     JOIN categories c ON c.id = b.category_id
     LEFT JOIN transactions t
       ON t.category_id = b.category_id AND t.type = 'expense' AND t.date BETWEEN ? AND ?
     WHERE b.user_id = ?
     GROUP BY b.id
     ORDER BY c.name`,
    [from, from, prevFrom, to, userId],
  );
  return rows.map((r) => ({ ...r, spent: Number(r.spent), avg3: Number(r.avg3) }));
}

router.get(
  "/",
  handler(async (req, res) => {
    const today = todayIn(req.user.timezone);
    const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(req.query.month ?? "") ? req.query.month : today.slice(0, 7);
    res.json({ month, budgets: await getBudgets(req.user.id, month) });
  }),
);

// Create or update the budget for a category.
router.put(
  "/",
  handler(async (req, res) => {
    const b = validate(z.object({ category_id: f.id, amount: f.amount }), req.body);
    await assertOwned("categories", [b.category_id], req.user.id);
    await query(
      "INSERT INTO budgets (user_id, category_id, amount) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE amount = VALUES(amount)",
      [req.user.id, b.category_id, b.amount],
    );
    res.json({ ok: true });
  }),
);

router.delete(
  "/:id",
  handler(async (req, res) => {
    const id = validate(f.id, req.params.id);
    await query("DELETE FROM budgets WHERE id = ? AND user_id = ?", [id, req.user.id]);
    res.json({ ok: true });
  }),
);

export default router;
