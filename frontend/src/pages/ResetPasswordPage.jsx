import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import logo from "../assets/endgame_grocery_logo.png";
import { resetPassword } from "../api/auth";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState(token ? "" : "Password reset token is required.");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!token) {
      setError("Password reset token is required.");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      await resetPassword(token, password);
      navigate("/login", {
        replace: true,
        state: { message: "Password updated. Please log in with your new password." }
      });
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
        <h1>Choose a new password</h1>
        <p>Create a fresh password for your account.</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          {error ? <p className="eg-error-banner">{error}</p> : null}
          <div className="eg-field">
            <label htmlFor="reset-password-next">New password</label>
            <input
              id="reset-password-next"
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
              {isSubmitting ? "Updating..." : "Update password"}
            </button>
            <Link className="eg-link" to="/login">
              Back to login
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}
