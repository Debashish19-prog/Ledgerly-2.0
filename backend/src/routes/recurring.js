import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { postDueRecurring } from "../services/recurring.js";
import { assertOwned, f, handler, HttpError, validate } from "../utils/http.js";

const router = Router();

export async function getRecurring(userId) {
  const rows = await query(
    `SELECT r.*, a.name AS account_name, ta.name AS to_account_name,
            c.name AS category_name, c.color AS category_color, c.icon AS category_icon
     FROM recurring r
     JOIN accounts a ON a.id = r.account_id
     LEFT JOIN accounts ta ON ta.id = r.to_account_id
     LEFT JOIN categories c ON c.id = r.category_id
     WHERE r.user_id = ?
     ORDER BY r.active DESC, r.next_date`,
    [userId],
  );
  return rows.map((r) => ({ ...r, active: !!r.active }));
}

const schema = z
  .object({
    type: f.txType,
    amount: f.amount,
    account_id: f.id,
    to_account_id: f.optionalId,
    category_id: f.optionalId,
    payee: f.text(200),
    notes: f.text(1000),
    frequency: z.enum(["daily", "weekly", "monthly", "yearly"]),
    interval_count: z.coerce.number().int().min(1).max(365).default(1),
    next_date: f.date,
    end_date: f.optionalDate,
  })
  .refine((v) => v.type !== "transfer" || (v.to_account_id && v.to_account_id !== v.account_id), {
    message: "Choose a different destination account for the transfer",
    path: ["to_account_id"],
  })
  .refine((v) => !v.end_date || v.end_date >= v.next_date, {
    message: "End date must be after the start date",
    path: ["end_date"],
  })
  .transform((v) => ({
    ...v,
    to_account_id: v.type === "transfer" ? v.to_account_id : null,
    category_id: v.type === "transfer" ? null : v.category_id,
  }));

const columns = (r) => [
  r.type,
  r.amount,
  r.account_id,
  r.to_account_id,
  r.category_id,
  r.payee,
  r.notes,
  r.frequency,
  r.interval_count,
  r.next_date,
  r.end_date,
];

router.get(
  "/",
  handler(async (req, res) => {
    await postDueRecurring(req.user.id, req.user.timezone);
    res.json(await getRecurring(req.user.id));
  }),
);

router.post(
  "/",
  handler(async (req, res) => {
    const r = validate(schema, req.body);
    await assertOwned("accounts", [r.account_id, r.to_account_id], req.user.id);
    await assertOwned("categories", [r.category_id], req.user.id);
    const result = await query(
      `INSERT INTO recurring (type, amount, account_id, to_account_id, category_id, payee, notes, frequency, interval_count, next_date, end_date, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [...columns(r), req.user.id],
    );
    // Post anything already due (e.g. a start date in the past).
    const posted = await postDueRecurring(req.user.id, req.user.timezone);
    res.status(201).json({ id: result.insertId, posted });
  }),
);

router.put(
  "/:id",
  handler(async (req, res) => {
    const id = validate(f.id, req.params.id);
    const r = validate(schema, req.body);
    await assertOwned("accounts", [r.account_id, r.to_account_id], req.user.id);
    await assertOwned("categories", [r.category_id], req.user.id);
    const result = await query(
      `UPDATE recurring SET type = ?, amount = ?, account_id = ?, to_account_id = ?, category_id = ?, payee = ?, notes = ?,
              frequency = ?, interval_count = ?, next_date = ?, end_date = ?, active = 1
       WHERE id = ? AND user_id = ?`,
      [...columns(r), id, req.user.id],
    );
    if (result.affectedRows === 0) throw new HttpError(404, "Recurring transaction not found");
    const posted = await postDueRecurring(req.user.id, req.user.timezone);
    res.json({ ok: true, posted });
  }),
);

router.patch(
  "/:id/active",
  handler(async (req, res) => {
    const id = validate(f.id, req.params.id);
    const { active } = validate(z.object({ active: z.boolean() }), req.body);
    await query("UPDATE recurring SET active = ? WHERE id = ? AND user_id = ?", [active ? 1 : 0, id, req.user.id]);
    if (active) await postDueRecurring(req.user.id, req.user.timezone);
    res.json({ ok: true });
  }),
);

router.delete(
  "/:id",
  handler(async (req, res) => {
    const id = validate(f.id, req.params.id);
    // Transactions already posted are kept (recurring_id becomes NULL).
    await query("DELETE FROM recurring WHERE id = ? AND user_id = ?", [id, req.user.id]);
    res.json({ ok: true });
  }),
);

export default router;
