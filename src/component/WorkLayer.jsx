// WorkLayer.jsx
import { useRef, useState, useMemo } from "react";
import { Move } from "lucide-react";
import TableRenderer from "./Table/TableRenderer";
import ChartRenderer from "./Chart/ChartRenderer";

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export default function WorkLayer({
  elements,
  selectedId,
  onSelect,
  onChange,
  placing = false,
  onPlaceAt,
  onOpenProps,
  selectionRange = null,
  onRangeSelect = null,
  isExport = false,
  onSelectionChange = null
}) {
  const layerRef = useRef(null);
  const [editingId, setEditingId] = useState(null);
  const [editingCell, setEditingCell] = useState(null);
  const [draggingId, setDraggingId] = useState(null); 
  const [hoverContainerId, setHoverContainerId] = useState(null); 

  const byZ = (a, b) => (a.z ?? 0) - (b.z ?? 0);
  
  const byId = useMemo(() => {
    const m = new Map();
    for (const e of elements) m.set(e.id, e);
    return m;
  }, [elements]);

  const isContainer = (el) => el?.type === "box" || el?.type === "table";

  const getAbsRect = (el) => {
    if (!el) return { left: 0, top: 0, w: 0, h: 0 };
    let left = el.x ?? 0, top = el.y ?? 0;
    let p = el.parentId ? byId.get(el.parentId) : null;
    while (p) {
      left += p.x ?? 0;
      top += p.y ?? 0;
      p = p.parentId ? byId.get(p.parentId) : null;
    }
    return { left, top, w: el.w ?? 10, h: el.h ?? 10 };
  };

  const pointInRect = (x, y, r) => x >= r.left && x <= r.left + r.w && y >= r.top && y <= r.top + r.h;

  const isDescendant = (childId, parentId) => {
    let p = byId.get(childId)?.parentId;
    while (p) {
      if (p === parentId) return true;
      p = byId.get(p)?.parentId;
    }
    return false;
  };

  const onChangeClamped = (id, patch) => {
    const el = byId.get(id);
    if (!el) return;
    onChange(id, patch);
  };

  // ZOOM GLOBAL ACCESS (passed via window or context)
  const zoom = window.__DESIGNER_ZOOM__ || 1;

  const startDrag = (e, el, forceDrag = false) => {
    const isInsideContent = e.target.closest('.content-editable-area') || e.target.tagName === 'TD';
    
    // If not already selected, we SELECT it on click, but we NEVER drag from the content area unless forceDrag is true
    if (!forceDrag && isInsideContent) {
        e.stopPropagation();
        if (selectedId !== el.id) onSelect?.(el.id);
        return; // DONT START DRAGGING if clicking inside text areas
    }

    if (!forceDrag) {
        e.preventDefault();
    }

    if (editingId || editingCell || isExport) return;
    e.stopPropagation();
    onSelect?.(el.id);
    setDraggingId(el.id);

    const startX = e.clientX, startY = e.clientY;
    const sx = el.x ?? 0, sy = el.y ?? 0;
    const startAbs = getAbsRect(el);

    const onMove = (ev) => {
      const dx = (ev.clientX - startX) / zoom;
      const dy = (ev.clientY - startY) / zoom;
      onChangeClamped(el.id, { x: sx + dx, y: sy + dy });

      let candidate = null;
      const host = layerRef.current;
      if (host) {
          const rect = host.getBoundingClientRect();
          const mx = (ev.clientX - rect.left) / zoom;
          const my = (ev.clientY - rect.top) / zoom;
          for (let i = elements.length - 1; i >= 0; i--) {
            const cand = elements[i];
            if (!isContainer(cand) || cand.id === el.id || isDescendant(cand.id, el.id)) continue;
            const R = getAbsRect(cand);
            if (pointInRect(mx, my, R)) { candidate = cand; break; }
          }
      }
      setHoverContainerId(candidate?.id ?? null);
    };

    const onUp = (ev) => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      
      const dx = (ev.clientX - startX) / zoom;
      const dy = (ev.clientY - startY) / zoom;
      const finalAbsLeft = startAbs.left + dx;
      const finalAbsTop = startAbs.top + dy;
      
      const targetId = hoverContainerId;
      setDraggingId(null);
      setHoverContainerId(null);

      if (targetId) {
        const target = byId.get(targetId);
        const PR = getAbsRect(target);
        onChange(el.id, { 
            x: clamp(finalAbsLeft - PR.left, 0, (target.w ?? 10) - (el.w ?? 10)), 
            y: clamp(finalAbsTop - PR.top, 0, (target.h ?? 10) - (el.h ?? 10)), 
            parentId: target.id 
        });
      } else if (el.parentId) {
        onChange(el.id, { x: finalAbsLeft, y: finalAbsTop, parentId: undefined });
      }
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const startResize = (e, el, dir = "br") => {
    if (editingId || editingCell || isExport) return;
    e.stopPropagation();
    const startX = e.clientX, startY = e.clientY;
    const { x, y, w, h } = el;
    
    const onMove = (ev) => {
        const dx = (ev.clientX - startX) / zoom;
        const dy = (ev.clientY - startY) / zoom;
        
        let patch = {};
        if (dir.includes("r")) patch.w = Math.max(10, (w ?? 10) + dx);
        if (dir.includes("b")) patch.h = Math.max(10, (h ?? 10) + dy);
        if (dir.includes("l")) {
            const newW = (w ?? 10) - dx;
            if (newW > 10) { patch.w = newW; patch.x = (x ?? 0) + dx; }
        }
        if (dir.includes("t")) {
            const newH = (h ?? 10) - dy;
            if (newH > 10) { patch.h = newH; patch.y = (y ?? 0) + dy; }
        }
        onChangeClamped(el.id, patch);
    };
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const renderNode = (el) => {
    const isSel = el.id === selectedId;
    const s = el.style || {};
    const children = elements.filter(c => c.parentId === el.id).sort(byZ);

    const frame = {
      position: "absolute", left: el.x ?? 0, top: el.y ?? 0, width: el.w ?? 10, height: el.h ?? 10,
      zIndex: el.z ?? 0, outline: isSel ? "2px solid #3b82f6" : "none", outlineOffset: -1,
      pointerEvents: "auto"
    };

    let content = null;
    if (el.type === "chart") {
      content = <div style={{ width: "100%", height: "100%", borderRadius: s.borderRadius ?? 4, overflow: "hidden", pointerEvents: "none" }}><ChartRenderer el={el} /></div>;
    } else if (el.type === "table") {
      content = <div style={{ width: "100%", height: "100%", pointerEvents: "auto" }}><TableRenderer el={el} onSelect={onSelect} onChange={(p) => onChange(el.id, p)} selectedId={selectedId} selectionRange={selectionRange} onRangeSelect={onRangeSelect} /></div>;
    } else if (el.type === "image") {
      content = el.src ? <img src={el.src} style={{ width: "100%", height: "100%", objectFit: s.fit || "contain" }} draggable={false} alt=""/> : <div dangerouslySetInnerHTML={{ __html: el.text }} style={{ width: "100%", height: "100%" }} />;
    } else {
        content = (
            <div 
              contentEditable={isSel && !isExport} 
              suppressContentEditableWarning 
              onInput={(e) => onChange(el.id, { text: e.target.innerHTML })}
              onBlur={(e) => onChange(el.id, { text: e.target.innerHTML })}
              onMouseUp={() => onSelectionChange?.(window.getSelection())}
              onKeyUp={() => onSelectionChange?.(window.getSelection())}
              dangerouslySetInnerHTML={{ __html: el.text || "" }} 
              className="content-editable-area"
              style={{ 
                width: "100%", height: "100%", outline: "none", 
                padding: 10, // Always add padding to make it clickable
                display: "block",
                minHeight: "1.2em",
                background: el.type === "box" ? (s.background || "#fff") : "transparent",
                border: el.type === "box" ? `${s.borderWidth || 0}px solid ${s.borderColor || "transparent"}` : "none",
                borderRadius: s.borderRadius ?? 0, overflow: "visible",
                // GLOBAL TEXT STYLES (now inherited by children via CSS class)
                textAlign: s.textAlign || "left", fontSize: s.fontSize || 14,
                color: s.color || "#000", fontFamily: s.fontFamily || "inherit",
                fontWeight: s.fontWeight || "400",
                fontStyle: s.fontStyle || "normal",
                textDecoration: s.textDecoration || "none",
                lineHeight: "1.4",
                cursor: isSel ? "text" : "default"
              }} 
            />
        );
    }

    const Handle = ({ dir, style }) => (
        <div 
            onMouseDown={(e) => startResize(e, el, dir)} 
            style={{ 
                position: "absolute", background: "#3b82f6", width: 8, height: 8, 
                borderRadius: "2px", zIndex: 100, ...style 
            }} 
        />
    );

    return (
      <div key={el.id} style={frame} onMouseDown={(e) => {
            if (isExport) return;
            if (el.type === "table" && e.target.closest('td')) return;
            startDrag(e, el);
        }}>
        {content}
        {children.map(renderNode)}
        
        {isSel && !isExport && (
            <>
                {/* Move Handle */}
                <div 
                    onMouseDown={(e) => { e.stopPropagation(); startDrag(e, el, true); }}
                    style={{ 
                        position: "absolute", top: -25, left: 0, 
                        background: "#3b82f6", color: "#fff", 
                        width: 24, height: 24, borderRadius: "6px",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: "move", zIndex: 100, boxShadow: "0 4px 10px rgba(0,0,0,0.2)"
                    }}
                >
                    <Move size={14} />
                </div>

                {/* Corners */}
                <Handle dir="tl" style={{ left: -4, top: -4, cursor: "nw-resize" }} />
                <Handle dir="tr" style={{ right: -4, top: -4, cursor: "ne-resize" }} />
                <Handle dir="bl" style={{ left: -4, bottom: -4, cursor: "sw-resize" }} />
                <Handle dir="br" style={{ right: -4, bottom: -4, cursor: "se-resize" }} />
                {/* Edges */}
                <Handle dir="t" style={{ left: "50%", marginLeft: -4, top: -4, cursor: "n-resize" }} />
                <Handle dir="b" style={{ left: "50%", marginLeft: -4, bottom: -4, cursor: "s-resize" }} />
                <Handle dir="l" style={{ top: "50%", marginTop: -4, left: -4, cursor: "w-resize" }} />
                <Handle dir="r" style={{ top: "50%", marginTop: -4, right: -4, cursor: "e-resize" }} />
            </>
        )}
      </div>
    );
  };

  const roots = useMemo(() => elements.filter((e) => !e.parentId).sort(byZ), [elements]);

  return (
    <div ref={layerRef} style={{ width: "100%", height: "100%", position: "relative", overflow: "visible" }}>
      {roots.map(renderNode)}
    </div>
  );
}
