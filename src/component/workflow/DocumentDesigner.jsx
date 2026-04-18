import React, { useState, useRef, useEffect, useMemo, useLayoutEffect } from "react";
import { 
  Square, Type, Image as ImageIcon, Layout, Move, Palette, MousePointer2, 
  Trash2, Copy, Layers, Maximize2, Minimize2, ZoomIn, ZoomOut, 
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Settings2, Download, Printer, Share2, 
  Box, FileText, Smartphone, Table as TableIcon, Database, Check, History, 
  BarChart2, Plus, Smile, Sliders, Monitor, Crop, 
  MoreHorizontal, ChevronDown, AlignLeft, Info, Grid, List, Search, Play, Sun, Moon,
  Zap, Save, FileJson, Clock
} from "lucide-react";
import PropertiesPanel from "../properties/PropertiesPanel";
import ExportTool from "../export/ExportTool";
import WorkLayer from "../WorkLayer";
import BackgroundTool from "../BackgroundTool";
import SizeTool from "../SizeTool";
import StickerTool from "../StickerTool";
import PaperCanvas from "../PaperCanvas";
import VersionHistory from "../versioning/VersionHistory";
import OrderList from "../order/OrderList";
import { PAPER_PRESETS } from "../../utils/utils";

const GLASS_STYLE = {
    background: "rgba(255, 255, 255, 0.7)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    border: "1px solid rgba(255, 255, 255, 0.3)",
    boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.07)"
};

