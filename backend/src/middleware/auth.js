import jwt from "jsonwebtoken";
import { query } from "../db.js";
import { HttpError } from "../utils/http.js";

export function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === "change-me-to-a-long-random-string") {
    if (process.env.NODE_ENV === "production") throw new Error("JWT_SECRET is not set");
    return "dev-only-insecure-secret";
  }
  return secret;
}

export function signToken(userId) {
  return jwt.sign({}, jwtSecret(), { subject: String(userId), expiresIn: "30d" });
}

/** Verifies the Bearer token and loads the user into req.user. */
export async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) throw new HttpError(401, "Please sign in");
    let payload;
    try {
      payload = jwt.verify(token, jwtSecret());
    } catch {
      throw new HttpError(401, "Your session has expired. Please sign in again.");
    }
    const [user] = await query("SELECT id, name, email, currency, timezone FROM users WHERE id = ?", [payload.sub]);
    if (!user) throw new HttpError(401, "Please sign in");
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}
