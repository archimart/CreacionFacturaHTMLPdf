import React, { useState, useRef, useEffect, useMemo } from "react";
import { 
  Square, Type, Image as ImageIcon, Layout, Move, Palette, MousePointer2, 
  Trash2, Copy, Layers, Maximize2, Minimize2, ZoomIn, ZoomOut, 
  ChevronLeft, ChevronRight, Settings2, Download, Printer, Share2, 
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

export default function DocumentDesigner({ data, dataset = [], onUpdate }) {
  const safeData = useMemo(() => ({
    pages: Array.isArray(data?.pages) && data.pages.length > 0 ? data.pages : [{ id: 'p1', name: 'Hoja Principal', bgUrl: "" }],
    elements: Array.isArray(data?.elements) ? data.elements : [],
    size: data?.size || 'letter',
    orientation: data?.orientation || 'portrait',
    id: data?.id || 'doc-1',
    name: data?.name || 'Documento Inteligente'
  }), [data]);

  const [selectedElementId, setSelectedElementId] = useState(null);
  const [selectionRange, setSelectionRange] = useState(null);
  const [zoom, setZoom] = useState(0.75);
  const [activeTab, setActiveTab] = useState("elements"); 
  const [activePageIdx, setActivePageIdx] = useState(0); 
  const [toast, setToast] = useState(null);

  const [history, setHistory] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

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

  useEffect(() => {
    if (!selectedElementId) return;
    const pIdx = safeData.pages.findIndex(p => p.id === selectedElementId);
    if (pIdx !== -1) { setActivePageIdx(pIdx); return; }
    const realId = selectedElementId.includes('::cell:') ? selectedElementId.split('::cell:')[0] : selectedElementId;
    const el = safeData.elements.find(e => e.id === realId);
    if (el?.pageId) { const pageIdx = safeData.pages.findIndex(p => p.id === el.pageId); if (pageIdx !== -1) setActivePageIdx(pageIdx); }
  }, [selectedElementId, safeData]);

  const handleUpdateElement = (id, patch) => {
    snapshot();
    if (safeData.pages.some(p => p.id === id)) { 
        onUpdate({ pages: safeData.pages.map(p => p.id === id ? { ...p, ...patch, name: patch.name !== undefined ? patch.name : (patch.label !== undefined ? patch.label : p.name) } : p) }); 
        return; 
    }
    if (id.includes('::cell:')) {
      const parts = id.split(':'), tableId = parts[0], r = parts[3], c = parts[4];
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

  const addElement = (type, extra = {}) => {
    snapshot();
    const id = `${type}-${Date.now()}`;
    const newEl = { 
        id, type, pageId: safeData.pages[activePageIdx].id, x: 100, y: 100, w: type==='table'?400:200, h: type==='table'?150:100, 
        text: type === 'text' ? "Escribe algo..." : "", 
        z: safeData.elements.length,
        style: { fontSize: 16, border: type === 'box' ? "2px solid #334155" : "0px solid transparent", color: "#0f172a", background: type === 'box' ? "#ffffff" : "transparent", borderRadius: 0, padding: 0 }, 
        ...extra 
    };
    onUpdate({ elements: [...safeData.elements, newEl] }); 
    setSelectedElementId(id); 
    setSelectionRange(null); 
    showToast(`Añadido: ${type}`);
  };

  const handleDeleteSelected = () => {
    if (!selectedElementId) return;
    snapshot();
    const isP = safeData.pages.some(p => p.id === selectedElementId);
    if (isP) {
        if (safeData.pages.length <= 1) return showToast("No puedes borrar la última hoja", "error");
        onUpdate({ pages: safeData.pages.filter(p => p.id !== selectedElementId), elements: safeData.elements.filter(el => el.pageId !== selectedElementId) });
        setSelectedElementId(null); setActivePageIdx(0); showToast("Página borrada"); 
        return;
    }
    const targetId = selectedElementId.includes('::cell:') ? selectedElementId.split('::cell:')[0] : selectedElementId;
    onUpdate({ elements: safeData.elements.filter(el => el.id !== targetId) });
    setSelectedElementId(null); 
    showToast("Borrado");
  };

  const undoRef = useRef(undo);
  const redoRef = useRef(redo);
  const handleDeleteRef = useRef(handleDeleteSelected);
  undoRef.current = undo;
  redoRef.current = redo;
  handleDeleteRef.current = handleDeleteSelected;

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
            showToast("OBJETO ELIMINADO");
        }
    };
    window.addEventListener('keydown', handleDesignerKeys);
    return () => window.removeEventListener('keydown', handleDesignerKeys);
  }, [selectedElementId]);

  const selectedElement = useMemo(() => {
    if (!selectedElementId) return null;
    const pageObj = safeData.pages.find(p => p.id === selectedElementId);
    if (pageObj) return { ...pageObj, type: 'page', label: pageObj.name || `Hoja`, _isPage: true };
    if (selectedElementId.includes('::cell:')) {
      const parts = selectedElementId.split(':'), tableId = parts[0], r = parts[3], c = parts[4];
      const table = safeData.elements.find(el => el.id === tableId);
      if (!table) return null;
      const cellStyle = table.table?.cellStyles?.[`${r}:${c}`] || {};
      return { id: selectedElementId, type: 'cell', text: table.table?.data?.[r]?.[c] || "", style: cellStyle, _isCell: true, _cellPos: { r: parseInt(r), c: parseInt(c) }, parentId: tableId, table: table.table };
    }
    return safeData.elements.find((el) => el.id === selectedElementId);
  }, [safeData, selectedElementId]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f1f5f9", overflow: "hidden", fontFamily: "'Outfit', sans-serif" }}>
        <style>{`
            .glass { background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); border: 1px solid rgba(255, 255, 255, 0.4); box-shadow: 0 8px 32px rgba(0,0,0,0.05); }
            .premium-btn { transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); cursor: pointer; border: 1px solid transparent; }
            .premium-btn:hover { transform: translateY(-2px); background: #3b82f6 !important; color: #fff !important; box-shadow: 0 10px 20px rgba(59,130,246,0.2) !important; }
            .premium-btn:active { transform: scale(0.95); }
            .thumb-card.active { border: 4px solid #3b82f6 !important; bottom: 10px; box-shadow: 0 20px 40px rgba(59,130,246,0.2) !important; }
            @keyframes flyIn { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
            @keyframes scaleIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
            ::-webkit-scrollbar { width: 6px; height: 6px; }
            ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
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
                    <button onClick={() => setZoom(z => Math.max(0.1, z - 0.1))} className="premium-btn" style={{ width: 34, height: 34, borderRadius: 10, border: "none", background: "rgba(0,0,0,0.03)", display:"flex", alignItems:"center", justifyContent:"center" }}><ZoomOut size={16}/></button>
                    <div style={{ width: 60, textAlign: "center", fontSize: 14, fontWeight: 900, color: "#1e293b" }}>{Math.round(zoom * 100)}%</div>
                    <button onClick={() => setZoom(z => Math.min(3, z + 0.1))} className="premium-btn" style={{ width: 34, height: 34, borderRadius: 10, border: "none", background: "rgba(0,0,0,0.03)", display:"flex", alignItems:"center", justifyContent:"center" }}><ZoomIn size={16}/></button>
                </div>
                <ExportTool size={safeData.size} orientation={safeData.orientation} projectName={safeData.name} onToast={showToast} />
            </div>
        </div>

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
                        if (e.ctrlKey) {
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
                    onMouseUp={() => { setIsPanning(false); viewportRef.current.style.cursor = "auto"; }}
                    onMouseLeave={() => { setIsPanning(false); viewportRef.current.style.cursor = "auto"; }}
                    style={{ flex: 1, position: "relative", overflow: "auto", display: "flex", justifyContent: "center", padding: "100px 50px", cursor: "auto" }}
                >
                    <div style={{ transform: `scale(${zoom})`, transformOrigin: "top center", transition: isPanning ? "none" : "transform 0.15s ease-out" }}>
                        <PaperCanvas size={safeData.size} orientation={safeData.orientation} background={safeData.pages[activePageIdx]?.bgUrl} onMouseDown={() => { setSelectedElementId(safeData.pages[activePageIdx].id); setSelectionRange(null); }}>
                            <WorkLayer 
                                elements={safeData.elements.filter(el => el.pageId === safeData.pages[activePageIdx].id)} 
                                selectedId={selectedElementId} 
                                onSelect={setSelectedElementId} 
                                onChange={handleUpdateElement} 
                                selectionRange={selectionRange}
                                onRangeSelect={setSelectionRange}
                                onSelectionChange={handleSelectionChange}
                            />
                        </PaperCanvas>
                    </div>
                </div>
            </div>

            {/* EXPERT INSPECTOR GLASS */}
            <div className="glass" style={{ width: 400, margin: "0 20px 20px 0", borderRadius: 30, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <div style={{ display: "flex", borderBottom: "1px solid rgba(0,0,0,0.05)", background: "rgba(255,255,255,0.3)" }}>
                    {[
                        { id: 'elements', icon: <Sliders size={18}/>, label: "AJUSTES" }, 
                        { id: 'layers', icon: <Layers size={18}/>, label: "ORDEN" }, 
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
                <div style={{ flex: 1, overflowY: "auto" }}>
                    {activeTab === "elements" && (
                        <div style={{ animation: "scaleIn 0.3s" }}>
                            <PropertiesPanel 
                                el={selectedElement} 
                                onRename={v => handleUpdateElement(selectedElementId, { label: v })} 
                                onChange={p => handleUpdateElement(selectedElementId, p)} 
                                onStyle={s => handleUpdateElement(selectedElementId, { style: s })} 
                                onDelete={handleDeleteSelected} 
                                selectionRange={selectionRange}
                                onRangeSelect={setSelectionRange}
                                lastSelectionRange={lastSelectionRef.current}
                            />
                        </div>
                    )}
                    {activeTab === "layers" && (
                        <div style={{ padding: 24, animation: "scaleIn 0.3s" }}>
                            <OrderList 
                                items={safeData.elements} 
                                pages={safeData.pages} 
                                selectedId={selectedElementId} 
                                onSelect={setSelectedElementId} 
                                onRename={(id, name) => handleUpdateElement(id, { label: name })}
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
