import "dotenv/config";
import express from "express";
import cors from "cors";
import { pool } from "./db.js";
import { requireAuth } from "./middleware/auth.js";
import { errorHandler, notFound } from "./middleware/error.js";
import authRoutes from "./routes/auth.js";
import accountRoutes from "./routes/accounts.js";
import categoryRoutes from "./routes/categories.js";
import transactionRoutes from "./routes/transactions.js";
import budgetRoutes from "./routes/budgets.js";
import recurringRoutes from "./routes/recurring.js";
import goalRoutes from "./routes/goals.js";
import reportRoutes from "./routes/reports.js";

// The REST API. server.js runs it as a normal server (local / Render);
// api/index.js exposes it as a Vercel serverless function.
const app = express();
app.disable("x-powered-by");
app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173" }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", async (_req, res) => {
  await pool.query("SELECT 1");
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/accounts", requireAuth, accountRoutes);
app.use("/api/categories", requireAuth, categoryRoutes);
app.use("/api/transactions", requireAuth, transactionRoutes);
app.use("/api/budgets", requireAuth, budgetRoutes);
app.use("/api/recurring", requireAuth, recurringRoutes);
app.use("/api/goals", requireAuth, goalRoutes);
app.use("/api/reports", requireAuth, reportRoutes);
app.use("/api", notFound);
app.use(errorHandler);

export default app;
