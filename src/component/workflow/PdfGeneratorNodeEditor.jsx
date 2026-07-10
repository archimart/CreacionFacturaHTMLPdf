import React, { useState, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { FileText, Play, Save, RefreshCw, Folder, Settings, LayoutTemplate, Download, X, ChevronLeft, FolderPlus, AlertCircle, StopCircle, RotateCcw, History } from 'lucide-react';
import { DataStreamer } from '@engine/core-logic';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import PaperCanvas from '../PaperCanvas';
import WorkLayer from '../WorkLayer';
import { GlobalDataRegistry } from './registry';
import { PAPER_PRESETS } from '../../utils/utils';
import { saveCheckpoint, loadCheckpoint, clearCheckpoint, saveExecutionLog } from '../../utils/executionLog';

export default function PdfGeneratorNodeEditor({ theme, data = {}, availableTemplates = [], onUpdate, autoRun = false, onRunComplete }) {
    const streamer = DataStreamer.getInstance();
    const sessionId = data.dataKey || `pdf-${data.id || 'temp'}`;

    const [checkpoint,    setCheckpoint]    = useState(null); // { currentIndex, total }
    const [showResume,    setShowResume]    = useState(false);
    const startIndexRef = useRef(0);

    // Detectar checkpoint existente al montar
    useEffect(() => {
        loadCheckpoint(sessionId).then(cp => {
            if (cp && cp.currentIndex > 0) {
                setCheckpoint(cp);
                setShowResume(true);
            }
        });
    }, [sessionId]);

    const [templateId, setTemplateId] = useState(data.templateId || '');
    const [fileNamePattern, setFileNamePattern] = useState(data.fileNamePattern || 'Factura_{{ID}}');
    const [outputFolder, setOutputFolder] = useState(data.outputFolder || '');
    const [generationMode, setGenerationMode] = useState(data.generationMode || 'individual');
    
    const [isGenerating, setIsGenerating] = useState(false);
    const isGeneratingRef = useRef(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [activeJobErrors, setActiveJobErrors] = useState([]);
    const upstreamRecords = GlobalDataRegistry.get(data.upstreamDataKey) || [];
    const sourceTotal = upstreamRecords.length;
    const [errorMsg, setErrorMsg] = useState(null);

    const [currentRenderRecord, setCurrentRenderRecord] = useState(null);
    const [selectedDesign, setSelectedDesign] = useState(null);

    const [isFolderBrowserOpen, setIsFolderBrowserOpen] = useState(false);
    const [browserData, setBrowserData] = useState({ current: 'C:/', dirs: [], files: [], parent: 'C:/' });
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');

    const fetchDirs = async (path) => {
        try {
            const response = await fetch(`/api/utils/list-dirs?path=${encodeURIComponent(path)}`);
            const result = await response.json();
            if (result.success) setBrowserData(result);
        } catch (e) { console.error(e); }
    };

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;
        try {
            const response = await fetch('/api/utils/create-dir', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: browserData.current, name: newFolderName.trim() })
            });
            const result = await response.json();
            if (result.success) {
                setIsCreatingFolder(false);
                setNewFolderName('');
                fetchDirs(browserData.current);
            } else {
                alert(result.error || 'Error al crear la carpeta');
            }
        } catch (e) { console.error(e); }
    };

    // Auto-guardar la configuración del nodo en vivo ante cualquier cambio en el formulario
    useEffect(() => {
        onUpdate({ templateId, fileNamePattern, outputFolder, generationMode });
    }, [templateId, fileNamePattern, outputFolder, generationMode]);

    // Pre-montar el diseño seleccionado y el primer registro de entrada para agilizar la preparación visual
    useEffect(() => {
        if (templateId && availableTemplates) {
            const templateObj = availableTemplates.find(t => t.id === templateId);
            if (templateObj && templateObj.design) {
                setSelectedDesign(templateObj.design);
            }
        }
        if (upstreamRecords.length > 0 && !currentRenderRecord) {
            setCurrentRenderRecord(upstreamRecords[0]);
        }
    }, [templateId, availableTemplates, data.upstreamDataKey]);

    // Conectar y sincronizar en vivo con el gestor de ejecución en segundo plano (n8n style)
    useEffect(() => {
        if (typeof window !== 'undefined' && window.__PdfBatchManager) {
            const activeJob = window.__PdfBatchManager.activeJobs[sessionId];
            if (activeJob && activeJob.isGenerating) {
                setIsGenerating(true);
                setProgress({ current: activeJob.current, total: activeJob.total });
                if (activeJob.record) setCurrentRenderRecord(activeJob.record);
                if (activeJob.errors) setActiveJobErrors([...activeJob.errors]);
            }
            return window.__PdfBatchManager.subscribe(sessionId, (updatedJob) => {
                if (!updatedJob) return;
                setIsGenerating(updatedJob.isGenerating);
                setProgress({ current: updatedJob.current, total: updatedJob.total });
                if (updatedJob.record) setCurrentRenderRecord(updatedJob.record);
                if (updatedJob.errors) setActiveJobErrors([...updatedJob.errors]);
            });
        }
    }, [sessionId]);

    // Auto-iniciar cuando es llamado desde Run All o Schedule
    useEffect(() => {
        if (autoRun && !isGenerating && sourceTotal > 0 && templateId && outputFolder) {
            handleGenerate();
        }
    }, [autoRun]);

    // Notificar a Run All cuando la generación termina
    useEffect(() => {
        if (!isGenerating && progress.total > 0 && progress.current >= progress.total) {
            onRunComplete?.();
        }
    }, [isGenerating, progress.current, progress.total]);

    const handleSave = () => {
        onUpdate({ templateId, fileNamePattern, outputFolder, generationMode });
    };

    const handleStop = () => {
        if (typeof window !== 'undefined' && window.__PdfBatchManager) {
            window.__PdfBatchManager.cancel(sessionId);
        }
        isGeneratingRef.current = false;
        setIsGenerating(false);
    };

    const handleGenerate = async () => {
        setErrorMsg(null);
        if (!templateId) {
            setErrorMsg("Por favor selecciona una plantilla base antes de iniciar.");
            return;
        }
        if (!outputFolder) {
            setErrorMsg("Por favor selecciona una carpeta de destino en disco (ej. C:/D_EquipoAnterior/pdfBanco).");
            return;
        }

        const templateObj = availableTemplates.find(t => t.id === templateId);
        if (!templateObj || !templateObj.design) {
            setErrorMsg("La plantilla seleccionada no tiene un diseño configurado. Asegúrate de configurar y guardar el nodo de Diseño de Documento primero.");
            return;
        }

        const sourceRecords = GlobalDataRegistry.get(data.upstreamDataKey);
        if (!sourceRecords || sourceRecords.length === 0) {
            setErrorMsg("No hay datos de entrada en el nodo anterior para generar PDFs.");
            return;
        }

        if (window.__PdfBatchManager?.activeJobs[sessionId]?.isGenerating) return;

        isGeneratingRef.current = true;
        setIsGenerating(true);
        setProgress({ current: 0, total: sourceRecords.length });
        setSelectedDesign(templateObj.design);
        setCurrentRenderRecord(sourceRecords[0]);

        onUpdate({ templateId, fileNamePattern, outputFolder, generationMode, dataKey: sessionId });

        const sizeKey = templateObj.design.size || "letter";
        const orientation = templateObj.design.orientation || "portrait";
        const preset = PAPER_PRESETS[sizeKey] || PAPER_PRESETS.letter;
        const wIn = orientation === "landscape" ? preset.h : preset.w;
        const hIn = orientation === "landscape" ? preset.w : preset.h;
        const pdfW = wIn * 72, pdfH = hIn * 72;

        const job = {
            sessionId,
            isGenerating: true,
            isCancelled: false,
            current: 0,
            total: sourceRecords.length,
            startTime: Date.now(),
            record: sourceRecords[0],
            design: templateObj.design,
            outputFolder,
            generationMode,
            fileNamePattern,
            pdfW, pdfH, orientation,
            generatedRecords: [],
            batchFiles: []
        };
        window.__PdfBatchManager.activeJobs[sessionId] = job;
        window.__PdfBatchManager.notify(sessionId);

        // Iniciar el motor de renderizado y guardado en segundo plano (totalmente desacoplado de React unmounting)
        (async () => {
            const jobRef = window.__PdfBatchManager.activeJobs[sessionId];
            jobRef.errors = [];
            
            try {
                let masterPdf = null;
                if (generationMode === 'completo') {
                    masterPdf = new jsPDF({ unit: 'pt', orientation: orientation, format: [pdfW, pdfH], compress: true });
                }

                const scale = generationMode === 'completo' ? 1.0 : 1.2;
                const quality = generationMode === 'completo' ? 0.65 : 0.75;

                // Espera inicial para asegurar el montaje completo del portal persistente en el DOM
                await new Promise(r => setTimeout(r, 150));

                for (let idx = 0; idx < sourceRecords.length; idx++) {
                    if (jobRef.isCancelled || !jobRef.isGenerating) break;

                    const record = sourceRecords[idx];
                    jobRef.record = record;
                    jobRef.current = idx + 1;
                    window.__PdfBatchManager.notify(sessionId);

                    // Espera a que React dibuje el registro actual en el DOM usando el atributo data-current-record
                    let stageEl = document.getElementById(`pdf-persistent-stage-${sessionId}`);
                    let retries = 0;
                    while ((!stageEl || stageEl.getAttribute('data-current-record') !== String(idx + 1)) && retries < 150) {
                        await new Promise(r => setTimeout(r, 10));
                        stageEl = document.getElementById(`pdf-persistent-stage-${sessionId}`);
                        retries++;
                    }

                    let stageSheets = stageEl ? stageEl.querySelectorAll('.pdf-sheet-canvas') : [];
                    if (!stageSheets || stageSheets.length === 0) {
                        stageSheets = document.querySelectorAll(`#pdf-persistent-stage-${sessionId} .pdf-sheet-canvas`);
                    }

                    if (!stageSheets || stageSheets.length === 0) {
                        console.warn(`No se encontraron hojas en el DOM para la sesión ${sessionId} en el registro ${idx}`);
                        continue;
                    }

                    // Esperar a que se descarguen y carguen todas las imágenes y fuentes del registro en el DOM
                    if (stageEl) {
                        const images = Array.from(stageEl.querySelectorAll('img'));
                        const imagePromises = images.map(img => {
                            if (img.complete) return Promise.resolve();
                            return new Promise(resolve => {
                                img.onload = () => resolve();
                                img.onerror = () => resolve();
                            });
                        });
                        await Promise.all(imagePromises);

                        if (document.fonts && document.fonts.ready) {
                            await document.fonts.ready;
                        }

                        // Ceder dos frames de animación al navegador para asegurar layouts limpios
                        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
                    }

                    try {
                        let fileName = fileNamePattern || 'Factura';
                        const escRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        Object.keys(record).forEach(k => {
                            const esc = escRx(k);
                            const val = String(record[k] ?? '');
                            fileName = fileName.replace(new RegExp(`\\{\\{${esc}\\}\\}`, 'gi'), val); // {{campo}}
                            fileName = fileName.replace(new RegExp(`\\{${esc}\\}`, 'gi'),    val); // {campo}
                        });
                        if (fileName === fileNamePattern || fileName === 'Factura' || fileName.includes('{{')) {
                            const cleanBase = fileName.replace(/\{\{.*\}\}/g, '').replace(/[^a-zA-Z0-9_\-\.]/g, '_').replace(/_+$/, '');
                            fileName = `${cleanBase || 'Factura'}_${idx + 1}`;
                        }
                        const cleanFileName = fileName.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
                        const fullPath = `${outputFolder.replace(/\/$/, '')}/${cleanFileName}.pdf`;

                        if (generationMode === 'individual') {
                            const singlePdf = new jsPDF({ unit: 'pt', orientation: orientation, format: [pdfW, pdfH], compress: true });

                            for (let sIdx = 0; sIdx < stageSheets.length; sIdx++) {
                                if (sIdx > 0) singlePdf.addPage();

                                const canvas = await html2canvas(stageSheets[sIdx], {
                                    scale: scale,
                                    useCORS: true,
                                    allowTaint: true,
                                    backgroundColor: "#ffffff",
                                    logging: false,
                                    imageTimeout: 2000,
                                    removeContainer: true,
                                    onclone: (clonedDoc) => {
                                        const stageEl = clonedDoc.getElementById('persistent-background-pdf-stage');
                                        if (stageEl) {
                                            stageEl.style.opacity = '1';
                                            stageEl.style.position = 'relative';
                                            stageEl.style.zIndex = '1';
                                            stageEl.style.display = 'block';
                                        }
                                        const sheets = clonedDoc.querySelectorAll('.pdf-sheet-canvas');
                                        sheets.forEach(sheet => {
                                            let p = sheet.parentElement;
                                            while(p && p.tagName !== 'BODY') {
                                                p.style.transform = 'none';
                                                p.style.zoom = '1';
                                                p.style.overflow = 'visible';
                                                p.style.opacity = '1';
                                                p.style.visibility = 'visible';
                                                p.style.display = 'block';
                                                p.style.width = 'auto';
                                                p.style.height = 'auto';
                                                p = p.parentElement;
                                            }
                                            sheet.style.transform = 'none';
                                            sheet.style.left = '0';
                                            sheet.style.top = '0';
                                            sheet.style.position = 'relative';
                                            sheet.style.boxShadow = 'none';
                                            sheet.style.opacity = '1';
                                            sheet.style.visibility = 'visible';
                                        });
                                    }
                                });

                                const imgData = canvas.toDataURL('image/jpeg', quality);
                                singlePdf.addImage(imgData, 'JPEG', 0, 0, pdfW, pdfH, undefined, 'FAST');

                                // Liberar memoria del canvas inmediatamente
                                canvas.width = 0;
                                canvas.height = 0;
                            }

                            const base64Content = singlePdf.output('datauristring').split(',')[1];
                            
                            jobRef.batchFiles.push({ filePath: fullPath, encoding: 'base64', content: base64Content });
                            jobRef.generatedRecords.push({ ...record, _pdf_file: `${cleanFileName}.pdf`, _pdf_path: fullPath, _pdf_status: 'GENERADO_EXITO' });
                            
                            if (jobRef.batchFiles.length >= 10 || idx === sourceRecords.length - 1) {
                                const payload = [...jobRef.batchFiles];
                                jobRef.batchFiles = [];
                                try {
                                    const resp = await fetch('/api/utils/save-files-batch', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ files: payload })
                                    });
                                    if (!resp.ok) {
                                        const txt = await resp.text();
                                        throw new Error(txt);
                                    }
                                } catch (e) {
                                    console.warn("Fallo lote, usando fallback individual...", e);
                                    for (const file of payload) {
                                        const saveResp = await fetch('/api/utils/save-file', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ filePath: file.filePath, encoding: 'base64', content: file.content })
                                        });
                                        if (!saveResp.ok) {
                                            const txt = await saveResp.text();
                                            throw new Error(`Error al guardar archivo en disco: ${txt}`);
                                        }
                                    }
                                }
                                
                                GlobalDataRegistry.set(sessionId, [...jobRef.generatedRecords]);
                                streamer.createSession(sessionId, [...jobRef.generatedRecords]);
                                streamer.requestRange(sessionId, 0, 20);
                            }
                        } else {
                            for (let sIdx = 0; sIdx < stageSheets.length; sIdx++) {
                                if (idx > 0 || sIdx > 0) masterPdf.addPage();

                                const canvas = await html2canvas(stageSheets[sIdx], {
                                    scale: scale,
                                    useCORS: true,
                                    allowTaint: true,
                                    backgroundColor: "#ffffff",
                                    logging: false,
                                    imageTimeout: 2000,
                                    removeContainer: true,
                                    onclone: (clonedDoc) => {
                                        const stageEl = clonedDoc.getElementById('persistent-background-pdf-stage');
                                        if (stageEl) {
                                            stageEl.style.opacity = '1';
                                            stageEl.style.position = 'relative';
                                            stageEl.style.zIndex = '1';
                                            stageEl.style.display = 'block';
                                        }
                                        const sheets = clonedDoc.querySelectorAll('.pdf-sheet-canvas');
                                        sheets.forEach(sheet => {
                                            let p = sheet.parentElement;
                                            while(p && p.tagName !== 'BODY') {
                                                p.style.transform = 'none';
                                                p.style.zoom = '1';
                                                p.style.overflow = 'visible';
                                                p.style.opacity = '1';
                                                p.style.visibility = 'visible';
                                                p.style.display = 'block';
                                                p.style.width = 'auto';
                                                p.style.height = 'auto';
                                                p = p.parentElement;
                                            }
                                            sheet.style.transform = 'none';
                                            sheet.style.left = '0';
                                            sheet.style.top = '0';
                                            sheet.style.position = 'relative';
                                            sheet.style.boxShadow = 'none';
                                            sheet.style.opacity = '1';
                                            sheet.style.visibility = 'visible';
                                        });
                                    }
                                });

                                const imgData = canvas.toDataURL('image/jpeg', quality);
                                masterPdf.addImage(imgData, 'JPEG', 0, 0, pdfW, pdfH, undefined, 'FAST');

                                // Liberar memoria del canvas inmediatamente
                                canvas.width = 0;
                                canvas.height = 0;
                            }
                            jobRef.generatedRecords.push({ ...record, _pdf_status: 'INCLUIDO_CONSOLIDADO' });

                            if (idx % 10 === 0 || idx === sourceRecords.length - 1) {
                                GlobalDataRegistry.set(sessionId, [...jobRef.generatedRecords]);
                                streamer.createSession(sessionId, [...jobRef.generatedRecords]);
                                streamer.requestRange(sessionId, 0, 20);
                            }
                        }
                    } catch (err) {
                        console.error("Error en registro " + idx, err);
                        jobRef.generatedRecords.push({ ...record, _pdf_status: 'ERROR' });
                        jobRef.errors.push({ idx: idx + 1, id: record.ID || record.id || (idx + 1), message: err.message });
                        window.__PdfBatchManager.notify(sessionId);
                    }

                    // Checkpoint cada 50 registros para poder reanudar
                    if ((idx + 1) % 50 === 0) {
                        await saveCheckpoint(sessionId, { currentIndex: idx + 1, total: sourceRecords.length });
                    }

                    // Ceder control al navegador cada 5 registros para recolección de basura
                    if (idx > 0 && idx % 5 === 0) {
                        await new Promise(r => setTimeout(r, 150));
                    }
                }

                if (generationMode === 'completo' && masterPdf && !jobRef.isCancelled) {
                    const consFileName = `Consolidado_${Date.now()}.pdf`;
                    const fullPath = `${outputFolder.replace(/\/$/, '')}/${consFileName}`;
                    const base64Content = masterPdf.output('datauristring').split(',')[1];
                    
                    const saveResp = await fetch('/api/utils/save-file', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ filePath: fullPath, encoding: 'base64', content: base64Content })
                    });
                    if (!saveResp.ok) {
                        const txt = await saveResp.text();
                        throw new Error(`Fallo al guardar archivo consolidado: ${txt}`);
                    }
                    jobRef.generatedRecords.forEach(r => {
                        r._pdf_file = consFileName;
                        r._pdf_path = fullPath;
                        r._pdf_status = 'GENERADO_CONSOLIDADO';
                    });
                    GlobalDataRegistry.set(sessionId, [...jobRef.generatedRecords]);
                    streamer.createSession(sessionId, [...jobRef.generatedRecords]);
                    streamer.requestRange(sessionId, 0, 20);
                }
            } catch (globalErr) {
                console.error("Error fatal en el lote", globalErr);
                jobRef.errors.push({ idx: 0, id: 'FATAL', message: globalErr.message });
            } finally {
                jobRef.isGenerating = false;
                const histEntry = {
                    completedAt: new Date().toLocaleTimeString(),
                    totalRecords: jobRef.generatedRecords.length,
                    mode: generationMode,
                    folder: outputFolder,
                    errorsCount: jobRef.errors ? jobRef.errors.length : 0
                };
                window.__PdfBatchManager.history[sessionId] = histEntry;
                window.__PdfBatchManager.notify(sessionId);
                await clearCheckpoint(sessionId);
                await saveExecutionLog({
                    wfName: data.title || sessionId,
                    trigger: 'manual',
                    startedAt: new Date(job.startTime).toISOString(),
                    completedAt: new Date().toISOString(),
                    totalPdfs: jobRef.generatedRecords.length,
                    errors: jobRef.errors?.length || 0,
                    outputFolder,
                    status: jobRef.errors?.length > 0 ? 'partial' : 'success'
                });
            }
        })();
    };

    return (
        <div style={{ padding: '40px', color: 'var(--node-text)', maxWidth: 800, margin: '0 auto', height: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                    <h2 style={{ fontWeight: 900, fontSize: 28, margin: 0, display: 'flex', alignItems: 'center', gap: 15 }}>
                        <FileText size={32} color="#ef4444"/> Generador PDFs
                    </h2>
                    <p style={{ color: 'var(--node-desc)', fontSize: 14 }}>Genera archivos PDF individuales o consolidados directamente en disco.</p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button 
                        onClick={handleSave} 
                        disabled={isGenerating}
                        style={{ background: 'var(--btn-bg)', color: 'var(--node-text)', border: '1px solid var(--btn-border)', padding: '8px 20px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: isGenerating ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                    >
                        <Save size={16}/> GUARDAR
                    </button>
                    {!isGenerating ? (
                        <button 
                            onClick={handleGenerate} 
                            disabled={sourceTotal === 0}
                            style={{ background: sourceTotal === 0 ? '#666' : '#ef4444', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: 10, fontSize: 14, fontWeight: 900, cursor: sourceTotal === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 15px rgba(239, 68, 68, 0.4)' }}
                        >
                            <Play size={16} fill="#fff"/> INICIAR GENERACIÓN
                        </button>
                    ) : (
                        <button 
                            onClick={handleStop} 
                            style={{ background: '#f59e0b', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: 10, fontSize: 14, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 15px rgba(245, 158, 11, 0.4)' }}
                        >
                            <StopCircle size={16} fill="#fff" /> DETENER (GUARDAR PARCIAL)
                        </button>
                    )}
                </div>
            </div>

            {/* Banner de checkpoint disponible */}
            {showResume && checkpoint && !isGenerating && (
                <div style={{ background: 'rgba(245,158,11,0.12)', border: '1.5px solid rgba(245,158,11,0.3)', padding: '16px 20px', borderRadius: 16, color: '#f59e0b', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 14 }}>
                    <History size={22}/>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 900, marginBottom: 3 }}>Generación anterior interrumpida</div>
                        <div>Se guardó un checkpoint en el registro {checkpoint.currentIndex} de {checkpoint.total}. ¿Deseas reanudar desde ahí?</div>
                    </div>
                    <button onClick={() => { startIndexRef.current = checkpoint.currentIndex; setShowResume(false); handleGenerate(checkpoint.currentIndex); }} style={{ background: '#f59e0b', color: '#000', border: 'none', padding: '8px 18px', borderRadius: 10, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <RotateCcw size={16}/> REANUDAR
                    </button>
                    <button onClick={async () => { await clearCheckpoint(sessionId); setShowResume(false); setCheckpoint(null); }} style={{ background: 'transparent', border: '1px solid rgba(245,158,11,0.4)', color: '#f59e0b', padding: '8px 14px', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>
                        Ignorar
                    </button>
                </div>
            )}

            {errorMsg && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', padding: '16px 20px', borderRadius: 16, color: '#ef4444', fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <AlertCircle size={20} /> {errorMsg}
                </div>
            )}

            <div style={{ background: 'var(--node-footer-bg)', padding: '25px', borderRadius: 20, border: '1px solid var(--node-border)', display: 'flex', flexDirection: 'column', gap: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                    <Settings size={18} /> Configuración de Salida
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--node-desc)' }}>Plantilla Base</label>
                    <div style={{ position: 'relative' }}>
                        <LayoutTemplate size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--node-desc)' }}/>
                        <select 
                            value={templateId} 
                            onChange={e => setTemplateId(e.target.value)}
                            disabled={isGenerating}
                            style={{ width: '100%', padding: '12px 14px 12px 40px', borderRadius: 10, border: '1px solid var(--editor-border)', background: 'var(--input-bg)', color: 'var(--input-text)', fontSize: 13, outline: 'none', appearance: 'none' }}
                        >
                            <option value="">Selecciona un diseño del flujo...</option>
                            {(availableTemplates || []).map(t => (
                                <option key={t.id} value={t.id}>{t.title}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--node-desc)' }}>Modo de Generación</label>
                    <div style={{ position: 'relative' }}>
                        <FileText size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--node-desc)' }}/>
                        <select 
                            value={generationMode} 
                            onChange={e => setGenerationMode(e.target.value)}
                            disabled={isGenerating}
                            style={{ width: '100%', padding: '12px 14px 12px 40px', borderRadius: 10, border: '1px solid var(--editor-border)', background: 'var(--input-bg)', color: 'var(--input-text)', fontSize: 13, outline: 'none', appearance: 'none' }}
                        >
                            <option value="individual">1 PDF por cada registro (Miles de archivos guardados en disco)</option>
                            <option value="completo">Un solo PDF consolidado (Todas las páginas juntas en 1 archivo)</option>
                        </select>
                    </div>
                    {generationMode === 'completo' && sourceTotal > 150 && (
                        <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', padding: '10px 14px', borderRadius: 10, color: '#f59e0b', fontSize: 11, fontWeight: 700, marginTop: 4, display: 'flex', gap: 8, alignItems: 'center' }}>
                            <AlertCircle size={16} />
                            <span>⚠️ Advertencia: Consolidar {sourceTotal} páginas consumirá demasiada memoria y colgará tu navegador. Se recomienda usar "Modo Individual".</span>
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--node-desc)' }}>Patrón de Nombre de Archivo</label>
                    <div style={{ position: 'relative' }}>
                        <FileText size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--node-desc)' }}/>
                        <input 
                            type="text" 
                            value={fileNamePattern} 
                            onChange={e => setFileNamePattern(e.target.value)}
                            disabled={isGenerating}
                            placeholder="Ej: Factura_{{ID}}"
                            style={{ width: '100%', padding: '12px 14px 12px 40px', borderRadius: 10, border: '1px solid var(--editor-border)', background: 'var(--input-bg)', color: 'var(--input-text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                        />
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--node-desc)' }}>Usa llaves <code>{`{{campo}}`}</code> para inyectar datos del registro actual.</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--node-desc)' }}>Carpeta de Destino en Disco</label>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                            <Folder size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--node-desc)' }}/>
                            <input 
                                type="text" 
                                value={outputFolder} 
                                onChange={e => setOutputFolder(e.target.value)}
                                disabled={isGenerating}
                                placeholder="C:/D_EquipoAnterior/pdfBanco"
                                style={{ width: '100%', padding: '12px 14px 12px 40px', borderRadius: 10, border: '1px solid var(--editor-border)', background: 'var(--input-bg)', color: 'var(--input-text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                            />
                        </div>
                        <button onClick={() => { setIsFolderBrowserOpen(true); fetchDirs(outputFolder || 'C:/'); }} disabled={isGenerating} style={{ padding: '0 20px', background: 'var(--btn-bg)', border: '1px solid var(--btn-border)', color: 'var(--node-text)', borderRadius: 10, fontWeight: 700, cursor: isGenerating ? 'not-allowed' : 'pointer' }}>Explorar</button>
                    </div>
                </div>
            </div>

            {isGenerating && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', padding: '25px', borderRadius: 20, display: 'flex', flexDirection: 'column', gap: 15 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 10 }}>
                            <RefreshCw size={16} className="animate-spin" /> Generando y guardando archivos PDF en tiempo real...
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--node-text)' }}>{progress.current} / {progress.total}</div>
                    </div>
                    <div style={{ width: '100%', height: 10, background: 'rgba(0,0,0,0.2)', borderRadius: 5, overflow: 'hidden' }}>
                        <div style={{ width: `${(progress.current / Math.max(1, progress.total)) * 100}%`, height: '100%', background: '#ef4444', transition: 'width 0.1s' }} />
                    </div>
                    {currentRenderRecord && (
                        <div style={{ fontSize: 12, color: 'var(--node-desc)', fontStyle: 'italic', display: 'flex', justifyContent: 'space-between' }}>
                            <span>Registro activo ID: {currentRenderRecord.ID || currentRenderRecord.id || progress.current}</span>
                            <span>Guardando en: {outputFolder}</span>
                        </div>
                    )}
                    {activeJobErrors.length > 0 && (
                        <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', padding: '15px 20px', borderRadius: 16, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 150, overflowY: 'auto', marginTop: 10 }}>
                            <div style={{ fontSize: 13, fontWeight: 800, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <AlertCircle size={16} /> Errores detectados ({activeJobErrors.length}):
                            </div>
                            {activeJobErrors.map((err, errIdx) => (
                                <div key={errIdx} style={{ fontSize: 11, color: 'var(--node-desc)', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Registro #{err.idx} (ID: {err.id})</span>
                                    <span style={{ color: '#ef4444', fontWeight: 600 }}>{err.message}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
            
            {!isGenerating && progress.total > 0 && (
                <div style={{ background: progress.current === progress.total ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)', border: `1px solid ${progress.current === progress.total ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`, padding: '20px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 15, color: progress.current === progress.total ? '#10b981' : '#f59e0b' }}>
                    <Download size={32} />
                    <div>
                        <div style={{ fontSize: 16, fontWeight: 900 }}>
                            {progress.current === progress.total ? '¡Generación Completada y Archivos Guardados!' : '¡Generación Detenida (Guardado Parcial Exitoso)!'}
                        </div>
                        <div style={{ fontSize: 13, marginTop: 4 }}>
                            Se han guardado <strong>{progress.current}</strong> archivos PDF en <strong>{outputFolder}</strong>. El inspector de la derecha ya muestra los archivos listos.
                        </div>
                    </div>
                </div>
            )}

            {isFolderBrowserOpen && (
                <div className="modal-overlay" onClick={() => setIsFolderBrowserOpen(false)}>
                    <div className="modal-content" style={{ width: 600, background: 'var(--editor-bg)', borderRadius: 20, display: 'flex', flexDirection: 'column', height: 500 }} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: '20px 24px', background: 'var(--editor-header)', borderBottom: '1px solid var(--node-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '20px 20px 0 0' }}>
                            <div><div style={{ fontSize: 18, fontWeight: 900, color: 'var(--node-text)' }}>Seleccionar Carpeta Destino</div><div style={{ fontSize: 11, color: 'var(--node-desc)', marginTop: 4 }}>{browserData.current}</div></div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <button onClick={() => { setOutputFolder(browserData.current); setIsFolderBrowserOpen(false); }} style={{ background: '#10b981', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 900, cursor: 'pointer' }}>Elegir Esta Carpeta</button>
                                <button onClick={() => setIsCreatingFolder(true)} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}><FolderPlus size={16}/> Nueva Carpeta</button>
                                <button onClick={() => setIsFolderBrowserOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--node-text)', cursor: 'pointer', marginLeft: 5 }}><X/></button>
                            </div>
                        </div>
                        {isCreatingFolder && (
                            <div style={{ padding: '14px 24px', background: 'rgba(59,130,246,0.08)', borderBottom: '1px solid var(--node-border)', display: 'flex', gap: 10, alignItems: 'center' }}>
                                <input 
                                    value={newFolderName} 
                                    onChange={e => setNewFolderName(e.target.value)} 
                                    placeholder="Nombre de la nueva carpeta (ej: Facturas_2026)..." 
                                    style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid #3b82f6', background: 'var(--input-bg)', color: 'var(--input-text)', fontSize: 13, outline: 'none', fontWeight: 600 }} 
                                    autoFocus 
                                />
                                <button onClick={handleCreateFolder} style={{ background: '#10b981', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 10, fontWeight: 900, fontSize: 13, cursor: 'pointer' }}>Crear</button>
                                <button onClick={() => { setIsCreatingFolder(false); setNewFolderName(''); }} style={{ background: 'transparent', color: 'var(--node-desc)', border: 'none', padding: '10px', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
                            </div>
                        )}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
                            <div onClick={() => fetchDirs(browserData.parent)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer', borderRadius: 12, background: 'var(--node-bg)', border: '1px solid var(--node-border)', marginBottom: 16 }}>
                                <ChevronLeft size={18} color="#3b82f6"/> <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--node-text)' }}>Atrás</span>
                            </div>
                            <div style={{ display: 'grid', gap: 8 }}>
                                {browserData.dirs.map(d => {
                                    const nextP = browserData.current.endsWith('/') ? `${browserData.current}${d}` : `${browserData.current}/${d}`;
                                    return (
                                        <div key={d} onClick={() => fetchDirs(nextP)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer', borderRadius: 12, border: '1px solid var(--node-border)', background: 'var(--node-bg)' }}>
                                            <Folder color="#3b82f6" fill="#3b82f6" size={18}/> <span style={{ fontWeight: 800, color: 'var(--node-text)', fontSize: 13 }}>{d}</span>
                                            <button onClick={(e) => { e.stopPropagation(); setOutputFolder(nextP); setIsFolderBrowserOpen(false); }} style={{ marginLeft: 'auto', background: '#3b82f6', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 8, fontSize: 10, fontWeight: 900, cursor: 'pointer' }}>SELECCIONAR</button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
