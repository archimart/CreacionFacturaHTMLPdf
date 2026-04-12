import React, { useState, useEffect } from 'react';
import {
    Plus, Trash2, Type, Square, Table as TableIcon, Layout, Grid,
    AlignLeft, AlignCenter, AlignRight, AlignJustify, Bold, Italic, Underline,
    Strikethrough, Settings2, Hash, Maximize2, Type as FontIcon,
    Palette, Smartphone, ChevronDown, ChevronUp, Activity,
    ArrowUpDown, Sparkles, Layers, Move, Scissors, TextCursor,
    AlignVerticalJustifyCenter, AlignVerticalJustifyStart, AlignVerticalJustifyEnd,
    List, ListOrdered, Indent, Outdent, LayoutTemplate
} from 'lucide-react';

const Section = ({ id, label, icon: Icon, children, activeAccordion, setActiveAccordion }) => {
    const isOpen = activeAccordion === id;
    return (
        <div style={{ borderBottom: "1px solid #f1f5f9" }}>
            <button
                onClick={() => setActiveAccordion(isOpen ? "" : id)}
                style={{ width: "100%", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", background: isOpen ? "#f8fafc" : "white", border: "none", cursor: "pointer", transition: "all 0.2s" }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Icon size={16} color={isOpen ? "#3b82f6" : "#64748b"} />
                    <span style={{ fontSize: "11px", fontWeight: 700, color: isOpen ? "#1e293b" : "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</span>
                </div>
                {isOpen ? <ChevronUp size={14} color="#94a3b8" /> : <ChevronDown size={14} color="#94a3b8" />}
            </button>
            {isOpen && <div style={{ padding: "16px", background: "white" }}>{children}</div>}
        </div>
    );
};

const ActionButton = ({ onClick, icon: Icon, label, disabled, primary }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        style={{
            flex: 1, padding: "18px 12px", borderRadius: "16px", border: primary ? "none" : "1px solid #e2e8f0",
            background: primary ? (disabled ? "#f1f5f9" : "#3b82f6") : "white",
            color: primary ? (disabled ? "#94a3b8" : "white") : "#475569",
            fontSize: "11px", fontWeight: "900", cursor: disabled ? "not-allowed" : "pointer",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            boxShadow: primary && !disabled ? "0 6px 16px rgba(59, 130, 246, 0.25)" : "0 2px 4px rgba(0,0,0,0.02)",
            opacity: disabled ? 0.7 : 1
        }}
    >
        <Icon size={24} strokeWidth={2.5} style={{ opacity: disabled ? 0.5 : 1 }} />
        <span style={{ letterSpacing: "0.4px" }}>{label}</span>
    </button>
);

export default function PropertiesPanel({ el, selectedCells = [], onStyle, onChange, onDelete, selectionRange }) {
    const [activeAccordion, setActiveAccordion] = useState("text");
    const [formatState, setFormatState] = useState({
        bold: false, italic: false, underline: false, strike: false,
        align: 'left', bullet: false, number: false
    });

    // Update button states based on document selection
    useEffect(() => {
        const updateFormat = () => {
            try {
                setFormatState({
                    bold: document.queryCommandState('bold'),
                    italic: document.queryCommandState('italic'),
                    underline: document.queryCommandState('underline'),
                    strike: document.queryCommandState('strikeThrough'),
                    bullet: document.queryCommandState('insertUnorderedList'),
                    number: document.queryCommandState('insertOrderedList'),
                    font: (document.queryCommandValue('fontName') || "").split(',')[0].replace(/['"]/g, '').trim(),
                    size: document.queryCommandValue('fontSize'),
                    align: document.queryCommandValue('justifyCenter') === 'true' ? 'center' :
                        document.queryCommandValue('justifyRight') === 'true' ? 'right' :
                            document.queryCommandValue('justifyFull') === 'true' ? 'justify' : 'left'
                });
            } catch (e) { }
        };
        document.addEventListener('selectionchange', updateFormat);
        return () => {
            document.removeEventListener('selectionchange', updateFormat);
        };
    }, []);

    const [localSize, setLocalSize] = useState("14");
    const [localShadow, setLocalShadow] = useState(0);

    const isTableCell = el?._isCell || el?.id?.includes(':cell:') || (selectedCells && selectedCells.length > 0);

    let s = el?.style || {};
    if (isTableCell && el?.id?.includes(':cell:')) {
        const coords = el.id.split(':cell:')[1];
        s = { ...s, ...((el.table?.cellStyles || {})[coords] || {}) };
    } else if (isTableCell && selectedCells?.length > 0) {
        const coords = `${selectedCells[0].r}:${selectedCells[0].c}`;
        s = { ...s, ...((el.table?.cellStyles || {})[coords] || {}) };
    }

    useEffect(() => {
        setLocalSize(s.fontSize ? parseInt(s.fontSize).toString() : "14");
        
        // Parse shadow intensity (blur radius)
        if (s.boxShadow && s.boxShadow !== 'none') {
            const matches = s.boxShadow.match(/(\d+)px/g);
            if (matches && matches.length >= 2) {
                // The second 'px' value is usually our blur/intensity in our generated string
                setLocalShadow(parseInt(matches[matches.length - 1]));
            } else {
                setLocalShadow(0);
            }
        } else {
            setLocalShadow(0);
        }
    }, [s.fontSize, s.boxShadow, el?.id]);

    if (!el) return (
        <div style={{ width: 300, background: "#f8fafc", borderLeft: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
            <p style={{ color: "#94a3b8", fontStyle: "italic", fontSize: "13px" }}>Selecciona un elemento para editar</p>
        </div>
    );

    const colors = ['transparent', '#000000', '#ffffff', '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
    const fonts = ["Outfit", "Inter", "Roboto", "Playfair Display", "Montserrat", "Courier New", "Georgia", "Times New Roman", "Arial", "Verdana"];
    const borderStyles = ["solid", "dashed", "dotted", "double", "none"];

    const handleUpdate = (patch) => {
        if (el?._isCell && patch.text !== undefined) {
            const coords = el.id.split(':cell:')[1];
            const table = el.table || {};
            const cellTexts = table.cellTexts || {};
            onChange?.({
                table: { ...table, cellTexts: { ...cellTexts, [coords]: patch.text } }
            });
        } else {
            onChange?.(patch);
        }
    };

    const handleCombinedUpdate = (stylePatch, textStr) => {
        if (isTableCell && selectedCells && selectedCells.length > 0) {
            const table = el?.table || {};
            const cellStyles = { ...(table.cellStyles || {}) };
            const cellTexts = { ...(table.cellTexts || {}) };
            selectedCells.forEach(cell => {
                const coords = `${cell.r}:${cell.c}`;
                cellStyles[coords] = { ...(cellStyles[coords] || {}), ...stylePatch };
                if (textStr !== undefined) cellTexts[coords] = textStr;
            });
            onChange?.({ table: { ...table, cellStyles, cellTexts } });
        } else if (el?._isCell) {
            const coords = el.id.split(':cell:')[1];
            const table = el.table || {};
            const cellStyles = { ...(table.cellStyles || {}) };
            const cellTexts = { ...(table.cellTexts || {}) };
            
            onChange?.({ 
                table: { 
                    ...table, 
                    cellStyles: { ...cellStyles, [coords]: { ...(cellStyles[coords] || {}), ...stylePatch } },
                    ...(textStr !== undefined ? { cellTexts: { ...cellTexts, [coords]: textStr } } : {})
                }
            });
        } else {
            onChange?.({ style: { ...s, ...stylePatch }, ...(textStr !== undefined ? { text: textStr } : {}) });
        }
    };

    const handleStyle = (patch) => {
        handleCombinedUpdate(patch, undefined);
    };

    const handleMergeCells = () => {
        if (selectedCells.length < 2) return;
        const rows = selectedCells.map(c => c.r);
        const cols = selectedCells.map(c => c.c);
        const minR = Math.min(...rows), maxR = Math.max(...rows);
        const minC = Math.min(...cols), maxC = Math.max(...cols);
        const newMerge = { r: minR, c: minC, rs: maxR - minR + 1, cs: maxC - minC + 1 };
        const table = el.table || {};
        const filteredMerges = (table.merges || []).filter(m => !(m.r >= minR && m.r <= maxR && m.c >= minC && m.c <= maxC));
        onChange?.({ table: { ...table, merges: [...filteredMerges, newMerge] } });
    };

    const handleSplitCells = () => {
        const table = el.table || {};
        const parts = el.id.split(':');
        const r = parseInt(parts[2]), c = parseInt(parts[3]);
        onChange?.({ table: { ...table, merges: (table.merges || []).filter(m => m.r !== r || m.c !== c) } });
    };

    return (
        <div style={{ width: 300, background: "white", borderLeft: "1px solid #e2e8f0", display: "flex", flexDirection: "column", height: "100%", boxShadow: "-4px 0 15px rgba(0,0,0,0.05)" }}>
            {/* Header */}
            <div style={{ padding: "16px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
                        <Settings2 size={16} />
                    </div>
                    <h2 style={{ fontSize: "14px", fontWeight: 800, color: "#1e293b", margin: 0 }}>AJUSTES</h2>
                </div>
                <button onClick={onDelete} style={{ border: "none", background: "transparent", color: "#94a3b8", cursor: "pointer", padding: 8 }} title="Eliminar">
                    <Trash2 size={18} />
                </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto" }}>
                {/* TABLE ACTIONS (Priority) */}
                {/* REMOVED: Redundant table actions, moved to bottom assistant bar to save space */}

                {/* TEXT & FORMAT */}
                <Section id="text" label="Fuente y Texto" icon={Type} activeAccordion={activeAccordion} setActiveAccordion={setActiveAccordion}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                        {[
                            { cmd: 'bold', icon: Bold, key: 'bold' },
                            { cmd: 'italic', icon: Italic, key: 'italic' },
                            { cmd: 'underline', icon: Underline, key: 'underline' },
                            { cmd: 'strikeThrough', icon: Strikethrough, key: 'strike' },
                        ].map(btn => {
                            const isActive = formatState[btn.key];
                            return (
                                <button
                                    key={btn.cmd}
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        document.execCommand(btn.cmd, false, null);
                                        handleUpdate({ text: document.querySelector(`[data-id="${el.id}"]`)?.innerHTML });
                                    }}
                                    style={{
                                        width: 34, height: 34, borderRadius: 8, border: isActive ? "1px solid #3b82f6" : "1px solid #e2e8f0",
                                        background: isActive ? "#eff6ff" : "white",
                                        display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                                        color: isActive ? "#3b82f6" : "#475569", transition: "all 0.2s"
                                    }}
                                >
                                    <btn.icon size={16} />
                                </button>
                            );
                        })}

                        {/* Case Toggle */}
                        <button
                            onClick={() => {
                                const current = s.textTransform || 'none';
                                const next = current === 'uppercase' ? 'lowercase' : current === 'lowercase' ? 'capitalize' : current === 'capitalize' ? 'none' : 'uppercase';
                                handleStyle({ textTransform: next });
                            }}
                            style={{
                                width: 34, height: 34, borderRadius: 8, border: s.textTransform && s.textTransform !== 'none' ? "1px solid #3b82f6" : "1px solid #e2e8f0",
                                background: s.textTransform && s.textTransform !== 'none' ? "#eff6ff" : "white",
                                display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                                color: s.textTransform && s.textTransform !== 'none' ? "#3b82f6" : "#475569", fontSize: '10px', fontWeight: 'bold'
                            }}
                            title="Cambiar Mayúsculas"
                        >
                            Aa
                        </button>

                        <div style={{ width: "100%", height: "1px", background: "#f1f5f9", margin: "4px 0" }} />

                        {[
                            { cmd: 'insertUnorderedList', icon: List, key: 'bullet', title: 'Lista con Viñetas' },
                            { cmd: 'insertOrderedList', icon: ListOrdered, key: 'number', title: 'Lista Numerada' },
                            { cmd: 'outdent', icon: Outdent, title: 'Reducir Sangría' },
                            { cmd: 'indent', icon: Indent, title: 'Aumentar Sangría' },
                        ].map(btn => {
                            const isActive = btn.key ? formatState[btn.key] : false;
                            return (
                                <button
                                    key={btn.cmd}
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        document.execCommand(btn.cmd, false, null);
                                        handleUpdate({ text: document.querySelector(`[data-id="${el.id}"]`)?.innerHTML });
                                    }}
                                    style={{
                                        width: 34, height: 34, borderRadius: 8, border: isActive ? "1px solid #3b82f6" : "1px solid #e2e8f0",
                                        background: isActive ? "#eff6ff" : "white",
                                        display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                                        color: isActive ? "#3b82f6" : "#475569", transition: "all 0.2s"
                                    }}
                                    title={btn.title}
                                >
                                    <btn.icon size={16} />
                                </button>
                            );
                        })}

                        <div style={{ width: "100%", height: "1px", background: "#f1f5f9", margin: "4px 0" }} />

                        {/* Paragraph Alignment (Word Style) */}
                        {[
                            { cmd: 'justifyLeft', icon: AlignLeft, key: 'left', title: 'Izquierda' },
                            { cmd: 'justifyCenter', icon: AlignCenter, key: 'center', title: 'Centro' },
                            { cmd: 'justifyRight', icon: AlignRight, key: 'right', title: 'Derecha' },
                            { cmd: 'justifyFull', icon: AlignJustify, key: 'justify', title: 'Justificar' }
                        ].map(btn => {
                            const isActive = formatState.align === btn.key || s.textAlign === (btn.key === 'justify' ? 'justify' : btn.key);
                            return (
                                <button
                                    key={btn.cmd}
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        document.execCommand(btn.cmd, false, null);
                                        handleUpdate({ text: document.querySelector(`[data-id="${el.id}"]`)?.innerHTML });
                                        handleStyle({ textAlign: btn.key === 'justify' ? 'justify' : btn.key });
                                    }}
                                    style={{
                                        width: 34, height: 34, borderRadius: 8, border: isActive ? "1px solid #3b82f6" : "1px solid #e2e8f0",
                                        background: isActive ? "#eff6ff" : "white",
                                        display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                                        color: isActive ? "#3b82f6" : "#475569", transition: "all 0.2s"
                                    }}
                                    title={btn.title}
                                >
                                    <btn.icon size={16} />
                                </button>
                            );
                        })}
                    </div>

                    <div style={{ marginBottom: 12 }}>
                        <label style={{ fontSize: "10px", fontWeight: 700, color: "#94a3b8", display: "block", marginBottom: 6 }}>TIPOGRAFÍA</label>
                        <select
                            value={s.fontFamily || "Outfit"}
                            onChange={(e) => {
                                const val = e.target.value;
                                const sel = window.getSelection();
                                const node = document.querySelector(`[data-id="${el.id}"]`);
                                if (sel.rangeCount > 0 && !sel.isCollapsed && node?.contains(sel.anchorNode)) {
                                    document.execCommand('styleWithCSS', false, true);
                                    document.execCommand('fontName', false, val);
                                    handleUpdate({ text: node.innerHTML });
                                } else if (node) {
                                    // Purge conflicting inline fonts so wrapper can cascade
                                    const elements = node.querySelectorAll('font, [style*="font-family"]');
                                    elements.forEach(n => {
                                        if (n.tagName.toLowerCase() === 'font') n.removeAttribute('face');
                                        n.style.fontFamily = '';
                                    });
                                    handleCombinedUpdate({ fontFamily: val }, node.innerHTML);
                                } else {
                                    handleStyle({ fontFamily: val });
                                }
                            }}
                            style={{ width: "100%", padding: "10px", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: "12px", background: "#f8fafc" }}
                        >
                            {fonts.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                    </div>

                    <div style={{ display: "flex", gap: 10 }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: "10px", fontWeight: 700, color: "#94a3b8", display: "block", marginBottom: 6 }}>TAMAÑO</label>
                            <input
                                type="number"
                                min="1" max="100"
                                value={localSize}
                                onChange={(e) => {
                                    setLocalSize(e.target.value);
                                    const num = parseInt(e.target.value);
                                    if (!isNaN(num)) {
                                        const node = document.querySelector(`[data-id="${el.id}"]`);
                                        if (node) {
                                            // Purge inline font sizes to allow wrapper property to cascade safely
                                            const elements = node.querySelectorAll('font, span, [style*="font-size"]');
                                            elements.forEach(n => {
                                                n.removeAttribute('size');
                                                n.style.fontSize = '';
                                            });
                                            handleCombinedUpdate({ fontSize: `${num}px` }, node.innerHTML);
                                        } else {
                                            handleStyle({ fontSize: `${num}px` });
                                        }
                                    }
                                }}
                                style={{ width: "100%", padding: "10px", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: "12px", background: "#f8fafc" }}
                            />
                        </div>
                    </div>
                </Section>

                {/* SPACING & ALIGNMENT */}
                <Section id="layout" label="Márgenes e Interlineado" icon={LayoutTemplate} activeAccordion={activeAccordion} setActiveAccordion={setActiveAccordion}>
                    <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
                        <label style={{ fontSize: "10px", fontWeight: 700, color: "#94a3b8", display: "block", width: "100%", marginBottom: 6 }}>ALINEACIÓN VERTICAL</label>
                        {[
                            { val: 'flex-start', icon: AlignVerticalJustifyStart, label: 'Arriba' },
                            { val: 'center', icon: AlignVerticalJustifyCenter, label: 'Centro' },
                            { val: 'flex-end', icon: AlignVerticalJustifyEnd, label: 'Abajo' }
                        ].map(btn => (
                            <button
                                key={btn.val}
                                onClick={() => handleStyle({ justifyContent: btn.val })}
                                style={{
                                    flex: 1, height: 34, borderRadius: 8, border: s.justifyContent === btn.val ? "1px solid #3b82f6" : "1px solid #e2e8f0",
                                    background: s.justifyContent === btn.val ? "#eff6ff" : "white",
                                    display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                                    color: s.justifyContent === btn.val ? "#3b82f6" : "#475569"
                                }}
                                title={btn.label}
                            >
                                <btn.icon size={16} />
                            </button>
                        ))}
                    </div>

                    <div style={{ marginBottom: 12 }}>
                        <label style={{ fontSize: "10px", fontWeight: 700, color: "#94a3b8", display: "block", marginBottom: 6 }}>INTERLINEADO (LINE HEIGHT)</label>
                        <input
                            type="range" min="0.8" max="3" step="0.1"
                            value={parseFloat(s.lineHeight) || 1.2}
                            onChange={(e) => handleStyle({ lineHeight: e.target.value })}
                            style={{ width: "100%" }}
                        />
                        <div style={{ textAlign: "right", fontSize: "10px", color: "#64748b" }}>{parseFloat(s.lineHeight) || 1.2}</div>
                    </div>

                    <div style={{ marginBottom: 12 }}>
                        <label style={{ fontSize: "10px", fontWeight: 700, color: "#94a3b8", display: "block", marginBottom: 6 }}>INTERLETRADO (LETTER SPACING)</label>
                        <input
                            type="range" min="-2" max="10" step="0.5"
                            value={parseFloat(s.letterSpacing) || 0}
                            onChange={(e) => handleStyle({ letterSpacing: `${e.target.value}px` })}
                            style={{ width: "100%" }}
                        />
                        <div style={{ textAlign: "right", fontSize: "10px", color: "#64748b" }}>{parseFloat(s.letterSpacing) || 0}px</div>
                    </div>

                    <div>
                        <label style={{ fontSize: "10px", fontWeight: 700, color: "#94a3b8", display: "block", marginBottom: 6 }}>RELLENO INTERNO (PADDING)</label>
                        <input
                            type="range" min="0" max="50"
                            value={parseInt(s.padding) || 10}
                            onChange={(e) => handleStyle({ padding: `${e.target.value}px` })}
                            style={{ width: "100%" }}
                        />
                        <div style={{ textAlign: "right", fontSize: "10px", color: "#64748b" }}>{parseInt(s.padding) || 10}px</div>
                    </div>
                </Section>

                {/* COLOR & BACKGROUND */}
                <Section id="style" label="Estilo y Color" icon={Palette} activeAccordion={activeAccordion} setActiveAccordion={setActiveAccordion}>
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: "10px", fontWeight: 700, color: "#94a3b8", display: "block", marginBottom: 8 }}>COLOR DE FONDO</label>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {colors.map(c => (
                                <button
                                    key={c}
                                    onClick={() => handleStyle({ background: c })}
                                    style={{
                                        width: 28, height: 28, borderRadius: "50%", border: s.background === c ? "2px solid #3b82f6" : "2px solid white",
                                        boxShadow: "0 0 0 1px #e2e8f0", background: c === 'transparent' ? 'white' : c,
                                        cursor: "pointer", position: "relative", overflow: "hidden", transition: "all 0.2s"
                                    }}
                                >
                                    {c === 'transparent' && <div style={{ width: "100%", height: 2, background: "#ef4444", transform: "rotate(45deg)", position: "absolute", top: "50%", marginTop: -1 }} />}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: "10px", fontWeight: 700, color: "#94a3b8", display: "block", marginBottom: 8 }}>COLOR DE TEXTO</label>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {colors.filter(c => c !== 'transparent').map(c => (
                                <button
                                    key={c}
                                    onClick={() => handleStyle({ color: c })}
                                    style={{
                                        width: 28, height: 28, borderRadius: "50%", border: s.color === c ? "2px solid #3b82f6" : "2px solid white",
                                        boxShadow: "0 0 0 1px #e2e8f0", background: c, cursor: "pointer", transition: "all 0.2s"
                                    }}
                                />
                            ))}
                        </div>
                    </div>

                    <div>
                        <label style={{ fontSize: "10px", fontWeight: 700, color: "#94a3b8", display: "block", marginBottom: 6 }}>OPACIDAD</label>
                        <input
                            type="range" min="0" max="1" step="0.1"
                            value={s.opacity !== undefined ? s.opacity : 1}
                            onChange={(e) => handleStyle({ opacity: e.target.value })}
                            style={{ width: "100%" }}
                        />
                    </div>
                </Section>

                {/* BORDER SETTINGS */}
                <Section id="border" label="Bordes y Geometría" icon={Square} activeAccordion={activeAccordion} setActiveAccordion={setActiveAccordion}>
                    <div style={{ marginBottom: 12 }}>
                        <label style={{ fontSize: "10px", fontWeight: 700, color: "#94a3b8", display: "block", marginBottom: 6 }}>ESTILO Y GROSOR</label>
                        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                            <select
                                value={s.borderStyle || "solid"}
                                onChange={(e) => handleStyle({ borderStyle: e.target.value })}
                                style={{ flex: 1, padding: "8px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: "11px" }}
                            >
                                {borderStyles.map(st => <option key={st} value={st}>{st.toUpperCase()}</option>)}
                            </select>
                            <input
                                type="number" min="0" max="20"
                                value={parseInt(s.borderWidth) || 0}
                                onChange={(e) => handleStyle({ borderWidth: `${e.target.value}px` })}
                                style={{ width: 60, padding: "8px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: "11px" }}
                            />
                        </div>
                    </div>

                    <div style={{ marginBottom: 12 }}>
                        <label style={{ fontSize: "10px", fontWeight: 700, color: "#94a3b8", display: "block", marginBottom: 6 }}>COLOR DEL BORDE</label>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {colors.filter(c => c !== 'transparent').map(c => (
                                <button
                                    key={c}
                                    onClick={() => handleStyle({ borderColor: c })}
                                    style={{
                                        width: 24, height: 24, borderRadius: "50%", border: (s.borderColor === c || s.border === c) ? "2px solid #3b82f6" : "2px solid white",
                                        boxShadow: "0 0 0 1px #e2e8f0", background: c, cursor: "pointer"
                                    }}
                                />
                            ))}
                        </div>
                    </div>

                    {/* REDONDEADO solo es para el objeto completo, no para celdas individuales */}
                    {!isTableCell && (
                        <div>
                            <label style={{ fontSize: "10px", fontWeight: 700, color: "#94a3b8", display: "block", marginBottom: 6 }}>REDONDEADO</label>
                            <input
                                type="range" min="0" max="100"
                                value={parseInt(s.borderRadius) || 0}
                                onChange={(e) => handleStyle({ borderRadius: `${e.target.value}px` })}
                                style={{ width: "100%" }}
                            />
                        </div>
                    )}
                </Section>

                {/* SHADOW & EFFECTS */}
                <Section id="fx" label="Sombreado y Opacidad" icon={Layers} activeAccordion={activeAccordion} setActiveAccordion={setActiveAccordion}>
                    <div style={{ marginBottom: 12 }}>
                        <label style={{ fontSize: "10px", fontWeight: 700, color: "#94a3b8", display: "block", marginBottom: 6 }}>INTENSIDAD DE SOMBRA</label>
                        <input
                            type="range" min="0" max="50"
                            value={localShadow}
                            onChange={(e) => {
                                const val = parseInt(e.target.value);
                                setLocalShadow(val);
                                handleStyle({ boxShadow: val > 0 ? `0 ${val / 2}px ${val}px rgba(0,0,0,0.2)` : 'none' });
                            }}
                            style={{ width: "100%" }}
                        />
                        <div style={{ textAlign: "right", fontSize: "10px", color: "#64748b" }}>{localShadow}px</div>
                    </div>
                </Section>
            </div>
        </div>
    );
}