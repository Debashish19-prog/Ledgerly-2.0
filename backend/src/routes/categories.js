import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { f, handler, HttpError, validate } from "../utils/http.js";

const router = Router();

const schema = z.object({
  name: f.name,
  kind: z.enum(["income", "expense"]),
  color: f.color,
  icon: z.string().trim().min(1).max(40).default("🏷️"),
});

router.get(
  "/",
  handler(async (req, res) => {
    const rows = await query(
      `SELECT c.id, c.name, c.kind, c.color, c.icon, COUNT(t.id) AS tx_count
       FROM categories c LEFT JOIN transactions t ON t.category_id = c.id
       WHERE c.user_id = ?
       GROUP BY c.id
       ORDER BY c.kind, c.name`,
      [req.user.id],
    );
    res.json(rows.map((r) => ({ ...r, tx_count: Number(r.tx_count) })));
  }),
);

router.post(
  "/",
  handler(async (req, res) => {
    const c = validate(schema, req.body);
    const result = await query("INSERT INTO categories (user_id, name, kind, color, icon) VALUES (?, ?, ?, ?, ?)", [
      req.user.id,
      c.name,
      c.kind,
      c.color,
      c.icon,
    ]);
    res.status(201).json({ id: result.insertId });
  }),
);

router.put(
  "/:id",
  handler(async (req, res) => {
    const id = validate(f.id, req.params.id);
    const c = validate(schema, req.body);
    const result = await query("UPDATE categories SET name = ?, kind = ?, color = ?, icon = ? WHERE id = ? AND user_id = ?", [
      c.name,
      c.kind,
      c.color,
      c.icon,
      id,
      req.user.id,
    ]);
    if (result.affectedRows === 0) throw new HttpError(404, "Category not found");
    res.json({ ok: true });
  }),
);

router.delete(
  "/:id",
  handler(async (req, res) => {
    const id = validate(f.id, req.params.id);
    // Transactions become uncategorized; the category's budget is removed.
    await query("DELETE FROM categories WHERE id = ? AND user_id = ?", [id, req.user.id]);
    res.json({ ok: true });
  }),
);

export default router;
