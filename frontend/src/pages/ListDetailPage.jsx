import { useParams } from "react-router-dom";

export default function ListDetailPage() {
  const { id } = useParams();

  return (
    <div className="stack">
      <span className="pill">Protected detail route</span>
      <p>List detail view for <strong>{id}</strong> unlocks in T-005.</p>
    </div>
  );
}
