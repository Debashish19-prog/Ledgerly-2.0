import { useState } from "react";
import { TxFields } from "../components/TxFields";
import { ConfirmButton, Empty, FormModal, Loading, Money, PageHeader, TxIcon } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatDate, FREQUENCY, localToday, money } from "../lib/format";
import { toast } from "../lib/toast";
import { useApi } from "../lib/useApi";

// Approximate monthly amount for any schedule.
const PER_MONTH = { daily: 30.44, weekly: 4.345, monthly: 1, yearly: 1 / 12 };

function RecurringModal({ item, accounts, categories, onClose, onSaved }) {
  return (
    <FormModal
      title={item ? "Edit recurring transaction" : "New recurring transaction"}
      subtitle="It's recorded automatically on every due date."
      success={item ? "Recurring transaction updated" : "Recurring transaction created"}
      onClose={onClose}
      onSubmit={async (v) => {
        await (item ? api.put(`/recurring/${item.id}`, v) : api.post("/recurring", v));
        onSaved();
      }}
    >
      {accounts.length === 0 ? (
        <p className="muted">Create an account first on the Accounts page.</p>
      ) : (
        <>
          <TxFields
            accounts={accounts}
            categories={categories}
            initial={item ?? {}}
            dateName="next_date"
            dateLabel={item ? "Next date" : "Start date"}
            defaultDate={localToday()}
          />
          <div className="row-3">
            <label className="field">
              Every
              <input className="input" name="interval_count" type="number" min={1} max={365} required defaultValue={item?.interval_count ?? 1} />
            </label>
            <label className="field">
              Period
              <select className="input" name="frequency" defaultValue={item?.frequency ?? "monthly"}>
                <option value="daily">Day(s)</option>
                <option value="weekly">Week(s)</option>
                <option value="monthly">Month(s)</option>
                <option value="yearly">Year(s)</option>
              </select>
            </label>
            <label className="field">
              Ends (optional)
              <input className="input" name="end_date" type="date" defaultValue={item?.end_date ?? ""} />
            </label>
          </div>
        </>
      )}
    </FormModal>
  );
}

export default function Recurring() {
  const { user } = useAuth();
  const cur = user.currency;
  const { data, error, reload } = useApi("/recurring");
  const accounts = useApi("/accounts");
  const cats = useApi("/categories");
  const [modal, setModal] = useState(null); // "new" | item
  if (!data || !accounts.data || !cats.data) return <Loading error={error ?? accounts.error ?? cats.error} />;

  const active = data.filter((r) => r.active);
  const monthly = (type) => active.filter((r) => r.type === type).reduce((s, r) => s + (r.amount * PER_MONTH[r.frequency]) / r.interval_count, 0);
  const every = (r) => (r.interval_count > 1 ? `${r.interval_count} ${FREQUENCY[r.frequency]}s` : FREQUENCY[r.frequency]);

  return (
    <>
      <PageHeader title="Recurring" subtitle="Salary, rent, subscriptions, SIPs: anything that repeats.">
        <button className="btn" onClick={() => setModal("new")}>
          ＋ Add recurring
        </button>
      </PageHeader>

      {data.length === 0 ? (
        <div className="card">
          <Empty icon="🔁" title="No recurring transactions" text="Set up rent, salary or subscriptions once and they'll be recorded automatically.">
            <button className="btn" onClick={() => setModal("new")}>
              ＋ Add recurring
            </button>
          </Empty>
        </div>
      ) : (
        <>
          <div className="grid grid-2" style={{ marginBottom: 24 }}>
            <div className="card card-pad">
              <div className="stat-label">Monthly recurring income</div>
              <div className="stat-value income">{money(monthly("income"), cur)}</div>
            </div>
            <div className="card card-pad">
              <div className="stat-label">Monthly recurring expenses</div>
              <div className="stat-value">{money(monthly("expense"), cur)}</div>
            </div>
          </div>
          <div className="card">
            <ul className="list">
              {data.map((r) => (
                <li key={r.id} style={{ opacity: r.active ? 1 : 0.55 }}>
                  <TxIcon icon={r.category_icon ?? "🔁"} color={r.category_color} type={r.type} />
                  <div className="grow">
                    <div className="title truncate">
                      {r.payee || r.category_name || "Recurring"} {!r.active && <span className="badge">{r.end_date && r.next_date > r.end_date ? "Ended" : "Paused"}</span>}
                    </div>
                    <div className="xs muted truncate">
                      Every {every(r)} · {r.type === "transfer" ? `${r.account_name} → ${r.to_account_name}` : r.account_name}
                      {r.active && ` · next ${formatDate(r.next_date)}`}
                    </div>
                  </div>
                  <Money amount={r.amount} currency={cur} type={r.type} className="small" />
                  <span className="row-actions">
                    <button className="icon-btn" title="Edit" aria-label="Edit" onClick={() => setModal(r)}>
                      ✏️
                    </button>
                    <button
                      className="icon-btn"
                      title={r.active ? "Pause" : "Resume"}
                      aria-label={r.active ? "Pause" : "Resume"}
                      onClick={async () => {
                        await api.patch(`/recurring/${r.id}/active`, { active: !r.active });
                        toast(r.active ? "Paused" : "Resumed");
                        reload();
                      }}
                    >
                      {r.active ? "⏸" : "▶️"}
                    </button>
                    <ConfirmButton
                      message="Stop this recurring transaction? Transactions already recorded are kept."
                      success="Recurring transaction deleted"
                      onConfirm={async () => {
                        await api.del(`/recurring/${r.id}`);
                        reload();
                      }}
                    >
                      🗑
                    </ConfirmButton>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {modal && (
        <RecurringModal
          item={modal === "new" ? null : modal}
          accounts={accounts.data}
          categories={cats.data}
          onClose={() => setModal(null)}
          onSaved={reload}
        />
      )}
    </>
  );
}
