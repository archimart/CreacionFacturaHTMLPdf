/**
 * NodeEditorShell — estructura estándar para todos los editores de nodo.
 *
 * Provee:
 *  - Encabezado: icono + título + descripción + contador Entrada→Salida + botón ejecutar
 *  - Área de error / advertencias
 *  - Zona de contenido scrollable (children)
 *  - Footer con historial de última ejecución
 *
 * Uso:
 *   <NodeEditorShell icon={Variable} iconColor="#3b82f6" title="Variables"
 *       inputCount={170} outputCount={420} onRun={applyFn} runLabel="APLICAR"
 *       lastRun={data.lastRun} lastRunCount={data.lastRunCount}>
 *       {/* contenido específico del nodo *\/}
 *   </NodeEditorShell>
 */

import React from 'react';
import { RefreshCw, Check, AlertCircle, ChevronRight } from 'lucide-react';

export default function NodeEditorShell({
    icon: Icon,
    iconColor    = '#3b82f6',
    title,
    description,
    inputCount   = 0,
    outputCount  = 0,
    isRunning    = false,
    onRun,
    runLabel     = 'EJECUTAR',
    runColor,
    runDisabled  = false,
    extraActions = null,
    children,
    error        = null,
    warnings     = [],
    lastRun      = null,   // ISO string
    lastRunCount = 0,
    lastRunErrors= 0,
}) {
    const fmtN = (n) => (n || 0).toLocaleString('es-CO');
    const fmtT = (iso) => iso
        ? new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : null;

    const btnBg = (isRunning || runDisabled) ? '#334155' : (runColor || iconColor);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', color: 'var(--node-text)', fontFamily: "'Outfit', sans-serif" }}>

            {/* ── Encabezado ───────────────────────────────────────────── */}
            <div style={{ padding: '22px 36px', borderBottom: '1px solid var(--editor-border)', display: 'flex', alignItems: 'center', gap: 18, flexShrink: 0 }}>

                {Icon && (
                    <div style={{ width: 48, height: 48, borderRadius: 14, background: `${iconColor}18`, color: iconColor, border: `1.5px solid ${iconColor}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon size={22} strokeWidth={2.5}/>
                    </div>
                )}

                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 19, fontWeight: 900, lineHeight: 1.2 }}>{title}</div>
                    {description && (
                        <div style={{ fontSize: 12, color: 'var(--node-desc)', marginTop: 3, fontWeight: 500 }}>{description}</div>
                    )}
                </div>

                {/* Contador Entrada → Salida */}
                {(inputCount > 0 || outputCount > 0) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--node-footer-bg)', borderRadius: 14, padding: '8px 16px', border: '1px solid var(--node-border)', flexShrink: 0 }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--primary)', lineHeight: 1 }}>{fmtN(inputCount)}</div>
                            <div style={{ fontSize: 9, color: 'var(--node-desc)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>Entrada</div>
                        </div>
                        <ChevronRight size={14} color="var(--node-desc)"/>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 17, fontWeight: 900, color: outputCount > 0 ? '#10b981' : 'var(--node-desc)', lineHeight: 1 }}>{fmtN(outputCount)}</div>
                            <div style={{ fontSize: 9, color: 'var(--node-desc)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>Salida</div>
                        </div>
                    </div>
                )}

                {/* Acciones extra + botón principal */}
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
                    {extraActions}
                    {onRun && (
                        <button
                            onClick={onRun}
                            disabled={isRunning || runDisabled}
                            style={{ background: btnBg, color: '#fff', border: 'none', padding: '10px 22px', borderRadius: 14, fontWeight: 900, fontSize: 13, cursor: (isRunning || runDisabled) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s', boxShadow: (!isRunning && !runDisabled) ? `0 6px 18px ${btnBg}50` : 'none', opacity: (isRunning || runDisabled) ? 0.7 : 1 }}
                        >
                            {isRunning && <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }}/>}
                            {isRunning ? 'PROCESANDO...' : runLabel}
                        </button>
                    )}
                </div>
            </div>

            {/* ── Banners de error / advertencia ───────────────────────── */}
            {(error || warnings.length > 0) && (
                <div style={{ padding: '12px 36px 0', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {error && (
                        <div style={{ padding: '10px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, color: '#ef4444', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
                            <AlertCircle size={16} style={{ flexShrink: 0 }}/> {error}
                        </div>
                    )}
                    {warnings.map((w, i) => (
                        <div key={i} style={{ padding: '8px 14px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10, color: '#f59e0b', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <AlertCircle size={13} style={{ flexShrink: 0 }}/> {w}
                        </div>
                    ))}
                </div>
            )}

            {/* ── Contenido específico del nodo ────────────────────────── */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 36px' }}>
                {children}
            </div>

            {/* ── Footer: última ejecución ──────────────────────────────── */}
            {lastRun && (
                <div style={{ padding: '10px 36px', borderTop: '1px solid var(--editor-border)', background: 'var(--node-footer-bg)', display: 'flex', alignItems: 'center', gap: 24, flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#10b981', fontSize: 11, fontWeight: 800 }}>
                        <Check size={13}/> Ejecutado: {fmtT(lastRun)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--node-desc)', fontWeight: 700 }}>
                        {fmtN(lastRunCount)} registros procesados
                    </div>
                    {lastRunErrors > 0 && (
                        <div style={{ fontSize: 11, color: '#f87171', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 5 }}>
                            <AlertCircle size={12}/> {lastRunErrors} error{lastRunErrors !== 1 ? 'es' : ''}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
