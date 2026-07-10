import React, { useState, useEffect } from 'react';
import { Filter } from 'lucide-react';
import { GlobalDataRegistry } from './registry';
import { DataStreamer } from '@engine/core-logic';
import NodeEditorShell from './NodeEditorShell';

const OPERATORS = [
    { value: 'equals',       label: 'Es igual a' },
    { value: 'not_equals',   label: 'No es igual a' },
    { value: 'contains',     label: 'Contiene' },
    { value: 'not_contains', label: 'No contiene' },
    { value: 'greater_than', label: 'Mayor que' },
    { value: 'less_than',    label: 'Menor que' },
    { value: 'is_empty',     label: 'Está vacío' },
    { value: 'is_not_empty', label: 'No está vacío' },
];

function applyOp(rv, op, cv) {
    switch (op) {
        case 'equals':       return rv === cv;
        case 'not_equals':   return rv !== cv;
        case 'contains':     return rv.includes(cv);
        case 'not_contains': return !rv.includes(cv);
        case 'greater_than': return Number(rv) > Number(cv);
        case 'less_than':    return Number(rv) < Number(cv);
        case 'is_empty':     return rv === '';
        case 'is_not_empty': return rv !== '';
        default:             return false;
    }
}

export default function FilterNodeEditor({ theme, data, onUpdate }) {
    const streamer      = DataStreamer.getInstance();
    const dataKeyTrue   = data.dataKeyTrue  || `filter-${data.id || 'temp'}-true`;
    const dataKeyFalse  = data.dataKeyFalse || `filter-${data.id || 'temp'}-false`;

    const [field,        setField]       = useState(data.field    || '');
    const [operator,     setOperator]    = useState(data.operator || 'equals');
    const [value,        setValue]       = useState(data.value    || '');
    const [isProcessing, setIsProcessing]= useState(false);
    const [error,        setError]       = useState(null);

    const upstreamRecords = data.upstreamDataKey ? (GlobalDataRegistry.get(data.upstreamDataKey) || []) : [];
    const fields          = upstreamRecords.length > 0 ? Object.keys(upstreamRecords[0]) : [];
    const inputCount      = upstreamRecords.length;
    const trueCount       = GlobalDataRegistry.get(dataKeyTrue)?.length  || 0;
    const falseCount      = GlobalDataRegistry.get(dataKeyFalse)?.length || 0;
    const outputCount     = trueCount + falseCount;

    useEffect(() => {
        onUpdate({ field, operator, value, dataKeyTrue, dataKeyFalse });
    }, [field, operator, value]);

    const handleRun = () => {
        setError(null);
        setIsProcessing(true);
        setTimeout(() => {
            try {
                if (!data.upstreamDataKey) {
                    setError('Sin origen de datos conectado.');
                    setIsProcessing(false);
                    return;
                }
                const records = GlobalDataRegistry.get(data.upstreamDataKey) || [];
                const matched = [], unmatched = [];
                records.forEach(r => {
                    const rv = String(r[field] || '').toLowerCase().trim();
                    const cv = String(value   || '').toLowerCase().trim();
                    (applyOp(rv, operator, cv) ? matched : unmatched).push({ ...r });
                });

                GlobalDataRegistry.set(dataKeyTrue,  matched);
                GlobalDataRegistry.set(dataKeyFalse, unmatched);
                streamer.createSession(dataKeyTrue, matched);
                streamer.createSession(dataKeyFalse, unmatched);
                streamer.requestRange(dataKeyTrue, 0, 20);
                streamer.requestRange(dataKeyFalse, 0, 20);

                const now = new Date().toISOString();
                onUpdate({ field, operator, value, dataKeyTrue, dataKeyFalse, dataKey: dataKeyTrue, lastRun: now, lastRunCount: records.length });
            } catch (e) {
                setError(`Error al filtrar: ${e.message}`);
            } finally {
                setIsProcessing(false);
            }
        }, 80);
    };

    const noValue = ['is_empty', 'is_not_empty'].includes(operator);

    return (
        <NodeEditorShell
            icon={Filter}
            iconColor="#22d3ee"
            title="Filtro de Lógica"
            description="Divide los registros en dos flujos según una condición."
            inputCount={inputCount}
            outputCount={outputCount}
            isRunning={isProcessing}
            onRun={handleRun}
            runLabel="EJECUTAR FILTRO"
            runColor="#22d3ee"
            error={error}
            lastRun={data.lastRun}
            lastRunCount={data.lastRunCount || 0}
        >
            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 2fr', gap: 28 }}>

                {/* Regla de filtrado */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>Regla de Filtrado</h3>

                    <div>
                        <label style={{ display: 'block', fontWeight: 800, fontSize: 11, textTransform: 'uppercase', color: 'var(--node-desc)', marginBottom: 6 }}>Campo</label>
                        {fields.length > 0 ? (
                            <div style={{ display: 'flex', gap: 8 }}>
                                <select value={fields.includes(field) ? field : ''} onChange={e => setField(e.target.value || field)} className="custom-input" style={{ flex: 1 }}>
                                    <option value="">-- Seleccionar --</option>
                                    {fields.map(f => <option key={f} value={f}>{f}</option>)}
                                </select>
                                <input type="text" value={field} onChange={e => setField(e.target.value)} className="custom-input" style={{ flex: 1 }} placeholder="o escribir"/>
                            </div>
                        ) : (
                            <input type="text" value={field} onChange={e => setField(e.target.value)} className="custom-input" placeholder="Ej. estado, total"/>
                        )}
                    </div>

                    <div>
                        <label style={{ display: 'block', fontWeight: 800, fontSize: 11, textTransform: 'uppercase', color: 'var(--node-desc)', marginBottom: 6 }}>Operador</label>
                        <select value={operator} onChange={e => setOperator(e.target.value)} className="custom-input" style={{ width: '100%' }}>
                            {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>

                    {!noValue && (
                        <div>
                            <label style={{ display: 'block', fontWeight: 800, fontSize: 11, textTransform: 'uppercase', color: 'var(--node-desc)', marginBottom: 6 }}>Valor</label>
                            <input type="text" value={value} onChange={e => setValue(e.target.value)} className="custom-input" placeholder="Valor de comparación"/>
                        </div>
                    )}
                </div>

                {/* Resultados */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {[
                        { key: dataKeyTrue,  count: trueCount,  label: 'Coincide (True)',      color: '#10b981', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.2)' },
                        { key: dataKeyFalse, count: falseCount, label: 'No Coincide (False)',  color: '#ef4444', bg: 'rgba(239,68,68,0.08)',    border: 'rgba(239,68,68,0.2)' },
                    ].map(({ key, count, label, color, bg, border }) => (
                        <div key={key} style={{ flex: 1, background: 'var(--editor-bg)', border: `1px solid var(--editor-border)`, borderRadius: 18, padding: 18, display: 'flex', flexDirection: 'column', minHeight: 120 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                <span style={{ fontSize: 13, fontWeight: 800, color }}>{label}</span>
                                {count > 0 && <span style={{ background: bg, color, border: `1px solid ${border}`, padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700 }}>{count.toLocaleString('es-CO')} reg.</span>}
                            </div>
                            <div style={{ flex: 1, background: 'var(--input-bg)', borderRadius: 12, border: `1px solid var(--editor-border)`, padding: 10, overflow: 'auto' }}>
                                {count === 0 ? (
                                    <div style={{ color: '#64748b', fontSize: 11, textAlign: 'center', paddingTop: 20 }}>Sin registros</div>
                                ) : (
                                    <pre style={{ margin: 0, color, fontFamily: 'monospace', fontSize: 10 }}>
                                        {JSON.stringify((GlobalDataRegistry.get(key) || []).slice(0, 3), null, 2)}
                                    </pre>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </NodeEditorShell>
    );
}
