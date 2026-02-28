import React, {
  useState,
  useMemo,
  useEffect,
  useRef,
  useId,
  useTransition,
} from 'react';

import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Sector,
} from 'recharts';

import {
  Database,
  Target,
  User,
  Users,
  Trophy,
  TrendingUp,
  Zap,
  ShieldCheck,
  Upload,
  Trash2,
  Edit2,
  Award,
  BarChart3,
  Calendar,
  Package,
} from 'lucide-react';

// --- CONFIGURACIÓN DE ESTILO ---
const LIME_NEON = '#d4ff00';
const LIME_MID = '#b8df00';
const LIME_DARK = '#8ca900';

const BG_PURE_BLACK = 'bg-black';
const CARD_DARK = 'bg-[#0a0a0a]';

const COLORS = [LIME_NEON, '#ffffff', '#e5e5e5', '#a3a3a3', '#737373'];
const DEFAULT_LOGO_URL =
  'https://arjaus.com/img/isologotipo-blanco%20izquierda.svg';

// --- HARDENING ---
const MAX_FILE_MB = 20;

// --- FORMATTERS (números) ---
const fmtCurrency = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});
const fmtNumberAR = new Intl.NumberFormat('es-AR');

// --- FORMATTERS (fechas) ---
// dd-mmm (13-ene, 03-feb)
const fmtAxisDate = (d) => {
  if (!d) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const mon = new Intl.DateTimeFormat('es-AR', { month: 'short' })
    .format(d)
    .replace('.', '')
    .toLowerCase();
  return `${day}-${mon}`;
};

