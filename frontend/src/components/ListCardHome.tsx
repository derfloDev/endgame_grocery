import { useState } from "react";
import type { KeyboardEvent, ReactElement } from "react";
import { useTranslation } from "react-i18next";
import type { List } from "../types";
import { Icon } from "./ui";

interface HomeList extends List {
  name: string;
  owner_name?: string;
  is_pending_sync?: boolean;
}

interface ListCardHomeProps {
  list: HomeList;
  onOpen?: () => void;
  onRename?: (name: string) => void;
  onDelete?: () => void;
}

export default function ListCardHome({ list, onOpen, onRename, onDelete }: ListCardHomeProps): ReactElement {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [renamingMode, setRenamingMode] = useState(false);
  const [renameValue, setRenameValue] = useState(list.name);

  function closeMenu(): void {
    setMenuOpen(false);
    setRenamingMode(false);
  }

  function submitRename(): void {
    const trimmed = renameValue.trim();

    if (!trimmed) {
      return;
    }

    onRename?.(trimmed);
    closeMenu();
  }

  return (
    <article className="eg-card list-card-home">
      <div className="eg-card-overlay" />
      <div
        className="list-card-row"
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpen?.();
          }
        }}
      >
        <div className="list-card-info">
          <div className="eg-orbitron list-card-name">{list.name}</div>
          <div className="list-card-chips">
            <span className={list.is_owner ? "eg-chip-purple" : "eg-chip-cyan"}>
              {list.is_owner ? t("common.owner") : `${t("common.shared")} · ${list.owner_name}`}
            </span>
            {list.is_pending_sync ? <span className="eg-chip-queued">{t("common.queued")}</span> : null}
          </div>
        </div>
        {list.is_owner ? (
          <button
            aria-label={t("list.actionsFor", { name: list.name })}
            className="eg-icon-btn"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setMenuOpen((current) => !current);
              setRenamingMode(false);
              setRenameValue(list.name);
            }}
          >
            <Icon name="moreVertical" color="var(--text-secondary)" size={18} />
          </button>
        ) : null}
      </div>

      {menuOpen && !renamingMode ? (
        <div className="list-card-menu" onClick={(event) => event.stopPropagation()}>
          <button
            className="eg-btn-ghost list-card-menu-btn"
            type="button"
            onClick={() => {
              setRenamingMode(true);
              setRenameValue(list.name);
            }}
          >
            {t("common.rename")}
          </button>
          <button
            className="eg-btn-danger list-card-menu-btn"
            type="button"
            onClick={() => {
              closeMenu();
              onDelete?.();
            }}
          >
            {t("common.delete")}
          </button>
        </div>
      ) : null}

      {menuOpen && renamingMode ? (
        <div className="list-card-menu" onClick={(event) => event.stopPropagation()}>
          <label className="visually-hidden" htmlFor={`rename-${list.id}`}>
            {t("list.renameList")}
          </label>
          <input
            id={`rename-${list.id}`}
            autoFocus
            className="eg-input"
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submitRename();
              }

              if (event.key === "Escape") {
                closeMenu();
              }
            }}
          />
          <div className="button-row list-card-menu-actions">
            <button className="eg-btn-ghost" type="button" onClick={closeMenu}>
              {t("common.cancel")}
            </button>
            <button className="eg-btn-secondary" type="button" onClick={submitRename}>
              {t("listCard.saveName")}
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}
