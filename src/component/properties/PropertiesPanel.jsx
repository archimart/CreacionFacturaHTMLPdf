"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { 
    Type, Palette, Box, Layers, AlignLeft, AlignCenter, AlignRight, AlignJustify,
    Bold, Italic, Underline, Strikethrough, List, ListOrdered, Indent, Outdent,
    BarChart3, Activity, PieChart, Filter, Trash2, ArrowUpDown, LayoutTemplate,
    AlignStartVertical, AlignCenterVertical, AlignEndVertical, CaseUpper, Database, QrCode, Zap, Repeat
} from 'lucide-react';

const fonts = ["Outfit", "Inter", "Roboto", "Open Sans", "Lato", "Montserrat", "Playfair Display", "Dancing Script"];
const colors = ["transparent", "#000000", "#ffffff", "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#6366f1", "#8b5cf6", "#ec4899", "#64748b"];
const borderStyles = ["none", "solid", "dashed", "dotted", "double"];

const Section = ({ id, label, icon: Icon, children, activeAccordion, setActiveAccordion }) => {
    const isOpen = activeAccordion === id;
    return (
        <div style={{ borderBottom: "1px solid var(--panel-border)" }}>
            <button
                onClick={() => setActiveAccordion(isOpen ? null : id)}
                style={{
                    width: "100%", padding: "16px", display: "flex", alignItems: "center", justifyContent: "space-between",
                    background: "none", border: "none", cursor: "pointer", color: "var(--node-text)", transition: "all 0.2s"
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ padding: 8, background: isOpen ? "rgba(59, 130, 246, 0.1)" : "var(--editor-sidebar)", borderRadius: 10, color: isOpen ? "#3b82f6" : "var(--node-desc)" }}>
                        <Icon size={18} />
                    </div>
                    <span style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</span>
                </div>
                <div style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.3s", color: "var(--node-desc)" }}>▼</div>
            </button>
            <div style={{ maxHeight: isOpen ? "2000px" : "0", overflow: "hidden", transition: "all 0.4s ease-in-out", background: isOpen ? "rgba(0,0,0,0.01)" : "transparent" }}>
                <div style={{ padding: "0 16px 20px 16px" }}>{children}</div>
            </div>
        </div>
    );
};

