import { useTranslation } from "react-i18next";
import type { ReactElement } from "react";

interface LoadingStateProps {
  rows?: number;
}

export default function LoadingState({ rows = 4 }: LoadingStateProps): ReactElement {
  const { t } = useTranslation();

  return (
    <div aria-label={t("loading.label")} className="loading-state">
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="loading-state-row"
          style={{ animationDelay: `${index * 0.1}s` }}
        />
      ))}
    </div>
  );
}