// "Miércoles 19-02"
const fmtTooltipDate = (d) => {
  if (!d) return '';
  const weekday = new Intl.DateTimeFormat('es-AR', { weekday: 'long' }).format(d);
  const capWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${capWeekday} ${dd}-${mm}`;
};

// --- HELPERS (fechas y keys consistentes sin UTC) ---
const pad2 = (n) => String(n).padStart(2, '0');

const toDayKeyLocal = (d) => {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
};

const safeUpper = (v) => String(v || '').toUpperCase();

// normaliza mail
const normalizeEmail = (v) => {
  const s = String(v || '').trim().toLowerCase();
  if (!s) return '';
  return s.replace(/\s+/g, '');
};

// normaliza DNI (solo dígitos)
const normalizeDNI = (v) => {
  const s = String(v || '').trim();
  if (!s) return '';
  const digits = s.replace(/\D/g, '');
  return digits;
};

/**
 * parseMoney robusto AR/US
 * Soporta:
 * - 1.234.567,89  (AR)
 * - 1,234,567.89  (US)
 * - $ 123.456     (cualquier símbolo)
 */
const parseMoney = (input) => {
  const raw = String(input ?? '').trim();
  if (!raw) return 0;

  let s = raw.replace(/\s/g, '').replace(/[^0-9,.\-]/g, '');
  if (!s) return 0;

  const hasComma = s.includes(',');
  const hasDot = s.includes('.');

  if (hasComma && hasDot) {
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    const decimalIsComma = lastComma > lastDot;

    if (decimalIsComma) {
      s = s.replace(/\./g, '').replace(/,/g, '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (hasComma && !hasDot) {
    s = s.replace(/,/g, '.');
  }

  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};

// parsing de fecha robusto (dd/mm/yyyy, dd-mm-yyyy, yyyy-mm-dd), a mediodía local
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

  const dt = new Date(y, m - 1, d, 12, 0, 0);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
};

// --- CSV PARSER (más robusto: soporta ;, comillas escapadas, etc.) ---
const detectDelimiter = (headerLine) => {
  let inQuotes = false;
  let commas = 0;
  let semis = 0;
  for (let i = 0; i < headerLine.length; i++) {
    const ch = headerLine[i];
    if (ch === '"') {
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
  return out.map((v) => String(v).trim());
};

const parseCSV = (text) => {
  const lines = String(text || '')
    .split(/\r?\n/)
    .filter((l) => l.trim().length);
  if (lines.length < 2) return [];

  const delimiter = detectDelimiter(lines[0]);
  const headers = splitCSVLine(lines[0], delimiter).map((h) =>
    h.replace(/^"|"$/g, '').trim()
  );

  return lines.slice(1).map((line) => {
    const values = splitCSVLine(line, delimiter).map((v) =>
      v.replace(/^"|"$/g, '').trim()
    );
    return headers.reduce((obj, header, i) => {
      obj[header] = values[i] ?? '';
      return obj;
    }, {});
  });
};
// --- Data contract / schema check (best-effort) ---
const COL_ALIASES = {
  fecha: ['Fecha Ingreso', 'fecha_ingreso', 'fecha', 'Fecha'],
  monto: ['Cuota Actual', 'cuota_actual', 'cuota', 'Monto', 'monto'],
  producto: ['Producto', 'producto', 'Curso', 'curso', 'Descripción', 'descripcion'],
  matricula: ['Matricula', 'matrícula', 'Matrícula', 'matricula'],
  seller: ['Cargado por', 'cargado_por', 'Vendedor', 'vendedor', 'Asesor', 'asesor'],
  estado: ['Estado', 'estado'],
  dni: ['DNI', 'dni', 'Documento', 'documento', 'Nro Documento', 'Nro documento'],
  email: ['Email', 'email', 'Correo', 'correo', 'Mail', 'mail'],
  camada: ['Camada', 'camada', 'Código Camada', 'codigo_camada', 'Cohorte', 'cohorte', 'Cod Camada', 'cod_camada'],
};

const pickFirst = (row, keys) => {
  for (const k of keys) {
    const v = row?.[k];
    if (v != null && String(v).trim() !== '') return v;
  }
  return '';
};

const schemaCheck = (headers) => {
  const missing = [];
  const hasAny = (k) => COL_ALIASES[k].some((a) => headers.includes(a));
  if (!hasAny('fecha')) missing.push('fecha');
  if (!hasAny('monto')) missing.push('monto');
  if (!hasAny('producto')) missing.push('producto');
  return missing;
};

const parseAndNormalizeRow = (row, rowIndex) => {
  const reasons = [];

  const dStr = pickFirst(row, COL_ALIASES.fecha);
  const aStr = pickFirst(row, COL_ALIASES.monto);
  const mStr = pickFirst(row, COL_ALIASES.matricula);

  let seller = pickFirst(row, COL_ALIASES.seller) || 'Sitio Web';
  const estadoRaw = pickFirst(row, COL_ALIASES.estado);

  if (!seller || seller === '0' || String(seller).trim() === '') seller = 'Sitio Web';

  const dateObj = parseDateLoose(dStr);
  if (!dateObj) reasons.push('fecha inválida');

  const amount = parseMoney(aStr);
  if (!Number.isFinite(amount)) reasons.push('monto inválido');

  const matricula = parseMoney(mStr);
  if (!Number.isFinite(matricula)) reasons.push('matrícula inválida');

  const total =
    (Number.isFinite(amount) ? amount : 0) +
    (Number.isFinite(matricula) ? matricula : 0);

  const productName = pickFirst(row, COL_ALIASES.producto) || 'Sin Nombre';
  if (!productName || String(productName).trim() === '') reasons.push('producto vacío');

  const camadaRaw = pickFirst(row, COL_ALIASES.camada);
  const productKey = String(camadaRaw || '').trim() || String(productName || '').trim();

  const dniRaw = pickFirst(row, COL_ALIASES.dni);
  const emailRaw = pickFirst(row, COL_ALIASES.email);
  const dni = normalizeDNI(dniRaw);
  const email = normalizeEmail(emailRaw);

  const normalized = {
    ...row,
    date: dateObj,
    amount: Number.isFinite(amount) ? amount : 0,
    matricula: Number.isFinite(matricula) ? matricula : 0,
    total: Number.isFinite(total) ? total : 0,
    seller,
    estado: safeUpper(estadoRaw),
    productName,
    productKey,
    dni,
    email,
  };

  const isDiscarded = !normalized.date || Number.isNaN(normalized.date.getTime());
  return { normalized, reasons, isDiscarded, rowIndex };
};

const abbreviateName = (name) => {
  if (!name) return 'S/N';
  let clean = String(name)
    .replace(/Curso de /gi, '')
    .replace(/Carrera de /gi, '')
    .replace(/Especialización en /gi, '')
    .replace(/Taller de /gi, '');
  if (clean.length > 20) return clean.substring(0, 18).toUpperCase() + '...';
  return clean.toUpperCase();
};

// ✅ TOP3 con glow. Desde #4: monto blanco apagado sin glow.
const getSellerRankingStyle = (index) => {
  const base = {
    rowBorder: '',
    amountText: 'text-[22px] font-black tracking-tighter',
    rankBox:
      'w-10 h-10 rounded-2xl flex items-center justify-center bg-black/60 border border-white/10',
    rankText: 'text-[12px] font-black',
  };

  if (index === 0) {
    return {
      ...base,
      rankTextColor: 'text-[#d4ff00]',
      rankGlow:
        'shadow-[0_0_0_1px_rgba(212,255,0,0.18),0_0_22px_rgba(212,255,0,0.35)]',
      amountColor: 'text-[#d4ff00]',
      amountGlow: 'drop-shadow-[0_0_14px_rgba(212,255,0,0.22)]',
    };
  }
  if (index === 1) {
    return {
      ...base,
      rankTextColor: 'text-[#b8df00]',
      rankGlow:
        'shadow-[0_0_0_1px_rgba(184,223,0,0.14),0_0_16px_rgba(184,223,0,0.26)]',
      amountColor: 'text-[#b8df00]',
      amountGlow: 'drop-shadow-[0_0_12px_rgba(184,223,0,0.18)]',
    };
  }
  if (index === 2) {
    return {
      ...base,
      rankTextColor: 'text-[#8ca900]',
      rankGlow:
        'shadow-[0_0_0_1px_rgba(140,169,0,0.10),0_0_12px_rgba(140,169,0,0.18)]',
      amountColor: 'text-[#8ca900]',
      amountGlow: 'drop-shadow-[0_0_10px_rgba(140,169,0,0.14)]',
    };
  }

  return {
    ...base,
    rankTextColor: 'text-white/60',
    rankGlow: 'shadow-none',
    amountColor: 'text-white/70',
    amountGlow: 'shadow-none',
  };
};

// ✅ Top 3 productos: #1 lime, #2 y #3 blancos
const getProductRankingStyle = (index) => {
  if (index === 0) {
    return {
      color: 'text-[#d4ff00]',
      shadow: 'drop-shadow-[0_0_7px_rgba(212,255,0,0.35)]',
      iconColor: 'text-[#d4ff00]',
      amountColor: 'text-[#d4ff00]',
    };
  }
  if (index === 1 || index === 2) {
    return {
      color: 'text-white',
      shadow: '',
      iconColor: 'text-white/85',
      amountColor: 'text-white',
    };
  }
  return {
    color: 'text-white/70',
    shadow: '',
    iconColor: 'text-white/70',
    amountColor: 'text-white/80',
  };
};
const InstantTooltip = ({ text, children }) => {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const tooltipId = useId();

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
      aria-describedby={visible && text ? tooltipId : undefined}
    >
      {children}
      {visible && text && (
        <div
          id={tooltipId}
          role="tooltip"
          className="fixed z-[9999] pointer-events-none bg-zinc-900 border border-white/20 px-3 py-2 rounded shadow-2xl backdrop-blur-md animate-in fade-in duration-75"
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
    const end = Math.floor(Number(value || 0));
    if (start === end) {
      setDisplayValue(end);
      return;
    }
    const totalMiliseconds = 1500;
    const incrementTime = 30;
    const steps = totalMiliseconds / incrementTime;
    const increment = end / steps;

    const timer = setInterval(() => {
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

  return (
    <span
      className={`${getFontSize(
        formatted
      )} font-bold tracking-tighter transition-all duration-300`}
    >
      {formatted}
    </span>
  );
};

const GlowCard = ({ children, className = '' }) => {
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
      className={`relative overflow-hidden group hover:translate-y-[-4px] hover:border-[#d4ff00]/12 transition-all duration-500 border border-white/5 ${className}`}
    >
      <div
        className="pointer-events-none absolute -inset-px opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: `radial-gradient(600px circle at ${mousePos.x}px ${mousePos.y}px, rgba(212,255,0,0.06), transparent 42%)`,
        }}
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
    <span className="text-[7px] font-black uppercase tracking-[0.3em] mt-2 text-white/70">
      Core
    </span>
  </div>
);

// ✅ Trophy pro (trazo continuo) para watermark
const TrophyMark = ({ className = '' }) => (
  <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
    <path
      d="M20 10h24v6c0 10-6 18-12 20v6h8v6H24v-6h8v-6c-6-2-12-10-12-20v-6Z
         M20 16H10c0 10 6 16 12 16
         M44 16h10c0 10-6 16-12 16
         M24 54h16"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
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
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 8}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        opacity={0.28}
      />
      <Sector
        cx={cx}
        cy={cy}
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

// --- TOOLTIP COMPONENTS ---
const CustomActivityTooltip = ({ active, payload, fmt }) => {
  if (!active || !payload?.length || !payload[0]?.payload) return null;
  const data = payload[0].payload;

  const dateLine = data?.date ? fmtTooltipDate(data.date) : (data.label || data.name || '');

  return (
    <div className="bg-zinc-900 border border-white/20 p-3 rounded shadow-2xl backdrop-blur-md">
      <p className="text-[10px] font-black text-white uppercase tracking-widest mb-1 whitespace-nowrap">
        {dateLine}
      </p>

      <div className="h-[1px] bg-white/10 w-full mb-2" />

      <div className="flex items-center justify-between gap-4">
        <span className="text-white/80 text-[11px] font-bold uppercase tracking-tight">
          Monto:
        </span>
        <span className="text-white font-black">{fmt(data.total ?? data.val ?? 0)}</span>
      </div>

      <div className="flex items-center justify-between gap-4">
        <span className="text-white/80 text-[11px] font-bold uppercase tracking-tight">
          Operaciones:
        </span>
        <span className="text-white font-black">{data.count ?? 0}</span>
      </div>
    </div>
  );
};

