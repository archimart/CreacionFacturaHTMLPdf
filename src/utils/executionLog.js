const DB_NAME = 'OperativaExecutionsDB';
const STORE_CHECKPOINTS = 'checkpoints';
const STORE_HISTORY = 'history';

function initDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_CHECKPOINTS)) {
                db.createObjectStore(STORE_CHECKPOINTS);
            }
            if (!db.objectStoreNames.contains(STORE_HISTORY)) {
                const store = db.createObjectStore(STORE_HISTORY, { keyPath: 'id', autoIncrement: true });
                store.createIndex('wfName', 'wfName', { unique: false });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

// ─── Checkpoints (para resume en caso de fallo) ────────────────────────────

export async function saveCheckpoint(sessionId, data) {
    try {
        const db = await initDB();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_CHECKPOINTS, 'readwrite');
            tx.objectStore(STORE_CHECKPOINTS).put({ ...data, savedAt: Date.now() }, sessionId);
            tx.oncomplete = resolve;
        });
    } catch (e) { console.warn('[executionLog] saveCheckpoint error', e); }
}

export async function loadCheckpoint(sessionId) {
    try {
        const db = await initDB();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_CHECKPOINTS, 'readonly');
            const req = tx.objectStore(STORE_CHECKPOINTS).get(sessionId);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null);
        });
    } catch (e) { return null; }
}

export async function clearCheckpoint(sessionId) {
    try {
        const db = await initDB();
        const tx = db.transaction(STORE_CHECKPOINTS, 'readwrite');
        tx.objectStore(STORE_CHECKPOINTS).delete(sessionId);
    } catch (e) { console.warn('[executionLog] clearCheckpoint error', e); }
}

// ─── Historial de ejecuciones ──────────────────────────────────────────────

export async function saveExecutionLog(log) {
    try {
        const db = await initDB();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_HISTORY, 'readwrite');
            tx.objectStore(STORE_HISTORY).add({
                wfName:      log.wfName || 'desconocido',
                trigger:     log.trigger || 'manual',    // 'manual' | 'schedule' | 'runAll'
                startedAt:   log.startedAt || new Date().toISOString(),
                completedAt: log.completedAt || new Date().toISOString(),
                totalPdfs:   log.totalPdfs || 0,
                errors:      log.errors || 0,
                outputFolder:log.outputFolder || '',
                status:      log.status || 'success',    // 'success' | 'partial' | 'error'
                notes:       log.notes || ''
            });
            tx.oncomplete = resolve;
        });
    } catch (e) { console.warn('[executionLog] saveExecutionLog error', e); }
}

export async function listExecutions(wfName = null, limit = 50) {
    try {
        const db = await initDB();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_HISTORY, 'readonly');
            const store = tx.objectStore(STORE_HISTORY);
            const req = store.openCursor(null, 'prev');
            const results = [];
            req.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor && results.length < limit) {
                    const val = cursor.value;
                    if (!wfName || val.wfName === wfName) {
                        results.push(val);
                    }
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };
            req.onerror = () => resolve([]);
        });
    } catch (e) { return []; }
}
