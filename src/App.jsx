import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  XAxis, YAxis, Tooltip,
  ResponsiveContainer, AreaChart, Area, LineChart, Line,
  PieChart as RechartsPieChart, Pie, Cell
} from 'recharts';
import {
  Database, Target, User, Trophy, TrendingUp, Zap, ShieldCheck, Upload, Trash2, Edit2, Award, BarChart3, ArrowUpRight
} from 'lucide-react';

// --- CONFIGURACIÓN DE ESTILO ---
const LIME_NEON = "#d4ff00";
const BG_PURE_BLACK = "bg-black";
const CARD_DARK = "bg-[#0a0a0a]";

const COLORS = [LIME_NEON, '#ffffff', '#a3a3a3', '#525252', '#262626'];
const DEFAULT_LOGO_URL = "https://arjaus.com/wp-content/uploads/2024/02/Isologo-Blanco.png";

// --- HOOKS PERSONALIZADOS ---

const useGlow = () => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  const handleMouseMove = (e) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  return { containerRef, mousePos, handleMouseMove };
};

// --- COMPONENTES ---

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
  const { containerRef, mousePos, handleMouseMove } = useGlow();
  
  return (
    <div 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className={`relative overflow-hidden group hover:translate-y-[-4px] hover:border-[#d4ff00]/30 transition-all duration-500 ${className}`}
    >
      <div 
        className="pointer-events-none absolute -inset-px opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: `radial-gradient(600px circle at ${mousePos.x}px ${mousePos.y}px, rgba(212,255,0,0.08), transparent 40%)`
        }}
      />
      {children}
    </div>
  );
};

const UserTrend = ({ data }) => (
  <div className="h-6 w-24">
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <Line type="monotone" dataKey="val" stroke={LIME_NEON} strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  </div>
);

const TargetCenterIcon = () => (
  <svg width="50" height="50" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto">
    <circle cx="50" cy="50" r="40" stroke={LIME_NEON} strokeWidth="0.5" strokeDasharray="1 5" opacity="0.3" />
    <circle cx="50" cy="50" r="30" stroke={LIME_NEON} strokeWidth="1" opacity="0.4" />
    <circle cx="50" cy="50" r="12" stroke={LIME_NEON} strokeWidth="1.5" opacity="0.6" />
    <circle cx="50" cy="50" r="4" fill={LIME_NEON} />
    <path d="M50 10V25" stroke={LIME_NEON} strokeWidth="1" />
    <path d="M50 75V90" stroke={LIME_NEON} strokeWidth="1" />
    <path d="M10 50H25" stroke={LIME_NEON} strokeWidth="1" />
    <path d="M75 50H90" stroke={LIME_NEON} strokeWidth="1" />
  </svg>
);

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
  return clean.substring(0, 20).toUpperCase();
};

// --- APP PRINCIPAL ---

