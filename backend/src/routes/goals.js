import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { f, handler, HttpError, validate } from "../utils/http.js";

const router = Router();

const schema = z.object({
  name: f.name,
  target_amount: f.amount,
  saved_amount: z.coerce.number().min(0).max(1e12).default(0),
  target_date: f.optionalDate,
  color: f.color,
});

router.get(
  "/",
  handler(async (req, res) => {
    res.json(await query("SELECT * FROM goals WHERE user_id = ? ORDER BY created_at, id", [req.user.id]));
  }),
);

router.post(
  "/",
  handler(async (req, res) => {
    const g = validate(schema, req.body);
    const result = await query(
      "INSERT INTO goals (user_id, name, target_amount, saved_amount, target_date, color) VALUES (?, ?, ?, ?, ?, ?)",
      [req.user.id, g.name, g.target_amount, g.saved_amount, g.target_date, g.color],
    );
    res.status(201).json({ id: result.insertId });
  }),
);

router.put(
  "/:id",
  handler(async (req, res) => {
    const id = validate(f.id, req.params.id);
    const g = validate(schema, req.body);
    const result = await query(
      "UPDATE goals SET name = ?, target_amount = ?, saved_amount = ?, target_date = ?, color = ? WHERE id = ? AND user_id = ?",
      [g.name, g.target_amount, g.saved_amount, g.target_date, g.color, id, req.user.id],
    );
    if (result.affectedRows === 0) throw new HttpError(404, "Goal not found");
    res.json({ ok: true });
  }),
);

// Adds money to a goal (a negative amount records a withdrawal).
router.post(
  "/:id/contribute",
  handler(async (req, res) => {
    const id = validate(f.id, req.params.id);
    const { amount } = validate(
      z.object({ amount: z.coerce.number().refine((n) => n !== 0 && Math.abs(n) <= 1e12, "can't be 0") }),
      req.body,
    );
    await query("UPDATE goals SET saved_amount = GREATEST(saved_amount + ?, 0) WHERE id = ? AND user_id = ?", [
      amount,
      id,
      req.user.id,
    ]);
    res.json({ ok: true });
  }),
);

router.delete(
  "/:id",
  handler(async (req, res) => {
    const id = validate(f.id, req.params.id);
    await query("DELETE FROM goals WHERE id = ? AND user_id = ?", [id, req.user.id]);
    res.json({ ok: true });
  }),
);

export default router;
