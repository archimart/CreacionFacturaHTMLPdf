import React from 'react';
import { Handle, Position, getBezierPath, EdgeLabelRenderer, BaseEdge } from '@xyflow/react';
import {
    Mail, Smartphone, FileText, Database, GitMerge, Variable,
    Clock, Filter, Code, Download, Zap, X, Plus
} from 'lucide-react';
import { Terminal } from 'lucide-react';

// ─── Estilos CSS globales del canvas ────────────────────────────────────────
export const GLOBAL_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');
  :root { --primary: #3b82f6; --font-main: 'Outfit', sans-serif; }
  body { font-family: var(--font-main); margin: 0; overflow: hidden; }
  .theme-dark  { --node-bg: #0c0c0e; --node-border: rgba(255,255,255,0.1); --node-text: #fafafa; --node-desc: #a1a1aa; --node-footer-bg: rgba(255,255,255,0.04); --canvas-bg: #030712; --header-bg: rgba(9,9,11,0.9); --grid-color: #111827; --editor-bg: #020617; --editor-header: #0f172a; --editor-border: #1e293b; --btn-bg: #18181b; --btn-border: #27272a; --input-bg: #09090b; --input-text: #fff; --tab-bg: #111827; --tab-active: #1e293b; }
  .theme-light { --node-bg: #ffffff; --node-border: #64748b; --node-text: #000000; --node-desc: #0f172a; --node-footer-bg: #cbd5e1; --canvas-bg: #94a3b8; --header-bg: rgba(255,255,255,0.98); --grid-color: #475569; --editor-bg: #94a3b8; --editor-header: #ffffff; --editor-border: #64748b; --btn-bg: #cbd5e1; --btn-border: #64748b; --input-bg: #ffffff; --input-text: #000000; --tab-bg: #64748b; --tab-active: #ffffff; }
  .n8n-handle { width: 14px !important; height: 14px !important; background: var(--node-bg) !important; border: 3px solid var(--primary) !important; border-radius: 50% !important; z-index: 100 !important; }
  .n8n-handle-left  { border: 3px solid #3b82f6 !important; }
  .n8n-handle-right { border: 3px solid #a855f7 !important; }
  .n8n-handle-true  { border: 3px solid #10b981 !important; }
  .n8n-handle-false { border: 3px solid #ef4444 !important; }
  .custom-input { width: 100%; padding: 12px 18px; border-radius: 14px; border: 1.5px solid var(--node-border); background: var(--input-bg); color: var(--input-text); font-weight: 600; outline: none; }
  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(8px); z-index: 10000; display: flex; align-items: center; justify-content: center; }
  .tab { padding: 10px 24px; cursor: pointer; display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 13px; border-radius: 14px 14px 0 0; border: 1px solid var(--node-border); border-bottom: none; transition: all 0.2s; min-width: 150px; position: relative; }
  .tab-active { background: var(--tab-active); color: var(--primary); border-top: 3px solid var(--primary); }
  .tab-close:hover { color: #f43f5e; transform: scale(1.2); }
  .tab-input { background: transparent; border: none; color: var(--primary); font-weight: 800; font-size: 13px; font-family: inherit; width: 100%; outline: none; }
  .n8n-nav-btn:hover { transform: scale(1.15) !important; border-color: #60a5fa !important; box-shadow: 0 12px 30px rgba(59,130,246,0.4) !important; }
  .n8n-nav-btn:hover .nav-tooltip-left  { opacity: 1 !important; transform: translateX(5px) !important; }
  .n8n-nav-btn:hover .nav-tooltip-right { opacity: 1 !important; transform: translateX(-5px) !important; }
`;

// ─── Edge personalizado: botones eliminar/insertar + badge de conteo ─────────
export const ActionEdge = ({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style = {}, markerEnd, data }) => {
    const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
    // Posición del badge: 28% del camino desde el origen hasta el punto medio
    const badgeX = sourceX + (labelX - sourceX) * 0.28;
    const badgeY = sourceY + (labelY - sourceY) * 0.28;

    return (
        <>
            <BaseEdge path={edgePath} markerEnd={markerEnd} style={{ ...style, strokeWidth: 2, stroke: '#3b82f6' }} />
            <EdgeLabelRenderer>
                {/* Badge de conteo de registros */}
                {data?.count > 0 && (
                    <div style={{ position: 'absolute', transform: `translate(-50%,-50%) translate(${badgeX}px,${badgeY}px)`, pointerEvents: 'none', zIndex: 999 }}>
                        <div style={{ background: '#0f172a', color: '#60a5fa', fontSize: 9, fontWeight: 900, padding: '2px 7px', borderRadius: 20, border: '1px solid rgba(96,165,250,0.35)', whiteSpace: 'nowrap', letterSpacing: 0.3 }}>
                            {Number(data.count).toLocaleString('es-CO')}
                        </div>
                    </div>
                )}
                {/* Botones eliminar / insertar (punto medio de la línea) */}
                <div style={{ position: 'absolute', transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)`, pointerEvents: 'all', zIndex: 1000 }} className="nodrag nopan">
                    <div style={{ display: 'flex', gap: 2, background: 'rgba(0,0,0,0.8)', padding: '2px', borderRadius: '6px', boxShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>
                        <button onClick={(e) => { e.stopPropagation(); window._onDeleteEdge?.(id); }} style={{ width: 16, height: 16, borderRadius: 4, background: '#f43f5e', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Eliminar"><X size={10} strokeWidth={5}/></button>
                        <button onClick={(e) => { e.stopPropagation(); window._onInsertNode?.(id); }} style={{ width: 16, height: 16, borderRadius: 4, background: '#10b981', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Insertar"><Plus size={10} strokeWidth={5}/></button>
                    </div>
                </div>
            </EdgeLabelRenderer>
        </>
    );
};

// ─── Wrapper visual de nodo ──────────────────────────────────────────────────
export const NodeWrapper = ({ id, type, data, selected, icon: Icon, title, desc, color }) => {
    const isJoin         = type === 'union' && data?.mode === 'join';
    const isFilter       = type === 'filter';
    const outputCount    = data?.outputCount     || 0;
    const unmatchedCount = data?.unmatchedCount  || 0;
    const trueCount      = data?.outputCountTrue  || 0;
    const falseCount     = data?.outputCountFalse || 0;

    return (
        <div onDoubleClick={() => data.onOpen?.(id)} style={{ cursor: 'pointer', position: 'relative' }}>
            {/* Handles de ENTRADA */}
            {type === 'union' ? (
                <>
                    <Handle type="target" position={Position.Left} id="left"  className="n8n-handle n8n-handle-left"  style={{ top: '35%' }} title="Fuente Izquierda (Base)" />
                    <Handle type="target" position={Position.Left} id="right" className="n8n-handle n8n-handle-right" style={{ top: '65%' }} title="Fuente Derecha (Cruce)" />
                </>
            ) : (
                <Handle type="target" position={Position.Left} className="n8n-handle" />
            )}

            {/* Cuerpo del nodo */}
            <div style={{ background: 'var(--node-bg)', borderRadius: 28, border: `2px solid ${selected ? 'var(--primary)' : 'var(--node-border)'}`, boxShadow: selected ? '0 0 0 8px rgba(59,130,246,0.2)' : '0 15px 45px rgba(0,0,0,0.15)', width: 300, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', padding: '20px 24px 16px' }}>
                    <div style={{ width: 52, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 16, background: `${color}18`, color, border: `1.5px solid ${color}30`, flexShrink: 0 }}>
                        <Icon size={26} strokeWidth={2.5} />
                    </div>
                    <div style={{ paddingLeft: 18, flex: 1, minWidth: 0 }}>
                        <div style={{ color: 'var(--node-text)', fontSize: 15, fontWeight: 800 }}>{title}</div>
                        <div style={{ color: 'var(--node-desc)', fontSize: 10, fontWeight: 700 }}>{desc}</div>
                    </div>
                </div>

                {/* Footer con conteos de registros */}
                {isJoin && (outputCount > 0 || unmatchedCount > 0) ? (
                    <div style={{ padding: '0 16px 14px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 20, border: '1px solid rgba(16,185,129,0.25)' }}>
                            ✓ {outputCount.toLocaleString('es-CO')}
                        </span>
                        <span style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 20, border: '1px solid rgba(239,68,68,0.2)' }}>
                            ✗ {unmatchedCount.toLocaleString('es-CO')}
                        </span>
                    </div>
                ) : isFilter && (trueCount > 0 || falseCount > 0) ? (
                    <div style={{ padding: '0 16px 14px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 20, border: '1px solid rgba(16,185,129,0.25)' }}>
                            ✓ {trueCount.toLocaleString('es-CO')}
                        </span>
                        <span style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 20, border: '1px solid rgba(239,68,68,0.2)' }}>
                            ✗ {falseCount.toLocaleString('es-CO')}
                        </span>
                    </div>
                ) : outputCount > 0 ? (
                    <div style={{ padding: '0 20px 14px' }}>
                        <span style={{ background: `${color}12`, color, fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 20, border: `1px solid ${color}25` }}>
                            {outputCount.toLocaleString('es-CO')} registros
                        </span>
                    </div>
                ) : null}
            </div>

            {/* Handles de SALIDA */}
            {type === 'filter' ? (
                <>
                    <Handle type="source" position={Position.Right} id="true"  className="n8n-handle n8n-handle-true"  style={{ top: '35%' }} title="Coincide (True)" />
                    <Handle type="source" position={Position.Right} id="false" className="n8n-handle n8n-handle-false" style={{ top: '65%' }} title="No Coincide (False)" />
                </>
            ) : isJoin ? (
                <>
                    <Handle type="source" position={Position.Right} id="matched"   className="n8n-handle n8n-handle-true"  style={{ top: '38%' }} title={`Coinciden (${outputCount.toLocaleString('es-CO')})`} />
                    <Handle type="source" position={Position.Right} id="unmatched" className="n8n-handle n8n-handle-false" style={{ top: '62%' }} title={`No coinciden (${unmatchedCount.toLocaleString('es-CO')})`} />
                </>
            ) : (
                <Handle type="source" position={Position.Right} className="n8n-handle" />
            )}
        </div>
    );
};

// ─── Definición de tipos de nodo para ReactFlow ──────────────────────────────
export const NODE_TYPES = {
    invoice:       (p) => <NodeWrapper {...p} icon={FileText}   title="Diseño Documento"  desc="Plantilla Dinámica"    color="#f43f5e" />,
    database:      (p) => <NodeWrapper {...p} icon={Database}   title="Origen Datos"       desc="Excel / SQL / API"    color="#7c3aed" />,
    union:         (p) => <NodeWrapper {...p} type="union" icon={GitMerge} title="Unión Datos" desc="Unir/Combinar Fuentes" color="#a855f7" />,
    variable:      (p) => <NodeWrapper {...p} icon={Variable}   title="Variables"          desc="Campos Globales"       color="#3b82f6" />,
    email:         (p) => <NodeWrapper {...p} icon={Mail}       title="Email SMTP"         desc="Gmail / Outlook"       color="#ea580c" />,
    sms:           (p) => <NodeWrapper {...p} icon={Smartphone} title="WhatsApp"           desc="SMS / Notify"          color="#16a34a" />,
    schedule:      (p) => <NodeWrapper {...p} icon={Clock}      title="Programador"        desc="CRON / Tiempo"         color="#eab308" />,
    filter:        (p) => <NodeWrapper {...p} type="filter" icon={Filter} title="Filtro Lógica" desc="Condicionales"   color="#22d3ee" />,
    code:          (p) => <NodeWrapper {...p} icon={Code}       title="JavaScript"         desc="Scripting"             color="#fbbf24" />,
    pdf_generator: (p) => <NodeWrapper {...p} icon={FileText}   title="Generador PDF"      desc="PDFs Individuales"     color="#ef4444" />,
};

export const EDGE_TYPES = { action: ActionEdge };

// ─── Icono pequeño por tipo de nodo (usado en navegación) ───────────────────
export function getNodeIcon(type) {
    switch (type) {
        case 'invoice':       return <FileText   size={20} color="#10b981" />;
        case 'database':      return <Database   size={20} color="#3b82f6" />;
        case 'union':         return <GitMerge   size={20} color="#a855f7" />;
        case 'schedule':      return <Clock      size={20} color="#8b5cf6" />;
        case 'variable':      return <Variable   size={20} color="#f59e0b" />;
        case 'pdf_generator': return <Download   size={20} color="#ef4444" />;
        case 'code':          return <Terminal   size={20} color="#ec4899" />;
        default:              return <Zap        size={20} color="#64748b" />;
    }
}

// ─── Catálogo de nodos disponibles para el menú "Agregar nodo" ──────────────
export const NODE_CATALOG = [
    { type: 'database',      label: 'Origen Datos',   icon: Database,   color: '#7c3aed' },
    { type: 'union',         label: 'Unión Datos',    icon: GitMerge,   color: '#a855f7' },
    { type: 'variable',      label: 'Variables',      icon: Variable,   color: '#3b82f6' },
    { type: 'invoice',       label: 'Diseño Doc',     icon: FileText,   color: '#f43f5e' },
    { type: 'pdf_generator', label: 'Generador PDF',  icon: FileText,   color: '#ef4444' },
    { type: 'email',         label: 'Email SMTP',     icon: Mail,       color: '#ea580c' },
    { type: 'sms',           label: 'WhatsApp',       icon: Smartphone, color: '#16a34a' },
    { type: 'schedule',      label: 'Cron / Tiempo',  icon: Clock,      color: '#eab308' },
    { type: 'filter',        label: 'Filtro Lógica',  icon: Filter,     color: '#22d3ee' },
    { type: 'code',          label: 'JavaScript',     icon: Code,       color: '#fbbf24' },
];
