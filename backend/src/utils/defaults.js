export const DEFAULT_CATEGORIES = [
  { name: "Salary", kind: "income", color: "#10b981", icon: "💼" },
  { name: "Freelance", kind: "income", color: "#14b8a6", icon: "💻" },
  { name: "Interest & Dividends", kind: "income", color: "#22c55e", icon: "📈" },
  { name: "Other Income", kind: "income", color: "#84cc16", icon: "➕" },
  { name: "Groceries", kind: "expense", color: "#f59e0b", icon: "🛒" },
  { name: "Dining Out", kind: "expense", color: "#f97316", icon: "🍽️" },
  { name: "Rent & Housing", kind: "expense", color: "#ef4444", icon: "🏠" },
  { name: "Utilities", kind: "expense", color: "#eab308", icon: "💡" },
  { name: "Transport", kind: "expense", color: "#3b82f6", icon: "🚗" },
  { name: "Shopping", kind: "expense", color: "#ec4899", icon: "🛍️" },
  { name: "Health", kind: "expense", color: "#06b6d4", icon: "💊" },
  { name: "Entertainment", kind: "expense", color: "#a855f7", icon: "🎬" },
  { name: "Subscriptions", kind: "expense", color: "#8b5cf6", icon: "🔁" },
  { name: "Travel", kind: "expense", color: "#0ea5e9", icon: "✈️" },
  { name: "Education", kind: "expense", color: "#6366f1", icon: "🎓" },
  { name: "Other Expense", kind: "expense", color: "#78716c", icon: "🏷️" },
];

export async function insertDefaultCategories(conn, userId) {
  const values = DEFAULT_CATEGORIES.map((c) => [userId, c.name, c.kind, c.color, c.icon]);
  await conn.query("INSERT INTO categories (user_id, name, kind, color, icon) VALUES ?", [values]);
}
