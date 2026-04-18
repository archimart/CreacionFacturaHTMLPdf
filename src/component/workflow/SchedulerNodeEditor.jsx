import { useState } from "react";
import { Clock, Calendar, Check, Play, AlertCircle, Trash2, Info, ArrowRight } from "lucide-react";

export default function SchedulerNodeEditor({ theme, data, onUpdate, onToast }) {
    const [selectedFreq, setSelectedFreq] = useState(data.frequency || 'daily');
    const [time, setTime] = useState(data.time || '09:00');

    const frequencies = [
        { id: 'minutely', label: 'Cada minuto', cron: '* * * * *', desc: 'Ideal para monitoreo crítico' },
        { id: 'hourly', label: 'Cada hora', cron: '0 * * * *', desc: 'Actualizaciones de inventario' },
        { id: 'daily', label: 'Diario', cron: '0 9 * * *', desc: 'Resumen de ventas y facturación' },
        { id: 'weekly', label: 'Semanal', cron: '0 9 * * 1', desc: 'Reportes administrativos' },
        { id: 'monthly', label: 'Mensual', cron: '0 9 1 * *', desc: 'Cierre de mes y nómina' }
    ];

    const handleSave = () => {
        const freq = frequencies.find(f => f.id === selectedFreq);
        onUpdate({ 
            frequency: selectedFreq, 
            time: time,
            cron: freq?.cron || '* * * * *',
            description: `Se ejecutará ${freq?.label.toLowerCase()} a las ${time}`
        });
        if (onToast) onToast("Programación guardada con éxito");
    };

    return (
        <div style={{ flex: 1, padding: 40, color: "var(--node-text)", overflowY: "auto", fontFamily: "'Outfit', sans-serif" }}>
            <style>{`
                .glass-card { background: var(--panel-bg); border: 1px solid var(--panel-border); backdrop-filter: blur(20px); border-radius: 24px; padding: 32px; box-shadow: var(--box-shadow); }
                .freq-btn { background: var(--editor-header); border: 1px solid var(--panel-border); border-radius: 16px; padding: 20px; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); text-align: left; }
                .freq-btn:hover { border: 1px solid var(--primary); transform: translateY(-3px); }
                .freq-btn.active { background: linear-gradient(135deg, #3b82f633 0%, #3b82f611 100%); border: 2px solid #3b82f6; box-shadow: 0 10px 20px rgba(59, 130, 246, 0.15); }
                .save-btn { background: #3b82f6; color: #fff; border: none; padding: 16px 40px; borderRadius: 16px; fontWeight: 800; cursor: pointer; transition: all 0.3s; display: flex; alignItems: center; gap: 12px; boxShadow: 0 15px 30px rgba(59,130,246,0.25); }
                .save-btn:hover { background: #2563eb; transform: translateY(-2px); box-shadow: 0 20px 40px rgba(59,130,246,0.35); }
            `}</style>

            <div className="glass-card" style={{ maxWidth: 800, margin: "0 auto" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
                    <div style={{ width: 56, height: 56, borderRadius: 18, background: "rgba(234, 179, 8, 0.15)", color: "#eab308", display: "flex", alignItems: "center", justifyContent: "center", border: "1.5px solid rgba(234, 179, 8, 0.3)" }}>
                        <Clock size={28} />
                    </div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "var(--node-text)" }}>Programador Automático</h2>
                        <p style={{ margin: "4px 0 0", color: "var(--node-desc)", fontSize: 13, fontWeight: 500 }}>Configura cuándo debe activarse este flujo automáticamente</p>
                    </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                    <div>
                        <label style={{ fontSize: 12, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 16, display: "block" }}>1. Elegir Frecuencia</label>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
                            {frequencies.map(f => (
                                <div key={f.id} onClick={() => setSelectedFreq(f.id)} className={`freq-btn ${selectedFreq === f.id ? 'active' : ''}`}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                        <span style={{ fontSize: 16, fontWeight: 800, color: selectedFreq === f.id ? "#3b82f6" : "var(--node-text)" }}>{f.label}</span>
                                        {selectedFreq === f.id && <div style={{ background: "#3b82f6", borderRadius: "50%", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={12} color="#fff"/></div>}
                                    </div>
                                    <div style={{ fontSize: 11, color: "var(--node-desc)", fontWeight: 500 }}>{f.desc}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={{ display: "flex", gap: 40, alignItems: "flex-end" }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: 12, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12, display: "block" }}>2. Hora de Ejecución</label>
                            <div style={{ position: "relative" }}>
                                <Calendar size={18} color="#3b82f6" style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                                <input 
                                    type="time" 
                                    value={time} 
                                    onChange={e => setTime(e.target.value)}
                                    style={{ width: "100%", background: "var(--input-bg)", border: "1.5px solid var(--panel-border)", borderRadius: 16, padding: "16px 16px 16px 48px", color: "var(--input-text)", fontSize: 18, fontWeight: 800, outline: "none", transition: "all 0.3s" }} 
                                />
                            </div>
                        </div>
                        <button onClick={handleSave} className="save-btn">
                            <Play size={20} fill="#fff" /> GUARDAR
                        </button>
                    </div>
                </div>

                <div style={{ marginTop: 40, padding: 24, borderRadius: 20, background: "rgba(59, 130, 246, 0.05)", border: "1px dashed rgba(59, 130, 246, 0.3)", display: "flex", gap: 20, alignItems: "center" }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(59, 130, 246, 0.1)", color: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Info size={22} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "var(--node-text)" }}>Resumen de Automatización</div>
                        <div style={{ fontSize: 12, color: "var(--node-desc)", marginTop: 4 }}>
                            Este flujo se ejecutará {frequencies.find(f => f.id === selectedFreq)?.label.toLowerCase()} de forma desatendida.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
