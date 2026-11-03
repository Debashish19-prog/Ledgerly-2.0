import { useEffect, useState } from "react";
import { money, PALETTE } from "../lib/format";
import { toast } from "../lib/toast";

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children && <div className="actions">{children}</div>}
    </div>
  );
}

export function Modal({ title, subtitle, onClose, wide, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p className="muted small">{subtitle}</p>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * A modal containing a form. `onSubmit` receives the form values as an object;
 * when it resolves the modal closes and `success` is shown as a toast.
 */
export function FormModal({ title, subtitle, onClose, onSubmit, submitLabel = "Save", success = "Saved", wide, danger, children }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSubmit(Object.fromEntries(new FormData(e.currentTarget)));
      toast(success);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={title} subtitle={subtitle} onClose={onClose} wide={wide}>
      <form className="form" onSubmit={submit}>
        {children}
        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}
        <div className="modal-foot">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={`btn ${danger ? "btn-danger" : ""}`} disabled={busy}>
            {busy ? "Saving…" : submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** A button that asks for confirmation in a modal before running `onConfirm`. */
export function ConfirmButton({ message, onConfirm, label = "Delete", success, children, className = "icon-btn", title }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      await onConfirm();
      if (success) toast(success);
      setOpen(false);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <button type="button" className={className} title={title ?? label} aria-label={title ?? label} onClick={() => setOpen(true)}>
        {children}
      </button>
      {open && (
        <Modal title="Are you sure?" onClose={() => setOpen(false)}>
          <p className="muted">{message}</p>
          <div className="modal-foot mt">
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn-danger" onClick={run} disabled={busy}>
              {busy ? "Working…" : label}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

export function Money({ amount, currency, type, className = "" }) {
  const sign = type === "expense" ? "−" : type === "income" ? "+" : "";
  const color = type === "income" ? "income" : type === "transfer" ? "transfer" : "";
  return (
    <span className={`num ${color} ${className}`}>
      {sign}
      {money(type ? Math.abs(amount) : amount, currency)}
    </span>
  );
}

export function Empty({ icon, title, text, children }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <strong>{title}</strong>
      {text && <p>{text}</p>}
      {children && <div style={{ marginTop: 8 }}>{children}</div>}
    </div>
  );
}

export function Progress({ value, color }) {
  return (
    <div className="progress">
      <div style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color ?? "var(--primary)" }} />
    </div>
  );
}

export function ColorPicker({ name = "color", defaultValue }) {
  const [value, setValue] = useState(PALETTE.includes(defaultValue) ? defaultValue : PALETTE[0]);
  return (
    <div className="field">
      <span>Color</span>
      <input type="hidden" name={name} value={value} />
      <div className="swatches">
        {PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            className={`swatch ${c === value ? "selected" : ""}`}
            style={{ background: c }}
            onClick={() => setValue(c)}
            aria-label={`Color ${c}`}
          />
        ))}
      </div>
    </div>
  );
}

const EMOJIS = ["🏷️", "🛒", "🍽️", "☕", "🏠", "💡", "📱", "🚗", "⛽", "🛍️", "💊", "🏋️", "🎬", "🔁", "✈️", "🎓", "🛡️", "🎁", "🐾", "👶", "💼", "💻", "📈", "➕", "💰", "🧾"];

export function EmojiPicker({ defaultValue = "🏷️" }) {
  const [value, setValue] = useState(defaultValue);
  return (
    <div className="field">
      <span>Icon</span>
      <input type="hidden" name="icon" value={value} />
      <div className="emoji-pick">
        {EMOJIS.map((e) => (
          <button key={e} type="button" className={e === value ? "selected" : ""} onClick={() => setValue(e)}>
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}

export function TxIcon({ icon, color, type }) {
  const c = type === "transfer" ? "var(--transfer)" : (color ?? "#94a3b8");
  return (
    <span className="tx-icon" style={{ background: `color-mix(in srgb, ${c} 16%, transparent)` }}>
      {type === "transfer" ? "🔄" : (icon ?? "🏷️")}
    </span>
  );
}

export function Loading({ error }) {
  return <div className="spinner">{error ? `⚠️ ${error}` : "Loading…"}</div>;
}
