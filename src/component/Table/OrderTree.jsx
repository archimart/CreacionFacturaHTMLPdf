"use client";
import { useMemo } from "react";

export default function OrderTree({
  items = [],
  selectedId,
  onSelect,
  getIcon,
  getLabel,
}) {
  const byParent = useMemo(() => {
    const m = new Map();
    for (const it of items) {
      const p = it.parentId ?? null;
      if (!m.has(p)) m.set(p, []);
      m.get(p).push(it);
    }
    // ordenar: filas por índice asc; el resto por z desc
    for (const arr of m.values()) {
      arr.sort((a, b) => {
        const ar = a.type === "table-row";
        const br = b.type === "table-row";
        if (ar && br) return (a.meta?.rowIndex ?? 0) - (b.meta?.rowIndex ?? 0);
        if (ar && !br) return 1;
        if (!ar && br) return -1;
        return (b.z ?? 0) - (a.z ?? 0);
      });
    }
    return m;
  }, [items]);

  const roots = byParent.get(null) || [];

  const defIcon = (el) =>
    el.type === "table"
      ? "▦"
      : el.type === "table-row"
      ? "↳"
      : el.type === "text"
      ? "𝖳"
      : el.type === "image"
      ? "🖼️"
      : el.type === "box"
      ? "▭"
      : "•";

  const defLabel = (el) =>
    el.type === "table-row"
      ? `Fila ${(el.meta?.rowIndex ?? 0) + 1}`
      : el.label ||
        (el.type === "table"
          ? "Tabla"
          : el.type === "box"
          ? "Cuadro"
          : el.type === "text"
          ? "Texto"
          : el.type === "image"
          ? "Imagen"
          : "Elemento");

  const renderBranch = (el, depth) => (
    <div key={el.id} style={{ marginBottom: 6 }}>
      <div
        onClick={() => onSelect?.(el.id)}
        title={el.id}
        style={{
          marginLeft: depth * 14,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: 8,
          borderRadius: 10,
          border:
            selectedId === el.id ? "2px solid #2563eb" : "1px solid #e5e7eb",
          background: "#fff",
          cursor: "pointer",
        }}
      >
        <div style={{ width: 22, textAlign: "center" }}>
          {(getIcon || defIcon)(el)}
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
          {(getLabel || defLabel)(el)}
        </div>
      </div>

      {(byParent.get(el.id) || []).map((ch) => renderBranch(ch, depth + 1))}
    </div>
  );

  return roots.length ? (
    <div style={{ display: "block" }}>
      {roots.map((el) => renderBranch(el, 0))}
    </div>
  ) : (
    <div style={{ fontSize: 12, color: "#64748b" }}>
      No hay elementos que mostrar.
    </div>
  );
}
