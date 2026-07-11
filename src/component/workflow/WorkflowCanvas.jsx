"use client";

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  useReactFlow
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Workflow, Sun, Moon, Save, Plus, ArrowLeft, ChevronRight, ChevronLeft,
  FolderOpen, HardDrive, FolderPlus, Folder, FileText, X, Zap, RefreshCw,
  Play, Check, AlertCircle, Clock, History
} from 'lucide-react';
import { DataStreamer } from '@engine/core-logic';
import { saveExecutionLog, listExecutions } from '../../utils/executionLog';

// ── Módulos locales ────────────────────────────────────────────────────────
import { GlobalDataRegistry } from './registry';
import { NODE_TYPES, EDGE_TYPES, GLOBAL_STYLE, NODE_CATALOG, getNodeIcon } from './NodeTypes';
import NodeDataInspector from './NodeDataInspector';
import DocumentDesigner from './DocumentDesigner';
import DatabaseNodeEditor from './DatabaseNodeEditor';
import SchedulerNodeEditor from './SchedulerNodeEditor';
import PdfGeneratorNodeEditor from './PdfGeneratorNodeEditor';
import VariableNodeEditor from './VariableNodeEditor';
import UnionNodeEditor from './UnionNodeEditor';
import FilterNodeEditor from './FilterNodeEditor';
import CodeNodeEditor from './CodeNodeEditor';
import PaperCanvas from '../PaperCanvas';
import WorkLayer from '../WorkLayer';

// Re-exportamos GlobalDataRegistry para que los archivos existentes
// (DatabaseNodeEditor, PdfGeneratorNodeEditor) sigan importándolo desde aquí
export { GlobalDataRegistry };