export default function PropertiesPanel({ el, elements = [], onChange, dataset = [], selectedCells = [], onJoinCells, onSplitCells }) {
    const [activeAccordion, setActiveAccordion] = useState("chart");
    const [localSize, setLocalSize] = useState(14);
    const [localShadow, setLocalShadow] = useState(0);
    const [chartTarget, setChartTarget] = useState('global'); // global, title, labels
    // Save the selection before a button click steals focus
    const savedSelectionRef = useRef(null);

    const s = el?.style || {};
    const isLogic = el?.type && el.type.startsWith('logical-');

    // Save current selection whenever user interacts with the editor
    const saveSelection = useCallback(() => {
        if (!el?.id) return;
        const sel = window.getSelection();
        const activeNode = document.querySelector(`[data-id="${el.id}"]`) || window.__LAST_EDITABLE_REF__;
        if (sel && sel.rangeCount > 0 && activeNode && activeNode.contains(sel.anchorNode)) {
            savedSelectionRef.current = sel.getRangeAt(0).cloneRange();
        }
    }, [el?.id]);

    useEffect(() => {
        if (!el?.id) return;
        // More aggressive selection preservation: update ref whenever selection changes
        const autoSave = () => {
             const sel = window.getSelection();
             const activeNode = document.querySelector(`[data-id="${el.id}"]`) || window.__LAST_EDITABLE_REF__;
             if (sel && sel.rangeCount > 0 && activeNode && activeNode.contains(sel.anchorNode)) {
                 savedSelectionRef.current = sel.getRangeAt(0).cloneRange();
             }
        };
        document.addEventListener('selectionchange', autoSave);
        return () => document.removeEventListener('selectionchange', autoSave);
    }, [el?.id]);

    useEffect(() => {
        if (!el) return;
        if (s.fontSize) setLocalSize(parseInt(s.fontSize));
        if (s.boxShadow && s.boxShadow !== 'none') {
            const match = s.boxShadow.match(/(\d+)px/);
            if (match) setLocalShadow(parseInt(match[1]));
        }
    }, [el?.id, s.fontSize, s.boxShadow]);

    if (!el) return <div style={{ width: 320, padding: 40, textAlign: 'center', color: 'var(--node-desc)', fontSize: '12px' }}>Selecciona un elemento para editar</div>;

    const handleStyle = (patch) => {
        if (el.type === 'chart') {
            if (chartTarget === 'title') {
                const c = { ...(el.chart || {}) };
                if (patch.fontFamily) c.titleFont = patch.fontFamily;
                if (patch.fontSize) c.titleSize = parseInt(patch.fontSize);
                if (patch.color) c.titleColor = patch.color;
                onChange?.({ chart: c });
                return;
            } else if (chartTarget === 'labels') {
                const c = { ...(el.chart || {}) };
                if (patch.fontFamily) c.labelFont = patch.fontFamily;
                if (patch.fontSize) c.labelSize = parseInt(patch.fontSize);
                if (patch.color) c.labelColor = patch.color;
                onChange?.({ chart: c });
                return;
            } else if (chartTarget === 'bars') {
                const c = { ...(el.chart || {}) };
                if (patch.color) {
                    c.datasets = [...(c.datasets || [{ data: [] }])];
                    c.datasets[0] = { ...c.datasets[0], color: patch.color };
                    // If user changes global bar color, we can also clear itemColors to make it uniform if they prefer, 
                    // but for now we just update the primary color.
                }
                onChange?.({ chart: c });
                return;
            }
        }
        onChange?.({ style: { ...s, ...patch } });
    };

    const handleUpdate = (patch) => onChange?.(patch);

    const getFormatState = () => {
        if (el?.type === 'chart') {
            const c = el.chart || {};
            if (chartTarget === 'title') {
                return {
                    bold: !!c.titleBold,
                    italic: !!c.titleItalic,
                    align: c.titleAlign || 'center',
                    underline: (c.titleDecoration || "").includes('underline'),
                    strike: (c.titleDecoration || "").includes('line-through')
                };
            }
            if (chartTarget === 'labels') {
                return { 
                    bold: !!c.labelBold, 
                    italic: !!c.labelItalic, 
                    underline: (c.labelDecoration || "").includes('underline') 
                };
            }
        }

        // --- TIER 1: Use queryCommandState when the element has active focus ---
        const activeNode = document.querySelector(`[data-id="${el.id}"]`) || window.__LAST_EDITABLE_REF__;

        const sel = window.getSelection();
        const hasFocus = activeNode && document.activeElement === activeNode;
        const selInNode = sel.rangeCount > 0 && activeNode?.contains(sel.getRangeAt(0)?.commonAncestorContainer);

        if (hasFocus || selInNode) {
            // Browser APIs work accurately when element has focus
            const nodeAtCaret = sel.rangeCount > 0 
                ? (sel.anchorNode?.nodeType === 3 ? sel.anchorNode.parentElement : sel.anchorNode) 
                : activeNode;
            const comp = nodeAtCaret ? window.getComputedStyle(nodeAtCaret) : null;
            
            let activeAlign = 'left';
            try {
                if (document.queryCommandState("justifyCenter")) activeAlign = 'center';
                else if (document.queryCommandState("justifyRight")) activeAlign = 'right';
                else if (document.queryCommandState("justifyFull")) activeAlign = 'justify';
                else if (comp) {
                    const ta = comp.textAlign || '';
                    if (ta.includes('center')) activeAlign = 'center';
                    else if (ta.includes('right')) activeAlign = 'right';
                    else if (ta.includes('justify')) activeAlign = 'justify';
                }
            } catch(e) {}

            return {
                bold: document.queryCommandState("bold") || parseInt(comp?.fontWeight || 0) >= 600,
                italic: document.queryCommandState("italic") || comp?.fontStyle === 'italic',
                underline: document.queryCommandState("underline") || (comp?.textDecoration || '').includes('underline') || (s.textDecoration || '').includes('underline'),
                strike: document.queryCommandState("strikeThrough") || (comp?.textDecoration || '').includes('line-through'),
                align: activeAlign,
                bullet: document.queryCommandState("insertUnorderedList"),
                number: document.queryCommandState("insertOrderedList"),
            };
        }

        // --- TIER 2: Read the DOM node's computed style directly (no focus needed) ---
        if (activeNode?.isConnected) {
            const comp = window.getComputedStyle(activeNode);
            // Also check the first child element if it's a span/div
            const firstChild = activeNode.querySelector('span, div, p, b, i, strong, em');
            const childComp = firstChild ? window.getComputedStyle(firstChild) : null;
            
            const fw = childComp?.fontWeight || comp.fontWeight;
            const fs = childComp?.fontStyle || comp.fontStyle;
            const td = childComp?.textDecoration || comp.textDecoration;
            const ta = comp.textAlign || s.textAlign || 'left';
            
            let activeAlign = 'left';
            if (ta.includes('center')) activeAlign = 'center';
            else if (ta.includes('right')) activeAlign = 'right';
            else if (ta.includes('justify')) activeAlign = 'justify';

            return {
                bold: parseInt(fw) >= 600 || fw === 'bold',
                italic: fs === 'italic',
                underline: td.includes('underline') || (s.textDecoration || '').includes('underline'),
                strike: td.includes('line-through'),
                align: activeAlign,
                bullet: false,
                number: false,
            };
        }

        // --- TIER 3: Data model fallback ---
        const dec = (s.textDecoration || "").toLowerCase();
        return {
            bold: s.fontWeight === 'bold' || s.fontWeight === '700',
            italic: s.fontStyle === 'italic',
            underline: dec.includes('underline'),
            strike: dec.includes('line-through'),
            align: s.textAlign || 'left',
            bullet: false,
            number: false,
        };
    };

    const execCommand = (cmd, val = null, keepFocus = null) => {
        if (el?.type === 'chart') {
            const bc = { ...(el.chart || {}) };
            if (chartTarget === 'title') {
                if (cmd === 'bold') bc.titleBold = !bc.titleBold;
                if (cmd === 'italic') bc.titleItalic = !bc.titleItalic;
                if (cmd === 'foreColor') bc.titleColor = val;
                if (cmd === 'fontName') bc.titleFont = val;
                if (cmd === 'fontSize') bc.titleSize = parseInt(val);
                handleUpdate({ chart: bc });
            } else if (chartTarget === 'labels') {
                if (cmd === 'bold') bc.labelBold = !bc.labelBold;
                if (cmd === 'foreColor') bc.labelColor = val;
                if (cmd === 'fontName') bc.labelFont = val;
                if (cmd === 'fontSize') bc.labelSize = parseInt(val);
                handleUpdate({ chart: bc });
            } else if (chartTarget === 'bars') {
                if (cmd === 'foreColor') {
                    bc.datasets = [...(bc.datasets || [{ data: [] }])];
                    bc.datasets[0] = { ...bc.datasets[0], color: val };
                    handleUpdate({ chart: bc });
                }
            }
            setFormatState(getFormatState());
            return;
        }
        
        let sel = window.getSelection();
        
        // Strategy 1: Use the saved ref IF it belongs to THIS element
        let activeNode = document.querySelector(`[data-id="${el.id}"]`);
        
        // Update global refs if we found it via selector
        if (activeNode) {
            window.__LAST_EDITABLE_REF__ = activeNode;
            window.__LAST_EDITABLE_ID__ = el.id;
        } else if (window.__LAST_EDITABLE_ID__ === el.id && window.__LAST_EDITABLE_REF__?.isConnected) {
            activeNode = window.__LAST_EDITABLE_REF__;
        }
        
        // Restore focus and the EXACT saved selection (cursor position / text selection)
        if (activeNode) {
            try {
                activeNode.focus();
                const currentSel = window.getSelection();
                // Prioritize exact saved selection from savedSelectionRef
                if (savedSelectionRef.current && activeNode.contains(savedSelectionRef.current.commonAncestorContainer)) {
                    currentSel.removeAllRanges();
                    currentSel.addRange(savedSelectionRef.current);
                } else if (window.__LAST_TABLE_RANGE__ && activeNode.contains(window.__LAST_TABLE_RANGE__.commonAncestorContainer)) {
                    currentSel.removeAllRanges();
                    currentSel.addRange(window.__LAST_TABLE_RANGE__);
                } else if (currentSel.rangeCount === 0 || !activeNode.contains(currentSel.anchorNode)) {
                    const range = document.createRange();
                    range.selectNodeContents(activeNode);
                    range.collapse(false);
                    currentSel.removeAllRanges();
                    currentSel.addRange(range);
                }
            } catch(e) {}
        }
        
        // RE-FETCH selection and state after focus restoration
        sel = window.getSelection();
        const hasCursorInTarget = sel.rangeCount > 0 && activeNode?.contains(sel.getRangeAt(0).commonAncestorContainer);
        const isCollapsed = sel.isCollapsed;

        const browserCmds = ['bold', 'italic', 'underline', 'strikeThrough', 'insertUnorderedList', 'insertOrderedList', 'justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull', 'fontName', 'fontSize', 'foreColor'];
        const inlineFormatCmds = ['bold', 'italic', 'underline', 'strikeThrough', 'fontName', 'fontSize', 'foreColor'];

        if (hasCursorInTarget) {
            // If no text is selected and this is an inline format command, select ALL content first
            // so the format applies visibly to the whole block (Word-like behavior)
            if (isCollapsed && inlineFormatCmds.includes(cmd)) {
                const range = document.createRange();
                range.selectNodeContents(activeNode);
                sel.removeAllRanges();
                sel.addRange(range);
            }

            if ((cmd === 'fontSize' || cmd === 'fontName') && !sel.isCollapsed) {
                const range = sel.getRangeAt(0);
                const frag = range.cloneContents();
                const tempDiv = document.createElement('div');
                tempDiv.appendChild(frag);
                const tempId = "sel-" + Math.random().toString(36).substr(2, 9);
                window.__SUPPRESS_EDITABLE_UPDATE__?.();
                
                const styleAttr = cmd === 'fontSize' ? `font-size: ${val}` : `font-family: ${val}`;
                document.execCommand('insertHTML', false, `<span id="${tempId}" style="${styleAttr}">${tempDiv.innerHTML}</span>`);
                
                const inserted = document.getElementById(tempId);
                if (inserted) {
                    const newRange = document.createRange();
                    newRange.selectNodeContents(inserted);
                    window.getSelection().removeAllRanges();
                    window.getSelection().addRange(newRange);
                    // Update the saved ref so the next "step" of the input works on the same text
                    savedSelectionRef.current = newRange.cloneRange();
                    inserted.removeAttribute('id');
                }
             } else if (cmd === 'uppercase') {
                const range = sel.getRangeAt(0);
                const frag = range.cloneContents();
                const tempDiv = document.createElement('div');
                tempDiv.appendChild(frag);
                const html = tempDiv.innerHTML.toLowerCase();
                const isUpper = html.includes('text-transform: uppercase') || html.includes('text-transform:uppercase');
                window.__SUPPRESS_EDITABLE_UPDATE__?.();
                document.execCommand('insertHTML', false, `<span style="text-transform: ${isUpper ? 'none' : 'uppercase'}">${tempDiv.innerHTML}</span>`);
                // Update saved selection after insertHTML
                const newSel = window.getSelection();
                if (newSel.rangeCount > 0) savedSelectionRef.current = newSel.getRangeAt(0).cloneRange();
             } else {
                // Signal React to NOT overwrite the innerHTML on the next render cycle
                window.__SUPPRESS_EDITABLE_UPDATE__?.();
                document.execCommand(cmd, false, val);
                // Update saved selection after generic command
                const newSel = window.getSelection();
                if (newSel.rangeCount > 0) savedSelectionRef.current = newSel.getRangeAt(0).cloneRange();
             }
             
             // Pure HTML update. No global style syncing should happen here!
             if (activeNode) handleUpdate({ text: activeNode.innerHTML });

             // RESTORE FOCUS to the input if requested (allows clicking stepper multiple times)
             if (keepFocus && keepFocus.focus) {
                 setTimeout(() => keepFocus.focus(), 0);
             }
        } else {
            // FALLBACK TO BLOCK STYLE (no cursor found in target node at all)
            const stylePatch = {};
            if (cmd === 'bold') stylePatch.fontWeight = s.fontWeight === 'bold' ? 'normal' : 'bold';
            if (cmd === 'italic') stylePatch.fontStyle = s.fontStyle === 'italic' ? 'normal' : 'italic';
            if (cmd === 'underline' || cmd === 'strikeThrough') {
                let current = s.textDecoration || 'none';
                let decorations = current.split(' ').filter(d => d !== 'none');
                const target = cmd === 'underline' ? 'underline' : 'line-through';
                if (decorations.includes(target)) decorations = decorations.filter(d => d !== target);
                else decorations.push(target);
                stylePatch.textDecoration = decorations.length > 0 ? decorations.join(' ') : 'none';
            }
            if (cmd === 'uppercase') stylePatch.textTransform = s.textTransform === 'uppercase' ? 'none' : 'uppercase';
            if (cmd === 'foreColor') stylePatch.color = val;
            if (cmd === 'fontName') stylePatch.fontFamily = val;
            if (cmd === 'fontSize') stylePatch.fontSize = val;
            
            if (cmd === 'justifyLeft') stylePatch.textAlign = 'left';
            if (cmd === 'justifyCenter') stylePatch.textAlign = 'center';
            if (cmd === 'justifyRight') stylePatch.textAlign = 'right';
            if (cmd === 'justifyFull') stylePatch.textAlign = 'justify';
            
            const finalUpdate = { style: { ...s, ...stylePatch } };
            if (activeNode) finalUpdate.text = activeNode.innerHTML;
            handleUpdate(finalUpdate);
        }
        setFormatState(getFormatState());
    };

    const [formatState, setFormatState] = useState(getFormatState());
    
    // Sync format state: listen to selectionchange + poll every 200ms for when focus is temporarily lost
    useEffect(() => {
        const syncUI = () => setFormatState(getFormatState());
        document.addEventListener('selectionchange', syncUI);
        document.addEventListener('keyup', syncUI);
        // Poll so alignment/italic buttons update even when editor briefly loses focus
        const interval = setInterval(syncUI, 200);
        syncUI();
        return () => {
            document.removeEventListener('selectionchange', syncUI);
            document.removeEventListener('keyup', syncUI);
            clearInterval(interval);
        };
    }, [el.id, el.style, el.text, chartTarget, activeAccordion]);

    const ActionButton = ({ cmd, icon: Icon, active, label }) => (
        <button
            onMouseDown={(e) => { e.preventDefault(); saveSelection(); }}
            onClick={() => execCommand(cmd)}
            style={{
                width: 34, height: 34, borderRadius: 8, 
                border: active ? "2px solid #3b82f6" : "1px solid var(--panel-border)",
                background: active ? "#3b82f6" : "var(--panel-bg)",
                color: active ? "#ffffff" : "var(--node-text)", 
                cursor: "pointer", transition: "all 0.1s ease",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: active ? "0 6px 16px rgba(59, 130, 246, 0.4)" : "none",
                transform: active ? "scale(1.05)" : "scale(1)"
            }}
            title={label}
        >
            <Icon size={16} />
        </button>
    );

    return (
        <div style={{ 
            width: 320, height: "100%", background: "var(--panel-bg)", 
            borderLeftWidth: "1px", borderLeftStyle: "solid", borderLeftColor: "var(--panel-border)", 
            display: "flex", flexDirection: "column", boxShadow: "-4px 0 20px rgba(0,0,0,0.05)", zIndex: 100 
        }}>
            <div style={{ padding: "20px", borderBottomWidth: "1px", borderBottomStyle: "solid", borderBottomColor: "var(--panel-border)", background: "var(--editor-sidebar)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#3b82f6" }} />
                    <h2 style={{ fontSize: "14px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "1px", margin: 0, color: "var(--node-text)" }}>Propiedades</h2>
                </div>
                <p style={{ fontSize: "10px", color: "var(--node-desc)", margin: 0, fontWeight: 600 }}>{(String(el.type || 'elemento')).toUpperCase()} - {String(el.id || '').split('-')[0]}</p>
            </div>

            <div style={{ flex: 1, overflowY: "auto" }}>
                {isLogic && (
                    <Section id="logic" label="Lógica y Visibilidad" icon={Zap} activeAccordion={activeAccordion} setActiveAccordion={setActiveAccordion}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "8px 0" }}>
                        {(el.type === 'logical-if' || el.type === 'logical-else-if') && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '16px', borderRadius: 12, background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)' }}>
                                <div style={{ fontSize: '10px', fontWeight: 900, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Regla de Condición</div>
                                
                                <textarea 
                                    value={el.logic?.condition || ""}
                                    onChange={(e) => handleUpdate({ logic: { ...el.logic, condition: e.target.value } })}
                                    placeholder="ej: TOTAL > 1000"
                                    style={{ 
                                        width: '100%', minHeight: 60, padding: 10, borderRadius: 8, border: '1px solid rgba(16,185,129,0.3)', 
                                        fontSize: '13px', fontFamily: 'monospace', outline: 'none', background: 'white'
                                    }}
                                />

                                <div style={{ display: 'flex', gap: 6 }}>
                                    {[
                                        { label: '==', val: ' === ' },
                                        { label: '≠', val: ' !== ' },
                                        { label: 'CONTIENE', val: ".includes('')" },
                                        { label: '>', val: ' > ' },
                                        { label: '<', val: ' < ' }
                                    ].map(op => (
                                        <button 
                                            key={op.label}
                                            onClick={() => handleUpdate({ logic: { ...el.logic, condition: (el.logic?.condition || "") + op.val } })}
                                            style={{ padding: '4px 6px', fontSize: '9px', fontWeight: 900, background: 'white', border: '1px solid #10b981', color: '#10b981', borderRadius: 6, cursor: 'pointer' }}
                                        >{op.label}</button>
                                    ))}
                                </div>

                                <div style={{ height: '1px', background: 'rgba(16,185,129,0.2)', margin: '4px 0' }} />
                                
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <div style={{ fontSize: '9px', fontWeight: 900, color: '#059669' }}>GESTIÓN DE HIJOS (OBJETOS EN ESTA RAMA):</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: '120px', overflowY: 'auto' }}>
                                        {elements.filter(it => it.parentId === el.id).map(child => (
                                            <div key={child.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'white', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '11px' }}>
                                                <span>{elements.find(e => e.id === child.id)?.type?.toUpperCase()} - {child.id.split('-')[0]}</span>
                                                <button onClick={() => onChange?.({ parentId: null }, child.id)} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 900 }}>✕</button>
                                            </div>
                                        ))}
                                        {elements.filter(it => it.parentId === el.id).length === 0 && (
                                            <div style={{ fontSize: '10px', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center' }}>Vacío. Arrastra objetos aquí en la lista "Orden".</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Removed CONEXIÓN LÓGICA - it's now managed in the Sidebar */}

                        {el.type === 'logical-else' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '16px', borderRadius: 12, background: 'rgba(100,116,139,0.05)', border: '1px solid rgba(100,116,139,0.2)' }}>
                                <div style={{ fontSize: '10px', fontWeight: 900, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Regla de Fallback (SINO)</div>
                                <div style={{ fontSize: '11px', color: '#64748b' }}>Este bloque se ejecutará si ninguna de las condiciones anteriores se cumple.</div>

                                <div style={{ height: '1px', background: 'rgba(100,116,139,0.2)', margin: '4px 0' }} />

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <div style={{ fontSize: '9px', fontWeight: 900, color: '#475569' }}>GESTIÓN DE HIJOS (OBJETOS EN ESTA RAMA):</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: '120px', overflowY: 'auto' }}>
                                        {elements.filter(it => it.parentId === el.id).map(child => (
                                            <div key={child.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'white', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '11px' }}>
                                                <span>{child.label || child.type}</span>
                                                <button onClick={() => onUpdateElement(child.id, { parentId: null })} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 900 }}>✕</button>
                                            </div>
                                        ))}
                                        {elements.filter(it => it.parentId === el.id).length === 0 && (
                                            <div style={{ fontSize: '10px', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center' }}>Vacío. Arrastra objetos aquí en la lista "Orden".</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {el.type === 'logical-loop' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '16px', borderRadius: 12, background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.2)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                    <Repeat size={14} color="#7c3aed" />
                                    <div style={{ fontSize: '10px', fontWeight: 900, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Asistente de Repetición</div>
                                </div>
                                
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <label style={{ fontSize: '9px', fontWeight: 800, color: '#6d28d9' }}>¿QUÉ REPETIREMOS?</label>
                                    <select 
                                        value={el.logic?.loop?.type || "collection"}
                                        onChange={(e) => handleUpdate({ logic: { ...el.logic, loop: { ...el.logic?.loop, type: e.target.value } } })}
                                        style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid rgba(139,92,246,0.3)", fontSize: "12px", background: "white", fontWeight: 600 }}
                                    >
                                        <option value="collection">Dynamic: Desde una Lista (Datos)</option>
                                        <option value="count">Static: Una Cantidad Fija</option>
                                    </select>
                                    <p style={{ fontSize: '9px', color: '#8b5cf6', margin: 0, opacity: 0.8 }}>
                                        {el.logic?.loop?.type === 'count' 
                                            ? "Ideal para crear filas vacías o diseños repetitivos manuales."
                                            : "El bloque se duplicará por cada registro encontrado en la lista seleccionada."}
                                    </p>
                                </div>

                                {el.logic?.loop?.type === 'count' ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        <label style={{ fontSize: '9px', fontWeight: 800, color: '#6d28d9' }}>CANTIDAD DE VECES:</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <input 
                                                type="number"
                                                min="1"
                                                value={el.logic?.loop?.count || 1}
                                                onChange={(e) => handleUpdate({ logic: { ...el.logic, loop: { ...el.logic?.loop, count: Math.max(1, parseInt(e.target.value) || 1) } } })}
                                                style={{ flex: 1, padding: "10px", borderRadius: 8, border: "1px solid rgba(139,92,246,0.3)", fontSize: "12px", background: "white", textAlign: 'center', fontWeight: 'bold' }}
                                            />
                                            <div style={{ fontSize: '10px', color: '#7c3aed', fontWeight: 900 }}>REPETICIONES</div>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        <label style={{ fontSize: '9px', fontWeight: 800, color: '#6d28d9' }}>SELECCIONAR CAMPO (ARRAY):</label>
                                        <select 
                                            value={el.logic?.loop?.source || ""}
                                            onChange={(e) => handleUpdate({ logic: { ...el.logic, loop: { ...el.logic?.loop, source: e.target.value } } })}
                                            style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid rgba(139,92,246,0.3)", fontSize: "12px", background: "white" }}
                                        >
                                            <option value="">(Selecciona lista de datos...)</option>
                                            {dataset?.[0] && Object.keys(dataset[0]).map(key => (
                                                Array.isArray(dataset[0][key]) && <option key={key} value={key}>Lista: {key} ({dataset[0][key].length} ítems)</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <label style={{ fontSize: '9px', fontWeight: 800, color: '#6d28d9' }}>SALTO / ESPACIADO VERTICAL (PX):</label>
                                    <input 
                                        type="number"
                                        value={el.logic?.loop?.spacing || 20}
                                        onChange={(e) => handleUpdate({ logic: { ...el.logic, loop: { ...el.logic?.loop, spacing: parseInt(e.target.value) || 0 } } })}
                                        style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid rgba(139,92,246,0.3)", fontSize: "12px", background: "white" }}
                                    />
                                </div>

                                <div style={{ height: '1px', background: 'rgba(139,92,246,0.2)', margin: '4px 0' }} />

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <div style={{ fontSize: '9px', fontWeight: 900, color: '#6d28d9' }}>OBJETOS REPETITIVOS (HIJOS):</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: '150px', overflowY: 'auto' }}>
                                        {elements.filter(it => it.parentId === el.id).map(child => (
                                            <div key={child.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'white', borderRadius: 10, border: '1px solid rgba(139,92,246,0.1)', fontSize: '11px', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#7c3aed' }} />
                                                    <span style={{ fontWeight: 600 }}>{child.label || child.type.toUpperCase()}</span>
                                                </div>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); onUpdateElement(child.id, { parentId: null }); }} 
                                                    style={{ border: 'none', background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '4px 8px', borderRadius: 6, cursor: 'pointer', fontWeight: 900, fontSize: '10px' }}
                                                >✕</button>
                                            </div>
                                        ))}
                                        {elements.filter(it => it.parentId === el.id).length === 0 && (
                                            <div style={{ fontSize: '10px', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', padding: '10px', border: '2px dashed rgba(139,92,246,0.1)', borderRadius: 10 }}>
                                                Sin objetos. Arrastra Texto o Imágenes aquí desde la pestaña "ORDEN".
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {!el.type.startsWith('logical-') && (
                            <div style={{ fontSize: '10px', color: '#94a3b8', textAlign: 'center', padding: '10px' }}>
                                Este objeto no es una condición lógica. Úsalo dentro de un bloque SÍ/SINO para condicionarlo.
                            </div>
                        )}
                    </div>
                </Section>
                )}
                {el.type === 'barcode' && (
                    <Section id="barcode" label="Código de Barras / QR" icon={QrCode} activeAccordion={activeAccordion} setActiveAccordion={setActiveAccordion}>
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ fontSize: "10px", fontWeight: 700, color: "var(--node-desc)", display: "block", marginBottom: 6 }}>FORMATO DE CÓDIGO</label>
                            <select 
                                value={el.barcode?.type || 'qrcode'} 
                                onChange={(e) => handleUpdate({ barcode: { ...(el.barcode || {}), type: e.target.value } })}
                                style={{ width: "100%", padding: "10px", borderRadius: 10, border: "1px solid var(--panel-border)", fontSize: "12px", background: "var(--input-bg)", color: "var(--input-text)" }}
                            >
                                <option value="qrcode">QR CODE</option>
                                <option value="code128">CODE 128 (ESTÁNDAR)</option>
                                <option value="ean13">EAN-13 (PRODUCTOS)</option>
                                <option value="code39">CODE 39</option>
                                <option value="pdf417">PDF417</option>
                                <option value="datamatrix">DATA MATRIX</option>
                            </select>
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ fontSize: "10px", fontWeight: 700, color: "var(--node-desc)", display: "block", marginBottom: 6 }}>TEXTO O CAMPO DINÁMICO</label>
                            <input 
                                type="text" 
                                value={el.text || ""} 
                                onChange={(e) => onChange?.({ text: e.target.value })}
                                placeholder="Ej: {{ID_FACTURA}} o URL"
                                style={{ width: "100%", padding: "10px", borderRadius: 10, border: "1px solid var(--panel-border)", fontSize: "12px", background: "var(--input-bg)", color: "var(--input-text)" }}
                            />
                            <div style={{ fontSize: 9, color: "#64748b", marginTop: 4 }}>Usa {'{{'}NombreCampo{'}}'} para datos dinámicos</div>
                        </div>
                        {el.barcode?.type !== 'qrcode' && (
                            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "10px", fontWeight: 700, cursor: "pointer", color: "var(--node-text)" }}>
                                <input 
                                    type="checkbox" 
                                    checked={el.barcode?.includeText || false} 
                                    onChange={(e) => handleUpdate({ barcode: { ...(el.barcode || {}), includeText: e.target.checked } })}
                                /> MOSTRAR TEXTO ABAJO
                            </label>
                        )}
                    </Section>
                )}
                {el.type === 'chart' && (
                    <Section id="chart" label="Configuración de Gráfica" icon={BarChart3} activeAccordion={activeAccordion} setActiveAccordion={setActiveAccordion}>
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ fontSize: "10px", fontWeight: 700, color: "var(--node-desc)", display: "block", marginBottom: 6 }}>TÍTULO DE LA GRÁFICA</label>
                            <input 
                                type="text" value={el.label || "Gráfica"} 
                                onChange={(e) => onChange?.({ label: e.target.value })}
                                style={{ width: "100%", padding: "10px", borderRadius: 10, border: "1px solid var(--panel-border)", fontSize: "12px", background: "var(--input-bg)", color: "var(--input-text)", marginBottom: 10 }}
                            />
                        </div>

                        <div style={{ marginBottom: 16 }}>
                            <label style={{ fontSize: "10px", fontWeight: 700, color: "var(--node-desc)", display: "block", marginBottom: 6 }}>TIPO DE GRÁFICA</label>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                                {[
                                    { id: 'bar', icon: BarChart3, label: 'Barras' }, { id: 'bar3d', icon: BarChart3, label: 'Barras 3D' },
                                    { id: 'line', icon: Activity, label: 'Línea' }, { id: 'area', icon: LayoutTemplate, label: 'Área' },
                                    { id: 'stepline', icon: Activity, label: 'Escalón' }, { id: 'pie', icon: PieChart, label: 'Pastel' },
                                    { id: 'pie3d', icon: PieChart, label: 'Pastel 3D' }, { id: 'donut', icon: PieChart, label: 'Donut' },
                                    { id: 'radar', icon: Activity, label: 'Radar' }, { id: 'funnel', icon: Filter, label: 'Embudo' },
                                    { id: 'polar', icon: PieChart, label: 'Polar' }
                                ].map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => handleUpdate({ chart: { ...(el.chart || {}), type: t.id } })}
                                        style={{
                                            padding: "8px", borderRadius: 10, border: (el.chart?.type || 'bar') === t.id ? "2px solid #3b82f6" : "1px solid var(--panel-border)",
                                            background: (el.chart?.type || 'bar') === t.id ? "rgba(59,130,246,0.1)" : "var(--panel-bg)",
                                            display: "flex", flexDirection: "column", alignItems: "center", gap: 5, cursor: "pointer",
                                            color: (el.chart?.type || 'bar') === t.id ? "#3b82f6" : "var(--node-text)", transition: "all 0.2s"
                                        }}
                                    >
                                        <t.icon size={16} />
                                        <span style={{ fontSize: '8px', fontWeight: 900 }}>{t.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div style={{ marginBottom: 12 }}>
                            <label style={{ fontSize: "10px", fontWeight: 700, color: "var(--node-desc)", display: "block", marginBottom: 6 }}>ORIGEN DE DATOS</label>
                            <div style={{ display: "flex", gap: 4, background: "var(--editor-sidebar)", padding: 4, borderRadius: 10, marginBottom: 10 }}>
                                {['dynamic', 'static'].map(m => (
                                    <button
                                        key={m}
                                        onClick={() => handleUpdate({ chart: { ...(el.chart || {}), dataSource: m } })}
                                        style={{
                                            flex: 1, padding: "8px 4px", fontSize: "9px", fontWeight: 900, borderRadius: 8, border: "none",
                                            background: (el.chart?.dataSource || 'dynamic') === m ? "#3b82f6" : "transparent",
                                            color: (el.chart?.dataSource || 'dynamic') === m ? "white" : "var(--node-desc)",
                                            cursor: "pointer", transition: "all 0.2s"
                                        }}
                                    >
                                        {m === 'dynamic' ? 'AUTOMÁTICO' : 'MANUAL'}
                                    </button>
                                ))}
                            </div>

                            {(el.chart?.dataSource || 'dynamic') === 'dynamic' ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                    <div>
                                        <label style={{ fontSize: "9px", fontWeight: 700, color: "var(--node-desc)", display: "block", marginBottom: 4 }}>COLECCIÓN (OPCIONAL)</label>
                                        <select
                                            value={el.chart?.mapping?.collectionField || ""}
                                            onChange={(e) => handleUpdate({ chart: { ...(el.chart || {}), mapping: { ...(el.chart?.mapping || {}), collectionField: e.target.value } } })}
                                            style={{ width: "100%", padding: "8px", borderRadius: 8, border: "1px solid var(--panel-border)", fontSize: "11px", background: "var(--input-bg)", color: "var(--input-text)" }}
                                        >
                                            <option value="">(Raíz del registro)</option>
                                            {Object.entries(dataset[0] || {}).filter(([_,v]) => Array.isArray(v)).map(([k, v]) => <option key={k} value={k}>{k.toUpperCase()} (Colección)</option>)}
                                        </select>
                                    </div>

                                    {(() => {
                                        const mapping = el.chart?.mapping || {};
                                        let fields = [];
                                        let subData = [];
                                        if (mapping.collectionField && dataset[0]?.[mapping.collectionField]) {
                                            subData = dataset[0][mapping.collectionField];
                                            fields = Object.keys((Array.isArray(subData) ? subData[0] : subData) || {});
                                        } else {
                                            subData = dataset;
                                            fields = Object.keys(dataset[0] || {});
                                        }

                                        const hasData = mapping.labelField && mapping.dataField;

                                        return (
                                            <>
                                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                                    <div>
                                                        <label style={{ fontSize: "9px", fontWeight: 700, color: "var(--node-desc)", display: "block", marginBottom: 4 }}>ETIQUETA (EJE X)</label>
                                                        <select
                                                            value={mapping.labelField || ""}
                                                            onChange={(e) => handleUpdate({ chart: { ...(el.chart || {}), mapping: { ...mapping, labelField: e.target.value } } })}
                                                            style={{ width: "100%", padding: "8px", borderRadius: 8, border: mapping.labelField ? "1px solid #3b82f6" : "1px solid var(--panel-border)", fontSize: "10px", background: "var(--input-bg)", color: "var(--input-text)" }}
                                                        >
                                                            <option value="">(Seleccionar)</option>
                                                            {fields.map(f => <option key={f} value={f}>{f.toUpperCase()}</option>)}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label style={{ fontSize: "9px", fontWeight: 700, color: "var(--node-desc)", display: "block", marginBottom: 4 }}>DATO (VALOR)</label>
                                                        <select
                                                            value={mapping.dataField || ""}
                                                            onChange={(e) => handleUpdate({ chart: { ...(el.chart || {}), mapping: { ...mapping, dataField: e.target.value } } })}
                                                            style={{ width: "100%", padding: "8px", borderRadius: 8, border: mapping.dataField ? "1px solid #10b981" : "1px solid var(--panel-border)", fontSize: "10px", background: "var(--input-bg)", color: "var(--input-text)" }}
                                                        >
                                                            <option value="">(Seleccionar)</option>
                                                            {fields.map(f => <option key={f} value={f}>{f.toUpperCase()}</option>)}
                                                        </select>
                                                    </div>
                                                </div>
                                                {hasData && (
                                                    <div style={{ fontSize: 9, fontWeight: 800, color: '#10b981', background: 'rgba(16,185,129,0.05)', padding: '6px 10px', borderRadius: 8, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
                                                        MAPEO ACTIVO: {mapping.labelField} → {mapping.dataField}
                                                    </div>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                    <button onClick={() => handleUpdate({ chart: { ...(el.chart || {}), labels: [], datasets: [{ data: [] }] } })} style={{ color: "#ef4444", fontSize: 9, fontWeight: 800, cursor: "pointer", background: "none", border: "none", alignSelf: "flex-end" }}>LIMPIAR TODO</button>
                                    {Array.from({ length: 12 }).map((_, i) => (
                                        <div key={i} style={{ display: "flex", gap: 4 }}>
                                            <input type="text" placeholder={`Etiqueta ${i+1}`} value={(el.chart?.labels || [])[i] || ""} onChange={e => { const nl = [...(el.chart?.labels || [])]; nl[i] = e.target.value; handleUpdate({ chart: { ...el.chart, labels: nl } }); }} style={{ flex: 2, padding: 6, borderRadius: 6, border: "1px solid var(--panel-border)", fontSize: 10 }} />
                                            <input type="number" placeholder="Valor" value={(el.chart?.datasets?.[0]?.data || [])[i] || 0} onChange={e => { const nd = [...(el.chart?.datasets?.[0]?.data || [])]; nd[i] = parseFloat(e.target.value) || 0; const dss = [...(el.chart?.datasets || [{ data: [] }])]; dss[0] = { ...dss[0], data: nd }; handleUpdate({ chart: { ...el.chart, datasets: dss } }); }} style={{ flex: 1, padding: 6, borderRadius: 6, border: "1px solid var(--panel-border)", fontSize: 10 }} />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </Section>
                )}

                {el.type === 'table' && (
                    <Section id="table" label="Configuración de Tabla" icon={LayoutTemplate} activeAccordion={activeAccordion} setActiveAccordion={setActiveAccordion}>
                        <div style={{ marginBottom: 12 }}>
                            <label style={{ fontSize: "10px", fontWeight: 700, color: "var(--node-desc)", display: "block", marginBottom: 6 }}>ORIGEN DE DATOS</label>
                            <div style={{ display: "flex", gap: 4, background: "var(--editor-sidebar)", padding: 4, borderRadius: 10, marginBottom: 10 }}>
                                {['dynamic', 'static'].map(m => (
                                    <button
                                        key={m}
                                        onClick={() => handleUpdate({ table: { ...(el.table || {}), dataSource: m } })}
                                        style={{
                                            flex: 1, padding: "8px 4px", fontSize: "9px", fontWeight: 900, borderRadius: 8, border: "none",
                                            background: (el.table?.dataSource || 'static') === m ? "#3b82f6" : "transparent",
                                            color: (el.table?.dataSource || 'static') === m ? "white" : "var(--node-desc)",
                                            cursor: "pointer", transition: "all 0.2s"
                                        }}
                                    >
                                        {m === 'dynamic' ? 'AUTOMÁTICO' : 'MANUAL'}
                                    </button>
                                ))}
                            </div>
                            {(el.table?.dataSource || 'static') === 'dynamic' ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                    <label style={{ fontSize: "9px", fontWeight: 800, color: "var(--node-desc)" }}>COLECCIÓN DE DATOS:</label>
                                    <select
                                        value={el.table?.collectionField || ""}
                                        onChange={(e) => handleUpdate({ table: { ...(el.table || {}), collectionField: e.target.value } })}
                                        style={{ width: "100%", padding: "10px", borderRadius: 10, border: "1px solid var(--panel-border)", fontSize: "12px", background: "var(--input-bg)", color: "var(--input-text)" }}
                                    >
                                        <option value="">RAÍZ (DATOS REPETIDOS)</option>
                                        {Object.entries(dataset[0] || {}).filter(([_,v]) => Array.isArray(v)).map(([k, v]) => <option key={k} value={k}>{k.toUpperCase()} (COLECCIÓN)</option>)}
                                    </select>
                                    {(() => {
                                        const ds = dataset || [];
                                        const field = el.table?.collectionField;
                                        const count = field ? (Array.isArray(ds[0]?.[field]) ? ds[0][field].length : 0) : ds.length;
                                        return (
                                            <div style={{ fontSize: 9, fontWeight: 800, color: count > 0 ? "#10b981" : "#ef4444", marginTop: -2, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <div style={{ width: 6, height: 6, borderRadius: '50%', background: count > 0 ? "#10b981" : "#ef4444" }} />
                                                {count > 0 ? `${count.toLocaleString()} REGISTROS ENCONTRADOS` : "COLECCIÓN VACÍA O NO ENCONTRADA"}
                                            </div>
                                        );
                                    })()}
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                        <div>
                                            <label style={{ fontSize: "9px", fontWeight: 800, color: "var(--node-desc)", display: "block", marginBottom: 4 }}>FILAS CABECERA:</label>
                                            <input type="number" min="0" max="5" value={el.table?.headerRows ?? 1} onChange={e => handleUpdate({ table: { ...(el.table || {}), headerRows: parseInt(e.target.value) || 0 } })} style={{ width: "100%", padding: "8px", borderRadius: 8, border: "1px solid var(--panel-border)", fontSize: "11px", background: "var(--input-bg)", color: "var(--input-text)" }} />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: "9px", fontWeight: 800, color: "var(--node-desc)", display: "block", marginBottom: 4 }}>FILAS PIE:</label>
                                            <input type="number" min="0" max="5" value={el.table?.footerRows ?? 1} onChange={e => handleUpdate({ table: { ...(el.table || {}), footerRows: parseInt(e.target.value) || 0 } })} style={{ width: "100%", padding: "8px", borderRadius: 8, border: "1px solid var(--panel-border)", fontSize: "11px", background: "var(--input-bg)", color: "var(--input-text)" }} />
                                        </div>
                                    </div>

                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                                        <div>
                                            <label style={{ fontSize: "9px", fontWeight: 800, color: "var(--node-desc)", display: "block", marginBottom: 4 }}>FILAS TOTALES:</label>
                                            <input type="number" min="1" max="100" value={el.table?.rows || 1} onChange={e => {
                                                const val = parseInt(e.target.value);
                                                if (val > 0) handleUpdate({ table: { ...(el.table || {}), rows: val } });
                                            }} style={{ width: "100%", padding: "8px", borderRadius: 8, border: "1px solid var(--panel-border)", fontSize: "11px", background: "var(--input-bg)", color: "var(--input-text)" }} />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: "9px", fontWeight: 800, color: "var(--node-desc)", display: "block", marginBottom: 4 }}>COLUMNAS:</label>
                                            <input type="number" min="1" max="20" value={el.table?.cols || 1} onChange={e => {
                                                const val = parseInt(e.target.value);
                                                if (val > 0) handleUpdate({ table: { ...(el.table || {}), cols: val } });
                                            }} style={{ width: "100%", padding: "8px", borderRadius: 8, border: "1px solid var(--panel-border)", fontSize: "11px", background: "var(--input-bg)", color: "var(--input-text)" }} />
                                        </div>
                                    </div>

                                    <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                                        <label style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, fontSize: "10px", fontWeight: 700, cursor: "pointer" }}>
                                            <input type="checkbox" checked={el.table?.showHeader ?? true} onChange={e => handleUpdate({ table: { ...(el.table || {}), showHeader: e.target.checked } })} /> VER CABECERA
                                        </label>
                                        <label style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, fontSize: "10px", fontWeight: 700, cursor: "pointer" }}>
                                            <input type="checkbox" checked={el.table?.showFooter ?? true} onChange={e => handleUpdate({ table: { ...(el.table || {}), showFooter: e.target.checked } })} /> VER PIE
                                        </label>
                                    </div>

                                    {selectedCells.length >= 2 && (
                                        <button 
                                            onClick={onJoinCells}
                                            style={{ marginTop: 12, width: '100%', padding: '10px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 10, fontSize: 11, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}
                                        >
                                            <Layout size={14} /> UNIR CELDAS SELECCIONADAS
                                        </button>
                                    )}

                                    {(() => {
                                        if (selectedCells.length !== 1) return null;
                                        const cell = selectedCells[0];
                                        const config = el.table?.merges?.find(m => m.r === cell.r && m.c === cell.c);
                                        if (!config) return null;
                                        return (
                                            <button 
                                                onClick={onSplitCells}
                                                style={{ marginTop: 12, width: '100%', padding: '10px', background: 'white', color: '#3b82f6', border: '2px solid #3b82f6', borderRadius: 10, fontSize: 11, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                                            >
                                                <Layers size={14} /> SEPARAR CELDAS
                                            </button>
                                        );
                                    })()}
                                </div>
                            ) : (
                                <div style={{ fontSize: 10, color: "var(--node-desc)", fontWeight: 700 }}>Para editar el contenido, haz doble clic en las celdas de la tabla.</div>
                            )}
                        </div>
                    </Section>
                )}

                <Section id="text" label="Fuente y Texto" icon={Type} activeAccordion={activeAccordion} setActiveAccordion={setActiveAccordion}>
                    {el.type === 'chart' && (
                        <div style={{ marginBottom: 16, padding: '12px', background: 'var(--panel-bg)', borderRadius: 12, border: '1px solid var(--panel-border)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
                            <span style={{ fontSize: '10px', color: 'var(--node-desc)', fontWeight: 800, display: 'block', marginBottom: 8, textTransform: 'uppercase' }}>EDITAR ESTILO DE:</span>
                            <div style={{ display: 'flex', gap: 6 }}>
                                {[{ id: 'global', label: 'Toda' }, { id: 'title', label: 'Título' }, { id: 'labels', label: 'Ejes' }, { id: 'bars', label: 'Barras' }].map(p => (
                                    <button key={p.id} onClick={() => setChartTarget(p.id)} style={{ flex: 1, padding: '8px 4px', fontSize: '9px', fontWeight: 800, borderRadius: 8, border: chartTarget === p.id ? '2px solid #3b82f6' : '1px solid var(--panel-border)', background: chartTarget === p.id ? 'rgba(59,130,246,0.1)' : 'var(--input-bg)', color: chartTarget === p.id ? '#3b82f6' : 'var(--node-text)', cursor: 'pointer' }}>{p.label}</button>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                        <select
                            value={el.type === 'chart' && chartTarget === 'title' ? (el.chart?.titleFont || s.fontFamily || "Outfit") : el.type === 'chart' && chartTarget === 'labels' ? (el.chart?.labelFont || s.fontFamily || "Outfit") : (s.fontFamily || "Outfit")}
                            onFocus={saveSelection}
                            onMouseDown={(e) => e.stopPropagation()}
                            onChange={(e) => execCommand('fontName', e.target.value, e.target)}
                            style={{ flex: 2, padding: "10px", borderRadius: 10, border: "1px solid var(--panel-border)", fontSize: "12px", background: "var(--input-bg)", color: "var(--input-text)" }}
                        >
                            {fonts.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                        <input
                            type="number" value={el.type === 'chart' && chartTarget === 'title' ? (el.chart?.titleSize || 16) : el.type === 'chart' && chartTarget === 'labels' ? (el.chart?.labelSize || 10) : localSize}
                            onFocus={saveSelection}
                            onMouseDown={(e) => e.stopPropagation()}
                            onChange={(e) => {
                                const val = e.target.value;
                                setLocalSize(val); 
                                execCommand('fontSize', val + "px", e.target);
                            }}
                            style={{ width: 60, padding: "10px", borderRadius: 10, border: "1px solid var(--panel-border)", fontSize: "12px", textAlign: "center", background: "var(--input-bg)", color: "var(--input-text)" }}
                        />
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                        <ActionButton cmd="bold" icon={Bold} active={formatState.bold} label="Negrita" />
                        <ActionButton cmd="italic" icon={Italic} active={formatState.italic} label="Cursiva" />
                        <ActionButton cmd="underline" icon={Underline} active={formatState.underline} label="Subrayado" />
                        <ActionButton cmd="strikeThrough" icon={Strikethrough} active={formatState.strike} label="Tachado" />
                        <ActionButton cmd="uppercase" icon={CaseUpper} active={s.textTransform === 'uppercase'} label="Mayúsculas" />
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                        <ActionButton cmd="justifyLeft" icon={AlignLeft} active={formatState.align === 'left'} label="Izquierda" />
                        <ActionButton cmd="justifyCenter" icon={AlignCenter} active={formatState.align === 'center'} label="Centro" />
                        <ActionButton cmd="justifyRight" icon={AlignRight} active={formatState.align === 'right'} label="Derecha" />
                        <ActionButton cmd="justifyFull" icon={AlignJustify} active={formatState.align === 'justify'} label="Justificar" />
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        <ActionButton cmd="insertUnorderedList" icon={List} active={formatState.bullet} label="Viñetas" />
                        <ActionButton cmd="insertOrderedList" icon={ListOrdered} active={formatState.number} label="Numeración" />
                        <div style={{ width: 1, background: "var(--panel-border)", margin: "0 4px" }} />
                        <ActionButton cmd="outdent" icon={Outdent} label="Reducir Sangría" />
                        <ActionButton cmd="indent" icon={Indent} label="Aumentar Sangría" />
                    </div>
                </Section>

                <Section id="layout" label="Diseño y Espaciado" icon={LayoutTemplate} activeAccordion={activeAccordion} setActiveAccordion={setActiveAccordion}>
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: "10px", fontWeight: 700, color: "var(--node-desc)", display: "block", marginBottom: 8 }}>ALINEACIÓN VERTICAL</label>
                        <div style={{ display: "flex", gap: 6 }}>
                            {[ 
                                { val: 'flex-start', icon: AlignStartVertical, l: 'Arriba' }, 
                                { val: 'center', icon: AlignCenterVertical, l: 'Centro' }, 
                                { val: 'flex-end', icon: AlignEndVertical, l: 'Abajo' } 
                            ].map(btn => (
                                <button 
                                    key={btn.val} 
                                    onClick={() => handleStyle({ justifyContent: btn.val })} 
                                    style={{ 
                                        flex: 1, height: 38, borderRadius: 10, 
                                        border: (s.justifyContent || 'flex-start') === btn.val ? "1px solid #3b82f6" : "1px solid var(--panel-border)", 
                                        background: (s.justifyContent || 'flex-start') === btn.val ? "#3b82f6" : "var(--panel-bg)", 
                                        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", 
                                        color: (s.justifyContent || 'flex-start') === btn.val ? "#ffffff" : "var(--node-text)",
                                        boxShadow: (s.justifyContent || 'flex-start') === btn.val ? "0 4px 12px rgba(59, 130, 246, 0.3)" : "none",
                                        transition: "all 0.1s ease"
                                    }} 
                                    title={btn.l}
                                >
                                    <btn.icon size={18} />
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                        <div>
                            <label style={{ fontSize: "10px", fontWeight: 700, color: "var(--node-desc)", display: "block", marginBottom: 6 }}>INTERLINEADO</label>
                            <input type="number" step="0.1" value={parseFloat(s.lineHeight) || 1.2} onChange={e => handleStyle({ lineHeight: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: 8, border: "1px solid var(--panel-border)", fontSize: "11px", background: "var(--input-bg)", color: "var(--input-text)" }} />
                        </div>
                        <div>
                            <label style={{ fontSize: "10px", fontWeight: 700, color: "var(--node-desc)", display: "block", marginBottom: 6 }}>ESPACIADO</label>
                            <input type="number" step="0.5" value={parseFloat(s.letterSpacing) || 0} onChange={e => handleStyle({ letterSpacing: e.target.value + "px" })} style={{ width: "100%", padding: "8px", borderRadius: 8, border: "1px solid var(--panel-border)", fontSize: "11px", background: "var(--input-bg)", color: "var(--input-text)" }} />
                        </div>
                    </div>

                    <div>
                        <label style={{ fontSize: "10px", fontWeight: 700, color: "var(--node-desc)", display: "block", marginBottom: 8 }}>RELLENO INTERNO (PADDING)</label>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                            {['Top', 'Right', 'Bottom', 'Left'].map(dir => (
                                <div key={dir}>
                                    <input
                                        type="number"
                                        placeholder={dir[0]}
                                        value={parseInt(s[`padding${dir}`]) || 0}
                                        onChange={(e) => handleStyle({ [`padding${dir}`]: `${e.target.value}px` })}
                                        style={{ width: "100%", padding: "8px", borderRadius: 8, border: "1px solid var(--panel-border)", fontSize: "10px", textAlign: "center", background: "var(--input-bg)", color: "var(--input-text)" }}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </Section>

                <Section id="style" label="Apariencia y Colores" icon={Palette} activeAccordion={activeAccordion} setActiveAccordion={setActiveAccordion}>
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <label style={{ fontSize: "10px", fontWeight: 700, color: "var(--node-desc)" }}>{chartTarget === 'bars' ? 'COLOR DE BARRAS' : 'COLOR DE TEXTO'}</label>
                            <input type="color" 
                                value={el.type === 'chart' && chartTarget === 'title' ? (el.chart?.titleColor || "#000000") : el.type === 'chart' && chartTarget === 'labels' ? (el.chart?.labelColor || "#000000") : el.type === 'chart' && chartTarget === 'bars' ? (el.chart?.datasets?.[0]?.color || "#3b82f6") : (s.color || "#000000")} 
                                onFocus={saveSelection}
                                onChange={e => execCommand('foreColor', e.target.value, e.target)} 
                                style={{ width: 24, height: 24, border: 'none', padding: 0, background: 'none', cursor: 'pointer' }} 
                            />
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {colors.filter(c => c !== 'transparent').map(cl => (
                                <button key={cl} onMouseDown={e => e.preventDefault()} onClick={() => execCommand('foreColor', cl)} style={{ width: 24, height: 24, borderRadius: "50%", background: cl, border: (el.type === 'chart' && chartTarget === 'title' ? el.chart?.titleColor === cl : el.type === 'chart' && chartTarget === 'labels' ? el.chart?.labelColor === cl : el.type === 'chart' && chartTarget === 'bars' ? el.chart?.datasets?.[0]?.color === cl : s.color === cl) ? "2px solid #3b82f6" : "2px solid white", boxShadow: "0 0 0 1px #e2e8f0", cursor: "pointer" }} />
                            ))}
                        </div>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: "10px", fontWeight: 700, color: "var(--node-desc)", display: "block", marginBottom: 8 }}>COLOR DE FONDO</label>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {colors.map(cl => (
                                <button key={cl} onClick={() => handleStyle({ background: cl })} style={{ width: 24, height: 24, borderRadius: "50%", background: cl === 'transparent' ? 'white' : cl, border: s.background === cl ? "2px solid #3b82f6" : "2px solid white", boxShadow: "0 0 0 1px #e2e8f0", cursor: "pointer", position: "relative" }}>
                                    {cl === 'transparent' && <div style={{ width: "100%", height: 2, background: "#ef4444", transform: "rotate(45deg)", position: "absolute", top: "50%", left: 0 }}></div>}
                                </button>
                            ))}
                        </div>
                    </div>

                    {el.type === 'chart' && (
                        <div style={{ padding: 12, background: 'var(--editor-sidebar)', borderRadius: 12, border: '1px solid var(--panel-border)', marginBottom: 16 }}>
                            <label style={{ fontSize: "10px", fontWeight: 800, color: "var(--node-desc)", display: "block", marginBottom: 8, textTransform: 'uppercase' }}>COLORES POR ÍTEM</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 150, overflowY: 'auto', paddingRight: 4 }}>
                                {Array.from({ length: 12 }).map((_, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', background: 'var(--panel-bg)', borderRadius: 8 }}>
                                        <span style={{ fontSize: 10, color: 'var(--node-desc)' }}>Item {i+1}</span>
                                        <input 
                                           type="color" 
                                           value={(el.chart?.itemColors || {})[i] || "#3b82f6"} 
                                           onChange={e => {
                                               const ic = { ...(el.chart?.itemColors || {}) };
                                               ic[i] = e.target.value;
                                               handleUpdate({ chart: { ...(el.chart || {}), itemColors: ic } });
                                           }}
                                           style={{ width: 20, height: 20, border: 'none', padding: 0, background: 'none', cursor: 'pointer' }}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div>
                        <label style={{ fontSize: "10px", fontWeight: 700, color: "var(--node-desc)", display: "block", marginBottom: 6 }}>OPACIDAD</label>
                        <input type="range" min="0" max="100" value={(parseFloat(s.opacity) || 1) * 100} onChange={e => handleStyle({ opacity: e.target.value / 100 })} style={{ width: "100%" }} />
                    </div>
                </Section>

                <Section id="border" label="Borde y Contorno" icon={Box} activeAccordion={activeAccordion} setActiveAccordion={setActiveAccordion}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                        <div>
                            <label style={{ fontSize: "10px", fontWeight: 700, color: "var(--node-desc)", display: "block", marginBottom: 6 }}>ESTILO</label>
                            <select value={s.borderStyle || "none"} onChange={e => handleStyle({ borderStyle: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: 8, border: "1px solid var(--panel-border)", fontSize: "11px", background: "var(--input-bg)", color: "var(--input-text)" }}>
                                {borderStyles.map(b => <option key={b} value={b}>{b.toUpperCase()}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={{ fontSize: "10px", fontWeight: 700, color: "var(--node-desc)", display: "block", marginBottom: 6 }}>ANCHO</label>
                            <input type="number" min="0" max="20" value={parseInt(s.borderWidth) || 0} onChange={e => handleStyle({ borderWidth: e.target.value + "px" })} style={{ width: "100%", padding: "8px", borderRadius: 8, border: "1px solid var(--panel-border)", fontSize: "11px", background: "var(--input-bg)", color: "var(--input-text)" }} />
                        </div>
                    </div>
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: "10px", fontWeight: 700, color: "var(--node-desc)", display: "block", marginBottom: 6 }}>REDONDEADO</label>
                        <input type="range" min="0" max="100" value={parseInt(s.borderRadius) || 0} onChange={e => handleStyle({ borderRadius: e.target.value + "px" })} style={{ width: "100%" }} />
                    </div>
                    <div>
                        <label style={{ fontSize: "10px", fontWeight: 700, color: "var(--node-desc)", display: "block", marginBottom: 8 }}>COLOR BORDER</label>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {colors.filter(c => c !== 'transparent').map(cl => (
                                <button key={cl} onClick={() => handleStyle({ borderColor: cl })} style={{ width: 24, height: 24, borderRadius: "50%", background: cl, border: s.borderColor === cl ? "2px solid #3b82f6" : "2px solid white", boxShadow: "0 0 0 1px #e2e8f0", cursor: "pointer" }} />
                            ))}
                        </div>
                    </div>
                </Section>

                <Section id="fx" label="Sombreado y Efectos" icon={Layers} activeAccordion={activeAccordion} setActiveAccordion={setActiveAccordion}>
                    <div>
                        <label style={{ fontSize: "10px", fontWeight: 700, color: "var(--node-desc)", display: "block", marginBottom: 6 }}>INTENSIDAD DE SOMBRA</label>
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
                        <div style={{ textAlign: "right", fontSize: "10px", color: "var(--node-desc)", marginTop: 4 }}>{localShadow}px</div>
                    </div>
                </Section>
            </div>
        </div>
    );
}