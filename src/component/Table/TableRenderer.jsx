"use client";

import React, { useMemo } from "react";

export default function TableRenderer({
  el,
  onSelect,
  onChange,
  selectedId,
  dataRecord = null,
  selectionRange = null, // { start: {r,c}, end: {r,c} }
  onRangeSelect = null
}) {
  const s = el.style || {};
  const t = el.table || {};
  
  const rowCount = Math.max(1, Number(t.rows) || 1);
  const colCount = Math.max(1, Number(t.cols) || 1);
  
  const bw = Number(s.borderWidth ?? 1);
  const bc = s.borderColor ?? "#94a3b8";

  const isCellSelection = typeof selectedId === "string" && selectedId.includes("::cell:");
  const selectedCell = useMemo(() => {
    if (!isCellSelection) return null;
    const parts = selectedId.split("::cell:")[1].split(":");
    return { r: parseInt(parts[0]), c: parseInt(parts[1]) };
  }, [selectedId, isCellSelection]);

  const cellStyles = t.cellStyles || [];
  const cellConfig = t.cellConfig || {}; 

  const [isSelecting, setIsSelecting] = React.useState(false);
  const [editingCellCoords, setEditingCellCoords] = React.useState(null); 

  const handleCellClick = (e, r, c) => {
    e.stopPropagation();
    const vId = `${el.id}::cell:${r}:${c}`;
    if (selectedId === vId) {
        setEditingCellCoords({ r, c });
    }
    onSelect?.(vId);
    onRangeSelect?.(null);
  };

  const handleCellMouseDown = (e, r, c) => {
    if (editingCellCoords && (editingCellCoords.r !== r || editingCellCoords.c !== c)) {
        setEditingCellCoords(null);
    }
    if (editingCellCoords?.r === r && editingCellCoords?.c === c) return;
    
    // e.preventDefault(); // Remove this to allow the cursor to focus naturally
    setIsSelecting(true);
    const pos = { r, c };
    onRangeSelect?.({ start: pos, end: pos });
    onSelect?.(`${el.id}::cell:${r}:${c}`);
  };

  const handleCellMouseEnter = (r, c) => {
    if (!isSelecting || !selectionRange) return;
    onRangeSelect?.({ ...selectionRange, end: { r, c } });
  };

  const handleCellDoubleClick = (r, c) => {
    setEditingCellCoords({ r, c });
    onSelect?.(`${el.id}::cell:${r}:${c}`);
  };

  React.useEffect(() => {
    const handleGlobalUp = () => setIsSelecting(false);
    window.addEventListener("mouseup", handleGlobalUp);
    return () => window.removeEventListener("mouseup", handleGlobalUp);
  }, []);

  const handleCellChange = (r, c, val) => {
    const rawData = t.data || [];
    const newData = Array.from({ length: rowCount }, (_, ri) => {
        const row = Array.isArray(rawData[ri]) ? [...rawData[ri]] : [];
        while (row.length < colCount) row.push("");
        return row;
    });
    newData[r][c] = val;
    onChange?.({ table: { ...t, data: newData } });
  };

  const tableStyle = {
    width: "100%",
    height: "100%",
    borderCollapse: "collapse",
    tableLayout: "auto", 
    background: s.background ?? "transparent",
    color: s.color ?? "#1e293b",
    fontSize: `${s.fontSize ?? 14}px`,
    fontFamily: s.fontFamily ?? "inherit",
    fontWeight: s.fontWeight ?? "400",
    fontStyle: s.fontStyle ?? "normal",
    textDecoration: s.textDecoration ?? "none",
    wordBreak: "break-word",
  };

  const occupied = Array.from({ length: rowCount }, () => Array(colCount).fill(false));
  const rows = [];
  for (let r = 0; r < rowCount; r++) {
    const cells = [];
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

      const isSelected = selectedCell && selectedCell.r === r && selectedCell.c === c;
      const isEditingThis = editingCellCoords?.r === r && editingCellCoords?.c === c;
      
      let isInRange = false;
      if (selectionRange) {
        const { start, end } = selectionRange;
        const minR = Math.min(start.r, end.r), maxR = Math.max(start.r, end.r);
        const minC = Math.min(start.c, end.c), maxC = Math.max(start.c, end.c);
        isInRange = r >= minR && r <= maxR && c >= minC && c <= maxC;
      }

      const customStyle = (cellStyles[r] && cellStyles[r][c]) || {};
      const tdStyle = {
        border: `${bw}px solid ${bc}`,
        padding: "8px",
        position: "relative",
        background: isSelected ? "rgba(37, 99, 235, 0.08)" : 
                    isInRange ? "rgba(37, 99, 235, 0.15)" : 
                    (r % 2 === 1 && s.altRowBg ? s.altRowBg : "transparent"),
        ...customStyle,
        cursor: isEditingThis ? "text" : "cell",
        verticalAlign: customStyle.verticalAlign || "middle",
        height: "auto",
        minHeight: s.rowMinHeight ? `${s.rowMinHeight}px` : "24px",
      };

      let displayHtml = (t.data?.[r]?.[c]) || "";
      if (dataRecord && typeof displayHtml === "string" && (!selectedCell || selectedCell.r !== r || selectedCell.c !== c)) {
          displayHtml = displayHtml.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, key) => {
               const keyName = key.trim();
               return dataRecord[keyName] !== undefined ? String(dataRecord[keyName]) : match;
          });
      }

      cells.push(
        <td 
          key={c} 
          style={tdStyle}
          rowSpan={rs}
          colSpan={cs}
          onMouseDown={(e) => handleCellMouseDown(e, r, c)} 
          onMouseEnter={() => handleCellMouseEnter(r, c)}
          onClick={(e) => handleCellClick(e, r, c)}
          onDoubleClick={() => handleCellDoubleClick(r, c)}
        >
          <div
            contentEditable={isEditingThis}
            suppressContentEditableWarning
            onInput={(e) => handleCellChange(r, c, e.target.innerHTML)}
            onBlur={(e) => {
                handleCellChange(r, c, e.target.innerHTML);
                setEditingCellCoords(null);
            }}
            onMouseDown={(e) => {
                if (isEditingThis) e.stopPropagation();
            }}
            dangerouslySetInnerHTML={{ __html: displayHtml }}
            style={{ 
              outline: "none", 
              minHeight: "100%", 
              width: "100%",
              fontWeight: "inherit",
              fontStyle: "inherit",
              textDecoration: "inherit",
              fontSize: "inherit",
              display: "block", 
              textAlign: customStyle.textAlign || "left",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
              pointerEvents: isEditingThis ? "auto" : "none"
            }}
          />
          {(isSelected || isInRange) && (
            <div style={{
              position: "absolute",
              inset: -1,
              border: isSelected ? "2px solid #2563eb" : "1px solid #3b82f6",
              backgroundColor: isInRange && !isSelected ? "rgba(59, 130, 246, 0.2)" : "transparent",
              pointerEvents: "none",
              zIndex: 10
            }} />
          )}
        </td>
      );
    }
    rows.push(<tr key={r}>{cells}</tr>);
  }

  let floatToolbar = null;
  if (selectionRange && (selectionRange.start.r !== selectionRange.end.r || selectionRange.start.c !== selectionRange.end.c)) {
      const { start, end } = selectionRange;
      const r1 = Math.min(start.r, end.r), r2 = Math.max(start.r, end.r);
      const c1 = Math.min(start.c, end.c), c2 = Math.max(start.c, end.c);
      
      floatToolbar = (
        <div style={{
          position: "absolute", top: -45, left: 0, zIndex: 1000, display: "flex", gap: 6, animation: "fadeIn 0.2s ease"
        }}>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              const rs = r2 - r1 + 1;
              const cs = c2 - c1 + 1;
              if (rs > 1 || cs > 1) {
                const updatedTable = { ...t };
                const config = { ...(updatedTable.cellConfig || {}) };
                config[`${r1}:${c1}`] = { rowspan: rs, colspan: cs };
                const newData = [...(updatedTable.data || [])];
                for (let ir = r1; ir <= r2; ir++) {
                  if (!newData[ir]) newData[ir] = [];
                  for (let ic = c1; ic <= c2; ic++) {
                    if (ir === r1 && ic === c1) continue;
                    newData[ir][ic] = "";
                  }
                }
                onChange?.({ table: { ...updatedTable, cellConfig: config, data: newData } });
                onRangeSelect?.(null);
              }
            }}
            style={{
              background: "#2563eb", color: "white", border: "none", padding: "8px 16px", borderRadius: "6px",
              fontSize: "12px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: 8
            }}
          >
             <span>✅ Combinar Selección ({ (r2-r1+1)*(c2-c1+1) } celdas)</span>
          </button>
          <button onClick={() => onRangeSelect?.(null)} style={{ background: "white", color: "#64748b", border: "1px solid #e2e8f0", padding: "8px", borderRadius: "6px", cursor: "pointer" }}>✕</button>
        </div>
      );
  }

  return (
    <div style={{ width: "100%", height: "100%", overflow: "visible", position: "relative" }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      {floatToolbar}
      <table style={tableStyle}>
        <tbody>{rows}</tbody>
      </table>
    </div>
  );
}