// ─── Indicador flotante de generación PDF en segundo plano ──────────────────
function FloatingJobIndicator() {
    const [tick, setTick] = useState(0);

    useEffect(() => {
        if (typeof window === 'undefined' || !window.__PdfBatchManager) return;
        return window.__PdfBatchManager.subscribe('ALL_JOBS', () => setTick(t => t + 1));
    }, []);

    if (typeof window === 'undefined' || !window.__PdfBatchManager) return null;
    const activeJobs = Object.values(window.__PdfBatchManager.activeJobs).filter(j => j.isGenerating);
    if (activeJobs.length === 0) return null;
    const job = activeJobs[0];
    const pct = Math.round((job.current / (job.total || 1)) * 100);

    return (
        <div style={{ position: 'fixed', top: 90, left: '50%', transform: 'translateX(-50%)', zIndex: 99999, background: 'var(--header-bg)', backdropFilter: 'blur(30px)', border: '1px solid #3b82f6', borderRadius: 24, padding: '16px 28px', display: 'flex', alignItems: 'center', gap: 20, boxShadow: '0 15px 35px rgba(0,0,0,0.4)', color: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <RefreshCw size={24} color="#3b82f6" style={{ animation: 'spin 2s linear infinite' }} />
                <div>
                    <div style={{ fontWeight: 900, fontSize: 14 }}>Generando PDFs en Segundo Plano...</div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{job.current} de {job.total} completados ({pct}%)</div>
                </div>
            </div>
            <button onClick={() => window.__PdfBatchManager.cancel(job.sessionId)} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 12, fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>
                DETENER
            </button>
        </div>
    );
}

// ─── Stage oculto para renderizar PDFs en lote ──────────────────────────────
function PersistentPdfStage() {
    const [tick, setTick] = useState(0);

    useEffect(() => {
        if (typeof window === 'undefined' || !window.__PdfBatchManager) return;
        return window.__PdfBatchManager.subscribe('ALL_JOBS', () => setTick(t => t + 1));
    }, []);

    if (typeof window === 'undefined' || !window.__PdfBatchManager) return null;

    return (
        <div id="persistent-background-pdf-stage" style={{ position: 'absolute', top: 0, left: 0, opacity: 0.0001, zIndex: -10000, pointerEvents: 'none', overflow: 'visible', display: 'flex', gap: 50 }}>
            {Object.values(window.__PdfBatchManager.activeJobs).map(job => {
                if (!job.isGenerating || !job.record) return null;
                const designs = job.designs || (job.design ? [job.design] : []);
                if (designs.length === 0) return null;
                return (
                    <div key={job.sessionId} id={`pdf-persistent-stage-${job.sessionId}`} data-current-record={job.current} style={{ display: 'flex', gap: 50 }}>
                        {designs.flatMap((design, dIdx) => {
                            const size = design.size || 'letter';
                            const orientation = design.orientation || 'portrait';
                            const pages = design.pages?.length > 0 ? design.pages : [{ id: 'p1', name: 'Hoja 1' }];
                            return pages.map((pg, pgIdx) => (
                                <div key={`${dIdx}-${pg.id || pgIdx}`} className="pdf-page-container" data-design-idx={dIdx} data-page-idx={pgIdx} data-page-size={size} data-page-orientation={orientation}>
                                    <PaperCanvas size={size} orientation={orientation} background={pg.bgUrl}>
                                        <WorkLayer elements={design.elements || []} pages={design.pages || []} activePageIdx={pgIdx} dataset={[job.record]} isExport={true} zoom={1} />
                                    </PaperCanvas>
                                </div>
                            ));
                        })}
                    </div>
                );
            })}
        </div>
    );
}

// ─── Puente para acceder a las funciones internas de ReactFlow ──────────────
const FlowController = React.forwardRef((_, ref) => {
    const { screenToFlowPosition, fitView } = useReactFlow();
    React.useImperativeHandle(ref, () => ({ screenToFlowPosition, fitView }), [screenToFlowPosition, fitView]);
    return null;
});

// ─── Componente principal ────────────────────────────────────────────────────
export default function WorkflowCanvas() {
    const [theme, setTheme] = useState('dark');
    const [editingNodeId, setEditingNodeId] = useState(null);
    const [insertingEdgeId, setInsertingEdgeId] = useState(null);
    const [runAllProgress, setRunAllProgress] = useState(null); // null | { active, steps[], wfName }
    const [runAllPdfNode, setRunAllPdfNode] = useState(null);   // nodeId del pdf_generator en ejecución
    const runAllResolveRef  = useRef(null);                     // resolve() del Promise de espera
    const runAllCancelRef   = useRef(false);                    // señal de cancelación
    const [upstreamLoading, setUpstreamLoading] = useState(false); // spinner al abrir nodo
    const flowControllerRef = useRef(null);                     // acceso a funciones internas de ReactFlow
    const canvasMouseRef    = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 }); // posición del mouse en el canvas
    const [newWorkflowPath, setNewWorkflowPath] = useState("C:/NegocioEnMarcha/Workflows");
    const [workflowList, setWorkflowList] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [toast, setToast] = useState(null);
    const [nodeMenuOpen, setNodeMenuOpen] = useState(false);
    const [isFolderBrowserOpen, setIsFolderBrowserOpen] = useState(false);
    const [browserData, setBrowserData] = useState({ current: 'C:/', dirs: [], files: [], parent: 'C:/' });
    const [newFolderName, setNewFolderName] = useState("");
    const [openWorkflows, setOpenWorkflows] = useState({});
    const [activeTab, setActiveTab] = useState(null);
    const [renamingTab, setRenamingTab] = useState(null);
    const [tempName, setTempName] = useState("");
    const [newWfName, setNewWfName] = useState("");
    const [isCreatingWf, setIsCreatingWf] = useState(false);

    const showToast = (message, type = 'success') => { setToast({ message, type }); setTimeout(() => setToast(null), 3500); };

    // ── Filesystem helpers ──────────────────────────────────────────────────
    const fetchDirs = async (path) => {
        try {
            const r = await fetch(`/api/utils/list-dirs?path=${encodeURIComponent(path)}`);
            const d = await r.json();
            if (d.success) setBrowserData(d);
        } catch (e) { console.error(e); }
    };

    const fetchWorkflows = async (path = newWorkflowPath) => {
        try {
            const r = await fetch(`/api/workflows/list?baseDir=${encodeURIComponent(path)}`);
            const d = await r.json();
            if (d.success) setWorkflowList(d.workflows);
        } catch (e) { console.error(e); }
    };

    const handleCreateWorkflow = async () => {
        const name = newWfName.trim() || `Flujo_${Date.now()}`;
        try {
            await fetch('/api/workflows/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, baseDir: newWorkflowPath })
            });
            setOpenWorkflows(prev => ({ ...prev, [name]: { nodes: [], edges: [], path: newWorkflowPath } }));
            setActiveTab(name);
            setWorkflowList(prev => prev.includes(name) ? prev : [...prev, name]);
            setNewWfName("");
            setIsCreatingWf(false);
        } catch (e) { console.error(e); }
    };

    // ── Edges ───────────────────────────────────────────────────────────────
    const handleDeleteEdge = useCallback((id) => {
        if (!activeTab) return;
        setOpenWorkflows(prev => {
            const wf = prev[activeTab];
            if (!wf) return prev;
            return { ...prev, [activeTab]: { ...wf, edges: wf.edges.filter(e => e.id !== id) } };
        });
    }, [activeTab]);

    const handleInsertNode = useCallback((edgeId) => { setInsertingEdgeId(edgeId); setNodeMenuOpen(true); }, []);

    useEffect(() => {
        window._onDeleteEdge = handleDeleteEdge;
        window._onInsertNode = handleInsertNode;
    }, [handleDeleteEdge, handleInsertNode]);

    // ── ReactFlow handlers ──────────────────────────────────────────────────
    const onNodesChange = useCallback((changes) => {
        if (!activeTab) return;
        setOpenWorkflows(prev => {
            const wf = prev[activeTab];
            if (!wf) return prev;
            return { ...prev, [activeTab]: { ...wf, nodes: applyNodeChanges(changes, wf.nodes) } };
        });
    }, [activeTab]);

    const onEdgesChange = useCallback((changes) => {
        if (!activeTab) return;
        setOpenWorkflows(prev => {
            const wf = prev[activeTab];
            if (!wf) return prev;
            return { ...prev, [activeTab]: { ...wf, edges: applyEdgeChanges(changes, wf.edges) } };
        });
    }, [activeTab]);

    const onConnect = useCallback((params) => {
        if (!activeTab) return;
        setOpenWorkflows(prev => {
            const wf = prev[activeTab];
            if (!wf) return prev;
            const newEdge = { ...params, id: `e-${Date.now()}`, type: 'action' };
            return { ...prev, [activeTab]: { ...wf, edges: addEdge(newEdge, wf.edges) } };
        });
    }, [activeTab]);

    // ── Agregar nodo ────────────────────────────────────────────────────────
    const addNode = (type) => {
        if (!activeTab) return;

        // Calcular posición en el canvas donde está el mouse
        let position = { x: 250, y: 200 };
        try {
            if (flowControllerRef.current?.screenToFlowPosition) {
                position = flowControllerRef.current.screenToFlowPosition(canvasMouseRef.current);
            }
        } catch { /* usar posición por defecto */ }

        const newNode = { id: `${type}-${Date.now()}`, type, position, data: { onOpen: (id) => setEditingNodeId(id) } };
        setOpenWorkflows(prev => {
            const wf = prev[activeTab];
            let nextNodes = [...wf.nodes, newNode];
            let nextEdges = [...wf.edges];
            if (insertingEdgeId) {
                const edge = wf.edges.find(e => e.id === insertingEdgeId);
                if (edge) {
                    nextEdges = nextEdges.filter(e => e.id !== insertingEdgeId);
                    nextEdges.push({ id: `e-${Date.now()}-1`, source: edge.source, target: newNode.id, type: 'action' });
                    nextEdges.push({ id: `e-${Date.now()}-2`, source: newNode.id, target: edge.target, type: 'action' });
                }
            }
            return { ...prev, [activeTab]: { ...wf, nodes: nextNodes, edges: nextEdges } };
        });
        setNodeMenuOpen(false);
        setInsertingEdgeId(null);
        // Hacer zoom para mostrar el nodo recién creado
        setTimeout(() => flowControllerRef.current?.fitView({ duration: 400, padding: 0.25 }), 80);
    };

    const handleUpdateNodeData = (nodeId, newData) => {
        if (!activeTab) return;
        setOpenWorkflows(prev => {
            const wf = prev[activeTab];
            const getCount = (key) => (key ? GlobalDataRegistry.get(key)?.length || 0 : 0);

            // Auto-calcular outputCount desde GlobalDataRegistry si no viene explícito
            const enriched = { ...newData };
            if (newData.dataKey && enriched.outputCount === undefined) {
                const cnt = getCount(newData.dataKey);
                if (cnt > 0) enriched.outputCount = cnt;
            }
            // Filter: conteos por salida true/false
            if (newData.dataKeyTrue  && enriched.outputCountTrue  === undefined) enriched.outputCountTrue  = getCount(newData.dataKeyTrue);
            if (newData.dataKeyFalse && enriched.outputCountFalse === undefined) enriched.outputCountFalse = getCount(newData.dataKeyFalse);

            const nextNodes = wf.nodes.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...enriched } } : n);

            // Sincronizar conteo de registros en los edges salientes
            const nextEdges = wf.edges.map(e => {
                if (e.source !== nodeId) return e;
                let count = 0;
                const sh = e.sourceHandle;
                if      (sh === 'true'      && enriched.dataKeyTrue)      count = getCount(enriched.dataKeyTrue);
                else if (sh === 'false'     && enriched.dataKeyFalse)     count = getCount(enriched.dataKeyFalse);
                else if (sh === 'matched'   && enriched.dataKeyMatched)   count = getCount(enriched.dataKeyMatched);
                else if (sh === 'unmatched' && enriched.dataKeyUnmatched) count = getCount(enriched.dataKeyUnmatched);
                else if (enriched.dataKey)                                count = getCount(enriched.dataKey);
                return count > 0 ? { ...e, data: { ...e.data, count } } : e;
            });

            return { ...prev, [activeTab]: { ...wf, nodes: nextNodes, edges: nextEdges } };
        });
    };

    // ── Cargar / guardar workflow ───────────────────────────────────────────
    const handleLoadWorkflow = async (name, specificPath = newWorkflowPath) => {
        // Si ya está abierto en esta sesión, solo cambiar de tab
        if (openWorkflows[name]) { setActiveTab(name); return; }

        try {
            const r = await fetch(`/api/workflows/load?name=${encodeURIComponent(name)}&baseDir=${encodeURIComponent(specificPath)}`);
            const d = await r.json();

            // data puede ser null si el archivo no existe aún (workflow nuevo vacío)
            const rawNodes = d.data?.nodes || [];
            const rawEdges = d.data?.edges || [];

            const loadedNodes = rawNodes.map(n => ({ ...n, data: { ...n.data, onOpen: (id) => setEditingNodeId(id) } }));
            const loadedEdges = rawEdges.map(e => ({ ...e, type: 'action' }));

            setOpenWorkflows(prev => ({ ...prev, [name]: { nodes: loadedNodes, edges: loadedEdges, path: specificPath } }));
            setActiveTab(name);

            if (!d.success) showToast(`Error cargando "${name}"`);
        } catch (e) {
            console.error(e);
            showToast(`No se pudo abrir "${name}"`, 'error');
        }
    };

    const handleSaveWorkflow = async (forcedName = null) => {
        const targetName = forcedName || activeTab;
        if (!targetName || !openWorkflows[targetName]) return;
        setIsSaving(true);
        const wf = openWorkflows[targetName];
        const cleanNodes = wf.nodes.map(n => { const { onOpen, ...cleanData } = n.data; return { ...n, data: cleanData }; });
        try {
            await fetch('/api/workflows/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: targetName, baseDir: wf.path, data: { nodes: cleanNodes, edges: wf.edges } }) });
            showToast("¡Guardado!");
        } catch { showToast("Error al guardar"); }
        finally { setIsSaving(false); }
    };

    // ── Renombrar tab ───────────────────────────────────────────────────────
    const handleStartRename = (name) => { setRenamingTab(name); setTempName(name); };
    const handleFinishRename = async () => {
        if (!renamingTab || !tempName || renamingTab === tempName) { setRenamingTab(null); return; }
        const oldName = renamingTab;
        const newName = tempName.trim();
        setOpenWorkflows(prev => { const next = { ...prev }; const wfData = next[oldName]; delete next[oldName]; next[newName] = wfData; return next; });
        if (activeTab === oldName) setActiveTab(newName);
        setWorkflowList(prev => prev.map(w => w === oldName ? newName : w));
        setRenamingTab(null);
        setTimeout(() => handleSaveWorkflow(newName), 100);
    };

    // ── Inicialización ──────────────────────────────────────────────────────
    useEffect(() => {
        const saved = localStorage.getItem('workflow_base_dir') || "C:/NegocioEnMarcha/Workflows";
        setNewWorkflowPath(saved);
        fetchWorkflows(saved);
    }, []);

    useEffect(() => {
        localStorage.setItem('workflow_base_dir', newWorkflowPath);
        fetchWorkflows(newWorkflowPath);
    }, [newWorkflowPath]);

    // ── Sistema de punteros de datos (Data Pointer) ─────────────────────────
    useEffect(() => {
        if (!activeTab || !openWorkflows[activeTab]) return;
        const wf = openWorkflows[activeTab];
        const node = wf.nodes.find(n => n.id === editingNodeId);
        if (!node) return;

        const resolveUpstreamDataKeyForHandle = (targetHandle) => {
            let edge = wf.edges.find(e => e.target === editingNodeId && e.targetHandle === targetHandle);
            if (!edge) {
                const legacyEdges = wf.edges.filter(e => e.target === editingNodeId && !e.targetHandle);
                if (targetHandle === 'left' && legacyEdges.length > 0) edge = legacyEdges[0];
                else if (targetHandle === 'right' && legacyEdges.length > 1) edge = legacyEdges[1];
            }
            if (!edge) return null;

            const stack = [{ nodeId: edge.source, lastEdge: edge }];
            const visited = new Set();
            while (stack.length > 0) {
                const { nodeId, lastEdge } = stack.pop();
                if (visited.has(nodeId)) continue;
                visited.add(nodeId);
                const sourceNode = wf.nodes.find(n => n.id === nodeId);
                if (sourceNode) {
                    if (sourceNode.type === 'filter') {
                        return lastEdge?.sourceHandle === 'false' ? sourceNode.data?.dataKeyFalse : sourceNode.data?.dataKeyTrue;
                    }
                    if (sourceNode.data?.dataKey) return sourceNode.data.dataKey;
                    wf.edges.filter(e => e.target === nodeId).forEach(ie => stack.push({ nodeId: ie.source, lastEdge: ie }));
                }
            }
            return null;
        };

        if (node.type === 'union') {
            const leftKey  = resolveUpstreamDataKeyForHandle('left');
            const rightKey = resolveUpstreamDataKeyForHandle('right');
            const newUpstreamKeys = [leftKey, rightKey].filter(Boolean);
            const oldUpstreamKeys = node.data.upstreamDataKeys || [];
            if (
                JSON.stringify(newUpstreamKeys) !== JSON.stringify(oldUpstreamKeys) ||
                leftKey  !== node.data.leftSourceKey ||
                rightKey !== node.data.rightSourceKey
            ) {
                handleUpdateNodeData(editingNodeId, { upstreamDataKeys: newUpstreamKeys, leftSourceKey: leftKey || '', rightSourceKey: rightKey || '' });
            }
        } else {
            const incomingDataKeys = [];
            const stack = [];
            const visited = new Set();
            wf.edges.filter(e => e.target === editingNodeId).forEach(edge => stack.push({ nodeId: edge.source, lastEdge: edge }));

            while (stack.length > 0) {
                const { nodeId, lastEdge } = stack.pop();
                if (visited.has(nodeId)) continue;
                visited.add(nodeId);
                const sourceNode = wf.nodes.find(n => n.id === nodeId);
                if (sourceNode) {
                    if (sourceNode.type === 'filter') {
                        const key = (lastEdge?.sourceHandle === 'false' ? sourceNode.data?.dataKeyFalse : sourceNode.data?.dataKeyTrue) || sourceNode.data?.dataKey;
                        if (key && !incomingDataKeys.includes(key)) incomingDataKeys.push(key);
                    } else if (sourceNode.data?.dataKey) {
                        if (!incomingDataKeys.includes(sourceNode.data.dataKey)) incomingDataKeys.push(sourceNode.data.dataKey);
                    } else {
                        wf.edges.filter(e => e.target === nodeId).forEach(ie => stack.push({ nodeId: ie.source, lastEdge: ie }));
                    }
                }
            }

            const firstKey = incomingDataKeys[0] || null;
            if (firstKey && node.data.upstreamDataKey !== firstKey) {
                handleUpdateNodeData(editingNodeId, { upstreamDataKey: firstKey });
            }
        }
    }, [activeTab, openWorkflows, editingNodeId]);

    const currentWF = activeTab ? openWorkflows[activeTab] : null;

    // ══════════════════════════════════════════════════════════════════════
    // SCHEDULE POLLING — revisa cada 60 s si hay que disparar un workflow
    // ══════════════════════════════════════════════════════════════════════
    useEffect(() => {
        const interval = setInterval(() => {
            Object.entries(openWorkflows).forEach(async ([wfName, wf]) => {
                if (!wf.path) return;
                try {
                    const r = await fetch(`/api/schedules/load?baseDir=${encodeURIComponent(wf.path)}`);
                    const d = await r.json();
                    const s = d.schedules?.[wfName];
                    if (!s?.enabled) return;
                    if (isScheduleTime(s)) {
                        showToast(`⏰ Ejecutando schedule: ${wfName}`);
                        await handleRunAll(wfName, 'schedule');
                        await fetch('/api/schedules/update-last-run', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ baseDir: wf.path, workflowName: wfName })
                        });
                    }
                } catch { /* silencioso */ }
            });
        }, 60 * 1000);
        return () => clearInterval(interval);
    }, [openWorkflows]);

    function isScheduleTime(s) {
        const now = new Date();
        if (!s.time) return false;
        const [hh, mm] = s.time.split(':').map(Number);
        if (now.getHours() !== hh || now.getMinutes() !== mm) return false;
        if (s.lastRun && (Date.now() - new Date(s.lastRun).getTime()) < 90_000) return false;
        if (s.frequency === 'weekly'  && now.getDay() !== 1) return false;
        if (s.frequency === 'monthly' && now.getDate() !== 1) return false;
        return true;
    }

    // ══════════════════════════════════════════════════════════════════════
    // RUN ALL — ejecuta el pipeline completo en orden topológico
    // ══════════════════════════════════════════════════════════════════════
    function topologicalSort(nodes, edges) {
        const inDeg = new Map(nodes.map(n => [n.id, 0]));
        const adj   = new Map(nodes.map(n => [n.id, []]));
        edges.forEach(e => { adj.get(e.source)?.push(e.target); inDeg.set(e.target, (inDeg.get(e.target) || 0) + 1); });
        const queue  = nodes.filter(n => inDeg.get(n.id) === 0);
        const result = [];
        while (queue.length) {
            const node = queue.shift();
            result.push(node);
            (adj.get(node.id) || []).forEach(tid => {
                const deg = inDeg.get(tid) - 1;
                inDeg.set(tid, deg);
                if (deg === 0) queue.push(nodes.find(n => n.id === tid));
            });
        }
        return result.filter(Boolean);
    }

    function resolveUpstreamKey(nodeId, wf) {
        const stack = wf.edges.filter(e => e.target === nodeId).map(e => ({ nid: e.source, edge: e }));
        const visited = new Set();
        while (stack.length) {
            const { nid, edge } = stack.pop();
            if (visited.has(nid)) continue;
            visited.add(nid);
            const src = wf.nodes.find(n => n.id === nid);
            if (!src) continue;
            if (src.type === 'filter') {
                return edge?.sourceHandle === 'false' ? src.data?.dataKeyFalse : src.data?.dataKeyTrue;
            }
            if (src.type === 'union' && src.data?.mode === 'join') {
                if (edge?.sourceHandle === 'unmatched') return src.data?.dataKeyUnmatched;
                return src.data?.dataKeyMatched || src.data?.dataKey;
            }
            if (src.data?.dataKey) return src.data.dataKey;
            wf.edges.filter(e => e.target === nid).forEach(ie => stack.push({ nid: ie.source, edge: ie }));
        }
        return null;
    }

    function applyFilterOp(rv, op, cv) {
        switch (op) {
            case 'equals':      return rv === cv;
            case 'not_equals':  return rv !== cv;
            case 'contains':    return rv.includes(cv);
            case 'not_contains':return !rv.includes(cv);
            case 'greater_than':return Number(rv) > Number(cv);
            case 'less_than':   return Number(rv) < Number(cv);
            case 'is_empty':    return rv === '';
            case 'is_not_empty':return rv !== '';
            default: return false;
        }
    }

    // Lee datos desde el caché IndexedDB que usa DatabaseNodeEditor (OperativaDataCache / datasets)
    function loadFromIndexedDB(nodeId) {
        return new Promise((resolve) => {
            try {
                const req = indexedDB.open('OperativaDataCache', 1);
                req.onsuccess = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains('datasets')) { resolve(null); return; }
                    const tx = db.transaction('datasets', 'readonly');
                    const r  = tx.objectStore('datasets').get(nodeId);
                    r.onsuccess = () => resolve(r.result || null);
                    r.onerror   = () => resolve(null);
                };
                req.onerror = () => resolve(null);
            } catch { resolve(null); }
        });
    }

    // ══════════════════════════════════════════════════════════════════════
    // AUTO-RUN UPSTREAM — al abrir un nodo, ejecuta la cadena anterior
    // ══════════════════════════════════════════════════════════════════════

    // Devuelve los nodos upstream en orden de ejecución (más profundo primero)
    function getUpstreamNodes(targetId, wf) {
        const visited = new Set();
        const result  = [];
        const dfs = (nodeId) => {
            if (visited.has(nodeId)) return;
            visited.add(nodeId);
            wf.edges.filter(e => e.target === nodeId).forEach(e => dfs(e.source));
            if (nodeId !== targetId) {
                const n = wf.nodes.find(n => n.id === nodeId);
                if (n) result.push(n);
            }
        };
        dfs(targetId);
        return result; // ya en orden topológico (raíz primero)
    }

    async function runUpstreamForNode(targetId, wf) {
        const upstream = getUpstreamNodes(targetId, wf);
        const streamer = DataStreamer.getInstance();

        for (const node of upstream) {
            const dataKey = node.data?.dataKey;

            // Si ya hay datos en memoria, saltamos
            if (dataKey && GlobalDataRegistry.has(dataKey)) continue;

            const upKey = resolveUpstreamKey(node.id, wf);

            try {
                switch (node.type) {
                    case 'database': {
                        // Clave real tras el fix de DatabaseNodeEditor: db-data-{node.id}
                        const dbOutKey = dataKey || `db-data-${node.id}`;
                        if (GlobalDataRegistry.has(dbOutKey)) break;
                        const cached = await loadFromIndexedDB(node.id);
                        if (cached?.length > 0) {
                            GlobalDataRegistry.set(dbOutKey, cached);
                            GlobalDataRegistry.set(`${node.id}-result`, cached);
                            streamer.createSession(dbOutKey, cached);
                            if (!dataKey) handleUpdateNodeData(node.id, { dataKey: dbOutKey });
                        }
                        break;
                    }
                    case 'variable': {
                        const records = GlobalDataRegistry.get(upKey) || [];
                        if (!records.length) break;
                        const outKey = dataKey || `var-output-${node.id}`;
                        const out = records.map(r => {
                            const nr = { ...r };
                            (node.data.variables || []).forEach(v => { if (v.name?.trim()) nr[v.name] = v.value; });
                            return nr;
                        });
                        GlobalDataRegistry.set(outKey, out);
                        streamer.createSession(outKey, out);
                        if (!dataKey) handleUpdateNodeData(node.id, { dataKey: outKey });
                        break;
                    }
                    case 'filter': {
                        const records = GlobalDataRegistry.get(upKey) || [];
                        if (!records.length) break;
                        const { field, operator, value } = node.data;
                        const trueKey  = node.data.dataKeyTrue  || `filter-${node.id}-true`;
                        const falseKey = node.data.dataKeyFalse || `filter-${node.id}-false`;
                        const matched = [], unmatched = [];
                        records.forEach(r => {
                            const rv = String(r[field] || '').toLowerCase().trim();
                            const cv = String(value   || '').toLowerCase().trim();
                            (applyFilterOp(rv, operator, cv) ? matched : unmatched).push({ ...r });
                        });
                        GlobalDataRegistry.set(trueKey, matched);   streamer.createSession(trueKey, matched);
                        GlobalDataRegistry.set(falseKey, unmatched); streamer.createSession(falseKey, unmatched);
                        if (!dataKey) handleUpdateNodeData(node.id, { dataKeyTrue: trueKey, dataKeyFalse: falseKey, dataKey: trueKey });
                        break;
                    }
                    case 'union': {
                        const keys = node.data.upstreamDataKeys || [upKey].filter(Boolean);
                        let merged = [];
                        keys.forEach(k => { merged = [...merged, ...(GlobalDataRegistry.get(k) || []).map(r => ({ ...r }))]; });
                        if (!merged.length) break;
                        const outKey = dataKey || `union-output-${node.id}`;
                        GlobalDataRegistry.set(outKey, merged);
                        streamer.createSession(outKey, merged);
                        if (!dataKey) handleUpdateNodeData(node.id, { dataKey: outKey });
                        break;
                    }
                    case 'code': {
                        const records = GlobalDataRegistry.get(upKey) || [];
                        if (!records.length || !node.data.code) break;
                        const outKey = dataKey || `code-output-${node.id}`;
                        await new Promise((resolve) => {
                            streamer.createSession(outKey, [...records]);
                            GlobalDataRegistry.set(outKey, [...records]);
                            streamer.transform(outKey, node.data.code, () => {
                                if (!dataKey) handleUpdateNodeData(node.id, { dataKey: outKey });
                                resolve();
                            });
                            setTimeout(resolve, 10000); // timeout 10s
                        });
                        break;
                    }
                    default: break;
                }
            } catch (e) {
                console.warn(`[AutoUpstream] ${node.type} ${node.id}:`, e.message);
            }
        }
    }

    // Disparar auto-run upstream cada vez que el usuario abre un nodo
    useEffect(() => {
        if (!editingNodeId || !activeTab || !openWorkflows[activeTab]) return;
        const wf = openWorkflows[activeTab];
        const streamer = DataStreamer.getInstance();

        setUpstreamLoading(true);
        runUpstreamForNode(editingNodeId, wf)
            .then(() => {
                // Después de cargar upstream, pedir datos al inspector de entrada y salida
                const node = wf.nodes.find(n => n.id === editingNodeId);
                if (!node) return;
                const inKey  = node.data?.upstreamDataKey;
                const outKey = node.data?.dataKey;
                if (inKey)  streamer.requestRange(inKey,  0, 20);
                if (outKey) streamer.requestRange(outKey, 0, 20);
            })
            .catch(e => console.warn('[AutoUpstream]', e))
            .finally(() => setUpstreamLoading(false));
    }, [editingNodeId, activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleStopRunAll = () => {
        runAllCancelRef.current = true;
        setRunAllProgress(prev => prev ? { ...prev, active: false, cancelled: true } : null);
        setEditingNodeId(null);
        setRunAllPdfNode(null);
        runAllResolveRef.current?.(); // desbloquea cualquier Promise de pdf_generator pendiente
        runAllResolveRef.current = null;
    };

    const handleRunAll = async (wfName = activeTab, trigger = 'manual') => {
        const wf = openWorkflows[wfName];
        if (!wf) return;

        runAllCancelRef.current = false;
        const sorted = topologicalSort(wf.nodes, wf.edges);
        const steps  = sorted.map(n => ({ id: n.id, type: n.type, label: n.data?.title || n.type, status: 'pending' }));
        const startedAt = new Date().toISOString();

        setRunAllProgress({ active: true, wfName, steps });

        const streamer = DataStreamer.getInstance();
        let totalErrors = 0;

        for (let i = 0; i < sorted.length; i++) {
            if (runAllCancelRef.current) break;
            const node = sorted[i];
            setRunAllProgress(prev => prev ? { ...prev, steps: prev.steps.map((s, si) => si === i ? { ...s, status: 'running' } : s) } : null);

            try {
                const upKey = resolveUpstreamKey(node.id, wf);

                switch (node.type) {
                    case 'database': {
                        const dbKey = node.data?.dataKey || `db-data-${node.id}`;
                        if (!GlobalDataRegistry.has(dbKey)) {
                            const cached = await loadFromIndexedDB(node.id);
                            if (cached?.length > 0) {
                                GlobalDataRegistry.set(dbKey, cached);
                                GlobalDataRegistry.set(`${node.id}-result`, cached);
                                streamer.createSession(dbKey || node.id, cached);
                                if (dbKey) handleUpdateNodeData(node.id, { dataKey: dbKey });
                            } else {
                                throw new Error('Sin datos. Haz clic en este paso para abrir el nodo y cargar el archivo.');
                            }
                        }
                        break;
                    }
                    case 'variable': {
                        const records = GlobalDataRegistry.get(upKey) || [];
                        const outKey  = node.data.dataKey || `var-${node.id}`;
                        const out     = records.map(r => { const nr = { ...r }; (node.data.variables || []).forEach(v => { if (v.name?.trim()) nr[v.name] = v.value; }); return nr; });
                        GlobalDataRegistry.set(outKey, out);
                        streamer.createSession(outKey, out);
                        handleUpdateNodeData(node.id, { dataKey: outKey });
                        break;
                    }
                    case 'filter': {
                        const records = GlobalDataRegistry.get(upKey) || [];
                        const { field, operator, value } = node.data;
                        const trueKey = node.data.dataKeyTrue  || `filter-${node.id}-true`;
                        const falseKey= node.data.dataKeyFalse || `filter-${node.id}-false`;
                        const matched = [], unmatched = [];
                        records.forEach(r => {
                            const rv = String(r[field] || '').toLowerCase().trim();
                            const cv = String(value   || '').toLowerCase().trim();
                            (applyFilterOp(rv, operator, cv) ? matched : unmatched).push({ ...r });
                        });
                        GlobalDataRegistry.set(trueKey, matched); streamer.createSession(trueKey, matched);
                        GlobalDataRegistry.set(falseKey, unmatched); streamer.createSession(falseKey, unmatched);
                        handleUpdateNodeData(node.id, { dataKeyTrue: trueKey, dataKeyFalse: falseKey, dataKey: trueKey });
                        break;
                    }
                    case 'union': {
                        const keys = node.data.upstreamDataKeys || [upKey].filter(Boolean);
                        let merged = [];
                        keys.forEach(k => { merged = [...merged, ...(GlobalDataRegistry.get(k) || []).map(r => ({ ...r }))]; });
                        const outKey = node.data.dataKey || `union-${node.id}`;
                        GlobalDataRegistry.set(outKey, merged); streamer.createSession(outKey, merged);
                        handleUpdateNodeData(node.id, { dataKey: outKey });
                        break;
                    }
                    case 'code': {
                        await new Promise((resolve, reject) => {
                            const outKey  = node.data.dataKey || `code-${node.id}`;
                            const up      = [...(GlobalDataRegistry.get(upKey) || [])];
                            streamer.createSession(outKey, up);
                            GlobalDataRegistry.set(outKey, up);
                            streamer.transform(outKey, node.data.code || 'return items;', (count) => {
                                handleUpdateNodeData(node.id, { dataKey: outKey });
                                resolve(count);
                            });
                            setTimeout(() => reject(new Error('Timeout en transformación JS (30s)')), 30000);
                        });
                        break;
                    }
                    case 'invoice': {
                        break; // solo plantilla, nada que ejecutar
                    }
                    case 'pdf_generator': {
                        // Abrir el editor con autoRun=true y esperar que termine
                        await new Promise((resolve) => {
                            runAllResolveRef.current = resolve;
                            setRunAllPdfNode(node.id);
                            setEditingNodeId(node.id);
                        });
                        setEditingNodeId(null);
                        setRunAllPdfNode(null);
                        runAllResolveRef.current = null;
                        break;
                    }
                    default: break;
                }

                setRunAllProgress(prev => prev ? { ...prev, steps: prev.steps.map((s, si) => si === i ? { ...s, status: 'done' } : s) } : null);
            } catch (err) {
                totalErrors++;
                setRunAllProgress(prev => prev ? { ...prev, steps: prev.steps.map((s, si) => si === i ? { ...s, status: 'error', error: err.message } : s) } : null);
            }
        }

        const completedAt = new Date().toISOString();
        setRunAllProgress(prev => prev ? { ...prev, active: false, completedAt } : null);

        await saveExecutionLog({
            wfName, trigger, startedAt, completedAt,
            totalPdfs: 0, errors: totalErrors,
            status: totalErrors === 0 ? 'success' : 'partial'
        });
    };

    // ════════════════════════════════════════════════════════════════════════
    // VISTA: Editor de nodo abierto
    // ════════════════════════════════════════════════════════════════════════
    if (editingNodeId && activeTab) {
        const node = openWorkflows[activeTab].nodes.find(n => n.id === editingNodeId);
        const parentNodes = openWorkflows[activeTab].edges.filter(e => e.target === editingNodeId)
            .map(e => openWorkflows[activeTab].nodes.find(n => n.id === e.source)).filter(Boolean);
        const childNodes = openWorkflows[activeTab].edges.filter(e => e.source === editingNodeId)
            .map(e => openWorkflows[activeTab].nodes.find(n => n.id === e.target)).filter(Boolean);

        return (
            <div className={theme === 'dark' ? 'theme-dark' : 'theme-light'} style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--editor-bg)', position: 'relative' }}>
                <FloatingJobIndicator />
                <PersistentPdfStage />
                <style>{GLOBAL_STYLE}</style>

                {/* Barra superior del editor */}
                <div style={{ height: 64, background: 'var(--editor-header)', borderBottom: '1px solid var(--editor-border)', display: 'flex', alignItems: 'center', padding: '0 30px', justifyContent: 'space-between' }}>
                    <button onClick={() => setEditingNodeId(null)} style={{ background: 'var(--btn-bg)', color: 'var(--node-text)', border: '1px solid var(--btn-border)', padding: '10px 24px', borderRadius: 12, cursor: 'pointer', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ArrowLeft size={18}/> Volver al Lienzo
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--node-text)', fontWeight: 900, fontSize: 16 }}>
                        {getNodeIcon(node?.type)} {node?.data?.title || node?.type?.toUpperCase()}
                        {upstreamLoading && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#60a5fa', fontWeight: 700 }}>
                                <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }}/>
                                Cargando datos anteriores...
                            </div>
                        )}
                    </div>
                    <button onClick={() => { handleSaveWorkflow(); setEditingNodeId(null); }} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: 12, fontWeight: 900, cursor: 'pointer' }}>
                        APLICAR
                    </button>
                </div>

                {/* Contenido del editor con paneles de datos */}
                <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                    <NodeDataInspector theme={theme} title="Entrada (Input)"  side="left"  nodeId={editingNodeId} dataKey={node?.data?.upstreamDataKey} />

                    <div style={{ flex: 1, position: 'relative', display: 'flex', overflow: 'hidden' }}>
                        {/* Navegación al nodo anterior */}
                        {parentNodes.length > 0 && (
                            <div style={{ position: 'absolute', left: 24, top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: 16, zIndex: 999999, pointerEvents: 'none' }}>
                                {parentNodes.map(p => (
                                    <button key={p.id} onClick={() => setEditingNodeId(p.id)} title={`Ir a: ${p.data?.title || p.type}`} className="n8n-nav-btn"
                                        style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--editor-header)', border: '3px solid #3b82f6', color: 'var(--node-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', pointerEvents: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', transition: 'all 0.25s', position: 'relative' }}>
                                        {getNodeIcon(p.type)}
                                        <div className="nav-tooltip-left" style={{ position: 'absolute', left: '100%', marginLeft: 16, background: '#1e293b', color: '#fff', fontSize: 13, fontWeight: 800, padding: '8px 16px', borderRadius: 12, whiteSpace: 'nowrap', pointerEvents: 'none', opacity: 0, transition: 'all 0.2s', boxShadow: '0 8px 25px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <ChevronLeft size={18} color="#3b82f6"/> {p.data?.title || p.type}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Navegación al nodo siguiente */}
                        {childNodes.length > 0 && (
                            <div style={{ position: 'absolute', right: 24, top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: 16, zIndex: 999999, pointerEvents: 'none' }}>
                                {childNodes.map(c => (
                                    <button key={c.id} onClick={() => setEditingNodeId(c.id)} title={`Ir a: ${c.data?.title || c.type}`} className="n8n-nav-btn"
                                        style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--editor-header)', border: '3px solid #3b82f6', color: 'var(--node-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', pointerEvents: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', transition: 'all 0.25s', position: 'relative' }}>
                                        {getNodeIcon(c.type)}
                                        <div className="nav-tooltip-right" style={{ position: 'absolute', right: '100%', marginRight: 16, background: '#1e293b', color: '#fff', fontSize: 13, fontWeight: 800, padding: '8px 16px', borderRadius: 12, whiteSpace: 'nowrap', pointerEvents: 'none', opacity: 0, transition: 'all 0.2s', boxShadow: '0 8px 25px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                            {c.data?.title || c.type} <ChevronRight size={18} color="#3b82f6"/>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Editor del nodo activo */}
                        <div style={{ flex: 1, overflowY: 'auto', background: 'var(--canvas-bg)', position: 'relative' }}>
                            {node?.type === 'invoice'       && <DocumentDesigner      theme={theme} data={node.data.design || { pages: [{ id: 'p1', name: 'Hoja 1' }], elements: [] }} dataKey={node.data.dataKey || node.data.upstreamDataKey} onUpdate={d => handleUpdateNodeData(editingNodeId, { design: { ...(node.data.design || {}), ...d } })} />}
                            {node?.type === 'database'      && <DatabaseNodeEditor    theme={theme} data={node.data} nodeId={editingNodeId} onUpdate={d => handleUpdateNodeData(editingNodeId, d)} />}
                            {node?.type === 'schedule'      && <SchedulerNodeEditor   theme={theme} data={node.data} workflowName={activeTab} workflowPath={openWorkflows[activeTab]?.path} onUpdate={d => handleUpdateNodeData(editingNodeId, d)} />}
                            {node?.type === 'variable'      && <VariableNodeEditor    theme={theme} data={node.data} nodeId={editingNodeId} onUpdate={d => handleUpdateNodeData(editingNodeId, d)} />}
                            {node?.type === 'union'         && <UnionNodeEditor       theme={theme} data={{ ...node.data, id: editingNodeId }} onUpdate={d => handleUpdateNodeData(editingNodeId, d)} />}
                            {node?.type === 'filter'        && <FilterNodeEditor      theme={theme} data={{ ...node.data, id: editingNodeId }} onUpdate={d => handleUpdateNodeData(editingNodeId, d)} />}
                            {node?.type === 'code'          && <CodeNodeEditor        theme={theme} data={node.data} dataKey={node.data.dataKey || node.data.upstreamDataKey} onUpdate={d => handleUpdateNodeData(editingNodeId, d)} />}
                            {node?.type === 'pdf_generator' && <PdfGeneratorNodeEditor theme={theme} data={{ ...node.data, dataKey: node.data.dataKey || node.data.upstreamDataKey }} availableTemplates={openWorkflows[activeTab].nodes.filter(n => n.type === 'invoice').map(n => ({ id: n.id, title: n.data.title || `Diseño ${n.id}`, design: n.data.design }))} onUpdate={d => handleUpdateNodeData(editingNodeId, d)} autoRun={runAllPdfNode === editingNodeId} onRunComplete={() => runAllResolveRef.current?.()} />}
                        </div>
                    </div>

                    <NodeDataInspector theme={theme} title="Salida (Output)" side="right" nodeId={editingNodeId} dataKey={node?.data?.dataKey} />
                </div>
            </div>
        );
    }

    // ════════════════════════════════════════════════════════════════════════
    // VISTA: Canvas principal del workflow
    // ════════════════════════════════════════════════════════════════════════
    return (
        <div className={theme === 'dark' ? 'theme-dark' : 'theme-light'} style={{ width: '100vw', height: '100vh', background: 'var(--canvas-bg)', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            <FloatingJobIndicator />
            <PersistentPdfStage />
            <style>{GLOBAL_STYLE}</style>

            {/* Header */}
            <div style={{ zIndex: 1000, background: 'var(--canvas-bg)' }}>
                <div style={{ margin: '20px 40px 0 40px', height: 72, borderRadius: 24, background: 'var(--header-bg)', backdropFilter: 'blur(30px)', display: 'flex', alignItems: 'center', padding: '0 30px', justifyContent: 'space-between', border: '1px solid var(--node-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)', width: 44, height: 44, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Workflow color="#fff" size={24} />
                        </div>
                        <div style={{ color: 'var(--node-text)', fontWeight: 900, fontSize: 18 }}>Operativa.engine</div>
                    </div>
                    <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="icon-btn" style={{ background: 'var(--btn-bg)', border: '1px solid var(--btn-border)', color: 'var(--node-text)', width: 44, height: 44 }}>
                        {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                    </button>
                </div>

                {/* Tabs de workflows abiertos */}
                <div style={{ margin: '15px 60px 0 60px', display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 5 }}>
                    {Object.keys(openWorkflows).map(name => (
                        <div key={name} onClick={() => setActiveTab(name)} className={`tab ${activeTab === name ? 'tab-active' : ''}`} style={{ background: 'var(--header-bg)', color: 'var(--node-text)' }} onDoubleClick={() => handleStartRename(name)}>
                            <Zap size={14} color={activeTab === name ? '#3b82f6' : 'var(--node-desc)'}/>
                            {renamingTab === name ? (
                                <input autoFocus value={tempName} onChange={e => setTempName(e.target.value)} onBlur={handleFinishRename} onKeyDown={e => e.key === 'Enter' && handleFinishRename()} className="tab-input" />
                            ) : (
                                <span>{name}</span>
                            )}
                            <X size={14} className="tab-close" onClick={(e) => {
                                e.stopPropagation();
                                const next = { ...openWorkflows };
                                delete next[name];
                                setOpenWorkflows(next);
                                if (activeTab === name) setActiveTab(Object.keys(next)[0] || null);
                            }}/>
                        </div>
                    ))}
                </div>
            </div>

            {/* Sidebar de explorador */}
            <div style={{ position: 'absolute', left: 24, top: 195, bottom: 24, width: isSidebarCollapsed ? 72 : 340, background: 'var(--header-bg)', backdropFilter: 'blur(30px)', borderRadius: 32, border: '1px solid var(--node-border)', zIndex: 500, padding: isSidebarCollapsed ? '24px 12px' : '24px', display: 'flex', flexDirection: 'column', gap: 20, transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)', boxShadow: '0 20px 50px rgba(0,0,0,0.1)', alignItems: isSidebarCollapsed ? 'center' : 'stretch' }}>
                <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="icon-btn" style={{ position: 'absolute', right: isSidebarCollapsed ? -14 : -12, top: 24, width: 28, height: 28, background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '50%', zIndex: 10 }}>
                    {isSidebarCollapsed ? <ChevronRight size={16}/> : <ArrowLeft size={16}/>}
                </button>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: isSidebarCollapsed ? 'center' : 'space-between', gap: 8 }}>
                        {!isSidebarCollapsed && <div style={{ fontSize: 11, fontWeight: 900, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: 1.2 }}>Flujos</div>}
                        <div style={{ display: 'flex', gap: 6 }}>
                            {/* Nuevo workflow */}
                            <button title="Nuevo Flujo" onClick={() => setIsCreatingWf(v => !v)} className="icon-btn" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', width: 36, height: 36, borderRadius: 10 }}>
                                <Plus size={18}/>
                            </button>
                            {/* Abrir explorador */}
                            <button title="Cambiar carpeta" onClick={() => { setIsFolderBrowserOpen(true); fetchDirs(newWorkflowPath); }} className="icon-btn" style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6', width: 36, height: 36, borderRadius: 10 }}>
                                <FolderOpen size={18}/>
                            </button>
                        </div>
                    </div>

                    {/* Input para crear nuevo flujo */}
                    {!isSidebarCollapsed && isCreatingWf && (
                        <div style={{ display: 'flex', gap: 6 }}>
                            <input
                                autoFocus
                                value={newWfName}
                                onChange={e => setNewWfName(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleCreateWorkflow(); if (e.key === 'Escape') { setIsCreatingWf(false); setNewWfName(''); } }}
                                placeholder="Nombre del flujo..."
                                style={{ flex: 1, background: 'var(--input-bg)', border: '1.5px solid #10b981', borderRadius: 10, padding: '8px 12px', color: 'var(--input-text)', fontSize: 13, fontWeight: 600, outline: 'none' }}
                            />
                            <button onClick={handleCreateWorkflow} style={{ background: '#10b981', color: '#fff', border: 'none', borderRadius: 10, padding: '0 12px', fontWeight: 900, cursor: 'pointer', fontSize: 13 }}>
                                OK
                            </button>
                        </div>
                    )}

                    {!isSidebarCollapsed && (
                        <div style={{ padding: '10px 14px', background: 'var(--node-footer-bg)', borderRadius: 12, border: '1px solid var(--node-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                            <HardDrive size={16} color="#3b82f6"/>
                            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--node-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{newWorkflowPath.split(/[/\\]/).pop()}</div>
                        </div>
                    )}
                </div>

                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, width: '100%', alignItems: isSidebarCollapsed ? 'center' : 'stretch' }}>
                    {workflowList.map(wf => (
                        <div key={wf} onClick={() => handleLoadWorkflow(wf)} title={wf} style={{ padding: isSidebarCollapsed ? '12px' : '16px', borderRadius: isSidebarCollapsed ? 14 : 20, background: activeTab === wf ? 'rgba(59,130,246,0.1)' : 'var(--node-footer-bg)', border: activeTab === wf ? '2px solid #3b82f6' : (openWorkflows[wf] ? '1px solid #3b82f6' : '1px solid var(--node-border)'), cursor: 'pointer', display: 'flex', justifyContent: 'center' }} className="list-item">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', justifyContent: isSidebarCollapsed ? 'center' : 'flex-start' }}>
                                <div style={{ width: 12, height: 12, borderRadius: '50%', background: openWorkflows[wf] ? '#10b981' : (wf === activeTab ? '#3b82f6' : '#334155'), flexShrink: 0 }} />
                                {!isSidebarCollapsed && <div style={{ color: 'var(--node-text)', fontSize: 14, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{wf}</div>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Canvas ReactFlow */}
            <div
                style={{ flex: 1, position: 'relative' }}
                onMouseMove={e => { canvasMouseRef.current = { x: e.clientX, y: e.clientY }; }}
            >
                {activeTab && currentWF ? (
                    <ReactFlow nodes={currentWF.nodes} edges={currentWF.edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} nodeTypes={NODE_TYPES} edgeTypes={EDGE_TYPES} fitView>
                        <FlowController ref={flowControllerRef} />
                        <Background color="var(--grid-color)" variant="dots" gap={24} size={1} />
                        <Controls />
                        <div style={{ position: 'absolute', bottom: 40, right: 80, zIndex: 1000, display: 'flex', gap: 15 }}>
                            <button onClick={() => handleRunAll()} title="Ejecutar Todo el Flujo" className="icon-btn" style={{ background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', border: 'none', width: 64, height: 64, borderRadius: 24, boxShadow: '0 8px 24px rgba(16,185,129,0.35)' }}><Play size={28} fill="#fff"/></button>
                            <button onClick={() => handleSaveWorkflow()} className="icon-btn" style={{ background: '#3b82f6', color: '#fff', border: 'none', width: 64, height: 64, borderRadius: 24 }}><Save size={28} /></button>
                            <button onClick={() => setNodeMenuOpen(true)}  className="icon-btn" style={{ background: 'var(--btn-bg)', color: 'var(--node-text)', border: '1px solid var(--btn-border)', width: 64, height: 64, borderRadius: 24 }}><Plus size={32}/></button>
                        </div>
                    </ReactFlow>
                ) : (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--node-desc)' }}>Selecciona un flujo</div>
                )}
            </div>

            {/* Modal: Explorador de carpetas */}
            {isFolderBrowserOpen && (
                <div className="modal-overlay" onClick={() => setIsFolderBrowserOpen(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div style={{ padding: '28px 32px', background: 'var(--editor-header)', borderBottom: '1px solid var(--node-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--node-text)' }}>Explorador de Carpetas</div>
                                <div style={{ fontSize: 11, color: 'var(--node-desc)', marginTop: 4 }}>{browserData.current}</div>
                            </div>
                            <button onClick={() => setIsFolderBrowserOpen(false)} className="icon-btn" style={{ color: 'var(--node-text)' }}><X/></button>
                        </div>
                        <div style={{ padding: '20px 32px', background: 'var(--node-footer-bg)', borderBottom: '1px solid var(--node-border)', display: 'flex', gap: 12 }}>
                            <input type="text" placeholder="Nueva carpeta..." value={newFolderName} onChange={e => setNewFolderName(e.target.value)} className="custom-input" />
                            <button onClick={async () => { await fetch('/api/utils/create-dir', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: browserData.current, name: newFolderName }) }); setNewFolderName(""); fetchDirs(browserData.current); }} style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 14, padding: '0 24px', fontWeight: 900, cursor: 'pointer' }}>
                                <FolderPlus size={18}/>
                            </button>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
                            <div onClick={() => fetchDirs(browserData.parent)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px', cursor: 'pointer', borderRadius: 16, background: 'var(--node-bg)', border: '1.5px solid var(--node-border)', marginBottom: 20 }} className="list-item">
                                <ChevronLeft size={20} color="#3b82f6"/> <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--node-text)' }}>Atrás</span>
                            </div>
                            <div style={{ display: 'grid', gap: 10 }}>
                                {browserData.dirs.map(d => (
                                    <div key={d} onClick={() => fetchDirs(`${browserData.current}/${d}`)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px', cursor: 'pointer', borderRadius: 18, border: '1px solid var(--node-border)', background: 'var(--node-bg)' }} className="list-item">
                                        <Folder color="#3b82f6" fill="#3b82f6" size={22}/>
                                        <span style={{ fontWeight: 800, color: 'var(--node-text)', fontSize: 14 }}>{d}</span>
                                        <button onClick={(e) => { e.stopPropagation(); setNewWorkflowPath(`${browserData.current}/${d}`); setIsFolderBrowserOpen(false); }} style={{ marginLeft: 'auto', background: '#3b82f6', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 10, fontSize: 10, fontWeight: 900 }}>
                                            ENTRAR
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <div style={{ height: 1, background: 'var(--node-border)', margin: '25px 0' }} />
                            {browserData.files.map(f => (
                                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px', borderRadius: 18, background: 'var(--node-footer-bg)', border: '1px solid var(--node-border)', marginBottom: 8 }}>
                                    <FileText color="#94a3b8" size={22}/>
                                    <span style={{ fontWeight: 700, color: 'var(--node-text)', fontSize: 14 }}>{f}</span>
                                    <button onClick={() => { handleLoadWorkflow(f.replace('.json', ''), browserData.current); setIsFolderBrowserOpen(false); }} style={{ marginLeft: 'auto', background: 'var(--btn-bg)', border: '1px solid var(--btn-border)', color: 'var(--node-text)', padding: '10px 20px', borderRadius: 12, fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>
                                        ABRIR
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Panel de progreso Run All — siempre tiene botón cerrar/detener */}
            {runAllProgress && (
                <div style={{ position: 'fixed', top: 100, right: 24, zIndex: 9999, background: 'var(--editor-header)', backdropFilter: 'blur(20px)', border: '1.5px solid var(--editor-border)', borderRadius: 24, padding: '24px', width: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.4)', color: 'var(--node-text)' }}>

                    {/* Cabecera con estado y botones */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                        <div style={{ flexShrink: 0 }}>
                            {runAllProgress.active
                                ? <RefreshCw size={20} color="#10b981" style={{ animation: 'spin 1.5s linear infinite' }}/>
                                : runAllProgress.cancelled
                                    ? <AlertCircle size={20} color="#f59e0b"/>
                                    : <Check size={20} color="#10b981"/>
                            }
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 900, fontSize: 15 }}>
                                {runAllProgress.active ? 'Ejecutando Flujo...' : runAllProgress.cancelled ? 'Cancelado' : 'Completado'}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--node-desc)', marginTop: 1 }}>{runAllProgress.wfName}</div>
                        </div>
                        {/* Botón Detener (activo) o Cerrar (terminado) — siempre visible */}
                        {runAllProgress.active ? (
                            <button
                                onClick={handleStopRunAll}
                                title="Detener ejecución"
                                style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: 10, fontWeight: 800, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
                            >
                                ⏹ Detener
                            </button>
                        ) : (
                            <button
                                onClick={() => setRunAllProgress(null)}
                                title="Cerrar panel"
                                style={{ background: 'var(--btn-bg)', color: 'var(--node-desc)', border: '1px solid var(--btn-border)', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                            >
                                <X size={16}/>
                            </button>
                        )}
                    </div>

                    {/* Lista de pasos — clicables */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 340, overflowY: 'auto' }}>
                        {runAllProgress.steps.map((step, i) => {
                            const colors = { pending: '#475569', running: '#3b82f6', done: '#10b981', error: '#ef4444' };
                            const icons  = {
                                pending: <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid #475569', flexShrink: 0 }}/>,
                                running: <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }}/>,
                                done:    <Check size={15} style={{ flexShrink: 0 }}/>,
                                error:   <AlertCircle size={15} style={{ flexShrink: 0 }}/>,
                            };
                            return (
                                <div
                                    key={step.id}
                                    onClick={() => setEditingNodeId(step.id)}
                                    title="Clic para abrir este nodo"
                                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, background: step.status === 'running' ? 'rgba(59,130,246,0.08)' : 'var(--node-footer-bg)', border: `1px solid ${step.status === 'error' ? 'rgba(239,68,68,0.4)' : step.status === 'running' ? 'rgba(59,130,246,0.3)' : 'var(--node-border)'}`, cursor: 'pointer' }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                                    onMouseLeave={e => e.currentTarget.style.background = step.status === 'running' ? 'rgba(59,130,246,0.08)' : 'var(--node-footer-bg)'}
                                >
                                    <div style={{ color: colors[step.status] }}>{icons[step.status]}</div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{step.label}</div>
                                        {step.error && (
                                            <div style={{ fontSize: 10, color: '#f87171', marginTop: 2 }}>
                                                {step.error} <span style={{ color: '#60a5fa', fontWeight: 800 }}>→ clic para abrir</span>
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ fontSize: 10, color: 'var(--node-desc)', fontWeight: 700, flexShrink: 0 }}>{step.type.toUpperCase()}</div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Pie con resumen */}
                    {!runAllProgress.active && (
                        <div style={{ marginTop: 14, padding: '10px 14px', background: runAllProgress.cancelled ? 'rgba(245,158,11,0.08)' : 'rgba(16,185,129,0.08)', borderRadius: 10, fontSize: 12, color: runAllProgress.cancelled ? '#f59e0b' : '#10b981', fontWeight: 700, textAlign: 'center' }}>
                            {runAllProgress.cancelled
                                ? 'Proceso detenido manualmente'
                                : `Completado — ${runAllProgress.completedAt ? new Date(runAllProgress.completedAt).toLocaleTimeString('es-CO') : ''}`
                            }
                        </div>
                    )}
                </div>
            )}

            {/* Modal: Menú de nodos */}
            {nodeMenuOpen && (
                <div className="modal-overlay" onClick={() => setNodeMenuOpen(false)}>
                    <div style={{ width: 480, background: 'var(--node-bg)', borderRadius: 32, padding: '24px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            {NODE_CATALOG.map(n => (
                                <div key={n.type} onClick={() => addNode(n.type)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px', cursor: 'pointer', borderRadius: 20, background: 'var(--node-footer-bg)', border: '1px solid var(--node-border)' }}>
                                    <div style={{ background: n.color, width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                                        <n.icon size={20}/>
                                    </div>
                                    <div style={{ color: 'var(--node-text)', fontWeight: 800, fontSize: 14 }}>{n.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div style={{ position: "fixed", bottom: 40, left: "50%", transform: "translateX(-50%)", background: toast.type === 'error' ? '#ef4444' : '#1e293b', color: '#fff', padding: "14px 30px", borderRadius: 100, zIndex: 9999, fontWeight: 800, fontSize: 14, boxShadow: '0 8px 24px rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    {toast.type === 'error' ? '⚠️' : '✓'} {toast.message}
                </div>
            )}
        </div>
    );
}
