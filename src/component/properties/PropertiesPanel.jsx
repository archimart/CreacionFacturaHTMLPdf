export default function PropertiesPanel({ el, onRename, onChange, onStyle }) {
  if (!el)
    return <div style={{ color: "#64748b" }}>Selecciona un elemento…</div>;

  const s = el.style || {};
  const isBox = el.type === "box";
  const isText = el.type === "text";
  const isImage = el.type === "image";

  // Para texto mostramos controles en box y en text
  const canText = isText || isBox;

  const fonts = [
    "Inter, system-ui, sans-serif",
    "Arial, Helvetica, sans-serif",
    "Segoe UI, Tahoma, Geneva, Verdana, sans-serif",
    "Georgia, serif",
    "Times New Roman, Times, serif",
    "Courier New, Courier, monospace",
    "Roboto, system-ui, sans-serif",
    "Montserrat, system-ui, sans-serif",
  ];

  const inputStyle = {
    width: "100%",
    border: "1px solid #e5e7eb",
    borderRadius: 6,
    padding: "6px 8px",
  };

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ fontWeight: 700 }}>Propiedades</div>

      {/* Nombre */}
      <label style={{ fontSize: 12, color: "#475569" }}>Nombre</label>
      <input
        value={el.label ?? ""}
        onChange={(e) => onRename?.(e.target.value)}
        style={inputStyle}
        placeholder={isText ? "Texto" : isBox ? "Cuadro" : "Imagen"}
      />

      {/* ======== PROPIEDADES DE IMAGEN ======== */}
      {isImage && (
        <>
          <div style={{ fontWeight: 700, marginTop: 6 }}>Imagen</div>

          <label style={{ fontSize: 12, color: "#475569" }}>Encaje</label>
          <select
            value={s.fit ?? "contain"}
            onChange={(e) => onStyle?.({ ...(s || {}), fit: e.target.value })}
            style={inputStyle}
          >
            <option value="contain">Contain (todo visible)</option>
            <option value="cover">Cover (cubrir)</option>
            <option value="fill">Fill (estirar)</option>
            <option value="none">None</option>
            <option value="scale-down">Scale-down</option>
          </select>

          <label style={{ fontSize: 12, color: "#475569" }}>Posición</label>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3,1fr)",
              gap: 6,
            }}
          >
            {[
              ["left top", "↖︎"],
              ["center top", "↑"],
              ["right top", "↗︎"],
              ["left center", "←"],
              ["center", "•"],
              ["right center", "→"],
              ["left bottom", "↙︎"],
              ["center bottom", "↓"],
              ["right bottom", "↘︎"],
            ].map(([pos, label]) => (
              <button
                key={pos}
                onClick={() => onStyle?.({ ...(s || {}), objectPosition: pos })}
                style={{
                  padding: "6px 8px",
                  border: "1px solid #e5e7eb",
                  borderRadius: 6,
                  background:
                    (s.objectPosition ?? "center") === pos ? "#eef2ff" : "#fff",
                  fontWeight:
                    (s.objectPosition ?? "center") === pos ? 700 : 500,
                }}
                title={pos}
              >
                {label}
              </button>
            ))}
          </div>

          <label style={{ fontSize: 12, color: "#475569" }}>Esquinas</label>
          <input
            type="number"
            min={0}
            value={s.borderRadius ?? 0}
            onChange={(e) =>
              onStyle?.({
                ...(s || {}),
                borderRadius: Number(e.target.value) || 0,
              })
            }
            style={inputStyle}
          />

          <label style={{ fontSize: 12, color: "#475569" }}>Opacidad</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={s.opacity ?? 1}
            onChange={(e) =>
              onStyle?.({ ...(s || {}), opacity: Number(e.target.value) })
            }
          />
        </>
      )}

      {/* ======== PROPIEDADES DE TEXTO (para box y text) ======== */}
      {canText && (
        <>
          <div style={{ fontWeight: 700, marginTop: 6 }}>Texto</div>

          <label style={{ fontSize: 12, color: "#475569" }}>Contenido</label>
          <textarea
            value={el.text ?? ""}
            onChange={(e) => onChange?.({ text: e.target.value })}
            rows={3}
            style={{ ...inputStyle, resize: "vertical" }}
            placeholder="Escribe aquí…"
          />

          <label style={{ fontSize: 12, color: "#475569" }}>Fuente</label>
          <select
            value={s.fontFamily ?? fonts[0]}
            onChange={(e) =>
              onStyle?.({ ...(s || {}), fontFamily: e.target.value })
            }
            style={inputStyle}
          >
            {fonts.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>

          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
          >
            <div>
              <label style={{ fontSize: 12, color: "#475569" }}>Tamaño</label>
              <input
                type="number"
                min={8}
                max={300}
                value={s.fontSize ?? (isText ? 18 : 14)}
                onChange={(e) =>
                  onStyle?.({
                    ...(s || {}),
                    fontSize: Number(e.target.value) || 0,
                  })
                }
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#475569" }}>Color</label>
              <input
                type="color"
                value={s.color ?? "#111111"}
                onChange={(e) =>
                  onStyle?.({ ...(s || {}), color: e.target.value })
                }
                style={{ width: "100%", height: 34 }}
              />
            </div>
          </div>

          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
          >
            <div>
              <label style={{ fontSize: 12, color: "#475569" }}>Peso</label>
              <select
                value={String(s.fontWeight ?? 400)}
                onChange={(e) =>
                  onStyle?.({
                    ...(s || {}),
                    fontWeight: Number(e.target.value),
                  })
                }
                style={inputStyle}
              >
                {[300, 400, 500, 600, 700, 800].map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#475569" }}>Estilo</label>
              <select
                value={s.fontStyle ?? "normal"}
                onChange={(e) =>
                  onStyle?.({ ...(s || {}), fontStyle: e.target.value })
                }
                style={inputStyle}
              >
                <option value="normal">Normal</option>
                <option value="italic">Itálica</option>
              </select>
            </div>
          </div>

          <div style={{ fontWeight: 700, marginTop: 6 }}>Alineación</div>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
          >
            <div>
              <label style={{ fontSize: 12, color: "#475569" }}>
                Horizontal
              </label>
              <div style={{ display: "flex", gap: 6 }}>
                {["left", "center", "right"].map((opt) => (
                  <button
                    key={opt}
                    onClick={() => onStyle?.({ ...(s || {}), textAlign: opt })}
                    style={{
                      flex: 1,
                      padding: "6px 8px",
                      border: "1px solid #e5e7eb",
                      borderRadius: 6,
                      background:
                        (s.textAlign ?? "left") === opt ? "#eef2ff" : "#fff",
                      fontWeight: (s.textAlign ?? "left") === opt ? 700 : 500,
                    }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#475569" }}>Vertical</label>
              <div style={{ display: "flex", gap: 6 }}>
                {[
                  { k: "top", label: "Arriba" },
                  { k: "middle", label: "Centro" },
                  { k: "bottom", label: "Abajo" },
                ].map(({ k, label }) => (
                  <button
                    key={k}
                    onClick={() => onStyle?.({ ...(s || {}), vAlign: k })}
                    style={{
                      flex: 1,
                      padding: "6px 8px",
                      border: "1px solid #e5e7eb",
                      borderRadius: 6,
                      background:
                        (s.vAlign ?? "top") === k ? "#eef2ff" : "#fff",
                      fontWeight: (s.vAlign ?? "top") === k ? 700 : 500,
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ======== PROPIEDADES DE CAJA ======== */}
      {isBox && (
        <>
          <div style={{ fontWeight: 700, marginTop: 6 }}>Caja</div>

          <label style={{ fontSize: 12, color: "#475569" }}>Fondo</label>
          <input
            type="color"
            value={s.background ?? "#ffffff"}
            onChange={(e) =>
              onStyle?.({ ...(s || {}), background: e.target.value })
            }
            style={{ width: 120, height: 34 }}
          />

          <label style={{ fontSize: 12, color: "#475569" }}>
            Color de borde
          </label>
          <input
            type="color"
            value={s.borderColor ?? "#2563eb"}
            onChange={(e) =>
              onStyle?.({ ...(s || {}), borderColor: e.target.value })
            }
            style={{ width: 120, height: 34 }}
          />

          <label style={{ fontSize: 12, color: "#475569" }}>
            Ancho / Radio
          </label>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
          >
            <input
              type="number"
              min={0}
              value={s.borderWidth ?? 1}
              onChange={(e) =>
                onStyle?.({
                  ...(s || {}),
                  borderWidth: Number(e.target.value) || 0,
                })
              }
              style={inputStyle}
            />
            <input
              type="number"
              min={0}
              value={s.borderRadius ?? 10}
              onChange={(e) =>
                onStyle?.({
                  ...(s || {}),
                  borderRadius: Number(e.target.value) || 0,
                })
              }
              style={inputStyle}
            />
          </div>
        </>
      )}
    </div>
  );
}
