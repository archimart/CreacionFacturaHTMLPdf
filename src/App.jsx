import { useEffect, useMemo, useRef, useState } from "react";
import Toolbar from "./component/ToolBar";
import BackgroundTool from "./component/BackgroundTool";
import PaperCanvas from "./component/PaperCanvas";
import BoxesTool from "./component/BoxesTool";
import WorkLayer from "./component/WorkLayer";
import ExportTool from "./component/export/ExportTool";
import ImageTool from "./component/ImageTool";
import SizeTool from "./component/SizeTool";
import OrderList from "./component/order/OrderList";
import { WORK_BG } from "./utils/utils";

const WORKAREA_MAX_WIDTH = 1120;
const MIN_RIGHT = 360;
const MAX_RIGHT = 840;

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

/* -------------------- PANEL DE PROPIEDADES -------------------- */
// Pon este helper cerca de los imports en App.jsx
const toHex6 = (hex) => {
  if (!hex) return "#111111";
  const v = hex.trim();
  if (/^#([0-9a-fA-F]{3})$/.test(v)) {
    return "#" + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
  }
  if (/^#([0-9a-fA-F]{6})$/.test(v)) return v.toLowerCase();
  return "#111111";
};
// debajo de addText():

// Reemplaza toda tu función PropertiesPanel por esta:
// en App.jsx, define/actualiza este componente:
function PropertiesPanel({ el, onRename, onChange, onStyle }) {
  if (!el)
    return <div style={{ color: "#64748b" }}>Selecciona un elemento…</div>;
  const s = el.style || {};
  const isTextual = el.type === "text" || el.type === "box";
  const isBox = el.type === "box";
  const isTable = el.type === "table";

  const setRows = (rows) => {
    const t = el.table || { rows: 1, cols: 1, data: [[""]], header: false };
    const r = Math.max(1, Number(rows) || 1);
    const data = Array.from({ length: r }, (_, rr) =>
      Array.from({ length: t.cols }, (_, cc) => t.data?.[rr]?.[cc] ?? "")
    );
    onChange?.({ table: { ...t, rows: r, data } });
  };
  const setCols = (cols) => {
    const t = el.table || { rows: 1, cols: 1, data: [[""]], header: false };
    const c = Math.max(1, Number(cols) || 1);
    const data = Array.from({ length: t.rows }, (_, rr) =>
      Array.from({ length: c }, (_, cc) => t.data?.[rr]?.[cc] ?? "")
    );
    onChange?.({ table: { ...t, cols: c, data } });
  };

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ fontWeight: 600 }}>Propiedades</div>

      {/* Nombre (label) */}
      <label style={{ fontSize: 12, color: "#475569" }}>Nombre</label>
      <input
        value={el.label ?? ""}
        onChange={(e) => onRename?.(e.target.value)}
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 6,
          padding: "6px 8px",
        }}
      />

      {/* === BOX (fondo/borde) === */}
      {isBox && (
        <>
          <label style={{ fontSize: 12, color: "#475569" }}>Fondo</label>
          <input
            type="color"
            value={s.background ?? "#ffffff"}
            onChange={(e) => onStyle?.({ ...s, background: e.target.value })}
          />

          <label style={{ fontSize: 12, color: "#475569" }}>
            Color de borde
          </label>
          <input
            type="color"
            value={s.borderColor ?? "#94a3b8"}
            onChange={(e) => onStyle?.({ ...s, borderColor: e.target.value })}
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
                onStyle?.({ ...s, borderWidth: Number(e.target.value) || 0 })
              }
            />
            <input
              type="number"
              min={0}
              value={s.borderRadius ?? 10}
              onChange={(e) =>
                onStyle?.({ ...s, borderRadius: Number(e.target.value) || 0 })
              }
            />
          </div>
        </>
      )}

      {/* === TEXTO (text/box) === */}
      {isTextual && (
        <>
          <label style={{ fontSize: 12, color: "#475569" }}>Texto</label>
          <textarea
            rows={4}
            value={el.text ?? ""}
            onChange={(e) => onChange?.({ text: e.target.value })}
            style={{
              width: "100%",
              border: "1px solid #e5e7eb",
              borderRadius: 6,
              padding: 8,
              resize: "vertical",
            }}
          />
          <label style={{ fontSize: 12, color: "#475569" }}>
            Color de texto
          </label>
          <input
            type="color"
            value={s.color ?? "#111111"}
            onChange={(e) => onStyle?.({ ...s, color: e.target.value })}
          />

          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
          >
            <div>
              <label style={{ fontSize: 12, color: "#475569" }}>Tamaño</label>
              <input
                type="number"
                min={8}
                value={s.fontSize ?? 18}
                onChange={(e) =>
                  onStyle?.({ ...s, fontSize: Number(e.target.value) || 12 })
                }
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#475569" }}>Fuente</label>
              <select
                value={s.fontFamily ?? ""}
                onChange={(e) =>
                  onStyle?.({ ...s, fontFamily: e.target.value || undefined })
                }
                style={{ width: "100%" }}
              >
                <option value="">System</option>
                <option value="Inter">Inter</option>
                <option value="Roboto">Roboto</option>
                <option value="Montserrat">Montserrat</option>
                <option value="serif">Serif</option>
                <option value="sans-serif">Sans-serif</option>
                <option value="monospace">Monospace</option>
              </select>
            </div>
          </div>

          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
          >
            <div>
              <label style={{ fontSize: 12, color: "#475569" }}>Peso</label>
              <select
                value={s.fontWeight ?? "normal"}
                onChange={(e) =>
                  onStyle?.({ ...s, fontWeight: e.target.value })
                }
                style={{ width: "100%" }}
              >
                <option value="300">Light</option>
                <option value="normal">Regular</option>
                <option value="600">SemiBold</option>
                <option value="700">Bold</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#475569" }}>Estilo</label>
              <select
                value={s.fontStyle ?? "normal"}
                onChange={(e) => onStyle?.({ ...s, fontStyle: e.target.value })}
                style={{ width: "100%" }}
              >
                <option value="normal">Normal</option>
                <option value="italic">Italic</option>
              </select>
            </div>
          </div>

          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
          >
            <div>
              <label style={{ fontSize: 12, color: "#475569" }}>
                Alineación
              </label>
              <select
                value={s.textAlign ?? "left"}
                onChange={(e) => onStyle?.({ ...s, textAlign: e.target.value })}
                style={{ width: "100%" }}
              >
                <option value="left">Izquierda</option>
                <option value="center">Centro</option>
                <option value="right">Derecha</option>
                <option value="justify">Justificar</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#475569" }}>Vertical</label>
              <select
                value={s.vAlign ?? "top"}
                onChange={(e) => onStyle?.({ ...s, vAlign: e.target.value })}
                style={{ width: "100%" }}
              >
                <option value="top">Arriba</option>
                <option value="middle">Centro</option>
                <option value="bottom">Abajo</option>
              </select>
            </div>
          </div>
        </>
      )}

      {/* === TABLA === */}
      {isTable && (
        <>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
          >
            <div>
              <label style={{ fontSize: 12, color: "#475569" }}>Filas</label>
              <input
                type="number"
                min={1}
                value={el.table?.rows ?? 1}
                onChange={(e) => setRows(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#475569" }}>Columnas</label>
              <input
                type="number"
                min={1}
                value={el.table?.cols ?? 1}
                onChange={(e) => setCols(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>
          </div>

          <label style={{ fontSize: 12, color: "#475569" }}>
            Padding de celda
          </label>
          <input
            type="number"
            min={0}
            value={s.cellPadding ?? 6}
            onChange={(e) =>
              onStyle?.({ ...s, cellPadding: Number(e.target.value) || 0 })
            }
          />

          <label style={{ fontSize: 12, color: "#475569" }}>Fondo</label>
          <input
            type="color"
            value={s.background ?? "#ffffff"}
            onChange={(e) => onStyle?.({ ...s, background: e.target.value })}
          />

          <label style={{ fontSize: 12, color: "#475569" }}>
            Borde (color / ancho / radio)
          </label>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 8,
            }}
          >
            <input
              type="color"
              value={s.borderColor ?? "#94a3b8"}
              onChange={(e) => onStyle?.({ ...s, borderColor: e.target.value })}
            />
            <input
              type="number"
              min={0}
              value={s.borderWidth ?? 1}
              onChange={(e) =>
                onStyle?.({ ...s, borderWidth: Number(e.target.value) || 0 })
              }
            />
            <input
              type="number"
              min={0}
              value={s.borderRadius ?? 6}
              onChange={(e) =>
                onStyle?.({ ...s, borderRadius: Number(e.target.value) || 0 })
              }
            />
          </div>

          <label style={{ fontSize: 12, color: "#475569" }}>Cabecera</label>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gap: 8,
              alignItems: "center",
            }}
          >
            <input
              type="checkbox"
              checked={!!el.table?.header}
              onChange={(e) =>
                onChange?.({
                  table: { ...(el.table || {}), header: e.target.checked },
                })
              }
            />
            <input
              type="color"
              value={s.headerBg ?? "#f1f5f9"}
              onChange={(e) => onStyle?.({ ...s, headerBg: e.target.value })}
              title="Fondo cabecera"
            />
          </div>

          <label style={{ fontSize: 12, color: "#475569" }}>
            Filas alternas
          </label>
          <input
            type="color"
            value={s.altRowBg ?? "#f8fafc"}
            onChange={(e) => onStyle?.({ ...s, altRowBg: e.target.value })}
            title="Fondo filas pares"
          />

          {/* Tipografía / alineación para la tabla */}
          <div
            style={{
              borderTop: "1px solid #e5e7eb",
              marginTop: 8,
              paddingTop: 8,
            }}
          >
            <label style={{ fontSize: 12, color: "#475569" }}>
              Texto (tabla)
            </label>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              <input
                type="color"
                value={s.color ?? "#111111"}
                onChange={(e) => onStyle?.({ ...s, color: e.target.value })}
                title="Color"
              />
              <input
                type="number"
                min={8}
                value={s.fontSize ?? 14}
                onChange={(e) =>
                  onStyle?.({ ...s, fontSize: Number(e.target.value) || 12 })
                }
                title="Tamaño"
              />
              <select
                value={s.fontFamily ?? ""}
                onChange={(e) =>
                  onStyle?.({ ...s, fontFamily: e.target.value || undefined })
                }
              >
                <option value="">System</option>
                <option value="Inter">Inter</option>
                <option value="Roboto">Roboto</option>
                <option value="Montserrat">Montserrat</option>
                <option value="serif">Serif</option>
                <option value="sans-serif">Sans-serif</option>
                <option value="monospace">Monospace</option>
              </select>
              <select
                value={s.fontWeight ?? "normal"}
                onChange={(e) =>
                  onStyle?.({ ...s, fontWeight: e.target.value })
                }
              >
                <option value="300">Light</option>
                <option value="normal">Regular</option>
                <option value="600">SemiBold</option>
                <option value="700">Bold</option>
              </select>
              <select
                value={s.fontStyle ?? "normal"}
                onChange={(e) => onStyle?.({ ...s, fontStyle: e.target.value })}
              >
                <option value="normal">Normal</option>
                <option value="italic">Italic</option>
              </select>
              <select
                value={s.textAlign ?? "left"}
                onChange={(e) => onStyle?.({ ...s, textAlign: e.target.value })}
              >
                <option value="left">Izquierda</option>
                <option value="center">Centro</option>
                <option value="right">Derecha</option>
                <option value="justify">Justificar</option>
              </select>
              <select
                value={s.vAlign ?? "top"}
                onChange={(e) => onStyle?.({ ...s, vAlign: e.target.value })}
              >
                <option value="top">Arriba</option>
                <option value="middle">Centro</option>
                <option value="bottom">Abajo</option>
              </select>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------ APP ------------------------------ */
function App() {
  const [size, setSize] = useState("letter");
  const [orientation, setOrientation] = useState("portrait");

  const [bgUrl, setBgUrl] = useState(null);
  const [bgFit, setBgFit] = useState("contain");

  const [elements, setElements] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const [activeTab, setActiveTab] = useState("order"); // order | props
  const [rightWidth, setRightWidth] = useState(() => {
    const v = Number(localStorage.getItem("inspectorWidth"));
    return Number.isFinite(v) && v > 0 ? v : 440;
  });
  const addTable = () => {
    const id = crypto.randomUUID();
    setElements((a) => [
      ...a,
      {
        id,
        type: "table",
        x: 80,
        y: 80,
        w: 520,
        h: 220,
        table: {
          rows: 3,
          cols: 4,
          data: Array.from({ length: 3 }, () =>
            Array.from({ length: 4 }, () => "")
          ),
          header: true,
        },
        style: {
          background: "#ffffff",
          borderColor: "#94a3b8",
          borderWidth: 1,
          borderRadius: 6,
          cellPadding: 6,
          textAlign: "left",
          vAlign: "top",
          fontFamily: undefined,
          fontSize: 14,
          color: "#111111",
          headerBg: "#f1f5f9",
          altRowBg: "#f8fafc",
        },
      },
    ]);
    setSelectedId(id);
  };

  useEffect(() => {
    localStorage.setItem("inspectorWidth", String(rightWidth));
  }, [rightWidth]);

  const startRef = useRef(null);
  const [resizing, setResizing] = useState(false);
  useEffect(() => {
    if (!resizing) return;
    const onMove = (e) =>
      setRightWidth(() =>
        clamp(
          startRef.current.w + (startRef.current.x - e.clientX),
          MIN_RIGHT,
          MAX_RIGHT
        )
      );
    const onUp = () => setResizing(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [resizing]);

  const sheetRef = useRef(null);
  const selectedEl = useMemo(
    () => elements.find((e) => e.id === selectedId) ?? null,
    [elements, selectedId]
  );

  const background = bgUrl
    ? `url(${bgUrl}) center/${bgFit} no-repeat, white`
    : "white";

  // helpers
  const changeEl = (id, patch) => {
    setElements((arr) =>
      arr.map((el) =>
        el.id === id
          ? {
              ...el,
              ...patch,
              style: patch.style
                ? { ...(el.style || {}), ...patch.style }
                : el.style,
            }
          : el
      )
    );
  };
  const delById = (id) => {
    setElements((a) => a.filter((e) => e.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const openPropsFor = (id) => {
    if (id) setSelectedId(id);
    setActiveTab("props");
  };

  const handleKeyDown = (e) => {
    const t = e.target;
    const isTyping =
      t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable;
    if (isTyping) return;
    if (e.key === "Backspace") {
      e.preventDefault(); // no borrar con backspace
      return;
    }
    if (e.key === "Delete" && selectedId) {
      e.preventDefault();
      delById(selectedId);
    }
  };

  // fondo
  useEffect(
    () => () => {
      if (bgUrl) URL.revokeObjectURL(bgUrl);
    },
    [bgUrl]
  );
  const pickBg = (f) => {
    if (!f) return;
    if (bgUrl) URL.revokeObjectURL(bgUrl);
    setBgUrl(URL.createObjectURL(f));
  };
  const clearBg = () => {
    if (bgUrl) URL.revokeObjectURL(bgUrl);
    setBgUrl(null);
  };

  // agregar elementos
  const addBox = () => {
    const id = crypto.randomUUID();
    setElements((a) => [
      ...a,
      {
        id,
        type: "box",
        x: 40,
        y: 40,
        w: 260,
        h: 80,
        text: "Cuadro",
        style: {
          borderColor: "#2563eb",
          borderWidth: 1,
          borderRadius: 10,
          background: "#fff",
          textAlign: "left",
          vAlign: "top",
          color: "#111",
          fontSize: 14,
        },
      },
    ]);
    setSelectedId(id);
  };

  const addText = () => {
    const id = crypto.randomUUID();
    setElements((a) => [
      ...a,
      {
        id,
        type: "text",
        x: 60,
        y: 150,
        w: 320,
        h: 40,
        text: "Doble clic y escribe…",
        style: {
          borderWidth: 0,
          background: "transparent",
          color: "#111",
          fontSize: 18,
          textAlign: "left",
          vAlign: "top",
        },
      },
    ]);
    setSelectedId(id);
  };

  const reorder = (from, to) =>
    setElements((arr) => {
      const copy = arr.slice();
      const [it] = copy.splice(from, 1);
      copy.splice(to, 0, it);
      return copy;
    });

  const renameEl = (id, label) =>
    setElements((arr) =>
      arr.map((el) => (el.id === id ? { ...el, label } : el))
    );

  const getIcon = (el) =>
    ({ box: "▭", text: "𝖳", image: "🖼️" }[el.type] ?? "•");
  const getLabel = (el) =>
    el.label ||
    (el.type === "text" ? "Texto" : el.type === "box" ? "Cuadro" : "Imagen");

  // colocar imagen
  const [placingImage, setPlacingImage] = useState(null);
  const fileToImageMeta = (file) =>
    new Promise((res) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () =>
        res({
          src: url,
          naturalW: img.naturalWidth,
          naturalH: img.naturalHeight,
        });
      img.src = url;
    });
  const startPlaceImageFromFile = async (file) => {
    const meta = await fileToImageMeta(file);
    setPlacingImage(meta);
  };
  const placeImageAt = (x, y) => {
    const meta = placingImage;
    if (!meta) return;

    const targetW = 300;
    const scale = meta.naturalW ? targetW / meta.naturalW : 1;
    const w = Math.max(80, Math.round(meta.naturalW * scale));
    const h = Math.max(60, Math.round(meta.naturalH * scale));
    const id = crypto.randomUUID();

    setElements((arr) => [
      ...arr,
      {
        id,
        type: "image",
        x: Math.max(0, Math.round(x - w / 2)),
        y: Math.max(0, Math.round(y - h / 2)),
        w,
        h,
        src: meta.src,
        style: {},
      },
    ]);
    setSelectedId(id);
    setPlacingImage(null);
  };
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && setPlacingImage(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{
        height: "100%",
        width: "100%",
        display: "grid",
        gridTemplateColumns: `minmax(0,1fr) 6px ${rightWidth}px`,
        gridTemplateRows: "auto 1fr",
        background: WORK_BG,
        overflow: "hidden",
      }}
    >
      {/* Toolbar */}
      <div style={{ gridColumn: "1 / 2", gridRow: "1 / 2" }}>
        <Toolbar
          maxWorkWidth={WORKAREA_MAX_WIDTH}
          left={
            <>
              <BackgroundTool
                compact
                onPickFile={pickBg}
                onClear={clearBg}
                hasBackground={!!bgUrl}
                fit={bgFit}
                onChangeFit={setBgFit}
              />
              <BoxesTool compact onAddBox={addBox} onAddText={addText} />
              <ImageTool compact onPickForPlacement={startPlaceImageFromFile} />
              <SizeTool
                compact
                size={size}
                orientation={orientation}
                onSize={setSize}
                onOrientation={setOrientation}
              />
              <button
                onClick={addTable}
                title="Insertar tabla"
                style={{
                  padding: "6px 10px",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  background: "#fff",
                }}
              >
                ▦ Tabla
              </button>
              <ExportTool
                getTarget={() => sheetRef.current}
                size={size}
                orientation={orientation}
              />
            </>
          }
        />
      </div>

      {/* Hoja */}
      <div
        style={{
          gridColumn: "1 / 2",
          gridRow: "2 / 3",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "16px 24px",
          gap: 16,
        }}
      >
        <div
          style={{
            flex: 1,
            width: "100%",
            maxWidth: WORKAREA_MAX_WIDTH,
            display: "flex",
            justifyContent: "center",
            overflow: "auto",
          }}
        >
          <PaperCanvas
            ref={sheetRef}
            size={size}
            orientation={orientation}
            autoFit
            padding={0}
            background={background}
            style={{
              border: "none",
              boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
              borderRadius: 8,
            }}
          >
            <WorkLayer
              elements={elements}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onChange={(id, patch) => changeEl(id, patch)}
              placing={!!placingImage}
              onPlaceAt={(x, y) => placeImageAt(x, y)}
              onOpenProps={openPropsFor}
            />
          </PaperCanvas>
        </div>
      </div>

      {/* Resizer */}
      <div
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          startRef.current = { x: e.clientX, w: rightWidth };
          setResizing(true);
        }}
        onDoubleClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const presets = [420, 520, 640];
          const next = presets.find((t) => t > rightWidth) ?? presets[0];
          setRightWidth(next);
        }}
        style={{
          gridColumn: "2 / 3",
          gridRow: "1 / 3",
          cursor: "col-resize",
          userSelect: "none",
        }}
        title="Arrastra para redimensionar"
      />

      {/* Panel derecho */}
      <aside
        style={{
          gridColumn: "3 / 4",
          gridRow: "1 / 3",
          display: "flex",
          flexDirection: "column",
          width: "100%",
          minWidth: MIN_RIGHT,
          maxWidth: MAX_RIGHT,
          background: "#fff",
          padding: 12,
          boxShadow: "inset 1px 0 0 #e5e7eb",
        }}
      >
        <div
          role="tablist"
          aria-label="Inspector"
          style={{
            display: "flex",
            gap: 6,
            borderBottom: "1px solid #e5e7eb",
            paddingBottom: 6,
            marginBottom: 8,
          }}
        >
          <button
            role="tab"
            aria-selected={activeTab === "order"}
            onClick={() => setActiveTab("order")}
            style={{
              padding: "6px 10px",
              border: "1px solid #e5e7eb",
              borderBottomColor: activeTab === "order" ? "#fff" : "#e5e7eb",
              borderRadius: "8px 8px 0 0",
              background: activeTab === "order" ? "#fff" : "#f8fafc",
              fontWeight: 600,
            }}
          >
            Orden
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "props"}
            onClick={() => setActiveTab("props")}
            style={{
              padding: "6px 10px",
              border: "1px solid #e5e7eb",
              borderBottomColor: activeTab === "props" ? "#fff" : "#e5e7eb",
              borderRadius: "8px 8px 0 0",
              background: activeTab === "props" ? "#fff" : "#f8fafc",
              fontWeight: 600,
            }}
          >
            Propiedades
          </button>
        </div>

        <div
          role="tabpanel"
          hidden={activeTab !== "order"}
          style={{ flex: 1, overflow: "auto" }}
        >
          <OrderList
            items={elements}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onReorder={reorder}
            onRename={renameEl}
            getIcon={getIcon}
            getLabel={getLabel}
          />
        </div>

        <div
          role="tabpanel"
          hidden={activeTab !== "props"}
          style={{ flex: 1, overflow: "auto" }}
        >
          <PropertiesPanel
            el={selectedEl}
            onRename={(name) => selectedId && renameEl(selectedId, name)}
            onChange={(patch) => selectedId && changeEl(selectedId, patch)}
            onStyle={(style) => selectedId && changeEl(selectedId, { style })}
          />
        </div>
      </aside>
    </div>
  );
}

export default App;
