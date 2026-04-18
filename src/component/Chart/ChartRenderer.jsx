"use client";

import React from "react";

export default function ChartRenderer({ el, dataset = [] }) {
  const s = el.style || {};
  const c = el.chart || {};
  
  // Data Mapping Logic
  let labels = c.labels || ["A", "B", "C"];
  let data = (c.datasets && c.datasets[0] && c.datasets[0].data) || [10, 20, 15];
  let color = (c.datasets && c.datasets[0] && c.datasets[0].color) || "#3b82f6";
  const type = c.type || "bar";

  // If connected to dataset
  if (dataset && dataset.length > 0 && c.mapping) {
    const { labelField, dataField, limit = 10 } = c.mapping;
    if (labelField && dataField) {
      const slice = dataset.slice(0, limit);
      labels = slice.map(item => String(item[labelField] || ""));
      data = slice.map(item => {
        const val = item[dataField];
        return typeof val === 'number' ? val : parseFloat(val) || 0;
      });
    }
  }
  
  const maxValue = Math.max(...data, 1);
  const total = data.reduce((a, b) => a + b, 0) || 1;

  const renderBar = () => {
    const barWidth = 80 / (data.length || 1);
    return data.map((val, i) => {
      const h = (val / maxValue) * 70;
      const x = 10 + i * barWidth;
      const y = 85 - h;
      return (
        <g key={i}>
          <rect 
            x={x + barWidth * 0.1} 
            y={y} 
            width={barWidth * 0.8} 
            height={h} 
            fill={color} 
            rx="2" 
            style={{ transition: 'all 0.5s ease' }}
          />
          <text x={x + barWidth/2} y="95" fontSize="3" textAnchor="middle" fill="var(--node-desc)">
            {labels[i]?.length > 10 ? labels[i].substring(0, 8) + '...' : labels[i]}
          </text>
        </g>
      );
    });
  };

  const renderLine = (isArea = false) => {
    if (data.length < 2) {
       if (data.length === 1) {
           return <circle cx="50" cy={85 - (data[0] / maxValue) * 70} r="4" fill={color} />;
       }
       return null;
    }
    const step = 80 / (data.length - 1);
    const points = data.map((val, i) => `${10 + i * step},${85 - (val / maxValue) * 70}`).join(" ");
    
    return (
      <g>
        {isArea && (
          <>
            <defs>
              <linearGradient id={`grad-${el.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.4" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={`M 10 85 L ${points} L 90 85 Z`} fill={`url(#grad-${el.id})`} />
          </>
        )}
        <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {data.map((val, i) => (
          <circle key={i} cx={10 + i * step} cy={85 - (val / maxValue) * 70} r="2" fill="white" stroke={color} strokeWidth="1.5" />
        ))}
      </g>
    );
  };

  const renderPie = (isDonut = false) => {
    let currentAngle = 0;
    const centerX = 50, centerY = 45, radius = 35;
    
    return (
      <g>
        {data.map((val, i) => {
          const angle = (val / total) * 360;
          const x1 = centerX + radius * Math.cos((Math.PI * (currentAngle - 90)) / 180);
          const y1 = centerY + radius * Math.sin((Math.PI * (currentAngle - 90)) / 180);
          currentAngle += angle;
          const x2 = centerX + radius * Math.cos((Math.PI * (currentAngle - 90)) / 180);
          const y2 = centerY + radius * Math.sin((Math.PI * (currentAngle - 90)) / 180);
          
          const largeArcFlag = angle > 180 ? 1 : 0;
          const path = `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
          const sliceColor = `hsla(${i * (360 / data.length)}, 70%, 55%, 0.85)`;
          
          return <path key={i} d={path} fill={sliceColor} stroke="white" strokeWidth="0.5" />;
        })}
        {isDonut && (
           <circle cx={centerX} cy={centerY} r={radius * 0.6} fill="var(--panel-bg)" />
        )}
      </g>
    );
  };

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", display: "flex", flexDirection: "column", padding: "15px", background: "var(--panel-bg)", border: "1px solid var(--panel-border)", borderRadius: 12, boxSizing: 'border-box', overflow: 'hidden' }}>
      <div style={{ fontSize: 11, fontWeight: 900, color: "var(--node-text)", marginBottom: 10, textAlign: "center", textTransform: "uppercase", letterSpacing: '1px' }}>
        {el.label || (c.mapping?.dataField ? `Distribución de ${c.mapping.dataField}` : "Gráfica de Datos")}
      </div>
      <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", flex: 1, overflow: 'visible' }}>
        {type !== "pie" && type !== "donut" && (
           <g stroke="var(--editor-border)" strokeWidth="0.2">
             {[15, 32.5, 50, 67.5, 85].map(vy => <line key={vy} x1="10" y1={vy} x2="90" y2={vy} />)}
           </g>
        )}
        
        {type === "bar" && renderBar()}
        {type === "line" && renderLine(false)}
        {type === "area" && renderLine(true)}
        {type === "pie" && renderPie(false)}
        {type === "donut" && renderPie(true)}
      </svg>
    </div>
  );
}
