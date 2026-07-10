import React from 'react';
import ReactDOM from 'react-dom/client';
import { TopBar, ActionButton, EngineCanvas, NodeCard, ArchitectureMonitor } from '@engine/ui-kit';
import { CoreEngine, MessageType } from '@engine/core-logic';
import './index.css';

const App = () => {
  const engine = CoreEngine.getInstance();

  const handleExecute = async () => {
    const response = await engine.dispatch({
      id: `job-${Math.floor(Math.random() * 1000)}`,
      type: MessageType.COMMAND,
      source: "SHELL",
      payload: { action: "RUN_WORKFLOW" },
      timestamp: Date.now()
    });
    
    if (response.success) {
      console.log("%c[@engine/shell] Flujo completado", "color: #10b981;");
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#050505] text-white overflow-hidden">
      <TopBar>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold">O</div>
          <span className="font-bold text-lg tracking-tight">Operativa.<span className="text-blue-500">engine</span></span>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="p-2 hover:bg-white/5 rounded-full cursor-pointer text-gray-400">
             ☼
          </div>
          <ActionButton color="blue">Nueva Acción</ActionButton>
          <ActionButton color="green" onClick={handleExecute}>Ejecutar Flujo</ActionButton>
        </div>
      </TopBar>

      <EngineCanvas>
        <ArchitectureMonitor />
        {/* Simulación de Nodos de la imagen */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-20">
          
          {/* Nodo 1 */}
          <NodeCard 
            title="Origen de Datos" 
            description="SQL / API Integration" 
            icon="🗄️" 
            activeLabel="31818 Registros Activos"
            color="blue"
          />

          {/* Conexión (Línea) */}
          <div className="w-20 h-[2px] bg-gradient-to-r from-blue-500 to-red-500 relative">
             <div className="absolute -right-1 -top-[3px] w-2 h-2 rounded-full bg-red-500"></div>
          </div>

          {/* Nodo 2 */}
          <NodeCard 
            title="Diseño Documento" 
            description="Plantilla Multi-Hoja" 
            icon="📄" 
            color="red"
          />
          
        </div>

        {/* Controles del Canvas (Esquina inferior izquierda) */}
        <div className="absolute bottom-6 left-6 flex flex-col gap-2 bg-[#0d0d0d] border border-white/10 p-2 rounded-lg">
          <button className="p-2 hover:bg-white/5 rounded">+</button>
          <button className="p-2 hover:bg-white/5 rounded">−</button>
          <button className="p-2 hover:bg-white/5 rounded">⛶</button>
        </div>
      </EngineCanvas>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
