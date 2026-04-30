import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import logo from "../assets/endgame_grocery_logo.png";
import { useAuth } from "../context/AuthContext";

export default function RegisterPage() {
  const { register, setAuthToken, token } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inviteToken = searchParams.get("invite") ?? "";

  if (token) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const result = await register({
        display_name: displayName,
        email,
        password,
        ...(inviteToken ? { invite_token: inviteToken } : {})
      });

      if (result?.token && result?.listId) {
        setAuthToken(result.token, result.user ?? null);
        navigate(`/lists/${result.listId}`, { replace: true });
        return;
      }

      navigate("/verify-email", { replace: true, state: { email } });
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-layout">
      <section className="auth-card">
        <div className="auth-brand">
          <img alt="Endgame Grocery" className="auth-logo" src={logo} />
          <div className="auth-brand-text">
            <div className="auth-brand-title eg-orbitron eg-gradient-text">ENDGAME</div>
            <div className="auth-brand-sub">GROCERY</div>
          </div>
        </div>
        <h1>Join the Squad</h1>
        <p>
          {inviteToken
            ? "Create your account to unlock the shared list right away."
            : "Create your account to get started."}
        </p>
        <form className="auth-form" onSubmit={handleSubmit}>
          {error ? <p className="eg-error-banner">{error}</p> : null}
          <div className="eg-field">
            <label htmlFor="register-display-name">Display name</label>
            <input
              id="register-display-name"
              autoComplete="name"
              className="eg-input"
              name="display_name"
              required
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </div>
          <div className="eg-field">
            <label htmlFor="register-email">Email</label>
            <input
              id="register-email"
              autoComplete="email"
              className="eg-input"
              name="email"
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="eg-field">
            <label htmlFor="register-password">Password</label>
            <input
              id="register-password"
              autoComplete="new-password"
              className="eg-input"
              minLength={8}
              name="password"
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <div className="button-row">
            <button className="eg-btn-primary" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Creating..." : "Create account"}
            </button>
            <Link className="eg-link" to="/login">
              Already have an account?
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}
