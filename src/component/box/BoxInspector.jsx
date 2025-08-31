import React from "react";

function Row({ label, children }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 10,
      }}
    >
      <div style={{ width: 110, color: "#64748b", fontSize: 13 }}>{label}</div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
        {children}
      </div>
    </div>
  );
}

export default function BoxInspector({ el, onStyle }) {
  if (!el) return null;
  const st = el.style || {};

  const set = (patch) => onStyle({ ...st, ...patch });

  const bgIsTransparent = (st.background ?? "") === "transparent";

  return (
    <div
      style={{
        marginTop: 12,
        padding: 12,
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        background: "#fff",
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 12 }}>
        Propiedades del cuadro
      </div>

      {/* Fondo */}
      <Row label="Fondo">
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={bgIsTransparent}
            onChange={(e) =>
              set({
                background: e.target.checked
                  ? "transparent"
                  : st.background ?? "#ffffff",
              })
            }
          />
          <span>Transparente</span>
        </label>
        {!bgIsTransparent && (
          <input
            type="color"
            value={st.background ?? "#ffffff"}
            onChange={(e) => set({ background: e.target.value })}
            style={{
              width: 36,
              height: 24,
              border: "1px solid #e5e7eb",
              borderRadius: 4,
            }}
          />
        )}
      </Row>

      {/* Bordes */}
      <Row label="Borde">
        <input
          type="color"
          value={st.borderColor ?? "#94a3b8"}
          onChange={(e) => set({ borderColor: e.target.value })}
          style={{
            width: 36,
            height: 24,
            border: "1px solid #e5e7eb",
            borderRadius: 4,
          }}
        />
        <input
          type="range"
          min={0}
          max={12}
          step={1}
          value={st.borderWidth ?? 1}
          onChange={(e) => set({ borderWidth: Number(e.target.value) })}
          style={{ flex: 1 }}
        />
        <div style={{ width: 30, textAlign: "right", color: "#64748b" }}>
          {st.borderWidth ?? 1}px
        </div>
      </Row>

      {/* Radios (cuadrado / curvo) */}
      <Row label="Esquinas">
        <button
          type="button"
          onClick={() => set({ borderRadius: 0 })}
          style={{
            padding: "4px 8px",
            border: "1px solid #e5e7eb",
            borderRadius: 6,
            background: (st.borderRadius ?? 10) === 0 ? "#eef2ff" : "#fff",
          }}
        >
          Cuadrado
        </button>
        <button
          type="button"
          onClick={() => set({ borderRadius: 12 })}
          style={{
            padding: "4px 8px",
            border: "1px solid #e5e7eb",
            borderRadius: 6,
            background: (st.borderRadius ?? 10) > 0 ? "#eef2ff" : "#fff",
          }}
        >
          Curvo
        </button>
        <input
          type="range"
          min={0}
          max={40}
          step={1}
          value={st.borderRadius ?? 10}
          onChange={(e) => set({ borderRadius: Number(e.target.value) })}
          style={{ flex: 1 }}
        />
        <div style={{ width: 30, textAlign: "right", color: "#64748b" }}>
          {st.borderRadius ?? 10}
        </div>
      </Row>
    </div>
  );
}
