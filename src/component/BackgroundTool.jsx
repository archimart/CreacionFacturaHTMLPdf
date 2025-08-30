import { useRef } from "react";
import IconButton from "./IconButton";

export default function BackgroundTool({
  onPickFile,
  onClear,
  hasBackground,
  fit,
  onChangeFit,
}) {
  const inputRef = useRef(null);

  const openPicker = () => inputRef.current?.click();
  const handleChange = (e) => {
    const file = e.target.files?.[0];
    if (file) onPickFile(file);
    e.target.value = "";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Botón de icono con tooltip */}
      <IconButton label="Fondo (cargar imagen)" onClick={openPicker} size={42}>
        {/* Puedes usar emoji o SVG; aquí emoji por rapidez */}
        🖼️
      </IconButton>

      {/* Input oculto */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleChange}
        style={{ display: "none" }}
      />

      {/* Controles compactos */}
      <label style={{ fontSize: 12, display: "grid", gap: 6 }}>
        Ajuste
        <select
          value={fit}
          onChange={(e) => onChangeFit(e.target.value)}
          style={{ width: "100%" }}
        >
          <option value="contain">Encajar</option>
          <option value="cover">Cubrir</option>
          <option value="100% 100%">Estirar</option>
        </select>
      </label>

      <button
        onClick={onClear}
        disabled={!hasBackground}
        style={{ fontSize: 12 }}
      >
        Quitar fondo
      </button>
    </div>
  );
}
