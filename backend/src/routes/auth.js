import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { query, withTransaction } from "../db.js";
import { requireAuth, signToken } from "../middleware/auth.js";
import { insertDefaultCategories } from "../utils/defaults.js";
import { handler, HttpError, validate } from "../utils/http.js";

const router = Router();

const validTimezone = (tz) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.email("Enter a valid email").transform((e) => e.toLowerCase()),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  currency: z.string().regex(/^[A-Z]{3}$/).default("INR"),
  timezone: z.string().max(64).default("Asia/Kolkata"),
});

router.post(
  "/register",
  handler(async (req, res) => {
    if (process.env.ALLOW_REGISTRATION === "false") throw new HttpError(403, "Registration is closed");
    const data = validate(registerSchema, req.body);
    const timezone = validTimezone(data.timezone) ? data.timezone : "UTC";
    const [existing] = await query("SELECT id FROM users WHERE email = ?", [data.email]);
    if (existing) throw new HttpError(409, "An account with this email already exists");

    const hash = await bcrypt.hash(data.password, 12);
    const userId = await withTransaction(async (conn) => {
      const [result] = await conn.execute(
        "INSERT INTO users (name, email, password_hash, currency, timezone) VALUES (?, ?, ?, ?, ?)",
        [data.name, data.email, hash, data.currency, timezone],
      );
      await insertDefaultCategories(conn, result.insertId);
      return result.insertId;
    });
    res.status(201).json({
      token: signToken(userId),
      user: { id: userId, name: data.name, email: data.email, currency: data.currency, timezone },
    });
  }),
);

const loginSchema = z.object({
  email: z.string().trim().toLowerCase(),
  password: z.string().min(1, "Password is required"),
});

// Compared against when the email doesn't exist, so response time doesn't reveal it.
const DUMMY_HASH = bcrypt.hashSync("timing-equalizer", 12);

router.post(
  "/login",
  handler(async (req, res) => {
    const { email, password } = validate(loginSchema, req.body);
    const [user] = await query("SELECT id, name, email, currency, timezone, password_hash FROM users WHERE email = ?", [email]);
    const ok = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
    if (!user || !ok) throw new HttpError(401, "Invalid email or password");
    const { password_hash: _omit, ...publicUser } = user;
    res.json({ token: signToken(user.id), user: publicUser });
  }),
);

router.get("/me", requireAuth, (req, res) => res.json({ user: req.user }));

const profileSchema = z.object({
  name: z.string().trim().min(1, "is required").max(100),
  currency: z.string().regex(/^[A-Z]{3}$/, "must be a 3-letter currency code"),
  timezone: z.string().refine(validTimezone, "is not a valid timezone"),
});

router.put(
  "/profile",
  requireAuth,
  handler(async (req, res) => {
    const data = validate(profileSchema, req.body);
    await query("UPDATE users SET name = ?, currency = ?, timezone = ? WHERE id = ?", [
      data.name,
      data.currency,
      data.timezone,
      req.user.id,
    ]);
    res.json({ user: { ...req.user, ...data } });
  }),
);

const passwordSchema = z.object({
  current: z.string().min(1, "Current password is required"),
  next: z.string().min(8, "New password must be at least 8 characters").max(200),
});

router.put(
  "/password",
  requireAuth,
  handler(async (req, res) => {
    const { current, next } = validate(passwordSchema, req.body);
    const [row] = await query("SELECT password_hash FROM users WHERE id = ?", [req.user.id]);
    if (!(await bcrypt.compare(current, row.password_hash))) throw new HttpError(400, "Current password is incorrect");
    await query("UPDATE users SET password_hash = ? WHERE id = ?", [await bcrypt.hash(next, 12), req.user.id]);
    res.json({ ok: true });
  }),
);

router.delete(
  "/account",
  requireAuth,
  handler(async (req, res) => {
    if (req.body?.confirmEmail !== req.user.email) throw new HttpError(400, "Type your email to confirm");
    // Foreign keys cascade to all of the user's data.
    await query("DELETE FROM users WHERE id = ?", [req.user.id]);
    res.json({ ok: true });
  }),
);

export default router;
