import React, { useState, useEffect } from 'react';
import { GitMerge, AlertCircle } from 'lucide-react';
import { DataStreamer } from '@engine/core-logic';
import { GlobalDataRegistry } from './registry';
import NodeEditorShell from './NodeEditorShell';

export default function UnionNodeEditor({ theme, data, onUpdate }) {
    const streamer = DataStreamer.getInstance();
    const sessionId = data.dataKey || `union-${data.id || 'temp'}`;
    const upstreamKeys = data.upstreamDataKeys || [];

    const [mode, setMode] = useState(data.mode || 'union');
    const [joinKeyLeft, setJoinKeyLeft] = useState(data.joinKeyLeft || data.joinKey || 'id');
    const [joinKeyRight, setJoinKeyRight] = useState(data.joinKeyRight || data.joinKey || 'id');
    const [leftSourceKey, setLeftSourceKey] = useState(data.leftSourceKey || '');
    const [rightSourceKey, setRightSourceKey] = useState(data.rightSourceKey || '');

    const [isProcessing, setIsProcessing] = useState(false);
    const [resultCount, setResultCount] = useState(0);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (upstreamKeys.length > 0) {
            let updated = false;
            let newLeft = leftSourceKey;
            let newRight = rightSourceKey;

            if (!leftSourceKey || !upstreamKeys.includes(leftSourceKey)) {
                newLeft = upstreamKeys[0];
                setLeftSourceKey(newLeft);
                updated = true;
            }
            if (upstreamKeys.length > 1) {
                if (!rightSourceKey || !upstreamKeys.includes(rightSourceKey) || rightSourceKey === newLeft) {
                    newRight = upstreamKeys.find(k => k !== newLeft) || upstreamKeys[1];
                    setRightSourceKey(newRight);
                    updated = true;
                }
            } else {
                if (rightSourceKey) { setRightSourceKey(''); updated = true; }
            }

            if (updated) {
                onUpdate({ leftSourceKey: newLeft, rightSourceKey: newRight });
            }
        }
    }, [upstreamKeys, leftSourceKey, rightSourceKey]);

    useEffect(() => {
        onUpdate({ mode, joinKeyLeft, joinKeyRight, leftSourceKey, rightSourceKey });
    }, [mode, joinKeyLeft, joinKeyRight, leftSourceKey, rightSourceKey]);

    const handleRunUnion = () => {
        setIsProcessing(true);
        setError(null);

        setTimeout(() => {
            try {
                if (upstreamKeys.length === 0) {
                    setError("No hay orígenes de datos conectados. Conecta nodos de origen de datos a este nodo.");
                    setIsProcessing(false);
                    return;
                }

                let mergedRecords = [];

                if (mode === 'union') {
                    upstreamKeys.forEach(k => {
                        const dbRecords = GlobalDataRegistry.get(k) || [];
                        mergedRecords = [...mergedRecords, ...dbRecords.map(r => ({ ...r }))];
                    });
                } else {
                    const selectedLeftKey  = leftSourceKey  || upstreamKeys[0];
                    const selectedRightKey = rightSourceKey || (upstreamKeys.length > 1 ? upstreamKeys[1] : null);

                    if (!selectedRightKey) {
                        setError("Se requieren al menos dos orígenes conectados para el Join.");
                        setIsProcessing(false);
                        return;
                    }

                    const leftDataset  = GlobalDataRegistry.get(selectedLeftKey)  || [];
                    const rightDataset = GlobalDataRegistry.get(selectedRightKey) || [];

                    const joinedMap      = new Map();
                    const matchedRightKeys = new Set();
                    const unmatchedRecords = [];

                    rightDataset.forEach(r => {
                        const val = String(r[joinKeyRight] || '').trim();
                        if (val) joinedMap.set(val, { ...r });
                    });

                    leftDataset.forEach(left => {
                        const val = String(left[joinKeyLeft] || '').trim();
                        if (val && joinedMap.has(val)) {
                            mergedRecords.push({ ...left, ...joinedMap.get(val) });
                            matchedRightKeys.add(val);
                        } else {
                            unmatchedRecords.push({ ...left });
                        }
                    });

                    // Registros del lado derecho sin coincidencia
                    rightDataset.forEach(right => {
                        const val = String(right[joinKeyRight] || '').trim();
                        if (!val || !matchedRightKeys.has(val)) {
                            unmatchedRecords.push({ ...right });
                        }
                    });

                    // Guardar flujo de NO coincidentes por separado
                    const unmatchedKey = `${sessionId}-unmatched`;
                    GlobalDataRegistry.set(unmatchedKey, unmatchedRecords);
                    streamer.createSession(unmatchedKey, unmatchedRecords);
                }

                const unmatchedKey = mode === 'join' ? `${sessionId}-unmatched` : null;
                const unmatchedCount = unmatchedKey ? (GlobalDataRegistry.get(unmatchedKey)?.length || 0) : 0;

                GlobalDataRegistry.set(sessionId, mergedRecords);
                streamer.createSession(sessionId, mergedRecords);
                streamer.requestRange(sessionId, 0, 20);

                setResultCount(mergedRecords.length);
                const now = new Date().toISOString();
                onUpdate({
                    mode, joinKeyLeft, joinKeyRight, leftSourceKey, rightSourceKey,
                    dataKey: sessionId,
                    dataKeyMatched:   mode === 'join' ? sessionId : undefined,
                    dataKeyUnmatched: unmatchedKey || undefined,
                    outputCount:    mergedRecords.length,
                    unmatchedCount: unmatchedCount,
                    lastRun: now,
                    lastRunCount: mergedRecords.length
                });
            } catch (e) {
                setError(`Error procesando la unión: ${e.message}`);
            } finally {
                setIsProcessing(false);
            }
        }, 100);
    };

    const currentLeftKey  = leftSourceKey  || upstreamKeys[0];
    const currentRightKey = rightSourceKey || (upstreamKeys.length > 1 ? upstreamKeys[1] : null);
    const leftDataset     = currentLeftKey  ? (GlobalDataRegistry.get(currentLeftKey)  || []) : [];
    const rightDataset    = currentRightKey ? (GlobalDataRegistry.get(currentRightKey) || []) : [];
    const leftFields      = leftDataset.length  > 0 ? Object.keys(leftDataset[0])  : [];
    const rightFields     = rightDataset.length > 0 ? Object.keys(rightDataset[0]) : [];

    const inputCount  = upstreamKeys.reduce((sum, k) => sum + (GlobalDataRegistry.get(k)?.length || 0), 0);
    const outputCount = resultCount || GlobalDataRegistry.get(sessionId)?.length || 0;
    const unmatchedKey   = `${sessionId}-unmatched`;
    const unmatchedCount = GlobalDataRegistry.get(unmatchedKey)?.length || 0;

    return (
        <NodeEditorShell
            icon={GitMerge}
            iconColor="#a855f7"
            title="Unión / Join de Datos"
            description="Combina o une registros de múltiples orígenes."
            inputCount={inputCount}
            outputCount={outputCount}
            isRunning={isProcessing}
            onRun={handleRunUnion}
            runLabel={`PROCESAR (${upstreamKeys.length} fuentes)`}
            runColor="#a855f7"
            error={error}
            lastRun={data.lastRun}
            lastRunCount={data.lastRunCount || 0}
        >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }}>
                <div style={{ background: 'var(--editor-bg)', border: '1px solid var(--editor-border)', borderRadius: 24, padding: 30, display: 'flex', flexDirection: 'column', gap: 24, overflowY: 'auto' }}>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 800 }}>Configuración de Unión</h3>

                    <div className="form-group">
                        <label style={{ display: 'block', fontWeight: 800, fontSize: 12, textTransform: 'uppercase', color: 'var(--node-desc)', marginBottom: 8 }}>Modo de Operación</label>
                        <div style={{ display: 'flex', gap: 12 }}>
                            {['union', 'join'].map(m => (
                                <button key={m} onClick={() => setMode(m)}
                                    style={{ flex: 1, padding: '12px', borderRadius: 12, border: mode === m ? '2px solid #a855f7' : '1px solid var(--btn-border)', background: mode === m ? 'rgba(168, 85, 247, 0.1)' : 'var(--editor-header)', color: 'var(--node-text)', fontWeight: 800, cursor: 'pointer' }}>
                                    {m === 'union' ? 'Concatenar (Union)' : 'Combinar Campos (Join)'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {mode === 'join' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            {/* Fuente izquierda */}
                            <div style={{ background: 'rgba(255,255,255,0.02)', padding: 20, borderRadius: 16, border: '1.5px solid var(--node-border)' }}>
                                <h4 style={{ margin: '0 0 12px 0', fontSize: 13, fontWeight: 900, color: 'var(--primary)', textTransform: 'uppercase' }}>Fuente Izquierda (Principal)</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <div>
                                        <label style={{ display: 'block', fontWeight: 800, fontSize: 11, textTransform: 'uppercase', color: 'var(--node-desc)', marginBottom: 6 }}>Seleccionar Fuente</label>
                                        <select value={leftSourceKey} onChange={e => setLeftSourceKey(e.target.value)} className="custom-input" style={{ width: '100%' }}>
                                            {upstreamKeys.map((k, idx) => <option key={k} value={k}>Fuente {idx + 1}: {k}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontWeight: 800, fontSize: 11, textTransform: 'uppercase', color: 'var(--node-desc)', marginBottom: 6 }}>Campo Clave Izquierdo</label>
                                        {leftFields.length > 0 ? (
                                            <div style={{ display: 'flex', gap: 10 }}>
                                                <select value={leftFields.includes(joinKeyLeft) ? joinKeyLeft : ''} onChange={e => setJoinKeyLeft(e.target.value || joinKeyLeft)} className="custom-input" style={{ flex: 1 }}>
                                                    <option value="">-- Seleccionar Campo --</option>
                                                    {leftFields.map(f => <option key={f} value={f}>{f}</option>)}
                                                </select>
                                                <input type="text" value={joinKeyLeft} onChange={e => setJoinKeyLeft(e.target.value)} className="custom-input" style={{ flex: 1 }} placeholder="O campo personalizado" />
                                            </div>
                                        ) : (
                                            <input type="text" value={joinKeyLeft} onChange={e => setJoinKeyLeft(e.target.value)} className="custom-input" placeholder="Ej. id, codigo" />
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Fuente derecha */}
                            <div style={{ background: 'rgba(255,255,255,0.02)', padding: 20, borderRadius: 16, border: '1.5px solid var(--node-border)' }}>
                                <h4 style={{ margin: '0 0 12px 0', fontSize: 13, fontWeight: 900, color: '#a855f7', textTransform: 'uppercase' }}>Fuente Derecha (Cruce)</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <div>
                                        <label style={{ display: 'block', fontWeight: 800, fontSize: 11, textTransform: 'uppercase', color: 'var(--node-desc)', marginBottom: 6 }}>Seleccionar Fuente</label>
                                        <select value={rightSourceKey} onChange={e => setRightSourceKey(e.target.value)} className="custom-input" style={{ width: '100%' }}>
                                            {upstreamKeys.filter(k => k !== leftSourceKey).map(k => <option key={k} value={k}>Fuente: {k}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontWeight: 800, fontSize: 11, textTransform: 'uppercase', color: 'var(--node-desc)', marginBottom: 6 }}>Campo Clave Derecho</label>
                                        {rightFields.length > 0 ? (
                                            <div style={{ display: 'flex', gap: 10 }}>
                                                <select value={rightFields.includes(joinKeyRight) ? joinKeyRight : ''} onChange={e => setJoinKeyRight(e.target.value || joinKeyRight)} className="custom-input" style={{ flex: 1 }}>
                                                    <option value="">-- Seleccionar Campo --</option>
                                                    {rightFields.map(f => <option key={f} value={f}>{f}</option>)}
                                                </select>
                                                <input type="text" value={joinKeyRight} onChange={e => setJoinKeyRight(e.target.value)} className="custom-input" style={{ flex: 1 }} placeholder="O campo personalizado" />
                                            </div>
                                        ) : (
                                            <input type="text" value={joinKeyRight} onChange={e => setJoinKeyRight(e.target.value)} className="custom-input" placeholder="Ej. id, codigo" />
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div style={{ borderTop: '1px solid var(--editor-border)', paddingTop: 20 }}>
                        <h4 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 800 }}>Orígenes Conectados:</h4>
                        {upstreamKeys.length === 0 ? (
                            <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>Conecta los nodos de entrada en el flujo para verlos aquí.</p>
                        ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {upstreamKeys.map((k, i) => (
                                    <span key={k} style={{ padding: '6px 12px', background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7', border: '1.5px solid rgba(168, 85, 247, 0.2)', borderRadius: 10, fontSize: 12, fontWeight: 700 }}>
                                        Fuente {i + 1}: {k}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ background: 'var(--editor-bg)', border: '1px solid var(--editor-border)', borderRadius: 24, padding: 30, display: 'flex', flexDirection: 'column', gap: 16 }}>

                    {/* Flujo principal: coincidentes (join) o todos (union) */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: mode === 'join' ? '#10b981' : 'var(--node-text)' }}>
                                {mode === 'join' ? 'Coinciden (Matched)' : 'Vista Previa de Resultados'}
                            </h3>
                            {resultCount > 0 && (
                                <span style={{ padding: '3px 10px', background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1.5px solid rgba(16,185,129,0.2)', borderRadius: 10, fontSize: 12, fontWeight: 700 }}>
                                    {resultCount.toLocaleString('es-CO')} registros
                                </span>
                            )}
                        </div>
                        <div style={{ overflowY: 'auto', background: 'var(--input-bg)', borderRadius: 14, border: '1.5px solid var(--editor-border)', padding: 14, maxHeight: 180 }}>
                            {resultCount === 0 ? (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 13, padding: '20px 0' }}>
                                    Presiona "Procesar Union" para fusionar los datos
                                </div>
                            ) : (
                                <pre style={{ margin: 0, color: '#38bdf8', fontFamily: 'monospace', fontSize: 11 }}>
                                    {JSON.stringify((GlobalDataRegistry.get(sessionId) || []).slice(0, 5), null, 2)}
                                </pre>
                            )}
                        </div>
                    </div>

                    {/* Flujo secundario: no coincidentes (solo en modo Join) */}
                    {mode === 'join' && resultCount > 0 && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#f87171' }}>
                                    No coinciden (Unmatched)
                                </h3>
                                <span style={{ padding: '3px 10px', background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1.5px solid rgba(239,68,68,0.2)', borderRadius: 10, fontSize: 12, fontWeight: 700 }}>
                                    {(GlobalDataRegistry.get(`${sessionId}-unmatched`)?.length || 0).toLocaleString('es-CO')} registros
                                </span>
                            </div>
                            <div style={{ overflowY: 'auto', background: 'var(--input-bg)', borderRadius: 14, border: '1.5px solid rgba(239,68,68,0.2)', padding: 14, maxHeight: 150 }}>
                                <pre style={{ margin: 0, color: '#f87171', fontFamily: 'monospace', fontSize: 11 }}>
                                    {JSON.stringify((GlobalDataRegistry.get(`${sessionId}-unmatched`) || []).slice(0, 5), null, 2)}
                                </pre>
                            </div>
                            <div style={{ marginTop: 10, padding: '10px 14px', background: 'rgba(239,68,68,0.06)', borderRadius: 12, fontSize: 12, color: '#f87171', fontWeight: 700 }}>
                                Conecta el handle rojo del nodo Union para procesar estos registros por separado.
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </NodeEditorShell>
    );
}

