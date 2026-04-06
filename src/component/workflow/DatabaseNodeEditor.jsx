import React, { useState } from 'react';
import { Database, FileSpreadsheet, Braces, UploadCloud, Table, Settings, Play, CheckCircle, AlertCircle, Loader2, ChevronRight, Server, Workflow, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

export default function DatabaseNodeEditor({ data = {}, onUpdate }) {
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

    if (file.name.endsWith('.csv')) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => handleDataParsed(results.data, 'excel')
      });
    } else if (file.name.endsWith('.xlsx')) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const dataJson = XLSX.utils.sheet_to_json(wb.Sheets[wsname]);
        handleDataParsed(dataJson, 'excel');
      };
      reader.readAsBinaryString(file);
    }
  };

  const handleDataParsed = (newData, type) => {
    setRecords(newData);
    onUpdate({ records: newData, sourceType: type });
  };

  const handleJsonManual = () => {
    try {
        const parsed = JSON.parse(jsonText);
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        setRecords(arr);
        onUpdate({ records: arr, sourceType: 'json', rawJson: jsonText });
        if (onToast) onToast("JSON procesado con éxito");
    } catch(err) {
        if (onToast) onToast("JSON Inválido - Revisa el formato", "error");
        else console.error("JSON Inválido", err);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%', background: '#fff', color: '#1e293b' }}>
      
      {/* SIDEBAR TABS */}
      <div style={{ width: 220, background: '#f8fafc', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: 20, fontWeight: 900, fontSize: 12, borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>ORIGEN DE DATOS</div>
          <button onClick={() => setActiveTab('excel')} style={{ padding: '15px 20px', border: 'none', background: activeTab === 'excel' ? '#fff' : 'transparent', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: activeTab === 'excel' ? 800 : 600, borderLeft: activeTab === 'excel' ? '4px solid #3b82f6' : '4px solid transparent' }}>
              <FileSpreadsheet size={18} /> Excel / CSV
          </button>
          <button onClick={() => setActiveTab('json')} style={{ padding: '15px 20px', border: 'none', background: activeTab === 'json' ? '#fff' : 'transparent', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: activeTab === 'json' ? 800 : 600, borderLeft: activeTab === 'json' ? '4px solid #3b82f6' : '4px solid transparent' }}>
              <Braces size={18} /> JSON Directo
          </button>
          <button onClick={() => setActiveTab('db')} style={{ padding: '15px 20px', border: 'none', background: activeTab === 'db' ? '#fff' : 'transparent', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: activeTab === 'db' ? 800 : 600, borderLeft: activeTab === 'db' ? '4px solid #3b82f6' : '4px solid transparent' }}>
              <Database size={18} /> Base Datos SQL
          </button>
          
          <div style={{ marginTop: 'auto', padding: 20, background: '#f1f5f9', fontSize: 11 }}>
              <strong>Registros:</strong> {records.length}
          </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div style={{ flex: 1, padding: 40, overflowY: 'auto' }}>
          {activeTab === 'excel' && (
              <div>
                  <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 20 }}>Importar Archivo</h2>
                  <div style={{ border: '2px dashed #e2e8f0', borderRadius: 12, padding: 40, textAlign: 'center' }}>
                      <UploadCloud size={48} color="#94a3b8" style={{ marginBottom: 15 }} />
                      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 20 }}>Arrastra tu archivo aquí o haz clic para buscar</p>
                      <input type="file" accept=".xlsx,.csv" onChange={handleFileUpload} />
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
                    style={{ flex: 1, width: '100%', minHeight: 400, fontFamily: 'monospace', padding: 20, borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }} 
                  />
              </div>
          )}

          {activeTab === 'db' && (
              <div>
                   <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 25 }}>Conexión SQL</h2>
                   <div style={{ display: 'flex', gap: 15, marginBottom: 30 }}>
                       <div style={{ flex: 1, height: 4, background: step >= 1 ? '#3b82f6' : '#e2e8f0', borderRadius: 2 }} />
                       <div style={{ flex: 1, height: 4, background: step >= 2 ? '#3b82f6' : '#e2e8f0', borderRadius: 2 }} />
                       <div style={{ flex: 1, height: 4, background: step >= 3 ? '#3b82f6' : '#e2e8f0', borderRadius: 2 }} />
                       <div style={{ flex: 1, height: 4, background: step >= 4 ? '#3b82f6' : '#e2e8f0', borderRadius: 2 }} />
                   </div>

                   {step === 1 && (
                      <div style={{ display: 'grid', gap: 15, maxWidth: 500 }}>
                          <input type="text" placeholder="Host (ej: localhost)" value={dbConfig.host} onChange={e => setDbConfig({...dbConfig, host: e.target.value})} style={{ padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                          <input type="text" placeholder="Usuario" value={dbConfig.user} onChange={e => setDbConfig({...dbConfig, user: e.target.value})} style={{ padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                          <input type="password" placeholder="Contraseña" value={dbConfig.pass} onChange={e => setDbConfig({...dbConfig, pass: e.target.value})} style={{ padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
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
                               <button key={t} onClick={() => handleSelectTable(t)} style={{ padding: 15, textAlign: 'left', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer' }}>{t}</button>
                           ))}
                       </div>
                   )}

                   {step === 4 && (
                       <div>
                           <textarea value={dbConfig.query} onChange={e => setDbConfig({...dbConfig, query: e.target.value})} style={{ width: '100%', height: 120, padding: 15, border: '1px solid #e2e8f0', borderRadius: 8, fontFamily: 'monospace', marginBottom: 15 }} />
                           <button onClick={handleTestQuery} disabled={isTesting} style={{ width: '100%', padding: 15, background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 800 }}>
                               {isTesting ? 'Ejecutando...' : 'Obtener Datos'}
                           </button>
                           {testStatus === 'success' && <p style={{ color: '#10b981', marginTop: 10, fontSize: 13 }}>✓ Datos recuperados correctamente.</p>}
                       </div>
                   )}
              </div>
          )}

          {records.length > 0 && (
              <div style={{ marginTop: 40 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 15, display: 'flex', alignItems: 'center', gap: 10 }}><Table size={18} /> Previsualización (Primeras 5 filas)</h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                          <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                              {Object.keys(records[0]).map(k => <th key={k} style={{ padding: 12, textAlign: 'left', fontWeight: 800 }}>{k.toUpperCase()}</th>)}
                          </tr>
                      </thead>
                      <tbody>
                          {records.slice(0, 5).map((r, i) => (
                              <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                  {Object.keys(records[0]).map(k => <td key={k} style={{ padding: 12 }}>{String(r[k])}</td>)}
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          )}
      </div>
    </div>
  );
}
