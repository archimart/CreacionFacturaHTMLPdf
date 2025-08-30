import IconButton from "./IconButton";

export default function BoxesTool({ onAddBox, onAddText }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <IconButton label="Agregar cuadro" onClick={onAddBox} size={42}>
        ▦
      </IconButton>
      <IconButton label="Agregar texto" onClick={onAddText} size={42}>
        T
      </IconButton>
    </div>
  );
}
