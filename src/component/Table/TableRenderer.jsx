"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";

/**
 * TableEditableContent: Handles contentEditable with LIVE updates and cursor protection.
 */
const TableEditableContent = ({ html, isEditing, onChange, className, style, align }) => {
    const ref = useRef(null);
    const lastDomHtml = useRef(html);

    // Sync from props, but ONLY if we are NOT editing
    useEffect(() => {
        if (isEditing) return;
        const targetHtml = html || "";
        if (ref.current && ref.current.innerHTML !== targetHtml) {
            ref.current.innerHTML = targetHtml;
            lastDomHtml.current = targetHtml;
        }
    }, [html, isEditing]);

    // Capture selection
    useEffect(() => {
        const handleSelection = () => {
            if (!isEditing) return;
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0 && ref.current && ref.current.contains(sel.anchorNode)) {
                window.__LAST_TABLE_RANGE__ = sel.getRangeAt(0);
                window.__LAST_TABLE_REF__ = ref.current;
                window.__LAST_EDITABLE_REF__ = ref.current;
            }
        };
        document.addEventListener('selectionchange', handleSelection);
        return () => document.removeEventListener('selectionchange', handleSelection);
    }, [isEditing]);

    // Handle focus when starting to edit
    useEffect(() => {
        if (isEditing && ref.current) {
            const targetHtml = html || "";
            if (ref.current.innerHTML !== targetHtml) {
                ref.current.innerHTML = targetHtml;
                lastDomHtml.current = targetHtml;
            }
            ref.current.focus();
            try {
                const range = document.createRange();
                const sel = window.getSelection();
                range.selectNodeContents(ref.current);
                range.collapse(false);
                sel.removeAllRanges();
                sel.addRange(range);
            } catch(e) {}
        }
    }, [isEditing]);

    const handleInput = (e) => {
        const val = e.target.innerHTML;
        lastDomHtml.current = val;
        onChange(val);
    };

    return (
        <div
            ref={ref}
            className={className}
            contentEditable={isEditing}
            suppressContentEditableWarning
            onInput={handleInput}
            onMouseDown={(e) => {
                if (isEditing) e.stopPropagation();
            }}
            style={{
                ...style,
                outline: "none",
                width: "100%",
                height: "100%",
                minHeight: "1em",
                display: "block",
                textAlign: align || "left",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                pointerEvents: "auto",
                cursor: isEditing ? "text" : "inherit"
            }}
        />
    );
};

