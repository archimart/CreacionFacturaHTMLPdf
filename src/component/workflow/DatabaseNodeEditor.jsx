import React, { useState, useEffect } from 'react';
import { Database, FileSpreadsheet, Braces, UploadCloud, Table, Settings, Play, CheckCircle, AlertCircle, Loader2, ChevronRight, ChevronDown, Server, Workflow, RefreshCw, Search } from 'lucide-react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { DataStreamer } from '@engine/core-logic';
import { GlobalDataRegistry } from './registry';

// Utilidad simple para guardar/leer datasets masivos en IndexedDB (desarrollo/persistencia local)
const dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open("OperativaDataCache", 1);
    request.onupgradeneeded = (e) => {
        if (!e.target.result.objectStoreNames.contains("datasets")) {
            e.target.result.createObjectStore("datasets");
        }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
});

async function saveToCache(id, data) {
    try {
        const db = await dbPromise;
        return new Promise((resolve) => {
            const tx = db.transaction("datasets", "readwrite");
            tx.objectStore("datasets").put(data, id);
            tx.oncomplete = resolve;
        });
    } catch (e) { console.warn("No se pudo guardar en caché", e); }
}

async function loadFromCache(id) {
    try {
        const db = await dbPromise;
        return new Promise((resolve) => {
            const tx = db.transaction("datasets", "readonly");
            const req = tx.objectStore("datasets").get(id);
            req.onsuccess = () => resolve(req.result);
        });
    } catch (e) { return null; }
}

