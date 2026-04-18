import React, { useState, useRef, useLayoutEffect, memo } from "react";
import { Move, Activity, Layout, Grid, BarChart3 } from "lucide-react";
import ChartRenderer from "./Chart/ChartRenderer";

// HELPER: Selection logic
const getOffset = (root, target, offset) => {
  let current = 0;
  if (!root) return 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
  let n;
  while (n = walker.nextNode()) {
      if (n === target) return current + offset;
      current += n.textContent.length;
  }
  return current;
};

const setSelection = (root, startOffset, endOffset) => {
  if (!root) return;
  const setOff = (r, targetOffset) => {
      let curr = 0;
      const walker = document.createTreeWalker(r, NodeFilter.SHOW_TEXT, null, false);
      let n;
      while (n = walker.nextNode()) {
          const len = n.textContent.length;
          if (curr + len >= targetOffset) return { node: n, offset: Math.min(targetOffset - curr, len) };
          curr += len;
      }
      const lastWalker = document.createTreeWalker(r, NodeFilter.SHOW_TEXT, null, false);
      let lastN = r, lastL = 0;
      while(n = lastWalker.nextNode()) { lastN = n; lastL = n.textContent.length; }
      return { node: lastN, offset: lastL };
  };
  try {
      const sel = window.getSelection();
      const range = document.createRange();
      const start = setOff(root, startOffset);
      const end = setOff(root, endOffset);
      range.setStart(start.node, start.offset);
      range.setEnd(end.node, end.offset);
      sel.removeAllRanges();
      sel.addRange(range);
  } catch(e) {}
};

const EditableNode = ({ el, style, isSel, dataset = [], onChange, isExport, nodeRefs, selectionStates, inTable = false }) => {
    const nodeRef = useRef(null);
    const [isFocused, setIsFocused] = useState(false);
    const s = el.style || {};

    const interpolate = (text) => {
        if (typeof text !== 'string') return text;
        if (!dataset || dataset.length === 0) return text;
        const sample = dataset[0];
        return text.replace(/\{\{(.*?)\}\}/g, (match, key) => {
            const k = key.trim();
            // Try exact match
            if (sample[k] !== undefined) return sample[k];
            // Try case-insensitive match
            const lowerK = k.toLowerCase();
            const foundKey = Object.keys(sample).find(ok => ok.toLowerCase() === lowerK);
            if (foundKey) return sample[foundKey];
            return match;
        });
    };

    useLayoutEffect(() => {
        if (nodeRef.current) {
            const displayValue = (isFocused || isSel) ? (el.text || "") : interpolate(el.text || "");
            if (nodeRef.current.innerHTML !== displayValue) {
                nodeRef.current.innerHTML = displayValue;
                if (isSel && selectionStates.current[el.id]?.active) {
                    setSelection(nodeRef.current, selectionStates.current[el.id].start, selectionStates.current[el.id].end);
                }
            }
        }
    });

    const updateSelectionState = () => {
        const sel = window.getSelection();
        if (sel.rangeCount > 0 && nodeRef.current?.contains(sel.getRangeAt(0).commonAncestorContainer)) {
            const range = sel.getRangeAt(0);
            selectionStates.current[el.id] = {
                start: getOffset(nodeRef.current, range.startContainer, range.startOffset),
                end: getOffset(nodeRef.current, range.endContainer, range.endOffset),
                active: !range.collapsed
            };
        }
    };

    const vAlign = s.justifyContent === 'center' ? 'middle' : s.justifyContent === 'flex-end' ? 'bottom' : 'top';

    return (
        <div
          ref={node => { nodeRef.current = node; nodeRefs.current[el.id] = node; }}
          data-id={el.id}
          className="content-editable-area"
          contentEditable={isSel && !isExport}
          suppressContentEditableWarning
          onFocus={() => setIsFocused(true)}
          onBlur={() => { 
            setIsFocused(false); 
            // Save when blurred
            onChange(el.id, { text: nodeRef.current.innerHTML });
          }}
          onSelect={updateSelectionState}
          onInput={(e) => {
            updateSelectionState();
            onChange(el.id, { text: nodeRef.current.innerHTML });
          }}
          style={{
            flex: 1, 
            display: inTable ? "block" : "flex", 
            flexDirection: inTable ? "initial" : "column",
            justifyContent: inTable ? "initial" : (s.justifyContent || "flex-start"),
            outline: "none", padding: s.padding !== undefined ? s.padding : (inTable ? 2 : 10), minHeight: inTable ? 0 : "1em",
            textAlign: s.textAlign || "left", fontSize: s.fontSize || 14,
            color: s.color || "#000", fontFamily: s.fontFamily || "inherit",
            fontWeight: s.fontWeight || "400", fontStyle: s.fontStyle || "normal",
            textDecoration: s.textDecoration || "none",
            verticalAlign: inTable ? vAlign : "top", 
            lineHeight: s.lineHeight || "normal",
            letterSpacing: s.letterSpacing || "normal",
            textTransform: s.textTransform || "none",
            cursor: isSel ? "text" : "default",
            ...style
          }}
        />
    );
};

