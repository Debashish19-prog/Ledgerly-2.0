import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { f, handler, HttpError, validate } from "../utils/http.js";

const router = Router();

const ACCOUNT_BALANCES_SQL = `
  SELECT a.id, a.name, a.type, a.color, a.archived, a.opening_balance,
         a.opening_balance + COALESCE(SUM(
           CASE
             WHEN t.type = 'income' AND t.account_id = a.id THEN t.amount
             WHEN t.type IN ('expense', 'transfer') AND t.account_id = a.id THEN -t.amount
             WHEN t.type = 'transfer' AND t.to_account_id = a.id THEN t.amount
             ELSE 0
           END), 0) AS balance,
         COUNT(t.id) AS tx_count
  FROM accounts a
  LEFT JOIN transactions t ON t.account_id = a.id OR t.to_account_id = a.id
  WHERE a.user_id = ?
  GROUP BY a.id
  ORDER BY a.archived, a.created_at, a.id`;

export async function getAccountsWithBalances(userId) {
  const rows = await query(ACCOUNT_BALANCES_SQL, [userId]);
  return rows.map((r) => ({ ...r, archived: !!r.archived, balance: Number(r.balance), tx_count: Number(r.tx_count) }));
}

const schema = z.object({
  name: f.name,
  type: z.enum(["cash", "bank", "credit_card", "wallet", "investment", "loan"]),
  opening_balance: f.money.default(0),
  color: f.color,
});

router.get(
  "/",
  handler(async (req, res) => res.json(await getAccountsWithBalances(req.user.id))),
);

router.post(
  "/",
  handler(async (req, res) => {
    const a = validate(schema, req.body);
    const result = await query("INSERT INTO accounts (user_id, name, type, opening_balance, color) VALUES (?, ?, ?, ?, ?)", [
      req.user.id,
      a.name,
      a.type,
      a.opening_balance,
      a.color,
    ]);
    res.status(201).json({ id: result.insertId });
  }),
);

router.put(
  "/:id",
  handler(async (req, res) => {
    const id = validate(f.id, req.params.id);
    const a = validate(schema, req.body);
    const result = await query(
      "UPDATE accounts SET name = ?, type = ?, opening_balance = ?, color = ? WHERE id = ? AND user_id = ?",
      [a.name, a.type, a.opening_balance, a.color, id, req.user.id],
    );
    if (result.affectedRows === 0) throw new HttpError(404, "Account not found");
    res.json({ ok: true });
  }),
);

router.patch(
  "/:id/archive",
  handler(async (req, res) => {
    const id = validate(f.id, req.params.id);
    const { archived } = validate(z.object({ archived: z.boolean() }), req.body);
    await query("UPDATE accounts SET archived = ? WHERE id = ? AND user_id = ?", [archived ? 1 : 0, id, req.user.id]);
    res.json({ ok: true });
  }),
);

router.delete(
  "/:id",
  handler(async (req, res) => {
    const id = validate(f.id, req.params.id);
    // Cascades to the account's transactions and recurring rules.
    await query("DELETE FROM accounts WHERE id = ? AND user_id = ?", [id, req.user.id]);
    res.json({ ok: true });
  }),
);

export default router;
