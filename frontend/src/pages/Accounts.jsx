import { useState } from "react";
import { Link } from "react-router-dom";
import { ColorPicker, ConfirmButton, Empty, FormModal, Loading, Money, PageHeader } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { ACCOUNT_TYPES, money } from "../lib/format";
import { toast } from "../lib/toast";
import { useApi } from "../lib/useApi";

function AccountModal({ account, currency, onClose, onSaved }) {
  return (
    <FormModal
      title={account ? "Edit account" : "New account"}
      submitLabel={account ? "Save changes" : "Create account"}
      success={account ? "Account updated" : "Account created"}
      onClose={onClose}
      onSubmit={async (v) => {
        await (account ? api.put(`/accounts/${account.id}`, v) : api.post("/accounts", v));
        onSaved();
      }}
    >
      <label className="field">
        Name
        <input className="input" name="name" required maxLength={100} defaultValue={account?.name} placeholder="e.g. HDFC Savings" autoFocus />
      </label>
      <div className="row">
        <label className="field">
          Type
          <select className="input" name="type" defaultValue={account?.type ?? "bank"}>
            {Object.entries(ACCOUNT_TYPES).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Opening balance ({currency})
          <input className="input" name="opening_balance" type="number" step="0.01" defaultValue={account?.opening_balance ?? 0} />
        </label>
      </div>
      <p className="xs muted" style={{ marginTop: -6 }}>
        For credit cards and loans, enter what you owe as a negative number.
      </p>
      <ColorPicker defaultValue={account?.color} />
    </FormModal>
  );
}

export default function Accounts() {
  const { user } = useAuth();
  const { data, error, reload } = useApi("/accounts");
  const [modal, setModal] = useState(null); // null | "new" | account
  if (!data) return <Loading error={error} />;

  const cur = user.currency;
  const assets = data.filter((a) => a.balance > 0).reduce((s, a) => s + a.balance, 0);
  const liabilities = data.filter((a) => a.balance < 0).reduce((s, a) => s + a.balance, 0);
  const active = data.filter((a) => !a.archived);
  const archived = data.filter((a) => a.archived);

  const card = (a) => (
    <div key={a.id} className="card card-pad" style={{ opacity: a.archived ? 0.6 : 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <div className="grow">
          <div className="title truncate">
            <span className="dot" style={{ background: a.color, marginRight: 8 }} />
            {a.name}
          </div>
          <span className="badge" style={{ marginTop: 6 }}>
            {ACCOUNT_TYPES[a.type]}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "flex-start" }}>
          <button className="icon-btn" title="Edit" aria-label="Edit" onClick={() => setModal(a)}>
            ✏️
          </button>
          <button
            className="icon-btn"
            title={a.archived ? "Restore" : "Archive"}
            aria-label={a.archived ? "Restore" : "Archive"}
            onClick={async () => {
              await api.patch(`/accounts/${a.id}/archive`, { archived: !a.archived });
              toast(a.archived ? "Account restored" : "Account archived");
              reload();
            }}
          >
            {a.archived ? "♻️" : "📦"}
          </button>
          <ConfirmButton
            message={`"${a.name}" and its ${a.tx_count} transaction(s) will be permanently deleted. Archive it instead to keep the history.`}
            success="Account deleted"
            onConfirm={async () => {
              await api.del(`/accounts/${a.id}`);
              reload();
            }}
          >
            🗑
          </ConfirmButton>
        </div>
      </div>
      <div className="stat-value" style={{ marginTop: 14 }}>
        <Money amount={a.balance} currency={cur} className={a.balance < 0 ? "expense" : ""} />
      </div>
      <Link to={`/transactions?account=${a.id}`} className="xs muted">
        {a.tx_count} transaction{a.tx_count === 1 ? "" : "s"} →
      </Link>
    </div>
  );

  return (
    <>
      <PageHeader title="Accounts" subtitle="Bank accounts, cards, wallets and cash.">
        <button className="btn" onClick={() => setModal("new")}>
          ＋ Add account
        </button>
      </PageHeader>

      {data.length === 0 ? (
        <div className="card">
          <Empty icon="🏦" title="No accounts yet" text="Add your first account — a bank account, credit card, UPI wallet or cash.">
            <button className="btn" onClick={() => setModal("new")}>
              ＋ Add account
            </button>
          </Empty>
        </div>
      ) : (
        <>
          <div className="grid grid-3" style={{ marginBottom: 24 }}>
            <div className="card card-pad">
              <div className="stat-label">Net worth</div>
              <div className="stat-value">
                <span className="num">{money(assets + liabilities, cur)}</span>
              </div>
            </div>
            <div className="card card-pad">
              <div className="stat-label">Assets</div>
              <div className="stat-value income">
                <span className="num">{money(assets, cur)}</span>
              </div>
            </div>
            <div className="card card-pad">
              <div className="stat-label">Liabilities</div>
              <div className="stat-value expense">
                <span className="num">{money(liabilities, cur)}</span>
              </div>
            </div>
          </div>
          <div className="grid grid-3">{active.map(card)}</div>
          {archived.length > 0 && (
            <>
              <h2 className="small muted mt" style={{ marginBottom: 12 }}>
                Archived
              </h2>
              <div className="grid grid-3">{archived.map(card)}</div>
            </>
          )}
        </>
      )}

      {modal && (
        <AccountModal account={modal === "new" ? null : modal} currency={cur} onClose={() => setModal(null)} onSaved={reload} />
      )}
    </>
  );
}
