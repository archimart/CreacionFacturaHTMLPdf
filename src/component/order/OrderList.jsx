/**
 * OrderList con jerarquía y soporte de páginas:
 * - Soporta DnD de elementos y páginas
 * - Renderizado en árbol para bloques lógicos
 */
import { useMemo, useState } from "react";
import { Layout, Check, Trash2, GitBranch, ChevronRight, ChevronDown } from "lucide-react";

export default function OrderList({
  items = [], 
  pages = [], 
  selectedId,
  onSelect,
  onReorder, 
  getIcon,
  getLabel,
  onRename,
  onRenamePage,
  onMovePage,
  onDelete,
  onDoubleClick,
  onTableAction,
  currentRecord = {},
  evaluateLogic,
  exclude,
}) {
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);
  const [dragPageIdx, setDragPageIdx] = useState(null);
  const [overPageIdx, setOverPageIdx] = useState(null);
  const [overBranchId, setOverBranchId] = useState(null);

  const toggleExpand = (id) => {
    setExpandedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
    });
  };

  const filtered = useMemo(
    () => (exclude ? items.filter((it) => !exclude(it)) : items),
    [items, exclude]
  );

  // Handlers para reordenar páginas
  const onPageDragStart = (idx) => (e) => {
    setDragPageIdx(idx);
    e.dataTransfer.setData("type", "page");
  };

  const onPageDragOver = (idx) => (e) => {
    e.preventDefault();
    setOverPageIdx(idx);
  };

  const onPageDrop = (targetIdx) => (e) => {
    e.preventDefault();
    if (dragPageIdx !== null && dragPageIdx !== targetIdx) {
      onMovePage?.(dragPageIdx, targetIdx);
    }
    setDragPageIdx(null);
    setOverPageIdx(null);
  };

  const iconOf = (el) => getIcon?.(el) || "📄";
  const labelOf = (el) => getLabel?.(el) || el.id;

  const renderTree = (parentId, pageId, depth = 0) => {
    const children = filtered.filter(it => {
        const matchesParent = (it.parentId || null) === (parentId || null);
        const isFirstPage = pages[0]?.id === pageId;
        const matchesPage = parentId ? true : (it.pageId === pageId || (isFirstPage && !it.pageId));
        return matchesParent && matchesPage;
    });
    const sorted = [...children].sort((a,b) => (b.z || 0) - (a.z || 0));

    const parentEl = items.find(e => e.id === parentId);
    let logicResult = true;
    if (parentEl?.type === 'logical-if' && evaluateLogic) {
        logicResult = evaluateLogic(parentEl, [currentRecord]);
    }

    if (parentEl?.type === 'logical-if' && expandedIds.has(parentId)) {
        const branches = [
            { 
                id: 'true', label: 'VERDADERO (SÍ)', color: '#10b981', symbol: '✓', 
                isActive: logicResult === true,
                items: sorted.filter(c => (c.branch || 'true') === 'true') 
            },
            { 
                id: 'false', label: 'FALSO (NO)', color: '#ef4444', symbol: '✕', 
                isActive: logicResult === false,
                items: sorted.filter(c => c.branch === 'false') 
            }
        ];

        return branches.map(b => {
            const branchId = `${parentId}_branch_${b.id}`;
            const isExpanded = expandedIds.has(branchId);
            return (
                <div 
                    key={branchId} 
                    onDragOver={(e) => {
                        e.preventDefault();
                        if (overBranchId !== branchId) setOverBranchId(branchId);
                    }}
                    onDragEnter={(e) => {
                        e.preventDefault();
                        setOverBranchId(branchId);
                    }}
                    onDragLeave={() => setOverBranchId(null)}
                    onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setOverBranchId(null);
                        const dragId = e.dataTransfer.getData("id");
                        if (!dragId || dragId === parentId) return;
                        onReorder?.(dragId, { parentId: parentId, branch: b.id });
                        setExpandedIds(prev => new Set([...prev, branchId]));
                    }}
                    style={{ 
                        display: 'flex', flexDirection: 'column', gap: 4, marginLeft: depth * 20,
                        background: overBranchId === branchId ? `${b.color}15` : 'transparent',
                        borderRadius: 14, transition: 'all 0.2s',
                        border: overBranchId === branchId ? `2px solid ${b.color}` : '2px solid transparent',
                        padding: 4
                    }}
                >
                    <div 
                        onClick={() => {
                            const next = new Set(expandedIds);
                            if (next.has(branchId)) next.delete(branchId);
                            else next.add(branchId);
                            setExpandedIds(next);
                        }}
                        style={{ 
                            padding: '10px 14px', fontSize: '10px', fontWeight: 900, 
                            color: 'white', 
                            background: b.color, 
                            borderRadius: 12, display: 'flex', alignItems: 'center', gap: 8, 
                            boxShadow: overBranchId === branchId ? `0 8px 25px ${b.color}60` : `0 4px 10px ${b.color}20`, 
                            textTransform: 'uppercase', cursor: 'pointer',
                            transition: 'all 0.3s', 
                            transform: overBranchId === branchId ? 'scale(1.02)' : 'scale(1)',
                            opacity: b.isActive ? 1 : 0.4,
                            filter: b.isActive ? 'none' : 'grayscale(0.6)',
                            border: b.isActive ? `2px solid rgba(255,255,255,0.4)` : 'none'
                        }}
                    >
                        <span style={{ 
                            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', 
                            transition: 'transform 0.2s', display: 'inline-block', width: 10
                        }}>▶</span>
                        <span style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 6px', borderRadius: 6 }}>{b.symbol}</span>
                        {b.label}
                        <span style={{ marginLeft: 'auto', background: 'rgba(0,0,0,0.1)', padding: '2px 8px', borderRadius: 20 }}>{b.items.length} items</span>
                    </div>
                    
                    {isExpanded && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 4, borderLeft: `2px dashed ${b.color}40`, marginLeft: 8, marginTop: 4 }}>
                            {b.items.map(el => renderItem(el, pageId, depth + 1))}
                            {b.items.length === 0 && (
                                <div style={{ fontSize: '9px', color: '#94a3b8', fontStyle: 'italic', padding: '15px 20px', textAlign: 'center' }}>Arrastra un objeto aquí</div>
                            )}
                        </div>
                    )}
                </div>
            );
        });
    }

    return sorted.map((el) => renderItem(el, pageId, depth));
  };

  const renderItem = (el, pageId, depth) => {
      const idxInFiltered = filtered.indexOf(el);
      const selected = selectedId === el.id;
      const isLogic = el.type && el.type.startsWith('logical-');
      const logicColor = el.type === 'logical-if' ? '#10b981' :
                         el.type === 'logical-else-if' ? '#f59e0b' : 
                         el.type === 'logical-else' ? '#64748b' : '#8b5cf6';
      
      const logicIcon = el.type === 'logical-if' ? '◆' :
                        el.type === 'logical-else-if' ? '◇' : 
                        el.type === 'logical-else' ? '↩' : '⟳';

      return (
        <div key={el.id} style={{ display: "flex", flexDirection: "column", gap: 4, marginLeft: depth * 20 }}>
          <div
            draggable
            onDragStart={(e) => {
                setDragIdx(idxInFiltered);
                e.dataTransfer.setData("type", "layer");
                e.dataTransfer.setData("id", el.id);
            }}
            onDragOver={(e) => {
                e.preventDefault();
                setOverIdx(idxInFiltered);
            }}
            onDragEnter={(e) => {
                if (isLogic && !expandedIds.has(el.id)) {
                    toggleExpand(el.id);
                }
            }}
            onDrop={(e) => {
                e.preventDefault();
                const dragId = e.dataTransfer.getData("id");
                if (!dragId || dragId === el.id) return;
                
                // If dropping into a logical block header, make it a child
                if (isLogic) {
                    const dropData = { parentId: el.id };
                    if (el.type === 'logical-if' || el.type === 'logical-else-if') {
                        dropData.branch = 'true';
                    }
                    onReorder?.(dragId, dropData);
                } else {
                    onReorder?.(dragId, el.id);
                }
                setOverIdx(null);
            }}
            onClick={() => onSelect?.(el.id)}
            onDoubleClick={(e) => {
                if (isLogic) {
                    e.stopPropagation();
                    // Open modal ONLY if clicking outside the icon/arrow area
                    onDoubleClick?.(el.id);
                }
            }}
            style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10,
                padding: isLogic ? "10px 14px" : "8px 10px", borderRadius: 14,
                borderTopWidth: "1px",
                borderRightWidth: "1px",
                borderBottomWidth: "1px",
                borderLeftWidth: isLogic ? "4px" : (selected ? "2px" : "1px"),
                borderStyle: isLogic ? "dashed" : "solid",
                borderTopColor: selected ? logicColor : (isLogic ? `${logicColor}60` : "#f1f5f9"),
                borderRightColor: selected ? logicColor : (isLogic ? `${logicColor}60` : "#f1f5f9"),
                borderBottomColor: selected ? logicColor : (isLogic ? `${logicColor}60` : "#f1f5f9"),
                borderLeftColor: (selected || isLogic) ? logicColor : "#f1f5f9",
                background: selected ? `${logicColor}10` : (isLogic ? `${logicColor}03` : "#fff"),
                cursor: "pointer", transition: "all 0.2s",
                boxShadow: selected ? `0 4px 12px ${logicColor}20` : "none",
                opacity: dragIdx === idxInFiltered ? 0.4 : 1,
            }}
          >
            <div 
                style={{ width: 14, color: logicColor, fontSize: 16, cursor: 'pointer' }}
                onClick={(e) => { e.stopPropagation(); toggleExpand(el.id); }}
                onDoubleClick={(e) => { e.stopPropagation(); toggleExpand(el.id); }}
            >
                {isLogic ? logicIcon : '☰'}
            </div>
            
            {(isLogic || el.type === 'table') && (
                <div 
                  onClick={(e) => { e.stopPropagation(); toggleExpand(el.id); }}
                  onDoubleClick={(e) => { e.stopPropagation(); toggleExpand(el.id); }}
                  style={{ 
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'none', border: 'none', cursor: 'pointer', 
                      color: logicColor, fontSize: 12, width: 20, 
                      transform: expandedIds.has(el.id) ? 'rotate(90deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s'
                  }}
                >▶</div>
            )}

            <div 
                onClick={(e) => { e.stopPropagation(); toggleExpand(el.id); }}
                onDoubleClick={(e) => { e.stopPropagation(); toggleExpand(el.id); }}
                style={{ 
                    width: 28, height: 28, borderRadius: 8, 
                    background: isLogic ? `${logicColor}15` : '#f8fafc',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: logicColor, fontSize: 14, fontWeight: 'bold', cursor: 'pointer'
                }}
            >
                {isLogic ? logicIcon : iconOf(el)}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 1, flex: 1, minWidth: 0 }}>
                <input
                    value={labelOf(el)}
                    onChange={(e) => onRename?.(el.id, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        width: "100%", fontSize: 13, fontWeight: 700, 
                        color: isLogic ? logicColor : "#1e293b",
                        border: "none", background: "transparent", outline: "none", padding: 0
                    }}
                />
                <div style={{ fontSize: 9, fontWeight: 800, color: logicColor, opacity: 0.8, textTransform: 'uppercase' }}>
                    {isLogic ? (
                        el.type === 'logical-if' ? `SÍ (VERDADERO): ${el.logic?.condition || '(Vacio)'}` : 
                        el.type === 'logical-else-if' ? `SINO SI: ${el.logic?.condition || '(Vacio)'}` :
                        el.type === 'logical-else' ? 'SINO (FALSO - FALLBACK)' : `BUCLE (PARA CADA: ${el.logic?.loop?.source || '...'})`
                    ) : `${el.type} ${el.w}×${el.h}px`}
                </div>
            </div>

            <button 
                onClick={(e) => { e.stopPropagation(); onDelete?.(el.id); }}
                style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", padding: 4 }}
            >✕</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {expandedIds.has(el.id) && renderTree(el.id, pageId, depth + 1)}
            
            {el.type === 'table' && expandedIds.has(el.id) && (
               <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginLeft: (depth + 1) * 20, padding: '4px 0' }}>
                   
                   {/* OPCIÓN DATOS REPETIDOS DIRECTO EN LA LISTA CREADA */}
                   <div style={{ display: "flex", gap: 4, background: "rgba(59,130,246,0.05)", padding: 4, borderRadius: 8, marginBottom: 4, border: '1px solid rgba(59,130,246,0.1)' }}>
                       <button
                           onClick={(e) => { e.stopPropagation(); onTableAction?.(el.id, 'update-props', { dataSource: 'static', collectionField: '' }); }}
                           style={{ flex: 1, padding: "4px", background: (el.table?.dataSource || 'static') === 'static' ? "#3b82f6" : "transparent", color: (el.table?.dataSource || 'static') === 'static' ? "white" : "#64748b", border: "none", borderRadius: 6, fontSize: "9px", fontWeight: 800, cursor: "pointer", transition: "all 0.2s" }}
                           title="Tabla normal (estática)"
                       >ESTÁTICO</button>
                       <button
                           onClick={(e) => { e.stopPropagation(); onTableAction?.(el.id, 'update-props', { dataSource: 'dynamic' }); }}
                           style={{ flex: 1, padding: "4px", background: (el.table?.dataSource === 'dynamic') ? "#10b981" : "transparent", color: (el.table?.dataSource === 'dynamic') ? "white" : "#64748b", border: "none", borderRadius: 6, fontSize: "9px", fontWeight: 800, cursor: "pointer", transition: "all 0.2s" }}
                           title="Repetir filas según una lista de datos (Dynamic)"
                       >REPETITIVO</button>
                   </div>

                   {el.table?.dataSource === 'dynamic' && (
                       <select 
                           value={el.table?.collectionField || ""}
                           onChange={(e) => { e.stopPropagation(); onTableAction?.(el.id, 'update-props', { collectionField: e.target.value }); }}
                           style={{ width: "100%", padding: "6px 8px", borderRadius: 8, border: "1px dashed #10b981", fontSize: "10px", fontWeight: 600, background: "rgba(16,185,129,0.05)", color: "#064e3b", marginBottom: 6, outline: 'none' }}
                       >
                           <option value="">(Asignar a Lista...)</option>
                           {currentRecord && Object.keys(currentRecord).map(k => (
                               Array.isArray(currentRecord[k]) && <option key={k} value={k}>➔ Repetir por: {k} ({currentRecord[k].length} ítems)</option>
                           ))}
                       </select>
                   )}
                   
                   {Array.from({ length: el.table?.rows || 1 }).map((_, rIdx) => (
                       <div key={`${el.id}-r-${rIdx}`} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', background: 'rgba(59,130,246,0.05)', borderRadius: 10, fontSize: 11, color: '#1e293b', border: '1px solid rgba(59,130,246,0.1)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Layout size={12} color="#3b82f6" /> 
                                    <span style={{ fontWeight: 800 }}>FILA {rIdx + 1}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onTableAction?.(el.id, 'add-cell', { row: rIdx }); }}
                                        style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, padding: '2px 8px', fontSize: 10, fontWeight: 900, cursor: 'pointer', boxShadow: '0 2px 4px rgba(59,130,246,0.2)' }}
                                        title="Agregar celda a esta fila"
                                    >+ CELDA</button>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onTableAction?.(el.id, 'del-row', { r: rIdx }); }}
                                        style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: '0 2px', fontSize: 13, fontWeight: 900 }}
                                        title="Eliminar esta fila"
                                    >×</button>
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '0 8px' }}>
                                {Array.from({ length: (el.table?.data?.[rIdx]?.length || el.table?.cols || 1) }).map((_, cIdx) => (
                                    <div key={`${el.id}-r-${rIdx}-c-${cIdx}`} style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '2px 6px', background: 'white', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: '9px', color: '#64748b', fontWeight: 600 }}>
                                        C{cIdx + 1}
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); onTableAction?.(el.id, 'del-cell', { row: rIdx, col: cIdx }); }}
                                            style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: '0 2px', fontSize: 8, fontWeight: 900 }}
                                        >×</button>
                                    </div>
                                ))}
                            </div>
                       </div>
                   ))}
                   <button 
                     onClick={(e) => { e.stopPropagation(); onTableAction?.(el.id, 'add-row'); }}
                     style={{ marginTop: 4, width: '100%', padding: '8px', background: 'white', border: '2px dashed #3b82f6', color: '#3b82f6', borderRadius: 10, fontSize: 9, fontWeight: 900, cursor: 'pointer', transition: 'all 0.2s' }}
                   >+ AÑADIR NUEVA FILA</button>
               </div>
            )}
          </div>
        </div>
      );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, height: "100%", overflow: "auto", paddingBottom: 40 }}>
      {pages.map((p, pIdx) => {
          const isOver = overPageIdx === pIdx;
          return (
            <div key={p.id} style={{ 
                display: 'flex', flexDirection: 'column', gap: 12,
                borderTop: isOver && dragPageIdx > pIdx ? '4px solid #2563eb' : 'none',
                borderBottom: isOver && dragPageIdx < pIdx ? '4px solid #2563eb' : 'none'
            }}>
                <div 
                    draggable
                    onDragStart={onPageDragStart(pIdx)}
                    onDragOver={(e) => {
                        e.preventDefault();
                        onPageDragOver(pIdx)(e);
                    }}
                    onDrop={(e) => {
                        e.preventDefault();
                        const type = e.dataTransfer.getData("type");
                        if (type === "layer") {
                            e.stopPropagation();
                            const dragId = e.dataTransfer.getData("id");
                            if (dragId) {
                                onReorder?.(dragId, { parentId: null, pageId: p.id });
                            }
                        } else {
                            onPageDrop(pIdx)(e);
                        }
                    }}
                    onDragEnd={() => { setDragPageIdx(null); setOverPageIdx(null); }}
                    onClick={() => onSelect?.(p.id)}
                    style={{ 
                        fontSize: 10, fontWeight: 900, color: '#2563eb', 
                        background: (isOver && !dragPageIdx) ? '#dbeafe' : (selectedId === p.id ? '#eff6ff' : '#f8fafc'), 
                        padding: '10px 16px', borderRadius: 16,
                        textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        cursor: 'pointer', 
                        border: (isOver && !dragPageIdx) ? '2px solid #2563eb' : (selectedId === p.id ? '2px solid #2563eb' : '1px solid #e2e8f0'),
                        opacity: dragPageIdx === pIdx ? 0.4 : 1,
                        transition: 'all 0.2s'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                        <Layout size={14} />
                        <input 
                            value={p.name || `Página ${pIdx + 1}`}
                            onChange={(e) => onRenamePage?.(p.id, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 10, fontWeight: 900, color: '#2563eb', width: '100%', textTransform: 'uppercase' }}
                        />
                    </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {renderTree(null, p.id)}
                </div>
            </div>
          );
      })}
      {!pages.length && <div style={{ fontSize: 12, color: "#64748b" }}>No hay páginas.</div>}
    </div>
  );
}
