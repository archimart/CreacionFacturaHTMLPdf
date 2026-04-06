/**
 * OrderList con jerarquía:
 * - DnD solo en raíces
 * - Hijos (p.ej. table-row) listados debajo con indent
 */
import { useMemo, useState } from "react";

export default function OrderList({
  items = [], 
  pages = [], // Nueva prop para las páginas
  selectedId,
  onSelect,
  onReorder, 
  getIcon,
  getLabel,
  onRename,
  onRenamePage, // Prop para renombrar páginas
  onMovePage, // Nueva prop para mover páginas
  onDelete, // NEW: Prop to delete element
  exclude,
}) {
  const [expandedIds, setExpandedIds] = useState(new Set());

  const toggleExpand = (id) => {
    setExpandedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
    });
  };

  // Filtrado opcional
  const filtered = useMemo(
    () => (exclude ? items.filter((it) => !exclude(it)) : items),
    [items, exclude]
  );

  // Raíces (sin parentId), orden UI: el último del array va primero (frente)
  const rootsUI = useMemo(() => {
    return filtered
      .filter((it) => !it.parentId)
      .slice()
      .reverse(); 
  }, [filtered]);

  // Hijos por parentId (filas de tabla, etc.)
  const childrenByParent = useMemo(() => {
    const map = new Map();
    for (const it of filtered) {
      if (!it.parentId) continue;
      if (!map.has(it.parentId)) map.set(it.parentId, []);
      map.get(it.parentId).push(it);
    }
    // ordenar filas por meta.rowIndex si existe
    for (const [pid, arr] of map) {
      arr.sort((a, b) => {
        const ai = a.meta?.rowIndex;
        const bi = b.meta?.rowIndex;
        const bothRows = a.type === "table-row" && b.type === "table-row";
        if (bothRows && Number.isFinite(ai) && Number.isFinite(bi))
          return ai - bi;
        return 0; // mantener orden del array si no tienen row index
      });
    }
    return map;
  }, [filtered]);

  // DnD Capas
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);
  const onDragStart = (idx) => (e) => {
    setDragIdx(idx);
    e.dataTransfer.setData("type", "layer");
    e.dataTransfer.setData("idx", String(idx));
    e.dataTransfer.effectAllowed = "move";
  };
  const onDragOver = (idx) => (e) => {
    e.preventDefault();
    if (e.dataTransfer.getData("type") === "layer") {
        setOverIdx(idx);
    }
  };
  const onDrop = (idx) => (e) => {
    e.preventDefault();
    if (e.dataTransfer.getData("type") !== "layer") return;
    const from = dragIdx ?? Number(e.dataTransfer.getData("idx"));
    if (Number.isInteger(from) && from !== idx) {
        const dragId = rootsUI[from]?.id;
        const dropId = rootsUI[idx]?.id;
        if (dragId && dropId) onReorder?.(dragId, dropId);
    }
    setDragIdx(null);
    setOverIdx(null);
  };

  // DnD páginas
  const [dragPageIdx, setDragPageIdx] = useState(null);
  const [overPageIdx, setOverPageIdx] = useState(null);

  const onPageDragStart = (idx) => (e) => {
    setDragPageIdx(idx);
    e.dataTransfer.setData("type", "page");
    e.dataTransfer.setData("idx", String(idx));
    e.dataTransfer.effectAllowed = "move";
  };
  const onPageDragOver = (idx) => (e) => {
    e.preventDefault();
    if (e.dataTransfer.getData("type") === "page") {
        setOverPageIdx(idx);
    }
  };
  const onPageDrop = (idx) => (e) => {
    e.preventDefault();
    if (e.dataTransfer.getData("type") !== "page") return;
    const from = dragPageIdx ?? Number(e.dataTransfer.getData("idx"));
    if (Number.isInteger(from) && from !== idx) {
        onMovePage?.(from, idx);
    }
    setDragPageIdx(null);
    setOverPageIdx(null);
  };

  const n = rootsUI.length;

  // Helpers icon/label
  const iconOf = (it) =>
    getIcon?.(it) ??
    (it.type === "table"
      ? "▦"
      : it.type === "image"
      ? "🖼️"
      : it.type === "text"
      ? "T"
      : it.type === "box"
      ? "▢"
      : it.type === "table-row"
      ? "↳"
      : "•");

  const labelOf = (it) =>
    getLabel?.(it) ??
    (it.type === "table-row"
      ? `Fila ${Number(it.meta?.rowIndex ?? 0) + 1}`
      : it.name || it.type || it.id);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 20,
        height: "100%",
        overflow: "auto",
      }}
    >
      {pages.map((p, pIdx) => {
          // Filtrar elementos de esta página
          const pageItems = rootsUI.filter(it => it.pageId === p.id);

          return (
            <div key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div 
                    draggable
                    onDragStart={onPageDragStart(pIdx)}
                    onDragOver={onPageDragOver(pIdx)}
                    onDrop={onPageDrop(pIdx)}
                    onDragEnd={() => { setDragPageIdx(null); setOverPageIdx(null); }}
                    onClick={() => onSelect?.(p.id)}
                    style={{ 
                        fontSize: 11, fontWeight: 800, color: '#2563eb', 
                        background: selectedId === p.id ? '#bfdbfe' : (overPageIdx === pIdx ? '#dbeafe' : '#eff6ff'), 
                        padding: '6px 12px', borderRadius: 12,
                        textTransform: 'uppercase', letterSpacing: '0.5px',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        cursor: 'pointer',
                        border: selectedId === p.id ? '2px solid #2563eb' : (overPageIdx === pIdx ? '1px dashed #2563eb' : '1px solid transparent'),
                        transition: 'all 0.2s'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                        <span style={{ color: '#93c5fd' }}>☰</span>
                        <input 
                            value={p.name || `Página ${pIdx + 1}`}
                            onChange={(e) => onRenamePage?.(p.id, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            style={{ 
                                background: 'transparent', border: 'none', outline: 'none',
                                fontSize: 11, fontWeight: 800, color: '#2563eb',
                                width: '100%', textTransform: 'uppercase'
                            }}
                        />
                    </div>
                </div>
                {pageItems.map((el) => {
                    const idxInRoots = rootsUI.indexOf(el);
                    const selected = selectedId === el.id;
                    const over = overIdx === idxInRoots;
                    const rank = n - idxInRoots;

                    return (
                        <div key={el.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <div
                                draggable
                                onDragStart={onDragStart(idxInRoots)}
                                onDragOver={onDragOver(idxInRoots)}
                                onDrop={onDrop(idxInRoots)}
                                onDragEnd={() => {
                                    setDragIdx(null);
                                    setOverIdx(null);
                                }}
                                onClick={() => onSelect?.(el.id)}
                                style={{
                                    width: "100%",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 10,
                                    padding: 10,
                                    borderRadius: 12,
                                    border: selected ? "2px solid #2563eb" : "1px solid #e5e7eb",
                                    background: over ? "#f0f9ff" : "#fff",
                                    boxShadow: over ? "inset 0 0 0 1px #38bdf8" : "none",
                                    cursor: "grab",
                                    overflow: "hidden",
                                }}
                            >
                                <div style={{ width: 14, color: '#94a3b8' }}>☰</div>
                                
                                {el.type === 'table' && (
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); toggleExpand(el.id); }}
                                      style={{ 
                                          background: 'none', border: 'none', cursor: 'pointer', 
                                          color: '#94a3b8', fontSize: 14, width: 20, 
                                          transition: 'transform 0.2s', 
                                          transform: expandedIds.has(el.id) ? 'rotate(90deg)' : 'rotate(0deg)' 
                                      }}
                                    >▶</button>
                                )}

                                <div style={{ width: 24, textAlign: "center" }}>{iconOf(el)}</div>

                                <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
                                    <input
                                        value={labelOf(el)}
                                        onChange={(e) => onRename?.(el.id, e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                        style={{
                                            width: "100%", fontSize: 13, fontWeight: 600, color: "#1e293b",
                                            border: "none", background: "transparent", outline: "none", padding: 0
                                        }}
                                    />
                                    <div style={{ fontSize: 10, color: "#94a3b8" }}>
                                        {el.w}×{el.h}px
                                    </div>
                                </div>

                                <div style={{ 
                                    fontSize: 10, fontWeight: 700, color: '#64748b', 
                                    background: '#f1f5f9', padding: '2px 6px', borderRadius: 6
                                }}>
                                    {rank === n ? 'Frente' : rank === 1 ? 'Fondo' : `Capa ${rank}`}
                                </div>
                                
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onDelete?.(el.id); }}
                                    style={{ 
                                        padding: "4px 8px", background: "transparent", border: "none", 
                                        color: "#ef4444", cursor: "pointer", borderRadius: 8,
                                        display: "flex", alignItems: "center", justifyContent: "center"
                                    }}
                                >✕</button>
                            </div>

                            {/* Hijos Reales (con parentId) e Hijos Virtuales (Celdas) */}
                            {(!expandedIds.has(el.id) && el.type === 'table') ? null : [
                                // Hijos directos con parentId
                                ...(childrenByParent.get(el.id) || []),
                                // Hijos virtuales (TODAS las celdas de la tabla)
                                ...(el.type === 'table' ? (el.table?.data || []).flatMap((row, r) => 
                                    row.map((cell, c) => {
                                        const hasImage = cell?.includes('<img');
                                        return {
                                            id: `${el.id}::cell:${r}:${c}`,
                                            type: hasImage ? 'image' : (cell ? 'text' : 'cell'),
                                            label: `Celda [F${r+1}:C${c+1}]${cell ? ': ' + (hasImage ? 'Imagen' : cell.substring(0, 15) + (cell.length > 15 ? '...' : '')) : ''}`,
                                            text: cell,
                                            _isVirtual: true
                                        };
                                    })
                                ) : [])
                            ].map(ch => {
                                const chSelected = selectedId === ch.id;
                                const isCell = ch._isVirtual;
                                return (
                                    <div 
                                        key={ch.id} 
                                        onClick={(e) => { e.stopPropagation(); onSelect?.(ch.id); }}
                                        style={{ 
                                            marginLeft: 30, display: 'flex', alignItems: 'center', gap: 10, 
                                            padding: '6px 12px', background: chSelected ? '#eff6ff' : (isCell ? '#fff' : '#f8fafc'), 
                                            borderRadius: 10, border: chSelected ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                                            fontSize: 11, cursor: 'pointer', transition: 'all 0.2s', position: 'relative',
                                            marginTop: 3, opacity: isCell && !ch.text ? 0.6 : 1
                                        }}
                                    >
                                        <div style={{ position: 'absolute', left: -15, top: 0, bottom: '50%', width: 10, borderLeft: '2px solid #e2e8f0', borderBottom: '2px solid #e2e8f0', borderBottomLeftRadius: 6 }} />
                                        <span style={{ fontSize: 13 }}>{iconOf(ch)}</span>
                                        <div
                                            style={{
                                                flex: 1, fontWeight: chSelected ? 700 : 500, color: chSelected ? "#2563eb" : "#475569",
                                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                            }}
                                        >
                                            {ch.label}
                                        </div>
                                        {/* Acciones */}
                                        <button 
                                            onClick={(e) => { 
                                                e.stopPropagation(); 
                                                if (ch._isVirtual) onRename?.(ch.id, { text: "" }); // Borrar contenido
                                                else onRename?.(ch.id, { parentId: undefined });   // Eyectar
                                            }}
                                            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 14 }}
                                        >
                                            {ch._isVirtual ? (ch.text ? '×' : '') : '⎋'}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
          );
      })}

      {!pages.length && (
        <div style={{ fontSize: 12, color: "#64748b" }}>
          No hay páginas que mostrar.
        </div>
      )}
    </div>
  );
}
