import { useState } from "react";
import type { FormEvent, ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import logo from "../../assets/endgame_grocery_logo.png";
import { resetPassword } from "../../api/auth";
import styles from "../../styles/auth.module.css";

export default function ResetPasswordPage(): ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<string>(token ? "" : t("auth.resetTokenRequired"));
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!token) {
      setError(t("auth.resetTokenRequired"));
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      await resetPassword(token, password);
      navigate("/login", {
        replace: true,
        state: { message: t("auth.passwordUpdatedLogin") }
      });
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
        <h1>{t("auth.choosePassword")}</h1>
        <p>{t("auth.choosePasswordBody")}</p>
        <form className={styles["auth-form"]} onSubmit={handleSubmit}>
          {error ? <p className="eg-error-banner">{error}</p> : null}
          <div className="eg-field">
            <label htmlFor="reset-password-next">{t("auth.newPassword")}</label>
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
              {isSubmitting ? t("auth.updating") : t("auth.updatePassword")}
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
