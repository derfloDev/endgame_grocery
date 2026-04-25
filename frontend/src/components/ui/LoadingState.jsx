export default function LoadingState({ rows = 4 }) {
  return (
    <div aria-label="Loading" className="loading-state">
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
