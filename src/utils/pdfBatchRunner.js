/**
 * pdfBatchRunner.js
 * Bucle de generación de PDFs extraído como función pura.
 * Usado por PdfGeneratorNodeEditor, Run All y Schedules.
 *
 * Requiere que PersistentPdfStage esté montado en el DOM (siempre está en WorkflowCanvas).
 */

import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { GlobalDataRegistry } from '../component/workflow/registry';
import { DataStreamer } from '@engine/core-logic';
import { PAPER_PRESETS } from './utils';
import { saveCheckpoint, clearCheckpoint } from './executionLog';

const CHECKPOINT_INTERVAL = 50; // guardar progreso cada N registros

/**
 * @param {object} cfg
 * @param {string}   cfg.sessionId
 * @param {object[]} cfg.sourceRecords
 * @param {object}   cfg.design          — objeto de diseño del invoice node
 * @param {string}   cfg.outputFolder
 * @param {string}   cfg.fileNamePattern — e.g. "Factura_{{ID}}"
 * @param {string}   cfg.generationMode  — 'individual' | 'completo'
 * @param {number}  [cfg.startIndex=0]   — para reanudar
 * @param {function} [cfg.onProgress]    — (current, total) => void
 * @param {function} [cfg.onError]       — (idx, err) => void
 * @param {function} [cfg.onComplete]    — (stats) => void
 */
