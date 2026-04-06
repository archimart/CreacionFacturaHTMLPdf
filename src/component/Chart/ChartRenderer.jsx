"use client";

import React from "react";

export default function ChartRenderer({ el }) {
  const s = el.style || {};
  const c = el.chart || { type: "bar", labels: ["A", "B", "C"], datasets: [{ data: [10, 20, 15], color: "#3b82f6" }] };
  
  const width = 100;
  const height = 100;
  const labels = c.labels || [];
  const dataset = (c.datasets && c.datasets[0]) || { data: [], color: "#3b82f6" };
  const data = dataset.data || [];
  const maxValue = Math.max(...data, 1);
  const total = data.reduce((a, b) => a + b, 0) || 1;
  const color = dataset.color || "#3b82f6";

  const renderBar = () => {
    const barWidth = 80 / (data.length || 1);
    return data.map((val, i) => {
      const h = (val / maxValue) * 70;
      const x = 15 + i * (barWidth + 2);
      const y = 85 - h;
      return (
        <g key={i}>
          <rect x={x} y={y} width={barWidth} height={h} fill={color} rx="1" />
          <text x={x + barWidth/2} y="95" fontSize="4" textAnchor="middle" fill="#94a3b8">{labels[i] || ""}</text>
          <text x={x + barWidth/2} y={y - 2} fontSize="4" textAnchor="middle" fill="#64748b" fontWeight="800">{val}</text>
        </g>
      );
    });
  };

  const renderLine = () => {
    const step = 80 / (data.length - 1 || 1);
    const points = data.map((val, i) => `${10 + (i * step)},${80 - (val / maxValue) * 60}`).join(" ");
    return (
      <g>
        <polyline points={points} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {data.map((val, i) => {
          const x = 10 + i * step;
          const y = 80 - (val / maxValue) * 60;
          return (
            <circle key={i} cx={x} cy={y} r="3" fill="white" stroke={color} strokeWidth="2" />
          );
        })}
      </g>
    );
  };

  const renderArea = () => {
    const step = 80 / (data.length - 1 || 1);
    const points = data.map((val, i) => `${10 + i * step},${80 - (val / maxValue) * 60}`).join(" ");
    const areaPath = `M 10 80 L ${points} L ${10 + (data.length - 1) * step} 80 Z`;
    
    return (
      <g>
        <defs>
          <linearGradient id={`grad-${el.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.7" />
            <stop offset="100%" stopColor={color} stopOpacity="0.1" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#grad-${el.id})`} stroke={color} strokeWidth="2" />
        {data.map((val, i) => (
          <circle key={i} cx={10 + i * step} cy={80 - (val / maxValue) * 60} r="2" fill={color} />
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
          <>
            <circle cx={centerX} cy={centerY} r={radius * 0.6} fill="white" />
            <text x={centerX} y={centerY + 2} fontSize="8" textAnchor="middle" fill="#1e293b" fontWeight="900">
               {Math.round((data[0]/total)*100)}%
            </text>
          </>
        )}
      </g>
    );
  };

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", display: "flex", flexDirection: "column", padding: "12px", background: "white", borderRadius: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b", marginBottom: 4, textAlign: "center", textTransform: "uppercase" }}>
        {el.label || "Resumen de Datos"}
      </div>
      <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", flex: 1 }}>
        {c.type !== "pie" && c.type !== "donut" && (
           <g stroke="#f1f5f9" strokeWidth="0.5">
             {[20, 40, 60, 80].map(vy => <line key={vy} x1="10" y1={vy} x2="90" y2={vy} />)}
           </g>
        )}
        
        {c.type === "bar" && renderBar()}
        {c.type === "line" && renderLine()}
        {c.type === "area" && renderArea()}
        {c.type === "pie" && renderPie(false)}
        {c.type === "donut" && renderPie(true)}
      </svg>
    </div>
  );
}
