import { useRef } from "react";
import IconButton from "./IconButton";

export default function ImageTool({ onPickForPlacement }) {
  const inputRef = useRef(null);

  const openPicker = () => inputRef.current?.click();

  const handleChange = (e) => {
    const file = e.target.files?.[0];
    if (file) onPickForPlacement(file);
    e.target.value = ""; // permite escoger el mismo archivo de nuevo
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <IconButton
        label="Agregar imagen (clic y coloca)"
        onClick={openPicker}
        size={42}
      >
        🖼️
      </IconButton>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleChange}
        style={{ display: "none" }}
      />

      <small style={{ color: "#6b7280", lineHeight: 1.2 }}>
        Tip: también puedes arrastrar una imagen y soltarla sobre la hoja.
      </small>
    </div>
  );
}
