import React, { useState, useEffect, useMemo } from 'react';
import { Database, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, ArrowLeftCircle, ArrowRightCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Table as TableIcon, Braces } from 'lucide-react';
import { DataStreamer } from '@engine/core-logic';

// Item de registro colapsable
const DataItem = React.memo(({ record, index }) => {
    const [isOpen, setIsOpen] = useState(index === 0);
    const firstKey = Object.keys(record)[0];
    const firstVal = record[firstKey];

    return (
        <div style={{ background: 'var(--node-bg)', borderRadius: 16, border: '1px solid var(--node-border)', overflow: 'hidden', marginBottom: 10 }}>
            <div onClick={() => setIsOpen(!isOpen)} style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: isOpen ? 'rgba(59,130,246,0.05)' : 'transparent' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--primary)', background: 'rgba(59,130,246,0.1)', padding: '2px 8px', borderRadius: 6 }}>#{index + 1}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--node-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>
                        {firstKey ? `${firstKey}: ${firstVal}` : 'Registro vacío'}
                    </div>
                </div>
                {isOpen ? <ChevronUp size={16} color="var(--node-desc)"/> : <ChevronDown size={16} color="var(--node-desc)"/>}
            </div>
            {isOpen && (
                <div style={{ padding: '15px', borderTop: '1px solid var(--node-border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {Object.entries(record).map(([k, v]) => (
                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                            <span style={{ color: 'var(--node-desc)', fontWeight: 700, marginRight: 15 }}>{k}:</span>
                            <span style={{ color: 'var(--node-text)', fontWeight: 600, textAlign: 'right', wordBreak: 'break-all' }}>{String(v)}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
});

export const NodeDataInspector = React.memo(({ theme, title = "Data Pointer Mode", side = "left", nodeId, dataKey }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [view, setView] = useState('table');
    const [chunk, setChunk] = useState({ records: [], total: 0, startIndex: 0, endIndex: 0 });
    const pageSize = 20;
    const currentPage = Math.floor(chunk.startIndex / pageSize);

    const streamer = DataStreamer.getInstance();
    const sessionId = dataKey || `inspect-${nodeId}-${side}`;

    useEffect(() => {
        if (!dataKey) {
            setChunk({ records: [], total: 0, startIndex: 0, endIndex: 0 });
            return;
        }

        const unsubscribe = streamer.subscribe(sessionId, (newChunk) => {
            setChunk(newChunk);
        });
        streamer.requestRange(sessionId, 0, pageSize);

        // Retry: la sesión puede crearse después (auto-run upstream asíncrono)
        // Pedimos los datos otra vez una vez que el upstream haya terminado de cargar
        const retry1 = setTimeout(() => streamer.requestRange(sessionId, 0, pageSize), 400);
        const retry2 = setTimeout(() => streamer.requestRange(sessionId, 0, pageSize), 1200);

        return () => { unsubscribe(); clearTimeout(retry1); clearTimeout(retry2); };
    }, [dataKey, sessionId]);

    const handlePageChange = (direction) => {
        const nextPage = direction === 'next' ? currentPage + 1 : currentPage - 1;
        if (nextPage < 0 || nextPage * pageSize >= chunk.total) return;
        streamer.requestRange(sessionId, nextPage * pageSize, pageSize);
    };

    const records = chunk.records;
    const jsonPreview = useMemo(() => JSON.stringify(records, null, 2), [records]);
    const isRight = side === 'right';
    const accentColor = isRight ? '#10b981' : 'var(--primary)';

    if (isCollapsed) {
        return (
            <div style={{ width: 60, background: 'var(--editor-header)', borderRight: isRight ? 'none' : '1px solid var(--editor-border)', borderLeft: isRight ? '1px solid var(--editor-border)' : 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 20 }}>
                <button onClick={() => setIsCollapsed(false)} className="icon-btn" style={{ color: accentColor, background: isRight ? 'rgba(16,185,129,0.1)' : 'rgba(59,130,246,0.1)', width: 40, height: 40, borderRadius: 12 }} title="Expandir Inspector">
                    {isRight ? <PanelRightOpen size={20}/> : <PanelLeftOpen size={20}/>}
                </button>
                <div style={{ transform: 'rotate(-90deg)', marginTop: 100, whiteSpace: 'nowrap', color: 'var(--node-desc)', fontWeight: 900, fontSize: 12, letterSpacing: 2 }}>{title.toUpperCase()}</div>
            </div>
        );
    }

    return (
        <div style={{ width: 400, background: 'var(--editor-header)', borderRight: isRight ? 'none' : '1px solid var(--editor-border)', borderLeft: isRight ? '1px solid var(--editor-border)' : 'none', display: 'flex', flexDirection: 'column', height: '100%', pointerEvents: 'all', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}>
            <div style={{ padding: '24px', borderBottom: '1px solid var(--editor-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ fontSize: 13, fontWeight: 900, color: accentColor, textTransform: 'uppercase', letterSpacing: 1 }}>{title}</div>
                        <button onClick={() => setIsCollapsed(true)} style={{ border: 'none', background: 'transparent', color: 'var(--node-desc)', cursor: 'pointer', padding: 0 }} title="Contraer">
                            {isRight ? <PanelRightClose size={16}/> : <PanelLeftClose size={16}/>}
                        </button>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--node-desc)', fontWeight: 700, marginTop: 4 }}>{chunk.total.toLocaleString()} registros (Puntero)</div>
                </div>
                <div style={{ display: 'flex', background: 'var(--btn-bg)', borderRadius: 10, padding: 4 }}>
                    <button onClick={() => setView('table')} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: view === 'table' ? accentColor : 'transparent', color: view === 'table' ? '#fff' : 'var(--node-desc)', cursor: 'pointer' }}><TableIcon size={16}/></button>
                    <button onClick={() => setView('json')}  style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: view === 'json'  ? accentColor : 'transparent', color: view === 'json'  ? '#fff' : 'var(--node-desc)', cursor: 'pointer' }}><Braces size={16}/></button>
                </div>
            </div>

            <div style={{ padding: '10px 24px', borderBottom: '1px solid var(--editor-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(59,130,246,0.03)' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--node-desc)' }}>
                    Mostrando {chunk.startIndex + 1} - {chunk.endIndex}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => handlePageChange('prev')} disabled={currentPage === 0}                    style={{ border: 'none', background: 'transparent', color: currentPage === 0 ? '#444' : 'var(--primary)', cursor: 'pointer' }}><ArrowLeftCircle  size={20}/></button>
                    <button onClick={() => handlePageChange('next')} disabled={chunk.endIndex >= chunk.total}       style={{ border: 'none', background: 'transparent', color: chunk.endIndex >= chunk.total ? '#444' : 'var(--primary)', cursor: 'pointer' }}><ArrowRightCircle size={20}/></button>
                </div>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '15px' }}>
                {chunk.total === 0 ? (
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.4, textAlign: 'center', padding: '0 40px' }}>
                        <Database size={48} style={{ marginBottom: 15 }}/>
                        <div style={{ fontWeight: 800, fontSize: 14 }}>{isRight ? 'Sin datos de salida' : 'Sin datos de entrada'}</div>
                        <div style={{ fontSize: 11, marginTop: 5 }}>{isRight ? 'Ejecuta o aplica el nodo para ver los resultados aquí.' : 'Conecta un origen para ver datos de entrada.'}</div>
                    </div>
                ) : (
                    view === 'table' ? (
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {records.map((r, i) => <DataItem key={chunk.startIndex + i} record={r} index={chunk.startIndex + i} />)}
                        </div>
                    ) : (
                        <pre style={{ margin: 0, padding: '15px', background: 'rgba(0,0,0,0.2)', borderRadius: 16, fontSize: 12, color: '#10b981', fontFamily: 'monospace', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>{jsonPreview}</pre>
                    )
                )}
            </div>
        </div>
    );
});

export default NodeDataInspector;
