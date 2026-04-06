import React, { useState } from 'react';
import { 
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, 
  Type, Palette, Trash2, Layout, Grid, Maximize, List, Layers, 
  BarChart2, PieChart, TrendingUp, Activity, Plus, Minus, Move, 
  Settings2, Image as ImageIcon, Link, Table as TableIcon, Merge, Split,
  ChevronDown, ChevronUp, Check, X, Sliders, Box, Monitor, Smartphone,
  ArrowUp, ArrowDown, StretchHorizontal, ChevronLeft, ChevronRight, Strikethrough
} from 'lucide-react';

export default function PropertiesPanel({ el, onRename, onChange, onStyle, onDelete, selectionRange, onRangeSelect, lastSelectionRange }) {
  const [activeAccordion, setActiveAccordion] = useState("general");

  const restoreFocus = () => {
    if (!el) return;
    const editor = document.querySelector(`[contenteditable="true"]`); // Fallback
    if (editor) editor.focus();
  };

  if (!el) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: "#94a3b8", padding: 40, gap: 20 }}>
      <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center" }}><Settings2 size={32}/></div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#1e293b', marginBottom: 6 }}>Propiedades</div>
        <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>Selecciona un nodo para configurar sus atributos avanzados.</p>
      </div>
    </div>
  );

  const s = el.style || {};
  const isPage = el.type === "page";
  const palette = el.palette || ["#000000", "#ffffff", "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#f43f5e", "#06b6d4"];

  const safeHex = (c, def = "#000000") => {
    if (!c || typeof c !== 'string') return def;
    if (c === 'transparent') return "#ffffff";
    if (c.startsWith('#')) return c.length === 4 ? `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}` : (c.length === 7 ? c : def);
    return def;
  };

  const handleFormat = (command, value = null) => {
    let sel = window.getSelection();
    let hasSelection = sel.rangeCount > 0 && !sel.isCollapsed;

    // Word style: Restore selection if lost during property interaction
    if (!hasSelection && lastSelectionRange) {
        sel.removeAllRanges();
        sel.addRange(lastSelectionRange);
        hasSelection = true;
    }

    // Word style: If selection exists, use native or custom injection for granular control
    if (hasSelection) {
        if (command === 'fontSize') {
            const range = sel.getRangeAt(0);
            const span = document.createElement('span');
            span.style.fontSize = typeof value === 'number' ? `${value}px` : (value.includes('px') ? value : `${value}px`);
            range.surroundContents(span);
            // Re-select the new span to keep the "sticky" feel
            const newRange = document.createRange();
            newRange.selectNodeContents(span);
            sel.removeAllRanges();
            sel.addRange(newRange);
        } else if (command === 'fontFamily') {
            const range = sel.getRangeAt(0);
            const span = document.createElement('span');
            span.style.fontFamily = value;
            range.surroundContents(span);
            // Re-select
            const newRange = document.createRange();
            newRange.selectNodeContents(span);
            sel.removeAllRanges();
            sel.addRange(newRange);
        } else if (document.queryCommandSupported(command)) {
            document.execCommand(command, false, value);
        }
        return;
    }

    // Default: Apply to the whole element if no selection
    const patch = {};
    if (command === 'bold') patch.fontWeight = (s.fontWeight === '700' || s.fontWeight === 'bold') ? '400' : '700';
    else if (command === 'italic') patch.fontStyle = s.fontStyle === 'italic' ? 'normal' : 'italic';
    else if (command === 'underline') patch.textDecoration = s.textDecoration === 'underline' ? 'none' : 'underline';
    else if (command === 'strikeThrough') patch.textDecoration = s.textDecoration === 'line-through' ? 'none' : 'line-through';
    else if (command === 'foreColor') patch.color = value;
    else if (command === 'justifyLeft') patch.textAlign = 'left';
    else if (command === 'justifyCenter') patch.textAlign = 'center';
    else if (command === 'justifyRight') patch.textAlign = 'right';
    else if (command === 'fontSize') patch.fontSize = typeof value === 'number' ? `${value}px` : (value.includes('px') ? value : `${value}px`);
    else if (command === 'fontFamily') patch.fontFamily = value;
    else if (command === 'verticalAlign') patch.verticalAlign = value;
    else if (command === 'insertUnorderedList' || command === 'insertOrderedList' || command === 'indent' || command === 'outdent') {
        document.execCommand(command, false, value);
        return;
    }
    
    if (el._isCell) {
        const cellStyle = { ...(el.style || {}), ...patch };
        const parts = el.id.split(':'), r = parts[3], c = parts[4];
        const cs = { ...(el.table?.cellStyles || {}) };
        cs[`${r}:${c}`] = cellStyle;
        onChange?.({ table: { ...(el.table || {}), cellStyles: cs } });
    } else {
        onStyle?.(patch);
    }

    restoreFocus();
  };

  const fonts = ["Outfit, sans-serif", "Inter, sans-serif", "Roboto, sans-serif", "Arial, sans-serif", "Georgia, serif", "Courier New, monospace"];
  const inputStyle = { width: "100%", border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "10px 14px", fontSize: "13px", fontWeight: 700, outline: "none", transition: "all 0.2s" };
  const btnActionStyle = { ...inputStyle, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };
  const labelStyle = { fontSize: 10, fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, display: "block" };
  
  const FormatBtn = ({ cmd, icon, active, val = null }) => (
    <button 
        onMouseDown={(e) => e.preventDefault()} 
        onClick={() => handleFormat(cmd, val)} 
        style={{ ...btnActionStyle, background: active ? "#3b82f6" : "#fff", color: active ? "#fff" : "#1e293b", borderColor: active ? "#3b82f6" : "#e2e8f0", minWidth: 40, height: 40, padding: 0 }}
    >
        {icon}
    </button>
  );

  const sectionHeader = (id, icon, label) => (
    <div onClick={() => setActiveAccordion(activeAccordion === id ? "" : id)} style={{ 
        display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 0", 
        borderTop: "1px solid #f1f5f9", cursor: "pointer", color: activeAccordion === id ? "#3b82f6" : "#1e293b" 
    }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 800, fontSize: 12 }}>{icon}{label}</div>
        {activeAccordion === id ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
    </div>
  );

  const isBox = el.type === "box" || el._isCell;
  const isChart = el.type === "chart";
  const isTable = (el.type === "table" && !el._isCell);

  return (
    <div style={{ display: "flex", flexDirection: "column", padding: "10px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#3b82f615", color: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center" }}><Layers size={18}/></div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>{isPage ? "Página" : el._isCell ? "Celda de Tabla" : el.type?.toUpperCase()}</div>
        </div>
        <button onClick={onDelete} style={{ width: 36, height: 36, borderRadius: 10, background: "#fee2e2", color: "#ef4444", border: "none", cursor: "pointer" }}><Trash2 size={16}/></button>
      </div>

      {/* ACORDEÓN DE GENERAL */}
      {sectionHeader("general", <Sliders size={15}/>, "CONFIGURACIÓN")}
      {activeAccordion === "general" && (
          <div style={{ paddingBottom: 20, display: "grid", gap: 16 }}>
              <div>
                  <label style={labelStyle}>{isPage ? "Alias de Página" : "Nombre del Nodo"}</label>
                  <input value={isPage ? el.name : (el.label ?? "")} onChange={(e) => onRename?.(e.target.value)} style={inputStyle} />
              </div>
              
              {isTable && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                         <label style={labelStyle}>Filas</label>
                         <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <button onClick={() => onChange?.({ table: { ...el.table, rows: Math.max(1, (el.table?.rows || 1) - 1) } })} style={{ ...inputStyle, width: 32, padding: 0 }}>-</button>
                            <div style={{ flex: 1, textAlign: "center", fontWeight: 800 }}>{el.table?.rows || 1}</div>
                            <button onClick={() => onChange?.({ table: { ...el.table, rows: (el.table?.rows || 1) + 1 } })} style={{ ...inputStyle, width: 32, padding: 0 }}>+</button>
                         </div>
                      </div>
                      <div>
                         <label style={labelStyle}>Columnas</label>
                         <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <button onClick={() => onChange?.({ table: { ...el.table, cols: Math.max(1, (el.table?.cols || 1) - 1) } })} style={{ ...inputStyle, width: 32, padding: 0 }}>-</button>
                            <div style={{ flex: 1, textAlign: "center", fontWeight: 800 }}>{el.table?.cols || 1}</div>
                            <button onClick={() => onChange?.({ table: { ...el.table, cols: (el.table?.cols || 1) + 1 } })} style={{ ...inputStyle, width: 32, padding: 0 }}>+</button>
                         </div>
                      </div>
                  </div>
              )}
          </div>
      )}

      {/* ACORDEÓN DE ESTILO */}
      {sectionHeader("style", <Type size={15}/>, "TEXTO Y FORMATO")}
      {activeAccordion === "style" && (
          <div style={{ paddingBottom: 20, display: "grid", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                  <FormatBtn cmd="bold" icon={<Bold size={16}/>} active={s.fontWeight==='700'||s.fontWeight==='bold'} />
                  <FormatBtn cmd="italic" icon={<Italic size={16}/>} active={s.fontStyle==='italic'} />
                  <FormatBtn cmd="underline" icon={<Underline size={16}/>} active={s.textDecoration==='underline'} />
                  <FormatBtn cmd="strikeThrough" icon={<Minus size={16}/>} active={s.textDecoration==='line-through'} />
                  
                  <FormatBtn cmd="justifyLeft" icon={<AlignLeft size={16}/>} active={s.textAlign==='left'} />
                  <FormatBtn cmd="justifyCenter" icon={<AlignCenter size={16}/>} active={s.textAlign==='center'} />
                  <FormatBtn cmd="justifyRight" icon={<AlignRight size={16}/>} active={s.textAlign==='right'} />
                  <FormatBtn cmd="insertUnorderedList" icon={<List size={16}/>} />

                  <FormatBtn cmd="insertOrderedList" icon={<Layout size={16}/>} />
                  <FormatBtn cmd="indent" icon={<ChevronRight size={16}/>} />
                  <FormatBtn cmd="outdent" icon={<ChevronLeft size={16}/>} />
                  <FormatBtn cmd="Type" icon={<Type size={16}/>} />
              </div>

              {el._isCell && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                      <FormatBtn cmd="verticalAlign" val="top" icon={<ArrowUp size={16}/>} active={s.verticalAlign==='top'} />
                      <FormatBtn cmd="verticalAlign" val="middle" icon={<StretchHorizontal size={16}/>} active={s.verticalAlign==='middle'} />
                      <FormatBtn cmd="verticalAlign" val="bottom" icon={<ArrowDown size={16}/>} active={s.verticalAlign==='bottom'} />
                  </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 12 }}>
                  <select value={s.fontFamily || "Outfit, sans-serif"} onChange={(e) => handleFormat('fontFamily', e.target.value)} style={inputStyle}>
                      {fonts.map(f => <option key={f} value={f}>{f.split(",")[0]}</option>)}
                  </select>
                  <input type="number" value={parseInt(s.fontSize) || 14} onChange={(e) => handleFormat('fontSize', e.target.value)} style={inputStyle} />
              </div>

              <div>
                  <label style={labelStyle}>Paleta de Colores</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      <input type="color" value={safeHex(s.color)} onChange={(e) => handleFormat('foreColor', e.target.value)} style={{ width: 28, height: 28, borderRadius: "50%", border: "1px solid #e2e8f0", padding: 1 }} />
                      {palette.map(c => <button key={c} onMouseDown={e => e.preventDefault()} onClick={() => handleFormat('foreColor', c)} style={{ width: 26, height: 26, borderRadius: "50%", background: c, border: s.color === c ? "2.5px solid #3b82f6" : "1.5px solid #f1f5f9", cursor: "pointer" }} />)}
                  </div>
              </div>
          </div>
      )}

      {/* ACORDEÓN DE FONDO */}
      {isBox && sectionHeader("box", <Palette size={15}/>, "FONDO Y APARIENCIA")}
      {isBox && activeAccordion === "box" && (
          <div style={{ paddingBottom: 20, display: "grid", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                      <label style={labelStyle}>Color Fondo</label>
                      <input type="color" value={safeHex(s.background)} onChange={(e) => onStyle?.({ background: e.target.value })} style={{ ...inputStyle, padding: 2, height: 40 }} />
                  </div>
                  <div>
                      <label style={labelStyle}>Grosor Borde</label>
                      <input type="number" value={s.borderWidth || 0} onChange={(e) => onStyle?.({ borderWidth: Number(e.target.value), borderStyle: "solid", borderColor: s.borderColor || "#e2e8f0" })} style={inputStyle} />
                  </div>
              </div>
              <div>
                  <label style={labelStyle}>Radio de Esquina (px)</label>
                  <input type="number" value={s.borderRadius || 0} onChange={(e) => onStyle?.({ borderRadius: Number(e.target.value) })} style={inputStyle} />
              </div>
          </div>
      )}

      <div style={{ padding: 20, borderTop: "1px solid #f1f5f9", background: "rgba(59,130,246,0.05)", borderRadius: 20, margin: "0 20px 20px" }}>
        <div style={{ fontSize: 10, fontWeight: 900, color: "#3b82f6", marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>Insertar Contenido</div>
        <button 
          onClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = (e) => {
              const file = e.target.files[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = (re) => {
                const imgHtml = `<img src="${re.target.result}" style="height:1.2em; vertical-align:middle; margin: 0 4px; display:inline-block;" />`;
                const newText = (el.text || "").replace(/<br\s*\/?>$/i, "") + imgHtml;
                onChange({ text: newText });
              };
              reader.readAsDataURL(file);
            };
            input.click();
          }}
          style={{ 
            width: "100%", height: 44, borderRadius: 12, 
            background: "#3b82f6", color: "#fff", 
            border: "none", cursor: "pointer", fontWeight: 800, fontSize: 13,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            boxShadow: "0 10px 20px rgba(59,130,246,0.2)"
          }}
        >
            <ImageIcon size={18} /> Insertar Imagen en Línea
        </button>
      </div>

      <div style={{ height: 60 }} />
    </div>
  );
}
