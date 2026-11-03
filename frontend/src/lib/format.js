const localeFor = (currency) => (currency === "INR" ? "en-IN" : "en-US");

export function money(amount, currency, compact = false) {
  return new Intl.NumberFormat(localeFor(currency), {
    style: "currency",
    currency,
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 2,
  }).format(amount);
}

const toUtc = (d) => new Date(`${d}T00:00:00Z`);

export function formatDate(d, opts = { day: "numeric", month: "short", year: "numeric" }) {
  return toUtc(d).toLocaleDateString("en-GB", { timeZone: "UTC", ...opts });
}

export const formatMonth = (ym) =>
  toUtc(`${ym.slice(0, 7)}-01`).toLocaleDateString("en-GB", { timeZone: "UTC", month: "short", year: "2-digit" });

export function addMonths(d, months) {
  const x = toUtc(d);
  const day = x.getUTCDate();
  const t = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + months, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(day, last));
  return t.toISOString().slice(0, 10);
}

export const monthEnd = (d) => {
  const x = toUtc(`${d.slice(0, 7)}-01`);
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
};

export const localToday = () => new Date().toLocaleDateString("en-CA");

export const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

export const ACCOUNT_TYPES = {
  cash: "Cash",
  bank: "Bank account",
  credit_card: "Credit card",
  wallet: "Wallet / UPI",
  investment: "Investment",
  loan: "Loan",
};

export const PALETTE = [
  "#6366f1", "#3b82f6", "#0ea5e9", "#06b6d4", "#14b8a6", "#10b981", "#22c55e", "#84cc16",
  "#eab308", "#f59e0b", "#f97316", "#ef4444", "#f43f5e", "#ec4899", "#a855f7", "#64748b",
];

export const CURRENCIES = ["INR", "USD", "EUR", "GBP", "JPY", "AUD", "CAD", "SGD", "AED"];

export const FREQUENCY = { daily: "day", weekly: "week", monthly: "month", yearly: "year" };
