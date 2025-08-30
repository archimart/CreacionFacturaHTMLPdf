export default function Inspector({ element, onChange, onDelete }) {
  if (!element) {
    return (
      <div style={{ fontSize: 12, color: "#666" }}>
        Selecciona un elemento para editar.
      </div>
    );
  }

  const st = element.style || {};

  return (
    <div style={{ display: "grid", gap: 8, fontSize: 12 }}>
      <strong>Propiedades</strong>

      <label>
        Ancho
        <input
          type="number"
          min={10}
          value={element.w}
          onChange={(e) => onChange({ w: Number(e.target.value) })}
          style={{ width: "100%" }}
        />
      </label>

      <label>
        Alto
        <input
          type="number"
          min={10}
          value={element.h}
          onChange={(e) => onChange({ h: Number(e.target.value) })}
          style={{ width: "100%" }}
        />
      </label>

      <label>
        Borde (px)
        <input
          type="number"
          min={0}
          value={st.borderWidth ?? 1}
          onChange={(e) =>
            onChange({ style: { ...st, borderWidth: Number(e.target.value) } })
          }
          style={{ width: "100%" }}
        />
      </label>

      <label>
        Radio
        <input
          type="number"
          min={0}
          value={st.borderRadius ?? 6}
          onChange={(e) =>
            onChange({ style: { ...st, borderRadius: Number(e.target.value) } })
          }
          style={{ width: "100%" }}
        />
      </label>

      <label>
        Color borde
        <input
          type="color"
          value={st.borderColor ?? "#333333"}
          onChange={(e) =>
            onChange({ style: { ...st, borderColor: e.target.value } })
          }
          style={{ width: "100%" }}
        />
      </label>

      <label>
        Fondo
        <input
          type="color"
          value={st.background ?? "#ffffff"}
          onChange={(e) =>
            onChange({ style: { ...st, background: e.target.value } })
          }
          style={{ width: "100%" }}
        />
      </label>

      {element.type === "text" && (
        <>
          {/* ...tamaño de fuente y color ya existentes... */}

          <label>
            Alineación horizontal
            <select
              value={st.textAlign ?? "left"}
              onChange={(e) =>
                onChange({ style: { ...st, textAlign: e.target.value } })
              }
              style={{ width: "100%" }}
            >
              <option value="left">Izquierda</option>
              <option value="center">Centro</option>
              <option value="right">Derecha</option>
            </select>
          </label>

          <label>
            Alineación vertical
            <select
              value={st.vAlign ?? "top"}
              onChange={(e) =>
                onChange({ style: { ...st, vAlign: e.target.value } })
              }
              style={{ width: "100%" }}
            >
              <option value="top">Arriba</option>
              <option value="middle">Medio</option>
              <option value="bottom">Abajo</option>
            </select>
          </label>
        </>
      )}

      <button
        onClick={onDelete}
        style={{
          marginTop: 6,
          background: "#fee2e2",
          border: "1px solid #ef4444",
          borderRadius: 6,
          padding: "6px 8px",
        }}
      >
        Eliminar
      </button>
    </div>
  );
}