export async function runPdfBatch(cfg) {
    const {
        sessionId, sourceRecords, design, outputFolder,
        fileNamePattern = 'Documento_{{ID}}',
        generationMode = 'individual',
        startIndex = 0,
        onProgress, onError, onComplete
    } = cfg;

    if (!sourceRecords?.length || !design) {
        onComplete?.({ success: false, error: 'Sin registros o diseño' });
        return;
    }

    const sizeKey    = design.size || 'letter';
    const orientation = design.orientation || 'portrait';
    const preset     = PAPER_PRESETS[sizeKey] || PAPER_PRESETS.letter;
    const wIn        = orientation === 'landscape' ? preset.h : preset.w;
    const hIn        = orientation === 'landscape' ? preset.w : preset.h;
    const pdfW       = wIn * 72;
    const pdfH       = hIn * 72;
    const scale      = generationMode === 'completo' ? 1.0 : 1.2;
    const quality    = generationMode === 'completo' ? 0.65 : 0.75;

    // Registrar el trabajo en el gestor global para que PersistentPdfStage lo muestre
    const streamer = DataStreamer.getInstance();

    const job = {
        sessionId,
        isGenerating: true,
        isCancelled: false,
        current: startIndex,
        total: sourceRecords.length,
        startTime: Date.now(),
        record: sourceRecords[startIndex] || sourceRecords[0],
        design,
        outputFolder,
        generationMode,
        fileNamePattern,
        pdfW, pdfH, orientation,
        generatedRecords: [],
        batchFiles: [],
        errors: []
    };

    window.__PdfBatchManager.activeJobs[sessionId] = job;
    window.__PdfBatchManager.notify(sessionId);

    // Esperar a que React monte el DOM stage
    await new Promise(r => setTimeout(r, 200));

    let masterPdf = null;
    if (generationMode === 'completo') {
        masterPdf = new jsPDF({ unit: 'pt', orientation, format: [pdfW, pdfH], compress: true });
    }

    try {
        for (let idx = startIndex; idx < sourceRecords.length; idx++) {
            if (job.isCancelled) break;

            const record = sourceRecords[idx];
            job.record  = record;
            job.current = idx + 1;
            window.__PdfBatchManager.notify(sessionId);
            onProgress?.(idx + 1, sourceRecords.length);

            // Esperar actualización del DOM
            let stageEl = document.getElementById(`pdf-persistent-stage-${sessionId}`);
            let retries = 0;
            while ((!stageEl || stageEl.getAttribute('data-current-record') !== String(idx + 1)) && retries < 150) {
                await new Promise(r => setTimeout(r, 10));
                stageEl = document.getElementById(`pdf-persistent-stage-${sessionId}`);
                retries++;
            }

            const stageSheets = stageEl ? Array.from(stageEl.querySelectorAll('.pdf-sheet-canvas')) : [];
            if (!stageSheets.length) {
                job.errors.push({ idx: idx + 1, message: 'Sin hojas en DOM' });
                onError?.(idx + 1, new Error('Sin hojas en DOM'));
                continue;
            }

            // Esperar imágenes y fuentes
            if (stageEl) {
                const imgs = Array.from(stageEl.querySelectorAll('img'));
                await Promise.all(imgs.map(img => img.complete ? Promise.resolve() : new Promise(r => { img.onload = img.onerror = r; })));
                if (document.fonts?.ready) await document.fonts.ready;
                await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
            }

            const onclone = (clonedDoc) => {
                const st = clonedDoc.getElementById('persistent-background-pdf-stage');
                if (st) { st.style.opacity = '1'; st.style.position = 'relative'; st.style.zIndex = '1'; }
                clonedDoc.querySelectorAll('.pdf-sheet-canvas').forEach(sheet => {
                    let p = sheet.parentElement;
                    while (p && p.tagName !== 'BODY') {
                        p.style.transform = 'none'; p.style.zoom = '1'; p.style.overflow = 'visible';
                        p.style.opacity = '1'; p.style.visibility = 'visible';
                        p.style.display = 'block'; p.style.width = 'auto'; p.style.height = 'auto';
                        p = p.parentElement;
                    }
                    Object.assign(sheet.style, { transform: 'none', left: '0', top: '0', position: 'relative', boxShadow: 'none', opacity: '1', visibility: 'visible' });
                });
            };

            try {
                // Nombre de archivo — soporta {campo} y {{campo}}, escapa caracteres especiales
                const escRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                let fileName = fileNamePattern;
                Object.keys(record).forEach(k => {
                    const esc = escRx(k);
                    const val = String(record[k] ?? '');
                    fileName = fileName.replace(new RegExp(`\\{\\{${esc}\\}\\}`, 'gi'), val); // {{campo}}
                    fileName = fileName.replace(new RegExp(`\\{${esc}\\}`, 'gi'),    val); // {campo}
                });
                if (fileName.includes('{{')) {
                    const cleanBase = fileName.replace(/\{\{.*?\}\}/g, '').replace(/[^a-zA-Z0-9_\-.]/g, '_').replace(/_+$/, '');
                    fileName = `${cleanBase || 'Documento'}_${idx + 1}`;
                }
                const cleanFileName = fileName.replace(/[^a-zA-Z0-9_\-.]/g, '_');
                const fullPath = `${outputFolder.replace(/\/$/, '')}/${cleanFileName}.pdf`;

                if (generationMode === 'individual') {
                    const singlePdf = new jsPDF({ unit: 'pt', orientation, format: [pdfW, pdfH], compress: true });
                    for (let si = 0; si < stageSheets.length; si++) {
                        if (si > 0) singlePdf.addPage();
                        const canvas = await html2canvas(stageSheets[si], { scale, useCORS: true, allowTaint: true, backgroundColor: '#ffffff', logging: false, imageTimeout: 2000, removeContainer: true, onclone });
                        singlePdf.addImage(canvas.toDataURL('image/jpeg', quality), 'JPEG', 0, 0, pdfW, pdfH, undefined, 'FAST');
                        canvas.width = 0; canvas.height = 0;
                    }
                    job.batchFiles.push({ filePath: fullPath, encoding: 'base64', content: singlePdf.output('datauristring').split(',')[1] });
                    job.generatedRecords.push({ ...record, _pdf_file: `${cleanFileName}.pdf`, _pdf_path: fullPath, _pdf_status: 'OK' });

                    if (job.batchFiles.length >= 10 || idx === sourceRecords.length - 1) {
                        const payload = [...job.batchFiles];
                        job.batchFiles = [];
                        await saveBatchToDisk(payload);
                        GlobalDataRegistry.set(sessionId, [...job.generatedRecords]);
                        streamer.createSession(sessionId, [...job.generatedRecords]);
                    }
                } else {
                    for (let si = 0; si < stageSheets.length; si++) {
                        if (idx > 0 || si > 0) masterPdf.addPage();
                        const canvas = await html2canvas(stageSheets[si], { scale, useCORS: true, allowTaint: true, backgroundColor: '#ffffff', logging: false, imageTimeout: 2000, removeContainer: true, onclone });
                        masterPdf.addImage(canvas.toDataURL('image/jpeg', quality), 'JPEG', 0, 0, pdfW, pdfH, undefined, 'FAST');
                        canvas.width = 0; canvas.height = 0;
                    }
                    job.generatedRecords.push({ ...record, _pdf_status: 'INCLUIDO' });
                }
            } catch (err) {
                console.error(`[pdfBatchRunner] Error en registro ${idx}`, err);
                job.errors.push({ idx: idx + 1, id: record.ID || record.id, message: err.message });
                job.generatedRecords.push({ ...record, _pdf_status: 'ERROR' });
                onError?.(idx + 1, err);
                window.__PdfBatchManager.notify(sessionId);
            }

            // Checkpoint cada N registros
            if ((idx + 1) % CHECKPOINT_INTERVAL === 0) {
                await saveCheckpoint(sessionId, { currentIndex: idx + 1, total: sourceRecords.length, savedAt: Date.now() });
            }

            // Ceder al navegador cada 5 registros
            if (idx % 5 === 0) await new Promise(r => setTimeout(r, 100));
        }

        // Guardar PDF consolidado
        if (generationMode === 'completo' && masterPdf && !job.isCancelled) {
            const consName = `Consolidado_${Date.now()}.pdf`;
            await saveBatchToDisk([{ filePath: `${outputFolder.replace(/\/$/, '')}/${consName}`, encoding: 'base64', content: masterPdf.output('datauristring').split(',')[1] }]);
            job.generatedRecords.forEach(r => { r._pdf_file = consName; r._pdf_status = 'CONSOLIDADO'; });
            GlobalDataRegistry.set(sessionId, [...job.generatedRecords]);
            streamer.createSession(sessionId, [...job.generatedRecords]);
        }

    } catch (fatalErr) {
        console.error('[pdfBatchRunner] Error fatal', fatalErr);
        job.errors.push({ idx: 0, id: 'FATAL', message: fatalErr.message });
    } finally {
        job.isGenerating = false;
        await clearCheckpoint(sessionId);
        window.__PdfBatchManager.history[sessionId] = {
            completedAt: new Date().toLocaleTimeString(),
            totalRecords: job.generatedRecords.length,
            errorsCount: job.errors.length,
            mode: generationMode,
            folder: outputFolder
        };
        window.__PdfBatchManager.notify(sessionId);

        onComplete?.({
            success: true,
            total: job.generatedRecords.length,
            errors: job.errors.length,
            outputFolder
        });
    }
}

async function saveBatchToDisk(files) {
    try {
        const resp = await fetch('/api/utils/save-files-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files })
        });
        if (!resp.ok) throw new Error(await resp.text());
    } catch (e) {
        // Fallback: guardar uno por uno
        for (const file of files) {
            await fetch('/api/utils/save-file', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filePath: file.filePath, encoding: 'base64', content: file.content })
            });
        }
    }
}
