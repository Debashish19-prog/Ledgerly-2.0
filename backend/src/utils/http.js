import { z } from "zod";
import { query } from "../db.js";

/** An error that is safe to show to the client. */
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Validates a request body with a zod schema, throwing a 400 with a readable message. */
export function validate(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue.path.join(".");
    throw new HttpError(400, field ? `${field}: ${issue.message}` : issue.message);
  }
  return result.data;
}

/** Wraps an async route handler so thrown errors reach the error middleware. */
export const handler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Throws 404 unless every given row id in `table` belongs to the user. */
export async function assertOwned(table, ids, userId) {
  const wanted = [...new Set(ids.filter((x) => x != null))];
  if (wanted.length === 0) return;
  const placeholders = wanted.map(() => "?").join(",");
  const rows = await query(`SELECT id FROM ${table} WHERE user_id = ? AND id IN (${placeholders})`, [userId, ...wanted]);
  if (rows.length !== wanted.length) throw new HttpError(404, `${table.replace(/s$/, "")} not found`);
}

/* Reusable field schemas. */
export const f = {
  id: z.coerce.number().int().positive(),
  optionalId: z
    .union([z.coerce.number().int().positive(), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v ? v : null)),
  name: z.string().trim().min(1, "is required").max(100),
  text: (max) => z.string().trim().max(max).default(""),
  amount: z.coerce.number().positive("must be greater than 0").max(1e12),
  money: z.coerce.number().min(-1e12).max(1e12),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be a date (YYYY-MM-DD)"),
  optionalDate: z
    .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v ? v : null)),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "must be a hex color like #6366f1"),
  txType: z.enum(["expense", "income", "transfer"]),
};
