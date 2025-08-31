import { CTRL } from "../utils/uiStyles";

export default function BoxesTool({ onAddBox, onAddText, compact = true }) {
  const icon = compact ? { ...CTRL.base, ...CTRL.icon } : {};
  const row = compact ? CTRL.row : {};

  return (
    <div style={row}>
      <button
        type="button"
        onClick={onAddBox}
        style={icon}
        title="Añadir cuadro"
      >
        ▢
      </button>
      <button
        type="button"
        onClick={onAddText}
        style={icon}
        title="Añadir texto"
      >
        T
      </button>
    </div>
  );
}
