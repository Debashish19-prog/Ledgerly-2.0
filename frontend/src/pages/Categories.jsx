import { useState } from "react";
import { Link } from "react-router-dom";
import { ColorPicker, ConfirmButton, EmojiPicker, FormModal, Loading, PageHeader, TxIcon } from "../components/ui";
import { api } from "../lib/api";
import { useApi } from "../lib/useApi";

function CategoryModal({ category, kind, onClose, onSaved }) {
  return (
    <FormModal
      title={category ? "Edit category" : "New category"}
      success={category ? "Category updated" : "Category created"}
      onClose={onClose}
      onSubmit={async (v) => {
        await (category ? api.put(`/categories/${category.id}`, v) : api.post("/categories", v));
        onSaved();
      }}
    >
      <div className="row">
        <label className="field">
          Name
          <input className="input" name="name" required maxLength={100} defaultValue={category?.name} autoFocus />
        </label>
        <label className="field">
          Kind
          <select className="input" name="kind" defaultValue={category?.kind ?? kind}>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        </label>
      </div>
      <EmojiPicker defaultValue={category?.icon} />
      <ColorPicker defaultValue={category?.color} />
    </FormModal>
  );
}

export default function Categories() {
  const { data, error, reload } = useApi("/categories");
  const [modal, setModal] = useState(null); // { category?, kind }
  if (!data) return <Loading error={error} />;

  const section = (kind) => {
    const list = data.filter((c) => c.kind === kind);
    return (
      <div className="card">
        <div className="card-head">
          <div>
            <h2>{kind === "expense" ? "Expense categories" : "Income categories"}</h2>
            <p className="muted small">{list.length} categories</p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => setModal({ kind })}>
            ＋ Add
          </button>
        </div>
        <ul className="list" style={{ marginTop: 12 }}>
          {list.map((c) => (
            <li key={c.id}>
              <TxIcon icon={c.icon} color={c.color} />
              <div className="grow">
                <div className="title truncate">{c.name}</div>
                <Link to={`/transactions?category=${c.id}`} className="xs muted">
                  {c.tx_count} transaction{c.tx_count === 1 ? "" : "s"}
                </Link>
              </div>
              <span className="row-actions">
                <button className="icon-btn" title="Edit" aria-label="Edit" onClick={() => setModal({ category: c, kind })}>
                  ✏️
                </button>
                <ConfirmButton
                  message={`Delete "${c.name}"? Its ${c.tx_count} transaction(s) become uncategorized and its budget is removed.`}
                  success="Category deleted"
                  onConfirm={async () => {
                    await api.del(`/categories/${c.id}`);
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
    );
  };

  return (
    <>
      <PageHeader title="Categories" subtitle="Organize where your money comes from and where it goes." />
      <div className="grid grid-2">
        {section("expense")}
        {section("income")}
      </div>
      {modal && <CategoryModal category={modal.category} kind={modal.kind} onClose={() => setModal(null)} onSaved={reload} />}
    </>
  );
}
