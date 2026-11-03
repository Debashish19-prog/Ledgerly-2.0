import { useState } from "react";
import { Link } from "react-router-dom";
import { CashflowChart, SpendingDoughnut } from "../components/charts";
import { TransactionModal, TxList } from "../components/TxList";
import { Empty, Loading, Money, PageHeader, Progress } from "../components/ui";
import { useAuth } from "../lib/auth";
import { formatDate, money } from "../lib/format";
import { useApi } from "../lib/useApi";

function Stat({ label, children, sub }) {
  return (
    <div className="card card-pad">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{children}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

function Delta({ value, invert, currency }) {
  if (!value) return <span>No change vs last month</span>;
  const good = invert ? value < 0 : value > 0;
  return (
    <span>
      <strong className={good ? "income" : "expense"}>
        {value > 0 ? "▲" : "▼"} {money(Math.abs(value), currency)}
      </strong>{" "}
      vs last month
    </span>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data, error, reload } = useApi("/reports/dashboard");
  const cats = useApi("/categories");
  const [adding, setAdding] = useState(false);
  if (!data || !cats.data) return <Loading error={error ?? cats.error} />;

  const cur = user.currency;
  const { accounts, cashflow, netWorth, spending, budgets, recent, upcoming, goals, today } = data;
  const firstName = user.name.split(" ")[0];

  if (accounts.length === 0) {
    return (
      <>
        <PageHeader title={`Hi, ${firstName} 👋`} />
        <div className="card">
          <Empty icon="🏦" title="Let's get you set up" text="Add your bank accounts, cards and cash to see balances, spending and trends here.">
            <Link className="btn" to="/accounts">
              Add your first account
            </Link>
          </Empty>
        </div>
      </>
    );
  }

  const [prev, current] = cashflow.slice(-2);
  const total = accounts.reduce((s, a) => s + a.balance, 0);
  const nwChange = netWorth.at(-1).netWorth - netWorth.at(-2).netWorth;
  const savingsRate = current.income > 0 ? (current.net / current.income) * 100 : null;

  return (
    <>
      <PageHeader title={`Hi, ${firstName} 👋`} subtitle={formatDate(today, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}>
        <button className="btn" onClick={() => setAdding(true)}>
          ＋ Add transaction
        </button>
      </PageHeader>

      <div className="grid grid-4">
        <Stat label="Net worth" sub={<Delta value={nwChange} currency={cur} />}>
          <Money amount={total} currency={cur} />
        </Stat>
        <Stat label="Income this month" sub={<Delta value={current.income - prev.income} currency={cur} />}>
          <Money amount={current.income} currency={cur} />
        </Stat>
        <Stat label="Spent this month" sub={<Delta value={current.expense - prev.expense} invert currency={cur} />}>
          <Money amount={current.expense} currency={cur} />
        </Stat>
        <Stat label="Savings rate" sub={`Net ${money(current.net, cur)} this month`}>
          <span className={savingsRate < 0 ? "expense" : ""}>{savingsRate === null ? "—" : `${savingsRate.toFixed(0)}%`}</span>
        </Stat>
      </div>

      <div className="grid grid-3 mt">
        <div className="card span-2">
          <div className="card-head">
            <div>
              <h2>Cash flow</h2>
              <p className="muted small">Income vs expenses, last 6 months</p>
            </div>
            <Link to="/reports" className="small">
              Reports →
            </Link>
          </div>
          <div className="card-body">
            <CashflowChart data={cashflow} currency={cur} height={240} />
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <h2>Spending this month</h2>
              <p className="muted small">{money(current.expense, cur)} across {spending.length} {spending.length === 1 ? "category" : "categories"}</p>
            </div>
          </div>
          <div className="card-body">
            {spending.length === 0 ? (
              <p className="muted small" style={{ textAlign: "center", padding: "40px 0" }}>
                No expenses yet this month.
              </p>
            ) : (
              <>
                <SpendingDoughnut rows={spending} currency={cur} />
                <ul className="list" style={{ marginTop: 16 }}>
                  {spending.slice(0, 5).map((s) => (
                    <li key={s.category_id ?? "none"} style={{ padding: "6px 0", border: 0 }}>
                      <span className="dot" style={{ background: s.color }} />
                      <span className="grow truncate small">{s.name}</span>
                      <span className="num small">{money(s.total, cur)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>

        <div className="card span-2">
          <div className="card-head">
            <h2>Recent transactions</h2>
            <Link to="/transactions" className="small">
              View all →
            </Link>
          </div>
          <div style={{ marginTop: 12 }}>
            {recent.length === 0 ? (
              <p className="muted small" style={{ textAlign: "center", padding: 32 }}>
                No transactions yet.
              </p>
            ) : (
              <TxList rows={recent} currency={cur} accounts={accounts} categories={cats.data} today={today} onChange={reload} />
            )}
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-head">
              <h2>Accounts</h2>
              <Link to="/accounts" className="small">
                Manage →
              </Link>
            </div>
            <ul className="list" style={{ padding: "8px 0" }}>
              {accounts
                .filter((a) => !a.archived)
                .map((a) => (
                  <li key={a.id} style={{ border: 0, padding: "6px 20px" }}>
                    <span className="dot" style={{ background: a.color }} />
                    <span className="grow truncate small">{a.name}</span>
                    <Money amount={a.balance} currency={cur} className={`small ${a.balance < 0 ? "expense" : ""}`} />
                  </li>
                ))}
            </ul>
          </div>

          {budgets.length > 0 && (
            <div className="card">
              <div className="card-head">
                <h2>Budgets</h2>
                <Link to="/budgets" className="small">
                  All →
                </Link>
              </div>
              <div className="card-body">
                {[...budgets]
                  .sort((a, b) => b.spent / b.amount - a.spent / a.amount)
                  .slice(0, 4)
                  .map((b) => (
                    <div key={b.id} className="cat-row">
                      <div className="cat-row-top">
                        <span className="truncate">
                          {b.icon} {b.name}
                        </span>
                        <span className={`num xs ${b.spent > b.amount ? "expense" : "muted"}`}>
                          {money(b.spent, cur)} / {money(b.amount, cur)}
                        </span>
                      </div>
                      <Progress value={(b.spent / b.amount) * 100} color={b.spent > b.amount ? "var(--expense)" : b.color} />
                    </div>
                  ))}
              </div>
            </div>
          )}

          {upcoming.length > 0 && (
            <div className="card">
              <div className="card-head">
                <div>
                  <h2>Upcoming</h2>
                  <p className="muted small">Next 14 days</p>
                </div>
              </div>
              <ul className="list" style={{ padding: "8px 0" }}>
                {upcoming.map((u, i) => (
                  <li key={`${u.id}-${i}`} style={{ border: 0, padding: "6px 20px" }}>
                    <div className="grow">
                      <div className="small truncate">{u.payee || u.category_name || "Transfer"}</div>
                      <div className="xs muted">{formatDate(u.date, { weekday: "short", day: "numeric", month: "short" })}</div>
                    </div>
                    <Money amount={u.amount} currency={cur} type={u.type} className="small" />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {goals.length > 0 && (
            <div className="card">
              <div className="card-head">
                <h2>Goals</h2>
                <Link to="/goals" className="small">
                  All →
                </Link>
              </div>
              <div className="card-body">
                {goals.map((g) => (
                  <div key={g.id} className="cat-row">
                    <div className="cat-row-top">
                      <span className="truncate">{g.name}</span>
                      <span className="xs muted">{Math.floor(Math.min(100, (g.saved_amount / g.target_amount) * 100))}%</span>
                    </div>
                    <Progress value={(g.saved_amount / g.target_amount) * 100} color={g.color} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {adding && (
        <TransactionModal accounts={accounts} categories={cats.data} today={today} onClose={() => setAdding(false)} onSaved={reload} />
      )}
    </>
  );
}
