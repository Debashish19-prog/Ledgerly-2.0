import { useEffect, useState } from "react";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import { formatMonth, money } from "../lib/format";

ChartJS.register(ArcElement, BarElement, CategoryScale, Filler, LinearScale, LineElement, PointElement, Tooltip);

/** Reads chart colors from the CSS variables and updates when the theme changes. */
function useThemeColors() {
  const read = () => {
    const css = getComputedStyle(document.documentElement);
    const v = (name) => css.getPropertyValue(name).trim();
    return {
      income: v("--chart-income"),
      expense: v("--chart-expense"),
      line: v("--chart-line"),
      grid: v("--chart-grid"),
      muted: v("--muted"),
      surface: v("--surface"),
      text: v("--text"),
      border: v("--border"),
    };
  };
  const [colors, setColors] = useState(read);
  useEffect(() => {
    const update = () => setColors(read());
    window.addEventListener("app:theme", update);
    return () => window.removeEventListener("app:theme", update);
  }, []);
  return colors;
}

/** "#rrggbb" -> "rgba(r, g, b, alpha)" (canvas can't draw color-mix()). */
const withAlpha = (hex, alpha) => {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

function baseOptions(c, currency) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: c.surface,
        titleColor: c.text,
        bodyColor: c.text,
        borderColor: c.border,
        borderWidth: 1,
        padding: 10,
        boxPadding: 4,
        callbacks: {
          title: (items) => formatMonth(items[0].label),
          label: (item) => ` ${item.dataset.label}: ${money(item.parsed.y, currency)}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { color: c.muted, callback(value) {
          return formatMonth(this.getLabelForValue(value));
        } },
      },
      y: {
        grid: { color: c.grid },
        border: { display: false },
        ticks: { color: c.muted, maxTicksLimit: 6, callback: (v) => money(v, currency, true) },
      },
    },
  };
}

export function Legend({ items }) {
  return (
    <div className="legend">
      {items.map((i) => (
        <span key={i.label}>
          <i style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

export function CashflowChart({ data, currency, height = 260 }) {
  const c = useThemeColors();
  const dataset = (label, key, color) => ({
    label,
    data: data.map((d) => d[key]),
    backgroundColor: color,
    borderRadius: 4,
    borderSkipped: "start",
    maxBarThickness: 22,
  });
  return (
    <div>
      <Legend items={[{ label: "Income", color: c.income }, { label: "Expenses", color: c.expense }]} />
      <div style={{ height, marginTop: 12 }}>
        <Bar
          data={{
            labels: data.map((d) => d.month),
            datasets: [dataset("Income", "income", c.income), dataset("Expenses", "expense", c.expense)],
          }}
          options={{ ...baseOptions(c, currency), datasets: { bar: { categoryPercentage: 0.7, barPercentage: 0.9 } } }}
          aria-label="Income versus expenses by month"
        />
      </div>
    </div>
  );
}

export function NetWorthChart({ data, currency, height = 260 }) {
  const c = useThemeColors();
  return (
    <div style={{ height }}>
      <Line
        data={{
          labels: data.map((d) => d.month),
          datasets: [
            {
              label: "Net worth",
              data: data.map((d) => d.netWorth),
              borderColor: c.line,
              backgroundColor: withAlpha(c.line, 0.14),
              fill: true,
              tension: 0.3,
              cubicInterpolationMode: "monotone", // no overshoot below real values
              borderWidth: 2,
              pointRadius: 0,
              pointHoverRadius: 5,
              pointHoverBorderWidth: 2,
              pointHoverBorderColor: c.surface,
              pointBackgroundColor: c.line,
            },
          ],
        }}
        options={baseOptions(c, currency)}
        aria-label="Net worth by month"
      />
    </div>
  );
}

/** Part-to-whole of spending: top 5 categories plus "Other". */
export function SpendingDoughnut({ rows, currency, size = 180 }) {
  const c = useThemeColors();
  const top = rows.slice(0, 5);
  const rest = rows.slice(5).reduce((s, r) => s + r.total, 0);
  const slices = rest > 0 ? [...top, { name: "Other", color: "#94a3b8", total: rest }] : top;
  const total = rows.reduce((s, r) => s + r.total, 0);
  return (
    <div style={{ position: "relative", height: size, width: size, margin: "0 auto" }}>
      <Doughnut
        data={{
          labels: slices.map((s) => s.name),
          datasets: [
            {
              data: slices.map((s) => s.total),
              backgroundColor: slices.map((s) => s.color),
              borderColor: c.surface,
              borderWidth: 2,
              hoverOffset: 4,
            },
          ],
        }}
        options={{
          cutout: "72%",
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: c.surface,
              titleColor: c.text,
              bodyColor: c.text,
              borderColor: c.border,
              borderWidth: 1,
              callbacks: { label: (i) => ` ${money(i.parsed, currency)} (${((i.parsed / total) * 100).toFixed(0)}%)` },
            },
          },
        }}
        aria-label="Spending by category"
      />
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none", textAlign: "center" }}>
        <div>
          <div className="xs muted">Total</div>
          <div className="num" style={{ fontWeight: 650 }}>{money(total, currency, true)}</div>
        </div>
      </div>
    </div>
  );
}

/** Ranked horizontal bars (HTML) for comparing categories. */
export function CategoryBars({ rows, currency, limit = 8 }) {
  const total = rows.reduce((s, r) => s + r.total, 0);
  const shown = rows.slice(0, limit);
  const rest = rows.slice(limit);
  const list = rest.length
    ? [...shown, { category_id: "other", name: `Other (${rest.length})`, color: "#94a3b8", icon: "…", total: rest.reduce((s, r) => s + r.total, 0) }]
    : shown;
  const max = Math.max(...list.map((r) => r.total), 1);
  return (
    <div>
      {list.map((r) => (
        <div key={r.category_id ?? "none"} className="cat-row">
          <div className="cat-row-top">
            <span className="truncate">
              <span className="dot" style={{ background: r.color, marginRight: 8 }} />
              {r.name}
            </span>
            <span style={{ display: "flex", gap: 12, flexShrink: 0 }}>
              <span className="muted xs" style={{ width: 34, textAlign: "right" }}>
                {total ? ((r.total / total) * 100).toFixed(0) : 0}%
              </span>
              <span className="num" style={{ width: 96, textAlign: "right", fontWeight: 600 }}>
                {money(r.total, currency)}
              </span>
            </span>
          </div>
          <div className="progress" style={{ height: 6 }}>
            <div style={{ width: `${(r.total / max) * 100}%`, background: r.color }} />
          </div>
        </div>
      ))}
    </div>
  );
}
