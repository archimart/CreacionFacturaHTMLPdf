/**
 * Lista de orden genérica con DnD.
 * props:
 * - items, selectedId, onSelect(id)
 * - onReorder(fromIndex, toIndex)
 * - getIcon(item), getLabel(item), onRename(id, label)
 * - exclude?(item) => boolean
 */
import { useMemo, useState } from "react";

export default function OrderList({
  items = [],
  selectedId,
  onSelect,
  onReorder,
  getIcon,
  getLabel,
  onRename,
  exclude,
}) {
  // Lista visual: solo raíces (sin parentId) y en el orden que ve el usuario: z alto arriba
  const rootsUI = useMemo(() => {
    let src = exclude ? items.filter((it) => !exclude(it)) : items;
    src = src.filter((it) => !it.parentId); // ← solo raíces
    return src.slice().sort((a, b) => (b.z ?? 0) - (a.z ?? 0)); // ← por z desc
  }, [items, exclude]);

  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);

  const onDragStart = (idx) => (e) => {
    setDragIdx(idx);
    e.dataTransfer.setData("text/plain", String(idx)); // por si el browser lo usa
    e.dataTransfer.effectAllowed = "move";
  };
  const onDragOver = (idx) => (e) => {
    e.preventDefault();
    setOverIdx(idx);
  };
  const onDrop = (idx) => (e) => {
    e.preventDefault();
    const from = dragIdx ?? Number(e.dataTransfer.getData("text/plain"));
    if (Number.isInteger(from) && from !== idx) onReorder?.(from, idx); // ← índices UI
    setDragIdx(null);
    setOverIdx(null);
  };

  const n = rootsUI.length;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        height: "100%",
        overflow: "auto",
      }}
    >
      {rootsUI.map((el, idx) => {
        const selected = selectedId === el.id;
        const over = overIdx === idx;
        const icon = getIcon?.(el);
        const label = getLabel?.(el) ?? "";
        const rank = n - idx; // para mostrar "z 3/3" en el primero

        return (
          <div
            key={el.id}
            draggable
            onDragStart={onDragStart(idx)}
            onDragOver={onDragOver(idx)}
            onDrop={onDrop(idx)}
            onDragEnd={() => {
              setDragIdx(null);
              setOverIdx(null);
            }}
            onClick={() => onSelect?.(el.id)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: 10,
              borderRadius: 12,
              border: selected ? "2px solid #2563eb" : "1px solid #e5e7eb",
              background: over ? "#f0f9ff" : "#fff",
              boxShadow: over ? "inset 0 0 0 1px #38bdf8" : "none",
              cursor: "grab",
              overflow: "hidden",
            }}
          >
            <div style={{ width: 20, textAlign: "center" }}>☰</div>
            <div style={{ width: 24, textAlign: "center" }}>{icon}</div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                flex: 1,
                minWidth: 0,
              }}
            >
              <input
                value={label}
                onChange={(e) => onRename?.(el.id, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Backspace" || e.key === "Delete") {
                    e.stopPropagation();
                  }
                }}
                placeholder="Sin nombre"
                style={{
                  width: "100%",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#0f172a",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  padding: "4px 6px",
                  outline: "none",
                }}
              />
              <div
                style={{
                  fontSize: 11,
                  color: "#64748b",
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                  overflow: "hidden",
                }}
              >
                {el.w}×{el.h}px @ ({el.x},{el.y})
              </div>
            </div>

            <div
              style={{
                height: 28,
                padding: "0 10px",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                background: "#f8fafc",
                display: "flex",
                alignItems: "center",
              }}
            >
              z {rank}/{n}
            </div>
          </div>
        );
      })}
      {!n && (
        <div style={{ fontSize: 12, color: "#64748b" }}>
          No hay elementos que mostrar.
        </div>
      )}
    </div>
  );
}
