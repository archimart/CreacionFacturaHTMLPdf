import React from "react";

export default function InspectorTabs({ active = "order", onChange }) {
  const Tab = ({ id, children }) => (
    <button
      onClick={() => onChange?.(id)}
      style={{
        padding: "8px 10px",
        border: "1px solid #e5e7eb",
        borderBottom: active === id ? "2px solid #2563eb" : "1px solid #e5e7eb",
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8,
        background: active === id ? "#fff" : "#f8fafc",
        color: active === id ? "#111827" : "#475569",
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );

  return (
    <div style={{ display: "flex", gap: 8, padding: "8px 8px 0" }}>
      <Tab id="order">Orden</Tab>
      <Tab id="props">Propiedades</Tab>
    </div>
  );
}