export default function App() {
  const [rawData, setRawData] = useState([]);
  const [targetBimestral, setTargetBimestral] = useState(120000000);
  const [customLogo, setCustomLogo] = useState(DEFAULT_LOGO_URL);
  const dashboardRef = useRef(null);

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
            productName: row['Producto'] || 'Sin Nombre',
          };
        }).filter(i => i.date && !isNaN(i.date.getTime()));
        setRawData(processed);
      } catch (err) { console.error("Error:", err); }
    };
    reader.readAsText(file);
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCustomLogo(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const audit = useMemo(() => {
    if (rawData.length === 0) return null;
    const totalRevenue = rawData.reduce((s, i) => s + i.amount, 0);
    const timelineMap = rawData.reduce((acc, c) => {
      const k = c.date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
      if(!acc[k]) acc[k] = { name: k, val: 0, count: 0, date: c.date };
      acc[k].val += c.amount;
      acc[k].count++;
      return acc;
    }, {});
    const timelineData = Object.values(timelineMap).sort((a,b) => a.date - b.date);

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

    return { totalRevenue, totalCount: rawData.length, timelineData, sellers, top3Products, productsPie, productsAll };
  }, [rawData]);

  const fmt = (v) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(v);

  const clearData = () => { setRawData([]); };

  return (
    <div className={`min-h-screen ${BG_PURE_BLACK} text-white font-sans selection:bg-[#d4ff00] selection:text-black pb-20`}>
      <header className="border-b border-white/5 px-10 h-20 flex items-center justify-between sticky top-0 bg-black/80 backdrop-blur-2xl z-50">
        <div className="flex items-center gap-4 group">
          <label className="flex items-center justify-center min-w-[45px] min-h-[45px] rounded-xl transition-all cursor-pointer relative overflow-hidden group hover:scale-105 active:scale-95">
            <img src={customLogo} alt="Arjaus" className="max-w-[120px] max-h-[40px] w-auto h-auto object-contain" />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <Upload className="w-5 h-5 text-[#d4ff00]" />
            </div>
            <input type="file" accept="image/png, image/jpeg" onChange={handleLogoUpload} className="hidden" />
          </label>
          <div className="h-6 w-[1px] bg-white/10" />
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40 leading-none">Sellers Management</span>
            <span className="text-[13px] font-bold text-white tracking-wider uppercase">Panel de Control</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {rawData.length > 0 && (
            <button 
              onClick={clearData} 
              className="group flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 transition-all active:scale-95"
            >
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

      <main className="max-w-[1500px] mx-auto px-10 py-12" ref={dashboardRef}>
        {!audit ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center animate-in fade-in zoom-in duration-500">
            <div className="w-24 h-24 bg-white/5 border border-white/10 rounded-[2.5rem] flex items-center justify-center mb-8 relative group overflow-hidden">
              <div className="absolute inset-0 bg-[#d4ff00]/10 translate-y-24 group-hover:translate-y-0 transition-transform duration-700" />
              <Database className="text-white/20 w-10 h-10 group-hover:text-[#d4ff00] transition-colors relative z-10" />
            </div>
            <h1 className="text-3xl font-light mb-4 text-white/40">Ready to <span className="text-white font-bold">Audit</span></h1>
            <p className="text-xs text-white/20 uppercase tracking-[0.3em] mb-10">Selecciona tu base de datos para comenzar</p>
            <label className="bg-[#d4ff00] text-black px-12 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest cursor-pointer hover:scale-105 active:scale-95 transition-all shadow-[0_10px_30px_rgba(212,255,0,0.2)]">
              Importar Archivo CSV
              <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        ) : (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            {/* KPI Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <GlowCard className="bg-[#0a0a0a] border border-white/5 p-8 rounded-[2rem] flex flex-col justify-between h-52">
                <div className="w-10 h-10 rounded-xl bg-[#141414] border border-white/10 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-[#d4ff00]" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold mb-1">FACTURACIÓN TOTAL</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold text-[#d4ff00] opacity-50">$</span>
                    <AnimatedNumber value={audit.totalRevenue} />
                  </div>
                  <p className="text-[9px] text-white/20 mt-1 font-bold tracking-widest uppercase">BASADO EN {audit.totalCount} VENTAS</p>
                </div>
              </GlowCard>

              <GlowCard className="bg-[#0a0a0a] border border-white/5 p-8 rounded-[2rem] flex flex-col justify-between h-52">
                <div className="w-10 h-10 rounded-xl bg-[#141414] border border-white/10 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-[#d4ff00]" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold mb-1">TICKET PROMEDIO</p>
                  <AnimatedNumber value={audit.totalRevenue / audit.totalCount} />
                  <p className="text-[9px] text-white/20 mt-1 font-bold tracking-widest uppercase">VALOR POR OPERACIÓN</p>
                </div>
              </GlowCard>

              <GlowCard className="bg-[#0a0a0a] border border-white/5 p-8 rounded-[2rem] flex flex-col justify-between h-52">
                <div className="w-10 h-10 rounded-xl bg-[#141414] border border-white/10 flex items-center justify-center">
                  <Database className="w-5 h-5 text-[#d4ff00]" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold mb-1">OPERACIONES</p>
                  <h2 className="text-5xl font-bold tracking-tight">{audit.totalCount}</h2>
                  <p className="text-[9px] text-white/20 mt-1 font-bold tracking-widest uppercase">INSCRIPCIONES TOTALES</p>
                </div>
              </GlowCard>

              <GlowCard className="bg-[#0a0a0a] border border-white/5 p-8 rounded-[2rem] flex flex-col justify-between h-52">
                <div className="flex justify-between items-start">
                  <div className="w-10 h-10 rounded-xl bg-[#141414] border border-white/10 flex items-center justify-center">
                    <Target className="w-5 h-5 text-[#d4ff00]" />
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <input 
                        type="number" value={targetBimestral}
                        onChange={(e) => setTargetBimestral(Number(e.target.value))}
                        className="bg-transparent text-[#d4ff00] font-black text-right text-sm outline-none border-b border-white/10 focus:border-[#d4ff00] w-24 transition-all"
                      />
                      <Edit2 className="w-3 h-3 text-white/20" />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-end">
                    <span className="text-4xl font-bold tracking-tighter">{((audit.totalRevenue / targetBimestral) * 100).toFixed(1)}%</span>
                    <span className="text-[9px] text-white/20 font-black tracking-widest uppercase mb-1">PROGRESO META</span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-[#d4ff00] h-full rounded-full shadow-[0_0_10px_#d4ff00] transition-all duration-1000" style={{ width: `${Math.min((audit.totalRevenue / targetBimestral) * 100, 100)}%` }}></div>
                  </div>
                </div>
              </GlowCard>
            </div>

            {/* Main Chart */}
            <div className={`${CARD_DARK} border border-white/5 p-8 rounded-[2.5rem]`}>
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-[#d4ff00]" />
                <h3 className="text-xl font-bold text-white uppercase tracking-tighter">Evolución Diaria</h3>
              </div>
              <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-8">Tendencia de ingresos acumulados</p>
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={audit.timelineData}>
                    <defs>
                      <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={LIME_NEON} stopOpacity={0.3}/><stop offset="95%" stopColor={LIME_NEON} stopOpacity={0}/></linearGradient>
                    </defs>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#444', fontSize: 10}} />
                    <YAxis hide />
                    <Tooltip contentStyle={{backgroundColor: '#000', border: '1px solid #1a1a1a', borderRadius: '12px'}} formatter={(v) => [fmt(v), 'Ingresos']} />
                    <Area type="monotone" dataKey="val" stroke={LIME_NEON} fillOpacity={1} fill="url(#colorVal)" strokeWidth={3} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Product Mix Section */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 bg-[#0a0a0a] border border-white/5 rounded-[2.5rem] p-8 bg-gradient-to-br from-[#0a0a0a] to-black">
                <div className="flex flex-col md:flex-row items-center gap-8 h-full">
                  <div className="w-full md:w-1/2 h-[300px] relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie data={audit.productsPie} innerRadius={80} outerRadius={110} paddingAngle={8} dataKey="value" isAnimationActive={false} stroke="none">
                          {audit.productsPie.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                      </RechartsPieChart>
                    </ResponsiveContainer>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none"><TargetCenterIcon /></div>
                  </div>

                  <div className="w-full md:w-1/2 space-y-4">
                    {audit.productsPie.map((p, i) => (
                      <div key={p.fullName} className="group/item transition-all relative">
                        <div className="flex items-center justify-between mb-1.5 peer">
                          <span 
                            title={p.fullName} 
                            className="text-[11px] font-bold text-white/50 group-hover/item:text-white transition-colors truncate max-w-[140px] uppercase cursor-help"
                          >
                            {p.name}
                          </span>
                          <span className="text-[11px] font-black text-[#d4ff00]">{((p.value / audit.totalRevenue) * 100).toFixed(1)}%</span>
                        </div>
                        <div className="w-full h-[2px] bg-white/[0.03] rounded-full overflow-hidden">
                          <div className="h-full transition-all duration-1000" style={{ width: `${(p.value / audit.totalRevenue) * 100}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                        </div>
                        
                        {/* Custom Tooltip on Hover */}
                        <div className="absolute z-20 bottom-full left-0 mb-2 p-2 bg-black border border-white/10 rounded-lg text-[9px] font-bold uppercase tracking-widest text-white opacity-0 pointer-events-none group-hover/item:opacity-100 transition-opacity whitespace-nowrap shadow-2xl">
                          {p.fullName}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-5 grid grid-cols-1 gap-4">
                {audit.top3Products.map((p, i) => (
                  <div key={p.fullName} className="bg-[#0a0a0a] border border-white/5 p-6 rounded-[2rem] flex items-center justify-between group h-[95px] relative">
                    <div className="flex items-center gap-5">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${i === 0 ? 'bg-[#d4ff00]/10 border-[#d4ff00]/30' : 'bg-white/5 border-white/10'}`}>
                        {i === 0 ? <Award className="w-6 h-6 text-[#d4ff00]" /> : <Trophy className="w-5 h-5 text-white/20" />}
                      </div>
                      <div className="group/name relative">
                        <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">Rank #0{i+1}</p>
                        <h4 className="text-sm font-bold text-white group-hover:text-[#d4ff00] transition-colors uppercase tracking-tight truncate max-w-[180px] cursor-help">
                          {p.name}
                        </h4>
                        
                        {/* Tooltip for Top List */}
                        <div className="absolute z-20 left-0 bottom-full mb-1 p-2 bg-black border border-white/10 rounded-lg text-[9px] font-bold uppercase tracking-widest text-white opacity-0 pointer-events-none group-hover/name:opacity-100 transition-opacity whitespace-nowrap shadow-2xl">
                          {p.fullName}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[#d4ff00] font-bold tabular-nums tracking-tighter text-lg">{fmt(p.value).replace('$', '')}</div>
                      <p className="text-[10px] font-medium text-white/20 uppercase tracking-tighter">{p.count} VENTAS</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sellers List */}
            <div className={`${CARD_DARK} border border-white/5 p-12 rounded-[3rem]`}>
              <div className="flex items-center justify-between mb-12">
                <div className="space-y-1">
                  <h3 className="text-xs font-black uppercase tracking-[0.4em] text-white/40">Performance de Equipo</h3>
                  <p className="text-xl font-bold text-white">Ranking de Asesores</p>
                </div>
                <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-xl border border-white/10 text-[10px] font-bold text-white/40 uppercase tracking-widest">
                  <User className="w-4 h-4 text-[#d4ff00]" /> {audit.sellers.length} ACTIVOS
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {audit.sellers.map((s, i) => (
                  <div key={s.name} className="flex items-center justify-between group bg-white/[0.01] p-6 rounded-3xl border border-white/[0.03] hover:bg-white/[0.03] transition-all">
                    <div className="flex items-center gap-6 w-1/4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm border ${i === 0 ? 'bg-[#d4ff00] text-black border-transparent' : 'bg-white/5 text-white/20 border-white/10'}`}>
                        {i+1}
                      </div>
                      <span className="text-sm font-bold text-white/60 group-hover:text-white uppercase truncate">{s.name}</span>
                    </div>
                    <div className="w-1/3 px-10 hidden md:block opacity-30 group-hover:opacity-100 transition-opacity"><UserTrend data={s.trend} /></div>
                    <div className="text-right w-1/4">
                      <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-1">{s.count} VENTAS</p>
                      <p className={`text-xl font-bold ${i === 0 ? 'text-[#d4ff00]' : 'text-white'}`}>{fmt(s.val)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="mt-20 py-10 text-center border-t border-white/5 bg-black/50 backdrop-blur-md">
        <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.5em]">Arjaus Management System • 2026</p>
      </footer>
    </div>
  );
}