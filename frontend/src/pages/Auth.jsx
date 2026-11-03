import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { CURRENCIES } from "../lib/format";

function AuthForm({ mode }) {
  const { signIn } = useAuth();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isLogin = mode === "login";

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const body = Object.fromEntries(new FormData(e.currentTarget));
    if (!isLogin) body.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    try {
      await signIn(isLogin ? "/auth/login" : "/auth/register", body);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-logo" style={{ width: 44, height: 44, fontSize: 22 }}>
            💰
          </span>
          Expense Tracker
        </div>
        <div className="card card-pad">
          <h2 style={{ fontSize: 18 }}>{isLogin ? "Welcome back" : "Create your account"}</h2>
          <p className="muted small" style={{ margin: "4px 0 20px" }}>
            {isLogin ? "Sign in to continue tracking your money." : "Start tracking your expenses in minutes."}
          </p>
          <form className="form" onSubmit={submit}>
            {!isLogin && (
              <label className="field">
                Name
                <input className="input" name="name" required autoComplete="name" />
              </label>
            )}
            <label className="field">
              Email
              <input className="input" name="email" type="email" required autoComplete="email" />
            </label>
            <label className="field">
              Password
              <input
                className="input"
                name="password"
                type="password"
                required
                minLength={isLogin ? undefined : 8}
                autoComplete={isLogin ? "current-password" : "new-password"}
              />
              {!isLogin && <span className="hint">At least 8 characters</span>}
            </label>
            {!isLogin && (
              <label className="field">
                Currency
                <select className="input" name="currency" defaultValue="INR">
                  {CURRENCIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
            )}
            {error && (
              <p className="alert" role="alert">
                {error}
              </p>
            )}
            <button className="btn" type="submit" disabled={busy}>
              {busy ? "Please wait…" : isLogin ? "Sign in" : "Create account"}
            </button>
          </form>
        </div>
        <p className="muted small" style={{ textAlign: "center", marginTop: 20 }}>
          {isLogin ? (
            <>
              No account? <Link to="/register">Sign up</Link>
            </>
          ) : (
            <>
              Already have an account? <Link to="/login">Sign in</Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

export const Login = () => <AuthForm mode="login" />;
export const Register = () => <AuthForm mode="register" />;
