import React, { useState, useMemo, useEffect, useRef, useId } from 'react';
import {
  XAxis, YAxis, Tooltip,
  ResponsiveContainer, AreaChart, Area,
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

const COLORS = [LIME_NEON, '#ffffff', '#e5e5e5', '#a3a3a3', '#737373'];
const DEFAULT_LOGO_URL = "https://arjaus.com/img/isologotipo-blanco%20izquierda.svg";

// --- FORMATTERS (evita recrearlos y evita toLocaleDateString en loops) ---
const fmtCurrency = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const fmtNumberAR = new Intl.NumberFormat('es-AR');

const fmtDayShort = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short' });
const fmtDayKeyDDMM = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit' });
const fmtFullDayLabel = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

// --- HELPERS (fechas y keys consistentes sin UTC) ---
const pad2 = (n) => String(n).padStart(2, '0');

const toDayKeyLocal = (d) => {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
};

const safeUpper = (v) => String(v || '').toUpperCase();

const parseMoney = (v) => {
  const n = parseFloat(String(v || '0').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

// parsing de fecha robusto (dd/mm/yyyy, dd-mm-yyyy, yyyy-mm-dd), a mediodía local (evita corrimientos)
const parseDateLoose = (input) => {
  const raw = String(input || '').trim();
  if (!raw) return null;

  const clean = raw.replace(/\//g, '-').replace(/\s+/g, '');
  const p = clean.split('-');
  if (p.length !== 3) return null;

  const [a, b, c] = p;
  const isYearFirst = a.length === 4;

  let y, m, d;
  if (isYearFirst) {
    y = Number(a);
    m = Number(b);
    d = Number(c);
  } else {
    d = Number(a);
    m = Number(b);
    y = Number(c);
  }

  if (![y, m, d].every(Number.isFinite)) return null;
  if (y < 1900 || y > 2100) return null;
  if (m < 1 || m > 12) return null;
  if (d < 1 || d > 31) return null;

  const dt = new Date(y, m - 1, d, 12, 0, 0); // mediodía local
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
};

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
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
      tabIndex={0}
    >
      {children}
      {visible && text && (
        <div
          role="tooltip"
          className="fixed z-[9999] pointer-events-none bg-zinc-900 border border-white/30 px-3 py-2 rounded shadow-2xl backdrop-blur-md animate-in fade-in duration-75"
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

  const formatted = fmtNumberAR.format(displayValue);

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
      className={`relative overflow-hidden group hover:translate-y-[-4px] hover:border-[#d4ff00]/20 transition-all duration-500 border border-white/10 ${className}`}
    >
      <div
        className="pointer-events-none absolute -inset-px opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: `radial-gradient(600px circle at ${mousePos.x}px ${mousePos.y}px, rgba(212,255,0,0.08), transparent 40%)` }}
      />
      {children}
    </div>
  );
};

const PortfolioCenterIcon = () => (
  <div className="flex flex-col items-center justify-center opacity-60">
    <div className="relative">
      <Package size={42} strokeWidth={1} className="text-[#d4ff00] animate-pulse" />
      <div className="absolute inset-0 blur-lg bg-[#d4ff00]/20 -z-10"></div>
    </div>
    <span className="text-[7px] font-black uppercase tracking-[0.3em] mt-2 text-white/70">Core</span>
  </div>
);

// Active shape con ID único para evitar colisiones
const makeRenderActiveShape = (glowId) => (props) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <g>
      <filter id={glowId}>
        <feGaussianBlur stdDeviation="3" result="coloredBlur" />
        <feMerge>
          <feMergeNode in="coloredBlur" />
          <feMergeNode in="SourceGraphic" />
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
        filter={`url(#${glowId})`}
      />
    </g>
  );
};

// --- TOOLTIP COMPONENTS (fuera de App para no recrearlos) ---
const CustomActivityTooltip = ({ active, payload, fmt }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-zinc-900 border border-white/30 p-3 rounded shadow-2xl backdrop-blur-md">
        <p className="text-[10px] font-black text-white uppercase tracking-widest mb-1">{data.label || data.name}</p>
        <div className="flex items-center justify-between gap-4">
          <span className="text-white/80 text-[11px] font-bold uppercase tracking-tight">Monto:</span>
          <span className="text-white font-black">{fmt(data.total || data.val)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-white/80 text-[11px] font-bold uppercase tracking-tight">Ventas:</span>
          <span className="text-white font-black">{data.count}</span>
        </div>
      </div>
    );
  }
  return null;
};

const CustomPieTooltip = ({ active, payload, fmt, totalRevenue }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-zinc-900 border border-white/30 p-4 rounded shadow-2xl backdrop-blur-xl">
        <p className="text-[8px] font-black text-white/70 uppercase tracking-[0.2em] mb-1">Producto</p>
        <p className="text-xs font-bold text-white uppercase leading-tight mb-2 max-w-[200px]">{data.fullName}</p>
        <div className="h-[1px] bg-white/20 w-full mb-2"></div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-[10px] text-white/80 font-medium">Volumen:</span>
          <span className="text-sm font-black text-white">{fmt(data.value)}</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-[10px] text-white/80 font-medium">Participación:</span>
          <span className="text-xs font-bold text-white">{((data.value / totalRevenue) * 100).toFixed(1)}%</span>
        </div>
      </div>
    );
  }
  return null;
};

