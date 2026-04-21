import { APP_TITLE } from "./app.constants";
import "./index.css";

export default function App() {
  return (
    <main className="app-shell">
      <section className="hero-card">
        <p className="eyebrow">Project scaffold</p>
        <h1>{APP_TITLE}</h1>
        <p>
          Frontend and backend workspaces are wired up. Authentication, lists, entries, and offline
          support land in follow-up tasks.
        </p>
      </section>
    </main>
  );
}