export default function TableRenderer({
  el,
  onSelect,
  onChange,
  selectedId,
  dataRecord = null,
  selectionRange = null,
  onRangeSelect = null
}) {
  const s = el.style || {};
  const t = el.table || {};
  const dataSource = t.dataSource || 'static';
  
  const [isSelecting, setIsSelecting] = useState(false);
  const [editingCellCoords, setEditingCellCoords] = useState(null);
  const [resizing, setResizing] = useState(null); 

  const rowCount = Math.max(Number(t.rows) || 0, (t.data || []).length, 1);
  const colCount = Math.max(Number(t.cols) || 0, (t.data?.[0] || []).length, 1);
  
  const colWidths = useMemo(() => {
    if (t.colWidths && t.colWidths.length >= colCount) return t.colWidths;
    return Array(colCount).fill((el.w || 300) / colCount);
  }, [t.colWidths, colCount, el.w]);

  const rowHeights = useMemo(() => {
    if (t.rowHeights && t.rowHeights.length >= rowCount) return t.rowHeights;
    return Array(rowCount).fill((el.h || 150) / rowCount);
  }, [t.rowHeights, rowCount, el.h]);

  const bw_raw = s.borderWidth ?? "1px";
  const bw = typeof bw_raw === "string" ? parseInt(bw_raw) : Number(bw_raw);
  const bc = s.borderColor ?? "#94a3b8";
  const bs = s.borderStyle ?? "solid";

  const isCellSelection = typeof selectedId === "string" && selectedId.includes(":cell:");
  const selectedCell = useMemo(() => {
    if (!isCellSelection) return null;
    const parts = selectedId.split(":cell:")[1].split(":");
    return { r: parseInt(parts[0]), c: parseInt(parts[1]) };
  }, [selectedId, isCellSelection]);

  const cellStyles = t.cellStyles || {};
  
  const cellConfig = useMemo(() => {
    const config = { ...(t.cellConfig || {}) };
    if (t.merges) {
        t.merges.forEach(m => {
            config[`${m.r}:${m.c}`] = { rowspan: m.rs, colspan: m.cs };
        });
    }
    return config;
  }, [t.cellConfig, t.merges]);

  let collection = []; 
  if (dataSource === 'dynamic') {
    const ds = window.__EDITOR_DATASET__ || [];
    const activeSource = dataRecord || ds[0] || {};
    const collField = t.collectionField;
    if (collField) {
       collection = Array.isArray(activeSource[collField]) ? activeSource[collField] : [];
    } else if (Array.isArray(activeSource.items)) {
       collection = activeSource.items;
    } else {
       collection = Array.isArray(ds) ? ds : [activeSource];
    }
  }

  const handleCellClick = (e, r, c) => {
    e.stopPropagation();
    const vId = `${el.id}:cell:${r}:${c}`;
    window.__LAST_EDITABLE_REF__ = e.currentTarget;
    window.__LAST_TABLE_REF__ = e.currentTarget;
    if (e.shiftKey && selectedCell) {
        onRangeSelect?.({ start: selectedCell, end: { r, c }, tableId: el.id });
        return;
    }
    if (selectedId === vId) {
        setEditingCellCoords({ r, c });
    } else {
        setEditingCellCoords(null);
        onSelect?.(vId);
    }
    onRangeSelect?.(null);
  };

  const handleCellMouseDown = (e, r, c) => {
    e.stopPropagation();
    if (editingCellCoords && (editingCellCoords.r !== r || editingCellCoords.c !== c)) {
        setEditingCellCoords(null);
    }
    if (editingCellCoords?.r === r && editingCellCoords?.c === c) return;
    if (e.shiftKey) return;
    setIsSelecting(true);
    const pos = { r, c };
    onRangeSelect?.({ start: pos, end: pos, tableId: el.id });
    onSelect?.(`${el.id}:cell:${r}:${c}`);
  };

  const handleCellMouseEnter = (r, c) => {
    if (!isSelecting || !selectionRange) return;
    onRangeSelect?.({ ...selectionRange, end: { r, c } });
  };

  const handleCellChange = (r, c, val) => {
    const rawData = t.data || [];
    const newData = Array.from({ length: rowCount }, (_, ri) => {
        const row = Array.isArray(rawData[ri]) ? [...rawData[ri]] : [];
        while (row.length < colCount) row.push("");
        return row;
    });
    newData[r][c] = val;
    onChange?.(el.id, { table: { ...t, data: newData } });
  };

  const startResize = (e, type, index) => {
    e.stopPropagation();
    e.preventDefault();
    const startPos = type === 'col' ? e.clientX : e.clientY;
    const startSize = type === 'col' ? colWidths[index] : rowHeights[index];
    setResizing({ type, index, startPos, startSize });
  };

  useEffect(() => {
    if (!resizing) return;
    const onMove = (e) => {
        const delta = (resizing.type === 'col' ? e.clientX : e.clientY) - resizing.startPos;
        const newSize = Math.max(10, resizing.startSize + delta);
        if (resizing.type === 'col') {
            const nextWidths = [...colWidths];
            nextWidths[resizing.index] = newSize;
            onChange?.(el.id, { table: { ...t, colWidths: nextWidths }, w: nextWidths.reduce((a,b)=>a+b, 0) });
        } else {
            const nextHeights = [...rowHeights];
            nextHeights[resizing.index] = newSize;
            onChange?.(el.id, { table: { ...t, rowHeights: nextHeights }, h: nextHeights.reduce((a,b)=>a+b, 0) });
        }
    };
    const onUp = () => setResizing(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
    };
  }, [resizing, colWidths, rowHeights, t, el.id, onChange]);

  useEffect(() => {
    const handleGlobalUp = () => setIsSelecting(false);
    window.addEventListener("mouseup", handleGlobalUp);
    return () => window.removeEventListener("mouseup", handleGlobalUp);
  }, []);

  // Build occupied matrix for the template structure
  const occupied = Array.from({ length: rowCount }, () => Array(colCount).fill(false));
  for (let r = 0; r < rowCount; r++) {
      for (let c = 0; c < colCount; c++) {
          if (occupied[r][c]) continue;
          const config = cellConfig[`${r}:${c}`] || { rowspan: 1, colspan: 1 };
          const rs = Math.max(1, config.rowspan || 1);
          const cs = Math.max(1, config.colspan || 1);
          for (let i = 0; r + i < rowCount && i < rs; i++) {
              for (let j = 0; c + j < colCount && j < cs; j++) {
                  if (i === 0 && j === 0) continue;
                  occupied[r + i][c + j] = true;
              }
          }
      }
  }

  const hdrRows = t.headerRows !== undefined ? Number(t.headerRows) : 0;
  const ftrRows = t.footerRows !== undefined ? Number(t.footerRows) : 0;
  // If no header/footer explicitly defined, ALL rows form the repeating detail block!
  const ftrLimit = Math.max(hdrRows, rowCount - ftrRows);
  const showHdr = t.showHeader !== false;
  const showFtr = t.showFooter !== false;

  const getRenderedRow = (r, isDynamic, dataRec = null, itemIdx = -1) => {
    const cells = [];
    for (let c = 0; c < colCount; c++) {
      if (occupied[r][c]) continue;

      const config = cellConfig[`${r}:${c}`] || { rowspan: 1, colspan: 1 };
      const rs = Math.max(1, config.rowspan || 1);
      const cs = Math.max(1, config.colspan || 1);

      const cellId = `${el.id}:cell:${r}:${c}`;
      const isEditing = editingCellCoords?.r === r && editingCellCoords?.c === c;
      const isSelected = selectedId === cellId || (selectedCell?.r === r && selectedCell?.c === c);
      
      let isInRange = false;
      if (selectionRange) {
        const { start, end } = selectionRange;
        const minR = Math.min(start.r, end.r), maxR = Math.max(start.r, end.r);
        const minC = Math.min(start.c, end.c), maxC = Math.max(start.c, end.c);
        isInRange = r >= minR && r <= maxR && c >= minC && c <= maxC;
      }

      const customStyle = (cellStyles[`${r}:${c}`]) || {};
      const rawHtml = (t.data?.[r]?.[c]) || "";
      let displayHtml = rawHtml;

      const activeRec = dataRec || dataRecord || {};
      if (typeof displayHtml === "string" && !isEditing) {
          displayHtml = displayHtml.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, key) => {
              const kn = key.trim();
              return activeRec[kn] !== undefined ? String(activeRec[kn]) : match;
          });
      }

      const width = colWidths.slice(c, c + cs).reduce((a, b) => a + b, 0);
      const height = isDynamic ? "auto" : rowHeights.slice(r, r + rs).reduce((a, b) => a + b, 0);

      cells.push(
        <td
          key={c}
          rowSpan={rs}
          colSpan={cs}
          onMouseDown={(e) => handleCellMouseDown(e, r, c)}
          onMouseEnter={() => handleCellMouseEnter(r, c)}
          onClick={(e) => handleCellClick(e, r, c)}
          onDoubleClick={(e) => e.stopPropagation()}
          style={{
            border: (bw > 0 && bs !== 'none') ? `${bw}px ${bs} ${bc}` : "1px dashed rgba(0,0,0,0.1)",
            padding: 0, 
            position: "relative",
            width: width,
            maxWidth: width,
            minWidth: width,
            height: height,
            background: isSelected ? "rgba(37, 99, 235, 0.1)" : (isInRange ? "rgba(37, 99, 235, 0.05)" : (itemIdx % 2 === 1 && s.altRowBg ? s.altRowBg : "transparent")),
            ...customStyle,
            verticalAlign: customStyle.verticalAlign || "middle"
          }}
        >
          <div style={{ 
              width: "100%", height: "100%", padding: customStyle.padding || "8px", boxSizing: "border-box",
              display: "flex", flexDirection: "column", justifyContent: customStyle.justifyContent || "center"
          }}>
              <TableEditableContent 
                html={isEditing ? rawHtml : displayHtml} 
                isEditing={isEditing} 
                onChange={(val) => handleCellChange(r, c, val)}
                style={{
                    fontSize: customStyle.fontSize,
                    fontWeight: customStyle.fontWeight,
                    fontFamily: customStyle.fontFamily,
                    fontStyle: customStyle.fontStyle,
                    textDecoration: customStyle.textDecoration,
                    color: customStyle.color,
                    lineHeight: customStyle.lineHeight,
                    letterSpacing: customStyle.letterSpacing,
                    textTransform: customStyle.textTransform,
                }}
                align={customStyle.textAlign || s.textAlign || "left"} 
              />
          </div>

          {(isSelected || isInRange) && (
              <div style={{ position: "absolute", inset: -1, border: isSelected ? "2px solid #2563eb" : "1px solid #3b82f6", pointerEvents: "none", zIndex: 10 }} />
          )}

          {r === 0 && (itemIdx === -1 || itemIdx === 0) && (
              <div 
                onMouseDown={(e) => startResize(e, 'col', c + cs - 1)}
                style={{ position: "absolute", right: -3, top: 0, bottom: 0, width: 6, cursor: "col-resize", zIndex: 20 }} 
              />
          )}
          {c === 0 && !isDynamic && (
              <div 
                onMouseDown={(e) => startResize(e, 'row', r + rs - 1)}
                style={{ position: "absolute", left: 0, right: 0, bottom: -3, height: 6, cursor: "row-resize", zIndex: 20 }} 
              />
          )}
        </td>
      );
    }
    return cells;
  };

  const renderedRows = [];

  // 1. Static Headers
  if (showHdr) {
      for (let r = 0; r < hdrRows; r++) {
         renderedRows.push(<tr key={`hdr-${r}`}>{getRenderedRow(r, false)}</tr>);
      }
  }

  // 2. Details
  const isDynamic = dataSource === 'dynamic' && collection.length > 0;
  if (isDynamic) {
      collection.slice(0, 100).forEach((item, idx) => {
          for (let r = hdrRows; r < ftrLimit; r++) {
             renderedRows.push(<tr key={`repeat-${idx}-${r}`}>{getRenderedRow(r, true, item, idx)}</tr>);
          }
      });
  } else {
      for (let r = hdrRows; r < ftrLimit; r++) {
         renderedRows.push(<tr key={`static-${r}`}>{getRenderedRow(r, false)}</tr>);
      }
  }

  // 3. Static Footers
  if (showFtr) {
      for (let r = ftrLimit; r < rowCount; r++) {
         renderedRows.push(<tr key={`ftr-${r}`}>{getRenderedRow(r, false)}</tr>);
      }
  }

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
        <table style={{
            width: "100%",
            borderCollapse: "collapse",
            tableLayout: "fixed", 
            background: s.background ?? "transparent",
            color: s.color ?? "#1e293b",
            fontSize: `${s.fontSize ?? 14}px`,
            fontFamily: s.fontFamily ?? "inherit",
            fontWeight: s.fontWeight ?? "400",
            ...s
        }}>
            <tbody>
                {renderedRows}
            </tbody>
        </table>
    </div>
  );
}
