import mysql from "mysql2/promise";
import "dotenv/config";

/**
 * TLS settings for hosted MySQL. Providers with their own certificate authority
 * (e.g. Aiven) need its CA certificate in DB_SSL_CA (PEM text; "\n" escapes are allowed).
 */
export function sslOptions() {
  if (process.env.DB_SSL !== "true") return undefined;
  const ca = process.env.DB_SSL_CA?.replace(/\\n/g, "\n");
  return ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: true };
}

export const pool = mysql.createPool({
  host: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME ?? "expense_tracker",
  ssl: sslOptions(),
  // Serverless platforms (Vercel) run many small instances, so keep each pool small there.
  connectionLimit: process.env.VERCEL ? 2 : 10,
  // Return DECIMAL columns as numbers and DATE columns as "YYYY-MM-DD" strings.
  decimalNumbers: true,
  dateStrings: true,
  multipleStatements: false,
});

/** Runs a parameterized query and returns the rows (or the result header for writes). */
export async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

/** Runs `fn` inside a transaction on a dedicated connection. */
export async function withTransaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