// --- CSV PARSER (más robusto: soporta ;, comillas escapadas, etc.) ---
const detectDelimiter = (headerLine) => {
  let inQuotes = false;
  let commas = 0;
  let semis = 0;
  for (let i = 0; i < headerLine.length; i++) {
    const ch = headerLine[i];
    if (ch === '"') {
      // toggle quotes ("" se maneja en parse)
      inQuotes = !inQuotes;
    } else if (!inQuotes) {
      if (ch === ',') commas++;
      if (ch === ';') semis++;
    }
  }
  return semis > commas ? ';' : ',';
};

const splitCSVLine = (line, delimiter) => {
  const out = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      // comilla escapada dentro de string: ""
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === delimiter && !inQuotes) {
      out.push(cur);
      cur = '';
      continue;
    }

    cur += ch;
  }

  out.push(cur);
  return out.map(v => String(v).trim());
};

const parseCSV = (text) => {
  const lines = String(text || '').split(/\r?\n/).filter(l => l.trim().length);
  if (lines.length < 2) return [];

  const delimiter = detectDelimiter(lines[0]);
  const headers = splitCSVLine(lines[0], delimiter).map(h => h.replace(/^"|"$/g, '').trim());

  return lines.slice(1).map(line => {
    const values = splitCSVLine(line, delimiter).map(v => v.replace(/^"|"$/g, '').trim());
    return headers.reduce((obj, header, i) => {
      obj[header] = values[i] ?? '';
      return obj;
    }, {});
  });
};

const abbreviateName = (name) => {
  if (!name) return "S/N";
  let clean = String(name)
    .replace(/Curso de /gi, '')
    .replace(/Carrera de /gi, '')
    .replace(/Especialización en /gi, '')
    .replace(/Taller de /gi, '');
  if (clean.length > 20) {
    return clean.substring(0, 18).toUpperCase() + "...";
  }
  return clean.toUpperCase();
};

const getSellerRankingStyle = (index) => {
  if (index === 0) return {
    cardBorder: "border-[#d4ff00]/30 shadow-[0_0_20px_rgba(212,255,0,0.05)]",
    badgeBg: "bg-gradient-to-br from-[#d4ff00] to-[#b8df00]",
    badgeText: "text-black",
  };
  if (index === 1) return {
    cardBorder: "border-[#d4ff00]/15",
    badgeBg: "bg-gradient-to-br from-[#b8df00] to-[#8ca900]",
    badgeText: "text-black",
  };
  if (index === 2) return {
    cardBorder: "border-[#d4ff00]/5",
    badgeBg: "bg-gradient-to-br from-[#8ca900] to-[#5c7a00]",
    badgeText: "text-black",
  };
  return {
    cardBorder: "border-white/5",
    badgeBg: "bg-[#1a1a1a] border border-white/10",
    badgeText: "text-white",
  };
};