const CustomPieTooltip = ({ active, payload, fmt, totalRevenue }) => {
  if (!active || !payload?.length || !payload[0]?.payload) return null;
  const data = payload[0].payload;
  const denom = totalRevenue > 0 ? totalRevenue : 1;

  return (
    <div className="bg-zinc-900 border border-white/20 p-4 rounded shadow-2xl backdrop-blur-xl">
      <p className="text-[8px] font-black text-white/70 uppercase tracking-[0.2em] mb-1">
        Producto
      </p>
      <p className="text-xs font-bold text-white uppercase leading-tight mb-2 max-w-[200px]">
        {data.fullName}
      </p>
      <div className="h-[1px] bg-white/15 w-full mb-2"></div>
      <div className="flex items-center justify-between gap-6">
        <span className="text-[10px] text-white/80 font-medium">Volumen:</span>
        <span className="text-sm font-black text-white">{fmt(data.value ?? 0)}</span>
      </div>
      <div className="flex items-center justify-between gap-6">
        <span className="text-[10px] text-white/80 font-medium">Participación:</span>
        <span className="text-xs font-bold text-white">
          {(((data.value ?? 0) / denom) * 100).toFixed(1)}%
        </span>
      </div>
    </div>
  );
};
export default function App() {
  const [rawData, setRawData] = useState([]);
  const [targetBimestral, setTargetBimestral] = useState(58000000);
  const [customLogo, setCustomLogo] = useState(DEFAULT_LOGO_URL);
  const [activeIndex, setActiveIndex] = useState(null);
  const [expandedSeller, setExpandedSeller] = useState(null);

  // ✅ PROM. DIARIO (PERIODO): top 3 picos
  const [showTopPicos, setShowTopPicos] = useState(false);

  const toggleSeller = (name) => {
    setExpandedSeller((prev) => (prev === name ? null : name));
  };

  // banners UI (schema check / errores)
  const [banner, setBanner] = useState(null);

  // loading UX
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  // rowErrors (se calcula pero NO se muestra en UI)
  const [rowErrors, setRowErrors] = useState([]);
  const [discardedCount, setDiscardedCount] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState(null);

  // reduce motion
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduceMotion(!!mq.matches);
    apply();
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, []);

  // persistencia (meta + logo + última sync)
  useEffect(() => {
    try {
      const t = localStorage.getItem('targetBimestral');
      if (t) setTargetBimestral(Number(t));
      const l = localStorage.getItem('customLogo');
      if (l) setCustomLogo(l);
      const s = localStorage.getItem('lastSyncAt');
      if (s) setLastSyncAt(s);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('targetBimestral', String(targetBimestral || 0));
    } catch {}
  }, [targetBimestral]);

  useEffect(() => {
    try {
      localStorage.setItem('customLogo', String(customLogo || ''));
    } catch {}
  }, [customLogo]);

  useEffect(() => {
    if (!lastSyncAt) return;
    try {
      localStorage.setItem('lastSyncAt', String(lastSyncAt));
    } catch {}
  }, [lastSyncAt]);

  const glowId = useId();
  const renderActiveShape = useMemo(
    () => makeRenderActiveShape(`glow-${glowId.replace(/:/g, '')}`),
    [glowId]
  );

  const onPieEnter = (_, index) => setActiveIndex(index);
  const onPieLeave = () => setActiveIndex(null);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // permite subir el mismo archivo consecutivo
    e.target.value = '';

    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setBanner({
        type: 'error',
        message: `El archivo supera ${MAX_FILE_MB}MB. Reducilo o exportá menos filas.`,
      });
      return;
    }

    setBanner(null);
    setLoading(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;

        const raw = parseCSV(text);
        const headers = raw.length ? Object.keys(raw[0]) : [];
        const missing = schemaCheck(headers);

        if (missing.length) {
          setBanner({
            type: 'warn',
            message: `Faltan columnas críticas (${missing.join(
              ', '
            )}). Proceso igual (best-effort), puede haber filas descartadas.`,
          });
        }

        const errors = [];
        const processed = [];

        for (let i = 0; i < raw.length; i++) {
          const { normalized, reasons, isDiscarded, rowIndex } =
            parseAndNormalizeRow(raw[i], i + 2);
          if (reasons.length) errors.push({ rowIndex, reasons });
          if (!isDiscarded) processed.push(normalized);
        }

        const disc = raw.length - processed.length;

        startTransition(() => {
          setRowErrors(errors);
          setDiscardedCount(disc);
          setRawData(processed);
          setLastSyncAt(new Date().toISOString());
        });
      } catch {
        setBanner({
          type: 'error',
          message: 'Error al procesar el CSV. Verificá formato/encoding.',
        });
      } finally {
        setLoading(false);
      }
    };

    reader.onerror = () => {
      setBanner({ type: 'error', message: 'No se pudo leer el archivo.' });
      setLoading(false);
    };

    reader.readAsText(file);
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => setCustomLogo(event.target.result);
    reader.readAsDataURL(file);
  };

  const clearData = () => {
    setRawData([]);
    setBanner(null);
    setRowErrors([]);
    setDiscardedCount(0);
  };

  // Ticket promedio (válidos: total > 0)
  const validTicketStats = useMemo(() => {
    if (!rawData.length) return { validCount: 0, validRevenue: 0, ticketAvg: 0 };
    let validRevenue = 0;
    let validCount = 0;
    for (const r of rawData) {
      if (r.total > 0) {
        validRevenue += r.total;
        validCount += 1;
      }
    }
    return { validCount, validRevenue, ticketAvg: validCount ? validRevenue / validCount : 0 };
  }, [rawData]);

  // --- MEMOS SEPARADOS ---
  const baseAgg = useMemo(() => {
    if (rawData.length === 0) return null;

    let totalRevenue = 0;
    let guaranteedCount = 0;
    let facturacionGarantizada = 0;
    let facturacionPorGarantizar = 0;

    const timelineByDayKey = {};
    const activityByDayKey = {};
    const productsMap = {};
    const uniqueRawSellersSet = new Set();

    // ✅ multi-producto: personKey -> Set(productKey)
    const personProducts = new Map();

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

      // ✅ personKey prefer DNI, fallback email
      const personKey = c.dni ? `dni:${c.dni}` : c.email ? `email:${c.email}` : '';
      if (personKey) {
        if (!personProducts.has(personKey)) personProducts.set(personKey, new Set());
        personProducts.get(personKey).add(String(c.productKey || c.productName || '').trim());
      }
    }

    const uniqueRawSellers = Array.from(uniqueRawSellersSet);

    // ✅ stats multi-producto
    let uniqueCustomersCount = personProducts.size;
    let multiProductCustomers = 0;
    for (const set of personProducts.values()) {
      if (set.size >= 2) multiProductCustomers += 1;
    }

    return {
      totalRevenue,
      totalCount: rawData.length,
      guaranteedCount,
      facturacionGarantizada,
      facturacionPorGarantizar,
      timelineByDayKey,
      activityByDayKey,
      productsMap,
      uniqueRawSellers,
      uniqueCustomersCount,
      multiProductCustomers,
    };
  }, [rawData]);

  const sellersComputed = useMemo(() => {
    if (!baseAgg) return null;

    const { uniqueRawSellers } = baseAgg;

    // --- unify seller names ---
    const sellerNameMap = {};
    const knownSellers = [];

    uniqueRawSellers.forEach((rawSeller) => {
      const cleanRaw = String(rawSeller || '').trim();
      if (!cleanRaw || cleanRaw === '0' || cleanRaw.toLowerCase() === 'sitio web') {
        sellerNameMap[rawSeller] = 'Sitio Web';
        return;
      }

      let foundMatch = false;
      for (let known of knownSellers) {
        const n1 = cleanRaw.toLowerCase().split(/\s+/);
        const n2 = known.raw.toLowerCase().split(/\s+/);
        const sharedWords = n1.filter((w) => n2.includes(w) && w.length > 2);
        if (sharedWords.length > 0) {
          const nonShared1 = n1.filter((w) => !n2.includes(w));
          const nonShared2 = n2.filter((w) => !n1.includes(w));
          let isPrefix = false;
          if (nonShared1.length === 1 && nonShared2.length === 1) {
            if (nonShared1[0].startsWith(nonShared2[0]) || nonShared2[0].startsWith(nonShared1[0])) isPrefix = true;
          }
          const isSubset = nonShared1.length === 0 || nonShared2.length === 0;
          const isApud = cleanRaw.toLowerCase().includes('apud') && known.raw.toLowerCase().includes('apud');
          if (isPrefix || isSubset || isApud) {
            foundMatch = true;
            if (cleanRaw.length > known.display.length) {
              known.display = cleanRaw
                .split(' ')
                .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                .join(' ');
            }
            sellerNameMap[rawSeller] = known;
            break;
          }
        }
      }

      if (!foundMatch) {
        const display = cleanRaw
          .split(' ')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ');
        const newKnown = { raw: cleanRaw, display };
        knownSellers.push(newKnown);
        sellerNameMap[rawSeller] = newKnown;
      }
    });

    Object.keys(sellerNameMap).forEach((k) => {
      if (typeof sellerNameMap[k] === 'object') sellerNameMap[k] = sellerNameMap[k].display;
    });

    // --- aggregate sellers ---
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
          facturacionGarantizada: 0,
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

    const sellers = Object.values(sellersMap)
      .map((s) => {
        const trendRaw = Object.entries(s.daily)
          .map(([dayKey, val]) => {
            const [yy, mm, dd] = dayKey.split('-').map(Number);
            const dt = new Date(yy, mm - 1, dd, 12, 0, 0);
            return { date: dt, val, count: s.countDaily[dayKey] };
          })
          .sort((a, b) => a.date - b.date);

        // ✅ trend con axis + date (para XAxis y tooltip)
        const trend = trendRaw.map((t) => ({
          date: t.date,
          axis: fmtAxisDate(t.date),
          val: t.val,
          count: t.count,
        }));

        const uniqueDays = trend.length || 1;
        return { ...s, trend, promDia: s.val / uniqueDays };
      })
      .sort((a, b) => b.val - a.val);

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
      productsMap,
      uniqueCustomersCount,
      multiProductCustomers,
    } = baseAgg;

    // ✅ timelineData: axis + date
    const timelineData = Object.entries(timelineByDayKey)
      .map(([dayKey, v]) => {
        const [yy, mm, dd] = dayKey.split('-').map(Number);
        const dt = new Date(yy, mm - 1, dd, 12, 0, 0);
        return {
          date: dt,
          axis: fmtAxisDate(dt),
          val: v.val,
          count: v.count,
        };
      })
      .sort((a, b) => a.date - b.date);

    // activityTimeline: últimos 30 días desde maxDate
    const maxTime = Math.max(...rawData.map((d) => d.date.getTime()));
    const maxDate = new Date(maxTime);

    const activityTimeline = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(maxDate);
      d.setDate(d.getDate() - i);

      const dayKey = toDayKeyLocal(d);
      const entry = activityByDayKey[dayKey];

      const total = entry ? entry.total : 0;
      const count = entry ? entry.count : 0;

      activityTimeline.push({
        date: d,
        axis: fmtAxisDate(d),
        total,
        count,
        isZero: total === 0,
      });
    }

    const maxActivityVal = Math.max(...activityTimeline.map((a) => a.total)) || 1;

    const productsAll = Object.values(productsMap).sort((a, b) => b.value - a.value);

    // promedio diario por días con actividad (no /30 fijo)
    const periodTotal = activityTimeline.reduce((s, a) => s + a.total, 0);
    const activeDays = activityTimeline.reduce((c, a) => c + (a.total > 0 ? 1 : 0), 0) || 1;
    const promDiarioPeriodo = periodTotal / activeDays;

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
      facturacionPorGarantizar,
      promDiarioPeriodo,
      activeDays,
      uniqueCustomersCount,
      multiProductCustomers,
    };
  }, [baseAgg, rawData, sellersComputed]);

  const fmt = (v) => fmtCurrency.format(v);

  // ✅ Top 3 picos (para card PROM. DIARIO)
  const top3Picos = useMemo(() => {
    if (!audit?.activityTimeline?.length) return [];
    return audit.activityTimeline
      .filter((x) => (x.total || 0) > 0)
      .slice()
      .sort((a, b) => (b.total || 0) - (a.total || 0))
      .slice(0, 3);
  }, [audit]);

  // progreso meta basado en INGRESOS ASEGURADOS
  const metaBase = audit?.facturacionGarantizada ?? 0;
  const metaPct = targetBimestral > 0 ? (metaBase / targetBimestral) * 100 : 0;
  return (
    <div className={`min-h-screen ${BG_PURE_BLACK} text-white font-sans selection:bg-[#d4ff00] selection:text-black pb-20`}>
      {(loading || isPending) && (
        <div className="fixed inset-0 z-[9998] bg-black/70 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-[#0a0a0a] border border-white/5 rounded-[2rem] px-8 py-6 text-center">
            <div className="text-[10px] font-black uppercase tracking-[0.35em] text-white/70 mb-2">Procesando CSV</div>
            <div className="text-sm font-bold text-white/90">Normalizando datos y calculando métricas…</div>
            <div className="mt-4 h-1 w-56 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-[#d4ff00] w-2/3 animate-pulse" />
            </div>
          </div>
        </div>
      )}

      <header className="border-b border-white/5 px-10 h-20 flex items-center justify-between sticky top-0 bg-black/80 backdrop-blur-2xl z-50">
        <div className="flex items-center gap-4 group">
          <label className="flex items-center justify-center min-w-[100px] h-[45px] transition-all cursor-pointer relative overflow-hidden group hover:scale-105 active:scale-95 bg-black">
            {customLogo ? (
              <img src={customLogo} alt="Logo" className="max-w-[120px] max-h-[35px] w-auto h-auto object-contain" />
            ) : (
              <span className="text-[10px] font-black uppercase tracking-widest text-white/80 group-hover:text-[#d4ff00] transition-colors">Tu Logo</span>
            )}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <Upload className="w-4 h-4 text-[#d4ff00]" />
            </div>
            <input type="file" accept="image/png, image/jpeg" onChange={handleLogoUpload} className="hidden" />
          </label>

          <div className="h-6 w-[1px] bg-white/15" />

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
              className="group flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-500/25 bg-red-500/5 hover:bg-red-500/10 transition-all active:scale-95"
              title="Limpiar datos cargados"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-500/80" />
              <span className="text-[10px] font-black text-red-500/80 uppercase tracking-widest">Limpiar</span>
            </button>
          )}

          <label
            className="text-[10px] font-black text-black uppercase cursor-pointer hover:bg-white/90 active:scale-95 transition-all bg-white px-5 py-2.5 rounded-xl flex items-center gap-2"
            title={`Importar CSV (máx ${MAX_FILE_MB}MB)`}
          >
            <Database className="w-3 h-3" /> Sincronizar CSV
            <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>
      </header>

      <main className="max-w-[1500px] mx-auto px-10 py-12">
        {banner && (
          <div
            className={`mb-6 border rounded-2xl px-5 py-4 ${
              banner.type === 'error'
                ? 'border-red-500/25 bg-red-500/10 text-red-200'
                : banner.type === 'warn'
                ? 'border-yellow-500/25 bg-yellow-500/10 text-yellow-100'
                : 'border-white/10 bg-white/5 text-white/80'
            }`}
          >
            <div className="flex items-center justify-between gap-4">
              <span className="text-[10px] font-black uppercase tracking-widest">
                {banner.type === 'error' ? 'Error' : banner.type === 'warn' ? 'Atención' : 'Info'}
              </span>
              <span className="text-[11px] font-bold tracking-wide">{banner.message}</span>
            </div>
          </div>
        )}

        {!audit ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center animate-in fade-in zoom-in duration-500">
            <div className="w-24 h-24 bg-white/5 border border-white/5 rounded-[2.5rem] flex items-center justify-center mb-8 relative group overflow-hidden">
              <div className="absolute inset-0 bg-[#d4ff00]/5 translate-y-24 group-hover:translate-y-0 transition-transform duration-700" />
              <Database className="text-white/50 w-10 h-10 group-hover:text-[#d4ff00] transition-colors relative z-10" />
            </div>
            <h1 className="text-3xl font-light mb-4 text-white/90">
              Ready to <span className="text-white font-bold">Audit</span>
            </h1>
            <p className="text-xs text-white/70 uppercase tracking-[0.3em] mb-10">Selecciona tu base de datos para comenzar</p>
            <label
              className="bg-[#d4ff00] text-black px-12 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest cursor-pointer hover:scale-105 active:scale-95 transition-all shadow-[0_10px_30px_rgba(212,255,0,0.18)]"
              title={`Importar CSV (máx ${MAX_FILE_MB}MB)`}
            >
              Importar Archivo CSV
              <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        ) : (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            {/* KPI Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <GlowCard className="bg-[#0a0a0a] p-8 rounded-[2rem] flex flex-col justify-between h-52">
                <div className="w-10 h-10 rounded-xl bg-[#141414] border border-white/5 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-[#d4ff00]" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/80 font-bold mb-1">FACTURACIÓN TOTAL</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold text-[#b8df00]/55">$</span>
                    <AnimatedNumber value={audit.totalRevenue} />
                  </div>
                  <p className="text-[9px] text-white/40 mt-1 font-bold tracking-widest uppercase">{audit.totalCount} VENTAS</p>
                </div>
              </GlowCard>

              <GlowCard className="bg-[#0a0a0a] p-8 rounded-[2rem] flex flex-col justify-between h-52">
                <div className="w-10 h-10 rounded-xl bg-[#141414] border border-white/5 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-[#d4ff00]" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/80 font-bold mb-1">TICKET PROMEDIO</p>
                  <AnimatedNumber value={validTicketStats.ticketAvg} />
                  <p className="text-[9px] text-white/40 mt-1 font-bold tracking-widest uppercase">{validTicketStats.validCount} TICKETS VÁLIDOS</p>
                </div>
              </GlowCard>

              {/* ✅ Inscripciones Totales — pill GARANTIZADAS mejorada */}
              <GlowCard className="bg-[#0a0a0a] p-8 rounded-[2rem] flex flex-col justify-between h-52 relative">
                <div className="flex justify-between items-start">
                  <div className="w-10 h-10 rounded-xl bg-[#141414] border border-white/5 flex items-center justify-center">
                    <Database className="w-5 h-5 text-[#d4ff00]" />
                  </div>

                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-white/10 bg-white/5">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#d4ff00] animate-pulse shrink-0" />
                    <span className="text-[9px] leading-none font-black text-white/75 tracking-[0.12em] uppercase whitespace-nowrap">
                      {audit.guaranteedCount} GARANTIZADAS
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/80 font-bold mb-1">INSCRIPCIONES TOTALES</p>
                  <h2 className="text-5xl font-bold tracking-tight">{audit.totalCount}</h2>
                  <p className="text-[9px] text-white/40 mt-1 font-bold tracking-widest uppercase">REGISTROS PROCESADOS</p>
                </div>
              </GlowCard>

              {/* PROGRESO META (BASE: INGRESOS ASEGURADOS) */}
              <GlowCard className="bg-[#0a0a0a] p-8 rounded-[2rem] flex flex-col justify-between h-52">
                <div className="flex justify-between items-start">
                  <div className="w-10 h-10 rounded-xl bg-[#141414] border border-white/5 flex items-center justify-center">
                    <Target className="w-5 h-5 text-[#d4ff00]" />
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <input
                        aria-label="Meta bimestral"
                        type="number"
                        value={targetBimestral}
                        onChange={(e) => setTargetBimestral(Number(e.target.value))}
                        className="bg-transparent text-[#d4ff00]/80 font-black text-right text-sm outline-none border-b border-white/15 focus:border-[#d4ff00]/80 w-24 transition-all"
                        title="Editar meta bimestral"
                      />
                      <Edit2 className="w-3 h-3 text-white/50" />
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] text-white/80 font-black tracking-widest uppercase mb-1">PROGRESO META</p>
                  <div className="flex justify-between items-end">
                    <span className="text-4xl font-bold tracking-tighter">{metaPct.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-[#d4ff00] h-full rounded-full shadow-[0_0_10px_rgba(212,255,0,0.22)] transition-all duration-1000"
                      style={{ width: `${Math.min(metaPct, 100)}%` }}
                    />
                  </div>
                </div>
              </GlowCard>
            </div>
{/* SECCIÓN: Estado de Facturación Garantizada + multi-producto */}
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

  {/* FACTURACIÓN GARANTIZADA */}
  <GlowCard className="bg-[#0a0a0a] p-8 rounded-[2.5rem] flex flex-col justify-between h-48">
    <div className="flex justify-between items-start">
      <p className="text-[10px] uppercase tracking-[0.2em] text-white/80 font-bold">
        FACTURACIÓN GARANTIZADA
      </p>

      <div className="flex flex-col items-end leading-none">
        <span className="text-2xl font-bold text-[#d4ff00]/85 tracking-tighter">
          {audit.totalRevenue > 0
            ? ((audit.facturacionGarantizada / audit.totalRevenue) * 100).toFixed(1)
            : '0.0'}%
        </span>

        <span className="mt-1 text-[10px] font-black text-white/55 tracking-widest uppercase whitespace-nowrap">
          {audit.guaranteedCount} insc.
        </span>
      </div>
    </div>

    <div>
      <div className="text-4xl font-bold text-[#d4ff00]/85 tracking-tighter mb-2">
        {fmt(audit.facturacionGarantizada)}
      </div>

      <div className="w-full bg-white/10 rounded-full h-1 overflow-hidden">
        <div
          className="bg-[#d4ff00] h-full shadow-[0_0_10px_rgba(212,255,0,0.22)] transition-all"
          style={{
            width: `${
              audit.totalRevenue > 0
                ? (audit.facturacionGarantizada / audit.totalRevenue) * 100
                : 0
            }%`,
          }}
        />
      </div>

      <p className="text-[9px] text-white/40 mt-3 font-bold tracking-widest uppercase">
        INGRESOS ASEGURADOS
      </p>
    </div>
  </GlowCard>

  {/* FACTURACIÓN POR GARANTIZAR */}
  <GlowCard className="bg-[#0a0a0a] p-8 rounded-[2.5rem] flex flex-col justify-between h-48">
    <div className="flex justify-between items-start">
      <p className="text-[10px] uppercase tracking-[0.2em] text-white/80 font-bold">
        FACTURACIÓN POR GARANTIZAR
      </p>

      <div className="flex flex-col items-end leading-none">
        <span className="text-2xl font-bold text-white/35 tracking-tighter">
          {audit.totalRevenue > 0
            ? ((audit.facturacionPorGarantizar / audit.totalRevenue) * 100).toFixed(1)
            : '0.0'}%
        </span>

        <span className="mt-1 text-[10px] font-black text-white/45 tracking-widest uppercase whitespace-nowrap">
          {(audit.totalCount || 0) - (audit.guaranteedCount || 0)} insc.
        </span>
      </div>
    </div>

    <div>
      <div className="text-4xl font-bold text-white tracking-tighter mb-2">
        {fmt(audit.facturacionPorGarantizar)}
      </div>

      <div className="w-full bg-white/10 rounded-full h-1 overflow-hidden">
        <div
          className="bg-white/35 h-full transition-all"
          style={{
            width: `${
              audit.totalRevenue > 0
                ? (audit.facturacionPorGarantizar / audit.totalRevenue) * 100
                : 0
            }%`,
          }}
        />
      </div>

      <p className="text-[9px] text-white/40 mt-3 font-bold tracking-widest uppercase">
        EN PROCESO
      </p>
    </div>
  </GlowCard>

  {/* CLIENTES EN +1 PRODUCTO */}
  <GlowCard className="bg-[#0a0a0a] p-8 rounded-[2.5rem] flex flex-col justify-between h-48">
    <div className="flex items-start justify-between">
      <p className="text-[10px] uppercase tracking-[0.28em] text-white/75 font-bold">
        CLIENTES EN +1 PRODUCTO
      </p>

      <div className="w-10 h-10 rounded-xl bg-[#141414] border border-white/5 flex items-center justify-center">
        <Users className="w-5 h-5 text-white/70" />
      </div>
    </div>

    <div className="flex items-end justify-between gap-8">
      <div className="flex-1">
        <div className="text-[9px] text-white/45 font-black uppercase tracking-widest mb-2">
          Repetidos
        </div>
        <div className="text-6xl font-black tracking-tighter text-white leading-none">
          {fmtNumberAR.format(audit.multiProductCustomers || 0)}
        </div>
      </div>

      <div className="w-px h-16 bg-white/5" />

      <div className="flex-1 text-right">
        <div className="text-[9px] text-white/45 font-black uppercase tracking-widest mb-2">
          Total clientes
        </div>

        <div className="text-3xl font-black tracking-tight text-white/85 leading-none">
          {fmtNumberAR.format(audit.uniqueCustomersCount || 0)}
        </div>

        <div className="mt-3 text-[10px] font-black uppercase tracking-widest text-white/45">
          Tasa{' '}
          <span className="text-[#b8df00]/80">
            {(
              (audit.uniqueCustomersCount || 0) > 0
                ? ((audit.multiProductCustomers || 0) /
                    audit.uniqueCustomersCount) *
                  100
                : 0
            ).toFixed(1)}
            %
          </span>
        </div>
      </div>
    </div>
  </GlowCard>
</div>

{/* ACTIVIDAD DIARIA + PROMEDIO */}
<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

  {/* ACTIVIDAD DIARIA */}
  <div className="lg:col-span-2 bg-[#0a0a0a] border border-white/5 p-8 rounded-[2.5rem]">
    <div className="flex items-center justify-between mb-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Calendar className="w-4 h-4 text-[#d4ff00]" />
          <h3 className="text-xl font-bold text-white uppercase tracking-tighter">
            Actividad Diaria
          </h3>
        </div>
        <p className="text-[10px] uppercase tracking-widest text-white/80 font-bold">
          Intensidad de volumen • Últimos 30 días
        </p>
      </div>
    </div>

  <div className="h-[220px] w-full relative">
  {(!audit?.activityTimeline?.length ||
    !audit.activityTimeline.some((d) => (d.total || 0) > 0)) && (
    <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black uppercase tracking-[0.35em] text-white/35">
      Sin actividad en los últimos 30 días
    </div>
  )}

  <ResponsiveContainer width="100%" height="100%">
    <BarChart data={audit.activityTimeline || []} margin={{ bottom: 20 }}>
      {/* ✅ si en algún momento cambiás el campo, no se rompe */}
      <XAxis
        dataKey={(d) => d.axis ?? d.name}
        axisLine={false}
        tickLine={false}
        tick={{ fill: '#888', fontSize: 9 }}
        interval={2}
      />

      <Tooltip
        cursor={{ fill: 'rgba(212,255,0,0.04)' }}
        content={<CustomActivityTooltip fmt={fmt} />}
      />

      <Bar dataKey="total" radius={[4, 4, 0, 0]} isAnimationActive={false}>
  {(audit.activityTimeline || []).map((entry, index) => {
    const total = Number(entry?.total || 0);
    const max = Math.max(1, Number(audit?.maxActivityVal || 1));

    // siempre visible: base 0.28, sube con intensidad hasta 0.95
    const t = Math.min(1, Math.max(0, total / max));
    const opacity = total <= 0 ? 0.12 : 0.28 + t * 0.67;

    return (
      <Cell
        key={`cell-${index}`}
        fill={LIME_NEON}
        opacity={opacity}
      />
    );
  })}
</Bar>
    </BarChart>
  </ResponsiveContainer>
</div>
  </div>

  {/* PROM. DIARIO (SIN DESPLEGABLE) */}
  <div className="bg-gradient-to-br from-[#0a0a0a] to-[#111] border border-white/5 p-8 rounded-[2.5rem] flex flex-col justify-center text-center">
    <div className="w-16 h-16 bg-[#d4ff00]/5 rounded-2xl flex items-center justify-center mx-auto mb-6">
      <BarChart3 className="w-8 h-8 text-[#d4ff00]" />
    </div>

    <p className="text-[10px] font-black text-white/70 uppercase tracking-[0.4em] mb-2">
      PROM. DIARIO (PERIODO)
    </p>

    <div className="text-4xl font-bold tracking-tighter mb-2">
      {fmt(audit.promDiarioPeriodo)}
    </div>

    <p className="text-[9px] text-white/40 font-bold uppercase tracking-widest">
      {audit.activeDays} días con actividad
    </p>
  </div>
</div>
            {/* Evolución Temporal */}
            <div className={`${CARD_DARK} border border-white/5 p-8 rounded-[2.5rem]`}>
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-[#d4ff00]" />
                <h3 className="text-xl font-bold text-white uppercase tracking-tighter">Evolución Diaria</h3>
              </div>
              <p className="text-[10px] uppercase tracking-widest text-white/80 font-bold mb-8">Tendencia de ingresos acumulados</p>

              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={audit.timelineData}>
                    <defs>
                      <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={LIME_NEON} stopOpacity={0.26} />
                        <stop offset="95%" stopColor={LIME_NEON} stopOpacity={0} />
                      </linearGradient>
                    </defs>

                    {/* ✅ Eje X: 13-ene */}
                    <XAxis dataKey="axis" axisLine={false} tickLine={false} tick={{ fill: '#888', fontSize: 10 }} />
                    <YAxis hide />

                    {/* ✅ Tooltip: Miércoles 19-02 */}
                    <Tooltip
                      content={<CustomActivityTooltip fmt={fmt} />}
                      cursor={{ fill: 'rgba(212, 255, 0, 0.05)' }}
                    />

                    <Area
                      type="monotone"
                      dataKey="val"
                      stroke={LIME_NEON}
                      fillOpacity={1}
                      fill="url(#colorVal)"
                      strokeWidth={3}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Ranking de Productos */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-[#0a0a0a] border border-white/5 rounded-[2.5rem] p-8">                
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
                          isAnimationActive={!reduceMotion}
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
                              style={{ filter: `drop-shadow(0 0 8px ${COLORS[index % COLORS.length]}22)` }}
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
                        className={`group/item transition-all duration-300 p-2 rounded-xl ${
                          activeIndex === i ? 'bg-white/5 border-l border-[#d4ff00]/40' : 'opacity-70 hover:opacity-100'
                        }`}
                        onMouseEnter={() => setActiveIndex(i)}
                        onMouseLeave={() => setActiveIndex(null)}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <InstantTooltip text={p.fullName}>
                            <span className="text-[11px] font-bold text-white uppercase truncate block max-w-[130px] cursor-help" title={p.fullName}>
                              {p.name}
                            </span>
                          </InstantTooltip>
                          <span className="text-[11px] font-black text-[#d4ff00]/85 shrink-0 ml-2">
                            {audit.totalRevenue > 0 ? ((p.value / audit.totalRevenue) * 100).toFixed(1) : '0.0'}%
                          </span>
                        </div>
                        <div className="w-full h-[3px] bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full transition-all duration-1000"
                            style={{
                              width: `${audit.totalRevenue > 0 ? (p.value / audit.totalRevenue) * 100 : 0}%`,
                              backgroundColor: COLORS[i % COLORS.length],
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Top 3 List (Productos) — ✅ colores + watermark pro */}
              <div className="lg:col-span-5 grid grid-cols-1 gap-4">
                {audit.top3Products.map((p, i) => {
                  const style = getProductRankingStyle(i);
                  const isAbbrev = String(p.name || '').endsWith('...');

                  return (
                    <div
                      key={p.fullName}
                      className="bg-[#0a0a0a] p-6 rounded-[2rem] flex items-center justify-between group h-[95px] relative overflow-hidden transition-all hover:bg-white/[0.03]"
                    >
                      {/* ✅ watermark copa pro más notoria */}
                      <div className="absolute -right-6 -bottom-6 opacity-[0.12] group-hover:opacity-[0.24] transition-opacity pointer-events-none -rotate-12">
                        <TrophyMark className="w-[140px] h-[140px] text-white/40" />
                      </div>

                      <div className="flex items-center gap-5 relative z-10 min-w-0 flex-1">
                        <div className="shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center bg-black/60 transition-all duration-500">
                          {i === 0 ? (
                            <Trophy className={style.iconColor} size={24} />
                          ) : i === 1 ? (
                            <Award className={style.iconColor} size={24} />
                          ) : (
                            <Target className={style.iconColor} size={24} />
                          )}
                        </div>

                        <div className="flex flex-col min-w-0">
                          {isAbbrev ? (
                            <InstantTooltip text={p.fullName}>
                              <span
                                className={`text-[12px] font-black uppercase tracking-wider ${style.color} ${style.shadow} truncate max-w-[180px] cursor-help`}
                                title={p.fullName}
                              >
                                {p.name}
                              </span>
                            </InstantTooltip>
                          ) : (
                            <span
                              className={`text-[12px] font-black uppercase tracking-wider ${style.color} ${style.shadow} truncate max-w-[180px]`}
                              title={p.fullName}
                            >
                              {p.name}
                            </span>
                          )}
                          <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest">{p.count} VENTAS</span>
                        </div>
                      </div>

                      <div className="text-right z-10">
                        <div className={`text-xl font-black tracking-tighter ${style.amountColor || 'text-white'}`}>
                          {fmt(p.value)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* SECCIÓN: Rendimiento por Vendedor */}
            <div className="mt-10 pt-10 border-t border-white/10">
              <div className="flex items-center gap-2 mb-8">
                <User className="w-5 h-5 text-[#d4ff00]" />
                <h3 className="text-2xl font-bold text-white uppercase tracking-tighter">Ranking de Asesores</h3>

                <div className="ml-auto flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5">
                  <span className="text-[9px] font-black uppercase tracking-widest text-white/60">
                    {audit?.sellers?.length ?? 0} agentes
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                {audit.sellers.map((s, i) => {
                  const style = getSellerRankingStyle(i);
                  const isOpen = expandedSeller === s.name;
                  const sharePct = audit.totalRevenue > 0 ? (s.val / audit.totalRevenue) * 100 : 0;

                  return (
                    <div key={s.name} className="rounded-[2rem] overflow-hidden relative">
                      {/* ===== ROW COMPACTA (colapsado) ===== */}
                      <button
                        type="button"
                        onClick={() => toggleSeller(s.name)}
                        className="relative w-full text-left group bg-[#0a0a0a] rounded-[2rem] px-6 py-5 transition-all duration-300 hover:bg-white/[0.02]"
                      >
                        {/* ✅ watermark copa pro (colapsado) */}
                        <div
                          className={`pointer-events-none absolute right-[-20px] top-[-26px] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]
                            ${isOpen ? 'opacity-0 translate-y-10 rotate-[12deg]' : 'opacity-[0.14] translate-y-0 -rotate-[12deg]'}
                          `}
                        >
                          <TrophyMark className="w-[170px] h-[170px] text-white/35" />
                        </div>

                        <div className="flex items-center gap-5">
                          {/* Rank + Nombre */}
                          <div className="shrink-0 flex items-center gap-4 min-w-[260px]">
                            <div className={`shrink-0 ${style.rankBox} ${style.rankGlow}`}>
                              <span className={`${style.rankText} ${style.rankTextColor}`}>{i + 1}</span>
                            </div>

                            <div className="min-w-0">
                              <div className="text-[12px] font-black uppercase tracking-wider text-white truncate max-w-[240px]">
                                {s.name}
                              </div>
                            </div>
                          </div>

                          {/* Sparkline */}
                          <div
                            className={`flex-1 min-w-[220px] h-[42px] origin-left transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]
                              ${isOpen ? 'opacity-0 translate-y-4 scale-[1.12]' : 'opacity-25 group-hover:opacity-95 translate-y-0 scale-100'}
                            `}
                          >
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={s.trend}>
                                <Line
                                  type="monotone"
                                  dataKey="val"
                                  stroke={LIME_NEON}
                                  strokeWidth={2}
                                  dot={false}
                                  isAnimationActive={false}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>

                          {/* Share */}
                          <div className="hidden md:flex flex-col items-end min-w-[110px]">
                            <div className="text-[9px] font-black uppercase tracking-widest text-white/35">Share</div>
                            <div className="text-[14px] font-black tracking-tight text-[#d4ff00]/90">
                              {sharePct.toFixed(1)}%
                            </div>
                          </div>

                          {/* Total */}
                          <div className="ml-auto flex flex-col items-end min-w-[190px]">
                            <div className="text-[9px] font-black uppercase tracking-widest text-white/35">
                              {s.count} ventas
                            </div>
                            <div className={`${style.amountText} ${style.amountColor} ${style.amountGlow || ''}`}>
                              {fmt(s.val)}
                            </div>
                          </div>
                        </div>
                      </button>

                      {/* ===== EXPANDIDO ===== */}
                      <div
                        className={`overflow-hidden transition-[max-height,opacity] duration-400 ease-[cubic-bezier(0.22,1,0.36,1)]
                          ${isOpen ? 'max-h-[520px] opacity-100' : 'max-h-0 opacity-0'}
                        `}
                      >
                        <div className="px-6 pt-5 pb-6 relative">
                          <div
                            className={`grid grid-cols-1 md:grid-cols-2 gap-10 mb-6 transition-all duration-400 ease-[cubic-bezier(0.22,1,0.36,1)]
                              ${isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}
                            `}
                          >
                            <div>
                              <div className="text-[10px] font-black uppercase tracking-[0.45em] text-white/35 mb-2">
                                Promedio diario
                              </div>
                              <div className="text-[22px] font-black tracking-tight text-white leading-none">
                                {fmt(s.promDia)}
                              </div>
                            </div>

                            <div className="md:text-right">
                              <div className="text-[10px] font-black uppercase tracking-[0.45em] text-white/35 mb-2">
                                Garantizado ({s.garantizadas} est.)
                              </div>
                              <div className="text-[22px] font-black tracking-tight text-white leading-none">
                                {fmt(s.facturacionGarantizada)}
                              </div>
                            </div>
                          </div>

                          <div
                            className={`text-center mb-3 transition-all duration-400 delay-75 ease-[cubic-bezier(0.22,1,0.36,1)]
                              ${isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
                            `}
                          >
                            <div className="text-[10px] font-black uppercase tracking-[0.55em] text-white/30">
                              Evolución de ventas
                            </div>
                          </div>

                          <div
                            className={`relative w-full transition-all duration-500 delay-100 ease-[cubic-bezier(0.22,1,0.36,1)]
                              ${isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}
                            `}
                          >
                            {/* ✅ watermark copa pro (expandido) */}
                            <div
                              className={`pointer-events-none absolute right-[-26px] bottom-[-30px] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]
                                ${isOpen ? 'opacity-[0.14] translate-y-0 rotate-[12deg]' : 'opacity-0 translate-y-[-14px] rotate-[12deg]'}
                              `}
                            >
                              <TrophyMark className="w-[240px] h-[240px] text-white/35" />
                            </div>

                            <div className="h-[250px] w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={s.trend} margin={{ left: 8, right: 8, top: 10, bottom: 8 }}>
                                  <defs>
                                    <linearGradient id={`sellerDetail-${i}`} x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor={LIME_NEON} stopOpacity={0.32} />
                                      <stop offset="95%" stopColor={LIME_NEON} stopOpacity={0} />
                                    </linearGradient>
                                  </defs>

                                  {/* ✅ Eje X: 13-ene */}
                                  <XAxis
                                    dataKey="axis"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#777', fontSize: 10 }}
                                    minTickGap={18}
                                  />
                                  <YAxis hide />

                                  {/* ✅ Tooltip: Miércoles 19-02 */}
                                  <Tooltip
                                    content={<CustomActivityTooltip fmt={fmt} />}
                                    cursor={{ fill: 'rgba(212, 255, 0, 0.05)' }}
                                  />

                                  <Area
                                    type="monotone"
                                    dataKey="val"
                                    stroke={LIME_NEON}
                                    fillOpacity={1}
                                    fill={`url(#sellerDetail-${i})`}
                                    strokeWidth={2}
                                    isAnimationActive={false}
                                  />
                                </AreaChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
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