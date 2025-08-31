export default function SizeTool({
  size,
  orientation,
  onSize,
  onOrientation,
  compact = true,
}) {
  const base = {
    height: 36,
    minWidth: 36,
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: "0 10px",
    background: "#fff",
    display: "inline-flex",
    alignItems: "center",
    lineHeight: 1,
    cursor: "pointer",
  };
  const row = { display: "flex", alignItems: "center", gap: 8, height: 36 };

  return (
    <div style={compact ? row : undefined}>
      <select
        value={size}
        onChange={(e) => onSize(e.target.value)}
        style={base}
        title="Tamaño de hoja"
      >
        <option value="letter">Carta (8.5×11)</option>
        <option value="legal">Oficio (8.5×14)</option>
        <option value="halfLetter">1/2 Carta (5.5×8.5)</option>
        <option value="a4">A4 (210×297 mm)</option>
        <option value="a5">A5 (148×210 mm)</option>
      </select>

      <select
        value={orientation}
        onChange={(e) => onOrientation(e.target.value)}
        style={base}
        title="Orientación"
      >
        <option value="portrait">Vertical</option>
        <option value="landscape">Horizontal</option>
      </select>
    </div>
  );
}
