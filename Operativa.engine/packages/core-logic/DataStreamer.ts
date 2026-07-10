/**
 * DataStreamer.ts
 * Motor de manejo de datos masivos (Data Pointer) para Operativa.engine
 */

export type DataChunk = {
    sessionId: string;
    startIndex: number;
    endIndex: number;
    records: any[];
    total: number;
};

export type StreamSubscriber = (data: DataChunk) => void;

export class DataStreamer {
    private static instance: DataStreamer;
    private sessions: Map<string, {
        rawSource: any[];
        worker: Worker | null;
        subscribers: Set<StreamSubscriber>;
    }> = new Map();
    // Suscriptores que llegaron antes de que se creara la sesión
    private pendingSubscribers: Map<string, Set<StreamSubscriber>> = new Map();

    private constructor() {}

    public static getInstance(): DataStreamer {
        if (!DataStreamer.instance) {
            DataStreamer.instance = new DataStreamer();
        }
        return DataStreamer.instance;
    }

    /**
     * Inicializa una sesión de datos masivos
     */
    public createSession(id: string, initialData: any[]): void {
        const existing = this.sessions.get(id);
        if (existing && existing.rawSource === initialData) return;

        // Preservar suscriptores antes de cerrar para que el panel de salida se actualice automáticamente
        const preservedSubscribers = existing
            ? new Set(existing.subscribers)
            : new Set<StreamSubscriber>();

        if (existing) {
            existing.worker?.terminate();
            this.sessions.delete(id);
        }
        
        // Creamos un Worker vía Blob para procesar transformaciones pesadas sin bloquear
        const workerCode = `
            let sourceData = [];

            self.onmessage = function(e) {
                const { action, data, code, startIndex, endIndex, sessionId } = e.data;
                
                if (action === 'INIT') {
                    sourceData = data;
                    self.postMessage({ action: 'READY' });
                }

                if (action === 'TRANSFORM') {
                    try {
                        const transformFn = new Function('items', code);
                        sourceData = transformFn(sourceData); // Guardamos el resultado AQUÍ, en el Worker
                        self.postMessage({ action: 'TRANSFORM_COMPLETE', count: sourceData.length });
                    } catch (err) {
                        self.postMessage({ action: 'ERROR', error: err.message });
                    }
                }

                if (action === 'GET_CHUNK') {
                    const { query } = e.data;
                    let filteredData = sourceData;
                    if (query) {
                        const q = query.toLowerCase().trim();
                        filteredData = sourceData.filter(row => 
                            Object.values(row).some(v => String(v).toLowerCase().includes(q))
                        );
                    }
                    const chunk = filteredData.slice(startIndex, endIndex);
                    self.postMessage({ action: 'CHUNK', chunk, startIndex, endIndex, total: filteredData.length });
                }
            };
        `;

        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const worker = new Worker(URL.createObjectURL(blob));

        worker.postMessage({ action: 'INIT', data: initialData });

        // Absorber suscriptores pendientes que llegaron antes de que existiera la sesión
        const pending = this.pendingSubscribers.get(id);
        if (pending) {
            pending.forEach(cb => preservedSubscribers.add(cb));
            this.pendingSubscribers.delete(id);
        }

        this.sessions.set(id, {
            rawSource: initialData,
            worker: worker,
            subscribers: preservedSubscribers
        });

        console.log(`%c[@engine/core-logic] Sesión creada: ${id} (${initialData.length} registros, ${preservedSubscribers.size} suscriptores)`, "color: #3b82f6; font-weight: bold;");

        // Si hay suscriptores esperando, enviarles el primer chunk automáticamente
        if (preservedSubscribers.size > 0) {
            const session = this.sessions.get(id)!;
            session.worker!.onmessage = (e: MessageEvent) => {
                if (e.data.action === 'CHUNK') {
                    const chunk: DataChunk = {
                        sessionId: id,
                        startIndex: e.data.startIndex,
                        endIndex:   e.data.endIndex,
                        records:    e.data.chunk,
                        total:      e.data.total
                    };
                    session.subscribers.forEach(sub => sub(chunk));
                }
            };
            session.worker!.postMessage({ action: 'GET_CHUNK', startIndex: 0, endIndex: 20, query: '' });
        }
    }

    /**
     * Suscribirse a cambios en una sesión.
     * Si la sesión aún no existe, encola el suscriptor para cuando se cree.
     */
    public subscribe(sessionId: string, callback: StreamSubscriber): () => void {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.subscribers.add(callback);
            return () => session.subscribers.delete(callback);
        }
        // Sesión no existe todavía → encolar
        if (!this.pendingSubscribers.has(sessionId)) {
            this.pendingSubscribers.set(sessionId, new Set());
        }
        this.pendingSubscribers.get(sessionId)!.add(callback);
        return () => this.pendingSubscribers.get(sessionId)?.delete(callback);
    }

    /**
     * Solicita un rango específico de datos (Puntero)
     */
    public requestRange(sessionId: string, startIndex: number, count: number = 100, query: string = ''): void {
        const session = this.sessions.get(sessionId);
        if (!session || !session.worker) return;

        const endIndex = startIndex + count;

        session.worker.onmessage = (e) => {
            if (e.data.action === 'CHUNK') {
                const chunk: DataChunk = {
                    sessionId,
                    startIndex: e.data.startIndex,
                    endIndex: e.data.endIndex,
                    records: e.data.chunk,
                    total: e.data.total
                };
                session.subscribers.forEach(sub => sub(chunk));
            }
        };

        session.worker.postMessage({
            action: 'GET_CHUNK',
            data: session.rawSource,
            startIndex,
            endIndex,
            query
        });
    }



    /**
     * Ejecuta una transformación pesada en el Worker y notifica a los suscriptores
     */
    public transform(sessionId: string, jsCode: string, onComplete: (count: number) => void): void {
        const session = this.sessions.get(sessionId);
        if (!session || !session.worker) return;

        const handler = (e: MessageEvent) => {
            if (e.data.action === 'TRANSFORM_COMPLETE') {
                session.worker?.removeEventListener('message', handler);
                onComplete(e.data.count);
            } else if (e.data.action === 'ERROR') {
                session.worker?.removeEventListener('message', handler);
                console.error(`%c[@engine/core-logic] Error: ${e.data.error}`, "color: #ef4444;");
            }
        };

        session.worker.addEventListener('message', handler);
        session.worker.postMessage({ action: 'TRANSFORM', code: jsCode });
    }

    public closeSession(id: string): void {
        const session = this.sessions.get(id);
        if (session) {
            session.worker?.terminate();
            this.sessions.delete(id);
        }
    }
}
