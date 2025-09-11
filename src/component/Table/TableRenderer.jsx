// TableRenderer.jsx
import React, { useMemo, useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export default function TableRenderer({
  el,
  onSelect,
  onOpenProps,
  editingCell,
  setEditingCell,
  onChangeCell,
  onChangeTable, // { colWidths?, rowHeights?, spans?, cellImages? }
  onRequestMove, // para iniciar drag desde la manija
  isSelected = false, // ← NUEVO
}) {
  const s = el.style || {};
  const t = el.table || {
    rows: 1,
    cols: 1,
    data: [[""]],
    header: false,
    footer: false,
    rowHeights: [],
    colWidths: [],
    spans: [],
    cellImages: [],
  };

  const bw = Number(s.borderWidth ?? 1);
  const bc = s.borderColor ?? "#94a3b8";
  const pad = s.cellPadding !== undefined ? Number(s.cellPadding) : undefined;
  const padX = pad !== undefined ? pad : Number(s.cellPadX ?? 10);
  const padY = pad !== undefined ? pad : Number(s.cellPadY ?? 6);
  const rowMin = Number(s.rowMinHeight ?? 28);
  const rowCount = Math.max(1, Number(t.rows) || 1);
  const innerW = Math.max(1, (el.w ?? 1) - bw * 2);

  // ======= selección y menú =======
  const [sel, setSel] = useState(null); // { start:{r,c}, end:{r,c} }
  const [isSelecting, setIsSelecting] = useState(false);
  const [menu, setMenu] = useState(null); // {x,y,r,c}
  const [fileTarget, setFileTarget] = useState(null); // {r,c}
  const fileRef = useRef(null);

  const normSel = useMemo(() => {
    if (!sel) return null;
    const r0 = Math.min(sel.start.r, sel.end.r);
    const r1 = Math.max(sel.start.r, sel.end.r);
    const c0 = Math.min(sel.start.c, sel.end.c);
    const c1 = Math.max(sel.start.c, sel.end.c);
    return { r0, r1, c0, c1 };
  }, [sel]);

  const isInSel = (r, c) =>
    !!normSel &&
    r >= normSel.r0 &&
    r <= normSel.r1 &&
    c >= normSel.c0 &&
    c <= normSel.c1;

  // Al des-seleccionar la tabla, limpia overlays
  useEffect(() => {
    if (!isSelected) {
      setSel(null);
      setMenu(null);
      if (editingCell?.id === el.id) setEditingCell?.(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSelected, el.id]);

  // ======= helpers tabla/anchos =======
  const PREFERRED_MIN_COL = 40;
  const HARD_MIN_COL = 8;

  const textBase = {
    color: s.color ?? "#111",
    fontSize: s.fontSize ?? 14,
    fontFamily: s.fontFamily,
    fontWeight: s.fontWeight,
    fontStyle: s.fontStyle,
    lineHeight: 1.35,
    textAlign:
      (s.textAlign ?? "left") === "justify" ? "justify" : s.textAlign ?? "left",
  };

  const ensureMatrix = (rows, cols, data = []) =>
    Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => data?.[r]?.[c] ?? "")
    );

  // ======= datos e imágenes =======
  const matrix = ensureMatrix(rowCount, t.cols, t.data);
  const imgMatrix = useMemo(
    () => ensureMatrix(rowCount, t.cols, t.cellImages),
    [rowCount, t.cols, t.cellImages]
  );

  // ======= columnas =======
  const baseCol = useMemo(() => {
    const saved = (t.colWidths || []).slice(0, t.cols);
    if (saved.length === t.cols && saved.every((v) => Number(v) > 0))
      return saved;
    const even = Math.floor(innerW / Math.max(1, t.cols));
    return Array.from({ length: t.cols }, () => even);
  }, [t.colWidths, t.cols, innerW]);

  const computeMinCol = (total, cols) => {
    const fair = Math.floor(total / Math.max(1, cols)) - 1;
    return Math.max(
      HARD_MIN_COL,
      Math.min(PREFERRED_MIN_COL, isFinite(fair) ? fair : PREFERRED_MIN_COL)
    );
  };

  const minColPx = useMemo(
    () => computeMinCol(innerW, t.cols),
    [innerW, t.cols]
  );

  const fitWidthsTo = (total, base, minColPx) => {
    const cols = Math.max(1, base.length);
    const sum = base.reduce((a, b) => a + (Number(b) || 0), 0) || total;
    let scaled = base.map((w) =>
      sum ? (Number(w) || 0) * (total / sum) : total / cols
    );

    const MIN = Math.max(1, minColPx);
    scaled = scaled.map((w) => Math.max(MIN, Math.round(w)));

    // Normaliza suma exacta
    let cur = scaled.reduce((a, b) => a + b, 0);
    if (cur !== total) {
      let diff = total - cur;
      let i = scaled.length - 1;
      while (diff !== 0 && i >= 0) {
        const room = diff > 0 ? Infinity : scaled[i] - MIN;
        const take = Math.min(Math.abs(diff), Math.max(0, room));
        const signed = diff > 0 ? take : -take;
        scaled[i] = Math.round(scaled[i] + signed);
        diff -= signed;
        i--;
      }
      cur = scaled.reduce((a, b) => a + b, 0);
      if (cur !== total && scaled.length) {
        scaled[scaled.length - 1] += total - cur;
      }
    }
    return scaled;
  };

  const colWidths = useMemo(
    () => fitWidthsTo(innerW, baseCol, minColPx),
    [innerW, baseCol, minColPx]
  );

  // offset del borde exterior (clipper)
  const OFFSET = bw;

  // ======= header/body/footer helpers =======
  const bodyStart = t.header ? 1 : 0;
  const bodyEnd = rowCount - (t.footer ? 1 : 0); // exclusivo

  const getRowPxRaw = (r) => {
    const arr = t.rowHeights || [];
    const vh = Number(arr[r]);
    if (Number.isFinite(vh) && vh > 0) return vh;
    return NaN;
  };

  const getRowPx = (r) => {
    const raw = getRowPxRaw(r);
    if (Number.isFinite(raw)) return Math.max(8, raw);
    if (t.header && r === 0)
      return Math.max(rowMin, Number(s.headerHeight ?? 36));
    if (t.footer && r === rowCount - 1)
      return Math.max(rowMin, Number(s.footerHeight ?? 28));
    return rowMin;
  };

  const ensureHeights = () =>
    Array.from({ length: rowCount }, (_, r) => getRowPx(r));

  const setRowHeight = (r, px) => {
    const next = ensureHeights();
    const val = Math.max(8, Math.round(Number(px) || 0));
    next[r] = val;
    onChangeTable?.({ rowHeights: next });
    setMenu(null);
  };

  // ======= DRAG de resizers =======
  const [drag, setDrag] = useState(null);
  useEffect(() => {
    if (!drag) return;
    const onMove = (e) => {
      if (drag.type === "col") {
        const dx = e.clientX - drag.startX;
        const next = drag.startWidths.slice();
        const i = drag.index;
        const MIN = Math.max(8, drag.minCol || 40);

        let left = Math.max(MIN, drag.startWidths[i] + dx);
        let right = drag.startWidths[i + 1] ?? 0;

        let delta = left - drag.startWidths[i];
        let newRight = Math.max(MIN, right - delta);

        if (newRight === MIN && right - delta < MIN) {
          delta = right - MIN;
          left = drag.startWidths[i] + delta;
          newRight = MIN;
        }

        next[i] = Math.round(left);
        if (i + 1 < next.length) next[i + 1] = Math.round(newRight);

        onChangeTable?.({ colWidths: next });
      } else if (drag.type === "row") {
        const dy = e.clientY - drag.startY;
        const next = drag.startHeights.slice();
        const i = drag.index;
        const MIN = Math.max(8, padY * 2 + 2);

        const up0 = drag.startHeights[i];
        const down0 = drag.startHeights[i + 1];

        if (down0 != null) {
          let up = up0 + dy;
          const maxUp = up0 + (down0 - MIN);
          const minUp = MIN;
          up = Math.max(minUp, Math.min(maxUp, up));
          const delta = up - up0;
          next[i] = Math.round(up);
          next[i + 1] = Math.round(down0 - delta);
        } else {
          next[i] = Math.max(MIN, up0 + dy);
        }

        onChangeTable?.({ rowHeights: next });
      }
    };
    const onUp = () => setDrag(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [drag, onChangeTable, padY]);

  // Cerrar selección al soltar mouse global
  useEffect(() => {
    const onUp = () => setIsSelecting(false);
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mouseup", onUp);
  }, []);
  useEffect(() => {
    const close = () => setMenu(null);
    const onKey = (e) => e.key === "Escape" && setMenu(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  // ======= MERGE / UNMERGE =======
  const spans = t.spans || [];
  const anchorAt = (r, c) =>
    spans.find((sp) => sp.r === r && sp.c === c) || null;
  const coveringSpanFor = (r, c) =>
    spans.find(
      (sp) =>
        r >= sp.r && r < sp.r + sp.rowspan && c >= sp.c && c < sp.c + sp.colspan
    ) || null;
  const isCovered = (r, c) => {
    const sp = coveringSpanFor(r, c);
    return !!(sp && !(sp.r === r && sp.c === c));
  };
  const overlapsRange = (R, sp) =>
    !(
      R.c1 < sp.c ||
      R.c0 > sp.c + sp.colspan - 1 ||
      R.r1 < sp.r ||
      R.r0 > sp.r + sp.rowspan - 1
    );

  const canMergeInfo = useMemo(() => {
    if (!normSel) return { ok: false, reason: "Selecciona dos o más celdas" };
    const rowspan = normSel.r1 - normSel.r0 + 1;
    const colspan = normSel.c1 - normSel.c0 + 1;
    if (rowspan === 1 && colspan === 1)
      return { ok: false, reason: "Selecciona dos o más celdas" };
    if (t.header && normSel.r0 === 0 && normSel.r1 >= 1)
      return { ok: false, reason: "No se puede unir entre cabecera y cuerpo" };
    const last = rowCount - 1;
    if (t.footer && normSel.r1 === last && normSel.r0 <= last - 1)
      return { ok: false, reason: "No se puede unir entre cuerpo y pie" };
    if ((t.spans || []).some((sp) => overlapsRange(normSel, sp)))
      return { ok: false, reason: "La selección cruza una unión existente" };
    return { ok: true, reason: "" };
  }, [normSel, t.spans, t.header, t.footer, rowCount]);

  const mergeSelection = () => {
    if (!canMergeInfo.ok) return setMenu(null);
    const rowspan = normSel.r1 - normSel.r0 + 1;
    const colspan = normSel.c1 - normSel.c0 + 1;
    const next = [
      ...(t.spans || []),
      { r: normSel.r0, c: normSel.c0, rowspan, colspan },
    ];
    onChangeTable?.({ spans: next });
    setMenu(null);
  };
  const unmergeAt = (r, c) => {
    const sp = coveringSpanFor(r, c);
    if (!sp) return;
    const next = (t.spans || []).filter((x) => !(x.r === sp.r && x.c === sp.c));
    onChangeTable?.({ spans: next });
    setMenu(null);
  };

  // ======= posiciones resizers =======
  const rowHeightsAcc = useMemo(() => {
    const acc = [];
    let y = 0;
    for (let i = 0; i < rowCount - 1; i++) {
      y += getRowPx(i);
      acc.push(y);
    }
    return acc;
  }, [rowCount, t.rowHeights, rowMin, t.header, t.footer]);

  const colAccum = useMemo(() => {
    const acc = [];
    let x = 0;
    for (let i = 0; i < colWidths.length - 1; i++) {
      x += colWidths[i];
      acc.push(x);
    }
    return acc;
  }, [colWidths]);

  // ======= Render =======
  return (
    <div
      onMouseDown={() => onSelect?.(el.id)}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onOpenProps?.(el.id);
      }}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "visible",
        background: "transparent",
        userSelect: editingCell?.id === el.id ? "auto" : "none",
        zIndex: 1,
      }}
    >
      {/* Manija externa (solo si está seleccionada) */}
      {isSelected && (
        <div
          data-table-handle
          onMouseDown={(e) => {
            e.stopPropagation();
            onRequestMove?.(e);
          }}
          title="Mover tabla"
          style={{
            position: "absolute",
            left: -10,
            top: -10,
            width: 16,
            height: 16,
            borderRadius: 4,
            background: "rgba(37,99,235,0.95)",
            cursor: "move",
            boxShadow: "0 0 0 2px rgba(255,255,255,0.95)",
            zIndex: 10000,
          }}
        />
      )}

      {/* input oculto para añadir imagen por celda */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f || !fileTarget) return;
          const url = URL.createObjectURL(f);
          const next = ensureMatrix(rowCount, t.cols, t.cellImages);
          next[fileTarget.r][fileTarget.c] = url;
          onChangeTable?.({ cellImages: next });
          setMenu(null);
          setFileTarget(null);
          e.target.value = "";
        }}
      />

      {/* clipper + borde exterior */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: s.borderRadius ?? 6,
          overflow: "hidden",
          background: "transparent",
          border: `${bw}px solid ${bc}`,
        }}
      >
        <table
          style={{
            width: "100%",
            height: "100%",
            tableLayout: "fixed",
            borderCollapse: "collapse",
            backgroundColor: s.background ?? "#fff",
          }}
        >
          <colgroup>
            {colWidths.map((px, i) => (
              <col key={i} style={{ width: `${px}px` }} />
            ))}
          </colgroup>

          {/* THEAD */}
          {t.header && rowCount > 0 && (
            <thead style={{ backgroundColor: s.headerBg ?? "#f1f5f9" }}>
              <tr style={{ height: getRowPx(0) }}>
                {Array.from({ length: t.cols }).map((_, c) => {
                  if (isCovered(0, c)) return null;
                  const anchor = anchorAt(0, c);
                  const colSpan = anchor ? anchor.colspan : 1;
                  const rowSpan = anchor ? anchor.rowspan : 1;

                  const isEd =
                    editingCell?.id === el.id &&
                    editingCell.r === 0 &&
                    editingCell.c === c;

                  const selected = isInSel(0, c);

                  return (
                    <th
                      key={`h-${c}`}
                      colSpan={colSpan}
                      rowSpan={rowSpan}
                      onMouseDown={(e) => {
                        if (e.button !== 0) return;
                        e.stopPropagation();
                        setEditingCell?.(null);
                        setSel({ start: { r: 0, c }, end: { r: 0, c } });
                        setIsSelecting(true);
                      }}
                      onMouseEnter={() => {
                        if (!isSelecting) return;
                        setSel((prev) =>
                          prev ? { ...prev, end: { r: 0, c } } : prev
                        );
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const hasMulti =
                          !!normSel &&
                          (normSel.r1 > normSel.r0 || normSel.c1 > normSel.c0);
                        if (!isInSel(0, c) && !hasMulti) {
                          setSel({ start: { r: 0, c }, end: { r: 0, c } });
                        }
                        setMenu({ x: e.clientX, y: e.clientY, r: 0, c });
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setEditingCell?.({ id: el.id, r: 0, c });
                        onSelect?.(el.id);
                        onOpenProps?.(el.id);
                      }}
                      style={{
                        position: "relative",
                        padding: `${padY}px ${padX}px`,
                        borderLeft: c > 0 ? `${bw}px solid ${bc}` : "none",
                        ...textBase,
                        fontWeight: 700,
                        whiteSpace: "pre-wrap",
                        margin: 0,
                        verticalAlign:
                          (s.vAlign ?? "top") === "middle"
                            ? "middle"
                            : (s.vAlign ?? "top") === "bottom"
                            ? "bottom"
                            : "top",
                        height: getRowPx(0),
                        boxSizing: "border-box",
                        backgroundImage: imgMatrix?.[0]?.[c]
                          ? `url(${imgMatrix[0][c]})`
                          : undefined,
                        backgroundRepeat: "no-repeat",
                        backgroundPosition: "center",
                        backgroundSize: s.cellImageFit ?? "contain",
                        outline:
                          isSelected && selected ? "2px solid #2563eb" : "none",
                        outlineOffset: 0,
                      }}
                    >
                      <div
                        style={{
                          width: "100%",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          overflowWrap: "anywhere",
                          textAlign: textBase.textAlign,
                        }}
                      >
                        {matrix?.[0]?.[c] ?? ""}
                      </div>

                      {isEd && (
                        <textarea
                          autoFocus
                          value={matrix?.[0]?.[c] ?? ""}
                          onChange={(ev) =>
                            onChangeCell?.(0, c, ev.target.value)
                          }
                          onBlur={() => setEditingCell?.(null)}
                          onKeyDown={(ev) => {
                            if (ev.key === "Enter" || ev.key === "Escape") {
                              ev.preventDefault();
                              ev.currentTarget.blur();
                            }
                          }}
                          wrap="soft"
                          style={{
                            position: "absolute",
                            inset: 0,
                            boxSizing: "border-box",
                            border: "1px solid #2563eb",
                            outline: "none",
                            background: "rgba(255,255,255,0.9)",
                            padding: `${padY}px ${padX}px`,
                            resize: "none",
                            pointerEvents: "auto",
                            userSelect: "text",
                            ...textBase,
                            whiteSpace: "pre-wrap",
                            overflowWrap: "anywhere",
                            wordBreak: "break-word",
                          }}
                        />
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
          )}

          {/* TBODY */}
          <tbody>
            {Array.from({ length: Math.max(0, bodyEnd - bodyStart) }).map(
              (_, rr) => {
                const r = rr + bodyStart;
                const alt = s.altRowBg && (r - bodyStart) % 2 === 1;
                return (
                  <tr
                    key={`r-${r}`}
                    style={{
                      backgroundColor: alt ? s.altRowBg : undefined,
                      height: getRowPx(r),
                    }}
                  >
                    {Array.from({ length: t.cols }).map((_, c) => {
                      if (isCovered(r, c)) return null;
                      const anchor = anchorAt(r, c);
                      const colSpan = anchor ? anchor.colspan : 1;
                      const rowSpan = anchor ? anchor.rowspan : 1;

                      const isEd =
                        editingCell?.id === el.id &&
                        editingCell.r === r &&
                        editingCell.c === c;

                      const selected = isInSel(r, c);

                      return (
                        <td
                          key={`c-${r}-${c}`}
                          colSpan={colSpan}
                          rowSpan={rowSpan}
                          onMouseDown={(e) => {
                            if (e.button !== 0) return;
                            e.stopPropagation();
                            setEditingCell?.(null);
                            setSel({ start: { r, c }, end: { r, c } });
                            setIsSelecting(true);
                          }}
                          onMouseEnter={() => {
                            if (!isSelecting) return;
                            setSel((prev) =>
                              prev ? { ...prev, end: { r, c } } : prev
                            );
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const hasMulti =
                              !!normSel &&
                              (normSel.r1 > normSel.r0 ||
                                normSel.c1 > normSel.c0);
                            if (!isInSel(r, c) && !hasMulti) {
                              setSel({ start: { r, c }, end: { r, c } });
                            }
                            setMenu({ x: e.clientX, y: e.clientY, r, c });
                          }}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            setEditingCell?.({ id: el.id, r, c });
                            onSelect?.(el.id);
                            onOpenProps?.(el.id);
                          }}
                          style={{
                            position: "relative",
                            padding: `${padY}px ${padX}px`,
                            borderLeft: c > 0 ? `${bw}px solid ${bc}` : "none",
                            borderTop: r > 0 ? `${bw}px solid ${bc}` : "none",
                            ...textBase,
                            whiteSpace: "pre-wrap",
                            margin: 0,
                            verticalAlign:
                              (s.vAlign ?? "top") === "middle"
                                ? "middle"
                                : (s.vAlign ?? "top") === "bottom"
                                ? "bottom"
                                : "top",
                            boxSizing: "border-box",
                            backgroundImage: imgMatrix?.[r]?.[c]
                              ? `url(${imgMatrix[r][c]})`
                              : undefined,
                            backgroundRepeat: "no-repeat",
                            backgroundPosition: "center",
                            backgroundSize: s.cellImageFit ?? "contain",
                            outline:
                              isSelected && selected
                                ? "2px solid #2563eb"
                                : "none",
                            outlineOffset: 0,
                          }}
                        >
                          <div
                            style={{
                              width: "100%",
                              textAlign: textBase.textAlign,
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-word",
                              overflowWrap: "anywhere",
                              height: "100%",
                              overflow: "hidden",
                            }}
                          >
                            {matrix?.[r]?.[c] ?? ""}
                          </div>

                          {isEd && (
                            <textarea
                              autoFocus
                              value={matrix?.[r]?.[c] ?? ""}
                              onChange={(ev) =>
                                onChangeCell?.(r, c, ev.target.value)
                              }
                              onBlur={() => setEditingCell?.(null)}
                              onKeyDown={(ev) => {
                                if (ev.key === "Enter" || ev.key === "Escape") {
                                  ev.preventDefault();
                                  ev.currentTarget.blur();
                                }
                              }}
                              wrap="soft"
                              style={{
                                position: "absolute",
                                inset: 0,
                                boxSizing: "border-box",
                                border: "1px solid #2563eb",
                                outline: "none",
                                background: "rgba(255,255,255,0.9)",
                                padding: `${padY}px ${padX}px`,
                                resize: "none",
                                pointerEvents: "auto",
                                userSelect: "text",
                                ...textBase,
                                whiteSpace: "pre-wrap",
                                overflowWrap: "anywhere",
                                wordBreak: "break-word",
                              }}
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              }
            )}
          </tbody>

          {/* TFOOT */}
          {t.footer && rowCount > 0 && (
            <tfoot style={{ backgroundColor: s.footerBg ?? "#f8fafc" }}>
              <tr style={{ height: getRowPx(rowCount - 1) }}>
                {Array.from({ length: t.cols }).map((_, c) => {
                  const r = rowCount - 1;
                  if (isCovered(r, c)) return null;
                  const anchor = anchorAt(r, c);
                  const colSpan = anchor ? anchor.colspan : 1;
                  const rowSpan = anchor ? anchor.rowspan : 1;

                  const isEd =
                    editingCell?.id === el.id &&
                    editingCell.r === r &&
                    editingCell.c === c;

                  const selected = isInSel(r, c);

                  return (
                    <td
                      key={`f-${c}`}
                      colSpan={colSpan}
                      rowSpan={rowSpan}
                      onMouseDown={(e) => {
                        if (e.button !== 0) return;
                        e.stopPropagation();
                        setEditingCell?.(null);
                        setSel({ start: { r, c }, end: { r, c } });
                        setIsSelecting(true);
                      }}
                      onMouseEnter={() => {
                        if (!isSelecting) return;
                        setSel((prev) =>
                          prev ? { ...prev, end: { r, c } } : prev
                        );
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const hasMulti =
                          !!normSel &&
                          (normSel.r1 > normSel.r0 || normSel.c1 > normSel.c0);
                        if (!isInSel(r, c) && !hasMulti) {
                          setSel({ start: { r, c }, end: { r, c } });
                        }
                        setMenu({ x: e.clientX, y: e.clientY, r, c });
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setEditingCell?.({ id: el.id, r, c });
                        onSelect?.(el.id);
                        onOpenProps?.(el.id);
                      }}
                      style={{
                        position: "relative",
                        padding: `${padY}px ${padX}px`,
                        borderLeft: c > 0 ? `${bw}px solid ${bc}` : "none",
                        borderTop: `${bw}px solid ${bc}`,
                        ...textBase,
                        whiteSpace: "pre-wrap",
                        margin: 0,
                        verticalAlign:
                          (s.vAlign ?? "top") === "middle"
                            ? "middle"
                            : (s.vAlign ?? "top") === "bottom"
                            ? "bottom"
                            : "top",
                        boxSizing: "border-box",
                        backgroundImage: imgMatrix?.[r]?.[c]
                          ? `url(${imgMatrix[r][c]})`
                          : undefined,
                        backgroundRepeat: "no-repeat",
                        backgroundPosition: "center",
                        backgroundSize: s.cellImageFit ?? "contain",
                        outline:
                          isSelected && selected ? "2px solid #2563eb" : "none",
                        outlineOffset: 0,
                      }}
                    >
                      <div
                        style={{
                          width: "100%",
                          textAlign: textBase.textAlign,
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          overflowWrap: "anywhere",
                          height: "100%",
                          overflow: "hidden",
                        }}
                      >
                        {matrix?.[r]?.[c] ?? ""}
                      </div>

                      {isEd && (
                        <textarea
                          autoFocus
                          value={matrix?.[r]?.[c] ?? ""}
                          onChange={(ev) =>
                            onChangeCell?.(r, c, ev.target.value)
                          }
                          onBlur={() => setEditingCell?.(null)}
                          onKeyDown={(ev) => {
                            if (ev.key === "Enter" || ev.key === "Escape") {
                              ev.preventDefault();
                              ev.currentTarget.blur();
                            }
                          }}
                          wrap="soft"
                          style={{
                            position: "absolute",
                            inset: 0,
                            boxSizing: "border-box",
                            border: "1px solid #2563eb",
                            outline: "none",
                            background: "rgba(255,255,255,0.9)",
                            padding: `${padY}px ${padX}px`,
                            resize: "none",
                            pointerEvents: "auto",
                            userSelect: "text",
                            ...textBase,
                            whiteSpace: "pre-wrap",
                            overflowWrap: "anywhere",
                            wordBreak: "word-break",
                          }}
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* RESIZERS (solo si está seleccionada) */}
      {isSelected &&
        colWidths.length > 1 &&
        colAccum.map((x, i) => (
          <div
            data-table-resizer
            key={`v-${i}`}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const base = colWidths.slice();
              setDrag({
                type: "col",
                index: i,
                startX: e.clientX,
                startWidths: base,
                startTotal: innerW,
                minCol: minColPx,
              });
            }}
            title="Arrastra para cambiar ancho de columnas"
            style={{
              position: "absolute",
              left: Math.round(OFFSET + x) - 5,
              top: 0,
              width: 10,
              height: "100%",
              cursor: "col-resize",
              background: "transparent",
              zIndex: 9999,
              pointerEvents: "auto",
            }}
          />
        ))}

      {isSelected &&
        rowHeightsAcc.map((y, i) => (
          <div
            data-table-resizer
            key={`h-${i}`}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const start = Array.from({ length: rowCount }, (_, r) =>
                getRowPx(r)
              );
              setDrag({
                type: "row",
                index: i,
                startY: e.clientY,
                startHeights: start,
              });
            }}
            title="Arrastra para cambiar alto de filas"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: Math.round(OFFSET + y) - 5,
              height: 10,
              cursor: "row-resize",
              background: "transparent",
              zIndex: 9999,
              pointerEvents: "auto",
            }}
          />
        ))}

      {/* MENÚ CONTEXTUAL */}
      {menu &&
        createPortal(
          <div
            style={{
              position: "fixed",
              left: menu.x,
              top: menu.y,
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
              padding: 6,
              zIndex: 2147483647,
              minWidth: 240,
              pointerEvents: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
          >
            <button
              onClick={canMergeInfo.ok ? mergeSelection : undefined}
              disabled={!canMergeInfo.ok}
              title={
                canMergeInfo.ok
                  ? "Unir celdas seleccionadas"
                  : canMergeInfo.reason
              }
              style={{
                ...btnCtx,
                opacity: canMergeInfo.ok ? 1 : 0.5,
                cursor: canMergeInfo.ok ? "pointer" : "not-allowed",
              }}
            >
              ▦ Unir celdas seleccionadas
            </button>
            <button onClick={() => unmergeAt(menu.r, menu.c)} style={btnCtx}>
              ⊟ Deshacer unión
            </button>

            <div
              style={{ height: 1, background: "#e5e7eb", margin: "6px 0" }}
            />

            <button
              onClick={() => {
                setFileTarget({ r: menu.r, c: menu.c });
                fileRef.current?.click();
              }}
              style={btnCtx}
            >
              🖼️ Añadir imagen…
            </button>

            {imgMatrix?.[menu.r]?.[menu.c] && (
              <button
                onClick={() => {
                  const next = ensureMatrix(rowCount, t.cols, t.cellImages);
                  next[menu.r][menu.c] = "";
                  onChangeTable?.({ cellImages: next });
                  setMenu(null);
                }}
                style={btnCtx}
              >
                ✖ Quitar imagen
              </button>
            )}

            <div
              style={{ height: 1, background: "#e5e7eb", margin: "6px 0" }}
            />

            <div style={{ padding: "4px 8px", fontSize: 12, color: "#64748b" }}>
              Alto de la fila (px)
            </div>
            <div style={{ display: "flex", gap: 6, padding: "0 8px 6px" }}>
              {[24, 28, 32, 40].map((px) => (
                <button
                  key={px}
                  onClick={() => setRowHeight(menu.r, px)}
                  style={btnCtx}
                >
                  {px}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                const def = String(getRowPx(menu.r));
                const val = Number(prompt("Alto de la fila (px):", def));
                if (Number.isFinite(val) && val > 0) setRowHeight(menu.r, val);
              }}
              style={btnCtx}
            >
              ✎ Alto personalizado…
            </button>
          </div>,
          document.body
        )}
    </div>
  );
}

const btnCtx = {
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "6px 10px",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  fontSize: 14,
};
