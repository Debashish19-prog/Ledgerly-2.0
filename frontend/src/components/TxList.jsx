import { useState } from "react";
import { api } from "../lib/api";
import { formatDate } from "../lib/format";
import { TxFields } from "./TxFields";
import { ConfirmButton, FormModal, Money, TxIcon } from "./ui";

/** Add/edit transaction modal. `tx` set = edit mode. */
export function TransactionModal({ tx, accounts, categories, today, onClose, onSaved }) {
  return (
    <FormModal
      title={tx ? "Edit transaction" : "New transaction"}
      submitLabel={tx ? "Save changes" : "Add transaction"}
      success={tx ? "Transaction updated" : "Transaction added"}
      onClose={onClose}
      onSubmit={async (values) => {
        await (tx ? api.put(`/transactions/${tx.id}`, values) : api.post("/transactions", values));
        onSaved();
      }}
    >
      {accounts.length === 0 ? (
        <p className="muted">Create an account first on the Accounts page.</p>
      ) : (
        <TxFields accounts={accounts} categories={categories} initial={tx ?? {}} defaultDate={today} />
      )}
    </FormModal>
  );
}

/** Transactions grouped by day, with edit/delete and optional multi-select. */
export function TxList({ rows, currency, accounts, categories, today, onChange, selectable }) {
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(new Set());

  const groups = [];
  for (const r of rows) {
    if (groups.at(-1)?.date !== r.date) groups.push({ date: r.date, rows: [] });
    groups.at(-1).rows.push(r);
  }
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggle = (id) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div>
      {selectable && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 20px", borderBottom: "1px solid var(--border)", minHeight: 52 }}>
          <input
            type="checkbox"
            aria-label="Select all"
            checked={allSelected}
            onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))}
          />
          {selected.size > 0 ? (
            <>
              <strong className="small">{selected.size} selected</strong>
              <ConfirmButton
                className="btn btn-danger btn-sm"
                label="Delete"
                title="Delete selected"
                message={`Delete ${selected.size} transaction(s)? This can't be undone.`}
                success="Transactions deleted"
                onConfirm={async () => {
                  await api.post("/transactions/bulk-delete", { ids: [...selected] });
                  setSelected(new Set());
                  onChange();
                }}
              >
                🗑 Delete
              </ConfirmButton>
            </>
          ) : (
            <span className="muted small">Select transactions for bulk actions</span>
          )}
        </div>
      )}
      {groups.map((g) => (
        <div key={g.date}>
          <div className="day-head">
            {g.date === today ? "Today" : formatDate(g.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
          </div>
          <ul className="list">
            {g.rows.map((t) => (
              <li key={t.id}>
                {selectable && <input type="checkbox" aria-label="Select" checked={selected.has(t.id)} onChange={() => toggle(t.id)} />}
                <TxIcon icon={t.category_icon} color={t.category_color} type={t.type} />
                <div className="grow">
                  <div className="title truncate">
                    {t.payee || (t.type === "transfer" ? "Transfer" : t.category_name) || "Untitled"}
                    {t.recurring_id && <span className="muted xs" title="Recurring"> 🔁</span>}
                  </div>
                  <div className="xs muted truncate">
                    {t.type === "transfer"
                      ? `${t.account_name} → ${t.to_account_name}`
                      : `${t.category_name ?? "Uncategorized"} · ${t.account_name}`}
                    {t.notes && ` · ${t.notes}`}
                  </div>
                </div>
                <Money amount={t.amount} currency={currency} type={t.type} className="small" />
                <span className="row-actions">
                  <button className="icon-btn" title="Edit" aria-label="Edit" onClick={() => setEditing(t)}>
                    ✏️
                  </button>
                  <ConfirmButton
                    message="This transaction will be permanently deleted."
                    success="Transaction deleted"
                    onConfirm={async () => {
                      await api.del(`/transactions/${t.id}`);
                      onChange();
                    }}
                  >
                    🗑
                  </ConfirmButton>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {editing && (
        <TransactionModal
          tx={editing}
          accounts={accounts}
          categories={categories}
          today={today}
          onClose={() => setEditing(null)}
          onSaved={onChange}
        />
      )}
    </div>
  );
}

