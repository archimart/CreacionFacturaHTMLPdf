"use client";

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { 
  Mail, MessageSquare, FileText, Plus, Workflow, Zap, Database, Smartphone, 
  Search, History, Save, Settings, ChevronRight, Moon, Sun, ArrowLeft, 
  Clock, Cpu, Check, X, Shield, Activity, Layers, Play
} from 'lucide-react';
import DocumentDesigner from './DocumentDesigner';
import DatabaseNodeEditor from './DatabaseNodeEditor';
import SchedulerNodeEditor from './SchedulerNodeEditor';

// --- ESTILOS COMPARTIDOS Y TEMAS (PREMIUM UI/UX) ---
const GLOBAL_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');
  :root { 
    --primary: #3b82f6; --primary-glow: rgba(59, 130, 246, 0.5); 
    --secondary: #8b5cf6; --accent: #f43f5e; --font-main: 'Outfit', sans-serif; 
  }
  body { font-family: var(--font-main); background: #030712; margin: 0; overflow: hidden; }

  .theme-dark { 
    --node-bg: #0c0c0e; --node-border: rgba(255, 255, 255, 0.08); --node-text: #fafafa; 
    --node-desc: #71717a; --node-footer-bg: rgba(255, 255, 255, 0.02); 
    --canvas-bg: #030712; --header-bg: rgba(9, 9, 11, 0.85); --grid-color: #111827; 
    --box-shadow: 0 25px 60px rgba(0,0,0,0.6); --btn-bg: #18181b; --btn-border: #27272a; 
    --btn-text: #a1a1aa; --surface-glass: rgba(9, 9, 11, 0.8); 
  }
  .theme-light { 
    --node-bg: #ffffff; --node-border: #e4e4e7; --node-text: #09090b; 
    --node-desc: #71717a; --node-footer-bg: #fafafa; 
    --canvas-bg: #f8fafc; --header-bg: rgba(255, 255, 255, 0.9); --grid-color: #e2e8f0; 
    --box-shadow: 0 10px 40px rgba(0,0,0,0.06); --btn-bg: #ffffff; --btn-border: #e4e4e7; 
    --btn-text: #3f3f46; --surface-glass: rgba(255, 255, 255, 0.8); 
  }

  .premium-node { transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
  .premium-node:hover { transform: translateY(-5px); }
  
  .n8n-handle { width: 14px !important; height: 14px !important; background: var(--node-bg) !important; border: 3px solid var(--primary) !important; border-radius: 50% !important; z-index: 100 !important; }
  .n8n-handle:hover { transform: scale(1.4); box-shadow: 0 0 20px var(--primary-glow); background: var(--primary) !important; }
  
  .glass-card { background: var(--surface-glass); backdrop-filter: blur(25px) saturate(200%); border: 1px solid var(--node-border); }
  @keyframes slide-up { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
`;

// --- NODOS MEJORADOS ---
const GenericNode = ({ icon: Icon, title, desc, color, children, selected }) => (
  <div className="premium-node" style={{ 
    background: 'var(--node-bg)', borderRadius: 20, border: `1.5px solid ${selected ? 'var(--primary)' : 'var(--node-border)'}`, 
    boxShadow: selected ? '0 0 0 4px var(--primary-glow), var(--box-shadow)' : 'var(--box-shadow)', 
    width: 280, display: 'flex', flexDirection: 'column', overflow: 'hidden' 
  }}>
    <div style={{ display: 'flex', alignItems: 'center', padding: '18px 24px' }}>
      <div style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 14, background: `${color}18`, color: color, border: `1.5px solid ${color}35` }}>
        <Icon size={24} strokeWidth={2.5} />
      </div>
      <div style={{ paddingLeft: 18, flex: 1, minWidth: 0 }}>
        <div style={{ color: 'var(--node-text)', fontSize: 15, fontWeight: 800, letterSpacing: '-0.3px' }}>{title}</div>
        {desc && <div style={{ color: 'var(--node-desc)', fontSize: 11, fontWeight: 500, marginTop: 2 }}>{desc}</div>}
      </div>
    </div>
    {children && <div style={{ padding: '14px 24px 18px 24px', background: 'var(--node-footer-bg)', borderTop: '1px solid var(--node-border)' }}>{children}</div>}
  </div>
);

const InvoiceNode = ({ data, selected }) => (
  <div onDoubleClick={() => data.onOpen?.(data.id)} style={{ cursor: 'pointer', position: 'relative' }}>
    <Handle type="target" position={Position.Left} className="n8n-handle" />
    <GenericNode icon={FileText} title="Diseño Documento" desc="Plantilla Multi-Hoja" color="#f43f5e" selected={selected}>
      <div style={{ background: 'rgba(244, 63, 94, 0.12)', color: '#f43f5e', padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Settings size={14} /> Configurar Diseño <ChevronRight size={14} />
      </div>
    </GenericNode>
    <Handle type="source" position={Position.Right} className="n8n-handle" />
  </div>
);

const InputNode = ({ data, selected }) => (
  <div onDoubleClick={() => data.onOpen?.(data.id)} style={{ cursor: "pointer", position: 'relative' }}>
    <Handle type="target" position={Position.Left} className="n8n-handle" />
    <GenericNode icon={Database} title="Origen de Datos" desc="SQL / API Integration" color="#7c3aed" selected={selected}>
        {data.records?.length > 0 ? (
          <div style={{ background: 'rgba(124, 58, 237, 0.12)', color: '#a78bfa', padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={14} /> {data.records.length} Registros Activos
          </div>
        ) : <span style={{ color: '#94a3b8', fontSize: 11, fontWeight: 600 }}>Doble clic para importar...</span>}
    </GenericNode>
    <Handle type="source" position={Position.Right} className="n8n-handle" />
  </div>
);

const EmailNode = ({ selected }) => <div style={{ position: 'relative' }}><Handle type="target" position={Position.Left} className="n8n-handle" /><GenericNode icon={Mail} title="SMTP Dispatcher" desc="Envío Automático" color="#ea580c" selected={selected} /><Handle type="source" position={Position.Right} className="n8n-handle" /></div>;
const SMSNode = ({ selected }) => <div style={{ position: 'relative' }}><Handle type="target" position={Position.Left} className="n8n-handle" /><GenericNode icon={Smartphone} title="WhatsApp Cloud" desc="Notificación Push" color="#16a34a" selected={selected} /><Handle type="source" position={Position.Right} className="n8n-handle" /></div>;
const ScheduleNode = ({ data, selected }) => <div onDoubleClick={() => data.onOpen?.(data.id)} style={{ position: 'relative', cursor: 'pointer' }}><GenericNode icon={Clock} title="Task Scheduler" desc="CRON Execution" color="#eab308" selected={selected} /><Handle type="source" position={Position.Right} className="n8n-handle" /></div>;

export default function WorkflowCanvas({ initialInvoiceData }) {
  const [theme, setTheme] = useState('dark');
  const [editingInvoiceId, setEditingInvoiceId] = useState(null);
  const [editingDatabaseId, setEditingDatabaseId] = useState(null);
  const [nodeMenuOpen, setNodeMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [invoiceData, setInvoiceData] = useState(initialInvoiceData || { pages: [{id: 'p1', name: 'Hoja Principal'}], elements: [] });
  const [toast, setToast] = useState(null);
  const saveTimeoutRef = useRef(null);
  
  const showToast = (message, type = "success") => { setToast({ message, type }); setTimeout(() => setToast(null), 3000); };

  const nodeTypes = useMemo(() => ({
    invoice: InvoiceNode, database: InputNode, email: EmailNode, sms: SMSNode, schedule: ScheduleNode
  }), []);

  const [nodes, setNodes, onNodesChange] = useNodesState([
    { id: 'n1', type: 'database', position: { x: 50, y: 150 }, data: { id: 'n1' } },
    { id: 'n2', type: 'invoice', position: { x: 400, y: 150 }, data: { id: 'n2' } }
  ]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([{ id: 'e1-2', source: 'n1', target: 'n2', type: 'smoothstep' }]);

  const onConnect = useCallback((params) => setEdges((eds) => addEdge({ ...params, type: 'smoothstep', style: { strokeWidth: 3, stroke: '#3b82f6' } }, eds)), [setEdges]);

  const nodesWithHandlers = useMemo(() => nodes.map(n => ({
    ...n,
    data: { ...n.data, onOpen: (id) => n.type === 'invoice' ? setEditingInvoiceId(id) : setEditingDatabaseId(id) }
  })), [nodes]);

  // LOAD SESSION
  useEffect(() => {
    const saved = localStorage.getItem('invoice_master_save');
    if (saved) { 
        try { 
            const p = JSON.parse(saved); 
            if (p.nodes) setNodes(p.nodes); 
            if (p.edges) setEdges(p.edges); 
            if (p.invoiceData) setInvoiceData(p.invoiceData); 
        } catch(e) { console.error("Load failed", e); } 
    }
  }, [setNodes, setEdges]);

  // SAFE DEBOUNCED SAVE
  useEffect(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    
    saveTimeoutRef.current = setTimeout(() => {
        try {
            const payload = JSON.stringify({ nodes, edges, invoiceData });
            localStorage.setItem('invoice_master_save', payload);
        } catch(e) {
            if (e.name === 'QuotaExceededError') {
                console.warn("Storage quota exceeded. Clearing non-essential data...");
                // Strategy: if too big, try saving without the database records (the heaviest part)
                try {
                    const lightNodes = nodes.map(n => ({ ...n, data: { ...n.data, records: undefined } }));
                    localStorage.setItem('invoice_master_save', JSON.stringify({ nodes: lightNodes, edges, invoiceData }));
                    showToast("Espacio local lleno. Se guardó estructura sin datos pesados.", "warning");
                } catch(e2) {
                    console.error("Critical storage failure", e2);
                }
            }
        }
    }, 1000); // 1s debounce

    return () => clearTimeout(saveTimeoutRef.current);
  }, [nodes, edges, invoiceData]);

  const addNode = (type) => {
    const id = `node-${Date.now()}`;
    setNodes(nds => [...nds, { id, type, position: { x: 200, y: 200 }, data: { id } }]);
    setNodeMenuOpen(false);
  };

  // EDITORS
  if (editingDatabaseId) {
    const node = nodes.find(n => n.id === editingDatabaseId);
    return (
        <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: '#020617' }}>
            <div style={{ height: 64, background: '#0f172a', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', padding: '0 30px', gap: 20, zIndex: 100 }}>
                <button onClick={() => setEditingDatabaseId(null)} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800, fontSize: 13 }}><ArrowLeft size={18} /> Volver al Flujo</button>
                <div style={{ color: '#fff', fontWeight: 800, fontSize: 16 }}>Configuración de Fuente de Datos</div>
            </div>
            {node?.type === 'schedule' ? (
                <SchedulerNodeEditor onToast={showToast} data={node?.data || {}} onUpdate={p => setNodes(nds => nds.map(n => n.id === editingDatabaseId ? { ...n, data: { ...n.data, ...p } } : n))} />
            ) : (
                <DatabaseNodeEditor onToast={showToast} data={node?.data || {}} onUpdate={p => setNodes(nds => nds.map(n => n.id === editingDatabaseId ? { ...n, data: { ...n.data, ...p } } : n))} />
            )}
        </div>
    );
  }

  if (editingInvoiceId) {
    const dbNode = nodes.find(n => n.type === 'database');
    const dataset = dbNode?.data?.records || [];
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: '#020617' }}>
        <div style={{ height: 64, background: '#0f172a', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', padding: '0 30px', gap: 20, zIndex: 100 }}>
            <button onClick={() => setEditingInvoiceId(null)} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800, fontSize: 13 }}><ArrowLeft size={18} /> Volver al Flujo</button>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: 16 }}>Estudio de Diseño de Documentos</div>
        </div>
        <DocumentDesigner data={invoiceData} dataset={dataset} onUpdate={d => setInvoiceData(prev => ({ ...prev, ...d }))} />
      </div>
    );
  }

  return (
    <div className={theme === 'dark' ? 'theme-dark' : 'theme-light'} style={{ width: '100vw', height: '100vh', background: 'var(--canvas-bg)', display: 'flex', flexDirection: 'column' }}>
      <style>{GLOBAL_STYLE}</style>
      
      <div style={{ 
        margin: '24px 40px', height: 72, borderRadius: 24, background: 'var(--header-bg)', 
        backdropFilter: 'blur(30px) saturate(200%)', display: 'flex', alignItems: 'center', 
        padding: '0 30px', justifyContent: 'space-between', zIndex: 100, border: '1px solid var(--node-border)',
        boxShadow: 'var(--box-shadow)', position: 'absolute', top: 0, left: 0, right: 0 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)', width: 44, height: 44, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Workflow color="#fff" size={24} strokeWidth={2.5} /></div>
            <div style={{ color: 'var(--node-text)', fontWeight: 800, fontSize: 20, letterSpacing: '-0.8px' }}>Operativa<span style={{ color: '#60a5fa' }}>.engine</span></div>
        </div>
        
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} style={{ background: 'var(--btn-bg)', border: '1px solid var(--btn-border)', color: 'var(--btn-text)', width: 44, height: 44, borderRadius: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}</button>
            <button onClick={() => setNodeMenuOpen(true)} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '0 28px', height: 48, borderRadius: 16, fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 10px 20px rgba(59,130,246,0.3)' }}><Plus size={20} strokeWidth={3} /><span>Nueva Acción</span></button>
            <button style={{ background: '#10b981', color: '#fff', border: 'none', padding: '0 28px', height: 48, borderRadius: 16, fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 10px 20px rgba(16,185,129,0.2)' }}><Play size={18} fill="#fff" /><span>Ejecutar Flujo</span></button>
        </div>
      </div>

      {nodeMenuOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)', zIndex: 1000, display: 'flex', justifyContent: 'center', paddingTop: '12vh' }} onClick={() => setNodeMenuOpen(false)}>
           <div style={{ width: 480, background: 'var(--node-bg)', borderRadius: 32, border: '1px solid var(--node-border)', overflow: 'hidden', boxShadow: 'var(--box-shadow)', transformOrigin: 'top center', animation: 'slide-up 0.3s' }} onClick={e => e.stopPropagation()}>
              <div style={{ padding: '24px 30px', borderBottom: '1.5px solid var(--node-border)', display: 'flex', alignItems: 'center', gap: 16 }}>
                 <Search size={22} color="#94a3b8"/><input autoFocus placeholder="¿Qué acción quieres automatizar?" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ flex: 1, background: 'none', border: 'none', color: 'var(--node-text)', outline: 'none', fontSize: 16, fontWeight: 500 }}/>
              </div>
              <div style={{ padding: '15px', maxHeight: '55vh', overflowY: 'auto' }}>
                 {[
                   { type: 'database', label: 'Origen de Datos', desc: 'Consultas SQL, API JSON, Webhooks', icon: Database, color: '#7c3aed' },
                   { type: 'invoice', label: 'Plantilla de Documento', desc: 'Diseño visual de PDF y Facturas', icon: FileText, color: '#f43f5e' },
                   { type: 'email', label: 'Despachador Email', desc: 'Envío vía SMTP con adjuntos', icon: Mail, color: '#ea580c' },
                   { type: 'sms', label: 'Mensajería Push', desc: 'WhatsApp API y SMS Integrados', icon: Smartphone, color: '#16a34a' },
                   { type: 'schedule', label: 'Automatización CRON', desc: 'Trigger periódico programado', icon: Clock, color: '#eab308' }
                 ].filter(n => n.label.toLowerCase().includes(searchQuery.toLowerCase())).map(n => (
                   <div key={n.type} onClick={() => addNode(n.type)} style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '16px 20px', borderRadius: 20, cursor: 'pointer' }}>
                      <div style={{ background: n.color, width: 48, height: 48, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}><n.icon size={24}/></div>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: 'var(--node-text)', fontWeight: 800, fontSize: 15 }}>{n.label}</div>
                        <div style={{ color: 'var(--node-desc)', fontSize: 11, fontWeight: 500 }}>{n.desc}</div>
                      </div>
                      <ChevronRight size={18} color="var(--node-desc)" />
                   </div>
                 ))}
              </div>
           </div>
        </div>
      )}

      <div style={{ flex: 1 }}><ReactFlow nodes={nodesWithHandlers} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} nodeTypes={nodeTypes} fitView><Background color="var(--grid-color)" variant="dots" gap={24} size={1} /><Controls style={{ marginBottom: 40, marginLeft: 20 }} /></ReactFlow></div>
      {toast && <div style={{ position: "fixed", bottom: 50, left: "50%", transform: "translateX(-50%)", background: toast.type === "error" ? "#ef4444" : (toast.type === "warning" ? "#f59e0b" : "#1e293b"), color: "#fff", padding: "14px 32px", borderRadius: 100, zIndex: 9999, fontWeight: 800, boxShadow: '0 20px 40px rgba(0,0,0,0.3)', animation: 'slide-up 0.3s' }}>{toast.message}</div>}
    </div>
  );
}
