import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { login, token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const redirectTo = location.state?.from ?? "/";

  if (token) {
    return <Navigate to={redirectTo} replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await login({ email, password });
      navigate(redirectTo, { replace: true });
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-layout">
      <section className="auth-card">
        <p className="eyebrow">Shared household planning</p>
        <div className="page-copy">
          <h1>Welcome back</h1>
          <p>Log in to keep your grocery lists synced across devices and households.</p>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          {error ? <p className="error-banner">{error}</p> : null}
          <div className="field">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              autoComplete="email"
              name="email"
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              autoComplete="current-password"
              name="password"
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <div className="button-row">
            <button className="button-primary" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Signing in..." : "Log in"}
            </button>
            <Link className="muted-link" to="/register">
              Create an account
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}
