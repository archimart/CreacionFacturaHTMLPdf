import React, { useRef } from "react";

export default function ImageTool({ onPickForPlacement, compact = true }) {
  const inputRef = useRef(null);

  const openPicker = () => inputRef.current?.click();

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (f) onPickForPlacement(f);
    e.target.value = "";
  };

  const base = {
    height: 36,
    minWidth: 36,
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: "0 10px",
    background: "#fff",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1,
    cursor: "pointer",
  };
  const icon = { ...base, width: 36, padding: 0 };
  const row = { display: "flex", alignItems: "center", gap: 8, height: 36 };

  return (
    <div style={compact ? row : undefined}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={onFile}
        style={{ display: "none" }}
      />
      <button
        type="button"
        onClick={openPicker}
        style={compact ? icon : undefined}
        title="Insertar imagen"
      >
        🖼️+
      </button>
    </div>
  );
}
