import { useLocation, useNavigate } from "react-router-dom";
import Icon from "./Icon";

const tabs = [
  { id: "lists", label: "Lists", path: "/", icon: "list" },
  { id: "search", label: "Search", path: "/search", icon: "search" }
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

        return (
          <button
            key={tab.id}
            aria-current={isActive ? "page" : undefined}
            className="bottom-nav-tab"
            type="button"
            onClick={() => navigate(tab.path)}
          >
            <Icon name={tab.icon} size={22} strokeWidth={isActive ? 2 : 1.5} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
