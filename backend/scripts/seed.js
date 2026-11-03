// Creates (or resets) a demo user with ~6 months of realistic data.
//   npm run db:seed   ->  demo@example.com / demo1234
import bcrypt from "bcryptjs";
import { pool, withTransaction } from "../src/db.js";
import { addDays, addMonths, monthStart, todayIn } from "../src/utils/dates.js";
import { insertDefaultCategories } from "../src/utils/defaults.js";

const EMAIL = "demo@example.com";
const PASSWORD = "demo1234";
const TIMEZONE = "Asia/Kolkata";

// Deterministic pseudo-random numbers so the demo data is the same every run.
let seed = 42;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const between = (min, max) => Math.round((min + rand() * (max - min)) * 100) / 100;
const pick = (xs) => xs[Math.floor(rand() * xs.length)];

const today = todayIn(TIMEZONE);

await withTransaction(async (conn) => {
  await conn.execute("DELETE FROM users WHERE email = ?", [EMAIL]);
  const [u] = await conn.execute(
    "INSERT INTO users (name, email, password_hash, currency, timezone) VALUES (?, ?, ?, 'INR', ?)",
    ["Demo User", EMAIL, await bcrypt.hash(PASSWORD, 12), TIMEZONE],
  );
  const userId = u.insertId;
  await insertDefaultCategories(conn, userId);
  const [cats] = await conn.execute("SELECT id, name FROM categories WHERE user_id = ?", [userId]);
  const cat = (name) => cats.find((c) => c.name === name).id;

  const account = async (name, type, opening, color) => {
    const [r] = await conn.execute(
      "INSERT INTO accounts (user_id, name, type, opening_balance, color) VALUES (?, ?, ?, ?, ?)",
      [userId, name, type, opening, color],
    );
    return r.insertId;
  };
  const bank = await account("HDFC Savings", "bank", 85000, "#3b82f6");
  const card = await account("ICICI Credit Card", "credit_card", 0, "#ef4444");
  const cash = await account("Cash", "cash", 3000, "#10b981");
  const wallet = await account("Paytm Wallet", "wallet", 500, "#06b6d4");
  const invest = await account("Mutual Funds", "investment", 150000, "#a855f7");

  const tx = [];
  // [type, amount, date, account, toAccount, category, payee]
  const add = (type, amount, date, accountId, toAccountId, categoryId, payee) => {
    if (date <= today) tx.push([userId, type, amount, date, accountId, toAccountId, categoryId, payee]);
  };

  const start = addMonths(monthStart(today), -5);
  const spends = [
    ["Groceries", ["BigBasket", "DMart", "Zepto", "Blinkit"], 400, 2800, 6],
    ["Dining Out", ["Swiggy", "Zomato", "Starbucks", "Chai Point"], 180, 1400, 8],
    ["Transport", ["Uber", "Ola", "Indian Oil", "Metro card"], 90, 900, 7],
    ["Shopping", ["Amazon", "Myntra", "Flipkart"], 500, 4500, 2],
    ["Entertainment", ["BookMyShow", "PVR"], 300, 1200, 1],
    ["Health", ["Apollo Pharmacy", "Cult.fit"], 200, 1800, 1],
  ];
  for (let m = 0; m < 6; m++) {
    const first = addMonths(start, m);
    add("income", 145000, first, bank, null, cat("Salary"), "Acme Corp");
    add("expense", 32000, addDays(first, 2), bank, null, cat("Rent & Housing"), "Landlord");
    add("expense", between(1800, 3200), addDays(first, 9), bank, null, cat("Utilities"), "Electricity bill");
    add("expense", 799, addDays(first, 11), bank, null, cat("Utilities"), "Airtel Fiber");
    add("expense", 649, addDays(first, 14), card, null, cat("Subscriptions"), "Netflix");
    add("transfer", 15000, addDays(first, 5), bank, invest, null, "Monthly SIP");
    add("transfer", 4000, addDays(first, 3), bank, cash, null, "ATM withdrawal");
    if (m % 2 === 1) add("income", between(8000, 25000), addDays(first, 18), bank, null, cat("Freelance"), "Upwork");
    if (m > 0) add("transfer", between(14000, 22000), addDays(first, 6), bank, card, null, "Card bill payment");
    for (const [name, payees, min, max, times] of spends) {
      for (let i = 0; i < times; i++) {
        const payee = pick(payees);
        const acc = payee === "Metro card" ? wallet : rand() < 0.55 ? card : rand() < 0.5 ? bank : cash;
        add("expense", between(min, max), addDays(first, Math.floor(rand() * 28)), acc, null, cat(name), payee);
      }
    }
  }
  add("expense", 18500, addDays(start, 40), card, null, cat("Travel"), "IndiGo");
  await conn.query(
    "INSERT INTO transactions (user_id, type, amount, date, account_id, to_account_id, category_id, payee) VALUES ?",
    [tx],
  );

  const nextMonth = addMonths(monthStart(today), 1);
  await conn.query(
    `INSERT INTO recurring (user_id, type, amount, account_id, to_account_id, category_id, payee, frequency, next_date) VALUES ?`,
    [
      [
        [userId, "income", 145000, bank, null, cat("Salary"), "Acme Corp", "monthly", nextMonth],
        [userId, "expense", 32000, bank, null, cat("Rent & Housing"), "Landlord", "monthly", addDays(nextMonth, 2)],
        [userId, "transfer", 15000, bank, invest, null, "Monthly SIP", "monthly", addDays(nextMonth, 5)],
        [userId, "expense", 12000, bank, null, cat("Health"), "Health insurance", "yearly", addMonths(today, 3)],
      ],
    ],
  );
  await conn.query("INSERT INTO budgets (user_id, category_id, amount) VALUES ?", [
    [
      [userId, cat("Groceries"), 9000],
      [userId, cat("Dining Out"), 5000],
      [userId, cat("Transport"), 3500],
      [userId, cat("Shopping"), 6000],
    ],
  ]);
  await conn.query("INSERT INTO goals (user_id, name, target_amount, saved_amount, target_date, color) VALUES ?", [
    [
      [userId, "Emergency fund", 500000, 210000, null, "#10b981"],
      [userId, "Goa trip", 60000, 22000, addMonths(today, 4), "#f59e0b"],
      [userId, "New laptop", 150000, 150000, null, "#6366f1"],
    ],
  ]);
  console.log(`Seeded ${tx.length} transactions. Sign in with ${EMAIL} / ${PASSWORD}`);
});
await pool.end();
