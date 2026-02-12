import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  XAxis, YAxis, Tooltip,
  ResponsiveContainer, AreaChart, Area, LineChart, Line,
  PieChart as RechartsPieChart, Pie, Cell, BarChart, Bar, Sector
} from 'recharts';
import {
  Database, Target, User, Trophy, TrendingUp, Zap, ShieldCheck, Upload, Trash2, Edit2, Award, BarChart3, Calendar, Package
} from 'lucide-react';

// --- CONFIGURACIÓN DE ESTILO ---
const LIME_NEON = "#d4ff00";
const LIME_MID = "#b8df00";
const LIME_DARK = "#8ca900";
const BG_PURE_BLACK = "bg-black";
const CARD_DARK = "bg-[#0a0a0a]";

const COLORS = [LIME_NEON, '#ffffff', '#e5e5e5', '#a3a3a3', '#525252'];
const DEFAULT_LOGO_URL = "https://arjaus.com/img/isologotipo-blanco%20izquierda.svg";

// --- COMPONENTES ATÓMICOS ---

const InstantTooltip = ({ text, children }) => {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e) => {
    setCoords({ x: e.clientX + 15, y: e.clientY + 15 });
  };

  return (
    <div 
      className="relative inline-block w-full"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onMouseMove={handleMouseMove}
    >
      {children}
      {visible && text && (
        <div 
          className="fixed z-[9999] pointer-events-none bg-zinc-950 border border-white/20 px-3 py-2 rounded shadow-2xl backdrop-blur-md animate-in fade-in duration-75"
          style={{ top: coords.y, left: coords.x }}
        >
          <p className="text-[10px] font-bold text-white uppercase tracking-tight whitespace-nowrap">
            {text}
          </p>
        </div>
      )}
    </div>
  );
};

const AnimatedNumber = ({ value }) => {
  const [displayValue, setDisplayValue] = useState(0);
  useEffect(() => {
    let start = 0;
    const end = Math.floor(value);
    if (start === end) {
      setDisplayValue(end);
      return;
    }
    let totalMiliseconds = 1500;
    let incrementTime = 30;
    let steps = totalMiliseconds / incrementTime;
    let increment = end / steps;
    let timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setDisplayValue(end);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(start));
      }
    }, incrementTime);
    return () => clearInterval(timer);
  }, [value]);
  const formatted = new Intl.NumberFormat('es-AR').format(displayValue);
  const getFontSize = (str) => {
    if (str.length > 12) return 'text-xl';
    if (str.length > 9) return 'text-2xl';
    return 'text-3xl';
  };
  return <span className={`${getFontSize(formatted)} font-bold tracking-tighter transition-all duration-300`}>{formatted}</span>;
};

const GlowCard = ({ children, className = "" }) => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);
  const handleMouseMove = (e) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
  };
  return (
    <div 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className={`relative overflow-hidden group hover:translate-y-[-4px] hover:border-[#d4ff00]/30 transition-all duration-500 border border-white/10 ${className}`}
    >
      <div 
        className="pointer-events-none absolute -inset-px opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: `radial-gradient(600px circle at ${mousePos.x}px ${mousePos.y}px, rgba(212,255,0,0.08), transparent 40%)` }}
      />
      {children}
    </div>
  );
};

const UserTrend = ({ data, color = LIME_NEON }) => (
  <div className="h-6 w-full">
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <Line type="monotone" dataKey="val" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  </div>
);

const PortfolioCenterIcon = () => (
  <div className="flex flex-col items-center justify-center opacity-40">
    <div className="relative">
      <Package size={42} strokeWidth={1} className="text-[#d4ff00] animate-pulse" />
      <div className="absolute inset-0 blur-lg bg-[#d4ff00]/20 -z-10"></div>
    </div>
    <span className="text-[7px] font-black uppercase tracking-[0.3em] mt-2 text-white/50">Core Inventory</span>
  </div>
);

