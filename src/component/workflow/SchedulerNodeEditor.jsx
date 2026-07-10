import { useState, useEffect } from "react";
import { Clock, Calendar, Check, Play, Pause, Info, Trash2, RefreshCw } from "lucide-react";
import NodeEditorShell from './NodeEditorShell';

const FREQUENCIES = [
    { id: 'daily',   label: 'Diario',    cron: '0 {HH} * * *',   desc: 'Se ejecuta todos los días a la hora indicada' },
    { id: 'weekly',  label: 'Semanal',   cron: '0 {HH} * * 1',   desc: 'Se ejecuta cada lunes a la hora indicada' },
    { id: 'monthly', label: 'Mensual',   cron: '0 {HH} 1 * *',   desc: 'Se ejecuta el 1° de cada mes' },
    { id: 'hourly',  label: 'Cada hora', cron: '0 * * * *',       desc: 'Se ejecuta al inicio de cada hora' },
    { id: 'minutely',label: 'Cada min',  cron: '* * * * *',       desc: 'Útil para pruebas. ¡Úsalo con cuidado!' },
];

function calcNextRun(frequency, time) {
    const now  = new Date();
    const next = new Date(now);
    const [hh, mm] = (time || '09:00').split(':').map(Number);

    switch (frequency) {
        case 'daily':
            next.setHours(hh, mm, 0, 0);
            if (next <= now) next.setDate(next.getDate() + 1);
            break;
        case 'weekly': {
            next.setHours(hh, mm, 0, 0);
            const diff = (1 - next.getDay() + 7) % 7 || 7;
            if (diff === 7 && next <= now) next.setDate(next.getDate() + 7);
            else next.setDate(next.getDate() + diff);
            break;
        }
        case 'monthly':
            next.setDate(1); next.setHours(hh, mm, 0, 0);
            if (next <= now) { next.setMonth(next.getMonth() + 1); next.setDate(1); }
            break;
        case 'hourly':
            next.setMinutes(0, 0, 0);
            next.setHours(next.getHours() + 1);
            break;
        case 'minutely':
            next.setSeconds(0, 0);
            next.setMinutes(next.getMinutes() + 1);
            break;
        default:
            return null;
    }
    return next;
}

function fmtDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function SchedulerNodeEditor({ theme, data, onUpdate, workflowName, workflowPath }) {
    const [frequency, setFrequency] = useState(data.frequency || 'daily');
    const [time,      setTime]      = useState(data.time      || '09:00');
    const [enabled,   setEnabled]   = useState(data.enabled   ?? false);
    const [lastRun,   setLastRun]   = useState(data.lastRun   || null);
    const [isSaving,  setIsSaving]  = useState(false);
    const [toast,     setToast]     = useState(null);

    // Cargar schedule existente desde disco al abrir el nodo
    useEffect(() => {
        if (!workflowPath || !workflowName) return;
        fetch(`/api/schedules/load?baseDir=${encodeURIComponent(workflowPath)}`)
            .then(r => r.json())
            .then(d => {
                const s = d.schedules?.[workflowName];
                if (s) {
                    if (s.frequency) setFrequency(s.frequency);
                    if (s.time)      setTime(s.time);
                    if (s.enabled !== undefined) setEnabled(s.enabled);
                    if (s.lastRun)   setLastRun(s.lastRun);
                }
            })
            .catch(() => {});
    }, [workflowName, workflowPath]);

    const showToast = (msg, color = '#10b981') => {
        setToast({ msg, color });
        setTimeout(() => setToast(null), 3000);
    };

    const handleSave = async (newEnabled = enabled) => {
        setIsSaving(true);
        const freq = FREQUENCIES.find(f => f.id === frequency);
        const cron = freq?.cron.replace('{HH}', time.split(':')[0]) || '0 9 * * *';
        const nextRun = calcNextRun(frequency, time);

        const schedule = {
            frequency,
            time,
            cron,
            enabled: newEnabled,
            lastRun,
            nextRun: nextRun?.toISOString() || null,
            description: freq?.label
        };

        try {
            if (workflowPath && workflowName) {
                await fetch('/api/schedules/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ baseDir: workflowPath, workflowName, schedule })
                });
            }
            onUpdate({ ...schedule });
            showToast(newEnabled ? '¡Schedule activado y guardado!' : 'Schedule guardado (inactivo)');
        } catch {
            showToast('Error al guardar', '#ef4444');
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggle = () => {
        const next = !enabled;
        setEnabled(next);
        handleSave(next);
    };

    const handleDelete = async () => {
        if (!workflowPath || !workflowName) return;
        await fetch('/api/schedules/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ baseDir: workflowPath, workflowName })
        });
        setEnabled(false);
        setLastRun(null);
        onUpdate({ enabled: false, lastRun: null });
        showToast('Schedule eliminado', '#f59e0b');
    };

    const nextRun = calcNextRun(frequency, time);
    const freq    = FREQUENCIES.find(f => f.id === frequency);

    return (
        <NodeEditorShell
            icon={Clock}
            iconColor="#eab308"
            title="Programador Automático"
            description="Configura cuándo se ejecuta este flujo automáticamente."
            isRunning={isSaving}
            onRun={() => handleSave()}
            runLabel="GUARDAR"
            runColor="#eab308"
            lastRun={data.lastRun}
            lastRunCount={data.lastRunCount || 0}
            extraActions={
                <button onClick={handleToggle} style={{ padding: '9px 18px', borderRadius: 12, border: `2px solid ${enabled ? '#ef4444' : '#10b981'}`, background: 'transparent', color: enabled ? '#ef4444' : '#10b981', fontWeight: 900, cursor: 'pointer', fontSize: 13 }}>
                    {enabled ? 'DESACTIVAR' : 'ACTIVAR'}
                </button>
            }
        >
            <style>{`
                .freq-btn { background: var(--editor-header); border: 1.5px solid var(--node-border); border-radius: 16px; padding: 18px; cursor: pointer; transition: all 0.25s; text-align: left; width: 100%; }
                .freq-btn:hover { border-color: #eab308; }
                .freq-btn.active { background: rgba(234,179,8,0.1); border-color: #eab308; box-shadow: 0 6px 20px rgba(234,179,8,0.15); }
            `}</style>

            <div style={{ maxWidth: 700, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

                {/* Badge de estado */}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <div style={{ padding: '8px 18px', borderRadius: 20, background: enabled ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.15)', border: `1.5px solid ${enabled ? '#10b981' : '#475569'}`, color: enabled ? '#10b981' : '#64748b', fontWeight: 900, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                        {enabled ? <Check size={15}/> : <Pause size={15}/>}
                        {enabled ? 'ACTIVO' : 'INACTIVO'}
                    </div>
                </div>

                {/* Frecuencia */}
                <div>
                    <label style={{ fontSize: 11, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 14, display: 'block' }}>
                        1. Frecuencia de ejecución
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                        {FREQUENCIES.map(f => (
                            <button key={f.id} onClick={() => setFrequency(f.id)} className={`freq-btn ${frequency === f.id ? 'active' : ''}`}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                    <span style={{ fontSize: 15, fontWeight: 800, color: frequency === f.id ? '#eab308' : 'var(--node-text)' }}>{f.label}</span>
                                    {frequency === f.id && <div style={{ background: '#eab308', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={12} color="#000"/></div>}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--node-desc)', fontWeight: 500 }}>{f.desc}</div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Hora */}
                {!['hourly', 'minutely'].includes(frequency) && (
                    <div>
                        <label style={{ fontSize: 11, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12, display: 'block' }}>
                            2. Hora de ejecución
                        </label>
                        <div style={{ position: 'relative', maxWidth: 260 }}>
                            <Calendar size={18} color="#eab308" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                            <input type="time" value={time} onChange={e => setTime(e.target.value)} style={{ width: '100%', background: 'var(--input-bg)', border: '1.5px solid var(--node-border)', borderRadius: 16, padding: '16px 16px 16px 48px', color: 'var(--input-text)', fontSize: 18, fontWeight: 800, outline: 'none', boxSizing: 'border-box' }} />
                        </div>
                    </div>
                )}

                {/* Eliminar schedule */}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={handleDelete} title="Eliminar schedule" style={{ padding: '9px 16px', borderRadius: 12, border: '1.5px solid var(--node-border)', background: 'transparent', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 700 }}>
                        <Trash2 size={14}/> Eliminar Schedule
                    </button>
                </div>

                {/* Resumen */}
                <div style={{ padding: 24, borderRadius: 20, background: enabled ? 'rgba(234,179,8,0.07)' : 'rgba(100,116,139,0.05)', border: `1.5px dashed ${enabled ? 'rgba(234,179,8,0.4)' : 'rgba(100,116,139,0.3)'}`, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: enabled ? '#eab308' : 'var(--node-desc)' }}>
                        <Info size={18}/>
                        <span style={{ fontWeight: 800, fontSize: 14 }}>Resumen del Programador</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        {[
                            { label: 'Frecuencia', value: freq?.label || '—' },
                            { label: 'Estado',     value: enabled ? 'Activo' : 'Inactivo' },
                            { label: 'Próxima ejecución', value: enabled ? fmtDate(nextRun) : '—' },
                            { label: 'Última ejecución',  value: lastRun ? fmtDate(lastRun) : 'Nunca' },
                        ].map(({ label, value }) => (
                            <div key={label} style={{ background: 'var(--node-footer-bg)', borderRadius: 12, padding: '12px 16px' }}>
                                <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--node-desc)', textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--node-text)', marginTop: 4 }}>{value}</div>
                            </div>
                        ))}
                    </div>
                    {!workflowPath && (
                        <div style={{ color: '#f59e0b', fontSize: 12, fontWeight: 700, background: 'rgba(245,158,11,0.1)', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(245,158,11,0.2)' }}>
                            Guarda el workflow al menos una vez para activar la automatización en disco.
                        </div>
                    )}
                </div>
            </div>

            {toast && (
                <div style={{ position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)', background: toast.color, color: toast.color === '#eab308' ? '#000' : '#fff', padding: '14px 28px', borderRadius: 100, fontWeight: 800, fontSize: 14, zIndex: 99999, boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
                    {toast.msg}
                </div>
            )}
        </NodeEditorShell>
    );
}
