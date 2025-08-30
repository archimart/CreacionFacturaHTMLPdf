import { useRef } from "react";
import IconButton from "./IconButton";

export default function StickerTool({ onPickForPlacement, targetW = 120 }) {
  const inputRef = useRef(null);

  const openPicker = () => inputRef.current?.click();

  const handleChange = (e) => {
    const file = e.target.files?.[0];
    if (file) onPickForPlacement(file, targetW);
    e.target.value = "";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <IconButton label="Agregar imagen pequeña" onClick={openPicker} size={42}>
        🧩
      </IconButton>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleChange}
        style={{ display: "none" }}
      />
    </div>
  );
}
