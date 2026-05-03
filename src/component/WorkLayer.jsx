import React, { useState, useRef, useLayoutEffect, useMemo } from "react";
import { Move, Layout, Zap, Check } from "lucide-react";
import ChartRenderer from "./Chart/ChartRenderer";
import TableRenderer from "./Table/TableRenderer";
import BarcodeRenderer from "./Barcode/BarcodeRenderer";

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

const EditableNode = ({ el, style, isSel, dataset = [], onChange, isExport, nodeRefs, selectionStates, inTable = false, onDoubleClick }) => {
    const nodeRef = useRef(null);
    const [isFocused, setIsFocused] = useState(false);
    const s = el.style || {};

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

    const suppressNextUpdate = useRef(false);

    useLayoutEffect(() => {
        if (nodeRef.current) {
            // If PropertiesPanel just ran execCommand, skip the innerHTML overwrite
            // for this render cycle so the browser's format change isn't undone
            if (suppressNextUpdate.current) {
                suppressNextUpdate.current = false;
                return;
            }
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
            window.__LAST_EDITABLE_REF__ = nodeRef.current;
            window.__LAST_TABLE_RANGE__ = range;
            
            // CAPTURE FORMAT STATE IN GLOBAL REF FOR PANEL SYNC
            window.__LAST_FORMAT_STATE__ = {
                bold: document.queryCommandState("bold"),
                italic: document.queryCommandState("italic"),
                underline: document.queryCommandState("underline"),
                strike: document.queryCommandState("strikeThrough"),
                align: document.queryCommandValue("textAlign") || s.textAlign || 'left'
            };

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
          contentEditable={!isExport ? "true" : "false"}
          suppressContentEditableWarning
          onFocus={() => {
            setIsFocused(true);
            window.__LAST_EDITABLE_REF__ = nodeRef.current;
            window.__LAST_EDITABLE_ID__ = el.id;
            window.__SUPPRESS_EDITABLE_UPDATE__ = () => { suppressNextUpdate.current = true; };
            updateSelectionState();
          }}
          onClick={(e) => {
            window.__LAST_EDITABLE_REF__ = nodeRef.current;
            window.__LAST_EDITABLE_ID__ = el.id;
            window.__SUPPRESS_EDITABLE_UPDATE__ = () => { suppressNextUpdate.current = true; };
            updateSelectionState();
          }}
          onMouseUp={(e) => {
            window.__LAST_EDITABLE_REF__ = nodeRef.current;
            window.__LAST_EDITABLE_ID__ = el.id;
            window.__SUPPRESS_EDITABLE_UPDATE__ = () => { suppressNextUpdate.current = true; };
            updateSelectionState();
          }}
          onBlur={() => { 
            setIsFocused(false); 
            if (isSel) onChange(el.id, { text: nodeRef.current.innerHTML }, false);
          }}
          onSelect={updateSelectionState}
          onInput={(e) => {
            if (!isSel) return; // Only save when selected
            updateSelectionState();
            onChange(el.id, { text: nodeRef.current.innerHTML }, true);
          }}
          style={{
            outline: "none", 
            minHeight: "1em",
            textAlign: s.textAlign || "left", 
            fontSize: s.fontSize || 14,
            color: s.color || "#000", 
            fontFamily: s.fontFamily || "inherit",
            fontWeight: s.fontWeight || "400", 
            fontStyle: s.fontStyle || "normal",
            textDecoration: s.textDecoration || "none",
            lineHeight: s.lineHeight || "normal",
            letterSpacing: s.letterSpacing || "normal",
            textTransform: s.textTransform || "none",
            display: "block",
            width: "100%",
            cursor: isSel ? "text" : "default",
            userSelect: isSel ? "text" : "none",
            pointerEvents: isSel ? "auto" : "none",
            ...Object.fromEntries(Object.entries(s).filter(([k]) => !['border', 'borderWidth', 'borderStyle', 'borderColor', 'borderTop', 'borderRight', 'borderBottom', 'borderLeft', 'borderRadius', 'background', 'backgroundColor', 'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'boxShadow', 'opacity'].includes(k))),
            ...style
          }}
        />
    );
};

export default function WorkLayer({ elements = [], pages = [], activePageIdx = 0, dataset = [], selectedId, selectedCells = [], onSelect, onSelectCells, onChange, onAddElement, onDoubleClick, isExport = false, zoom = 1, selectionRange = null, onRangeSelect = null, onSelectionChange = null }) {
  const safePages = pages.length > 0 ? pages : [{ id: "page-1", name: "PÁGINA 1" }];
  const activePage = safePages[activePageIdx] || safePages[0];
  const selectedElementId = selectedId;
  const onUpdateElement = onChange;
  const pageElements = elements.filter(el => {
    if (el.pageId) return el.pageId === activePage.id;
    return activePageIdx === 0;
  });

  const [draggingId, setDraggingId] = useState(null);
  const [resizing, setResizing] = useState(null);
  const [cellSelectionStart, setCellSelectionStart] = useState(null);
  const nodeRefs = useRef({});
  const selectionStates = useRef({});

  const startDrag = (e, el, forceDrag = false) => {
    if (!forceDrag && e.target.closest('.content-editable-area')) return;
    e.preventDefault(); e.stopPropagation();
    setDraggingId(el.id); onSelect(el.id);
    const z = parseFloat(zoom) || 1;
    const initialDragOffset = { x: e.clientX / z - (el.x || 0), y: e.clientY / z - (el.y || 0) };
    const onMove = (me) => onChange(el.id, { x: me.clientX / z - initialDragOffset.x, y: me.clientY / z - initialDragOffset.y });
    const onUp = () => { setDraggingId(null); window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
  };

  const startResize = (e, el, dir) => {
    e.preventDefault(); e.stopPropagation();
    setResizing({ id: el.id, dir });
    const z = parseFloat(zoom) || 1;
    const sX = e.clientX, sY = e.clientY, sW = el.w || 100, sH = el.h || 50, sPX = el.x || 0, sPY = el.y || 0;
    const onMove = (me) => {
      const dx = (me.clientX - sX) / z, dy = (me.clientY - sY) / z;
      const patch = {};
      if (dir.includes('r')) patch.w = Math.max(2, sW + dx);
      if (dir.includes('b')) patch.h = Math.max(2, sH + dy);
      if (dir.includes('l')) { const nw = Math.max(2, sW - dx); patch.w = nw; patch.x = sPX + (sW - nw); }
      if (dir.includes('t')) { const nh = Math.max(2, sH - dy); patch.h = nh; patch.y = sPY + (sH - nh); }
      onChange(el.id, patch);
    };
    const onUp = () => { setResizing(null); window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
  };

  const Handle = ({ el, dir, cursor }) => (
    <div className="no-export" onMouseDown={(e) => {
        window.__LAST_EDITABLE_REF__ = nodeRefs.current[el.id];
        startResize(e, el, dir);
    }} 
         style={{ position: "absolute", width: 8, height: 8, background: "#3b82f6", border: "1px solid white", zIndex: 100, transform: "translate(-50%, -50%)",
                  left: dir.includes('r') ? '100%' : dir.includes('l') ? '0%' : '50%', 
                  top: dir.includes('b') ? '100%' : dir.includes('t') ? '0%' : '50%', cursor }} />
  );
  const evaluateCondition = (el, ds) => {
    let condition = el.logic?.condition;
    if (!condition || condition.trim() === "" || condition.trim() === "(VACIO)") return true;
    
    // Cleanup: remove {{ }}, handle common JS operators if needed
    condition = condition.replace(/\{\{(.*?)\}\}/g, '$1');

    try {
        const currentDataArray = Array.isArray(ds) ? ds : (ds ? [ds] : (dataset || []));
        const record = currentDataArray[0] || {};
        
        // Proxy to handle case-insensitivity (e.g., ID vs id)
        const proxyData = new Proxy(record, {
            get: (target, prop) => {
                if (typeof prop !== 'string') return target[prop];
                // Try exact match first
                if (prop in target) return target[prop];
                // Try case-insensitive match
                const keys = Object.keys(target);
                const iKey = keys.find(k => k.toLowerCase() === prop.toLowerCase());
                return iKey ? target[iKey] : undefined;
            }
        });

        // Evaluate with Proxy
        let fn;
        try {
            // eslint-disable-next-line no-new-func
            fn = new Function('DATA', `
                try {
                    with(DATA) {
                        return (${condition});
                    }
                } catch(e) { 
                    return false; 
                }
            `);
        } catch (syntaxError) {
            // User is likely mid-typing a condition (e.g. "TOTAL > ")
            // Suppress the error to prevent Vite overlay and return false
            return false;
        }
        
        return !!fn(proxyData);
    } catch (e) {
        return false;
    }
  };

  const renderRecursive = (parentId, currentDs, isGhostParent = false, branch = null, isSplitLogicRel = false, keyPrefix = "") => {
    const children = elements.filter(el => {
        const matchesParent = (el.parentId || null) === (parentId || null);
        const matchesBranch = branch === null || (el.branch || 'true') === branch;
        
        // Children of logical nodes/loops follow their parent's page
        if (parentId) return matchesParent && matchesBranch;
        
        // Root elements filter by page
        const isMyPage = (el.pageId === activePage.id) || (!el.pageId && activePageIdx === 0);
        return matchesParent && isMyPage;
    });

    // Sort by Z index (ascending for rendering order)
    const sorted = [...children].sort((a,b) => (a.z || 0) - (b.z || 0));

    let lastChainMatched = false; // Tracks if an IF/ELSE-IF in the current chain already matched

    return sorted.flatMap(el => {
        const isSel = selectedId === el.id;
        const s = el.style || {};

        // Calculate visibility
        const conditionMet = evaluateCondition(el, currentDs);
        
        // If this node is forced hidden by its parent branch, hide it and its children
        if (isGhostParent && !el.type.startsWith('logical-')) {
            return [];
        }

        // Logical nodes themselves should not be strictly hidden here, 
        // because they handle their own branches inside their CASE blocks.
        // CASE 1: LOGICAL NODES (IF/ELSE-IF/ELSE) - NOW INVISIBLE ON CANVAS
        if (el.type === 'logical-if' || el.type === 'logical-else-if' || el.type === 'logical-else') {
            let res = false;
            
            if (el.type === 'logical-if') {
                res = evaluateCondition(el, currentDs);
                lastChainMatched = res;
            } else if (el.type === 'logical-else-if') {
                res = !lastChainMatched && evaluateCondition(el, currentDs);
                if (res) lastChainMatched = true;
            } else { // logical-else
                res = !lastChainMatched;
                lastChainMatched = true;
            }

            // In designer, we show both branches but ghost the inactive one
            // In export, we only show the active branch
            if (el.type === 'logical-if') {
                return [
                    ...renderRecursive(el.id, currentDs, !res || isGhostParent, 'true', false, `${keyPrefix}t-`),
                    ...renderRecursive(el.id, currentDs, res || isGhostParent, 'false', false, `${keyPrefix}f-`)
                ];
            } else {
                return renderRecursive(el.id, currentDs, !res || isGhostParent, null, false, keyPrefix);
            }
        }

        // Reset chain if a non-logical element is encountered? 
        // Usually, IF/ELSE-IF/ELSE should be consecutive in the sorted list.
        if (!el.type.startsWith('logical-')) {
            // lastChainMatched = false; // Optional: keeps chains strictly local
        }

        // CASE 4: LOGICAL LOOP
        if (el.type === 'logical-loop') {
            const loopCfg = el.logic?.loop || {};
            let list = [];
            
            if (loopCfg.type === 'count') {
                const count = parseInt(loopCfg.count) || 0;
                list = Array.from({ length: count }, (_, i) => ({ _idx: i }));
            } else {
                const loopSource = loopCfg.source;
                list = (currentDs?.[0]?.[loopSource] || []).map((item, idx) => ({ ...item, _idx: idx }));
            }
            
            if (Array.isArray(list) && list.length > 0) {
                return list.flatMap((item, idx) => {
                    // Pass the item as the new data currentDs for children
                    return renderRecursive(el.id, [item], isGhostParent, null, false, `${keyPrefix}${idx}-`);
                });
            }
            return [];
        }

        // CASE 5: NORMAL ELEMENT
        const loopSource = el.logic?.loop?.source;
        let instances = [{ ...el, _idx: 0, _data: currentDs?.[0] || dataset?.[0] }];
        
        // Backward compatibility for per-element loop logic
        if (loopSource && !el.parentId) {
            const list = dataset?.[0]?.[loopSource];
            if (Array.isArray(list)) {
                instances = list.map((item, idx) => ({
                    ...el, _idx: idx, _data: item,
                    y: (el.y || 0) + (idx * (el.logic.loop.spacing || (el.h || 50) + 10))
                }));
            }
        }

        return instances.map((ins, idx) => {
            const activeData = ins._data ? [ins._data] : currentDs;
            const sanitizedData = Array.isArray(activeData) ? activeData : (activeData ? [activeData] : (dataset || []));
            
            // STRICT HIDING: If the element's own condition is not met, hide it
            if (!evaluateCondition(el, sanitizedData)) {
                return null;
            }

            let renderX = ins.x || 0;
            let renderY = ins.y || 0;
            const s = ins.style || {};
            
            let content = null;
            switch (el.type) {
                case 'text': 
                    content = (
                        <div 
                            onClick={(e) => { 
                                const node = nodeRefs.current[ins.id];
                                if (node) { 
                                    node.focus(); 
                                    window.__LAST_EDITABLE_REF__ = node;
                                    window.__LAST_EDITABLE_ID__ = ins.id;
                                }
                            }}
                            style={{ 
                                width: '100%', height: '100%', display: 'flex', flexDirection: 'column', 
                                background: s.background || 'transparent', 
                                border: s.border || 'none', 
                                borderWidth: s.borderWidth,
                                borderStyle: s.borderStyle,
                                borderColor: s.borderColor,
                                borderRadius: s.borderRadius || 0, 
                                opacity: s.opacity || 1, 
                                boxShadow: s.boxShadow,
                                justifyContent: s.justifyContent || 'flex-start', padding: s.padding !== undefined ? s.padding : 10,
                                boxSizing: 'border-box', cursor: 'text'
                            }}
                        >
                            <EditableNode 
                                el={ins} dataset={sanitizedData} isSel={isSel && idx === 0} onChange={onChange} 
                                isExport={isExport} nodeRefs={nodeRefs} selectionStates={selectionStates} 
                                style={{ flex: '0 0 auto', width: '100%', padding: 0 }} 
                            />
                        </div>
                    ); 
                    break;
                case 'table': content = <TableRenderer el={ins} dataRecord={Array.isArray(sanitizedData) ? sanitizedData[0] : sanitizedData} onSelect={onSelect} onChange={onChange} selectedId={selectedId} selectionRange={selectionRange} onRangeSelect={onRangeSelect} onSelectionChange={onSelectionChange} />; break;
                case 'chart': content = <ChartRenderer el={ins} dataset={sanitizedData} isExport={isExport} />; break;
                case 'barcode': content = <BarcodeRenderer el={ins} dataset={sanitizedData} isExport={isExport} />; break;
                case 'box': 
                    content = (
                        <div 
                            onClick={(e) => { 
                                const node = nodeRefs.current[ins.id];
                                if (node) { 
                                    node.focus(); 
                                    window.__LAST_EDITABLE_REF__ = node;
                                    window.__LAST_EDITABLE_ID__ = ins.id;
                                }
                            }}
                            style={{ 
                                width: '100%', height: '100%', 
                                background: s.background || '#e2e8f0', 
                                border: s.border || 'none', 
                                borderWidth: s.borderWidth,
                                borderStyle: s.borderStyle,
                                borderColor: s.borderColor,
                                borderRadius: s.borderRadius || 0, 
                                opacity: s.opacity || 1, 
                                boxShadow: s.boxShadow,
                                display: 'flex', flexDirection: 'column',
                                justifyContent: s.justifyContent || 'flex-start', padding: s.padding !== undefined ? s.padding : 0,
                                boxSizing: 'border-box', cursor: 'text'
                            }}
                        >
                            <EditableNode 
                                el={ins} dataset={sanitizedData} isSel={isSel && idx === 0} onChange={onChange} 
                                isExport={isExport} nodeRefs={nodeRefs} selectionStates={selectionStates} 
                                style={{ flex: '0 0 auto', width: '100%', padding: 0 }} 
                            />
                        </div>
                    ); 
                    break;
                case 'image':
                    content = <img src={ins.src} style={{ width: '100%', height: '100%', objectFit: s.objectFit || 'cover', opacity: s.opacity || 1, borderRadius: s.borderRadius || 0 }} alt="" />;
                    break;
                case 'sticker':
                    content = <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: ins.w * 0.8 }}>{ins.sticker || '✨'}</div>;
                    break;
                default: content = null;
            }

            if (!content && !el.type.startsWith('logical-')) return null;

            return (
                <div 
                    key={`${keyPrefix}${ins.id}-${idx}`}
                    className={`work-node ${isSel && !isExport && idx === 0 ? 'selected' : ''}`}
                    onMouseDown={(e) => idx === 0 && startDrag(e, el)}
                    style={{
                        position: 'absolute',
                        left: renderX,
                        top: renderY,
                        width: ins.w,
                        height: ins.h,
                        zIndex: ins.z || 0,
                        outline: isSel && !isExport && el.type !== 'table' && idx === 0 ? "2px solid #3b82f6" : "none",
                        background: 'transparent',
                        borderRadius: s.borderRadius || 0,
                        pointerEvents: (idx > 0 && !isExport) ? 'none' : 'auto',
                        transition: "left 0.2s, top 0.2s",
                        display: 'flex',
                        flexDirection: 'column'
                    }}
                >
                    {content}
                    {/* Render children of this element (e.g. nested in a Box) */}
                    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                        <div style={{ position: 'relative', width: '100%', height: '100%', pointerEvents: 'none' }}>
                             {renderRecursive(el.id, sanitizedData)}
                        </div>
                    </div>

                    {isSel && !isExport && idx === 0 && (
                        <>
                            <div className="no-export" onMouseDown={(e) => { 
                                window.__LAST_EDITABLE_REF__ = nodeRefs.current[el.id];
                                e.stopPropagation(); 
                                startDrag(e, el, true); 
                            }} style={{ position: "absolute", top: -30, left: "50%", transform: "translateX(-50%)", background: "#3b82f6", color: "white", padding: "4px 8px", borderRadius: 4, cursor: "move", display: "flex", gap: 5, fontSize: 10, fontWeight: "bold", zIndex: 1000 }}><Move size={12} /> MOVER</div>
                            <Handle el={el} dir="tl" cursor="nwse-resize" />
                            <Handle el={el} dir="tr" cursor="nesw-resize" />
                            <Handle el={el} dir="bl" cursor="nesw-resize" />
                            <Handle el={el} dir="br" cursor="nwse-resize" />
                        </>
                    )}
                </div>
            );
        });
    });
  };

  const handleMerge = () => {
    if (selectedCells.length < 2) return;
    const tid = selectedCells[0].id.split(':cell:')[0];
    const el = elements.find(e => e.id === tid);
    if (!el) return;
    const rs = selectedCells.map(c => c.r), cs = selectedCells.map(c => c.c);
    const minR = Math.min(...rs), maxR = Math.max(...rs), minC = Math.min(...cs), maxC = Math.max(...cs);
    const nm = { r: minR, c: minC, rs: maxR - minR + 1, cs: maxC - minC + 1 };
    const table = el.table || {};
    const fm = (table.merges || []).filter(m => !(m.r >= minR && m.r <= maxR && m.c >= minC && m.c <= maxC));
    onChange?.(tid, { table: { ...table, merges: [...fm, nm] } });
    onSelectCells?.([]);
  };

  return (
    <div onMouseUp={() => { setDraggingId(null); setResizing(null); }} onMouseLeave={() => { setDraggingId(null); setResizing(null); }} style={{ position: "relative", width: "100%", height: "100%" }}>
      {renderRecursive(null, dataset)}
      
      {!isExport && selectedCells.length >= 2 && (
        <div style={{ position: "absolute", zIndex: 9999, padding: "8px", background: "white", borderRadius: "12px", boxShadow: "0 10px 30px rgba(0,0,0,0.15)", border: "1px solid #e2e8f0", top: (elements.find(e => e.id === selectedCells[0].id.split(':cell:')[0])?.y || 0) - 60, left: (elements.find(e => e.id === selectedCells[0].id.split(':cell:')[0])?.x || 0) }}>
            <button onClick={handleMerge} style={{ background: "#3b82f6", color: "white", border: "none", padding: "6px 12px", borderRadius: "8px", fontSize: "11px", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                <Layout size={14} /> UNIR CELDAS
            </button>
        </div>
      )}
    </div>
  );
}
