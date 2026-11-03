import { useState } from "react";
import { ColorPicker, ConfirmButton, Empty, FormModal, Loading, PageHeader, Progress } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatDate, localToday, money } from "../lib/format";
import { useApi } from "../lib/useApi";

const monthsBetween = (from, to) => {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
};

export default function Goals() {
  const { user } = useAuth();
  const cur = user.currency;
  const { data, error, reload } = useApi("/goals");
  const [modal, setModal] = useState(null); // { goal?, contribute? }
  if (!data) return <Loading error={error} />;
  const today = localToday();

  return (
    <>
      <PageHeader title="Goals" subtitle="Save towards the things that matter.">
        <button className="btn" onClick={() => setModal({})}>
          ＋ Add goal
        </button>
      </PageHeader>

      {data.length === 0 ? (
        <div className="card">
          <Empty icon="🎯" title="No goals yet" text="An emergency fund, a trip, a new laptop: set a target and track your progress.">
            <button className="btn" onClick={() => setModal({})}>
              ＋ Add goal
            </button>
          </Empty>
        </div>
      ) : (
        <div className="grid grid-3">
          {data.map((g) => {
            const pct = (g.saved_amount / g.target_amount) * 100;
            const remaining = Math.max(0, g.target_amount - g.saved_amount);
            const months = g.target_date ? monthsBetween(today, g.target_date) : null;
            return (
              <div key={g.id} className="card card-pad" style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="dot" style={{ background: g.color }} />
                  <span className="title grow truncate">{g.name}</span>
                  <button className="icon-btn" title="Add money" aria-label="Add money" onClick={() => setModal({ goal: g, contribute: true })}>
                    💵
                  </button>
                  <button className="icon-btn" title="Edit" aria-label="Edit" onClick={() => setModal({ goal: g })}>
                    ✏️
                  </button>
                  <ConfirmButton
                    message={`Delete the goal "${g.name}"?`}
                    success="Goal deleted"
                    onConfirm={async () => {
                      await api.del(`/goals/${g.id}`);
                      reload();
                    }}
                  >
                    🗑
                  </ConfirmButton>
                </div>
                <div className="stat-value" style={{ marginTop: 14 }}>
                  {money(g.saved_amount, cur)} <span className="muted small">/ {money(g.target_amount, cur)}</span>
                </div>
                <div style={{ marginTop: 10 }}>
                  <Progress value={pct} color={g.color} />
                </div>
                <div className="xs muted" style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                  <span>{Math.floor(Math.min(pct, 100))}% saved</span>
                  {g.target_date && <span>by {formatDate(g.target_date)}</span>}
                </div>
                <p className="small" style={{ marginTop: "auto", paddingTop: 14 }}>
                  {remaining === 0 ? (
                    <strong className="income">🏆 Goal reached!</strong>
                  ) : months > 0 ? (
                    <span className="muted">
                      Save <strong style={{ color: "var(--text)" }}>{money(remaining / months, cur)}</strong>/month to reach it on time
                    </span>
                  ) : months !== null ? (
                    <span className="expense">Target date passed · {money(remaining, cur)} to go</span>
                  ) : (
                    <span className="muted">{money(remaining, cur)} to go</span>
                  )}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {modal?.contribute && (
        <FormModal
          title={`Add money to ${modal.goal.name}`}
          subtitle="Use a negative amount to record a withdrawal."
          success="Goal updated"
          onClose={() => setModal(null)}
          onSubmit={async (v) => {
            await api.post(`/goals/${modal.goal.id}/contribute`, v);
            reload();
          }}
        >
          <label className="field">
            Amount ({cur})
            <input className="input" name="amount" type="number" step="0.01" required autoFocus />
          </label>
        </FormModal>
      )}
      {modal && !modal.contribute && (
        <FormModal
          title={modal.goal ? "Edit goal" : "New savings goal"}
          success={modal.goal ? "Goal updated" : "Goal created"}
          onClose={() => setModal(null)}
          onSubmit={async (v) => {
            await (modal.goal ? api.put(`/goals/${modal.goal.id}`, v) : api.post("/goals", v));
            reload();
          }}
        >
          <label className="field">
            Goal name
            <input className="input" name="name" required maxLength={100} defaultValue={modal.goal?.name} placeholder="e.g. Emergency fund" autoFocus />
          </label>
          <div className="row">
            <label className="field">
              Target ({cur})
              <input className="input" name="target_amount" type="number" step="0.01" min="0.01" required defaultValue={modal.goal?.target_amount} />
            </label>
            <label className="field">
              Saved so far ({cur})
              <input className="input" name="saved_amount" type="number" step="0.01" min="0" defaultValue={modal.goal?.saved_amount ?? 0} />
            </label>
          </div>
          <label className="field">
            Target date (optional)
            <input className="input" name="target_date" type="date" defaultValue={modal.goal?.target_date ?? ""} />
          </label>
          <ColorPicker defaultValue={modal.goal?.color ?? "#10b981"} />
        </FormModal>
      )}
    </>
  );
}
