import React, { useState } from "react";

export default function VersionHistory({ 
  versions = [], 
  activeId, 
  hasUnsavedChanges,
  isSaving,
  onSave, 
  onUpdate,
  onRenameVersion,
  onLoad, 
  onDelete, 
  onExport, 
  onImport 
}) {
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");

  const handleSave = () => {
    const finalName = newName.trim() || `Versión ${versions.length + 1}`;
    if (isSaving) return;
    onSave(finalName);
    setNewName("");
  };

  const startRename = (v) => {
    setEditingId(v.id);
    setEditName(v.name);
  };

  const commitRename = () => {
    if (editName.trim() && editingId) {
        onRenameVersion(editingId, editName.trim());
    }
    setEditingId(null);
  };

  const activeVersion = versions.find(v => v.id === activeId);

  const handleFileImport = (e) => {
    const file = e.target.files?.[0];
    if (file) onImport(file);
    e.target.value = null; 
  };

  const sectionStyle = { marginBottom: 32 };
  const labelStyle = { fontSize: 10, fontWeight: 900, color: "#94a3b8", marginBottom: 12, display: "block", textTransform: "uppercase", letterSpacing: "1px" };
  const inputStyle = { width: "100%", border: "1px solid #e2e8f0", borderRadius: 12, padding: "10px 14px", fontSize: "14px", outline: "none", background: "#fff" };
  const btnStyle = { padding: "10px 16px", borderRadius: 12, border: "none", cursor: "pointer", fontWeight: 700, fontSize: "13px", transition: "all 0.2s" };

  return (
    <div style={{ padding: "0" }}>
      {/* 🚀 QUICK SAVE / UPDATE SECTION */}
      <section style={sectionStyle}>
        <div style={{ position: "relative", marginBottom: 4 }}>
             <p style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", margin: "4px 0 12px 0" }}>Crear una copia nueva:</p>
             <div style={{ display: "flex", gap: 8 }}>
                <input 
                    placeholder="Escribe el nombre de la copia..." 
                    value={newName} 
                    onChange={(e) => setNewName(e.target.value)} 
                    style={inputStyle} 
                    onKeyDown={(e) => e.key === "Enter" && handleSave()}
                />
                <button 
                    disabled={isSaving}
                    onClick={handleSave}
                    style={{ 
                        ...btnStyle, 
                        background: isSaving ? "#f1f5f9" : "#2563eb", 
                        color: isSaving ? "#94a3b8" : "#fff", 
                        border: "none"
                    }}
                >
                    + Guardar
                </button>
            </div>
        </div>
      </section>

      {/* 📂 HISTORY LIST */}
      <section style={sectionStyle}>
        <label style={labelStyle}>Versiones Guardadas ({versions.length})</label>
        <div style={{ display: "grid", gap: 12 }}>
            {versions.length === 0 ? (
                <div style={{ padding: "30px", border: "2px dashed #e2e8f0", borderRadius: 20, textAlign: "center", color: "#94a3b8", fontSize: "13px" }}>
                    No hay versiones guardadas todavía.
                </div>
            ) : (
                [...versions].reverse().map((v) => {
                    const isActive = v.id === activeId;
                    const isEditing = editingId === v.id;
                    return (
                        <div key={v.id} style={{ 
                            padding: "16px", 
                            background: "#fff", 
                            border: isActive ? "2px solid #3b82f6" : "1px solid #e2f0fe", 
                            borderRadius: 18,
                            boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
                            display: "flex", flexDirection: "column", gap: 8, transition: "all 0.2s"
                        }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                {isEditing ? (
                                    <input 
                                        autoFocus 
                                        value={editName} 
                                        onChange={(e) => setEditName(e.target.value)}
                                        onBlur={commitRename}
                                        onKeyDown={(e) => e.key === "Enter" && commitRename()}
                                        style={{ ...inputStyle, padding: "4px 8px", fontSize: "14px" }}
                                    />
                                ) : (
                                    <div 
                                        onClick={() => startRename(v)}
                                        title="Haz clic para renombrar"
                                        style={{ fontWeight: 800, fontSize: "15px", color: "#1e293b", cursor: "pointer" }}
                                    >
                                        {v.name}
                                    </div>
                                )}
                                <button onClick={() => onDelete(v.id)} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "18px", padding: "0 4px", fontWeight: "bold" }}>×</button>
                            </div>
                            <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 500 }}>{new Date(v.timestamp).toLocaleString()}</div>
                            
                            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                                <button 
                                    onClick={() => onUpdate(v.id)}
                                    style={{ 
                                        ...btnStyle, flex: 1, 
                                        background: "white", 
                                        border: "1px solid #e2e8f0", 
                                        color: "#4f46e5", 
                                        borderRadius: 14,
                                        padding: "8px 12px",
                                        display: "flex", justifyContent: "center", alignItems: "center", gap: 6
                                    }}
                                >
                                    <span style={{ fontSize: 16 }}>💾</span> Sobrescribir
                                </button>
                                <button 
                                    onClick={() => onLoad(v)}
                                    style={{ 
                                        ...btnStyle, flex: 1, 
                                        background: "white", 
                                        border: "1px solid #e2e8f0", 
                                        color: "#10b981", 
                                        borderRadius: 14,
                                        padding: "8px 12px",
                                        display: "flex", justifyContent: "center", alignItems: "center", gap: 6
                                    }}
                                >
                                    <span style={{ fontSize: 16 }}>📥</span> Restaurar
                                </button>
                            </div>
                        </div>
                    );
                })
            ) }
        </div>
      </section>

      {/* ☁️ OFFLINE BACKUP */}
      <section style={{ marginTop: 40, paddingTop: 20, borderTop: "1px solid #f1f5f9" }}>
          <label style={{ ...labelStyle, fontSize: "11px", color: "#94a3b8" }}>COPIA DE SEGURIDAD OFFLINE</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <button 
                onClick={onExport}
                style={{ ...btnStyle, background: "#f8fafc", border: "1px solid #e2e8f0", color: "#475569", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                <span style={{ fontSize: 15 }}>📥</span> Exportar JSON
              </button>
              <label style={{ ...btnStyle, background: "#f8fafc", border: "1px solid #e2e8f0", color: "#475569", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer" }}>
                <span style={{ fontSize: 15 }}>📤</span> Importar JSON
                <input type="file" accept=".json" onChange={handleFileImport} style={{ display: "none" }} />
              </label>
          </div>
      </section>
    </div>
  );
}