export default function DatabaseNodeEditor({ theme, data = {}, onUpdate, nodeId }) {
  // nid = identificador estable del nodo (node.id del grafo, no data.id que siempre era undefined)
  const nid = nodeId || data.id || 'temp';
  const [activeTab, setActiveTab] = useState(data.sourceType || 'excel');
  const [records, setRecords] = useState(() => GlobalDataRegistry.get(`${nid}-result`) || data.records || []);
  const [dbConfig, setDbConfig] = useState(data.dbConfig || { type: 'postgres', host: 'localhost', user: 'postgres', pass: '******', dbName: 'facturas_db', query: 'SELECT * FROM clientes LIMIT 50' });
  const [jsonText, setJsonText] = useState(() => {
    if (data.rawJson) return data.rawJson;
    if (data.sourceType === 'json' && data.records) return JSON.stringify(data.records, null, 2);
    return '[\n  {\n    "id": 1,\n    "nombre": "Cliente Ejemplo"\n  }\n]';
  });
  const [isTesting, setIsTesting] = useState(false);
  const [testStatus, setTestStatus] = useState(null);
  const [isParsing, setIsParsing] = useState(false);
  const [rawRecords, setRawRecords] = useState(() => GlobalDataRegistry.get(`${nid}-raw`) || data.rawRecords || data.records || []);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyDuplicates, setShowOnlyDuplicates] = useState(false);
  const [sortConfig, setSortConfig] = useState(data.sortConfig || { field: '', order: 'asc' });
  const [groupConfig, setGroupConfig] = useState(data.groupConfig || { field: '', aggr: 'count' });

  const streamer = DataStreamer.getInstance();
  const sessionId = data.dataKey || `db-data-${nid}`;
  const [chunk, setChunk] = useState({ records: [], total: 0, startIndex: 0, endIndex: 0 });
  const currentPage = Math.floor(chunk.startIndex / 20);

  // Restaurar records de IndexedDB si la página se recargó y no están en memoria
  useEffect(() => {
    if (records.length === 0) {
        loadFromCache(nid).then(cachedData => {
            if (cachedData && cachedData.length > 0) {
                GlobalDataRegistry.set(`${nid}-raw`, cachedData);
                setRawRecords(cachedData);
                // Aplicar configuraciones existentes al caché cargado
                if (data.sortConfig?.field || data.groupConfig?.field) {
                    applyTransformations(cachedData, data.sortConfig || sortConfig, data.groupConfig || groupConfig);
                } else {
                    GlobalDataRegistry.set(`${nid}-result`, cachedData);
                    setRecords(cachedData);
                }
            }
        });
    }
    // Limpiar records de la data de React Flow para evitar congelamiento
    if (data.records && data.records.length > 0) {
        GlobalDataRegistry.set(`${nid}-raw`, data.rawRecords || data.records);
        GlobalDataRegistry.set(`${nid}-result`, data.records);
        setRawRecords(data.rawRecords || data.records);
        setRecords(data.records);
        onUpdate({ records: undefined, rawRecords: undefined });
    }
  }, [nid]);

  // Inicializamos sesión en el streamer
  useEffect(() => {
    if (records.length > 0) {
        streamer.createSession(sessionId, records);
        GlobalDataRegistry.set(sessionId, records);
        GlobalDataRegistry.set(`db-data-${nid}`, records);
        const unsubscribe = streamer.subscribe(sessionId, (newChunk) => {
            setChunk(newChunk);
        });
        streamer.requestRange(sessionId, currentPage * 20, 20, searchTerm);
        return () => {
            unsubscribe();
            // Mantenemos la sesión viva para el sidebar y nodos downstream
        };
    }
  }, [records, sessionId]);

  // Manejo de búsqueda off-thread
  useEffect(() => {
    const timeout = setTimeout(() => {
        streamer.requestRange(sessionId, 0, 20, searchTerm);
    }, 500);
    return () => clearTimeout(timeout);
  }, [searchTerm, sessionId]);

  const [expandedRow, setExpandedRow] = useState(null); // id of current expanded row
  const [selectedDb, setSelectedDb] = useState(data.dbConfig?.dbName || data.selectedDb || '');
  const [selectedTable, setSelectedTable] = useState(data.dbConfig?.tableName || data.selectedTable || '');
  const [step, setStep] = useState(1); 

  const handleConnect = () => {
    setIsTesting(true);
    setTimeout(() => {
        setStep(2);
        setIsTesting(false);
    }, 800);
  };

  const handleSelectDb = (db) => {
    setSelectedDb(db);
    setDbConfig({ ...dbConfig, dbName: db });
    setStep(3);
  };

  const handleSelectTable = (table) => {
    setSelectedTable(table);
    setDbConfig({ ...dbConfig, tableName: table, query: `SELECT * FROM ${table} LIMIT 100` });
    setStep(4);
  };

  const handleTestQuery = () => {
    setIsTesting(true);
    setTestStatus(null);
    setTimeout(() => {
        if (dbConfig.query.toUpperCase().includes('SELECT')) {
            const dummyData = Array.from({ length: 5 }).map((_, i) => ({
                id: i + 1,
                nombre: "Ejemplo " + (i + 1),
                fecha: new Date().toLocaleDateString()
            }));
            const key = `db-data-${nid}`;
            streamer.createSession(key, dummyData);
            setTestStatus('success');
            onUpdate({ dataKey: key, sourceType: 'db', dbConfig, selectedDb, selectedTable });
        } else {
            setTestStatus('error');
        }
        setIsTesting(false);
    }, 1000);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    if (file.name.endsWith('.csv')) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
            handleDataParsed(results.data, 'excel');
            setIsParsing(false);
        }
      });
    } else if (file.name.endsWith('.xlsx')) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
            const bstr = evt.target.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const dataJson = XLSX.utils.sheet_to_json(wb.Sheets[wsname]);
            handleDataParsed(dataJson, 'excel');
        } catch (err) {
            console.error(err);
        } finally {
            setIsParsing(false);
        }
      };
      reader.readAsBinaryString(file);
    }
  };

  const handleDataParsed = (newData, type) => {
    const key = `db-data-${nid}`;
    GlobalDataRegistry.set(`${nid}-raw`, newData);
    setRawRecords(newData);
    
    // Guardar en IndexedDB para persistencia entre recargas
    saveToCache(nid, newData);

    // Si ya existe una configuración de agrupación/orden, aplicarla automáticamente
    if (sortConfig.field || groupConfig.field) {
        applyTransformations(newData, sortConfig, groupConfig);
    } else {
        GlobalDataRegistry.set(`${nid}-result`, newData);
        GlobalDataRegistry.set(key, newData);
        GlobalDataRegistry.set(sessionId, newData);
        streamer.createSession(key, newData);
        streamer.requestRange(key, 0, 20);
        setRecords(newData);
    }

    onUpdate({ dataKey: key, sourceType: type, records: undefined, rawRecords: undefined });
  };

  const applyTransformations = (rawRecords, sort = sortConfig, group = groupConfig) => {
    if (!rawRecords || rawRecords.length === 0) return;
    
    setIsParsing(true); // Reusamos isParsing como estado de carga general

    // Usamos setTimeout para sacar la ejecución del hilo principal y no bloquear la UI
    setTimeout(() => {
        let result = [...rawRecords];

        // 1. Agrupación (Grouping)
        if (group.field) {
            const groups = new Map();
            for (let i = 0; i < result.length; i++) {
                const row = result[i];
                const val = row[group.field];
                const key = (val !== undefined && val !== null) ? String(val).trim() : 'null';
                
                if (!groups.has(key)) {
                    groups.set(key, { ...row, _count: 1, items: [{ ...row }] });
                } else {
                    const g = groups.get(key);
                    g._count++;
                    g.items.push({ ...row });
                    
                    if (group.aggr === 'sum') {
                        for (const k in row) {
                            if (k === group.field || k === 'items' || k === '_count') continue;
                            const numVal = parseFloat(row[k]);
                            if (!isNaN(numVal)) {
                                g[k] = (parseFloat(g[k] || 0) + numVal);
                            }
                        }
                    }
                }
            }
            
            result = Array.from(groups.values()).map(g => ({
                ...g,
                [group.field + '_cantidad']: g._count, 
                cantidad_grupo: g._count,
            }));
        }

        // 2. Ordenación (Sorting)
        if (sort.field) {
            const order = sort.order === 'asc' ? 1 : -1;
            result.sort((a, b) => {
                const va = a[sort.field];
                const vb = b[sort.field];
                if (va < vb) return -1 * order;
                if (va > vb) return 1 * order;
                return 0;
            });
        }

        const key = `db-data-${nid}`;
        GlobalDataRegistry.set(`${nid}-result`, result);
        GlobalDataRegistry.set(key, result);
        GlobalDataRegistry.set(sessionId, result);
        streamer.createSession(key, result);
        streamer.requestRange(key, 0, 20);
        setRecords(result);
        onUpdate({ 
            dataKey: key,
            sortConfig: sort, 
            groupConfig: group,
        });
        setIsParsing(false);
    }, 10);
  };

  const handleReset = () => {
    setRecords([]);
    setRawRecords([]);
    setStep(1);
    setSelectedDb('');
    setSelectedTable('');
    setSortConfig({ field: '', order: 'asc' });
    setGroupConfig({ field: '', aggr: 'count' });
    onUpdate({ sourceType: activeTab });
  };

  const handleJsonManual = () => {
    try {
        const parsed = JSON.parse(jsonText);
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        setRecords(arr);
        onUpdate({ sourceType: 'json', rawJson: jsonText });
    } catch(err) {
        console.error("JSON Inválido", err);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%', background: 'var(--panel-bg)', color: 'var(--node-text)' }}>
      
      {/* SIDEBAR TABS */}
      <div style={{ width: 220, background: 'var(--editor-sidebar)', borderRight: '1px solid var(--editor-border)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: 20, fontWeight: 900, fontSize: 12, borderBottom: '1px solid var(--editor-border)', color: 'var(--node-desc)' }}>ORIGEN DE DATOS</div>
          <button onClick={() => setActiveTab('excel')} style={{ padding: '15px 20px', border: 'none', background: activeTab === 'excel' ? 'var(--panel-bg)' : 'transparent', color: 'var(--node-text)', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: activeTab === 'excel' ? 800 : 600, borderLeft: activeTab === 'excel' ? '4px solid #3b82f6' : '4px solid transparent' }}>
              <FileSpreadsheet size={18} /> Excel / CSV
          </button>
          <button onClick={() => setActiveTab('json')} style={{ padding: '15px 20px', border: 'none', background: activeTab === 'json' ? 'var(--panel-bg)' : 'transparent', color: 'var(--node-text)', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: activeTab === 'json' ? 800 : 600, borderLeft: activeTab === 'json' ? '4px solid #3b82f6' : '4px solid transparent' }}>
              <Braces size={18} /> JSON Directo
          </button>
          <button onClick={() => setActiveTab('db')} style={{ padding: '15px 20px', border: 'none', background: activeTab === 'db' ? 'var(--panel-bg)' : 'transparent', color: 'var(--node-text)', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: activeTab === 'db' ? 800 : 600, borderLeft: activeTab === 'db' ? '4px solid #3b82f6' : '4px solid transparent' }}>
              <Database size={18} /> Base Datos SQL
          </button>
          
          <div style={{ marginTop: 'auto', padding: 20, background: 'var(--editor-header)', borderTop: '1px solid var(--editor-border)', fontSize: 11 }}>
              <div style={{ marginBottom: 10, fontWeight: 700 }}>Modo: Data Pointer Activo</div>
              <div style={{ marginBottom: 10, color: 'var(--node-desc)' }}>ID: {data.dataKey || 'Sin datos'}</div>
              {records.length > 0 && (
                  <button 
                    onClick={handleReset}
                    style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1.5px solid #ef4444', color: '#ef4444', background: 'transparent', cursor: 'pointer', fontWeight: 800, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    <RefreshCw size={14} /> Limpiar Datos
                  </button>
              )}
          </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div style={{ flex: 1, padding: 40, overflowY: 'auto' }}>
          {activeTab === 'excel' && (
              <div>
                  <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 20 }}>Importar Archivo</h2>
                  <div style={{ height: 350, border: '2px dashed var(--editor-border)', borderRadius: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--editor-header)', position: 'relative' }}>
                   {isParsing ? (
                       <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 15 }}>
                           <Loader2 size={48} className="animate-spin" style={{ color: '#3b82f6' }} />
                           <div style={{ fontWeight: 700, fontSize: 18 }}>Procesando Archivo...</div>
                           <div style={{ color: 'var(--node-desc)', fontSize: 13 }}>Estamos analizando las celdas de tu Excel</div>
                       </div>
                   ) : (
                       <>
                           <UploadCloud size={60} style={{ color: 'var(--node-desc)', marginBottom: 20 }} />
                           <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>Arrastra tu archivo aquí o haz clic para buscar</h3>
                           <input type="file" accept=".xlsx,.csv" onChange={handleFileUpload} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
                           <div style={{ padding: '10px 25px', background: '#3b82f6', color: '#fff', borderRadius: 8, fontWeight: 800, fontSize: 14 }}>Elegir archivo</div>
                       </>
                   )}
                  </div>
              </div>
          )}

          {activeTab === 'json' && (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                     <h2 style={{ fontSize: 22, fontWeight: 800 }}>Editor JSON</h2>
                     <button onClick={handleJsonManual} style={{ padding: '8px 20px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>Procesar</button>
                  </div>
                  <textarea 
                    value={jsonText} onChange={e => setJsonText(e.target.value)}
                    style={{ flex: 1, width: '100%', minHeight: 400, fontFamily: 'monospace', padding: 20, borderRadius: 12, border: '1px solid var(--editor-border)', background: 'var(--input-bg)', color: 'var(--input-text)', fontSize: 13 }} 
                  />
              </div>
          )}

          {activeTab === 'db' && (
              <div>
                   <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 25 }}>Conexión SQL</h2>
                   <div style={{ display: 'flex', gap: 15, marginBottom: 30 }}>
                       <div style={{ flex: 1, height: 4, background: step >= 1 ? '#3b82f6' : 'var(--editor-border)', borderRadius: 2 }} />
                       <div style={{ flex: 1, height: 4, background: step >= 2 ? '#3b82f6' : 'var(--editor-border)', borderRadius: 2 }} />
                       <div style={{ flex: 1, height: 4, background: step >= 3 ? '#3b82f6' : 'var(--editor-border)', borderRadius: 2 }} />
                       <div style={{ flex: 1, height: 4, background: step >= 4 ? '#3b82f6' : 'var(--editor-border)', borderRadius: 2 }} />
                   </div>

                   {step === 1 && (
                      <div style={{ display: 'grid', gap: 15, maxWidth: 500 }}>
                          <input type="text" placeholder="Host (ej: localhost)" value={dbConfig.host} onChange={e => setDbConfig({...dbConfig, host: e.target.value})} style={{ padding: 12, borderRadius: 8, border: '1px solid var(--editor-border)', background: 'var(--input-bg)', color: 'var(--input-text)' }} />
                          <input type="text" placeholder="Usuario" value={dbConfig.user} onChange={e => setDbConfig({...dbConfig, user: e.target.value})} style={{ padding: 12, borderRadius: 8, border: '1px solid var(--editor-border)', background: 'var(--input-bg)', color: 'var(--input-text)' }} />
                          <input type="password" placeholder="Contraseña" value={dbConfig.pass} onChange={e => setDbConfig({...dbConfig, pass: e.target.value})} style={{ padding: 12, borderRadius: 8, border: '1px solid var(--editor-border)', background: 'var(--input-bg)', color: 'var(--input-text)' }} />
                          <button onClick={handleConnect} disabled={isTesting} style={{ padding: 15, background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 800 }}>
                              {isTesting ? 'Conectando...' : 'Conectar'}
                          </button>
                      </div>
                   )}

                   {step === 2 && (
                       <div style={{ display: 'grid', gap: 10 }}>
                           <h3 style={{ fontSize: 16, fontWeight: 700 }}>Selecciona Base de Datos:</h3>
                           {['db_produccion', 'db_clientes', 'db_ventas'].map(db => (
                               <button key={db} onClick={() => handleSelectDb(db)} style={{ padding: 15, textAlign: 'left', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer' }}>{db}</button>
                           ))}
                       </div>
                   )}

                   {step === 3 && (
                       <div style={{ display: 'grid', gap: 10 }}>
                           <h3 style={{ fontSize: 16, fontWeight: 700 }}>Selecciona Tabla (en {selectedDb}):</h3>
                           {['clientes', 'facturas', 'usuarios'].map(t => (
                               <button key={t} onClick={() => handleSelectTable(t)} style={{ padding: 15, textAlign: 'left', background: 'var(--input-bg)', color: 'var(--input-text)', border: '1px solid var(--editor-border)', borderRadius: 8, cursor: 'pointer' }}>{t}</button>
                           ))}
                       </div>
                   )}

                   {step === 4 && (
                       <div>
                           <textarea value={dbConfig.query} onChange={e => setDbConfig({...dbConfig, query: e.target.value})} style={{ width: '100%', height: 120, padding: 15, border: '1px solid var(--editor-border)', background: 'var(--input-bg)', color: 'var(--input-text)', borderRadius: 8, fontFamily: 'monospace', marginBottom: 15 }} />
                           <button onClick={handleTestQuery} disabled={isTesting} style={{ width: '100%', padding: 15, background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 800 }}>
                               {isTesting ? 'Ejecutando...' : 'Obtener Datos'}
                           </button>
                           {testStatus === 'success' && <p style={{ color: '#10b981', marginTop: 10, fontSize: 13 }}>✓ Datos recuperados correctamente.</p>}
                       </div>
                   )}
              </div>
          )}

          {records.length > 0 && (
              <div style={{ marginTop: 40, padding: 20, background: 'var(--surface-glass)', borderRadius: 16, border: '1px solid var(--editor-border)' }}>
                  <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}><Workflow size={18} /> Procesamiento de Datos</h3>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                      {/* SORTING */}
                      <div>
                          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--node-desc)', display: 'block', marginBottom: 8 }}>ORDENAR POR</label>
                          <div style={{ display: 'flex', gap: 10 }}>
                              <select 
                                value={sortConfig.field} 
                                onChange={e => {
                                    const next = { ...sortConfig, field: e.target.value };
                                    setSortConfig(next);
                                    applyTransformations(rawRecords, next, groupConfig);
                                }}
                                style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid var(--editor-border)', background: 'var(--input-bg)', color: 'var(--input-text)' }}
                              >
                                  <option value="">(Sin orden)</option>
                                  {Object.keys((rawRecords && rawRecords.length > 0 ? rawRecords[0] : (records[0] || {}))).map(k => <option key={k} value={k}>{k}</option>)}
                              </select>
                              <button 
                                onClick={() => {
                                    const next = { ...sortConfig, order: sortConfig.order === 'asc' ? 'desc' : 'asc' };
                                    setSortConfig(next);
                                    applyTransformations(rawRecords, next, groupConfig);
                                }}
                                style={{ padding: 10, background: 'var(--input-bg)', border: '1px solid var(--editor-border)', borderRadius: 8, color: 'var(--input-text)', cursor: 'pointer' }}
                              >
                                {sortConfig.order === 'asc' ? 'ASC' : 'DESC'}
                              </button>
                          </div>
                      </div>

                      {/* GROUPING */}
                      <div>
                          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--node-desc)', display: 'block', marginBottom: 8 }}>AGRUPAR POR CAMPO (REPETIDOS)</label>
                          <div style={{ display: 'flex', gap: 10 }}>
                              <select 
                                value={groupConfig.field} 
                                onChange={e => {
                                    const next = { ...groupConfig, field: e.target.value };
                                    setGroupConfig(next);
                                    applyTransformations(rawRecords, sortConfig, next);
                                }}
                                style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid var(--editor-border)', background: 'var(--input-bg)', color: 'var(--input-text)' }}
                              >
                                  <option value="">(No agrupar)</option>
                                  {Object.keys((rawRecords && rawRecords.length > 0 ? rawRecords[0] : (records[0] || {}))).map(k => <option key={k} value={k}>{k}</option>)}
                              </select>
                              <select 
                                value={groupConfig.aggr} 
                                onChange={e => {
                                    const next = { ...groupConfig, aggr: e.target.value };
                                    setGroupConfig(next);
                                    applyTransformations(rawRecords, sortConfig, next);
                                }}
                                style={{ width: 140, padding: 10, borderRadius: 8, border: '1px solid var(--editor-border)', background: 'var(--input-bg)', color: 'var(--input-text)' }}
                              >
                                  <option value="count">Contar (Frecuencia)</option>
                                  <option value="sum">Sumar (Totales)</option>
                                  <option value="anidar">Anidar (Sub-registros)</option>
                              </select>
                          </div>
                          {groupConfig.field && (
                              <p style={{ fontSize: 10, color: '#10b981', marginTop: 5, fontWeight: 600 }}>
                                 {groupConfig.aggr === 'count' && `Se contará cuántas veces se repite cada valor.`}
                                 {groupConfig.aggr === 'sum' && `Se sumarán los valores numéricos de las filas repetidas.`}
                                 {groupConfig.aggr === 'anidar' && `Se creará un registro maestro con una lista interna 'items' que contiene todos los detalles.`}
                              </p>
                          )}
                      </div>
                  </div>
              </div>
          )}

          {records.length > 0 && (
              <div style={{ marginTop: 40 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                      <h3 style={{ fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}><Table size={18} /> Previsualización</h3>
                      <div style={{ display: 'flex', gap: 15, alignItems: 'center' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', color: showOnlyDuplicates ? '#3b82f6' : 'var(--node-desc)' }}>
                              <input type="checkbox" checked={showOnlyDuplicates} onChange={e => setShowOnlyDuplicates(e.target.checked)} />
                              Ver solo duplicados
                          </label>
                          <div style={{ position: 'relative' }}>
                              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--node-desc)' }} />
                              <input 
                                type="text" 
                                placeholder="Buscar..." 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                style={{ padding: '8px 10px 8px 32px', borderRadius: 8, border: '1px solid var(--editor-border)', background: 'var(--input-bg)', color: 'var(--input-text)', fontSize: 11, width: 150 }}
                              />
                          </div>
                      </div>
                  </div>

                  <div style={{ borderRadius: 12, border: '1px solid var(--editor-border)', overflowX: 'auto', overflowY: 'hidden' }}>
                      <table style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'collapse', fontSize: 11, color: 'var(--node-text)' }}>
                          <thead>
                              <tr style={{ background: 'var(--editor-header)', borderBottom: '2px solid var(--editor-border)', color: 'var(--node-text)' }}>
                                  <th style={{ width: 30 }}></th>
                                  {chunk.records[0] && Object.keys(chunk.records[0]).filter(k => k !== 'items').map(k => <th key={k} style={{ padding: 12, textAlign: 'left', fontWeight: 800 }}>{k.toUpperCase()}</th>)}
                              </tr>
                          </thead>
                          <tbody>
                              {(showOnlyDuplicates ? chunk.records.filter(r => (r.cantidad_grupo || 1) > 1) : chunk.records).map((r, i) => (
                                  <tr key={i} style={{ borderBottom: '1px solid var(--editor-border)' }}>
                                      <td style={{ textAlign: 'center' }}></td>
                                      {Object.keys(chunk.records[0] || {}).filter(k => k !== 'items').map(k => (
                                          <td key={k} style={{ padding: 12 }}>{String(r[k])}</td>
                                      ))}
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                      
                      <div style={{ padding: 15, background: 'var(--editor-header)', display: 'flex', justifyContent: 'center', gap: 10 }}>
                          <button 
                            disabled={currentPage === 0}
                            onClick={() => {
                                const nextPage = currentPage - 1;
                                if (nextPage >= 0) streamer.requestRange(sessionId, nextPage * 20, 20, searchTerm);
                            }}
                            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--editor-border)', background: 'var(--btn-bg)', color: 'var(--node-text)', cursor: 'pointer' }}
                          >Anterior</button>
                          <span style={{ fontSize: 12, fontWeight: 700 }}>Página {chunk.total === 0 ? 0 : currentPage + 1} de {Math.max(1, Math.ceil(chunk.total / 20))}</span>
                          <button 
                            disabled={(currentPage + 1) * 20 >= chunk.total}
                            onClick={() => {
                                const nextPage = currentPage + 1;
                                if (nextPage * 20 < chunk.total) streamer.requestRange(sessionId, nextPage * 20, 20, searchTerm);
                            }}
                            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--editor-border)', background: 'var(--btn-bg)', color: 'var(--node-text)', cursor: 'pointer' }}
                          >Siguiente</button>
                      </div>
                  </div>
              </div>
          )}
      </div>
    </div>
  );
}
