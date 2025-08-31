import React, { useMemo, useState } from "react";

/**
 * Lista de orden genérica con DnD.
 * props:
 * - items, selectedId, onSelect(id)
 * - onReorder(fromIndex, toIndex)
 * - getIcon(item), getLabel(item), onRename(id, label)
 * - exclude?(item) => boolean
 */
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
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const view = useMemo(() => {
    const src = exclude ? items.filter((it) => !exclude(it)) : items;
    return src.map((el) => ({ el, realIndex: items.indexOf(el) })).reverse();
  }, [items, exclude]);

  const dragStart = (realIndex) => (e) => {
    e.dataTransfer.setData("text/plain", String(realIndex));
    e.dataTransfer.effectAllowed = "move";
  };
  const dragOver = (realIndex) => (e) => {
    e.preventDefault();
    setDragOverIndex(realIndex);
  };
  const drop = (targetRealIndex) => (e) => {
    e.preventDefault();
    const from = Number(e.dataTransfer.getData("text/plain"));
    if (Number.isInteger(from) && from !== targetRealIndex)
      onReorder?.(from, targetRealIndex);
    setDragOverIndex(null);
  };

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
      {view.map(({ el, realIndex }) => {
        const selected = selectedId === el.id;
        const over = dragOverIndex === realIndex;
        const icon = getIcon?.(el);
        const label = getLabel?.(el) ?? "";

        return (
          <div
            key={el.id}
            draggable
            onDragStart={dragStart(realIndex)}
            onDragOver={dragOver(realIndex)}
            onDrop={drop(realIndex)}
            onDragEnd={() => setDragOverIndex(null)}
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
                    e.stopPropagation(); // evita que llegue al handler global
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
              z {realIndex + 1}/{items.length}
            </div>
          </div>
        );
      })}
      {!view.length && (
        <div style={{ fontSize: 12, color: "#64748b" }}>
          No hay elementos que mostrar.
        </div>
      )}
    </div>
  );
}
