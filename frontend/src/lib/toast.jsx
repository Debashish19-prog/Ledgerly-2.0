import { useEffect, useState } from "react";

export function toast(message, kind = "success") {
  window.dispatchEvent(new CustomEvent("app:toast", { detail: { message, kind } }));
}

export function Toaster() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    let id = 0;
    const onToast = (e) => {
      const item = { ...e.detail, id: ++id };
      setItems((t) => [...t, item]);
      setTimeout(() => setItems((t) => t.filter((x) => x.id !== item.id)), 3500);
    };
    window.addEventListener("app:toast", onToast);
    return () => window.removeEventListener("app:toast", onToast);
  }, []);
  return (
    <div className="toasts" role="status">
      {items.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          {t.kind === "error" ? "⚠️ " : "✅ "}
          {t.message}
        </div>
      ))}
    </div>
  );
}
