import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Toaster } from "../lib/toast";

const NAV = [
  ["/", "📊", "Dashboard"],
  ["/transactions", "🔄", "Transactions"],
  ["/accounts", "🏦", "Accounts"],
  ["/budgets", "🐷", "Budgets"],
  ["/recurring", "🔁", "Recurring"],
  ["/goals", "🎯", "Goals"],
  ["/reports", "📈", "Reports"],
  ["/categories", "🏷️", "Categories"],
  ["/settings", "⚙️", "Settings"],
];

function toggleTheme() {
  const dark = document.documentElement.classList.toggle("dark");
  try {
    localStorage.setItem("theme", dark ? "dark" : "light");
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new Event("app:theme"));
}

export default function Layout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const logout = () => {
    signOut();
    navigate("/login");
  };

  return (
    <div className="shell">
      <header className="topbar">
        <span className="brand">
          <span className="brand-logo">💰</span> Expense Tracker
        </span>
        <span>
          <button className="icon-btn" onClick={toggleTheme} aria-label="Toggle theme">
            🌓
          </button>
          <button className="icon-btn" onClick={() => setOpen((o) => !o)} aria-label="Menu">
            {open ? "✕" : "☰"}
          </button>
        </span>
      </header>
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <NavLink to="/" className="brand">
          <span className="brand-logo">💰</span> Expense Tracker
        </NavLink>
        <nav className="nav">
          {NAV.map(([to, icon, label]) => (
            <NavLink key={to} to={to} end={to === "/"} onClick={() => setOpen(false)}>
              <span className="nav-icon">{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>
        <button className="btn btn-secondary btn-sm" onClick={toggleTheme}>
          🌓 Toggle theme
        </button>
        <div className="user-box">
          <span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span>
          <div className="grow">
            <div className="truncate small" style={{ fontWeight: 600 }}>
              {user.name}
            </div>
            <div className="truncate xs muted">{user.email}</div>
          </div>
          <button className="icon-btn" onClick={logout} title="Sign out" aria-label="Sign out">
            ⎋
          </button>
        </div>
      </aside>
      <main className="main">
        <div className="content">
          <Outlet />
        </div>
      </main>
      <Toaster />
    </div>
  );
}
