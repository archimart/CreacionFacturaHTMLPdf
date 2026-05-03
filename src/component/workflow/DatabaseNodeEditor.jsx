import React, { useState, useEffect } from 'react';
import { Database, FileSpreadsheet, Braces, UploadCloud, Table, Settings, Play, CheckCircle, AlertCircle, Loader2, ChevronRight, ChevronDown, Server, Workflow, RefreshCw, Search } from 'lucide-react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

export default function DatabaseNodeEditor({ theme, data = {}, onUpdate }) {
  const [activeTab, setActiveTab] = useState(data.sourceType || 'excel');
  const [records, setRecords] = useState(data.records || []);
  const [dbConfig, setDbConfig] = useState(data.dbConfig || { type: 'postgres', host: 'localhost', user: 'postgres', pass: '******', dbName: 'facturas_db', query: 'SELECT * FROM clientes LIMIT 50' });
  const [jsonText, setJsonText] = useState(() => {
    if (data.rawJson) return data.rawJson;
    if (data.sourceType === 'json' && data.records) return JSON.stringify(data.records, null, 2);
    return '[\n  {\n    "id": 1,\n    "nombre": "Cliente Ejemplo"\n  }\n]';
  });
  const [isTesting, setIsTesting] = useState(false);
  const [testStatus, setTestStatus] = useState(null);
  const [isParsing, setIsParsing] = useState(false);
  const [rawRecords, setRawRecords] = useState(data.rawRecords || data.records || []);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyDuplicates, setShowOnlyDuplicates] = useState(false);
  const [sortConfig, setSortConfig] = useState(data.sortConfig || { field: '', order: 'asc' });
  const [groupConfig, setGroupConfig] = useState(data.groupConfig || { field: '', aggr: 'count' });

  // Sync state from props if they change externally (e.g. undo/redo or initial load)
  useEffect(() => {
    if (data.rawRecords) setRawRecords(data.rawRecords);
    if (data.records) setRecords(data.records);
    if (data.sortConfig) setSortConfig(data.sortConfig);
    if (data.groupConfig) setGroupConfig(data.groupConfig);
  }, [data.id]); 

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
            setRecords(dummyData);
            setTestStatus('success');
            onUpdate({ records: dummyData, sourceType: 'db', dbConfig, selectedDb, selectedTable });
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
    setRawRecords(newData);
    setRecords(newData);
    setSortConfig({ field: '', order: 'asc' });
    setGroupConfig({ field: '', aggr: 'count' });
    onUpdate({ records: newData, rawRecords: newData, sourceType: type });
  };

  const applyTransformations = (rawRecords, sort = sortConfig, group = groupConfig) => {
    let result = [...rawRecords];

    // 1. Grouping
    if (group.field) {
        const groups = {};
        result.forEach(row => {
            const val = row[group.field];
            const key = (val !== undefined && val !== null) ? String(val).trim() : 'null';
            if (!groups[key]) {
                groups[key] = { ...row, _count: 1, items: [{ ...row }] };
            } else {
                groups[key]._count++;
                groups[key].items.push({ ...row });
                // Aggregate numeric fields if SUM is selected
                if (group.aggr === 'sum') {
                    Object.keys(row).forEach(k => {
                        if (k === group.field || k === 'items') return;
                        const val = row[k];
                        if (typeof val === 'number') {
                            groups[key][k] += val;
                        } else if (typeof val === 'string' && !isNaN(parseFloat(val))) {
                            groups[key][k] = (parseFloat(groups[key][k]) + parseFloat(val)).toString();
                        }
                    });
                }
            }
        });
        // After grouping, map back to array
        result = Object.values(groups).map(g => ({
            ...g,
            [group.field + '_cantidad']: g._count, 
            cantidad_grupo: g._count,
        }));
    } else {
        // If no grouping, ensure cantidad_grupo is not there to not mess with filters
        result = result.map(r => {
            const { cantidad_grupo, items, ...rest } = r;
            return rest;
        });
    }

    // 2. Sorting
    if (sort.field) {
        result.sort((a, b) => {
            const va = a[sort.field];
            const vb = b[sort.field];
            if (va < vb) return sort.order === 'asc' ? -1 : 1;
            if (va > vb) return sort.order === 'asc' ? 1 : -1;
            return 0;
        });
    }

    setRecords(result);
    onUpdate({ 
        records: result, 
        rawRecords: rawRecords,
        sortConfig: sort, 
        groupConfig: group,
    });
  };

  const handleReset = () => {
    setRecords([]);
    setRawRecords([]);
    setStep(1);
    setSelectedDb('');
    setSelectedTable('');
    setSortConfig({ field: '', order: 'asc' });
    setGroupConfig({ field: '', aggr: 'count' });
    onUpdate({ records: [], rawRecords: [], sourceType: activeTab });
  };

  const handleJsonManual = () => {
    try {
        const parsed = JSON.parse(jsonText);
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        setRecords(arr);
        onUpdate({ records: arr, sourceType: 'json', rawJson: jsonText });
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
              <div style={{ marginBottom: 10, fontWeight: 700 }}>Registros cargados: {records.length}</div>
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

                  <div style={{ borderRadius: 12, border: '1px solid var(--editor-border)', overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, color: 'var(--node-text)' }}>
                          <thead>
                              <tr style={{ background: 'var(--editor-header)', borderBottom: '2px solid var(--editor-border)', color: 'var(--node-text)' }}>
                                  <th style={{ width: 30 }}></th>
                                  {Object.keys(records[0]).filter(k => k !== 'items').map(k => <th key={k} style={{ padding: 12, textAlign: 'left', fontWeight: 800 }}>{k.toUpperCase()}</th>)}
                                  {groupConfig.field && <th style={{ padding: 12, textAlign: 'center', fontWeight: 800 }}>INFO</th>}
                              </tr>
                          </thead>
                          <tbody>
                              {records
                                .filter(r => !searchTerm || JSON.stringify(r).toLowerCase().includes(searchTerm.toLowerCase()))
                                .filter(r => !showOnlyDuplicates || (r.cantidad_grupo > 1))
                                .slice(0, 50)
                                .map((r, i) => {
                                    const hasItems = Array.isArray(r.items);
                                    const isExpanded = expandedRow === i;
                                    return (
                                        <React.Fragment key={i}>
                                            <tr style={{ borderBottom: '1px solid var(--editor-border)', background: isExpanded ? 'rgba(59, 130, 246, 0.05)' : 'transparent' }}>
                                                <td style={{ textAlign: 'center' }}>
                                                    {hasItems && (
                                                        <button 
                                                            onClick={() => setExpandedRow(isExpanded ? null : i)}
                                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                        >
                                                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                        </button>
                                                    )}
                                                </td>
                                                {Object.keys(records[0]).filter(k => k !== 'items').map(k => (
                                                    <td key={k} style={{ padding: 12 }}>{String(r[k])}</td>
                                                ))}
                                                {groupConfig.field && (
                                                    <td style={{ padding: 12, textAlign: 'center' }}>
                                                         <div style={{ padding: '4px 8px', borderRadius: 12, background: r.cantidad_grupo > 1 ? 'rgba(59, 130, 246, 0.1)' : '#f1f5f9', color: r.cantidad_grupo > 1 ? '#3b82f6' : '#64748b', fontSize: 10, fontWeight: 800 }}>
                                                            {r.cantidad_grupo} fil.
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                            {isExpanded && hasItems && (
                                                <tr>
                                                    <td colSpan={Object.keys(records[0]).length + 2} style={{ padding: '0 0 15px 40px', background: 'rgba(59, 130, 246, 0.02)' }}>
                                                        <div style={{ borderLeft: '2px solid #3b82f6', paddingLeft: 15, marginTop: 10 }}>
                                                            <div style={{ fontWeight: 800, fontSize: 10, marginBottom: 8, color: '#3b82f6' }}>LÍNEAS ANIDADAS (DETALLE)</div>
                                                            <table style={{ width: '100%', background: 'var(--editor-bg)', border: '1px solid var(--editor-border)', borderRadius: 8 }}>
                                                                <thead style={{ background: 'var(--editor-header)' }}>
                                                                    <tr>
                                                                        {Object.keys(r.items[0]).map(k => <th key={k} style={{ padding: 6, fontSize: 9, textAlign: 'left' }}>{k}</th>)}
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {r.items.map((item, idx) => (
                                                                        <tr key={idx} style={{ borderBottom: '1px solid var(--editor-border)' }}>
                                                                            {Object.keys(r.items[0]).map(k => <td key={k} style={{ padding: 6, fontSize: 10 }}>{String(item[k])}</td>)}
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                          </tbody>
                      </table>
                  </div>
              </div>
          )}
      </div>
    </div>
  );
}
