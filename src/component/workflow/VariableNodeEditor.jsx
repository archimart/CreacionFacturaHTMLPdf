import React, { useState } from 'react';
import { Variable, PlusCircle, Trash2 } from 'lucide-react';
import { DataStreamer } from '@engine/core-logic';
import { GlobalDataRegistry } from './registry';
import NodeEditorShell from './NodeEditorShell';

export default function VariableNodeEditor({ theme, data, onUpdate, nodeId }) {
    const streamer   = DataStreamer.getInstance();
    const variables  = data.variables || [];
    const outKey     = data.dataKey || `var-output-${nodeId || 'temp'}`;
    const [isApplying, setIsApplying] = useState(false);
    const [error, setError]           = useState(null);

    const inputCount  = GlobalDataRegistry.get(data.upstreamDataKey)?.length || 0;
    const outputCount = GlobalDataRegistry.get(outKey)?.length              || 0;

    const handleAdd = () =>
        onUpdate({ variables: [...variables, { id: Date.now(), name: 'nueva_variable', value: '' }] });

    const handleChange = (id, field, val) =>
        onUpdate({ variables: variables.map(v => v.id === id ? { ...v, [field]: val } : v) });

    const handleRemove = (id) =>
        onUpdate({ variables: variables.filter(v => v.id !== id) });

    const applyVariables = () => {
        setError(null);
        setIsApplying(true);
        setTimeout(() => {
            const upstream = GlobalDataRegistry.get(data.upstreamDataKey);
            if (!upstream) {
                setError('Sin datos de entrada. Verifica la conexión con el nodo anterior.');
                setIsApplying(false);
                return;
            }

            const newRecords = upstream.map(r => {
                const nr = { ...r };
                variables.forEach(v => { if (v.name?.trim()) nr[v.name] = v.value; });
                return nr;
            });

            const now = new Date().toISOString();
            GlobalDataRegistry.set(outKey, newRecords);
            streamer.createSession(outKey, newRecords);
            onUpdate({ variables, dataKey: outKey, lastRun: now, lastRunCount: newRecords.length });
            setTimeout(() => streamer.requestRange(outKey, 0, 20), 80);
            setIsApplying(false);
        }, 50);
    };

    return (
        <NodeEditorShell
            icon={Variable}
            iconColor="#3b82f6"
            title="Variables Globales"
            description="Añade campos fijos a cada registro del flujo."
            inputCount={inputCount}
            outputCount={outputCount}
            isRunning={isApplying}
            onRun={applyVariables}
            runLabel="APLICAR"
            runColor="#3b82f6"
            error={error}
            lastRun={data.lastRun}
            lastRunCount={data.lastRunCount || 0}
            extraActions={
                <button onClick={handleAdd} style={{ background: 'var(--btn-bg)', color: 'var(--node-text)', border: '1px solid var(--btn-border)', padding: '9px 18px', borderRadius: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, fontSize: 13 }}>
                    <PlusCircle size={16}/> AÑADIR
                </button>
            }
        >
            {variables.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--node-desc)', background: 'var(--node-footer-bg)', borderRadius: 18, border: '1px dashed var(--node-border)' }}>
                    Sin variables. Haz clic en "AÑADIR" para crear una.
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {variables.map(v => (
                        <div key={v.id} style={{ display: 'flex', gap: 14, background: 'var(--node-footer-bg)', padding: '18px', borderRadius: 18, border: '1px solid var(--node-border)', alignItems: 'center' }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 10, fontWeight: 900, color: '#3b82f6', marginBottom: 5, textTransform: 'uppercase' }}>Nombre (Key)</div>
                                <input value={v.name} onChange={e => handleChange(v.id, 'name', e.target.value.replace(/\s+/g, '_').toLowerCase())} className="custom-input"/>
                            </div>
                            <div style={{ flex: 2 }}>
                                <div style={{ fontSize: 10, fontWeight: 900, color: '#3b82f6', marginBottom: 5, textTransform: 'uppercase' }}>Valor Fijo</div>
                                <input value={v.value} onChange={e => handleChange(v.id, 'value', e.target.value)} className="custom-input"/>
                            </div>
                            <button onClick={() => handleRemove(v.id)} style={{ background: 'rgba(244,63,94,0.1)', color: '#f43f5e', border: 'none', width: 42, height: 42, borderRadius: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Trash2 size={18}/>
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </NodeEditorShell>
    );
}
