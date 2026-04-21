import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function RegisterPage() {
  const { register, token } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (token) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await register({
        display_name: displayName,
        email,
        password
      });
      navigate("/", { replace: true });
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-layout">
      <section className="auth-card">
        <p className="eyebrow">Family-ready setup</p>
        <div className="page-copy">
          <h1>Create your account</h1>
          <p>Set up your login now so list sharing and protected views can follow in later tasks.</p>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          {error ? <p className="error-banner">{error}</p> : null}
          <div className="field">
            <label htmlFor="register-display-name">Display name</label>
            <input
              id="register-display-name"
              autoComplete="name"
              name="display_name"
              required
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="register-email">Email</label>
            <input
              id="register-email"
              autoComplete="email"
              name="email"
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="register-password">Password</label>
            <input
              id="register-password"
              autoComplete="new-password"
              minLength={8}
              name="password"
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <div className="button-row">
            <button className="button-primary" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Creating..." : "Create account"}
            </button>
            <Link className="muted-link" to="/login">
              Already have an account?
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}
