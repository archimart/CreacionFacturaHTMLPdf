// Registro global de datos entre nodos (fuera de React para evitar diffing en arrays grandes)
export const GlobalDataRegistry = new Map();

// Gestor de trabajos PDF en segundo plano
if (typeof window !== 'undefined' && !window.__PdfBatchManager) {
    window.__PdfBatchManager = {
        activeJobs: {},
        subscribers: {},
        history: {},
        subscribe(sessionId, cb) {
            if (!this.subscribers[sessionId]) this.subscribers[sessionId] = new Set();
            this.subscribers[sessionId].add(cb);
            return () => this.subscribers[sessionId].delete(cb);
        },
        notify(sessionId) {
            if (this.subscribers[sessionId]) {
                this.subscribers[sessionId].forEach(cb => cb(this.activeJobs[sessionId]));
            }
            if (this.subscribers['ALL_JOBS']) {
                this.subscribers['ALL_JOBS'].forEach(cb => cb(this.activeJobs[sessionId]));
            }
        },
        cancel(sessionId) {
            if (this.activeJobs[sessionId]) {
                this.activeJobs[sessionId].isCancelled = true;
                this.activeJobs[sessionId].isGenerating = false;
                this.notify(sessionId);
            }
        }
    };
}
