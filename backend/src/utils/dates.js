// Dates are plain "YYYY-MM-DD" strings throughout the app.

export function todayIn(timezone = "UTC") {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const toUtc = (d) => new Date(`${d}T00:00:00Z`);
const fromUtc = (d) => d.toISOString().slice(0, 10);

export function addDays(d, days) {
  const x = toUtc(d);
  x.setUTCDate(x.getUTCDate() + days);
  return fromUtc(x);
}

/** Adds months, clamping to the end of the month (Jan 31 + 1 month = Feb 28). */
export function addMonths(d, months) {
  const x = toUtc(d);
  const day = x.getUTCDate();
  const target = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return fromUtc(target);
}

export const monthStart = (d) => `${d.slice(0, 7)}-01`;
export const monthEnd = (d) => addDays(addMonths(monthStart(d), 1), -1);

/** "YYYY-MM" keys for the `count` months ending with the month of `end`. */
export function monthKeys(end, count) {
  const start = monthStart(end);
  return Array.from({ length: count }, (_, i) => addMonths(start, i - count + 1).slice(0, 7));
}

export const isDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(toUtc(s).getTime());
