import { useState } from "react";

const TYPES = [
  ["expense", "Expense"],
  ["income", "Income"],
  ["transfer", "Transfer"],
];

/** Fields shared by the transaction and recurring-transaction forms. */
export function TxFields({ accounts, categories, initial = {}, dateName = "date", dateLabel = "Date", defaultDate }) {
  const [type, setType] = useState(initial.type ?? "expense");
  const active = accounts.filter((a) => !a.archived || a.id === initial.account_id || a.id === initial.to_account_id);
  const cats = categories.filter((c) => c.kind === type);
  const fromId = initial.account_id ?? active[0]?.id;

  return (
    <>
      <input type="hidden" name="type" value={type} />
      <div className="segmented">
        {TYPES.map(([value, label]) => (
          <button key={value} type="button" className={type === value ? `on-${value}` : ""} onClick={() => setType(value)}>
            {label}
          </button>
        ))}
      </div>
      <div className="row">
        <label className="field">
          Amount
          <input className="input" name="amount" type="number" step="0.01" min="0.01" required autoFocus defaultValue={initial.amount} placeholder="0.00" />
        </label>
        <label className="field">
          {dateLabel}
          <input className="input" name={dateName} type="date" required defaultValue={initial[dateName] ?? initial.date ?? defaultDate} />
        </label>
      </div>
      <div className={type === "transfer" ? "row" : ""}>
        <label className="field">
          {type === "transfer" ? "From account" : "Account"}
          <select className="input" name="account_id" required defaultValue={fromId}>
            {active.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        {type === "transfer" && (
          <label className="field">
            To account
            <select className="input" name="to_account_id" required defaultValue={initial.to_account_id ?? active.find((a) => a.id !== fromId)?.id}>
              {active.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {type !== "transfer" && (
        <label className="field">
          Category
          <select key={type} className="input" name="category_id" defaultValue={cats.some((c) => c.id === initial.category_id) ? initial.category_id : ""}>
            <option value="">— Uncategorized —</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="field">
        {type === "income" ? "Payer" : type === "transfer" ? "Description" : "Payee"}
        <input className="input" name="payee" maxLength={200} defaultValue={initial.payee} placeholder={type === "expense" ? "e.g. Swiggy" : ""} />
      </label>
      <label className="field">
        Notes
        <textarea className="input" name="notes" maxLength={1000} rows={2} defaultValue={initial.notes} />
      </label>
    </>
  );
}