export default function WorkLayer({ elements = [], pages = [], activePageIdx = 0, dataset = [], selectedId, selectedCells = [], onSelect, onSelectCells, onChange, isExport = false, zoom = 1 }) {
  const safePages = pages.length > 0 ? pages : [{ id: "page-1", name: "PÁGINA 1" }];
  const activePage = safePages[activePageIdx] || safePages[0];
  const pageElements = elements.filter(el => !el.parentId || el.parentId === activePage.id);

  const [draggingId, setDraggingId] = useState(null);
  const [resizing, setResizing] = useState(null);
  const [cellSelectionStart, setCellSelectionStart] = useState(null); // { r, c, tableId }
  const dragOffset = useRef({ x: 0, y: 0 });
  const nodeRefs = useRef({});
  const selectionStates = useRef({});
  
  const interpolate = (text) => {
    if (typeof text !== 'string') return text;
    if (!dataset || dataset.length === 0) return text;
    const sample = dataset[0];
    return text.replace(/\{\{(.*?)\}\}/g, (match, key) => {
        const k = key.trim();
        if (sample[k] !== undefined) return sample[k];
        const lowerK = k.toLowerCase();
        const foundKey = Object.keys(sample).find(ok => ok.toLowerCase() === lowerK);
        if (foundKey) return sample[foundKey];
        return match;
    });
  };

  const startDrag = (e, el, forceDrag = false) => {
    if (!forceDrag && e.target.closest('.content-editable-area')) return;
    e.preventDefault();
    e.stopPropagation();
    setDraggingId(el.id);
    onSelect(el.id);
    
    const z = parseFloat(zoom) || 1;
    const initialDragOffset = { x: e.clientX / z - (el.x || 0), y: e.clientY / z - (el.y || 0) };

    const onMove = (moveEvent) => {
      onChange(el.id, { x: moveEvent.clientX / z - initialDragOffset.x, y: moveEvent.clientY / z - initialDragOffset.y });
    };

    const onUp = () => {
      setDraggingId(null);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const startResize = (e, el, dir) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing({ id: el.id, dir });
    
    const z = parseFloat(zoom) || 1;
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = el.w || 100;
    const startH = el.h || 50;
    const startPX = el.x || 0;
    const startPY = el.y || 0;

    const onMove = (moveEvent) => {
      const dx = (moveEvent.clientX - startX) / z;
      const dy = (moveEvent.clientY - startY) / z;
      const patch = {};
      const isTable = el.type === 'table';

      if (dir.includes('r')) patch.w = Math.max(2, startW + dx);
      if (dir.includes('b')) patch.h = Math.max(2, startH + dy);
      if (dir.includes('l')) { const newW = Math.max(2, startW - dx); patch.w = newW; patch.x = startPX + (startW - newW); }
      if (dir.includes('t')) { const newH = Math.max(2, startH - dy); patch.h = newH; patch.y = startPY + (startH - newH); }

      if (isTable && el.table) {
        const table = { ...el.table };
        let modifiedTable = false;
        const rows = table.rows || 1;
        const cols = table.cols || 1;

        if (patch.w !== undefined && startW > 0) {
          const scaleX = patch.w / startW;
          const currentWidths = table.colWidths || Array(cols).fill(startW / cols);
          table.colWidths = currentWidths.map(w => Math.round(w * scaleX));
          modifiedTable = true;
        }
        if (patch.h !== undefined && startH > 0) {
          const scaleY = patch.h / startH;
          const currentHeights = table.rowHeights || Array(rows).fill(startH / rows);
          table.rowHeights = currentHeights.map(h => Math.round(h * scaleY));
          modifiedTable = true;
        }
        if (modifiedTable) patch.table = table;
      }
      onChange(el.id, patch);
    };

    const onUp = () => {
      setResizing(null);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleMouseUp = () => { setDraggingId(null); setResizing(null); setCellSelectionStart(null); };

  const renderNode = (el) => {
    const isSel = selectedId === el.id;
    const s = el.style || {};
    const handleStyle = { position: "absolute", width: 8, height: 8, background: "#3b82f6", border: "1px solid white", zIndex: 100, transform: "translate(-50%, -50%)" };

    let nodeContent = null;
    if (el.type === "table") {
        const rows = el.table?.rows || 1;
        const cols = el.table?.cols || 1;
        const cellStyles = el.table?.cellStyles || {};
        const cellTexts = el.table?.cellTexts || {};
        const merges = el.table?.merges || [];

        const isMerged = (r, c) => merges.some(m => r >= m.r && r < m.r + m.rs && c >= m.c && c < m.c + m.cs && (r !== m.r || c !== m.c));
        const getMergeInfo = (r, c) => merges.find(m => m.r === r && m.c === c);

        const startResizeTable = (type, index, e) => {
            e.stopPropagation();
            e.preventDefault();
            const z = parseFloat(zoom) || 1;
            const startPos = type === 'col' ? e.clientX : e.clientY;
            const baseSize = type === 'col' ? (el.table?.colWidths?.[index] || (el.w || 100) / cols) : (el.table?.rowHeights?.[index] || (el.h || 50) / rows);
            const baseTableW = el.w || 100;
            const baseTableH = el.h || 50;
            
            const onMove = (moveEvent) => {
                const delta = ((type === 'col' ? moveEvent.clientX : moveEvent.clientY) - startPos) / z;
                const newSize = Math.max(2, baseSize + delta);
                const sizeDiff = newSize - baseSize;
                
                if (type === 'col') {
                    const nextWidths = [...(el.table?.colWidths || Array(cols).fill(baseTableW / cols))];
                    nextWidths[index] = newSize;
                    onChange?.(el.id, { 
                        w: Math.max(2, baseTableW + sizeDiff),
                        table: { ...el.table, colWidths: nextWidths } 
                    });
                } else {
                    const nextHeights = [...(el.table?.rowHeights || Array(rows).fill(baseTableH / rows))];
                    nextHeights[index] = newSize;
                    onChange?.(el.id, { 
                        h: Math.max(2, baseTableH + sizeDiff),
                        table: { ...el.table, rowHeights: nextHeights } 
                    });
                }
            };

            const onUp = () => {
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
                document.body.style.cursor = 'default';
            };

            document.body.style.cursor = type === 'col' ? 'col-resize' : 'row-resize';
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
        };

        nodeContent = (
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <table style={{ 
                width: '100%', height: '100%', 
                borderCollapse: 'separate', 
                borderSpacing: 0,
                tableLayout: 'fixed', 
                background: s.background || 'transparent',
                borderTop: (s.borderWidth ? `${s.borderWidth} ${s.borderStyle || 'solid'} ${s.borderColor || '#000'}` : '1px solid #94a3b8'),
                borderLeft: (s.borderWidth ? `${s.borderWidth} ${s.borderStyle || 'solid'} ${s.borderColor || '#000'}` : '1px solid #94a3b8'),
                borderRight: 'none',
                borderBottom: 'none',
                borderRadius: s.borderRadius || 0,
                overflow: 'visible'
            }}>
                <tbody>
                    {Array.from({ length: rows }).map((_, r) => (
                        <tr key={r}>
                            {Array.from({ length: el.table?.data?.[r]?.length || cols }).map((_, c) => {
                                if (isMerged(r, c)) return null;
                                const m = getMergeInfo(r, c);
                                const id = `${el.id}:cell:${r}:${c}`;
                                const isCellSel = selectedId === id || selectedCells.some(sc => sc.r === r && sc.c === c);
                                const rowCellsCount = el.table?.data?.[r]?.length || cols;
                                const autoColSpan = (c === rowCellsCount - 1) ? (cols - c) : 1;
                                
                                // Initialize widths/heights if missing
                                const colWidths = el.table?.colWidths || Array(cols).fill((el.w || 100) / cols);
                                const rowHeights = el.table?.rowHeights || Array(rows).fill((el.h || 50) / rows);
                                const cellS = cellStyles[`${r}:${c}`] || {};

                                return (
                                    <td 
                                      key={c}
                                      rowSpan={m?.rs || 1}
                                      colSpan={m?.cs || autoColSpan}
                                      onMouseDown={(e) => { 
                                          if (e.target.dataset.resizer) return;
                                          e.stopPropagation(); 
                                          onSelect?.(id);
                                          if (e.shiftKey) {
                                              onSelectCells?.([...selectedCells, { r, c, id }]);
                                          } else {
                                              setCellSelectionStart({ r, c, tableId: el.id });
                                              onSelectCells?.([{ r, c, id }]);
                                          }
                                      }} 
                                      onMouseEnter={() => {
                                          if (cellSelectionStart && cellSelectionStart.tableId === el.id) {
                                              const minR = Math.min(cellSelectionStart.r, r), maxR = Math.max(cellSelectionStart.r, r);
                                              const minC = Math.min(cellSelectionStart.c, c), maxC = Math.max(cellSelectionStart.c, c);
                                              const newSelection = [];
                                              for (let i = minR; i <= maxR; i++) {
                                                  for (let j = minC; j <= maxC; j++) {
                                                      newSelection.push({ r: i, c: j, id: `${el.id}:cell:${i}:${j}` });
                                                  }
                                              }
                                              onSelectCells?.(newSelection);
                                          }
                                      }}
                                      style={{ 
                                          width: colWidths[c],
                                          height: rowHeights[r],
                                          borderRight: (cellS.borderWidth ? `${cellS.borderWidth} ${cellS.borderStyle || 'solid'} ${cellS.borderColor || '#000'}` : (s.borderWidth ? `${s.borderWidth} ${s.borderStyle || 'solid'} ${s.borderColor || '#000'}` : '1px solid #94a3b8')),
                                          borderBottom: (cellS.borderWidth ? `${cellS.borderWidth} ${cellS.borderStyle || 'solid'} ${cellS.borderColor || '#000'}` : (s.borderWidth ? `${s.borderWidth} ${s.borderStyle || 'solid'} ${s.borderColor || '#000'}` : '1px solid #94a3b8')),
                                          padding: cellS.padding || 0, 
                                          position: 'relative', 
                                          boxShadow: isCellSel ? 'inset 0 0 0 2px #3b82f6' : 'none', 
                                          zIndex: isCellSel ? 10 : 1, 
                                          verticalAlign: (cellS.verticalAlign || (cellS.justifyContent === 'center' ? 'middle' : (cellS.justifyContent === 'flex-end' ? 'bottom' : 'top'))), 
                                          boxSizing: 'border-box',
                                          overflow: 'hidden',
                                          background: cellS.background || 'transparent',
                                          color: cellS.color,
                                          fontSize: cellS.fontSize,
                                          fontWeight: cellS.fontWeight,
                                          textAlign: cellS.textAlign || 'center',
                                          ...(cellS.border ? { border: cellS.border } : {})
                                      }}
                                    >
                                        <div style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
                                            {cellTexts[`${r}:${c}`]?.match(/^https?:\/\/.*?\.(png|jpg|jpeg|gif|svg|webp)/i) || cellTexts[`${r}:${c}`]?.startsWith('data:image') ? (
                                                <img src={cellTexts[`${r}:${c}`]} style={{ width: '100%', height: '100%', objectFit: cellS.objectFit || 'contain' }} alt="" />
                                            ) : (
                                                <EditableNode el={{ id, text: cellTexts[`${r}:${c}`] || "", style: cellS }} isSel={selectedId === id} dataset={dataset} isExport={isExport} nodeRefs={nodeRefs} selectionStates={selectionStates} inTable={true} onChange={(cid, p) => {
                                                    const newTexts = { ...cellTexts }; 
                                                    newTexts[`${r}:${c}`] = p.text;
                                                    onChange(el.id, { table: { ...el.table, cellTexts: newTexts } });
                                                }} />
                                            )}
                                        </div>
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>

             {/* Table Resize Overlay */}
             {!isExport && (selectedId === el.id || selectedId?.startsWith(`${el.id}:cell:`)) && (
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                    {/* Column Resizers */}
                    {(() => {
                        let currentX = 0;
                        return (el.table?.colWidths || Array(cols).fill((el.w || 100) / cols)).map((cw, idx) => {
                            currentX += cw;
                            return (
                                <div 
                                    key={`col-${idx}`}
                                    onMouseDown={(e) => startResizeTable('col', idx, e)}
                                    style={{ 
                                        position: 'absolute', left: currentX - 3, top: 0, bottom: 0, width: 6, 
                                        cursor: 'col-resize', zIndex: 1000, pointerEvents: 'auto',
                                        background: 'transparent'
                                    }}
                                    onMouseEnter={(e) => { e.target.firstChild.style.opacity = '1'; }}
                                    onMouseLeave={(e) => { e.target.firstChild.style.opacity = '0'; }}
                                >
                                    <div style={{ position: 'absolute', left: 3, top: 0, bottom: 0, width: 1, background: '#3b82f6', opacity: 0, transition: 'opacity 0.2s' }} />
                                </div>
                            );
                        });
                    })()}
                    {/* Row Resizers */}
                    {(() => {
                        let currentY = 0;
                        return (el.table?.rowHeights || Array(rows).fill((el.h || 50) / rows)).map((ch, idx) => {
                            currentY += ch;
                            return (
                                <div 
                                    key={`row-${idx}`}
                                    onMouseDown={(e) => startResizeTable('row', idx, e)}
                                    style={{ 
                                        position: 'absolute', top: currentY - 3, left: 0, right: 0, height: 6, 
                                        cursor: 'row-resize', zIndex: 1000, pointerEvents: 'auto',
                                        background: 'transparent'
                                    }}
                                    onMouseEnter={(e) => { e.target.firstChild.style.opacity = '1'; }}
                                    onMouseLeave={(e) => { e.target.firstChild.style.opacity = '0'; }}
                                >
                                    <div style={{ position: 'absolute', top: 3, left: 0, right: 0, height: 1, background: '#3b82f6', opacity: 0, transition: 'opacity 0.2s' }} />
                                </div>
                            );
                        });
                    })()}
                </div>
             )}
            </div>
        );
    } else if (el.type === "chart") {
        nodeContent = <ChartRenderer el={el} dataset={dataset} />;
    } else {
        nodeContent = <EditableNode el={el} isSel={isSel} dataset={dataset} isExport={isExport} nodeRefs={nodeRefs} selectionStates={selectionStates} onChange={onChange} />;
    }

    const Handle = ({ dir, cursor }) => (
        <div onMouseDown={(e) => startResize(e, el, dir)} style={{ ...handleStyle, left: dir.includes('r') ? '100%' : dir.includes('l') ? '0%' : '50%', top: dir.includes('b') ? '100%' : dir.includes('t') ? '0%' : '50%', cursor }} />
    );

    return (
      <div 
        key={el.id}
        onMouseDown={(e) => startDrag(e, el)}
        style={{
          position: "absolute", left: el.x || 0, top: el.y || 0, width: el.w || 100, height: el.h || 50,
          zIndex: el.z || 0, outline: isSel && !isExport && el.type !== 'table' ? "2px solid #3b82f6" : "none",
          background: 'transparent', 
          borderRadius: s.borderRadius || 0, display: "flex", flexDirection: "column", overflow: "visible",
          boxShadow: s.boxShadow || "none", opacity: s.opacity !== undefined ? s.opacity : 1,
          justifyContent: s.justifyContent || "flex-start", boxSizing: 'border-box'
        }}
      >
        {nodeContent}
        {isSel && !isExport && (
          <>
            <div onMouseDown={(e) => { e.stopPropagation(); startDrag(e, el, true); }} style={{ position: "absolute", top: -30, left: "50%", transform: "translateX(-50%)", background: "#3b82f6", color: "white", padding: "4px 8px", borderRadius: 4, cursor: "move", display: "flex", gap: 5, fontSize: 10, fontWeight: "bold", zIndex: 1000 }}><Move size={12} /> MOVER</div>
            <Handle dir="tl" cursor="nwse-resize" />
            <Handle dir="tr" cursor="nesw-resize" />
            <Handle dir="bl" cursor="nesw-resize" />
            <Handle dir="br" cursor="nwse-resize" />
            <Handle dir="t" cursor="ns-resize" />
            <Handle dir="b" cursor="ns-resize" />
            <Handle dir="l" cursor="ew-resize" />
            <Handle dir="r" cursor="ew-resize" />
          </>
        )}
      </div>
    );
  };

  useLayoutEffect(() => {
    window.__EDITOR_SELECTED_CELLS__ = selectedCells;
  }, [selectedCells]);

  const handleMerge = () => {
    if (selectedCells.length < 2) return;
    const targetId = selectedCells[0].id.split(':cell:')[0];
    const tableEl = elements.find(e => e.id === targetId);
    if (!tableEl) return;
    const rows = selectedCells.map(c => c.r);
    const cols = selectedCells.map(c => c.c);
    const minR = Math.min(...rows), maxR = Math.max(...rows);
    const minC = Math.min(...cols), maxC = Math.max(...cols);
    const newMerge = { r: minR, c: minC, rs: maxR - minR + 1, cs: maxC - minC + 1 };
    const table = tableEl.table || {};
    const filteredMerges = (table.merges || []).filter(m => !(m.r >= minR && m.r <= maxR && m.c >= minC && m.c <= maxC));
    onChange?.(targetId, { table: { ...table, merges: [...filteredMerges, newMerge] } });
    onSelectCells?.([]);
  };

  const hasMergeInSelection = (() => {
    if (selectedCells.length < 2) return false;
    const targetId = selectedCells[0]?.id.split(':cell:')[0];
    const tableEl = elements.find(e => e.id === targetId);
    const table = tableEl?.table || {};
    return (table.merges || []).some(m => 
        selectedCells.some(sc => sc.r === m.r && sc.c === m.c && (m.rs > 1 || m.cs > 1))
    );
  })();

  return (
    <div onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} style={{ position: "relative", width: "100%", height: "100%" }}>
      {pageElements.map(renderNode)}
      
      {!isExport && selectedCells.length >= 2 && !cellSelectionStart && (
        <div style={{
            position: "absolute", zIndex: 9999, padding: "8px", background: "white", borderRadius: "12px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.15)", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "8px",
            top: (elements.find(e => e.id === selectedCells[0].id.split(':cell:')[0])?.y || 0) - 60,
            left: (elements.find(e => e.id === selectedCells[0].id.split(':cell:')[0])?.x || 0)
        }}>
            <div style={{ display: "flex", gap: 8 }}>
                <button 
                    onClick={handleMerge}
                    disabled={hasMergeInSelection}
                    style={{ background: hasMergeInSelection ? "#e2e8f0" : "#3b82f6", color: hasMergeInSelection ? "#94a3b8" : "white", border: "none", padding: "6px 12px", borderRadius: "8px", fontSize: "11px", fontWeight: "bold", cursor: hasMergeInSelection ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6 }}
                >
                    <Layout size={14} /> UNIR CELDAS
                </button>
                <button 
                    onClick={() => onSelectCells?.([])}
                    style={{ background: "#f1f5f9", color: "#64748b", border: "none", padding: "6px 12px", borderRadius: "8px", fontSize: "11px", fontWeight: "bold", cursor: "pointer" }}
                >
                    CANCELAR
                </button>
            </div>
            {hasMergeInSelection && <div style={{ fontSize: '9px', color: '#ef4444', fontWeight: 'bold', textAlign: 'center' }}>⚠️ ALGUNAS CELDAS YA ESTÁN UNIDAS</div>}
        </div>
      )}
    </div>
  );
}