export default function DocumentDesigner({ theme, data, dataset = [], onUpdate }) {
  const safeData = useMemo(() => ({
    pages: Array.isArray(data?.pages) && data.pages.length > 0 ? data.pages : [{ id: 'p1', name: 'Hoja Principal', bgUrl: "" }],
    elements: Array.isArray(data?.elements) ? data.elements : [],
    size: data?.size || 'letter',
    orientation: data?.orientation || 'portrait',
    id: data?.id || 'doc-1',
    name: data?.name || 'Documento Inteligente'
  }), [data]);

  const [selectedElementId, setSelectedElementId] = useState(null);
  const [selectedCells, setSelectedCells] = useState([]);
  const [selectionRange, setSelectionRange] = useState(null);
  const [zoom, setZoom] = useState(0.75);
  const [activeTab, setActiveTab] = useState("elements"); 
  const [activePageIdx, setActivePageIdx] = useState(0); 
  const [recordIdx, setRecordIdx] = useState(0);
  const [toast, setToast] = useState(null);

  const [history, setHistory] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  const handleSelectId = (id) => {
      setSelectedElementId(id);
      if (id && id.includes(':cell:')) {
          setActiveTab("AJUSTES");
      } else {
          setSelectedCells([]);
      }
  };

  const snapshot = () => {
    setHistory(prev => [JSON.parse(JSON.stringify(data)), ...prev].slice(0, 50));
    setRedoStack([]);
  };

  const undo = () => {
    if (history.length === 0) return;
    const [prev, ...rest] = history;
    setRedoStack(rs => [JSON.parse(JSON.stringify(data)), ...rs]);
    setHistory(rest);
    onUpdate(prev);
    showToast("DESHACER (CTRL+Z)");
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const [next, ...rest] = redoStack;
    setHistory(h => [JSON.parse(JSON.stringify(data)), ...h]);
    setRedoStack(rest);
    onUpdate(next);
    showToast("REHACER (CTRL+Y)");
  };


  const lastSelectionRef = useRef(null);
  const handleSelectionChange = (sel) => {
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
        lastSelectionRef.current = sel.getRangeAt(0).cloneRange();
    }
  };

  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });
  const viewportRef = useRef(null);

  // Sync zoom for WorkLayer interaction
  if (typeof window !== 'undefined') window.__DESIGNER_ZOOM__ = zoom;

  const showToast = (message, type = "success") => { setToast({ message, type }); setTimeout(() => setToast(null), 3000); };

  const [versions, setVersions] = useState(() => {
    const saved = localStorage.getItem(`versions_${safeData.id}`);
    return saved ? JSON.parse(saved) : [];
  });
  useEffect(() => { localStorage.setItem(`versions_${safeData.id}`, JSON.stringify(versions)); }, [versions, safeData.id]);
  
  const centerView = () => {
    if (viewportRef.current) {
        setZoom(0.75);
        setTimeout(() => {
            if (viewportRef.current) {
                const vp = viewportRef.current;
                vp.scrollLeft = (vp.scrollWidth - vp.clientWidth) / 2;
                vp.scrollTop = (vp.scrollHeight - vp.clientHeight) / 2;
            }
        }, 50);
        showToast("VISTA CENTRADA");
    }
  };

  useEffect(() => {
    centerView();
  }, []);

  useEffect(() => {
    if (!selectedElementId) return;
    const pIdx = safeData.pages.findIndex(p => p.id === selectedElementId);
    if (pIdx !== -1) { setActivePageIdx(pIdx); return; }
    const realId = selectedElementId.includes(':cell:') ? selectedElementId.split(':cell:')[0] : selectedElementId;
    const el = safeData.elements.find(e => e.id === realId);
    if (el?.pageId) { const pageIdx = safeData.pages.findIndex(p => p.id === el.pageId); if (pageIdx !== -1) setActivePageIdx(pageIdx); }
  }, [selectedElementId, safeData]);

  const handleUpdateElement = (id, patch) => {
    if (!id) return;
    snapshot();
    if (safeData.pages.some(p => p.id === id)) { 
        onUpdate({ pages: safeData.pages.map(p => p.id === id ? { ...p, ...patch, name: patch.name !== undefined ? patch.name : (patch.label !== undefined ? patch.label : p.name) } : p) }); 
        return; 
    }
    if (id.includes(':cell:')) {
      const parts = id.split(':'), tableId = parts[0], r = parts[2], c = parts[3];
      onUpdate({ elements: safeData.elements.map(el => {
        if (el.id === tableId) {
          const table = { ...(el.table || {}) };
          if (patch.text !== undefined) { 
              const d = [...(table.data || [])]; 
              if (!d[r]) d[r] = []; 
              d[r][c] = patch.text; 
              table.data = d; 
          }
          const cellStyle = patch.style || patch;
          if (cellStyle && typeof cellStyle === 'object' && !Array.isArray(cellStyle)) { 
              const cs = { ...(table.cellStyles || {}) }; 
              cs[`${r}:${c}`] = { ...(cs[`${r}:${c}`] || {}), ...cellStyle }; 
              table.cellStyles = cs; 
          }
          return { ...el, table: { ...table, ...(patch.table || {}) } };
        }
        return el;
      }) }); 
      return;
    }
    onUpdate({ elements: safeData.elements.map((el) => el.id === id ? { ...el, ...patch, style: { ...(el.style || {}), ...(patch.style || {}) } } : el) });
  };

  const handleMovePage = (from, to) => {
      const nextPages = [...safeData.pages];
      const [moved] = nextPages.splice(from, 1);
      nextPages.splice(to, 0, moved);
      onUpdate({ pages: nextPages });
      setActivePageIdx(to);
  };

  const handleReorderElements = (dragId, dropId) => {
      const nextElements = [...safeData.elements];
      const di = nextElements.findIndex(e => e.id === dragId);
      const oi = nextElements.findIndex(e => e.id === dropId);
      if (di > -1 && oi > -1) {
          const tempZ = nextElements[di].z || 0;
          nextElements[di].z = nextElements[oi].z || 0;
          nextElements[oi].z = tempZ;
          onUpdate({ elements: nextElements.sort((a,b) => (a.z||0) - (b.z||0)) });
      }
  };

    useLayoutEffect(() => {
        window.__EDITOR_DATASET__ = dataset;
    }, [dataset]);

  const addElement = (type, extra = {}) => {
    snapshot();
    const id = `${type}-${Date.now()}`;
    const newEl = { 
        id, type, pageId: safeData.pages[activePageIdx].id, x: 100, y: 100, w: type==='table'?400:200, h: type==='table'?150:100, 
        text: type === 'text' ? "Escribe algo..." : "", 
        z: safeData.elements.length,
        style: { 
          fontSize: 16, 
          borderWidth: (type === 'box' || type === 'table') ? "1px" : "0px", 
          borderStyle: "solid",
          borderColor: "#cbd5e1",
          color: "#0f172a", 
          background: (type === 'box' || type === 'table') ? "#ffffff" : "transparent", 
          borderRadius: 0, 
          padding: 0 
        }, 
        ...extra 
    };
    onUpdate({ elements: [...safeData.elements, newEl] }); 
    handleSelectId(id); 
    setSelectionRange(null); 
    showToast(`Añadido: ${type}`);
  };

  const handleTableAction = (tableId, action, params = {}) => {
    snapshot();
    onUpdate({ 
      elements: safeData.elements.map(el => {
        if (el.id !== tableId) return el;
        const t = JSON.parse(JSON.stringify(el.table || { rows: 2, cols: 2 }));
        const rows = t.rows || 2, cols = t.cols || 2;
        const targetR = params.r !== undefined ? params.r : rows - 1;
        const targetC = params.c !== undefined ? params.c : cols - 1;

        if (action === 'add-row') {
            const insertAt = targetR + 1;
            t.rows = rows + 1;
            const newData = [], newStyles = {};
            for(let r=0; r<t.rows; r++){
                if(r < insertAt) newData[r] = (t.data||[])[r] || [];
                else if(r === insertAt) newData[r] = [];
                else newData[r] = (t.data||[])[r-1] || [];
            }
            Object.entries(t.cellStyles || {}).forEach(([k,v]) => {
                const [r,c] = k.split(':').map(Number);
                if(r >= insertAt) newStyles[`${r+1}:${c}`] = v;
                else newStyles[k] = v;
            });
            if (t.rowHeights) {
                const nextHeights = [...t.rowHeights];
                nextHeights.splice(insertAt, 0, nextHeights[targetR] || 50);
                t.rowHeights = nextHeights;
            }
            t.data = newData; t.cellStyles = newStyles;
        } else if (action === 'del-row') {
            if (rows <= 1) return el;
            t.rows = rows - 1;
            const newData = [], newStyles = {}, newMerges = [];
            for(let r=0; r<t.rows; r++){
                if(r < targetR) newData[r] = (t.data||[])[r] || [];
                else newData[r] = (t.data||[])[r+1] || [];
            }
            Object.entries(t.cellStyles || {}).forEach(([k,v]) => {
                const [r,c] = k.split(':').map(Number);
                if(r === targetR) return;
                if(r > targetR) newStyles[`${r-1}:${c}`] = v;
                else newStyles[k] = v;
            });
            (t.merges || []).forEach(m => {
                if (m.r === targetR) return; 
                if (m.r > targetR) newMerges.push({ ...m, r: m.r - 1 });
                else if (m.r + m.rs - 1 >= targetR) newMerges.push({ ...m, rs: m.rs - 1 }); 
                else newMerges.push(m);
            });
            if (t.rowHeights) {
                const nextHeights = [...t.rowHeights];
                nextHeights.splice(targetR, 1);
                t.rowHeights = nextHeights;
            }
            t.data = newData; t.cellStyles = newStyles; t.merges = newMerges.filter(m => m.rs > 0 && m.cs > 0);
        } else if (action === 'del-cell') {
            const newData = [...(t.data || [])];
            const rowData = [...(newData[targetR] || [])];
            rowData.splice(targetC, 1);
            newData[targetR] = rowData;
            
            // Desplazar estilos solo en esa fila
            const newStyles = {};
            Object.entries(t.cellStyles || {}).forEach(([k, v]) => {
                const [r, c] = k.split(':').map(Number);
                if (r !== targetR) { newStyles[k] = v; return; }
                if (c === targetC) return;
                if (c > targetC) newStyles[`${r}:${c-1}`] = v;
                else newStyles[k] = v;
            });
            t.data = newData; t.cellStyles = newStyles;
        } else if (action === 'add-cell') {
            // Inserción LOCAL por fila
            const newData = [...(t.data || [])];
            const rowData = [...(newData[targetR] || [])];
            const insertAt = targetC + 1;
            rowData.splice(insertAt, 0, "");
            newData[targetR] = rowData;
            
            // Si la fila ahora es la más ancha, actualizamos cols
            t.cols = Math.max(t.cols, rowData.length);

            // Desplazar estilos solo en esa fila
            const newStyles = {};
            Object.entries(t.cellStyles || {}).forEach(([k, v]) => {
                const [r, c] = k.split(':').map(Number);
                if (r !== targetR) { newStyles[k] = v; return; }
                if (c >= insertAt) newStyles[`${r}:${c+1}`] = v;
                else newStyles[k] = v;
            });
            t.data = newData; t.cellStyles = newStyles;
        } else if (action === 'add-col') {
            const insertAt = targetC + 1;
            t.cols = cols + 1;
            const newData = [], newStyles = {};
            for(let r=0; r<rows; r++){
                newData[r] = [];
                for(let c=0; c<t.cols; c++){
                    if(c < insertAt) newData[r][c] = (t.data||[])[r]?.[c] || "";
                    else if(c === insertAt) newData[r][c] = "";
                    else newData[r][c] = (t.data||[])[r]?.[c-1] || "";
                }
            }
            Object.entries(t.cellStyles || {}).forEach(([k,v]) => {
                const [r,c] = k.split(':').map(Number);
                if(c >= insertAt) newStyles[`${r}:${c+1}`] = v;
                else newStyles[k] = v;
            });
            // Update colWidths
            if (t.colWidths) {
                const nextWidths = [...t.colWidths];
                nextWidths.splice(insertAt, 0, nextWidths[targetC] || 100);
                t.colWidths = nextWidths;
            }
            // Merges add col simplification: just shift those to right of insert
            t.merges = (t.merges || []).map(m => m.c >= insertAt ? { ...m, c: m.c + 1 } : (m.c + m.cs - 1 >= insertAt ? { ...m, cs: m.cs + 1 } : m));
            t.data = newData; t.cellStyles = newStyles;
        } else if (action === 'del-col') {
            if (cols <= 1) return el;
            t.cols = cols - 1;
            const newData = [], newStyles = {}, newMerges = [];
            for(let r=0; r<rows; r++){
                newData[r] = [];
                for(let c=0; c<t.cols; c++){
                    if(c < targetC) newData[r][c] = (t.data||[])[r]?.[c] || "";
                    else newData[r][c] = (t.data||[])[r]?.[c+1] || "";
                }
            }
            Object.entries(t.cellStyles || {}).forEach(([k,v]) => {
                const [r,c] = k.split(':').map(Number);
                if(c === targetC) return;
                if(c > targetC) newStyles[`${r}:${c-1}`] = v;
                else newStyles[k] = v;
            });
            // Update colWidths
            if (t.colWidths) {
                const nextWidths = [...t.colWidths];
                nextWidths.splice(targetC, 1);
                t.colWidths = nextWidths;
            }
            (t.merges || []).forEach(m => {
                if (m.c === targetC) return;
                if (m.c > targetC) newMerges.push({ ...m, c: m.c - 1 });
                else if (m.c + m.cs - 1 >= targetC) newMerges.push({ ...m, cs: m.cs - 1 });
                else newMerges.push(m);
            });
            t.data = newData; t.cellStyles = newStyles; t.merges = newMerges.filter(m => m.rs > 0 && m.cs > 0);
        } else if (action === 'update-dims') {
            t.colWidths = params.colWidths || t.colWidths;
            t.rowHeights = params.rowHeights || t.rowHeights;
        }
        const updatedEl = { ...el, table: t };
        // Sync total width and height
        if (t.colWidths) updatedEl.w = t.colWidths.reduce((a, b) => a + b, 0);
        if (t.rowHeights) updatedEl.h = t.rowHeights.reduce((a, b) => a + b, 0);
        return updatedEl;
      })
    });
  };

  const setTableStructure = (tableId, type, count) => {
    snapshot();
    onUpdate({
      elements: safeData.elements.map(el => {
        if (el.id !== tableId) return el;
        const table = { ...(el.table || { rows: 1, cols: 1 }) };
        if (type === 'rows') {
          const oldRows = table.rows || 1;
          const newRows = Math.max(1, count);
          table.rows = newRows;
          const data = [...(table.data || [])];
          while (data.length < newRows) data.push(Array(table.cols || 1).fill(""));
          table.data = data.slice(0, newRows);
          const heights = [...(table.rowHeights || Array(oldRows).fill((el.h || 50) / oldRows))];
          while (heights.length < newRows) heights.push(25);
          table.rowHeights = heights.slice(0, newRows);
          el.h = table.rowHeights.reduce((a, b) => a + b, 0);
        } else {
            const oldCols = table.cols || 1;
            const newCols = Math.max(1, count);
            table.cols = newCols;
            const data = (table.data || []).map(row => {
                const r = [...row];
                while (r.length < newCols) r.push("");
                return r.slice(0, newCols);
            });
            table.data = data;
            const widths = [...(table.colWidths || Array(oldCols).fill((el.w || 100) / oldCols))];
            while (widths.length < newCols) widths.push(100);
            table.colWidths = widths.slice(0, newCols);
            el.w = table.colWidths.reduce((a, b) => a + b, 0);
        }
        return { ...el, table };
      })
    });
  };


  const handleDelete = (id = selectedElementId) => {
    if (!id) return;
    snapshot();
    const isP = safeData.pages.some(p => p.id === id);
    if (isP) {
        if (safeData.pages.length <= 1) return showToast("No puedes borrar la última hoja", "error");
        onUpdate({ 
          pages: safeData.pages.filter(p => p.id !== id), 
          elements: safeData.elements.filter(el => el.pageId !== id) 
        });
        if(selectedElementId === id) handleSelectId(null); 
        setActivePageIdx(0); showToast("Página borrada"); 
        return;
    }
    // Si es una celda, solo borramos contenido (estándar en Excel/Tablas)
    if (id.includes(':cell:')) {
        handleUpdateElement(id, { text: "" });
        showToast("Contenido de celda borrado");
        return;
    }
    // Borrar elemento raíz (tabla, imagen, etc)
    const targetId = id.includes(':cell:') ? id.split(':cell:')[0] : id;
    onUpdate({ elements: safeData.elements.map(el => el.id === targetId ? null : el).filter(Boolean) });
    if(selectedElementId === id || (selectedElementId && selectedElementId.startsWith(targetId))) {
        handleSelectId(null);
    }
    showToast("Elemento eliminado");
  };

  const undoRef = useRef(undo);
  const redoRef = useRef(redo);
  const handleDeleteRef = useRef(handleDelete);
  undoRef.current = undo;
  redoRef.current = redo;
  handleDeleteRef.current = handleDelete;

  useEffect(() => {
    const handleDesignerKeys = (e) => {
        const isEditing = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable || e.target.closest('[contenteditable="true"]');
        
        // UNDO / REDO
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undoRef.current(); return; }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redoRef.current(); return; }
        
        // DELETE
        if (!isEditing && (e.key === 'Delete' || e.key === 'Backspace') && selectedElementId) {
            e.preventDefault();
            handleDeleteRef.current();
        }
    };
    window.addEventListener('keydown', handleDesignerKeys);
    return () => window.removeEventListener('keydown', handleDesignerKeys);
  }, [selectedElementId]);

  const selectedElement = useMemo(() => {
    if (!selectedElementId) return null;
    const pageObj = safeData.pages.find(p => p.id === selectedElementId);
    if (pageObj) return { ...pageObj, type: 'page', label: pageObj.name || `Hoja`, _isPage: true };
    if (selectedElementId.includes(':cell:')) {
      const parts = selectedElementId.split(':'), tableId = parts[0], r = parseInt(parts[2]), c = parseInt(parts[3]);
      const table = safeData.elements.find(el => el.id === tableId);
      if (!table) return null;
      const cellStyle = table.table?.cellStyles?.[`${r}:${c}`] || {};
      return { id: selectedElementId, type: 'cell', text: table.table?.data?.[r]?.[c] || "", style: cellStyle, _isCell: true, _cellPos: { r, c }, parentId: tableId, table: table.table };
    }
    return safeData.elements.find((el) => el.id === selectedElementId);
  }, [safeData, selectedElementId]);

  return (
    <div className={theme === 'dark' ? 'theme-dark' : 'theme-light'} style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--editor-bg)", overflow: "hidden", fontFamily: "'Outfit', sans-serif" }}>
        <style>{`
            .glass { background: var(--surface-glass); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); border: 1px solid var(--node-border); box-shadow: 0 8px 32px rgba(0,0,0,0.05); }
            .premium-btn { transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); cursor: pointer; border: 1px solid transparent; background: var(--btn-bg); color: var(--btn-text); }
            .premium-btn:hover { transform: translateY(-2px); background: #3b82f6 !important; color: #fff !important; box-shadow: 0 10px 20px rgba(59,130,246,0.2) !important; }
            .premium-btn:active { transform: scale(0.95); }
            .thumb-card.active { border: 4px solid #3b82f6 !important; bottom: 10px; box-shadow: 0 20px 40px rgba(59,130,246,0.2) !important; }
            @keyframes flyIn { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
            @keyframes scaleIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
            ::-webkit-scrollbar { width: 6px; height: 6px; }
            ::-webkit-scrollbar-thumb { background: var(--btn-border); border-radius: 10px; }
        `}</style>

        {/* GLASS HEADER */}
        <div className="glass" style={{ height: 100, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 40px", zIndex: 1000, margin: "20px", borderRadius: 25 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 50 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ fontSize: 10, fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1.5 }}>📄 Configuración de Hoja</div>
                    <SizeTool size={safeData.size} orientation={safeData.orientation} onSize={s => onUpdate({ size: s })} onOrientation={o => onUpdate({ orientation: o })} />
                </div>
                <div style={{ width: 1, height: 40, background: "rgba(0,0,0,0.05)" }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ fontSize: 10, fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1.5 }}>🎨 Estilo y Texturas</div>
                    <BackgroundTool 
                       onPickFile={f => {
                           const r = new FileReader(); 
                           r.onload = (re) => handleUpdateElement(safeData.pages[activePageIdx].id, { bgUrl: re.target.result }); 
                           r.readAsDataURL(f);
                       }} 
                       onClear={() => handleUpdateElement(safeData.pages[activePageIdx].id, { bgUrl: "" })}
                       hasBackground={!!safeData.pages[activePageIdx]?.bgUrl}
                       fit={safeData.pages[activePageIdx]?.bgFit || "contain"}
                       onChangeFit={f => handleUpdateElement(safeData.pages[activePageIdx].id, { bgFit: f })}
                   />
                </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                <div className="glass" style={{ display: "flex", borderRadius: 16, padding: "6px 12px", alignItems: "center", gap: 10 }}>
                    <button onClick={() => setZoom(z => Math.max(0.1, z - 0.1))} className="premium-btn" style={{ width: 34, height: 34, borderRadius: 10, border: "none", display:"flex", alignItems:"center", justifyContent:"center" }}><ZoomOut size={16}/></button>
                    <div style={{ width: 60, textAlign: "center", fontSize: 14, fontWeight: 900, color: "var(--node-text)" }}>{Math.round(zoom * 100)}%</div>
                    <button onClick={() => setZoom(z => Math.min(3, z + 0.1))} className="premium-btn" style={{ width: 34, height: 34, borderRadius: 10, border: "none", display:"flex", alignItems:"center", justifyContent:"center" }}><ZoomIn size={16}/></button>
                </div>
                <ExportTool size={safeData.size} orientation={safeData.orientation} projectName={safeData.name} onToast={showToast} />
            </div>
        </div>

        {/* RECORD NAVIGATION BAR */}
        {dataset && dataset.length > 0 && (
            <div className="glass" style={{ margin: "0 20px 10px 20px", padding: "12px 30px", borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(59,130,246,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#3b82f6" }}>
                            <Database size={20} />
                        </div>
                        <div>
                            <div style={{ fontSize: 10, fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1 }}>Vista de Registros</div>
                            <div style={{ fontSize: 14, fontWeight: 900, color: "#1e293b" }}>{dataset.length} Registros Cargados</div>
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button 
                        disabled={recordIdx === 0}
                        onClick={() => setRecordIdx(0)}
                        className="premium-btn" 
                        style={{ padding: "10px", borderRadius: 12, border: "none", opacity: recordIdx === 0 ? 0.3 : 1 }}
                        title="Primer Registro"
                    >
                        <ChevronsLeft size={20}/>
                    </button>

                    <button 
                        disabled={recordIdx === 0}
                        onClick={() => setRecordIdx(prev => Math.max(0, prev - 1))}
                        className="premium-btn" 
                        style={{ padding: "10px 15px", borderRadius: 12, border: "none", opacity: recordIdx === 0 ? 0.3 : 1 }}
                    >
                        <ChevronLeft size={16}/>
                    </button>
                    
                    <div style={{ background: "rgba(59,130,246,0.05)", padding: "10px 20px", borderRadius: 12, border: "1px solid rgba(59,130,246,0.1)", display: "flex", alignItems: "center", gap: 8 }}>
                        <input 
                            type="number" 
                            min="1" 
                            max={dataset.length}
                            value={recordIdx + 1}
                            onChange={(e) => {
                                const val = parseInt(e.target.value);
                                if (!isNaN(val)) {
                                    setRecordIdx(Math.max(0, Math.min(dataset.length - 1, val - 1)));
                                }
                            }}
                            style={{ 
                                background: "var(--input-bg)", border: "1px solid var(--node-border)", borderRadius: 8, minWidth: 100, width: "100px", padding: "8px 10px", 
                                textAlign: "center", fontWeight: 900, fontSize: 18, color: "#3b82f6", outline: "none",
                                boxShadow: "inset 0 2px 4px rgba(0,0,0,0.05)"
                            }}
                        />
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--node-desc)" }}>de {dataset.length.toLocaleString()}</span>
                    </div>

                    <button 
                        disabled={recordIdx === dataset.length - 1}
                        onClick={() => setRecordIdx(prev => Math.min(dataset.length - 1, prev + 1))}
                        className="premium-btn" 
                        style={{ padding: "10px 15px", borderRadius: 12, border: "none", opacity: recordIdx === dataset.length - 1 ? 0.3 : 1 }}
                    >
                        <ChevronRight size={16}/>
                    </button>

                    <button 
                        disabled={recordIdx === dataset.length - 1}
                        onClick={() => setRecordIdx(dataset.length - 1)}
                        className="premium-btn" 
                        style={{ padding: "10px", borderRadius: 12, border: "none", opacity: recordIdx === dataset.length - 1 ? 0.3 : 1 }}
                        title="Último Registro"
                    >
                        <ChevronsRight size={20}/>
                    </button>
                </div>

                <div style={{ width: 250, display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ fontSize: 9, fontWeight: 900, color: "#94a3b8", textAlign: "right" }}>PROGRESO DE REVISIÓN</div>
                    <div style={{ height: 6, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ width: `${((recordIdx + 1) / dataset.length) * 100}%`, height: "100%", background: "#3b82f6", transition: "width 0.3s ease" }} />
                    </div>
                </div>
            </div>
        )}

        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
            {/* FLOATING LEFT TOOLBAR */}
            <div className="glass" style={{ width: 90, margin: "0 0 20px 20px", borderRadius: 30, display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 0", gap: 32 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ fontSize: 9, fontWeight: 900, color: "#94a3b8", textAlign: "center" }}>BASIC</div>
                    <button onClick={() => addElement('text')} className="premium-btn" style={{ width: 54, height: 54, borderRadius: 18, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", color: "#1e293b", boxShadow: "0 5px 15px rgba(0,0,0,0.05)" }} title="Texto"><Type size={22}/></button>
                    <button onClick={() => addElement('box')} className="premium-btn" style={{ width: 54, height: 54, borderRadius: 18, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", color: "#1e293b", boxShadow: "0 5px 15px rgba(0,0,0,0.05)" }} title="Contenedor"><Square size={22}/></button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ fontSize: 9, fontWeight: 900, color: "#94a3b8", textAlign: "center" }}>DATA</div>
                    <button onClick={() => addElement('table', { table: { rows: 3, cols: 3, data: [["","",""],["","",""],["","",""]] } })} className="premium-btn" style={{ width: 54, height: 54, borderRadius: 18, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", color: "#1e293b", boxShadow: "0 5px 15px rgba(0,0,0,0.05)" }} title="Tabla"><TableIcon size={22}/></button>
                    <button onClick={() => addElement('chart', { chart: { type: 'bar', labels: ["I","II","III"], datasets: [{ label: "Data", data: [100, 150, 120], color: "#3b82f6" }] } })} className="premium-btn" style={{ width: 54, height: 54, borderRadius: 18, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", color: "#1e293b", boxShadow: "0 5px 15px rgba(0,0,0,0.05)" }} title="Estadística"><BarChart2 size={22}/></button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ fontSize: 9, fontWeight: 900, color: "#94a3b8", textAlign: "center" }}>VISTA</div>
                    <button onClick={centerView} className="premium-btn" style={{ width: 54, height: 54, borderRadius: 18, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", color: "#1e293b", boxShadow: "0 5px 15px rgba(0,0,0,0.05)" }} title="Centrar Vista"><Monitor size={22}/></button>
                    <button onClick={() => setZoom(prev => Math.min(2, prev + 0.1))} className="premium-btn" style={{ width: 54, height: 54, borderRadius: 18, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", color: "#1e293b", boxShadow: "0 5px 15px rgba(0,0,0,0.05)" }} title="Zoom In"><ZoomIn size={22}/></button>
                    <button onClick={() => setZoom(prev => Math.max(0.1, prev - 0.1))} className="premium-btn" style={{ width: 54, height: 54, borderRadius: 18, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", color: "#1e293b", boxShadow: "0 5px 15px rgba(0,0,0,0.05)" }} title="Zoom Out"><ZoomOut size={22}/></button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: "auto" }}>
                    <StickerTool onAdd={st => addElement('image', { text: `<img src="${st}" style="width:100%;height:100%;display:block;"/>` })} />
                </div>
            </div>

            <div style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                {/* HORIZONTAL PAGE NAV */}
                <div style={{ height: 160, display: "flex", alignItems: "center", gap: 30, padding: "0 50px", overflowX: "auto" }}>
                    <button onClick={() => {
                        const nextPages = [...safeData.pages, { id: `p-${Date.now()}`, name: `Hoja ${safeData.pages.length + 1}`, bgUrl: "" }];
                        onUpdate({ pages: nextPages });
                        setActivePageIdx(nextPages.length - 1);
                    }} style={{ minWidth: 110, height: 130, borderRadius: 25, border: "2px dashed #93c5fd", background: "rgba(59,130,246,0.05)", cursor: "pointer", color: "#3b82f6", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
                        <Plus size={30} strokeWidth={3} /> <span style={{ fontSize: 10, fontWeight: 900 }}>NUEVA PÁGINA</span>
                    </button>
                    {safeData.pages.map((p, i) => (
                        <div key={p.id} onClick={() => setActivePageIdx(i)} className={`thumb-card ${activePageIdx === i ? 'active' : ''}`} style={{ 
                            minWidth: 100, height: 130, borderRadius: 25, background: "#fff", cursor: "pointer", 
                            boxShadow: "0 10px 25px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", 
                            alignItems: "center", justifyContent: "center", gap: 10, transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)", position: "relative"
                        }}>
                             <div style={{ width: 45, height: 60, border: "2px solid #f1f5f9", borderRadius: 8, background: p.bgUrl ? `url(${p.bgUrl}) center/cover` : "#fff" }} />
                             <span style={{ fontSize: 9, fontWeight: 900, color: activePageIdx === i ? "#3b82f6" : "#94a3b8" }}>{p.name.toUpperCase()}</span>
                        </div>
                    ))}
                </div>

                {/* CANVAS SCROLL VIEW */}
                <div 
                    ref={viewportRef}
                    onMouseDown={(e) => {
                        // Pan if clicking on the viewport or the inner background container
                        const isBg = e.target === viewportRef.current || e.target.classList.contains('canvas-background-container');
                        if (isBg) {
                            setIsPanning(true);
                            setPanStart({ x: e.clientX, y: e.clientY, scrollLeft: viewportRef.current.scrollLeft, scrollTop: viewportRef.current.scrollTop });
                            viewportRef.current.style.cursor = "grabbing";
                        }
                    }}
                    onMouseMove={(e) => {
                        if (isPanning) {
                            const dx = e.clientX - panStart.x;
                            const dy = e.clientY - panStart.y;
                            viewportRef.current.scrollLeft = panStart.scrollLeft - dx;
                            viewportRef.current.scrollTop = panStart.scrollTop - dy;
                        }
                    }}
                    onMouseUp={() => { setIsPanning(false); if (viewportRef.current) viewportRef.current.style.cursor = "auto"; }}
                    onMouseLeave={() => { setIsPanning(false); if (viewportRef.current) viewportRef.current.style.cursor = "auto"; }}
                    className="scroll-area"
                    style={{ 
                        flex: 1, 
                        position: "relative", 
                        overflow: "auto", 
                        display: "flex", 
                        justifyContent: "center", 
                        cursor: "auto",
                        background: "var(--editor-bg)"
                    }}
                >
                    <div 
                        className="canvas-background-container"
                        style={{ 
                            padding: "1500px", // Larger area for that "infinite" feel
                            display: "flex", 
                            alignItems: "flex-start", 
                            justifyContent: "center",
                            minWidth: "max-content",
                            minHeight: "max-content",
                            background: "var(--editor-bg)",
                            backgroundImage: `radial-gradient(var(--node-border) 1px, transparent 1px)`,
                            backgroundSize: "30px 30px"
                        }}
                    >
                        <div style={{ transform: `scale(${zoom})`, transformOrigin: "top center", transition: isPanning ? "none" : "transform 0.15s ease-out" }}>
                            <PaperCanvas size={safeData.size} orientation={safeData.orientation} background={safeData.pages[activePageIdx]?.bgUrl} onMouseDown={(e) => { if (e.target === e.currentTarget) { handleSelectId(safeData.pages[activePageIdx].id); setSelectionRange(null); } }}>
                                <WorkLayer 
                                    elements={safeData.elements.filter(el => el.pageId === safeData.pages[activePageIdx].id)} 
                                    dataset={dataset && dataset.length > 0 ? [dataset[recordIdx]] : []}
                                    selectedId={selectedElementId} 
                                    selectedCells={selectedCells}
                                    onSelect={handleSelectId} 
                                    onSelectCells={setSelectedCells}
                                    onChange={handleUpdateElement} 
                                    zoom={zoom}
                                    selectionRange={selectionRange}
                                    onRangeSelect={setSelectionRange}
                                    onSelectionChange={handleSelectionChange}
                                />
                            </PaperCanvas>
                        </div>
                    </div>
                </div>
            </div>

            {/* EXPERT INSPECTOR GLASS */}
            <div className="glass" style={{ width: 400, margin: "0 20px 20px 0", borderRadius: 30, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <div style={{ display: "flex", borderBottom: "1px solid rgba(0,0,0,0.05)", background: "rgba(255,255,255,0.3)" }}>
                    {[
                        { id: 'elements', icon: <Sliders size={18}/>, label: "AJUSTES" }, 
                        { id: 'layers', icon: <Layers size={18}/>, label: "ORDEN" }, 
                        { id: 'data', icon: <Database size={18}/>, label: "DATOS" },
                        { id: 'history', icon: <Clock size={18}/>, label: "LOG" }
                    ].map(t => (
                        <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ 
                            flex: 1, padding: "24px 0", border: "none", background: "none", 
                            borderBottom: activeTab === t.id ? "4px solid #3b82f6" : "4px solid transparent",
                            color: activeTab === t.id ? "#1e293b" : "#94a3b8", fontWeight: 900, fontSize: 12, cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 12, transition: "all 0.3s"
                        }}>{t.icon} {t.label}</button>
                    ))}
                </div>
                <div style={{ flex: 1, overflowY: "auto", position: "relative" }}>
                    {activeTab === "elements" && (
                        <div style={{ animation: "scaleIn 0.3s" }} onMouseDown={e => e.stopPropagation()}>
                            <PropertiesPanel
                                el={selectedElementId ? (safeData.elements.find(e => e.id === selectedElementId) || { id: selectedElementId, _isCell: selectedElementId?.includes(':cell:'), table: safeData.elements.find(t => selectedElementId?.startsWith(t.id))?.table }) : undefined}
                                selectedCells={selectedCells}
                                onStyle={(s) => {
                                    const targetId = selectedElementId?.includes(':cell:') ? selectedElementId.split(':cell:')[0] : selectedElementId;
                                    handleUpdateElement(targetId, { style: { ...(safeData.elements.find(e => e.id === targetId)?.style || {}), ...s } });
                                }}
                                onChange={(p) => {
                                    const targetId = selectedElementId?.includes(':cell:') ? selectedElementId.split(':cell:')[0] : selectedElementId;
                                    handleUpdateElement(targetId, p);
                                }}
                                onDelete={handleDelete}
                            />

                            {/* PERSISTENT TABLE ACTIONS BAR (Always visible if cells selected) */}
                            {selectedCells.length > 0 && (
                                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "20px", background: "white", borderTop: "2px solid #3b82f6", boxShadow: "0 -10px 25px rgba(0,0,0,0.1)", zIndex: 1000, display: "flex", flexDirection: "column", gap: 10 }}>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                        <span style={{ fontSize: "11px", fontWeight: "900", color: "#3b82f6", textTransform: "uppercase" }}>Asistente de Tabla</span>
                                        <span style={{ fontSize: "10px", color: "#94a3b8" }}>{selectedCells.length} celdas seleccionadas</span>
                                    </div>
                                    
                                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                        <button 
                                            onClick={() => {
                                                const rows = selectedCells.map(c => c.r);
                                                const cols = selectedCells.map(c => c.c);
                                                const minR = Math.min(...rows), maxR = Math.max(...rows);
                                                const minC = Math.min(...cols), maxC = Math.max(...cols);
                                                const targetId = selectedCells[0].id.split(':cell:')[0];
                                                const tableEl = safeData.elements.find(e => e.id === targetId);
                                                const table = tableEl?.table || {};
                                                const newMerge = { r: minR, c: minC, rs: maxR - minR + 1, cs: maxC - minC + 1 };
                                                const filteredMerges = (table.merges || []).filter(m => !(m.r >= minR && m.r <= maxR && m.c >= minC && m.c <= maxC));
                                                handleUpdateElement(targetId, { table: { ...table, merges: [...filteredMerges, newMerge] } });
                                            }}
                                            disabled={selectedCells.length < 2}
                                            style={{
                                                flex: 2, padding: "12px", borderRadius: "10px", border: "none",
                                                background: selectedCells.length < 2 ? "#e2e8f0" : "#3b82f6",
                                                color: selectedCells.length < 2 ? "#94a3b8" : "white",
                                                fontSize: "10px", fontWeight: "900", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5
                                            }}
                                        >
                                            <Zap size={14} /> UNIR
                                        </button>

                                        <button 
                                            onClick={() => {
                                                const targetId = selectedCells[0].id.split(':cell:')[0];
                                                const tableEl = safeData.elements.find(e => e.id === targetId);
                                                const table = tableEl?.table || {};
                                                const rows = selectedCells.map(c => c.r);
                                                const cols = selectedCells.map(c => c.c);
                                                const newMerges = (table.merges || []).filter(m => 
                                                    !selectedCells.some(sc => sc.r === m.r && sc.c === m.c)
                                                );
                                                handleUpdateElement(targetId, { table: { ...table, merges: newMerges } });
                                            }}
                                            style={{ flex: 1, padding: "12px", borderRadius: "10px", background: "#f1f5f9", border: "none", fontSize: "10px", fontWeight: "900", color: "#1e293b", cursor: "pointer" }}
                                        >SEPARAR</button>

                                        <div style={{ display: "flex", gap: 4, flex: 3 }}>
                                            <button onClick={() => {
                                                const targetId = selectedCells[0].id.split(':cell:')[0];
                                                handleTableAction(targetId, 'add-row', { r: selectedCells[0].r });
                                            }} style={{ flex: 1, padding: "12px", borderRadius: "10px", background: "#f8fafc", border: "1px solid #e2e8f0", fontSize: "10px", fontWeight: "900", color: "#3b82f6", cursor: "pointer" }} title="Añadir fila arriba">FILA +</button>
                                            <button onClick={() => {
                                                const targetId = selectedCells[0].id.split(':cell:')[0];
                                                handleTableAction(targetId, 'del-row', { r: selectedCells[0].r });
                                            }} style={{ flex: 1, padding: "12px", borderRadius: "10px", background: "#fff1f2", border: "1px solid #fecdd3", fontSize: "10px", fontWeight: "900", color: "#e11d48", cursor: "pointer" }} title="Eliminar fila actual">FILA -</button>
                                            <button onClick={() => {
                                                const targetId = selectedCells[0].id.split(':cell:')[0];
                                                handleTableAction(targetId, 'add-col', { c: selectedCells[0].c });
                                            }} style={{ flex: 1, padding: "12px", borderRadius: "10px", background: "#f8fafc", border: "1px solid #e2e8f0", fontSize: "10px", fontWeight: "900", color: "#3b82f6", cursor: "pointer" }} title="Añadir columna">COL +</button>
                                            <button onClick={() => {
                                                const targetId = selectedCells[0].id.split(':cell:')[0];
                                                handleTableAction(targetId, 'del-col', { c: selectedCells[0].c });
                                            }} style={{ flex: 1, padding: "12px", borderRadius: "10px", background: "#fff1f2", border: "1px solid #fecdd3", fontSize: "10px", fontWeight: "900", color: "#e11d48", cursor: "pointer" }} title="Eliminar columna current">COL -</button>
                                        </div>
                                    </div>

                                    <div style={{ display: "flex", gap: 8, alignItems: "center", borderTop: "1px solid #f1f5f9", paddingTop: "10px" }}>
                                        <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 4 }}>
                                            <label style={{ fontSize: "9px", fontWeight: "900", color: "#94a3b8" }}>ALTO FILA (px)</label>
                                            <input 
                                                type="number" 
                                                value={(() => {
                                                    const targetId = selectedCells[0].id.split(':cell:')[0];
                                                    const tableEl = safeData.elements.find(e => e.id === targetId);
                                                    return tableEl?.table?.rowHeights?.[selectedCells[0].r] || "";
                                                })()}
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value);
                                                    if (isNaN(val)) return;
                                                    const targetId = selectedCells[0].id.split(':cell:')[0];
                                                    const tableEl = safeData.elements.find(e => e.id === targetId);
                                                    const table = tableEl?.table || {};
                                                    const heights = [...(table.rowHeights || [])];
                                                    const affectedRows = new Set(selectedCells.map(c => c.r));
                                                    affectedRows.forEach(r => { heights[r] = val; });
                                                    handleUpdateElement(targetId, { table: { ...table, rowHeights: heights } });
                                                }}
                                                style={{ padding: "8px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "12px", width: "100%" }}
                                            />
                                        </div>
                                        <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 4 }}>
                                             <label style={{ fontSize: "9px", fontWeight: "900", color: "#94a3b8" }}>ANCHO COL (px)</label>
                                             <input 
                                                 type="number" 
                                                 value={(() => {
                                                     const targetId = selectedCells[0].id.split(':cell:')[0];
                                                     const tableEl = safeData.elements.find(e => e.id === targetId);
                                                     return tableEl?.table?.colWidths?.[selectedCells[0].c] || "";
                                                 })()}
                                                 onChange={(e) => {
                                                     const val = parseInt(e.target.value);
                                                     if (isNaN(val)) return;
                                                     const targetId = selectedCells[0].id.split(':cell:')[0];
                                                     const tableEl = safeData.elements.find(e => e.id === targetId);
                                                     const table = tableEl?.table || {};
                                                     const widths = [...(table.colWidths || [])];
                                                     const affectedCols = new Set(selectedCells.map(c => c.c));
                                                     affectedCols.forEach(c => { widths[c] = val; });
                                                     handleUpdateElement(targetId, { table: { ...table, colWidths: widths } });
                                                 }}
                                                 style={{ padding: "8px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "12px", width: "100%" }}
                                             />
                                         </div>
                                     </div>

                                     <div style={{ display: "flex", gap: 8, alignItems: "center", borderTop: "1px solid #f1f5f9", paddingTop: "10px" }}>
                                        <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 4 }}>
                                            <label style={{ fontSize: "9px", fontWeight: "900", color: "#94a3b8" }}>TOTAL FILAS</label>
                                            <input 
                                                type="number" 
                                                value={(() => {
                                                    const targetId = selectedCells[0].id.split(':cell:')[0];
                                                    const tableEl = safeData.elements.find(e => e.id === targetId);
                                                    return tableEl?.table?.rows || 1;
                                                })()}
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value);
                                                    if (isNaN(val)) return;
                                                    const targetId = selectedCells[0].id.split(':cell:')[0];
                                                    setTableStructure(targetId, 'rows', val);
                                                }}
                                                style={{ padding: "8px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "12px", width: "100%" }}
                                            />
                                        </div>
                                        <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 4 }}>
                                            <label style={{ fontSize: "9px", fontWeight: "900", color: "#94a3b8" }}>TOTAL COLS</label>
                                            <input 
                                                type="number" 
                                                value={(() => {
                                                    const targetId = selectedCells[0].id.split(':cell:')[0];
                                                    const tableEl = safeData.elements.find(e => e.id === targetId);
                                                    return tableEl?.table?.cols || 1;
                                                })()}
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value);
                                                    if (isNaN(val)) return;
                                                    const targetId = selectedCells[0].id.split(':cell:')[0];
                                                    setTableStructure(targetId, 'cols', val);
                                                }}
                                                style={{ padding: "8px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "12px", width: "100%" }}
                                            />
                                        </div>
                                        <button 
                                            onClick={() => {
                                                const targetId = selectedCells[0].id.split(':cell:')[0];
                                                const tableEl = safeData.elements.find(e => e.id === targetId);
                                                const table = tableEl?.table || {};
                                                const styles = { ...(table.cellStyles || {}) };
                                                selectedCells.forEach(cell => {
                                                    const coords = `${cell.r}:${cell.c}`;
                                                    styles[coords] = { ...(styles[coords] || {}), padding: "2px", fontSize: "11px", lineHeight: "1" };
                                                });
                                                handleUpdateElement(targetId, { table: { ...table, cellStyles: styles } });
                                                showToast("Modo Compacto Aplicado");
                                            }}
                                            style={{ flex: 1, padding: "12px", borderRadius: "10px", background: "#f0fdf4", border: "1px solid #bbf7d0", fontSize: "10px", fontWeight: "900", color: "#16a34a", cursor: "pointer", alignSelf: "flex-end" }}
                                        >✨ COMPACTO</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    {activeTab === "data" && (
                        <div style={{ padding: 24, animation: "scaleIn 0.3s" }}>
                            <div style={{ marginBottom: 20 }}>
                                <h3 style={{ fontSize: 13, fontWeight: 900, color: "#1e293b", marginBottom: 4 }}>FUENTES DE DATOS</h3>
                                <p style={{ fontSize: 11, color: "#64748b" }}>Usa estas variables en tus textos con doble llave: <b>{`{{variable}}`}</b></p>
                            </div>
                            
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                {dataset.length > 0 ? (
                                    Object.entries(dataset[recordIdx] || dataset[0]).map(([key, val]) => (
                                        <div key={key} style={{ padding: "16px", borderRadius: "12px", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                                <code style={{ fontSize: 11, fontWeight: 900, color: "#3b82f6", background: "#eff6ff", padding: "4px 8px", borderRadius: 6 }}>{`{{${key}}}`}</code>
                                                <button 
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(`{{${key}}}`);
                                                        showToast("¡Copiado al portapapeles!");
                                                    }}
                                                    style={{ border: "none", background: "none", cursor: "pointer", color: "#94a3b8" }}
                                                ><Copy size={14}/></button>
                                            </div>
                                            <div style={{ fontSize: 12, color: "#1e293b" }}>
                                                <span style={{ color: "#94a3b8", fontSize: "10px", display: "block", marginBottom: 2 }}>VALOR DE MUESTRA:</span>
                                                {String(val)}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div style={{ padding: 32, textAlign: "center", color: "#94a3b8", fontSize: 12 }}>
                                        No hay datos de muestra cargados.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    {activeTab === "layers" && (
                        <div style={{ padding: 24, animation: "scaleIn 0.3s" }}>
                            <OrderList 
                                items={safeData.elements} 
                                pages={safeData.pages} 
                                selectedId={selectedElementId} 
                                onSelect={setSelectedElementId} 
                                onRename={(id, val) => {
                                    if (typeof val === 'object' && val._tableAction) {
                                        handleTableAction(id, val._tableAction, val.params || {});
                                    } else if (id.includes(':cell:')) {
                                        handleUpdateElement(id, val);
                                    } else {
                                        handleUpdateElement(id, { label: val });
                                    }
                                }}
                                onDelete={handleDelete}
                                onRenamePage={(id, name) => handleUpdateElement(id, { name })}
                                onMovePage={handleMovePage}
                                onReorder={handleReorderElements}
                            />
                        </div>
                    )}
                    {activeTab === "history" && (
                        <div style={{ padding: 24, animation: "scaleIn 0.3s" }}>
                            <VersionHistory 
                                versions={versions} 
                                onSave={name => setVersions([{ id: Date.now(), name, timestamp: Date.now(), data: JSON.parse(JSON.stringify(data)) }, ...versions])}
                                onUpdate={vid => setVersions(versions.map(v => v.id === vid ? { ...v, data: JSON.parse(JSON.stringify(data)), timestamp: Date.now() } : v))}
                                onLoad={v => onUpdate(v.data)}
                                onDelete={id => setVersions(versions.filter(v => v.id !== id))}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>

        {toast && (
            <div style={{ 
                position: "fixed", bottom: 40, left: "50%", transform: "translateX(-50%)", 
                background: "#1e293b", color: "#fff", padding: "18px 40px", borderRadius: 100, 
                zIndex: 99999, fontWeight: 900, fontSize: 14, boxShadow: "0 25px 60px rgba(0,0,0,0.4)", 
                display: "flex", alignItems: "center", gap: 14, animation: "flyIn 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28)" 
            }}>
               <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#3b82f6", display: "flex", alignItems:"center", justifyContent:"center" }}><Zap size={14} fill="#fff"/></div> 
               {toast.message.toUpperCase()}
            </div>
        )}
    </div>
  );
}