// --- APP PRINCIPAL ---
export default function App() {
  const [rawData, setRawData] = useState([]);
  const [targetBimestral, setTargetBimestral] = useState(120000000);
  const [customLogo, setCustomLogo] = useState(DEFAULT_LOGO_URL);
  const [activeIndex, setActiveIndex] = useState(null);

  const glowId = useId();
  const renderActiveShape = useMemo(() => makeRenderActiveShape(`glow-${glowId.replace(/:/g, '')}`), [glowId]);

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
          const dStr = row['Fecha Ingreso'] || row['fecha_ingreso'] || '';
          const aStr = row['Cuota Actual'] || row['cuota_actual'] || '0';
          const mStr = row['Matricula'] || row['matrícula'] || row['Matrícula'] || '0';

          let seller = row['Cargado por'] || row['cargado_por'] || 'Sitio Web';
          const estadoRaw = row['Estado'] || row['estado'] || '';

          if (!seller || seller === '0' || String(seller).trim() === '') seller = 'Sitio Web';

          const dateObj = parseDateLoose(dStr);

          const amount = parseMoney(aStr);
          const matricula = parseMoney(mStr);
          const total = amount + matricula;

          return {
            ...row,
            date: dateObj,
            amount,
            matricula,
            total,
            seller,
            estado: safeUpper(estadoRaw),
            productName: row['Producto'] || 'Sin Nombre',
          };
        }).filter(i => i.date && !Number.isNaN(i.date.getTime()));

        setRawData(processed);
      } catch (err) {
        console.error("Error al procesar el archivo:", err);
      }
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

  // --- MEMOS SEPARADOS (más mantenible y fácil de perf) ---
  const baseAgg = useMemo(() => {
    if (rawData.length === 0) return null;

    let totalRevenue = 0;
    let guaranteedCount = 0;
    let facturacionGarantizada = 0;
    let facturacionPorGarantizar = 0;

    // mapas para timelines en una sola pasada
    const timelineByDayKey = {};        // YYYY-MM-DD -> { date, val, count }
    const activityByDayKey = {};        // YYYY-MM-DD -> { total, count }

    // products
    const productsMap = {};

    // sellers raw list
    const uniqueRawSellersSet = new Set();

    // precarga sellers map base
    for (const c of rawData) {
      totalRevenue += c.total;

      if (c.estado.includes('GARANTIZADO')) {
        guaranteedCount += 1;
        facturacionGarantizada += c.total;
      } else {
        facturacionPorGarantizar += c.total;
      }

      const dayKey = toDayKeyLocal(c.date);

      if (!timelineByDayKey[dayKey]) timelineByDayKey[dayKey] = { date: c.date, val: 0, count: 0 };
      timelineByDayKey[dayKey].val += c.total;
      timelineByDayKey[dayKey].count += 1;

      if (!activityByDayKey[dayKey]) activityByDayKey[dayKey] = { total: 0, count: 0 };
      activityByDayKey[dayKey].total += c.total;
      activityByDayKey[dayKey].count += 1;

      const full = c.productName;
      if (!productsMap[full]) productsMap[full] = { fullName: full, name: abbreviateName(full), value: 0, count: 0 };
      productsMap[full].value += c.total;
      productsMap[full].count += 1;

      uniqueRawSellersSet.add(c.seller);
    }

    const uniqueRawSellers = Array.from(uniqueRawSellersSet);

    return {
      totalRevenue,
      totalCount: rawData.length,
      guaranteedCount,
      facturacionGarantizada,
      facturacionPorGarantizar,
      timelineByDayKey,
      activityByDayKey,
      productsMap,
      uniqueRawSellers
    };
  }, [rawData]);

  const sellersComputed = useMemo(() => {
    if (!baseAgg) return null;

    const { uniqueRawSellers } = baseAgg;

    // --- unify seller names (misma lógica original, solo más seguro con strings) ---
    const sellerNameMap = {};
    const knownSellers = [];

    uniqueRawSellers.forEach(rawSeller => {
      const cleanRaw = String(rawSeller || '').trim();
      if (!cleanRaw || cleanRaw === '0' || cleanRaw.toLowerCase() === 'sitio web') {
        sellerNameMap[rawSeller] = 'Sitio Web';
        return;
      }

      let foundMatch = false;
      for (let known of knownSellers) {
        const n1 = cleanRaw.toLowerCase().split(/\s+/);
        const n2 = known.raw.toLowerCase().split(/\s+/);
        const sharedWords = n1.filter(w => n2.includes(w) && w.length > 2);
        if (sharedWords.length > 0) {
          const nonShared1 = n1.filter(w => !n2.includes(w));
          const nonShared2 = n2.filter(w => !n1.includes(w));
          let isPrefix = false;
          if (nonShared1.length === 1 && nonShared2.length === 1) {
            if (nonShared1[0].startsWith(nonShared2[0]) || nonShared2[0].startsWith(nonShared1[0])) isPrefix = true;
          }
          const isSubset = nonShared1.length === 0 || nonShared2.length === 0;
          const isApud = cleanRaw.toLowerCase().includes('apud') && known.raw.toLowerCase().includes('apud');
          if (isPrefix || isSubset || isApud) {
            foundMatch = true;
            if (cleanRaw.length > known.display.length) {
              known.display = cleanRaw.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
            }
            sellerNameMap[rawSeller] = known;
            break;
          }
        }
      }

      if (!foundMatch) {
        const display = cleanRaw.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        const newKnown = { raw: cleanRaw, display };
        knownSellers.push(newKnown);
        sellerNameMap[rawSeller] = newKnown;
      }
    });

    Object.keys(sellerNameMap).forEach(k => {
      if (typeof sellerNameMap[k] === 'object') sellerNameMap[k] = sellerNameMap[k].display;
    });

    // --- aggregate sellers (una sola pasada) ---
    const sellersMap = {};

    for (const c of rawData) {
      const unifiedName = sellerNameMap[c.seller] || 'Sitio Web';
      if (!sellersMap[unifiedName]) {
        sellersMap[unifiedName] = {
          name: unifiedName,
          val: 0,
          count: 0,
          daily: {},
          countDaily: {},
          garantizadas: 0,
          facturacionGarantizada: 0
        };
      }

      const s = sellersMap[unifiedName];
      s.val += c.total;
      s.count += 1;

      if (c.estado.includes('GARANTIZADO')) {
        s.garantizadas += 1;
        s.facturacionGarantizada += c.total;
      }

      const dayKey = toDayKeyLocal(c.date);
      s.daily[dayKey] = (s.daily[dayKey] || 0) + c.total;
      s.countDaily[dayKey] = (s.countDaily[dayKey] || 0) + 1;
    }

    const sellers = Object.values(sellersMap).map(s => {
      const trendRaw = Object.entries(s.daily).map(([dayKey, val]) => {
        const [yy, mm, dd] = dayKey.split('-').map(Number);
        const dt = new Date(yy, mm - 1, dd, 12, 0, 0);
        return { date: dt, val, count: s.countDaily[dayKey] };
      }).sort((a, b) => a.date - b.date);

      const trend = trendRaw.map(t => ({
        name: fmtDayShort.format(t.date),
        val: t.val,
        count: t.count
      }));

      const uniqueDays = trend.length || 1;
      return { ...s, trend, promDia: s.val / uniqueDays };
    }).sort((a, b) => b.val - a.val);

    return sellers;
  }, [baseAgg, rawData]);

  const audit = useMemo(() => {
    if (!baseAgg) return null;

    const {
      totalRevenue,
      totalCount,
      guaranteedCount,
      facturacionGarantizada,
      facturacionPorGarantizar,
      timelineByDayKey,
      activityByDayKey,
      productsMap
    } = baseAgg;

    // timelineData (ordenado por fecha real)
    const timelineData = Object.entries(timelineByDayKey)
      .map(([dayKey, v]) => {
        const [yy, mm, dd] = dayKey.split('-').map(Number);
        const dt = new Date(yy, mm - 1, dd, 12, 0, 0);
        return { name: fmtDayShort.format(dt), val: v.val, count: v.count, date: dt };
      })
      .sort((a, b) => a.date - b.date);

    // activityTimeline: últimos 30 días desde maxDate, sin filtrar N veces
    const maxTime = Math.max(...rawData.map(d => d.date.getTime()));
    const maxDate = new Date(maxTime);

    const activityTimeline = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(maxDate);
      d.setDate(d.getDate() - i);

      const dayKey = toDayKeyLocal(d);
      const entry = activityByDayKey[dayKey];

      const dateKey = fmtDayKeyDDMM.format(d);
      const fullDateLabel = fmtFullDayLabel.format(d);

      const total = entry ? entry.total : 0;
      const count = entry ? entry.count : 0;

      activityTimeline.push({
        name: dateKey,
        label: fullDateLabel,
        total,
        count,
        isZero: total === 0
      });
    }

    const maxActivityVal = Math.max(...activityTimeline.map(a => a.total)) || 1;

    const productsAll = Object.values(productsMap).sort((a, b) => b.value - a.value);

    return {
      totalRevenue,
      totalCount,
      guaranteedCount,
      timelineData,
      activityTimeline,
      maxActivityVal,
      sellers: sellersComputed || [],
      top3Products: productsAll.slice(0, 3),
      productsPie: productsAll.slice(0, 5),
      productsAll,
      facturacionGarantizada,
      facturacionPorGarantizar
    };
  }, [baseAgg, rawData, sellersComputed]);

  const fmt = (v) => fmtCurrency.format(v);

  const clearData = () => setRawData([]);

  const getProductRankingStyle = (index) => {
    if (index === 0) return { color: "text-[#d4ff00]", shadow: "drop-shadow-[0_0_8px_rgba(212,255,0,0.5)]", iconColor: "text-[#d4ff00]" };
    if (index === 1) return { color: "text-[#d4ff00]/80", shadow: "drop-shadow-[0_0_4px_rgba(212,255,0,0.2)]", iconColor: "text-[#d4ff00]/80" };
    if (index === 2) return { color: "text-[#d4ff00]/60", shadow: "", iconColor: "text-[#d4ff00]/60" };
    return { color: "text-white/70", shadow: "", iconColor: "text-white/70" };
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
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/70 leading-none">Management System</span>
            <span className="text-[13px] font-bold text-white tracking-wider uppercase">Panel de Control</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {rawData.length > 0 && (
            <button
              type="button"
              onClick={clearData}
              className="group flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-500/30 bg-red-500/5 hover:bg-red-500/10 transition-all active:scale-95"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-500/80" />
              <span className="text-[10px] font-black text-red-500/80 uppercase tracking-widest">Limpiar</span>
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
              <div className="absolute inset-0 bg-[#d4ff00]/5 translate-y-24 group-hover:translate-y-0 transition-transform duration-700" />
              <Database className="text-white/50 w-10 h-10 group-hover:text-[#d4ff00] transition-colors relative z-10" />
            </div>
            <h1 className="text-3xl font-light mb-4 text-white/90">Ready to <span className="text-white font-bold">Audit</span></h1>
            <p className="text-xs text-white/70 uppercase tracking-[0.3em] mb-10">Selecciona tu base de datos para comenzar</p>
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
                    <span className="text-xl font-bold text-[#d4ff00] opacity-80">$</span>
                    <AnimatedNumber value={audit.totalRevenue} />
                  </div>
                  <p className="text-[9px] text-white/40 mt-1 font-bold tracking-widest uppercase">{audit.totalCount} VENTAS</p>
                </div>
              </GlowCard>
              <GlowCard className="bg-[#0a0a0a] p-8 rounded-[2rem] flex flex-col justify-between h-52">
                <div className="w-10 h-10 rounded-xl bg-[#141414] border border-white/10 flex items-center justify-center"><ShieldCheck className="w-5 h-5 text-[#d4ff00]" /></div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/80 font-bold mb-1">TICKET PROMEDIO</p>
                  <AnimatedNumber value={audit.totalRevenue / audit.totalCount} />
                  <p className="text-[9px] text-white/40 mt-1 font-bold tracking-widest uppercase">VALOR POR OPERACIÓN</p>
                </div>
              </GlowCard>
              <GlowCard className="bg-[#0a0a0a] p-8 rounded-[2rem] flex flex-col justify-between h-52 relative">
                <div className="flex justify-between items-start">
                  <div className="w-10 h-10 rounded-xl bg-[#141414] border border-white/10 flex items-center justify-center"><Database className="w-5 h-5 text-[#d4ff00]" /></div>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 border border-white/10 bg-white/5 rounded-full"><div className="w-1 h-1 rounded-full bg-[#d4ff00] animate-pulse" /><span className="text-[8px] font-black text-white/70 tracking-[0.1em] uppercase">{audit.guaranteedCount} GARANTIZADAS</span></div>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/80 font-bold mb-1">INSCRIPCIONES TOTALES</p>
                  <h2 className="text-5xl font-bold tracking-tight">{audit.totalCount}</h2>
                  <p className="text-[9px] text-white/40 mt-1 font-bold tracking-widest uppercase">REGISTROS PROCESADOS</p>
                </div>
              </GlowCard>
              <GlowCard className="bg-[#0a0a0a] p-8 rounded-[2rem] flex flex-col justify-between h-52">
                <div className="flex justify-between items-start">
                  <div className="w-10 h-10 rounded-xl bg-[#141414] border border-white/10 flex items-center justify-center"><Target className="w-5 h-5 text-[#d4ff00]" /></div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <input
                        aria-label="Meta bimestral"
                        type="number"
                        value={targetBimestral}
                        onChange={(e) => setTargetBimestral(Number(e.target.value))}
                        className="bg-transparent text-[#d4ff00] font-black text-right text-sm outline-none border-b border-white/20 focus:border-[#d4ff00] w-24 transition-all"
                      />
                      <Edit2 className="w-3 h-3 text-white/50" />
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

            {/* SECCIÓN: Estado de Facturación Garantizada */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <GlowCard className="bg-[#0a0a0a] p-8 rounded-[2.5rem] flex flex-col justify-between h-48">
                <div className="flex justify-between items-start">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/80 font-bold">FACTURACIÓN GARANTIZADA</p>
                  <span className="text-2xl font-bold text-[#d4ff00] tracking-tighter">{((audit.facturacionGarantizada / audit.totalRevenue) * 100).toFixed(1)}%</span>
                </div>
                <div>
                  <div className="text-4xl font-bold text-[#d4ff00] tracking-tighter mb-2">{fmt(audit.facturacionGarantizada)}</div>
                  <div className="w-full bg-white/10 rounded-full h-1 overflow-hidden">
                    <div className="bg-[#d4ff00] h-full shadow-[0_0_10px_#d4ff00] transition-all" style={{ width: `${(audit.facturacionGarantizada / audit.totalRevenue) * 100}%` }}></div>
                  </div>
                  <p className="text-[9px] text-white/40 mt-3 font-bold tracking-widest uppercase">INGRESOS ASEGURADOS</p>
                </div>
              </GlowCard>

              <GlowCard className="bg-[#0a0a0a] p-8 rounded-[2.5rem] flex flex-col justify-between h-48">
                <div className="flex justify-between items-start">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/80 font-bold">FACTURACIÓN POR GARANTIZAR</p>
                  <span className="text-2xl font-bold text-white/40 tracking-tighter">{((audit.facturacionPorGarantizar / audit.totalRevenue) * 100).toFixed(1)}%</span>
                </div>
                <div>
                  <div className="text-4xl font-bold text-white tracking-tighter mb-2">{fmt(audit.facturacionPorGarantizar)}</div>
                  <div className="w-full bg-white/10 rounded-full h-1 overflow-hidden">
                    <div className="bg-white/40 h-full transition-all" style={{ width: `${(audit.facturacionPorGarantizar / audit.totalRevenue) * 100}%` }}></div>
                  </div>
                  <div className="flex justify-between items-center mt-3">
                    <p className="text-[9px] text-white/40 font-bold tracking-widest uppercase">EN PROCESO</p>
                  </div>
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
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#888', fontSize: 9 }} interval={2} />
                      <Tooltip cursor={{ fill: 'rgba(212, 255, 0, 0.05)' }} content={<CustomActivityTooltip fmt={fmt} />} />
                      <Bar dataKey="total" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                        {audit.activityTimeline.map((entry, index) => {
                          const intensity = entry.isZero ? 0.08 : 0.25 + (entry.total / audit.maxActivityVal) * 0.75;
                          return <Cell key={`cell-${index}`} fill={LIME_NEON} opacity={intensity} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-gradient-to-br from-[#0a0a0a] to-[#111] border border-white/10 p-8 rounded-[2.5rem] flex flex-col justify-center text-center">
                <div className="w-16 h-16 bg-[#d4ff00]/5 rounded-2xl flex items-center justify-center mx-auto mb-6"><BarChart3 className="w-8 h-8 text-[#d4ff00]" /></div>
                <p className="text-[10px] font-black text-white/70 uppercase tracking-[0.4em] mb-2">PROM. DIARIO (PERIODO)</p>
                <div className="text-4xl font-bold tracking-tighter mb-2">{fmt(audit.activityTimeline.reduce((s, a) => s + a.total, 0) / 30)}</div>
                <p className="text-[9px] text-white/40 font-bold uppercase tracking-widest">Cálculo ultimos 30 días </p>
              </div>
            </div>

            {/* Evolución Temporal */}
            <div className={`${CARD_DARK} border border-white/10 p-8 rounded-[2.5rem]`}>
              <div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-[#d4ff00]" /><h3 className="text-xl font-bold text-white uppercase tracking-tighter">Evolución Diaria</h3></div>
              <p className="text-[10px] uppercase tracking-widest text-white/80 font-bold mb-8">Tendencia de ingresos acumulados</p>
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={audit.timelineData}>
                    <defs>
                      <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={LIME_NEON} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={LIME_NEON} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#888', fontSize: 10 }} />
                    <YAxis hide />
                    <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px' }} formatter={(v) => [fmt(v), 'Ingresos']} />
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
                              style={{ filter: `drop-shadow(0 0 8px ${COLORS[index % COLORS.length]}33)` }}
                            />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomPieTooltip fmt={fmt} totalRevenue={audit.totalRevenue} />} />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                      <PortfolioCenterIcon />
                    </div>
                  </div>

                  <div className="w-full md:w-2/5 space-y-5">
                    <div className="mb-2">
                      <h3 className="text-sm font-black text-white/80 uppercase tracking-[0.3em]">Portfolio</h3>
                      <p className="text-[10px] text-[#d4ff00]/80 font-bold uppercase">Análisis de Distribución</p>
                    </div>
                    {audit.productsPie.map((p, i) => (
                      <div
                        key={p.fullName}
                        className={`group/item transition-all duration-300 p-2 rounded-xl ${activeIndex === i ? 'bg-white/5 border-l border-[#d4ff00]/50' : 'opacity-70 hover:opacity-100'}`}
                        onMouseEnter={() => setActiveIndex(i)}
                        onMouseLeave={() => setActiveIndex(null)}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <InstantTooltip text={p.fullName}>
                            <span className="text-[11px] font-bold text-white uppercase truncate block max-w-[130px] cursor-help">{p.name}</span>
                          </InstantTooltip>
                          <span className="text-[11px] font-black text-[#d4ff00]/90 shrink-0 ml-2">{((p.value / audit.totalRevenue) * 100).toFixed(1)}%</span>
                        </div>
                        <div className="w-full h-[3px] bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full transition-all duration-1000" style={{ width: `${(p.value / audit.totalRevenue) * 100}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Top 3 List (Productos) — estética intacta (copas como ya dejaste) */}
              <div className="lg:col-span-5 grid grid-cols-1 gap-4">
                {audit.top3Products.map((p, i) => {
                  const style = getProductRankingStyle(i);
                  return (
                    <div key={p.fullName} className={`bg-[#0a0a0a] border border-white/10 p-6 rounded-[2rem] flex items-center justify-between group h-[95px] relative overflow-hidden transition-all hover:bg-white/[0.03]`}>
                      <div className="absolute -right-4 -bottom-4 opacity-[0.08] group-hover:opacity-[0.22] transition-opacity pointer-events-none -rotate-12">
                        <Trophy size={110} strokeWidth={1} className="text-white/30 group-hover:text-white/40 transition-colors" />
                      </div>

                      <div className="flex items-center gap-5 relative z-10 min-w-0 flex-1">
                        <div className={`shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center border border-white/10 bg-black/60 transition-all duration-500`}>
                          {i === 0 ? <Trophy className={style.iconColor} size={24} /> : i === 1 ? <Award className={style.iconColor} size={24} /> : <Target className={style.iconColor} size={24} />}
                        </div>
                        <div className="flex flex-col">
                          <span className={`text-[12px] font-black uppercase tracking-wider ${style.color} ${style.shadow} truncate max-w-[150px]`}>{p.name}</span>
                          <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest">{p.count} VENTAS</span>
                        </div>
                      </div>
                      <div className="text-right z-10">
                        <div className="text-xl font-black text-white tracking-tighter">{fmt(p.value)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SECCIÓN: Rendimiento por Vendedor (Ranking Inteligente) — estética intacta (copas integradas) */}
            <div className="mt-10 pt-10 border-t border-white/10">
              <div className="flex items-center gap-2 mb-8">
                <User className="w-5 h-5 text-[#d4ff00]" />
                <h3 className="text-2xl font-bold text-white uppercase tracking-tighter">Ranking de Asesores</h3>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {audit.sellers.map((s, i) => {
                  const style = getSellerRankingStyle(i);
                  return (
                    <div key={s.name} className={`group bg-[#0a0a0a] border ${style.cardBorder} rounded-[2rem] p-6 relative overflow-hidden transition-all duration-300 hover:scale-[1.01]`}>
                      <div className="absolute bottom-[-36px] right-[-36px] opacity-[0.035] group-hover:opacity-[0.11] transition-all duration-700 pointer-events-none rotate-12">
                        <Trophy size={210} strokeWidth={1} className="text-white/25 group-hover:text-white/35 transition-colors" />
                      </div>

                      <div className="flex items-center justify-between mb-4 relative z-10">
                        <div className="flex items-center gap-3">
                          <span className={`${style.badgeBg} ${style.badgeText} w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shadow-sm`}>{i + 1}</span>
                          <h4 className="text-sm font-black uppercase truncate max-w-[180px] text-white">{s.name}</h4>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] text-white/40 font-bold uppercase tracking-widest mb-0.5">{s.count} VENTAS</p>
                          <span className="text-2xl font-black text-[#d4ff00] tracking-tighter">{fmt(s.val)}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-6 relative z-10">
                        <div className="bg-black/60 rounded-xl p-3 border border-white/5 backdrop-blur-sm">
                          <p className="text-[9px] text-white/40 uppercase tracking-widest font-bold mb-1">Promedio Diario</p>
                          <p className="text-sm font-bold text-white tracking-tight">{fmt(s.promDia)}</p>
                        </div>
                        <div className="bg-black/60 rounded-xl p-3 border border-white/5 backdrop-blur-sm">
                          <p className="text-[9px] text-white/40 uppercase tracking-widest font-bold mb-1">Garantizado ({s.garantizadas} est.)</p>
                          <p className="text-sm font-bold text-[#d4ff00] tracking-tight">{fmt(s.facturacionGarantizada)}</p>
                        </div>
                      </div>

                      <div className="relative z-10">
                        <p className="text-[8px] text-white/40 uppercase tracking-widest font-bold mb-2 text-center">Evolución de ventas</p>
                        <div className="h-[140px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={s.trend}>
                              <defs>
                                <linearGradient id={`colorS-${i}`} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor={LIME_NEON} stopOpacity={0.5} />
                                  <stop offset="95%" stopColor={LIME_NEON} stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#888', fontSize: 9 }} minTickGap={15} />
                              <Tooltip content={<CustomActivityTooltip fmt={fmt} />} cursor={{ fill: 'rgba(212, 255, 0, 0.05)' }} />
                              <Area type="monotone" dataKey="val" stroke={LIME_NEON} fillOpacity={1} fill={`url(#colorS-${i})`} strokeWidth={2} isAnimationActive={false} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}