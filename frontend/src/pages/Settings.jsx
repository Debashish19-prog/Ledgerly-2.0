import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { CURRENCIES } from "../lib/format";
import { toast } from "../lib/toast";

/** A card holding a form that submits on its own and shows inline errors. */
function SettingsForm({ title, subtitle, submitLabel, danger, onSubmit, children }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setError("");
    try {
      await onSubmit(Object.fromEntries(new FormData(form)), form);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="card" style={danger ? { borderColor: "color-mix(in srgb, var(--expense) 40%, transparent)" } : undefined}>
      <div className="card-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p className="muted small">{subtitle}</p>}
        </div>
      </div>
      <form className="form card-body" onSubmit={submit}>
        {children}
        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}
        <div>
          <button className={`btn ${danger ? "btn-danger" : ""}`} type="submit" disabled={busy}>
            {busy ? "Saving…" : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function Settings() {
  const { user, setUser, signOut } = useAuth();
  const navigate = useNavigate();
  const timezones = Intl.supportedValuesOf?.("timeZone") ?? [user.timezone];
  const currencies = CURRENCIES.includes(user.currency) ? CURRENCIES : [user.currency, ...CURRENCIES];

  return (
    <>
      <PageHeader title="Settings" subtitle="Your profile and preferences." />
      <div className="stack" style={{ maxWidth: 640 }}>
        <SettingsForm
          title="Profile"
          subtitle={user.email}
          submitLabel="Save profile"
          onSubmit={async (v) => {
            const { user: updated } = await api.put("/auth/profile", v);
            setUser(updated);
            toast("Profile updated");
          }}
        >
          <label className="field">
            Name
            <input className="input" name="name" required maxLength={100} defaultValue={user.name} />
          </label>
          <div className="row">
            <label className="field">
              Currency
              <select className="input" name="currency" defaultValue={user.currency}>
                {currencies.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="field">
              Timezone
              <select className="input" name="timezone" defaultValue={user.timezone}>
                {timezones.map((tz) => (
                  <option key={tz}>{tz}</option>
                ))}
              </select>
            </label>
          </div>
        </SettingsForm>

        <SettingsForm
          title="Change password"
          submitLabel="Change password"
          onSubmit={async (v, form) => {
            if (v.next !== v.confirm) throw new Error("New passwords don't match");
            await api.put("/auth/password", { current: v.current, next: v.next });
            form.reset();
            toast("Password changed");
          }}
        >
          <label className="field">
            Current password
            <input className="input" name="current" type="password" required autoComplete="current-password" />
          </label>
          <div className="row">
            <label className="field">
              New password
              <input className="input" name="next" type="password" required minLength={8} autoComplete="new-password" />
            </label>
            <label className="field">
              Confirm new password
              <input className="input" name="confirm" type="password" required minLength={8} autoComplete="new-password" />
            </label>
          </div>
        </SettingsForm>

        <SettingsForm
          title="Delete account"
          subtitle="Permanently deletes your account and all of your data. This can't be undone."
          submitLabel="Delete my account"
          danger
          onSubmit={async (v) => {
            await api.del("/auth/account", { confirmEmail: v.confirmEmail });
            signOut();
            navigate("/login");
          }}
        >
          <label className="field">
            Type {user.email} to confirm
            <input className="input" name="confirmEmail" required autoComplete="off" />
          </label>
        </SettingsForm>
      </div>
    </>
  );
}
