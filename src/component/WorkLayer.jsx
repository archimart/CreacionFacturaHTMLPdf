import DraggableBox from "./DraggableBox";

export default function WorkLayer({
  elements,
  selectedId,
  onSelect,
  onChange,
  onDelete,
  placing = false,
  onPlaceAt,
}) {
  const handleClick = (e) => {
    if (!placing || !onPlaceAt) return;
    // posición relativa a la hoja
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    onPlaceAt(x, y);
    e.stopPropagation();
  };

  const handleDragOver = (e) => {
    // permitir drop de archivos
    e.preventDefault();
  };

  const handleDrop = (e) => {
    if (!onPlaceAt) return;
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    // Avisar al padre que coloque desde un file dropeado
    onPlaceAt(x, y, file);
  };

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        cursor: placing ? "crosshair" : "default",
      }}
      onMouseDown={handleClick}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {elements.map((el) => (
        <DraggableBox
          key={el.id}
          element={el}
          selected={el.id === selectedId}
          disabled={placing} // 👈 importante si usas “colocar”
          onSelect={() => onSelect(el.id)}
          onChange={(partial) => onChange(el.id, partial)}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
