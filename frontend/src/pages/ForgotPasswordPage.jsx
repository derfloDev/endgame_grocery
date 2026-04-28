import { useState } from "react";
import { Link } from "react-router-dom";
import logo from "../assets/endgame_grocery_logo.png";
import { forgotPassword } from "../api/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setIsSubmitting(true);

    try {
      await forgotPassword(email.trim());
      setNotice("If the account exists, a reset email is on its way.");
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
        <h1>Reset your password</h1>
        <p>Enter your email address and we&apos;ll send you a reset link.</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          {notice ? <p className="eg-success-banner">{notice}</p> : null}
          {error ? <p className="eg-error-banner">{error}</p> : null}
          <div className="eg-field">
            <label htmlFor="forgot-password-email">Email</label>
            <input
              id="forgot-password-email"
              autoComplete="email"
              className="eg-input"
              name="email"
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="button-row">
            <button className="eg-btn-primary" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Sending..." : "Send reset email"}
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
