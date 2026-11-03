import { useState } from "react";
import { CashflowChart, CategoryBars, NetWorthChart } from "../components/charts";
import { Loading, PageHeader } from "../components/ui";
import { useAuth } from "../lib/auth";
import { formatMonth, money } from "../lib/format";
import { useApi } from "../lib/useApi";

const RANGES = [3, 6, 12, 24];

export default function Reports() {
  const { user } = useAuth();
  const cur = user.currency;
  const [months, setMonths] = useState(12);
  const [showTable, setShowTable] = useState(false);
  const { data, error } = useApi(`/reports/summary?months=${months}`);
  if (!data) return <Loading error={error} />;

  const income = data.cashflow.reduce((s, m) => s + m.income, 0);
  const expense = data.cashflow.reduce((s, m) => s + m.expense, 0);
  const savingsRate = income > 0 ? ((income - expense) / income) * 100 : null;

  return (
    <>
      <PageHeader title="Reports" subtitle={`${formatMonth(data.from)} – ${formatMonth(data.to)}`}>
        <div className="tabs" role="tablist">
          {RANGES.map((r) => (
            <button key={r} role="tab" aria-selected={r === months} className={r === months ? "active" : ""} onClick={() => setMonths(r)}>
              {r}M
            </button>
          ))}
        </div>
      </PageHeader>

      <div className="grid grid-4">
        <div className="card card-pad">
          <div className="stat-label">Total income</div>
          <div className="stat-value">{money(income, cur)}</div>
        </div>
        <div className="card card-pad">
          <div className="stat-label">Total expenses</div>
          <div className="stat-value">{money(expense, cur)}</div>
        </div>
        <div className="card card-pad">
          <div className="stat-label">Net savings</div>
          <div className={`stat-value ${income - expense < 0 ? "expense" : ""}`}>{money(income - expense, cur)}</div>
        </div>
        <div className="card card-pad">
          <div className="stat-label">Savings rate</div>
          <div className="stat-value">{savingsRate === null ? "—" : `${savingsRate.toFixed(0)}%`}</div>
          <div className="stat-sub">Avg spend {money(expense / months, cur)}/month</div>
        </div>
      </div>

      <div className="grid grid-2 mt">
        <div className="card">
          <div className="card-head">
            <div>
              <h2>Income vs expenses</h2>
              <p className="muted small">Monthly totals</p>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowTable((s) => !s)}>
              {showTable ? "Show chart" : "Show table"}
            </button>
          </div>
          <div className="card-body">
            {showTable ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Income</th>
                    <th>Expenses</th>
                    <th>Net</th>
                  </tr>
                </thead>
                <tbody className="num">
                  {[...data.cashflow].reverse().map((m) => (
                    <tr key={m.month}>
                      <td>{formatMonth(m.month)}</td>
                      <td>{money(m.income, cur)}</td>
                      <td>{money(m.expense, cur)}</td>
                      <td className={m.net < 0 ? "expense" : ""}>{money(m.net, cur)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <CashflowChart data={data.cashflow} currency={cur} />
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <h2>Net worth</h2>
              <p className="muted small">Sum of all account balances at month end</p>
            </div>
          </div>
          <div className="card-body">
            <NetWorthChart data={data.netWorth} currency={cur} height={288} />
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <h2>Expenses by category</h2>
              <p className="muted small">Share of total spending</p>
            </div>
          </div>
          <div className="card-body">
            {data.expenseByCategory.length ? (
              <CategoryBars rows={data.expenseByCategory} currency={cur} />
            ) : (
              <p className="muted small">No expenses in this period.</p>
            )}
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-head">
              <h2>Income by category</h2>
            </div>
            <div className="card-body">
              {data.incomeByCategory.length ? (
                <CategoryBars rows={data.incomeByCategory} currency={cur} limit={5} />
              ) : (
                <p className="muted small">No income in this period.</p>
              )}
            </div>
          </div>
          <div className="card">
            <div className="card-head">
              <div>
                <h2>Top payees</h2>
                <p className="muted small">Where most of your money went</p>
              </div>
            </div>
            <ul className="list" style={{ marginTop: 8 }}>
              {data.payees.length === 0 && <li className="muted small">No payees recorded.</li>}
              {data.payees.map((p) => (
                <li key={p.payee} style={{ padding: "10px 20px" }}>
                  <span className="grow truncate small">{p.payee}</span>
                  <span className="xs muted">{p.count}×</span>
                  <span className="num small" style={{ fontWeight: 600 }}>
                    {money(p.total, cur)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
