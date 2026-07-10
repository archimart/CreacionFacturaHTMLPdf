import React from 'react';

// Botón con efecto de brillo (Glow) como en la imagen
export const ActionButton = ({ children, onClick, color = 'blue' }: any) => {
  const colors = {
    blue: "bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.5)] hover:bg-blue-500",
    green: "bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)] hover:bg-emerald-400",
  };

  return (
    <button 
      onClick={onClick}
      className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-all duration-300 text-white ${colors[color as keyof typeof colors]}`}
    >
      {color === 'blue' ? <span className="text-lg">+</span> : <span className="text-xs">▶</span>}
      {children}
    </button>
  );
};

// TopBar con efecto Glassmorphism
export const TopBar = ({ children }: any) => {
  return (
    <div className="w-full h-16 border-b border-white/10 bg-black/40 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-50">
      {children}
    </div>
  );
};

// Contenedor del Canvas con rejilla (Grid)
export const EngineCanvas = ({ children }: any) => {
  return (
    <div className="flex-1 w-full h-full bg-[#050505] relative overflow-hidden" 
         style={{ backgroundImage: 'radial-gradient(#1a1a1a 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
      {children}
    </div>
  );
};

// Nodo tipo tarjeta como en la imagen
export const NodeCard = ({ title, description, icon, activeLabel, color = 'blue' }: any) => {
  return (
    <div className={`w-64 bg-[#0d0d0d] border border-white/10 rounded-xl p-4 shadow-2xl relative group hover:border-${color}-500/50 transition-colors`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg bg-${color}-500/10 text-${color}-400`}>
          {icon}
        </div>
        <div>
          <h4 className="text-sm font-bold text-white">{title}</h4>
          <p className="text-[10px] text-gray-500">{description}</p>
        </div>
      </div>
      {activeLabel && (
        <div className="bg-white/5 rounded-md p-2 flex items-center gap-2">
          <span className="text-blue-400 text-[10px]">✦</span>
          <span className="text-[10px] text-gray-400">{activeLabel}</span>
        </div>
      )}
    </div>
  );
};

// Monitor para visualizar la arquitectura del monorepo
export const ArchitectureMonitor = () => {
  const packages = [
    { name: "@engine/shell", role: "UI / Orchestration", status: "Active" },
    { name: "@engine/core-logic", role: "Business Logic / PDF", status: "Ready" },
    { name: "@engine/ui-kit", role: "Design System", status: "Shared" }
  ];

  return (
    <div className="absolute top-20 right-6 w-64 bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl p-4 shadow-2xl z-40">
      <h3 className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-4">Architecture Monitor (Turbo)</h3>
      <div className="flex flex-col gap-3">
        {packages.map((pkg) => (
          <div key={pkg.name} className="flex flex-col gap-1 border-l-2 border-blue-500/30 pl-3">
            <span className="text-[11px] font-bold text-white">{pkg.name}</span>
            <span className="text-[9px] text-gray-500">{pkg.role}</span>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-[9px] text-green-400 uppercase">{pkg.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

