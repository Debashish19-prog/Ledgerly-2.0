import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ConfirmButton, Empty, FormModal, Loading, Money, PageHeader, Progress } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { addMonths, formatDate, localToday, money, monthEnd } from "../lib/format";
import { useApi } from "../lib/useApi";

export default function Budgets() {
  const { user } = useAuth();
  const cur = user.currency;
  const [params, setParams] = useSearchParams();
  const thisMonth = localToday().slice(0, 7);
  const month = params.get("month") ?? thisMonth;
  const { data, error, reload } = useApi(`/budgets?month=${month}`);
  const cats = useApi("/categories");
  const [modal, setModal] = useState(null); // "new" | budget
  if (!data || !cats.data) return <Loading error={error ?? cats.error} />;

  const { budgets } = data;
  const unbudgeted = cats.data.filter((c) => c.kind === "expense" && !budgets.some((b) => b.category_id === c.id));
  const totalBudget = budgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);
  // How far through the month we are, to warn when spending is ahead of pace.
  const isCurrent = month === thisMonth;
  const elapsed = isCurrent ? Number(localToday().slice(8)) / Number(monthEnd(`${month}-01`).slice(8)) : 1;
  const shift = (n) => setParams({ month: addMonths(`${month}-01`, n).slice(0, 7) });

  return (
    <>
      <PageHeader title="Budgets" subtitle="Monthly spending limits per category.">
        <span className="actions">
          <button className="btn btn-secondary btn-sm" onClick={() => shift(-1)} aria-label="Previous month">
            ←
          </button>
          <strong className="small" style={{ minWidth: 120, textAlign: "center" }}>
            {formatDate(`${month}-01`, { month: "long", year: "numeric" })}
          </strong>
          <button className="btn btn-secondary btn-sm" onClick={() => shift(1)} disabled={month >= thisMonth} aria-label="Next month">
            →
          </button>
        </span>
        {unbudgeted.length > 0 && (
          <button className="btn" onClick={() => setModal("new")}>
            ＋ Add budget
          </button>
        )}
      </PageHeader>

      {budgets.length === 0 ? (
        <div className="card">
          <Empty icon="🐷" title="No budgets yet" text="Pick a category and set a monthly limit to keep spending in check.">
            <button className="btn" onClick={() => setModal("new")}>
              ＋ Add budget
            </button>
          </Empty>
        </div>
      ) : (
        <>
          <div className="card card-pad" style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
              <div>
                <div className="stat-label">Spent of total budget</div>
                <div className="stat-value">
                  <Money amount={totalSpent} currency={cur} /> <span className="muted small">/ {money(totalBudget, cur)}</span>
                </div>
              </div>
              <strong className={`small ${totalSpent > totalBudget ? "expense" : "income"}`}>
                {totalSpent > totalBudget ? `${money(totalSpent - totalBudget, cur)} over budget` : `${money(totalBudget - totalSpent, cur)} left`}
              </strong>
            </div>
            <div style={{ marginTop: 14 }}>
              <Progress value={(totalSpent / totalBudget) * 100} color={totalSpent > totalBudget ? "var(--expense)" : undefined} />
            </div>
          </div>

          <div className="grid grid-2">
            {budgets.map((b) => {
              const over = b.spent > b.amount;
              const ahead = !over && isCurrent && b.spent / b.amount > elapsed + 0.1;
              return (
                <div key={b.id} className="card card-pad">
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 20 }}>{b.icon}</span>
                    <Link className="title grow truncate" style={{ color: "var(--text)" }} to={`/transactions?category=${b.category_id}&from=${month}-01&to=${monthEnd(`${month}-01`)}`}>
                      {b.name}
                    </Link>
                    <button className="icon-btn" title="Edit" aria-label="Edit" onClick={() => setModal(b)}>
                      ✏️
                    </button>
                    <ConfirmButton
                      message={`Remove the ${b.name} budget?`}
                      success="Budget removed"
                      onConfirm={async () => {
                        await api.del(`/budgets/${b.id}`);
                        reload();
                      }}
                    >
                      🗑
                    </ConfirmButton>
                  </div>
                  <div className="cat-row-top" style={{ marginTop: 14 }}>
                    <span>
                      <Money amount={b.spent} currency={cur} className="title" />
                      <span className="muted small"> of {money(b.amount, cur)}</span>
                    </span>
                    <strong className="small" style={{ color: over ? "var(--expense)" : ahead ? "var(--warning)" : "var(--muted)" }}>
                      {over ? `${money(b.spent - b.amount, cur)} over` : `${money(b.amount - b.spent, cur)} left`}
                    </strong>
                  </div>
                  <Progress value={(b.spent / b.amount) * 100} color={over ? "var(--expense)" : ahead ? "var(--warning)" : b.color} />
                  <p className="xs muted" style={{ marginTop: 8 }}>
                    {ahead ? "⚠️ Spending faster than the month is passing · " : ""}
                    3-month average: {money(b.avg3, cur)}
                  </p>
                </div>
              );
            })}
          </div>
        </>
      )}

      {modal && (
        <FormModal
          title={modal === "new" ? "New budget" : `Edit ${modal.name} budget`}
          success="Budget saved"
          onClose={() => setModal(null)}
          onSubmit={async (v) => {
            await api.put("/budgets", v);
            reload();
          }}
        >
          {modal === "new" ? (
            <label className="field">
              Category
              <select className="input" name="category_id" required>
                {unbudgeted.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <input type="hidden" name="category_id" value={modal.category_id} />
          )}
          <label className="field">
            Monthly limit ({cur})
            <input className="input" name="amount" type="number" step="0.01" min="0.01" required defaultValue={modal.amount} autoFocus />
          </label>
        </FormModal>
      )}
    </>
  );
}
