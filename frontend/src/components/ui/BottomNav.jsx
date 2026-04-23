import { useLocation, useNavigate } from "react-router-dom";

const tabs = [
  { id: "lists", label: "Lists", path: "/", icon: ListIcon },
  { id: "search", label: "Search", path: "/search", icon: SearchIcon }
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav aria-label="Primary navigation" className="bottom-nav">
      {tabs.map((tab) => {
        const isActive =
          tab.id === "lists"
            ? location.pathname === "/" || location.pathname.startsWith("/lists")
            : location.pathname.startsWith(tab.path);
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            aria-current={isActive ? "page" : undefined}
            className="bottom-nav-tab"
            type="button"
            onClick={() => navigate(tab.path)}
          >
            <Icon active={isActive} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function ListIcon({ active }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="22"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={active ? 2.2 : 1.5}
      viewBox="0 0 24 24"
      width="22"
    >
      <line x1="8" x2="21" y1="6" y2="6" />
      <line x1="8" x2="21" y1="12" y2="12" />
      <line x1="8" x2="21" y1="18" y2="18" />
      <line x1="3" x2="3.01" y1="6" y2="6" />
      <line x1="3" x2="3.01" y1="12" y2="12" />
      <line x1="3" x2="3.01" y1="18" y2="18" />
    </svg>
  );
}

function SearchIcon({ active }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="22"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={active ? 2.2 : 1.5}
      viewBox="0 0 24 24"
      width="22"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" x2="16.65" y1="21" y2="16.65" />
    </svg>
  );
}
