import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { TransactionModal, TxList } from "../components/TxList";
import { Empty, Loading, Money, PageHeader } from "../components/ui";
import { downloadCsv } from "../lib/api";
import { useAuth } from "../lib/auth";
import { localToday } from "../lib/format";
import { toast } from "../lib/toast";
import { useApi } from "../lib/useApi";

const FILTER_KEYS = ["q", "type", "account", "category", "from", "to"];
const PAGE_SIZE = 50;

export default function Transactions() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [adding, setAdding] = useState(false);
  const accounts = useApi("/accounts");
  const categories = useApi("/categories");

  const filterQuery = new URLSearchParams(FILTER_KEYS.filter((k) => params.get(k)).map((k) => [k, params.get(k)])).toString();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const tx = useApi(`/transactions?${filterQuery}&page=${page}&pageSize=${PAGE_SIZE}`);

  if (!tx.data || !accounts.data || !categories.data) return <Loading error={tx.error ?? accounts.error ?? categories.error} />;

  const today = localToday();
  const pages = Math.max(1, Math.ceil(tx.data.total / PAGE_SIZE));
  const hasFilters = filterQuery.length > 0;
  const reload = () => {
    tx.reload();
    accounts.reload();
  };

  const applyFilters = (e) => {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.currentTarget));
    setParams(Object.fromEntries(Object.entries(values).filter(([, v]) => v)));
  };
  const goToPage = (p) => {
    const next = new URLSearchParams(params);
    next.set("page", String(p));
    setParams(next);
  };

  return (
    <>
      <PageHeader title="Transactions" subtitle="Everything in and out, across all your accounts.">
        <button
          className="btn btn-secondary"
          onClick={() => downloadCsv(`/transactions/export?${filterQuery}`, "transactions.csv").catch((e) => toast(e.message, "error"))}
        >
          ⬇ Export CSV
        </button>
        <button className="btn" onClick={() => setAdding(true)}>
          ＋ Add transaction
        </button>
      </PageHeader>

      <form className="card card-pad" style={{ marginBottom: 16 }} onSubmit={applyFilters} key={filterQuery}>
        <div className="filters">
          <input className="input" name="q" placeholder="🔍 Search payee or notes" defaultValue={params.get("q") ?? ""} />
          <select className="input" name="type" defaultValue={params.get("type") ?? ""} aria-label="Type">
            <option value="">All types</option>
            <option value="expense">Expenses</option>
            <option value="income">Income</option>
            <option value="transfer">Transfers</option>
          </select>
          <select className="input" name="account" defaultValue={params.get("account") ?? ""} aria-label="Account">
            <option value="">All accounts</option>
            {accounts.data.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <select className="input" name="category" defaultValue={params.get("category") ?? ""} aria-label="Category">
            <option value="">All categories</option>
            <option value="none">Uncategorized</option>
            {categories.data.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="filters-foot">
          <label className="small muted">
            From <input className="input" style={{ width: "auto", display: "inline-block" }} type="date" name="from" defaultValue={params.get("from") ?? ""} />
          </label>
          <label className="small muted">
            To <input className="input" style={{ width: "auto", display: "inline-block" }} type="date" name="to" defaultValue={params.get("to") ?? ""} />
          </label>
          <button className="btn btn-sm" type="submit">
            Apply filters
          </button>
          {hasFilters && (
            <button className="btn btn-secondary btn-sm" type="button" onClick={() => setParams({})}>
              Clear
            </button>
          )}
          <span className="small muted" style={{ marginLeft: "auto", display: "flex", gap: 16, flexWrap: "wrap" }}>
            <span>
              {tx.data.total} transaction{tx.data.total === 1 ? "" : "s"}
            </span>
            <span>
              In <Money amount={tx.data.income} currency={user.currency} className="income" />
            </span>
            <span>
              Out <Money amount={tx.data.expense} currency={user.currency} />
            </span>
          </span>
        </div>
      </form>

      <div className="card" style={{ overflow: "hidden" }}>
        {tx.data.rows.length === 0 ? (
          <Empty
            icon="🧾"
            title={hasFilters ? "No matching transactions" : "No transactions yet"}
            text={
              hasFilters
                ? "Try changing or clearing your filters."
                : accounts.data.length === 0
                  ? "Add an account first, then record your first transaction."
                  : "Record your first income or expense."
            }
          />
        ) : (
          <TxList
            rows={tx.data.rows}
            currency={user.currency}
            accounts={accounts.data}
            categories={categories.data}
            today={today}
            onChange={reload}
            selectable
          />
        )}
      </div>

      {pages > 1 && (
        <div className="pager">
          <span className="small muted">
            Page {page} of {pages}
          </span>
          <span className="actions">
            <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
              ← Previous
            </button>
            <button className="btn btn-secondary btn-sm" disabled={page >= pages} onClick={() => goToPage(page + 1)}>
              Next →
            </button>
          </span>
        </div>
      )}

      {adding && (
        <TransactionModal
          accounts={accounts.data}
          categories={categories.data}
          today={today}
          onClose={() => setAdding(false)}
          onSaved={reload}
        />
      )}
    </>
  );
}
