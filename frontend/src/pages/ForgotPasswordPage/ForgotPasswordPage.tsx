import { useState } from "react";
import type { FormEvent, ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import logo from "../../assets/endgame_grocery_logo.png";
import { forgotPassword } from "../../api/auth";
import styles from "../../styles/auth.module.css";

export default function ForgotPasswordPage(): ReactElement {
  const { t } = useTranslation();
  const [email, setEmail] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [notice, setNotice] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError("");
    setNotice("");
    setIsSubmitting(true);

    try {
      await forgotPassword(email.trim());
      setNotice(t("auth.resetSuccess"));
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className={styles["auth-layout"]}>
      <section className={styles["auth-card"]}>
        <div className={styles["auth-brand"]}>
          <img alt={t("app.brandName")} className={styles["auth-logo"]} src={logo} />
          <div>
            <div className={`eg-orbitron eg-gradient-text ${styles["auth-brand-title"]}`}>{t("app.brandMain")}</div>
            <div className={styles["auth-brand-sub"]}>{t("app.brandSub")}</div>
          </div>
        </div>
        <h1>{t("auth.resetTitle")}</h1>
        <p>{t("auth.resetBody")}</p>
        <form className={styles["auth-form"]} onSubmit={handleSubmit}>
          {notice ? <p className="eg-success-banner">{notice}</p> : null}
          {error ? <p className="eg-error-banner">{error}</p> : null}
          <div className="eg-field">
            <label htmlFor="forgot-password-email">{t("auth.email")}</label>
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
              {isSubmitting ? t("auth.sending") : t("auth.sendReset")}
            </button>
            <Link className="eg-link" to="/login">
              {t("auth.backToLogin")}
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
