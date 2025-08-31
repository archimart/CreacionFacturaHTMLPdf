// src/component/WorkLayer.jsx
import { useRef, useLayoutEffect, useState, useEffect } from "react";

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
  const [editingId, setEditingId] = useState(null); // edito text/box
  const [editingCell, setEditingCell] = useState(null); // {id,r,c} para tabla

  const onChangeClamped = (id, patch) => {
    const el = elements.find((e) => e.id === id);
    const host = layerRef.current;
    if (!el || !host) {
      onChange(id, patch);
      return;
    }
    const bw = host.clientWidth;
    const bh = host.clientHeight;

    const x0 = el.x ?? 0,
      y0 = el.y ?? 0;
    const w0 = el.w ?? 10,
      h0 = el.h ?? 10;

    const xTry = patch.x !== undefined ? patch.x : x0;
    const yTry = patch.y !== undefined ? patch.y : y0;
    const wTry = patch.w !== undefined ? patch.w : w0;
    const hTry = patch.h !== undefined ? patch.h : h0;

    let w = clamp(wTry, 10, bw);
    let h = clamp(hTry, 10, bh);
    let x = clamp(xTry, 0, Math.max(0, bw - w));
    let y = clamp(yTry, 0, Math.max(0, bh - h));
    w = clamp(w, 10, bw - x);
    h = clamp(h, 10, bh - y);

    onChange(id, {
      x,
      y,
      w,
      h,
      ...(patch.style ? { style: patch.style } : {}),
    });
  };

  const startDrag = (e, el) => {
    if (editingId || editingCell) return;
    e.stopPropagation();
    onSelect?.(el.id);

    const startX = e.clientX,
      startY = e.clientY;
    const sx = el.x ?? 0,
      sy = el.y ?? 0;

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      onChangeClamped(el.id, { x: sx + dx, y: sy + dy });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
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

  useLayoutEffect(() => {
    const host = layerRef.current;
    if (!host) return;

    const apply = () => {
      const bw = host.clientWidth;
      const bh = host.clientHeight;
      elements.forEach((el) => {
        const x = clamp(el.x ?? 0, 0, Math.max(0, bw - (el.w ?? 10)));
        const y = clamp(el.y ?? 0, 0, Math.max(0, bh - (el.h ?? 10)));
        const w = clamp(el.w ?? 10, 10, bw - x);
        const h = clamp(el.h ?? 10, 10, bh - y);
        if (x !== el.x || y !== el.y || w !== el.w || h !== el.h) {
          onChange(el.id, { x, y, w, h });
        }
      });
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(host);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elements]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        setEditingId(null);
        setEditingCell(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // -------- helpers tabla --------
  const ensureMatrix = (rows, cols, data = []) => {
    const out = Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => data[r]?.[c] ?? "")
    );
    return out;
  };

  const changeCell = (el, r, c, value) => {
    const t = el.table || { rows: 1, cols: 1, data: [[""]] };
    const data = ensureMatrix(t.rows, t.cols, t.data).map((row) => row.slice());
    data[r][c] = value;
    onChange(el.id, { table: { ...t, data } });
  };

  // -------- render --------
  return (
    <div
      ref={layerRef}
      onMouseDown={(e) => e.stopPropagation()}
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
      {elements.map((el) => {
        const isSel = el.id === selectedId;
        const isImg = el.type === "image";
        const isTbl = el.type === "table";
        const isEditing = editingId === el.id;
        const s = el.style || {};

        const beginEdit = (e) => {
          e.stopPropagation();
          if (el.type === "text" || el.type === "box") {
            setEditingId(el.id);
            onSelect?.(el.id);
            onOpenProps?.(el.id);
          }
        };

        const frame = {
          position: "absolute",
          left: el.x ?? 0,
          top: el.y ?? 0,
          width: el.w ?? 10,
          height: el.h ?? 10,
        };

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

          background:
            el.type === "box" || isTbl ? s.background ?? "#fff" : "transparent",
          border:
            el.type === "box" || isTbl
              ? `${s.borderWidth ?? 1}px solid ${s.borderColor ?? "#94a3b8"}`
              : "none",
          borderRadius:
            el.type === "box"
              ? s.borderRadius ?? 10
              : el.type === "image"
              ? s.borderRadius ?? 0
              : isTbl
              ? s.borderRadius ?? 6
              : 0,

          opacity: s.opacity ?? 1,
          overflow:
            el.type === "image"
              ? (s.borderRadius ?? 0) > 0
                ? "hidden"
                : "visible"
              : "hidden",

          padding: el.type === "text" ? "4px 6px" : 0,
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

        // --- render por tipo ---
        return (
          <div key={el.id} style={frame}>
            <div
              onMouseDown={(e) =>
                !isEditing && !editingCell && startDrag(e, el)
              }
              style={dragArea}
            >
              {/* Imagen */}
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

              {/* Texto / Cuadro */}
              {(el.type === "box" || el.type === "text") && !isEditing && (
                <div
                  onDoubleClick={beginEdit}
                  style={{
                    width: "100%",
                    height: "100%",
                    userSelect: "none",
                    ...textBase,
                  }}
                >
                  {el.text ?? (el.type === "box" ? "Cuadro" : "Texto")}
                </div>
              )}
              {(el.type === "box" || el.type === "text") && isEditing && (
                <textarea
                  autoFocus
                  value={el.text ?? ""}
                  onChange={(ev) => onChange(el.id, { text: ev.target.value })}
                  onBlur={() => setEditingId(null)}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter" || ev.key === "Escape") {
                      ev.preventDefault();
                      ev.currentTarget.blur();
                    }
                  }}
                  style={{
                    width: "100%",
                    height: "100%",
                    boxSizing: "border-box",
                    resize: "none",
                    border: "1px solid #2563eb",
                    outline: "none",
                    background: "transparent",
                    padding: "4px 6px",
                    userSelect: "text",
                    ...textBase,
                  }}
                />
              )}

              {/* Tabla */}
              {isTbl &&
                (() => {
                  const t = el.table || {
                    rows: 2,
                    cols: 2,
                    data: [
                      ["", ""],
                      ["", ""],
                    ],
                    header: false,
                  };
                  const pad = Number(s.cellPadding ?? 6);
                  const matrix = ensureMatrix(t.rows, t.cols, t.data);

                  return (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: `repeat(${t.cols}, 1fr)`,
                        gridAutoRows: "minmax(24px, auto)",
                        width: "100%",
                        height: "100%",
                        gap: 0,
                        borderRadius: s.borderRadius ?? 6,
                        overflow:
                          (s.borderRadius ?? 0) > 0 ? "hidden" : "visible",
                      }}
                    >
                      {matrix.map((row, r) =>
                        row.map((val, c) => {
                          const isHeader = !!t.header && r === 0;
                          const editingThis =
                            editingCell &&
                            editingCell.id === el.id &&
                            editingCell.r === r &&
                            editingCell.c === c;

                          const cellInner = (
                            <div
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                setEditingCell({ id: el.id, r, c });
                                onSelect?.(el.id);
                                onOpenProps?.(el.id);
                              }}
                              style={{
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
                                padding: pad,
                                borderRight: `${s.borderWidth ?? 1}px solid ${
                                  s.borderColor ?? "#94a3b8"
                                }`,
                                borderBottom: `${s.borderWidth ?? 1}px solid ${
                                  s.borderColor ?? "#94a3b8"
                                }`,
                                background: isHeader
                                  ? s.headerBg ?? "#f1f5f9"
                                  : s.altRowBg && r % 2 === 1
                                  ? s.altRowBg
                                  : "transparent",
                                ...textBase,
                                fontWeight: isHeader
                                  ? "700"
                                  : textBase.fontWeight,
                              }}
                            >
                              <div style={{ width: "100%" }}>{val}</div>
                            </div>
                          );

                          return (
                            <div
                              key={`${r}-${c}`}
                              style={{ position: "relative" }}
                            >
                              {editingThis ? (
                                <textarea
                                  autoFocus
                                  value={val}
                                  onChange={(ev) =>
                                    changeCell(el, r, c, ev.target.value)
                                  }
                                  onBlur={() => setEditingCell(null)}
                                  onKeyDown={(ev) => {
                                    if (
                                      ev.key === "Enter" ||
                                      ev.key === "Escape"
                                    ) {
                                      ev.preventDefault();
                                      ev.currentTarget.blur();
                                    }
                                  }}
                                  style={{
                                    position: "absolute",
                                    inset: 0,
                                    boxSizing: "border-box",
                                    border: "1px solid #2563eb",
                                    outline: "none",
                                    background: "rgba(255,255,255,0.9)",
                                    padding: pad,
                                    resize: "none",
                                    ...textBase,
                                  }}
                                />
                              ) : (
                                cellInner
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  );
                })()}
            </div>

            {/* Marco de selección que respeta el borderRadius */}
            {isSel && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius:
                    el.type === "box"
                      ? s.borderRadius ?? 10
                      : el.type === "image"
                      ? s.borderRadius ?? 0
                      : isTbl
                      ? s.borderRadius ?? 6
                      : 0,
                  boxShadow: "0 0 0 2px #2563eb",
                  pointerEvents: "none",
                }}
              />
            )}

            {/* Manija de resize */}
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
                  background: isSel ? "#2563eb" : "transparent",
                  cursor: "nwse-resize",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