const renderActiveShape = (props) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <g>
      <filter id="glow">
        <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
        <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
      <Sector
        cx={cx} cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 8}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        opacity={0.3}
      />
      <Sector
        cx={cx} cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 4}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        stroke="#000"
        strokeWidth={2}
        filter="url(#glow)"
      />
    </g>
  );
};

// --- UTILIDADES ---

const parseCSV = (text) => {
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).filter(line => line.trim()).map(line => {
    const values = [];
    let current = '';
    let inQuotes = false;
    for (let char of line) {
      if (char === '"') inQuotes = !inQuotes;
      else if (char === ',' && !inQuotes) {
        values.push(current.trim().replace(/^"|"$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim().replace(/^"|"$/g, ''));
    return headers.reduce((obj, header, i) => {
      obj[header] = values[i];
      return obj;
    }, {});
  });
};

const abbreviateName = (name) => {
  if (!name) return "S/N";
  let clean = name
    .replace(/Curso de /gi, '')
    .replace(/Carrera de /gi, '')
    .replace(/Especialización en /gi, '')
    .replace(/Taller de /gi, '');
  if (clean.length > 20) {
    return clean.substring(0, 18).toUpperCase() + "...";
  }
  return clean.toUpperCase();
};

// --- APP PRINCIPAL ---

export default function App() {
  const [rawData, setRawData] = useState([]);
  const [targetBimestral, setTargetBimestral] = useState(120000000);
  const [customLogo, setCustomLogo] = useState(DEFAULT_LOGO_URL);
  const [activeIndex, setActiveIndex] = useState(null);

  const onPieEnter = (_, index) => setActiveIndex(index);
  const onPieLeave = () => setActiveIndex(null);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const raw = parseCSV(text);
        const processed = raw.map(row => {
          let dStr = row['Fecha Ingreso'] || row['fecha_ingreso'] || '';
          let aStr = row['Cuota Actual'] || row['cuota_actual'] || '0';
          let seller = row['Cargado por'] || row['cargado_por'] || 'Sitio Web';
          let estado = row['Estado'] || row['estado'] || '';
          if (!seller || seller === '0' || seller.trim() === '') seller = 'Sitio Web';
          let dateObj = null;
          const cleanDate = dStr.replace(/\//g, '-');
          const p = cleanDate.split('-');
          if (p.length === 3) {
            dateObj = p[0].length === 4 ? new Date(p[0], p[1]-1, p[2]) : new Date(p[2], p[1]-1, p[0]);
          }
          return {
            ...row,
            date: dateObj,
            amount: parseFloat(aStr.replace(/[^0-9.]/g, '')) || 0,
            seller,
            estado,
            productName: row['Producto'] || 'Sin Nombre',
          };
        }).filter(i => i.date && !isNaN(i.date.getTime()));
        setRawData(processed);
      } catch (err) { console.error("Error al procesar el archivo:", err); }
    };
    reader.readAsText(file);
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setCustomLogo(event.target.result);
      reader.readAsDataURL(file);
    }
  };

  const audit = useMemo(() => {
    if (rawData.length === 0) return null;
    const totalRevenue = rawData.reduce((s, i) => s + i.amount, 0);
    const guaranteedCount = rawData.filter(item => item.estado?.toUpperCase().includes('GARANTIZADO')).length;
    const timelineMap = rawData.reduce((acc, c) => {
      const k = c.date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
      if(!acc[k]) acc[k] = { name: k, val: 0, count: 0, date: c.date };
      acc[k].val += c.amount;
      acc[k].count++;
      return acc;
    }, {});
    const timelineData = Object.values(timelineMap).sort((a,b) => a.date - b.date);
    const maxDate = new Date(Math.max(...rawData.map(d => d.date)));
    const activityTimeline = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(maxDate);
      d.setDate(d.getDate() - i);
      const dateKey = d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
      const fullDateLabel = d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
      const dayData = rawData.filter(item => 
        item.date.getDate() === d.getDate() && item.date.getMonth() === d.getMonth() && item.date.getFullYear() === d.getFullYear()
      );
      const total = dayData.reduce((sum, curr) => sum + curr.amount, 0);
      activityTimeline.push({ name: dateKey, label: fullDateLabel, total: total, count: dayData.length, isZero: total === 0 });
    }
    const maxActivityVal = Math.max(...activityTimeline.map(a => a.total)) || 1;
    const sellersMap = rawData.reduce((acc, c) => {
      if(!acc[c.seller]) acc[c.seller] = { name: c.seller, val: 0, count: 0, daily: {} };
      acc[c.seller].val += c.amount;
      acc[c.seller].count++;
      const dateKey = c.date.toDateString();
      acc[c.seller].daily[dateKey] = (acc[c.seller].daily[dateKey] || 0) + c.amount;
      return acc;
    }, {});
    const sellers = Object.values(sellersMap).map(s => ({
      ...s,
      trend: Object.entries(s.daily).map(([d, val]) => ({ d, val })).sort((a,b) => new Date(a.d) - new Date(b.d))
    })).sort((a,b) => b.val - a.val);
    const productsMap = rawData.reduce((acc, c) => {
      const full = c.productName;
      if(!acc[full]) acc[full] = { fullName: full, name: abbreviateName(full), value: 0, count: 0 };
      acc[full].value += c.amount;
      acc[full].count++;
      return acc;
    }, {});
    const productsAll = Object.values(productsMap).sort((a,b) => b.value - a.value);
    const top3Products = productsAll.slice(0, 3);
    const productsPie = productsAll.slice(0, 5);
    return { totalRevenue, totalCount: rawData.length, guaranteedCount, timelineData, activityTimeline, maxActivityVal, sellers, top3Products, productsPie, productsAll };
  }, [rawData]);

  const fmt = (v) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(v);
  const clearData = () => setRawData([]);

  const CustomActivityTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-zinc-950 border border-white/20 p-3 rounded shadow-2xl backdrop-blur-md">
          <p className="text-[10px] font-black text-white uppercase tracking-widest mb-1">{data.label}</p>
          <div className="flex items-center justify-between gap-4">
            <span className="text-white/60 text-[11px] font-bold uppercase">Monto:</span>
            <span className="text-white font-black">{fmt(data.total)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-white/60 text-[11px] font-bold uppercase">Ventas:</span>
            <span className="text-white font-black">{data.count}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  const CustomPieTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-zinc-950 border border-white/20 p-4 rounded shadow-2xl backdrop-blur-xl">
          <p className="text-[8px] font-black text-white/40 uppercase tracking-[0.2em] mb-1">Producto</p>
          <p className="text-xs font-bold text-white uppercase leading-tight mb-2 max-w-[200px]">{data.fullName}</p>
          <div className="h-[1px] bg-white/10 w-full mb-2"></div>
          <div className="flex items-center justify-between gap-6">
            <span className="text-[10px] text-white/50 font-medium">Volumen:</span>
            <span className="text-sm font-black text-white">{fmt(data.value)}</span>
          </div>
          <div className="flex items-center justify-between gap-6">
            <span className="text-[10px] text-white/50 font-medium">Participación:</span>
            <span className="text-xs font-bold text-white">{((data.value / audit.totalRevenue) * 100).toFixed(1)}%</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`min-h-screen ${BG_PURE_BLACK} text-white font-sans selection:bg-[#d4ff00] selection:text-black pb-20`}>
      <header className="border-b border-white/10 px-10 h-20 flex items-center justify-between sticky top-0 bg-black/80 backdrop-blur-2xl z-50">
        <div className="flex items-center gap-4 group">
          <label className="flex items-center justify-center min-w-[100px] h-[45px] transition-all cursor-pointer relative overflow-hidden group hover:scale-105 active:scale-95 bg-black">
            {customLogo ? <img src={customLogo} alt="Logo" className="max-w-[120px] max-h-[35px] w-auto h-auto object-contain" /> : <span className="text-[10px] font-black uppercase tracking-widest text-white/80 group-hover:text-[#d4ff00] transition-colors">Tu Logo</span>}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><Upload className="w-4 h-4 text-[#d4ff00]" /></div>
            <input type="file" accept="image/png, image/jpeg" onChange={handleLogoUpload} className="hidden" />
          </label>
          <div className="h-6 w-[1px] bg-white/20" />
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40 leading-none">Sellers Management</span>
            <span className="text-[13px] font-bold text-white tracking-wider uppercase">Panel de Control</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {rawData.length > 0 && (
            <button onClick={clearData} className="group flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 transition-all active:scale-95">
              <Trash2 className="w-3.5 h-3.5 text-red-500" />
              <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Limpiar</span>
            </button>
          )}
          <label className="text-[10px] font-black text-black uppercase cursor-pointer hover:bg-white/90 active:scale-95 transition-all bg-white px-5 py-2.5 rounded-xl flex items-center gap-2">
            <Database className="w-3 h-3" /> Sincronizar CSV
            <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>
      </header>

      <main className="max-w-[1500px] mx-auto px-10 py-12">
        {!audit ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center animate-in fade-in zoom-in duration-500">
            <div className="w-24 h-24 bg-white/5 border border-white/10 rounded-[2.5rem] flex items-center justify-center mb-8 relative group overflow-hidden">
              <div className="absolute inset-0 bg-[#d4ff00]/10 translate-y-24 group-hover:translate-y-0 transition-transform duration-700" />
              <Database className="text-white/60 w-10 h-10 group-hover:text-[#d4ff00] transition-colors relative z-10" />
            </div>
            <h1 className="text-3xl font-light mb-4 text-white/80">Ready to <span className="text-white font-bold">Audit</span></h1>
            <p className="text-xs text-white/60 uppercase tracking-[0.3em] mb-10">Selecciona tu base de datos para comenzar</p>
            <label className="bg-[#d4ff00] text-black px-12 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest cursor-pointer hover:scale-105 active:scale-95 transition-all shadow-[0_10px_30px_rgba(212,255,0,0.2)]">
              Importar Archivo CSV
              <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        ) : (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            {/* KPI Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <GlowCard className="bg-[#0a0a0a] p-8 rounded-[2rem] flex flex-col justify-between h-52">
                <div className="w-10 h-10 rounded-xl bg-[#141414] border border-white/10 flex items-center justify-center"><Zap className="w-5 h-5 text-[#d4ff00]" /></div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/80 font-bold mb-1">FACTURACIÓN TOTAL</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold text-[#d4ff00] opacity-70">$</span>
                    <AnimatedNumber value={audit.totalRevenue} />
                  </div>
                  <p className="text-[9px] text-white/60 mt-1 font-bold tracking-widest uppercase">BASADO EN {audit.totalCount} VENTAS</p>
                </div>
              </GlowCard>
              <GlowCard className="bg-[#0a0a0a] p-8 rounded-[2rem] flex flex-col justify-between h-52">
                <div className="w-10 h-10 rounded-xl bg-[#141414] border border-white/10 flex items-center justify-center"><ShieldCheck className="w-5 h-5 text-[#d4ff00]" /></div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/80 font-bold mb-1">TICKET PROMEDIO</p>
                  <AnimatedNumber value={audit.totalRevenue / audit.totalCount} />
                  <p className="text-[9px] text-white/60 mt-1 font-bold tracking-widest uppercase">VALOR POR OPERACIÓN</p>
                </div>
              </GlowCard>
              <GlowCard className="bg-[#0a0a0a] p-8 rounded-[2rem] flex flex-col justify-between h-52 relative">
                <div className="flex justify-between items-start">
                  <div className="w-10 h-10 rounded-xl bg-[#141414] border border-white/10 flex items-center justify-center"><Database className="w-5 h-5 text-[#d4ff00]" /></div>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 border border-white/10 bg-white/5 rounded-full"><div className="w-1 h-1 rounded-full bg-[#d4ff00] animate-pulse" /><span className="text-[8px] font-black text-white/60 tracking-[0.1em] uppercase">{audit.guaranteedCount} GARANTIZADAS</span></div>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/80 font-bold mb-1">OPERACIONES TOTALES</p>
                  <h2 className="text-5xl font-bold tracking-tight">{audit.totalCount}</h2>
                  <p className="text-[9px] text-white/60 mt-1 font-bold tracking-widest uppercase">REGISTROS PROCESADOS</p>
                </div>
              </GlowCard>
              <GlowCard className="bg-[#0a0a0a] p-8 rounded-[2rem] flex flex-col justify-between h-52">
                <div className="flex justify-between items-start">
                  <div className="w-10 h-10 rounded-xl bg-[#141414] border border-white/10 flex items-center justify-center"><Target className="w-5 h-5 text-[#d4ff00]" /></div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <input type="number" value={targetBimestral} onChange={(e) => setTargetBimestral(Number(e.target.value))} className="bg-transparent text-[#d4ff00] font-black text-right text-sm outline-none border-b border-white/20 focus:border-[#d4ff00] w-24 transition-all" />
                      <Edit2 className="w-3 h-3 text-white/60" />
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] text-white/80 font-black tracking-widest uppercase mb-1">PROGRESO META</p>
                  <div className="flex justify-between items-end"><span className="text-4xl font-bold tracking-tighter">{((audit.totalRevenue / targetBimestral) * 100).toFixed(1)}%</span></div>
                  <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden"><div className="bg-[#d4ff00] h-full rounded-full shadow-[0_0_10px_#d4ff00] transition-all duration-1000" style={{ width: `${Math.min((audit.totalRevenue / targetBimestral) * 100, 100)}%` }}></div></div>
                </div>
              </GlowCard>
            </div>

            {/* Actividad Diaria */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
               <div className="lg:col-span-2 bg-[#0a0a0a] border border-white/10 p-8 rounded-[2.5rem]">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <div className="flex items-center gap-2 mb-1"><Calendar className="w-4 h-4 text-[#d4ff00]" /><h3 className="text-xl font-bold text-white uppercase tracking-tighter">Actividad Diaria</h3></div>
                      <p className="text-[10px] uppercase tracking-widest text-white/80 font-bold">Intensidad de volumen • Últimos 30 días</p>
                    </div>
                  </div>
                  <div className="h-[220px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={audit.activityTimeline} margin={{ bottom: 20 }}>
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#888', fontSize: 9}} interval={2} />
                        <Tooltip cursor={{fill: 'rgba(212, 255, 0, 0.05)'}} content={<CustomActivityTooltip />} />
                        <Bar dataKey="total" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                          {audit.activityTimeline.map((entry, index) => {
                            const intensity = entry.isZero ? 0.05 : 0.2 + (entry.total / audit.maxActivityVal) * 0.8;
                            return <Cell key={`cell-${index}`} fill={LIME_NEON} opacity={intensity} />;
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
               </div>
               <div className="bg-gradient-to-br from-[#0a0a0a] to-[#111] border border-white/10 p-8 rounded-[2.5rem] flex flex-col justify-center text-center">
                  <div className="w-16 h-16 bg-[#d4ff00]/10 rounded-2xl flex items-center justify-center mx-auto mb-6"><BarChart3 className="w-8 h-8 text-[#d4ff00]" /></div>
                  <p className="text-[10px] font-black text-white/60 uppercase tracking-[0.4em] mb-2">PROM. DIARIO (PERIODO)</p>
                  <div className="text-4xl font-bold tracking-tighter mb-2">{fmt(audit.activityTimeline.reduce((s, a) => s + a.total, 0) / 30)}</div>
                  <p className="text-[9px] text-white/60 font-bold uppercase tracking-widest">Cálculo 30 días naturales</p>
               </div>
            </div>

            {/* Evolución Temporal */}
            <div className={`${CARD_DARK} border border-white/10 p-8 rounded-[2.5rem]`}>
              <div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-[#d4ff00]" /><h3 className="text-xl font-bold text-white uppercase tracking-tighter">Evolución Diaria</h3></div>
              <p className="text-[10px] uppercase tracking-widest text-white/80 font-bold mb-8">Tendencia de ingresos acumulados</p>
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={audit.timelineData}>
                    <defs><linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={LIME_NEON} stopOpacity={0.3}/><stop offset="95%" stopColor={LIME_NEON} stopOpacity={0}/></linearGradient></defs>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#888', fontSize: 10}} />
                    <YAxis hide />
                    <Tooltip contentStyle={{backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '8px'}} formatter={(v) => [fmt(v), 'Ingresos']} />
                    <Area type="monotone" dataKey="val" stroke={LIME_NEON} fillOpacity={1} fill="url(#colorVal)" strokeWidth={3} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Ranking de Productos */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] p-8 bg-gradient-to-br from-[#0a0a0a] via-black to-[#050505] shadow-[inset_0_0_60px_rgba(0,0,0,1)]">
                <div className="flex flex-col md:flex-row items-center gap-8 h-full">
                  <div className="w-full md:w-3/5 h-[350px] relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie 
                          activeIndex={activeIndex}
                          activeShape={renderActiveShape}
                          data={audit.productsPie} 
                          innerRadius={90} 
                          outerRadius={115} 
                          paddingAngle={6} 
                          dataKey="value" 
                          isAnimationActive={true} 
                          animationDuration={800}
                          stroke="none"
                          onMouseEnter={onPieEnter}
                          onMouseLeave={onPieLeave}
                          cx="50%"
                          cy="50%"
                        >
                          {audit.productsPie.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={COLORS[index % COLORS.length]} 
                              className="transition-all duration-500 cursor-pointer"
                              style={{ filter: `drop-shadow(0 0 8px ${COLORS[index % COLORS.length]}33)`}}
                            />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomPieTooltip />} />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                      <PortfolioCenterIcon />
                    </div>
                  </div>

                  <div className="w-full md:w-2/5 space-y-5">
                    <div className="mb-2">
                       <h3 className="text-sm font-black text-white/40 uppercase tracking-[0.3em]">Portfolio Intelligence</h3>
                       <p className="text-[10px] text-[#d4ff00] font-bold uppercase">Análisis de Distribución</p>
                    </div>
                    {audit.productsPie.map((p, i) => (
                      <div 
                        key={p.fullName} 
                        className={`group/item transition-all duration-300 p-2 rounded-xl ${activeIndex === i ? 'bg-white/5 border-l-2 border-[#d4ff00]' : 'opacity-70 hover:opacity-100'}`}
                        onMouseEnter={() => setActiveIndex(i)}
                        onMouseLeave={() => setActiveIndex(null)}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <InstantTooltip text={p.fullName}>
                            <span className="text-[11px] font-bold text-white uppercase truncate block max-w-[130px] cursor-help">{p.name}</span>
                          </InstantTooltip>
                          <span className="text-[11px] font-black text-[#d4ff00] shrink-0 ml-2">{((p.value / audit.totalRevenue) * 100).toFixed(1)}%</span>
                        </div>
                        <div className="w-full h-[3px] bg-white/[0.05] rounded-full overflow-hidden">
                          <div className="h-full transition-all duration-1000" style={{ width: `${(p.value / audit.totalRevenue) * 100}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Top 3 List */}
              <div className="lg:col-span-5 grid grid-cols-1 gap-4">
                {audit.top3Products.map((p, i) => (
                  <div key={p.fullName} className="bg-[#0a0a0a] border border-white/10 p-6 rounded-[2rem] flex items-center justify-between group h-[95px] relative overflow-hidden transition-all hover:bg-[#111]">
                    <div className="flex items-center gap-5 relative z-10 min-w-0 flex-1">
                      <div className={`shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center border transition-all duration-500 ${i === 0 ? 'bg-[#d4ff00]/10 border-[#d4ff00]/40 group-hover:bg-[#d4ff00]/20' : 'bg-white/5 border-white/10 group-hover:border-white/20'}`}>
                        {i === 0 ? <Award className="w-6 h-6 text-[#d4ff00]" /> : <Trophy className="w-5 h-5 text-white/60" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[8px] font-black text-white/40 uppercase tracking-[0.2em] mb-0.5">Rank #0{i+1}</p>
                        <InstantTooltip text={p.fullName}>
                          <h4 className="text-[13px] font-bold text-white group-hover:text-[#d4ff00] transition-colors uppercase tracking-tight truncate cursor-help block">{p.name}</h4>
                        </InstantTooltip>
                      </div>
                    </div>
                    <div className="text-right relative z-10 shrink-0 ml-4">
                      <div className="text-[#d4ff00] font-bold tabular-nums tracking-tighter text-base leading-none mb-1">{fmt(p.value).replace('$', '')}</div>
                      <p className="text-[9px] font-bold text-white/40 uppercase tracking-tighter leading-none">{p.count} OPERACIONES</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Performance de Equipo */}
            <div className="bg-[#0a0a0a] border border-white/10 p-12 rounded-[3rem]">
              <div className="flex items-center justify-between mb-12">
                <div className="space-y-1"><h3 className="text-xs font-black uppercase tracking-[0.4em] text-white/40">Performance de Equipo</h3><p className="text-xl font-bold text-white">Ranking de Asesores</p></div>
                <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-xl border border-white/10 text-[10px] font-bold text-white/60 uppercase tracking-widest"><User className="w-4 h-4 text-[#d4ff00]" /> {audit.sellers.length} AGENTES</div>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {audit.sellers.map((s, i) => {
                  const sharePercent = ((s.val / audit.totalRevenue) * 100).toFixed(1);
                  let rankBg = "bg-white/5", rankColor = "text-white/40", rankBorder = "border-white/10";
                  if (i === 0) { rankBg = "bg-[#d4ff00]/10"; rankColor = "text-[#d4ff00]"; rankBorder = "border-[#d4ff00]/40"; }
                  return (
                    <div key={s.name} className="flex items-center justify-between group bg-white/[0.01] p-6 rounded-2xl border border-white/[0.05] hover:bg-white/[0.03] transition-all relative overflow-hidden">
                      <div className="flex items-center gap-6 w-1/4 relative z-10 min-w-0">
                        <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm border transition-all ${rankBg} ${rankColor} ${rankBorder}`}>{i+1}</div>
                        <InstantTooltip text={s.name}>
                          <span className="text-sm font-bold text-white/70 group-hover:text-white uppercase truncate block cursor-help">{s.name}</span>
                        </InstantTooltip>
                      </div>
                      <div className="flex-1 flex items-center gap-12 px-10 hidden md:flex relative z-10"><div className="flex-1 opacity-20 group-hover:opacity-100 transition-opacity"><UserTrend data={s.trend} /></div><div className="flex flex-col items-end min-w-[70px] shrink-0"><span className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-0.5">Share</span><span className="font-black text-[15px] tabular-nums text-[#d4ff00]/90">{sharePercent}%</span></div></div>
                      <div className="text-right w-1/4 relative z-10 shrink-0"><p className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-0.5">{s.count} VENTAS</p><p className="text-[19px] font-bold tabular-nums text-white">{fmt(s.val)}</p></div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>
      <footer className="mt-20 py-10 text-center border-t border-white/10 bg-black/50"><p className="text-[10px] font-black text-white/40 uppercase tracking-[0.5em]">Sellers Management System • 2026</p></footer>
    </div>
  );
}