// WorkLayer.jsx
import { useRef, useState, useMemo } from "react";
import TableRenderer from "./Table/TableRenderer";

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export default function WorkLayer({
  elements,
  selectedId,
  onSelect,
  onChange,
  placing = false,
  onPlaceAt,
  onOpenProps,
}) {
  const layerRef = useRef(null);
  const [editingId, setEditingId] = useState(null);

  const [editingCell, setEditingCell] = useState(null);
  const [draggingId, setDraggingId] = useState(null); // ID que estoy arrastrando
  const [hoverContainerId, setHoverContainerId] = useState(null); // box candidato
  const byZ = (a, b) => (a.z ?? 0) - (b.z ?? 0);
  // ★ mapa por id para cálculos rápidos
  const byId = useMemo(() => {
    const m = new Map();
    for (const e of elements) m.set(e.id, e);
    return m;
  }, [elements]);

  // ★ un "box" será contenedor (puedes añadir "table" si quieres)
  const isContainer = (el) => el?.type === "box" || el?.type === "table";

  const getAbsRect = (el) => {
    if (!el) return { left: 0, top: 0, w: 0, h: 0 };
    let left = el.x ?? 0,
      top = el.y ?? 0;
    let p = el.parentId ? byId.get(el.parentId) : null;
    while (p) {
      left += p.x ?? 0;
      top += p.y ?? 0;
      p = p.parentId ? byId.get(p.parentId) : null;
    }
    return { left, top, w: el.w ?? 10, h: el.h ?? 10 };
  };

  const pointInRect = (x, y, r) =>
    x >= r.left && x <= r.left + r.w && y >= r.top && y <= r.top + r.h;

  const isDescendant = (childId, parentId) => {
    let p = byId.get(childId)?.parentId;
    while (p) {
      if (p === parentId) return true;
      p = byId.get(p)?.parentId;
    }
    return false;
  };
  // ★ clamp ahora usa el tamaño del contenedor si existe
  const onChangeClamped = (id, patch) => {
    const el = byId.get(id);
    const host = layerRef.current;
    if (!el || !host) {
      onChange(id, patch);
      return;
    }

    // límites: capa o padre
    const parent = el.parentId ? byId.get(el.parentId) : null;
    const boundW = parent ? parent.w ?? host.clientWidth : host.clientWidth;
    const boundH = parent ? parent.h ?? host.clientHeight : host.clientHeight;

    const x0 = el.x ?? 0,
      y0 = el.y ?? 0;
    const w0 = el.w ?? 10,
      h0 = el.h ?? 10;

    const xTry = patch.x !== undefined ? patch.x : x0;
    const yTry = patch.y !== undefined ? patch.y : y0;
    const wTry = patch.w !== undefined ? patch.w : w0;
    const hTry = patch.h !== undefined ? patch.h : h0;

    let w = clamp(wTry, 10, boundW);
    let h = clamp(hTry, 10, boundH);
    let x = clamp(xTry, 0, Math.max(0, boundW - w));
    let y = clamp(yTry, 0, Math.max(0, boundH - h));
    w = clamp(w, 10, boundW - x);
    h = clamp(h, 10, boundH - y);

    onChange(id, {
      x,
      y,
      w,
      h,
      ...(patch.style ? { style: patch.style } : {}),
      ...(patch.parentId !== undefined ? { parentId: patch.parentId } : {}),
    });
  };

  // ---- drag & drop con adopción por contenedor ----
  const startDrag = (e, el) => {
    if (editingId || editingCell) return;
    e.stopPropagation();
    onSelect?.(el.id);
    setDraggingId(el.id); // ← empezamos a arrastrar

    const startX = e.clientX,
      startY = e.clientY;
    const startAbs = getAbsRect(el);
    const sx = el.x ?? 0,
      sy = el.y ?? 0;

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      onChangeClamped(el.id, { x: sx + dx, y: sy + dy });

      // ← detectar contenedor candidato y dibujar highlight
      const host = layerRef.current;
      const hostRect = host.getBoundingClientRect();
      const mx = ev.clientX - hostRect.left;
      const my = ev.clientY - hostRect.top;

      let candidate = null;
      for (let i = elements.length - 1; i >= 0; i--) {
        const cand = elements[i];
        if (!isContainer(cand)) continue;
        if (cand.id === el.id) continue;
        if (isDescendant(cand.id, el.id)) continue; // evitar ciclos
        const R = getAbsRect(cand);
        if (pointInRect(mx, my, R)) {
          candidate = cand;
          break;
        }
      }
      setHoverContainerId(candidate?.id ?? null);
    };

    const onUp = (ev) => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);

      // posición absoluta final
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const finalAbsLeft = startAbs.left + dx;
      const finalAbsTop = startAbs.top + dy;

      // target final (el que quedó highlight)
      const targetId = hoverContainerId;
      setDraggingId(null); // ← limpiar estados
      setHoverContainerId(null);

      if (targetId) {
        const target = byId.get(targetId);
        const PR = getAbsRect(target);
        const relX = clamp(
          finalAbsLeft - PR.left,
          0,
          (target.w ?? 10) - (el.w ?? 10)
        );
        const relY = clamp(
          finalAbsTop - PR.top,
          0,
          (target.h ?? 10) - (el.h ?? 10)
        );
        onChange(el.id, { x: relX, y: relY, parentId: target.id });
      } else if (el.parentId) {
        // soltar a raíz: pasar a coords absolutas
        onChange(el.id, {
          x: finalAbsLeft,
          y: finalAbsTop,
          parentId: undefined,
        });
      }
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const startResize = (e, el) => {
    if (editingId || editingCell) return;
    e.stopPropagation();
    onSelect?.(el.id);

    const startX = e.clientX,
      startY = e.clientY;
    const sw = el.w ?? 10,
      sh = el.h ?? 10;

    const onMove = (ev) => {
      const dw = ev.clientX - startX;
      const dh = ev.clientY - startY;
      onChangeClamped(el.id, { w: sw + dw, h: sh + dh });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const handleAreaClick = (e) => {
    const host = layerRef.current;
    if (!host) return;

    if (placing && onPlaceAt) {
      const rect = host.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const cx = clamp(x, 0, host.clientWidth);
      const cy = clamp(y, 0, host.clientHeight);
      onPlaceAt(cx, cy);
      return;
    }
    if (!editingId && !editingCell) onSelect?.(null);
  };

  const ensureMatrix = (rows, cols, data = []) =>
    Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => data[r]?.[c] ?? "")
    );

  const changeCell = (el, r, c, value) => {
    const t = el.table || { rows: 1, cols: 1, data: [[""]] };
    const data = ensureMatrix(t.rows, t.cols, t.data).map((row) => row.slice());
    data[r][c] = value;
    onChange(el.id, { table: { ...t, data } });
  };

  // ---------- RENDER RECURSIVO (padres → hijos) ----------
  const renderNode = (el) => {
    const isSel = el.id === selectedId;
    const isTbl = el.type === "table";
    const isImg = el.type === "image";
    const isEditing = editingId === el.id;
    const s = el.style || {};
    const isDropTarget =
      isContainer(el) &&
      hoverContainerId === el.id &&
      draggingId &&
      draggingId !== el.id &&
      !isDescendant(el.id, draggingId);
    const frame = {
      position: "absolute",
      left: el.x ?? 0,
      top: el.y ?? 0,
      width: el.w ?? 10,
      height: el.h ?? 10,
      zIndex: el.z ?? 0, // ★ esto asegura el apilamiento visual
      outline: isDropTarget ? "2px dashed #2563eb" : "none",
      outlineOffset: -2,
    };

    if (isTbl) {
      return (
        <div key={el.id} style={frame}>
          <div
            className="tbl-wrapper"
            onMouseDown={(e) => {
              const insideTable = e.target?.closest?.("table");
              const forceMove = e.altKey || e.ctrlKey || e.metaKey;
              if (insideTable && !forceMove) {
                return;
              }
              if (!editingCell) startDrag(e, el);
            }}
            onDragStart={(e) => e.preventDefault()}
            title="Arrastra con ALT/CTRL/⌘ para mover la tabla (o usa el cuadrito azul)"
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
              cursor: editingCell ? "text" : "move",
              background: "transparent",
              borderRadius: s.borderRadius ?? 6,
              overflow: "visible",
            }}
          >
            <div
              style={{
                position: "relative",
                width: "100%",
                height: "100%",
                overflow: "visible",
              }}
            >
              <TableRenderer
                el={el}
                onSelect={onSelect}
                onOpenProps={onOpenProps}
                editingCell={editingCell}
                setEditingCell={setEditingCell}
                onChangeCell={(r, c, value) => changeCell(el, r, c, value)}
                onChangeTable={(patch) =>
                  onChange(el.id, { table: { ...el.table, ...patch } })
                }
                onRequestMove={(ev) => startDrag(ev, el)}
                isSelected={selectedId === el.id} // ← NUEVO
              />
            </div>
            {isSel && !editingCell && (
              <div
                className="tbl-handle"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  startDrag(e, el);
                }}
                title="Mover tabla"
                style={{
                  position: "absolute",
                  left: 6,
                  top: 6,
                  width: 14,
                  height: 14,
                  borderRadius: 4,
                  background: "rgba(37,99,235,0.95)",
                  cursor: "move",
                  boxShadow: "0 0 0 2px rgba(255,255,255,0.9)",
                  zIndex: 10000,
                }}
              />
            )}
          </div>

          {isSel && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: s.borderRadius ?? 6,
                boxShadow: "0 0 0 2px #2563eb",
                pointerEvents: "none",
              }}
            />
          )}
          {!editingCell && (
            <div
              onMouseDown={(e) => startResize(e, el)}
              title="Redimensionar"
              style={{
                position: "absolute",
                right: -6,
                bottom: -6,
                width: 12,
                height: 12,
                borderRadius: 6,
                background: isSel ? "#2563eb" : "transparent",
                cursor: "nwse-resize",
              }}
            />
          )}

          {elements
            .filter((ch) => ch.parentId === el.id)
            .slice()
            .sort(byZ)
            .map((ch) => renderNode(ch))}
        </div>
      );
    }

    // IMG / TEXT / BOX
    const dragArea = {
      width: "100%",
      height: "100%",
      boxSizing: "border-box",
      cursor: isEditing || editingCell ? "text" : "move",
      display: "flex",
      alignItems:
        (s.vAlign ?? "top") === "middle"
          ? "center"
          : (s.vAlign ?? "top") === "bottom"
          ? "flex-end"
          : "flex-start",
      justifyContent:
        (s.textAlign ?? "left") === "center"
          ? "center"
          : (s.textAlign ?? "left") === "right"
          ? "flex-end"
          : (s.textAlign ?? "left") === "justify"
          ? "stretch"
          : "flex-start",
      background: "transparent",
      padding: 0,
      position: "relative",
      overflow: isContainer(el) ? "hidden" : "visible",
      borderRadius: isContainer(el) ? s.borderRadius ?? 10 : undefined,
    };

    const textBase = {
      color: s.color ?? "#111",
      fontSize: s.fontSize ?? (el.type === "text" ? 18 : 14),
      fontFamily: s.fontFamily,
      fontWeight: s.fontWeight,
      fontStyle: s.fontStyle,
      lineHeight: 1.35,
      textAlign:
        (s.textAlign ?? "left") === "justify"
          ? "justify"
          : s.textAlign ?? "left",
    };

    return (
      <div key={el.id} style={frame}>
        <div
          onMouseDown={(e) => !isEditing && !editingCell && startDrag(e, el)}
          style={dragArea}
        >
          {isImg && (
            <img
              src={el.src}
              alt=""
              draggable={false}
              style={{
                width: "100%",
                height: "100%",
                objectFit: s.fit ?? "contain",
                objectPosition: s.objectPosition ?? "center",
                display: "block",
                pointerEvents: "none",
              }}
            />
          )}

          {isImg ? null : el.type === "text" ? (
            <div
              onDoubleClick={(e) => {
                e.stopPropagation();
                onOpenProps?.(el.id);
              }}
              style={{
                position: "relative",
                width: "100%",
                height: "100%",
                padding: 8,
                backgroundColor: s.background ?? "transparent",
                color: textBase.color,
                fontSize: textBase.fontSize,
                fontFamily: textBase.fontFamily,
                fontWeight: textBase.fontWeight,
                fontStyle: textBase.fontStyle,
                lineHeight: textBase.lineHeight,
                textAlign: textBase.textAlign,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                overflowWrap: "anywhere",
                backgroundImage: s.backgroundImageUrl
                  ? `url(${s.backgroundImageUrl})`
                  : undefined,
                backgroundSize: s.backgroundImageFit ?? "contain",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }}
            >
              {el.text ?? "Doble clic y escribe…"}
            </div>
          ) : el.type === "box" ? (
            <div
              onDoubleClick={(e) => {
                e.stopPropagation();
                onOpenProps?.(el.id);
              }}
              style={{
                position: "relative",
                inset: 0,
                width: "100%",
                height: "100%",
                boxSizing: "border-box",
                padding: 8,
                background: s.background ?? "#fff",
                border: `${Number(s.borderWidth ?? 1)}px solid ${
                  s.borderColor ?? "#94a3b8"
                }`,
                borderRadius: Number(s.borderRadius ?? 10),
                color: textBase.color,
                fontSize: textBase.fontSize,
                fontFamily: textBase.fontFamily,
                fontWeight: textBase.fontWeight,
                fontStyle: textBase.fontStyle,
                lineHeight: textBase.lineHeight,
                textAlign: textBase.textAlign,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                overflowWrap: "anywhere",
                backgroundImage: s.backgroundImageUrl
                  ? `url(${s.backgroundImageUrl})`
                  : undefined,
                backgroundSize: s.backgroundImageFit ?? "contain",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
                zIndex: 10,
              }}
            >
              {el.text ?? "Cuadro"}
            </div>
          ) : null}

          {/* hijos dentro del contenedor (para box) */}
          {elements
            .filter((ch) => ch.parentId === el.id)
            .map((ch) => renderNode(ch))}
        </div>

        {isSel && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: el.type === "image" ? s.borderRadius ?? 0 : 10,
              boxShadow: "0 0 0 2px #2563eb",
              pointerEvents: "none",
            }}
          />
        )}

        {!isEditing && !editingCell && (
          <div
            onMouseDown={(e) => startResize(e, el)}
            title="Redimensionar"
            style={{
              position: "absolute",
              right: -6,
              bottom: -6,
              width: 12,
              height: 12,
              borderRadius: 6,
              background: selectedId === el.id ? "#2563eb" : "transparent",
              cursor: "nwse-resize",
            }}
          />
        )}
      </div>
    );
  };

  // ★ solo renderizamos raíces; los hijos los pinta cada padre
  const roots = useMemo(() => elements.filter((e) => !e.parentId), [elements]);
  return (
    <div
      ref={layerRef}
      onMouseDown={(e) => {
        const tag = (e.target?.tagName || "").toUpperCase();
        if (
          tag !== "TEXTAREA" &&
          tag !== "INPUT" &&
          !e.target?.isContentEditable
        ) {
          e.stopPropagation();
        }
      }}
      onClick={handleAreaClick}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        userSelect: "none",
        cursor: placing ? "crosshair" : "default",
      }}
      data-layer="work"
    >
      {roots.map((el) => renderNode(el))}
    </div>
  );
}
