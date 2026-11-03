// Creates the database (if it doesn't exist) and all tables from db/schema.sql.
import "dotenv/config";
import fs from "node:fs";
import mysql from "mysql2/promise";
import { sslOptions } from "../src/db.js";

const dbName = process.env.DB_NAME ?? "expense_tracker";
if (!/^\w+$/.test(dbName)) throw new Error("DB_NAME may only contain letters, numbers and underscores");

const conn = await mysql.createConnection({
  host: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: sslOptions(),
  multipleStatements: true,
});
await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4`);
await conn.query(`USE \`${dbName}\``);
await conn.query(fs.readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));
await conn.end();
const { pool } = await import("../src/db.js");
await pool.end();
console.log(`Database "${dbName}" is ready`);
