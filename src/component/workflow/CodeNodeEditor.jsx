import React, { useState, useEffect } from 'react';
import { Terminal, Sparkles, Play } from 'lucide-react';
import { DataStreamer } from '@engine/core-logic';
import { GlobalDataRegistry } from './registry';
import NodeEditorShell from './NodeEditorShell';

const TEMPLATES = [
    { label: 'Mapeo Básico',  code: "return items.map(item => ({\n  ...item,\n  nuevo_campo: 'valor'\n}));" },
    { label: 'Filtrar Vacíos', code: "return items.filter(item => item.ID != null);" },
    { label: 'Ordenar',       code: "return items.sort((a, b) => String(a.ID).localeCompare(String(b.ID)));" },
];

const CodeNodeEditor = React.memo(({ theme, data, onUpdate, dataKey }) => {
    const streamer   = DataStreamer.getInstance();
    const sessionId  = dataKey || `code-editor-${data.id || 'temp'}`;

    const [code,         setCode]        = useState(data.code || 'return items.map(item => ({\n  ...item,\n  nuevo_campo: "valor"\n}));');
    const [isRunning,    setIsRunning]   = useState(false);
    const [error,        setError]       = useState(null);
    const [resultCount,  setResultCount] = useState(0);
    const [preview,      setPreview]     = useState([]);
    const [sourceTotal,  setSourceTotal] = useState(0);

    useEffect(() => {
        if (!sessionId) return;
        const unsub = streamer.subscribe(sessionId, (chunk) => {
            if (chunk.records?.length > 0) setPreview(chunk.records);
            if (chunk.total !== undefined) setSourceTotal(chunk.total);
        });
        streamer.requestRange(sessionId, 0, 20);
        return () => unsub();
    }, [sessionId]);

    const inputCount  = GlobalDataRegistry.get(data.upstreamDataKey)?.length || sourceTotal || 0;
    const outputCount = resultCount || GlobalDataRegistry.get(sessionId)?.length || 0;

    const handleSave = () => onUpdate({ code });

    const handleRun = () => {
        setIsRunning(true);
        setError(null);

        const outSession    = dataKey || `code-res-${data.id || 'temp'}`;
        const upstreamRecords = GlobalDataRegistry.get(data.upstreamDataKey);

        if (!upstreamRecords) {
            setError('Sin datos de entrada. Conecta un nodo de origen.');
            setIsRunning(false);
            return;
        }

        const copy = [...upstreamRecords];
        streamer.createSession(outSession, copy);
        GlobalDataRegistry.set(outSession, copy);

        streamer.transform(outSession, code, (count) => {
            setResultCount(count);
            setIsRunning(false);
            const updated = streamer.getSession?.(outSession)?.records || copy;
            GlobalDataRegistry.set(outSession, updated);
            streamer.requestRange(outSession, 0, 20);
            const now = new Date().toISOString();
            onUpdate({ code, dataKey: outSession, lastRun: now, lastRunCount: count });
        });
    };

    return (
        <NodeEditorShell
            icon={Terminal}
            iconColor="#fbbf24"
            title="Transformación JavaScript"
            description="Manipula los registros con código JS. La variable `items` contiene el arreglo de entrada."
            inputCount={inputCount}
            outputCount={outputCount}
            isRunning={isRunning}
            onRun={handleRun}
            runLabel="EJECUTAR"
            runColor="#fbbf24"
            error={error}
            lastRun={data.lastRun}
            lastRunCount={data.lastRunCount || 0}
            extraActions={
                <div style={{ display: 'flex', gap: 8 }}>
                    {TEMPLATES.map(t => (
                        <button key={t.label} onClick={() => setCode(t.code)} style={{ background: 'var(--btn-bg)', color: 'var(--node-text)', border: '1px solid var(--btn-border)', padding: '7px 12px', borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Sparkles size={12}/> {t.label}
                        </button>
                    ))}
                </div>
            }
        >
            <div style={{ display: 'flex', gap: 20, height: '100%', minHeight: 360 }}>
                {/* Editor de código */}
                <div style={{ flex: 1.6, background: '#000', borderRadius: 20, border: '1px solid var(--node-border)', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 15px 40px rgba(0,0,0,0.3)' }}>
                    <div style={{ background: '#1e1e1e', padding: '10px 18px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: 5 }}>
                            {['#ff5f56','#ffbd2e','#27c93f'].map(c => <div key={c} style={{ width: 11, height: 11, borderRadius: '50%', background: c }}/>)}
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 800, color: '#555', letterSpacing: 1 }}>NODE_SCRIPT.JS</span>
                    </div>
                    <textarea
                        value={code}
                        onChange={e => setCode(e.target.value)}
                        onBlur={handleSave}
                        style={{ flex: 1, background: 'transparent', color: '#d4d4d4', border: 'none', padding: '20px', fontSize: 13, fontFamily: '"Fira Code", "Consolas", monospace', outline: 'none', resize: 'none', lineHeight: 1.65 }}
                        spellCheck="false"
                    />
                </div>

                {/* Vista previa del resultado */}
                <div style={{ flex: 1, background: 'var(--node-footer-bg)', borderRadius: 20, border: '1px solid var(--node-border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--node-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, fontWeight: 900, color: 'var(--node-desc)', textTransform: 'uppercase' }}>Resultado</span>
                        {outputCount > 0 && <span style={{ fontSize: 10, background: 'rgba(16,185,129,0.1)', color: '#10b981', padding: '2px 8px', borderRadius: 6, fontWeight: 800 }}>{outputCount.toLocaleString('es-CO')} registros</span>}
                    </div>
                    <div style={{ flex: 1, padding: '16px', overflow: 'auto' }}>
                        {preview.length > 0 ? (
                            <pre style={{ margin: 0, fontSize: 11, color: '#10b981', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                                {JSON.stringify(preview, null, 2)}
                                {outputCount > 20 && `\n\n... y ${outputCount - 20} registros más`}
                            </pre>
                        ) : (
                            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.35, textAlign: 'center', gap: 10 }}>
                                <Play size={36}/>
                                <div style={{ fontWeight: 800, fontSize: 13 }}>Esperando ejecución</div>
                                <div style={{ fontSize: 11 }}>Disponibles: {inputCount.toLocaleString('es-CO')} registros</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </NodeEditorShell>
    );
});

export default CodeNodeEditor;
