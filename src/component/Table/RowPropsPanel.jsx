"use client";

export default function RowPropsPanel({ selectedId, elements, onChange }) {
  // ¿Hay fila seleccionada con id virtual "tablaId::row:i"?
  const m =
    typeof selectedId === "string" && selectedId.match(/^(.+)::row:(\d+)$/);
  if (!m) return null;

  const tableId = m[1];
  const rowIndex = Number(m[2]);

  const tableEl = elements.find((e) => e.id === tableId);
  if (!tableEl || tableEl.type !== "table") return null;

  const t = tableEl.table || {};
  const totalRows = Math.max(1, Number(t.rows) || 1);
  const rowHeights = Array.from({ length: totalRows }, (_, i) =>
    Number(t.rowHeights?.[i] ?? 0)
  );
  const rowProps = (t.rowProps || []).slice(); // clonar

  const curH = rowHeights[rowIndex] ?? 0;
  const curBg = rowProps[rowIndex]?.bg || "";
  const curHidden = !!rowProps[rowIndex]?.hidden;
  const curTag = rowProps[rowIndex]?.tag || "";

  const patchTable = (patch) =>
    onChange(tableId, { table: { ...t, ...patch } });

  const setHeight = (px) => {
    const next = rowHeights.slice();
    const val = Math.max(0, Math.round(Number(px) || 0));
    next[rowIndex] = val;
    patchTable({ rowHeights: next });
  };

  const setBg = (color) => {
    const rp = rowProps.slice();
    rp[rowIndex] = { ...(rp[rowIndex] || {}), bg: color || undefined };
    patchTable({ rowProps: rp });
  };

  const setHidden = (flag) => {
    const rp = rowProps.slice();
    rp[rowIndex] = { ...(rp[rowIndex] || {}), hidden: !!flag };
    patchTable({ rowProps: rp });
  };

  const setTag = (txt) => {
    const rp = rowProps.slice();
    rp[rowIndex] = { ...(rp[rowIndex] || {}), tag: txt || undefined };
    patchTable({ rowProps: rp });
  };

  return (
    <div style={{ padding: 12, borderTop: "1px solid #e5e7eb" }}>
      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>
        Propiedades de la fila <b>{rowIndex + 1}</b>
      </div>

      <label style={{ display: "block", fontSize: 12, margin: "6px 0 2px" }}>
        Alto (px)
      </label>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input
          type="number"
          min={0}
          value={curH}
          onChange={(e) => setHeight(e.target.value)}
          style={{ width: 90 }}
        />
        {[0, 12, 16, 24, 28, 32, 40].map((v) => (
          <button
            key={v}
            onClick={() => setHeight(v)}
            style={{
              padding: "4px 8px",
              border: "1px solid #e5e7eb",
              borderRadius: 6,
              background: "#fff",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            {v}
          </button>
        ))}
      </div>

      <label style={{ display: "block", fontSize: 12, margin: "10px 0 2px" }}>
        Fondo
      </label>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input
          type="color"
          value={curBg || "#ffffff"}
          onChange={(e) => setBg(e.target.value)}
          style={{ width: 40, height: 24, padding: 0, border: "none" }}
        />
        <button
          onClick={() => setBg("")}
          style={{
            padding: "4px 8px",
            border: "1px solid #e5e7eb",
            borderRadius: 6,
            background: "#fff",
            cursor: "pointer",
            fontSize: 12,
          }}
          title="Quitar color"
        >
          Quitar
        </button>
      </div>

      <label style={{ display: "block", fontSize: 12, margin: "10px 0 2px" }}>
        Etiqueta
      </label>
      <input
        type="text"
        value={curTag}
        onChange={(e) => setTag(e.target.value)}
        placeholder="Opcional (ej: subtotal, nota, etc.)"
        style={{ width: "100%" }}
      />

      <label
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          marginTop: 10,
          fontSize: 13,
        }}
      >
        <input
          type="checkbox"
          checked={curHidden}
          onChange={(e) => setHidden(e.target.checked)}
        />
        Ocultar fila
      </label>
    </div>
  );
}
