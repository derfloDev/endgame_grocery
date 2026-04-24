import Icon from "./Icon";

export default function FAB({ onClick, icon = "plus" }) {
  return (
    <button aria-label="Add" className="fab" type="button" onClick={onClick}>
      <Icon name={icon} size={24} color="#080B1C" strokeWidth={2.5} />
    </button>
  );
}
