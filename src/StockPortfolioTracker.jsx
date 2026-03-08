import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, Legend, Area, AreaChart,
} from 'recharts';

// ─── LocalStorage Persistence ─────────────────────────────────────────────────

const STORAGE_KEY = 'stock-dashboard-v1';

function loadState(key, fallback) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed[key] !== undefined ? parsed[key] : fallback;
  } catch { return fallback; }
}

function saveAllState(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { /* storage full or unavailable */ }
}

function usePersisted(key, fallback) {
  const [value, setValue] = useState(() => loadState(key, fallback));
  return [value, setValue, key];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v, d = 2) => (v == null || isNaN(v) ? '—' : v.toFixed(d));
const fmtDollar = (v) => {
  if (v == null || isNaN(v)) return '—';
  const s = v < 0 ? '-' : '';
  const a = Math.abs(v);
  return s + '$' + a.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const fmtPct = (v) => {
  if (v == null || isNaN(v)) return '—';
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
};
const colorVal = (v) => (v > 0 ? '#00ff88' : v < 0 ? '#ff4444' : '#c0c0c0');
const todayStr = () => {
  const d = new Date();
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`;
};
const monthYearStr = (dateStr) => {
  // Parse "M/D/YY" or return as-is
  const parts = dateStr?.split('/');
  if (!parts || parts.length < 3) return dateStr || '';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const m = parseInt(parts[0]) - 1;
  const y = parseInt(parts[2]);
  const fullY = y < 50 ? 2000 + y : 1900 + y;
  return `${months[m]} ${fullY}`;
};

// ─── Shared Components ───────────────────────────────────────────────────────

function EditableCell({ value, display, color, onSave, type, align }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const startEdit = () => { setDraft(value != null ? String(value) : ''); setEditing(true); };
  const commit = () => {
    setEditing(false);
    if (type === 'number') { const p = parseFloat(draft); if (!isNaN(p)) onSave(p); }
    else onSave(draft);
  };
  const handleKey = (e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); };
  if (editing) {
    return (
      <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={handleKey}
        style={{ background: '#0d0d1a', color: '#e0e0e0', border: '1px solid #00ff88', borderRadius: 2, padding: '2px 4px', width: '100%', fontFamily: 'inherit', fontSize: 12, textAlign: align || 'right', outline: 'none', boxSizing: 'border-box' }} />
    );
  }
  return (
    <div onClick={startEdit} title="Click to edit"
      style={{ cursor: 'pointer', color: color || '#c0c0c0', padding: '0 4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: align || 'right' }}>
      {display}
    </div>
  );
}

function DropdownCell({ value, options, color, onSave, align }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <select autoFocus value={value} onChange={(e) => { onSave(e.target.value); setEditing(false); }} onBlur={() => setEditing(false)}
        style={{ background: '#0d0d1a', color: '#e0e0e0', border: '1px solid #00ff88', borderRadius: 2, padding: '2px 2px', width: '100%', fontFamily: 'inherit', fontSize: 11, textAlign: align || 'left', outline: 'none', boxSizing: 'border-box' }}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  return (
    <div onClick={() => setEditing(true)} title="Click to select"
      style={{ cursor: 'pointer', color: color || '#c0c0c0', padding: '0 4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: align || 'left', fontSize: 11 }}>
      {value}
    </div>
  );
}

function StaticCell({ display, color, align }) {
  return (
    <div style={{ color: color || '#c0c0c0', padding: '0 4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: align || 'right' }}>
      {display}
    </div>
  );
}

function Badge({ label, value, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1a1a3a', border: '1px solid #2a2a4a', borderRadius: 4, padding: '4px 10px' }}>
      <span style={{ fontSize: 10, color: '#7777aa', fontWeight: 600, letterSpacing: 0.5 }}>{label}</span>
      <span style={{ fontSize: 13, color, fontWeight: 700 }}>{value}</span>
    </div>
  );
}

function TabButton({ label, active, onClick }) {
  return (
    <button onClick={onClick}
      style={{
        background: active ? '#1a1a3a' : 'transparent', color: active ? '#00ff88' : '#7777aa',
        border: active ? '1px solid #2a2a4a' : '1px solid transparent', borderBottom: active ? '1px solid #0d0d1a' : '1px solid #2a2a4a',
        borderRadius: '4px 4px 0 0', padding: '8px 20px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12,
        fontWeight: active ? 700 : 400, letterSpacing: 0.8, marginBottom: -1, position: 'relative', zIndex: active ? 2 : 1,
      }}>
      {label}
    </button>
  );
}

function MetricCard({ label, value, color }) {
  return (
    <div style={{ background: '#12122a', border: '1px solid #2a2a4a', borderRadius: 6, padding: '8px 16px', minWidth: 140 }}>
      <div style={{ fontSize: 10, color: '#7777aa', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 16, color: color || '#e0e0e0', fontWeight: 700 }}>{value}</div>
    </div>
  );
}

const actionBtnStyle = { background: 'transparent', color: '#9999cc', border: '1px solid #3a3a6a', borderRadius: 4, padding: '6px 14px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, letterSpacing: 0.5 };
const addBtnStyle = { background: '#1a1a3a', color: '#7777aa', border: '1px dashed #2a2a4a', borderRadius: 4, padding: '8px 20px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, letterSpacing: 0.5 };

function HoverBtn({ style, hoverStyle, children, ...props }) {
  return (
    <button {...props} style={style}
      onMouseEnter={(e) => { Object.assign(e.target.style, hoverStyle); }}
      onMouseLeave={(e) => { Object.assign(e.target.style, style); }}>
      {children}
    </button>
  );
}

function DeleteBtn({ onClick }) {
  return (
    <button onClick={onClick} title="Delete" style={{ background: 'none', border: 'none', color: '#553333', cursor: 'pointer', fontSize: 14, padding: '0 4px' }}
      onMouseEnter={(e) => (e.target.style.color = '#ff4444')}
      onMouseLeave={(e) => (e.target.style.color = '#553333')}>x</button>
  );
}

const thStyle = (align, i, total) => ({
  padding: '8px 6px', textAlign: align || 'right', color: '#7777aa', fontWeight: 600, fontSize: 10,
  textTransform: 'uppercase', letterSpacing: 0.8, borderBottom: '2px solid #2a2a4a',
  borderRight: i < total - 1 ? '1px solid #1a1a35' : 'none', background: '#10102a',
  whiteSpace: 'nowrap', userSelect: 'none', position: 'sticky', top: 0, zIndex: 1,
});

const tdStyle = (i, total) => ({
  padding: '6px 4px', borderBottom: '1px solid #1a1a30',
  borderRight: i < total - 1 ? '1px solid #1a1a30' : 'none',
  verticalAlign: 'middle', lineHeight: '20px',
});

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1: PORTFOLIO (Open Positions)
// ═══════════════════════════════════════════════════════════════════════════════

const defaultPositions = [
  { id: 1, symbol: 'OPEN', changePct: -3.47, last: 5.00, entryDate: '9/10/25', shares: 2000, avgCost: 9.22, stopLoss: 8.93, account: 'Account 1' },
  { id: 2, symbol: 'MP', changePct: -0.43, last: 58.23, entryDate: '9/16/25', shares: 690, avgCost: 66.83, stopLoss: 63.42, account: 'Account 1' },
  { id: 3, symbol: 'TSLA', changePct: -2.17, last: 396.73, entryDate: '9/17/25', shares: 60, avgCost: 415.57, stopLoss: 399.33, account: 'Account 1' },
  { id: 4, symbol: 'HOOD', changePct: -4.31, last: 77.09, entryDate: '9/18/25', shares: 400, avgCost: 121.22, stopLoss: 119.00, account: 'Account 2' },
  { id: 5, symbol: 'CRWV', changePct: -2.45, last: 72.99, entryDate: '9/18/25', shares: 500, avgCost: 121.18, stopLoss: 115.00, account: 'Account 2' },
];

const portfolioCols = [
  { key: 'symbol', label: 'Symbol', width: 72 },
  { key: 'account', label: 'Acct', width: 72 },
  { key: 'changePct', label: 'Change%', width: 78 },
  { key: 'last', label: 'Last', width: 78 },
  { key: 'entryDate', label: 'Entry Date', width: 84 },
  { key: 'shares', label: 'Shares', width: 68 },
  { key: 'plPct', label: 'P&L%', width: 74, computed: true },
  { key: 'avgCost', label: 'Avg Cost', width: 82 },
  { key: 'stopLoss', label: 'Stop Loss', width: 82 },
  { key: 'stopLossPct', label: 'Stop Loss%', width: 82, computed: true },
  { key: 'risk', label: 'Risk', width: 88, computed: true },
  { key: 'plDollar', label: 'P&L $', width: 100, computed: true },
  { key: 'rs', label: "R's", width: 60, computed: true },
  { key: 'positionValue', label: 'Position Value', width: 110, computed: true },
  { key: 'changeDollar', label: 'Change $', width: 100, computed: true },
  { key: 'riskSell', label: '1% Risk Sell', width: 95, computed: true },
  { key: 'target10', label: '+10% Target', width: 90, computed: true },
];

function PortfolioTab({ positions, setPositions, onClosePosition, accounts, equityData }) {
  const [hoveredRow, setHoveredRow] = useState(null);
  const [nextId, setNextId] = useState(100);
  const [closeModal, setCloseModal] = useState(null);
  const [closeSellPrice, setCloseSellPrice] = useState('');
  const [closeDate, setCloseDate] = useState(todayStr());

  const updateField = useCallback((id, field, value) => {
    setPositions((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  }, [setPositions]);
  const addRow = useCallback(() => {
    setPositions((prev) => [...prev, { id: nextId, symbol: 'NEW', changePct: 0, last: 0, entryDate: todayStr(), shares: 0, avgCost: 0, stopLoss: 0, account: accounts[0]?.name || 'Account 1' }]);
    setNextId((n) => n + 1);
  }, [nextId, setPositions, accounts]);
  const deleteRow = useCallback((id) => { setPositions((prev) => prev.filter((p) => p.id !== id)); }, [setPositions]);

  const computed = useMemo(() => positions.map((p) => {
    const plPct = p.avgCost ? ((p.last - p.avgCost) / p.avgCost) * 100 : 0;
    const plDollar = (p.last - p.avgCost) * p.shares;
    const risk = (p.avgCost - p.stopLoss) * p.shares;
    const positionValue = p.last * p.shares;
    const changeDollar = (p.changePct / 100) * positionValue;
    const stopLossPct = p.avgCost ? ((p.stopLoss - p.avgCost) / p.avgCost) * 100 : 0;
    const rs = risk !== 0 ? plDollar / risk : 0;
    // 1% Risk Sell: what sell price keeps max loss at 1% of account equity
    // maxLoss = equity * 0.01, sellPrice = avgCost - (maxLoss / shares)
    const acct = accounts.find((a) => a.name === p.account);
    const equity = acct ? acct.startingEquity : 0;
    const riskSell = equity > 0 && p.shares > 0 ? p.avgCost - (equity * 0.01 / p.shares) : 0;
    // +10% target from entry
    const target10 = p.avgCost * 1.10;
    return { ...p, plPct, plDollar, risk, positionValue, changeDollar, stopLossPct, rs, riskSell, target10 };
  }), [positions, accounts]);

  const totals = useMemo(() => {
    let dts = 0, plTotal = 0, totalValue = 0;
    computed.forEach((c) => { dts += c.changeDollar; plTotal += c.plDollar; totalValue += c.positionValue; });
    return { dts, plTotal, totalValue };
  }, [computed]);

  const handleClosePosition = (row) => {
    setCloseSellPrice(String(row.last));
    setCloseDate(todayStr());
    setCloseModal(row);
  };

  const confirmClose = () => {
    if (!closeModal) return;
    const sellPrice = parseFloat(closeSellPrice);
    if (isNaN(sellPrice)) return;
    const original = positions.find((p) => p.id === closeModal.id);
    onClosePosition({
      ...original,
      sellPrice,
      closeDate,
      plPct: original.avgCost ? ((sellPrice - original.avgCost) / original.avgCost) * 100 : 0,
      plDollar: (sellPrice - original.avgCost) * original.shares,
    });
    setPositions((prev) => prev.filter((p) => p.id !== closeModal.id));
    setCloseModal(null);
  };

  const renderCell = (row, col) => {
    const v = row[col.key];
    const ec = (display, color, type, align) => (
      <EditableCell value={v} display={display} color={color} onSave={(val) => updateField(row.id, col.key, val)} type={type} align={align} />
    );
    switch (col.key) {
      case 'symbol': return ec(v, '#ffffff', 'text', 'left');
      case 'account': return (
        <DropdownCell value={v} options={accounts.map((a) => a.name)} color="#8888bb" onSave={(val) => updateField(row.id, 'account', val)} align="left" />
      );
      case 'changePct': return ec(fmtPct(v), colorVal(v), 'number');
      case 'last': return ec(fmtDollar(v), '#e0e0e0', 'number');
      case 'entryDate': return ec(v, '#8888aa', 'text', 'center');
      case 'shares': return ec(v?.toLocaleString(), '#e0e0e0', 'number');
      case 'avgCost': case 'stopLoss': return ec(fmtDollar(v), '#e0e0e0', 'number');
      case 'plPct': case 'stopLossPct': return <StaticCell display={fmtPct(v)} color={colorVal(v)} />;
      case 'risk': return <StaticCell display={fmtDollar(v)} color="#ffd700" />;
      case 'plDollar': case 'changeDollar': return <StaticCell display={fmtDollar(v)} color={colorVal(v)} />;
      case 'rs': return <StaticCell display={fmt(v)} color={colorVal(v)} />;
      case 'positionValue': return <StaticCell display={fmtDollar(v)} color="#e0e0e0" />;
      case 'riskSell': return <StaticCell display={v > 0 ? fmtDollar(v) : '—'} color="#ff9944" />;
      case 'target10': return <StaticCell display={v > 0 ? fmtDollar(v) : '—'} color="#00bfff" />;
      default: return <span style={{ color: '#888' }}>{String(v)}</span>;
    }
  };

  // Equity curve data
  const equityCurveData = useMemo(() => {
    const allData = [];
    accounts.forEach((acct) => {
      const entries = equityData.filter((e) => e.account === acct.name);
      entries.forEach((e) => {
        let existing = allData.find((d) => d.date === e.date);
        if (!existing) { existing = { date: e.date }; allData.push(existing); }
        existing[acct.name] = e.equity;
      });
    });
    allData.sort((a, b) => a.date.localeCompare(b.date));
    return allData;
  }, [accounts, equityData]);

  const acctColors = ['#00ff88', '#00bfff', '#ff6699', '#ffd700'];

  return (
    <>
      {/* Equity Curve */}
      {equityCurveData.length > 1 && (
        <div style={{ padding: '12px 20px' }}>
          <div style={{ background: '#12122a', border: '1px solid #2a2a4a', borderRadius: 6, padding: '12px 16px' }}>
            <div style={{ fontSize: 10, color: '#7777aa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Equity Curve</div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={equityCurveData} margin={{ top: 4, right: 16, bottom: 4, left: 16 }}>
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#555' }} />
                <YAxis tick={{ fontSize: 9, fill: '#555' }} tickFormatter={(v) => '$' + (v / 1000).toFixed(0) + 'k'} />
                <Tooltip contentStyle={{ background: '#1a1a3a', border: '1px solid #2a2a4a', fontSize: 11 }} formatter={(v) => fmtDollar(v)} />
                <Legend wrapperStyle={{ fontSize: 10, color: '#888' }} />
                {accounts.map((acct, i) => (
                  <Area key={acct.name} type="monotone" dataKey={acct.name} stroke={acctColors[i % acctColors.length]} fill={acctColors[i % acctColors.length]} fillOpacity={0.1} strokeWidth={2} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 20px 6px', gap: 16 }}>
        <Badge label="DTS" value={fmtDollar(totals.dts)} color={colorVal(totals.dts)} />
        <Badge label="P&L Total" value={fmtDollar(totals.plTotal)} color={colorVal(totals.plTotal)} />
        <Badge label="Portfolio" value={fmtDollar(totals.totalValue)} color="#00bfff" />
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 1800 }}>
          <colgroup>
            {portfolioCols.map((c) => <col key={c.key} style={{ width: c.width }} />)}
            <col style={{ width: 70 }} />
          </colgroup>
          <thead>
            <tr>
              {portfolioCols.map((col, i) => (
                <th key={col.key} style={thStyle(['symbol', 'account'].includes(col.key) ? 'left' : col.key === 'entryDate' ? 'center' : 'right', i, portfolioCols.length)}>
                  {col.label}
                </th>
              ))}
              <th style={{ ...thStyle('center', portfolioCols.length, portfolioCols.length + 1), width: 70 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {computed.map((row) => (
              <tr key={row.id} onMouseEnter={() => setHoveredRow(row.id)} onMouseLeave={() => setHoveredRow(null)}
                style={{ background: hoveredRow === row.id ? '#1a1a3a' : 'transparent', transition: 'background 0.15s' }}>
                {portfolioCols.map((col, i) => (
                  <td key={col.key} style={tdStyle(i, portfolioCols.length)}>
                    {renderCell(row, col)}
                  </td>
                ))}
                <td style={{ ...tdStyle(portfolioCols.length, portfolioCols.length + 1), textAlign: 'center' }}>
                  <button onClick={() => handleClosePosition(row)} title="Close position"
                    style={{ background: 'none', border: '1px solid #553333', color: '#aa6666', cursor: 'pointer', fontSize: 10, padding: '2px 6px', borderRadius: 3, marginRight: 4, fontFamily: 'inherit' }}
                    onMouseEnter={(e) => { e.target.style.borderColor = '#ff4444'; e.target.style.color = '#ff4444'; }}
                    onMouseLeave={(e) => { e.target.style.borderColor = '#553333'; e.target.style.color = '#aa6666'; }}>
                    Close
                  </button>
                  <DeleteBtn onClick={() => deleteRow(row.id)} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: '#12122a' }}>
              <td colSpan={3} style={{ padding: '8px 6px', borderTop: '2px solid #2a2a4a', color: '#7777aa', fontWeight: 600, fontSize: 11 }}>TOTALS</td>
              {portfolioCols.slice(3).map((col, i) => {
                let content = '', color = '#555';
                if (col.key === 'risk') { const t = computed.reduce((s, r) => s + r.risk, 0); content = fmtDollar(t); color = '#ffd700'; }
                else if (col.key === 'plDollar') { content = fmtDollar(totals.plTotal); color = colorVal(totals.plTotal); }
                else if (col.key === 'positionValue') { content = fmtDollar(totals.totalValue); color = '#e0e0e0'; }
                else if (col.key === 'changeDollar') { content = fmtDollar(totals.dts); color = colorVal(totals.dts); }
                return (
                  <td key={col.key} style={{ padding: '8px 4px', borderTop: '2px solid #2a2a4a', textAlign: 'right', color, fontWeight: content ? 700 : 400 }}>
                    <div style={{ padding: '0 4px' }}>{content}</div>
                  </td>
                );
              })}
              <td style={{ borderTop: '2px solid #2a2a4a' }} />
            </tr>
          </tfoot>
        </table>
      </div>
      <div style={{ padding: '12px 20px' }}>
        <HoverBtn style={addBtnStyle} hoverStyle={{ borderColor: '#00ff88', color: '#00ff88' }} onClick={addRow}>+ Add Position</HoverBtn>
      </div>

      {/* Close Position Modal */}
      {closeModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setCloseModal(null)}>
          <div style={{ background: '#12122a', border: '1px solid #2a2a4a', borderRadius: 8, padding: 24, width: 360 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ color: '#e0e0e0', fontSize: 14, fontWeight: 700, marginBottom: 16 }}>
              Close Position: <span style={{ color: '#00ff88' }}>{closeModal.symbol}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ color: '#7777aa', fontSize: 11, marginBottom: 4 }}>Sell Price</div>
                <input value={closeSellPrice} onChange={(e) => setCloseSellPrice(e.target.value)}
                  style={{ width: '100%', background: '#0d0d1a', color: '#e0e0e0', border: '1px solid #2a2a4a', borderRadius: 4, padding: '6px 8px', fontFamily: 'inherit', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div>
                <div style={{ color: '#7777aa', fontSize: 11, marginBottom: 4 }}>Close Date</div>
                <input value={closeDate} onChange={(e) => setCloseDate(e.target.value)}
                  style={{ width: '100%', background: '#0d0d1a', color: '#e0e0e0', border: '1px solid #2a2a4a', borderRadius: 4, padding: '6px 8px', fontFamily: 'inherit', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div style={{ color: '#7777aa', fontSize: 11 }}>
                Entry: {fmtDollar(closeModal.avgCost)} | Shares: {closeModal.shares} | P&L: <span style={{ color: colorVal((parseFloat(closeSellPrice) || 0) - closeModal.avgCost) }}>
                  {fmtDollar(((parseFloat(closeSellPrice) || 0) - closeModal.avgCost) * closeModal.shares)}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => setCloseModal(null)} style={{ ...actionBtnStyle, color: '#ff4444', borderColor: '#553333' }}>Cancel</button>
              <button onClick={confirmClose} style={{ ...actionBtnStyle, color: '#00ff88', borderColor: '#005533' }}>Close Position</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2: CLOSED TRADES
// ═══════════════════════════════════════════════════════════════════════════════

const closedCols = [
  { key: 'symbol', label: 'Symbol', width: 72, align: 'left' },
  { key: 'account', label: 'Acct', width: 72, align: 'left' },
  { key: 'entryDate', label: 'Entry', width: 76 },
  { key: 'closeDate', label: 'Exit', width: 76 },
  { key: 'holdDays', label: 'Days', width: 50, computed: true },
  { key: 'shares', label: 'Shares', width: 60 },
  { key: 'avgCost', label: 'Avg Cost', width: 82 },
  { key: 'sellPrice', label: 'Sell Price', width: 82 },
  { key: 'plPct', label: 'P&L%', width: 74 },
  { key: 'plDollar', label: 'P&L $', width: 100 },
  { key: 'result', label: 'Result', width: 56, computed: true },
];

function parseDateStr(s) {
  if (!s) return null;
  const parts = s.split('/');
  if (parts.length < 3) return null;
  const m = parseInt(parts[0]) - 1;
  const d = parseInt(parts[1]);
  const y = parseInt(parts[2]);
  return new Date(y < 50 ? 2000 + y : 1900 + y, m, d);
}

function ClosedTradesTab({ closedTrades, setClosedTrades }) {
  const [hoveredRow, setHoveredRow] = useState(null);
  const [nextId, setNextId] = useState(500);

  const updateField = useCallback((id, field, value) => {
    setClosedTrades((prev) => prev.map((r) => {
      if (r.id !== id) return r;
      const updated = { ...r, [field]: value };
      // Recalculate P&L when key fields change
      if (['avgCost', 'sellPrice', 'shares'].includes(field)) {
        updated.plPct = updated.avgCost ? ((updated.sellPrice - updated.avgCost) / updated.avgCost) * 100 : 0;
        updated.plDollar = (updated.sellPrice - updated.avgCost) * updated.shares;
      }
      return updated;
    }));
  }, [setClosedTrades]);

  const addRow = useCallback(() => {
    setClosedTrades((prev) => [...prev, { id: nextId, symbol: 'NEW', account: 'Account 1', entryDate: '', closeDate: todayStr(), shares: 0, avgCost: 0, sellPrice: 0, plPct: 0, plDollar: 0 }]);
    setNextId((n) => n + 1);
  }, [nextId, setClosedTrades]);

  const deleteRow = useCallback((id) => { setClosedTrades((prev) => prev.filter((r) => r.id !== id)); }, [setClosedTrades]);

  const computed = useMemo(() => closedTrades.map((r) => {
    const entry = parseDateStr(r.entryDate);
    const exit = parseDateStr(r.closeDate);
    const holdDays = entry && exit ? Math.round((exit - entry) / (1000 * 60 * 60 * 24)) : 0;
    const result = r.plPct > 0 ? 'WIN' : r.plPct < 0 ? 'LOSS' : 'BE';
    return { ...r, holdDays, result };
  }), [closedTrades]);

  const stats = useMemo(() => {
    const trades = computed.length;
    const wins = computed.filter((r) => r.plPct > 0).length;
    const losses = computed.filter((r) => r.plPct < 0).length;
    const totalPL = computed.reduce((s, r) => s + (r.plDollar || 0), 0);
    const avgGain = wins > 0 ? computed.filter((r) => r.plPct > 0).reduce((s, r) => s + r.plPct, 0) / wins : 0;
    const avgLoss = losses > 0 ? computed.filter((r) => r.plPct < 0).reduce((s, r) => s + r.plPct, 0) / losses : 0;
    const batAvg = trades > 0 ? (wins / trades) * 100 : 0;
    return { trades, wins, losses, totalPL, avgGain, avgLoss, batAvg };
  }, [computed]);

  return (
    <>
      <div style={{ padding: '12px 20px', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <MetricCard label="Total Trades" value={stats.trades} />
        <MetricCard label="Wins" value={stats.wins} color="#00ff88" />
        <MetricCard label="Losses" value={stats.losses} color="#ff4444" />
        <MetricCard label="Batting Avg" value={fmt(stats.batAvg) + '%'} />
        <MetricCard label="Avg Gain" value={fmt(stats.avgGain) + '%'} color="#00ff88" />
        <MetricCard label="Avg Loss" value={fmt(stats.avgLoss) + '%'} color="#ff4444" />
        <MetricCard label="Total P&L" value={fmtDollar(stats.totalPL)} color={colorVal(stats.totalPL)} />
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 900 }}>
          <colgroup>
            {closedCols.map((c) => <col key={c.key} style={{ width: c.width }} />)}
            <col style={{ width: 36 }} />
          </colgroup>
          <thead>
            <tr>
              {closedCols.map((col, i) => (
                <th key={col.key} style={thStyle(col.align || 'right', i, closedCols.length)}>{col.label}</th>
              ))}
              <th style={{ ...thStyle('center', closedCols.length, closedCols.length + 1) }} />
            </tr>
          </thead>
          <tbody>
            {computed.map((row) => (
              <tr key={row.id} onMouseEnter={() => setHoveredRow(row.id)} onMouseLeave={() => setHoveredRow(null)}
                style={{ background: hoveredRow === row.id ? '#1a1a3a' : 'transparent', transition: 'background 0.15s' }}>
                {closedCols.map((col, i) => {
                  let content;
                  if (col.key === 'symbol') content = <EditableCell value={row.symbol} display={row.symbol} color="#ffffff" onSave={(v) => updateField(row.id, 'symbol', v)} type="text" align="left" />;
                  else if (col.key === 'account') content = <EditableCell value={row.account} display={row.account} color="#8888bb" onSave={(v) => updateField(row.id, 'account', v)} type="text" align="left" />;
                  else if (col.key === 'entryDate' || col.key === 'closeDate') content = <EditableCell value={row[col.key]} display={row[col.key]} color="#8888aa" onSave={(v) => updateField(row.id, col.key, v)} type="text" align="center" />;
                  else if (col.key === 'holdDays') content = <StaticCell display={row.holdDays} color="#c0c0c0" />;
                  else if (col.key === 'shares') content = <EditableCell value={row.shares} display={row.shares?.toLocaleString()} color="#e0e0e0" onSave={(v) => updateField(row.id, 'shares', v)} type="number" />;
                  else if (col.key === 'avgCost' || col.key === 'sellPrice') content = <EditableCell value={row[col.key]} display={fmtDollar(row[col.key])} color="#e0e0e0" onSave={(v) => updateField(row.id, col.key, v)} type="number" />;
                  else if (col.key === 'plPct') content = <StaticCell display={fmtPct(row.plPct)} color={colorVal(row.plPct)} />;
                  else if (col.key === 'plDollar') content = <StaticCell display={fmtDollar(row.plDollar)} color={colorVal(row.plDollar)} />;
                  else if (col.key === 'result') {
                    const c = row.result === 'WIN' ? '#00ff88' : row.result === 'LOSS' ? '#ff4444' : '#ffd700';
                    content = <StaticCell display={row.result} color={c} />;
                  }
                  return <td key={col.key} style={tdStyle(i, closedCols.length)}>{content}</td>;
                })}
                <td style={{ ...tdStyle(closedCols.length, closedCols.length + 1), textAlign: 'center' }}>
                  <DeleteBtn onClick={() => deleteRow(row.id)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ padding: '12px 20px' }}>
        <HoverBtn style={addBtnStyle} hoverStyle={{ borderColor: '#00ff88', color: '#00ff88' }} onClick={addRow}>+ Add Closed Trade</HoverBtn>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3: TRADING JOURNAL (auto-populated from closed trades)
// ═══════════════════════════════════════════════════════════════════════════════

const journalCols = [
  { key: 'date', label: 'Date', type: 'text', width: 90, align: 'left' },
  { key: 'avgGain', label: 'Avg Gain', width: 72 },
  { key: 'avgLoss', label: 'Avg Loss', width: 72 },
  { key: 'net', label: 'Net', computed: true, width: 66 },
  { key: 'ratio', label: 'Ratio', computed: true, width: 56 },
  { key: 'winPct', label: 'Win%', computed: true, width: 62 },
  { key: 'lossPct', label: 'Loss%', computed: true, width: 62 },
  { key: 'wins', label: 'Wins', width: 50 },
  { key: 'losses', label: 'Losses', width: 55 },
  { key: 'breakeven', label: 'BE', width: 40 },
  { key: 'trades', label: '#Trades', width: 60 },
  { key: 'lgGain', label: 'LG Gain', width: 72 },
  { key: 'lgLoss', label: 'LG Loss', width: 72 },
  { key: 'lgNet', label: 'LG Net', computed: true, width: 66 },
  { key: 'lgRatio', label: 'LG Ratio', computed: true, width: 66 },
  { key: 'avgHold', label: 'Avg Days', width: 62 },
];

function JournalTab({ closedTrades }) {
  const [hoveredRow, setHoveredRow] = useState(null);

  // Group closed trades by month
  const monthlyStats = useMemo(() => {
    const byMonth = {};
    closedTrades.forEach((t) => {
      const key = monthYearStr(t.closeDate);
      if (!key) return;
      if (!byMonth[key]) byMonth[key] = [];
      byMonth[key].push(t);
    });

    const rows = [];
    // Sort months descending
    const sortedKeys = Object.keys(byMonth).sort((a, b) => {
      const pa = a.split(' '), pb = b.split(' ');
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const ya = parseInt(pa[1]), yb = parseInt(pb[1]);
      if (ya !== yb) return yb - ya;
      return months.indexOf(pb[0]) - months.indexOf(pa[0]);
    });

    sortedKeys.forEach((key, idx) => {
      const trades = byMonth[key];
      const wins = trades.filter((t) => t.plPct > 0);
      const losses = trades.filter((t) => t.plPct < 0);
      const be = trades.filter((t) => t.plPct === 0);
      const avgGain = wins.length > 0 ? wins.reduce((s, t) => s + t.plPct, 0) / wins.length : 0;
      const avgLoss = losses.length > 0 ? losses.reduce((s, t) => s + t.plPct, 0) / losses.length : 0;
      const lgGain = wins.length > 0 ? Math.max(...wins.map((t) => t.plPct)) : 0;
      const lgLoss = losses.length > 0 ? Math.min(...losses.map((t) => t.plPct)) : 0;

      const entryDates = trades.map((t) => parseDateStr(t.entryDate)).filter(Boolean);
      const exitDates = trades.map((t) => parseDateStr(t.closeDate)).filter(Boolean);
      let avgHold = 0;
      if (entryDates.length > 0 && exitDates.length > 0) {
        const holdDays = trades.map((t) => {
          const e = parseDateStr(t.entryDate);
          const x = parseDateStr(t.closeDate);
          return e && x ? Math.round((x - e) / (1000 * 60 * 60 * 24)) : 0;
        });
        avgHold = Math.round(holdDays.reduce((s, d) => s + d, 0) / holdDays.length);
      }

      rows.push({
        id: idx + 1, date: key, avgGain, avgLoss, wins: wins.length, losses: losses.length,
        breakeven: be.length, trades: trades.length, lgGain, lgLoss, avgHold,
      });
    });
    return rows;
  }, [closedTrades]);

  const computed = useMemo(() => monthlyStats.map((r) => {
    const net = r.avgGain + r.avgLoss;
    const ratio = r.avgLoss !== 0 ? r.avgGain / Math.abs(r.avgLoss) : 0;
    const winPct = r.trades > 0 ? (r.wins / r.trades) * 100 : 0;
    const lossPct = r.trades > 0 ? (r.losses / r.trades) * 100 : 0;
    const lgNet = r.lgGain + r.lgLoss;
    const lgRatio = r.lgLoss !== 0 ? r.lgGain / Math.abs(r.lgLoss) : 0;
    return { ...r, net, ratio, winPct, lossPct, lgNet, lgRatio };
  }), [monthlyStats]);

  const summary = useMemo(() => {
    const active = computed.filter((r) => r.trades > 0);
    if (active.length === 0) return null;
    const totalWins = active.reduce((s, r) => s + r.wins, 0);
    const totalLosses = active.reduce((s, r) => s + r.losses, 0);
    const totalTrades = active.reduce((s, r) => s + r.trades, 0);
    const avgGain = active.reduce((s, r) => s + r.avgGain, 0) / active.length;
    const avgLoss = active.reduce((s, r) => s + r.avgLoss, 0) / active.length;
    const net = avgGain + avgLoss;
    const ratio = avgLoss !== 0 ? avgGain / Math.abs(avgLoss) : 0;
    const winPct = totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0;
    const lossPct = totalTrades > 0 ? (totalLosses / totalTrades) * 100 : 0;
    const lgGain = Math.max(...active.map((r) => r.lgGain));
    const lgLoss = Math.min(...active.map((r) => r.lgLoss));
    const lgNet = lgGain + lgLoss;
    const lgRatio = lgLoss !== 0 ? lgGain / Math.abs(lgLoss) : 0;
    const avgHold = Math.round(active.reduce((s, r) => s + r.avgHold, 0) / active.length);
    const battingAvg = winPct;
    const adjustedWLR = lossPct > 0 ? ratio * (winPct / 100) / (lossPct / 100) : 0;
    return { avgGain, avgLoss, net, ratio, winPct, lossPct, wins: totalWins, losses: totalLosses, breakeven: 0, trades: totalTrades, lgGain, lgLoss, lgNet, lgRatio, avgHold, battingAvg, adjustedWLR };
  }, [computed]);

  const renderJournalCell = (row, col, isSummary) => {
    const v = row[col.key];
    const color = isSummary ? '#e0e0e0' : '#c0c0c0';
    if (col.key === 'date') return <StaticCell display={isSummary ? 'SUMMARY' : v} color={isSummary ? '#ffffff' : '#e0e0e0'} align="left" />;
    if (['avgGain', 'avgLoss', 'net', 'lgGain', 'lgLoss', 'lgNet'].includes(col.key)) return <StaticCell display={fmt(v) + '%'} color={colorVal(v)} />;
    if (['ratio', 'lgRatio'].includes(col.key)) return <StaticCell display={fmt(v)} color={color} />;
    if (['winPct', 'lossPct'].includes(col.key)) return <StaticCell display={fmt(v) + '%'} color={col.key === 'winPct' ? (v > 50 ? '#00ff88' : '#ff4444') : color} />;
    if (['avgHold'].includes(col.key)) return <StaticCell display={fmt(v, 0)} color={color} />;
    return <StaticCell display={String(v)} color={color} />;
  };

  if (closedTrades.length === 0) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: '#555' }}>
        <div style={{ fontSize: 14, marginBottom: 8 }}>No closed trades yet</div>
        <div style={{ fontSize: 11 }}>Close positions from the Portfolio tab to populate the journal automatically.</div>
      </div>
    );
  }

  return (
    <>
      {summary && (
        <div style={{ padding: '12px 20px', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { label: 'Batting Average', value: fmt(summary.battingAvg) + '%' },
            { label: 'Average Gain', value: fmt(summary.avgGain) + '%' },
            { label: 'Average Loss', value: fmt(summary.avgLoss) + '%' },
            { label: 'Win/Loss Ratio', value: fmt(summary.ratio) },
            { label: 'Adj W/L Ratio', value: fmt(summary.adjustedWLR) },
          ].map((m) => <MetricCard key={m.label} label={m.label} value={m.value} />)}
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 1100 }}>
          <colgroup>
            {journalCols.map((c) => <col key={c.key} style={{ width: c.width }} />)}
          </colgroup>
          <thead>
            <tr>
              {journalCols.map((col, i) => (
                <th key={col.key} style={thStyle(col.align || 'right', i, journalCols.length)}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {computed.map((row) => (
              <tr key={row.id} onMouseEnter={() => setHoveredRow(row.id)} onMouseLeave={() => setHoveredRow(null)}
                style={{ background: hoveredRow === row.id ? '#1a1a3a' : 'transparent', transition: 'background 0.15s' }}>
                {journalCols.map((col, i) => (
                  <td key={col.key} style={tdStyle(i, journalCols.length)}>
                    {renderJournalCell(row, col, false)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {summary && (
            <tfoot>
              <tr style={{ background: '#1a1a35' }}>
                {journalCols.map((col, i) => (
                  <td key={col.key} style={{ padding: '8px 4px', borderTop: '2px solid #2a2a4a', borderRight: i < journalCols.length - 1 ? '1px solid #1a1a35' : 'none', fontWeight: 700 }}>
                    {renderJournalCell(summary, col, true)}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 4: DRMA (auto-populated from closed trades)
// ═══════════════════════════════════════════════════════════════════════════════

function makeDRMARows() {
  const rows = [];
  let id = 1;
  for (let i = 0; i <= 72; i += 2) {
    rows.push({ id: id++, range: `${i}-${i + 2}%`, gains: 0, losses: 0 });
  }
  return rows;
}

function buildDRMAFromTrades(trades) {
  const rows = makeDRMARows();
  trades.forEach((t) => {
    const abs = Math.abs(t.plPct || 0);
    const bucket = Math.floor(abs / 2) * 2;
    const row = rows.find((r) => parseFloat(r.range) === bucket);
    if (row) {
      if (t.plPct >= 0) row.gains++;
      else row.losses++;
    }
  });
  return rows;
}

const drmaCols = [
  { key: 'range', label: 'Range', width: 72, align: 'left' },
  { key: 'gains', label: '# Gains', width: 60 },
  { key: 'losses', label: '# Losses', width: 62 },
  { key: 'gainPct', label: '%Up', computed: true, width: 56 },
  { key: 'lossPct', label: '%Down', computed: true, width: 56 },
  { key: 'net', label: 'Net', computed: true, width: 66 },
  { key: 'drma', label: 'DRMA', computed: true, width: 60 },
];

function DRMATab({ closedTrades }) {
  const [manualRows, setManualRows] = useState(null); // null = use auto from closed trades
  const [hoveredRow, setHoveredRow] = useState(null);
  const [showRefill, setShowRefill] = useState(false);
  const [refillText, setRefillText] = useState('');
  const [capInput, setCapInput] = useState('');
  const [showCap, setShowCap] = useState(false);
  const [moveInput, setMoveInput] = useState('');
  const [showMove, setShowMove] = useState(false);

  const rows = useMemo(() => {
    if (manualRows) return manualRows;
    return buildDRMAFromTrades(closedTrades);
  }, [manualRows, closedTrades]);

  const setRows = (fn) => {
    if (typeof fn === 'function') setManualRows(fn(rows));
    else setManualRows(fn);
  };

  const updateField = useCallback((id, field, value) => {
    setManualRows((prev) => {
      const base = prev || buildDRMAFromTrades(closedTrades);
      return base.map((r) => (r.id === id ? { ...r, [field]: value } : r));
    });
  }, [closedTrades]);

  const totalGains = useMemo(() => rows.reduce((s, r) => s + r.gains, 0), [rows]);
  const totalLosses = useMemo(() => rows.reduce((s, r) => s + r.losses, 0), [rows]);
  const totalTrades = totalGains + totalLosses;

  const computed = useMemo(() => rows.map((r) => {
    const gainPct = totalTrades > 0 ? (r.gains / totalTrades) * 100 : 0;
    const lossPct = totalTrades > 0 ? (r.losses / totalTrades) * 100 : 0;
    const net = gainPct - lossPct;
    const rangeMid = parseFloat(r.range) + 1;
    const drma = totalTrades > 0 ? net * rangeMid / 100 : 0;
    return { ...r, gainPct, lossPct, net, drma };
  }), [rows, totalTrades]);

  const summaryStats = useMemo(() => {
    const wins = totalGains, losses = totalLosses, trades = totalTrades;
    const battingAvg = trades > 0 ? (wins / trades) * 100 : 0;
    let wGain = 0, wLoss = 0;
    rows.forEach((r) => { const mid = parseFloat(r.range) + 1; wGain += r.gains * mid; wLoss += r.losses * mid; });
    const avgGain = wins > 0 ? wGain / wins : 0;
    const avgLoss = losses > 0 ? wLoss / losses : 0;
    const wlRatio = avgLoss > 0 ? avgGain / avgLoss : 0;
    const returnPerTrade = trades > 0 ? (battingAvg / 100 * avgGain) - ((100 - battingAvg) / 100 * avgLoss) : 0;
    const adjWLR = avgLoss > 0 && losses > 0 ? wlRatio * (wins / trades) / (losses / trades) : 0;
    return { trades, battingAvg, returnPerTrade, avgGain, avgLoss, wlRatio, wins, losses, adjWLR };
  }, [rows, totalGains, totalLosses, totalTrades]);

  const chartGainsLosses = useMemo(() => computed.filter((r) => r.gains > 0 || r.losses > 0).map((r) => ({
    range: r.range.replace('%', ''), gains: r.gains, losses: -r.losses,
  })), [computed]);
  const chartDRMA = useMemo(() => computed.filter((r) => r.drma !== 0).map((r) => ({
    range: r.range.replace('%', ''), drma: r.drma,
  })), [computed]);
  const chartGainMag = useMemo(() => computed.filter((r) => r.gains > 0).map((r) => ({
    range: r.range.replace('%', ''), count: r.gains,
  })), [computed]);
  const chartLossMag = useMemo(() => computed.filter((r) => r.losses > 0).map((r) => ({
    range: r.range.replace('%', ''), count: r.losses,
  })), [computed]);

  const handleRefill = useCallback(() => {
    const lines = refillText.trim().split('\n').map((l) => parseFloat(l.trim())).filter((v) => !isNaN(v));
    const newRows = makeDRMARows();
    lines.forEach((v) => {
      const abs = Math.abs(v);
      const bucket = Math.floor(abs / 2) * 2;
      const row = newRows.find((r) => parseFloat(r.range) === bucket);
      if (row) { if (v >= 0) row.gains++; else row.losses++; }
    });
    setManualRows(newRows);
    setShowRefill(false);
    setRefillText('');
  }, [refillText]);

  const handleCapLosses = useCallback(() => {
    const cap = parseFloat(capInput);
    if (isNaN(cap) || cap <= 0) return;
    const capBucket = Math.floor(cap / 2) * 2;
    const base = manualRows || buildDRMAFromTrades(closedTrades);
    const next = base.map((r) => ({ ...r }));
    let overflow = 0;
    next.forEach((r) => { const lo = parseFloat(r.range); if (lo > capBucket) { overflow += r.losses; r.losses = 0; } });
    const target = next.find((r) => parseFloat(r.range) === capBucket);
    if (target) target.losses += overflow;
    setManualRows(next);
    setShowCap(false);
    setCapInput('');
  }, [capInput, manualRows, closedTrades]);

  const handleMoveLosses = useCallback(() => {
    const offset = parseFloat(moveInput);
    if (isNaN(offset)) return;
    const buckets = Math.round(offset / 2);
    const base = manualRows || buildDRMAFromTrades(closedTrades);
    const next = base.map((r) => ({ ...r, losses: 0 }));
    base.forEach((r) => {
      if (r.losses > 0) {
        const lo = parseFloat(r.range);
        const newLo = lo + buckets * 2;
        const target = next.find((nr) => parseFloat(nr.range) === newLo);
        if (target) target.losses += r.losses;
      }
    });
    setManualRows(next);
    setShowMove(false);
    setMoveInput('');
  }, [moveInput, manualRows, closedTrades]);

  const resetToAuto = () => setManualRows(null);

  if (totalTrades === 0) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: '#555' }}>
        <div style={{ fontSize: 14, marginBottom: 8 }}>No trade data for DRMA</div>
        <div style={{ fontSize: 11, marginBottom: 16 }}>Close positions from Portfolio tab, or use Refill Data to paste trade results.</div>
        <button style={actionBtnStyle} onClick={() => setShowRefill(true)}>Refill Data</button>
        {showRefill && renderRefillModal()}
      </div>
    );
  }

  function renderRefillModal() {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onClick={() => setShowRefill(false)}>
        <div style={{ background: '#12122a', border: '1px solid #2a2a4a', borderRadius: 8, padding: 24, width: 400, maxHeight: '80vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
          <div style={{ color: '#e0e0e0', fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Refill Data</div>
          <div style={{ color: '#7777aa', fontSize: 11, marginBottom: 8 }}>Paste trade results (% per line, negative for losses):</div>
          <textarea value={refillText} onChange={(e) => setRefillText(e.target.value)}
            style={{ width: '100%', height: 200, background: '#0d0d1a', color: '#e0e0e0', border: '1px solid #2a2a4a', borderRadius: 4, padding: 8, fontFamily: 'inherit', fontSize: 12, resize: 'vertical', boxSizing: 'border-box' }}
            placeholder={"+5.2\n-1.8\n+12.5\n-3.1\n..."} />
          <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowRefill(false)} style={{ ...actionBtnStyle, color: '#ff4444', borderColor: '#553333' }}>Cancel</button>
            <button onClick={handleRefill} style={{ ...actionBtnStyle, color: '#00ff88', borderColor: '#005533' }}>Apply</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div style={{ display: 'flex', gap: 8, padding: '12px 20px', flexWrap: 'wrap', alignItems: 'center' }}>
        <button style={actionBtnStyle} onClick={() => setShowRefill(true)}
          onMouseEnter={(e) => { e.target.style.borderColor = '#7777cc'; e.target.style.color = '#ccccff'; }}
          onMouseLeave={(e) => { e.target.style.borderColor = '#3a3a6a'; e.target.style.color = '#9999cc'; }}>Refill Data</button>
        <button style={actionBtnStyle} onClick={resetToAuto}
          onMouseEnter={(e) => { e.target.style.borderColor = '#7777cc'; e.target.style.color = '#ccccff'; }}
          onMouseLeave={(e) => { e.target.style.borderColor = '#3a3a6a'; e.target.style.color = '#9999cc'; }}>Sync from Trades</button>
        <button style={actionBtnStyle} onClick={() => setManualRows(makeDRMARows())}
          onMouseEnter={(e) => { e.target.style.borderColor = '#7777cc'; e.target.style.color = '#ccccff'; }}
          onMouseLeave={(e) => { e.target.style.borderColor = '#3a3a6a'; e.target.style.color = '#9999cc'; }}>Clear</button>
        <button style={actionBtnStyle} onClick={() => setShowCap(true)}
          onMouseEnter={(e) => { e.target.style.borderColor = '#7777cc'; e.target.style.color = '#ccccff'; }}
          onMouseLeave={(e) => { e.target.style.borderColor = '#3a3a6a'; e.target.style.color = '#9999cc'; }}>Cap Losses</button>
        <button style={actionBtnStyle} onClick={() => setShowMove(true)}
          onMouseEnter={(e) => { e.target.style.borderColor = '#7777cc'; e.target.style.color = '#ccccff'; }}
          onMouseLeave={(e) => { e.target.style.borderColor = '#3a3a6a'; e.target.style.color = '#9999cc'; }}>Move Losses</button>
        {manualRows && <span style={{ fontSize: 10, color: '#ffd700', marginLeft: 8 }}>Manual mode (click "Sync from Trades" to reset)</span>}
      </div>

      {showRefill && renderRefillModal()}
      {showCap && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowCap(false)}>
          <div style={{ background: '#12122a', border: '1px solid #2a2a4a', borderRadius: 8, padding: 24, width: 320 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ color: '#e0e0e0', fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Cap Losses</div>
            <div style={{ color: '#7777aa', fontSize: 11, marginBottom: 8 }}>Set max loss threshold (%):</div>
            <input value={capInput} onChange={(e) => setCapInput(e.target.value)} placeholder="e.g. 6"
              style={{ width: '100%', background: '#0d0d1a', color: '#e0e0e0', border: '1px solid #2a2a4a', borderRadius: 4, padding: '6px 8px', fontFamily: 'inherit', fontSize: 12, boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowCap(false)} style={{ ...actionBtnStyle, color: '#ff4444', borderColor: '#553333' }}>Cancel</button>
              <button onClick={handleCapLosses} style={{ ...actionBtnStyle, color: '#00ff88', borderColor: '#005533' }}>Apply</button>
            </div>
          </div>
        </div>
      )}
      {showMove && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowMove(false)}>
          <div style={{ background: '#12122a', border: '1px solid #2a2a4a', borderRadius: 8, padding: 24, width: 320 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ color: '#e0e0e0', fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Move Losses</div>
            <div style={{ color: '#7777aa', fontSize: 11, marginBottom: 8 }}>Offset % (negative to shift left):</div>
            <input value={moveInput} onChange={(e) => setMoveInput(e.target.value)} placeholder="e.g. -2"
              style={{ width: '100%', background: '#0d0d1a', color: '#e0e0e0', border: '1px solid #2a2a4a', borderRadius: 4, padding: '6px 8px', fontFamily: 'inherit', fontSize: 12, boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowMove(false)} style={{ ...actionBtnStyle, color: '#ff4444', borderColor: '#553333' }}>Cancel</button>
              <button onClick={handleMoveLosses} style={{ ...actionBtnStyle, color: '#00ff88', borderColor: '#005533' }}>Apply</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 0, padding: '0 20px 12px' }}>
        <div style={{ flex: '0 0 55%', paddingRight: 16 }}>
          <div style={{ background: '#12122a', border: '1px solid #2a2a4a', borderRadius: 6, padding: 16, marginBottom: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px 16px' }}>
              {[
                { l: 'Total Trades', v: summaryStats.trades },
                { l: 'Batting Average', v: fmt(summaryStats.battingAvg) + '%' },
                { l: 'Return/Trade', v: fmt(summaryStats.returnPerTrade) + '%', c: colorVal(summaryStats.returnPerTrade) },
                { l: 'Avg Gain', v: fmt(summaryStats.avgGain) + '%' },
                { l: 'Avg Loss', v: fmt(summaryStats.avgLoss) + '%' },
                { l: 'W/L Ratio', v: fmt(summaryStats.wlRatio) },
                { l: '# Wins', v: summaryStats.wins },
                { l: '# Losses', v: summaryStats.losses },
                { l: 'Adj W/L Ratio', v: fmt(summaryStats.adjWLR) },
              ].map((m) => (
                <div key={m.l}>
                  <div style={{ fontSize: 10, color: '#7777aa', fontWeight: 600, textTransform: 'uppercase' }}>{m.l}</div>
                  <div style={{ fontSize: 14, color: m.c || '#e0e0e0', fontWeight: 700 }}>{m.v}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { title: 'Gains & Losses', data: chartGainsLosses, bars: [{ key: 'gains', fill: '#00ff88' }, { key: 'losses', fill: '#ff4444' }] },
              { title: 'DRMA Curve', data: chartDRMA, bars: [{ key: 'drma', dynamic: true }] },
              { title: 'Gain Magnitude', data: chartGainMag, bars: [{ key: 'count', fill: '#00ff88' }] },
              { title: 'Loss Magnitude', data: chartLossMag, bars: [{ key: 'count', fill: '#ff4444' }] },
            ].map((chart) => (
              <div key={chart.title} style={{ background: '#12122a', border: '1px solid #2a2a4a', borderRadius: 6, padding: '12px 8px 4px' }}>
                <div style={{ fontSize: 10, color: '#7777aa', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8, paddingLeft: 8 }}>{chart.title}</div>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={chart.data} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
                    <XAxis dataKey="range" tick={{ fontSize: 8, fill: '#555' }} interval={1} />
                    <YAxis tick={{ fontSize: 8, fill: '#555' }} />
                    <Tooltip contentStyle={{ background: '#1a1a3a', border: '1px solid #2a2a4a', fontSize: 11 }} />
                    {chart.bars.map((b) =>
                      b.dynamic ? (
                        <Bar key={b.key} dataKey={b.key} radius={[2, 2, 0, 0]}>
                          {chart.data.map((entry, i) => <Cell key={i} fill={entry[b.key] >= 0 ? '#6666cc' : '#cc6666'} />)}
                        </Bar>
                      ) : (
                        <Bar key={b.key} dataKey={b.key} fill={b.fill} radius={[2, 2, 0, 0]} />
                      )
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex: '0 0 45%', overflowY: 'auto', maxHeight: 600 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {drmaCols.map((col, i) => (
                  <th key={col.key} style={thStyle(col.align || 'right', i, drmaCols.length)}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {computed.map((row) => (
                <tr key={row.id} onMouseEnter={() => setHoveredRow(row.id)} onMouseLeave={() => setHoveredRow(null)}
                  style={{ background: hoveredRow === row.id ? '#1a1a3a' : 'transparent', transition: 'background 0.15s' }}>
                  {drmaCols.map((col, i) => {
                    let content;
                    if (col.key === 'range') content = <StaticCell display={row.range} color="#e0e0e0" align="left" />;
                    else if (col.key === 'gains') content = <EditableCell value={row.gains} display={row.gains} color="#00ff88" onSave={(v) => updateField(row.id, 'gains', v)} type="number" />;
                    else if (col.key === 'losses') content = <EditableCell value={row.losses} display={row.losses} color="#ff4444" onSave={(v) => updateField(row.id, 'losses', v)} type="number" />;
                    else if (col.key === 'gainPct') content = <StaticCell display={row.gains > 0 || row.losses > 0 ? fmt(row.gainPct) + '%' : '—'} color="#c0c0c0" />;
                    else if (col.key === 'lossPct') content = <StaticCell display={row.gains > 0 || row.losses > 0 ? fmt(row.lossPct) + '%' : '—'} color="#c0c0c0" />;
                    else if (col.key === 'net') { const h = row.gains > 0 || row.losses > 0; content = <StaticCell display={h ? fmt(row.net) + '%' : '—'} color={h ? colorVal(row.net) : '#555'} />; }
                    else if (col.key === 'drma') { const h = row.gains > 0 || row.losses > 0; content = <StaticCell display={h ? fmt(row.drma) : '—'} color={h ? colorVal(row.drma) : '#555'} />; }
                    return <td key={col.key} style={{ padding: '4px 4px', borderBottom: '1px solid #1a1a30', borderRight: i < drmaCols.length - 1 ? '1px solid #1a1a30' : 'none', verticalAlign: 'middle', lineHeight: '18px' }}>{content}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN: ACCOUNT SETTINGS + TAB CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════════

const defaultAccounts = [
  { name: 'Account 1', startingEquity: 100000 },
  { name: 'Account 2', startingEquity: 50000 },
];

const defaultEquityData = [
  { date: '2025-05-01', account: 'Account 1', equity: 100000 },
  { date: '2025-06-01', account: 'Account 1', equity: 104500 },
  { date: '2025-07-01', account: 'Account 1', equity: 112300 },
  { date: '2025-08-01', account: 'Account 1', equity: 108700 },
  { date: '2025-09-01', account: 'Account 1', equity: 115200 },
  { date: '2025-05-01', account: 'Account 2', equity: 50000 },
  { date: '2025-06-01', account: 'Account 2', equity: 52100 },
  { date: '2025-07-01', account: 'Account 2', equity: 55800 },
  { date: '2025-08-01', account: 'Account 2', equity: 53200 },
  { date: '2025-09-01', account: 'Account 2', equity: 57600 },
];

const defaultClosed = [
  { id: 201, symbol: 'NVDA', account: 'Account 1', entryDate: '8/5/25', closeDate: '8/20/25', shares: 50, avgCost: 420.00, sellPrice: 465.50, plPct: 10.83, plDollar: 2275.00 },
  { id: 202, symbol: 'AAPL', account: 'Account 1', entryDate: '8/10/25', closeDate: '8/25/25', shares: 100, avgCost: 195.00, sellPrice: 188.50, plPct: -3.33, plDollar: -650.00 },
  { id: 203, symbol: 'META', account: 'Account 2', entryDate: '7/15/25', closeDate: '8/5/25', shares: 30, avgCost: 480.00, sellPrice: 520.00, plPct: 8.33, plDollar: 1200.00 },
  { id: 204, symbol: 'AMD', account: 'Account 1', entryDate: '7/20/25', closeDate: '8/10/25', shares: 80, avgCost: 155.00, sellPrice: 148.00, plPct: -4.52, plDollar: -560.00 },
  { id: 205, symbol: 'SMCI', account: 'Account 2', entryDate: '8/1/25', closeDate: '9/1/25', shares: 40, avgCost: 600.00, sellPrice: 720.00, plPct: 20.00, plDollar: 4800.00 },
  { id: 206, symbol: 'PLTR', account: 'Account 1', entryDate: '8/15/25', closeDate: '9/5/25', shares: 200, avgCost: 28.00, sellPrice: 30.50, plPct: 8.93, plDollar: 500.00 },
  { id: 207, symbol: 'COIN', account: 'Account 2', entryDate: '8/20/25', closeDate: '9/10/25', shares: 50, avgCost: 220.00, sellPrice: 205.00, plPct: -6.82, plDollar: -750.00 },
  { id: 208, symbol: 'MSTR', account: 'Account 1', entryDate: '9/1/25', closeDate: '9/15/25', shares: 15, avgCost: 1350.00, sellPrice: 1280.00, plPct: -5.19, plDollar: -1050.00 },
];

export default function StockPortfolioTracker() {
  const [activeTab, setActiveTab] = useState('portfolio');
  const [positions, setPositions] = usePersisted('positions', defaultPositions);
  const [closedTrades, setClosedTrades] = usePersisted('closedTrades', defaultClosed);
  const [accounts, setAccounts] = usePersisted('accounts', defaultAccounts);
  const [equityData, setEquityData] = usePersisted('equityData', defaultEquityData);
  const [showAcctSettings, setShowAcctSettings] = useState(false);
  const [editAcctName, setEditAcctName] = useState('');
  const [editAcctEquity, setEditAcctEquity] = useState('');
  const [newEquityDate, setNewEquityDate] = useState('');
  const [newEquityValue, setNewEquityValue] = useState('');

  // Auto-save all persistent state to localStorage
  useEffect(() => {
    saveAllState({ positions, closedTrades, accounts, equityData });
  }, [positions, closedTrades, accounts, equityData]);
  const [newEquityAcct, setNewEquityAcct] = useState('');

  const handleClosePosition = useCallback((closedPos) => {
    setClosedTrades((prev) => [{ ...closedPos, id: Date.now() }, ...prev]);
  }, []);

  const addEquityEntry = () => {
    if (!newEquityDate || !newEquityValue || !newEquityAcct) return;
    setEquityData((prev) => [...prev, { date: newEquityDate, account: newEquityAcct, equity: parseFloat(newEquityValue) }]);
    setNewEquityDate('');
    setNewEquityValue('');
  };

  const addAccount = () => {
    if (!editAcctName) return;
    setAccounts((prev) => [...prev, { name: editAcctName, startingEquity: parseFloat(editAcctEquity) || 0 }]);
    setEditAcctName('');
    setEditAcctEquity('');
  };

  const inputStyle = { background: '#0d0d1a', color: '#e0e0e0', border: '1px solid #2a2a4a', borderRadius: 4, padding: '6px 8px', fontFamily: 'inherit', fontSize: 12, boxSizing: 'border-box' };

  return (
    <div style={{ background: '#0d0d1a', minHeight: '100vh', color: '#c0c0c0', fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Courier New', monospace", fontSize: 12 }}>
      {/* Top Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px 0' }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#ffffff', letterSpacing: 1 }}>TRADING DASHBOARD</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {accounts.map((a) => (
            <Badge key={a.name} label={a.name} value={fmtDollar(a.startingEquity)} color="#8888bb" />
          ))}
          <button onClick={() => setShowAcctSettings(!showAcctSettings)}
            style={{ ...actionBtnStyle, fontSize: 10, padding: '4px 10px' }}
            onMouseEnter={(e) => { e.target.style.borderColor = '#7777cc'; e.target.style.color = '#ccccff'; }}
            onMouseLeave={(e) => { e.target.style.borderColor = '#3a3a6a'; e.target.style.color = '#9999cc'; }}>
            Settings
          </button>
        </div>
      </div>

      {/* Account Settings Panel */}
      {showAcctSettings && (
        <div style={{ margin: '8px 20px', background: '#12122a', border: '1px solid #2a2a4a', borderRadius: 6, padding: 16 }}>
          <div style={{ fontSize: 12, color: '#e0e0e0', fontWeight: 700, marginBottom: 12 }}>Account Settings</div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            {accounts.map((a, idx) => (
              <div key={idx} style={{ background: '#0d0d1a', border: '1px solid #2a2a4a', borderRadius: 4, padding: '8px 12px', display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ color: '#7777aa', fontSize: 10, fontWeight: 600 }}>{a.name}</span>
                <span style={{ color: '#e0e0e0' }}>Starting: {fmtDollar(a.startingEquity)}</span>
                <button onClick={() => setAccounts((prev) => prev.filter((_, i) => i !== idx))}
                  style={{ background: 'none', border: 'none', color: '#553333', cursor: 'pointer', fontSize: 12 }}
                  onMouseEnter={(e) => (e.target.style.color = '#ff4444')}
                  onMouseLeave={(e) => (e.target.style.color = '#553333')}>x</button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
            <input value={editAcctName} onChange={(e) => setEditAcctName(e.target.value)} placeholder="Account name" style={{ ...inputStyle, width: 150 }} />
            <input value={editAcctEquity} onChange={(e) => setEditAcctEquity(e.target.value)} placeholder="Starting equity" style={{ ...inputStyle, width: 130 }} />
            <button onClick={addAccount} style={{ ...actionBtnStyle, color: '#00ff88', borderColor: '#005533' }}>Add Account</button>
          </div>

          <div style={{ fontSize: 11, color: '#7777aa', fontWeight: 600, marginBottom: 8 }}>EQUITY CURVE DATA</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <input value={newEquityDate} onChange={(e) => setNewEquityDate(e.target.value)} placeholder="YYYY-MM-DD" style={{ ...inputStyle, width: 120 }} />
            <select value={newEquityAcct} onChange={(e) => setNewEquityAcct(e.target.value)}
              style={{ ...inputStyle, width: 130 }}>
              <option value="">Select account</option>
              {accounts.map((a) => <option key={a.name} value={a.name}>{a.name}</option>)}
            </select>
            <input value={newEquityValue} onChange={(e) => setNewEquityValue(e.target.value)} placeholder="Equity value" style={{ ...inputStyle, width: 130 }} />
            <button onClick={addEquityEntry} style={{ ...actionBtnStyle, color: '#00ff88', borderColor: '#005533' }}>Add Entry</button>
          </div>
          <div style={{ maxHeight: 150, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', color: '#555', fontSize: 9, padding: '4px 6px', borderBottom: '1px solid #2a2a4a' }}>DATE</th>
                  <th style={{ textAlign: 'left', color: '#555', fontSize: 9, padding: '4px 6px', borderBottom: '1px solid #2a2a4a' }}>ACCOUNT</th>
                  <th style={{ textAlign: 'right', color: '#555', fontSize: 9, padding: '4px 6px', borderBottom: '1px solid #2a2a4a' }}>EQUITY</th>
                  <th style={{ width: 30, borderBottom: '1px solid #2a2a4a' }} />
                </tr>
              </thead>
              <tbody>
                {equityData.sort((a, b) => b.date.localeCompare(a.date)).map((e, idx) => (
                  <tr key={idx}>
                    <td style={{ padding: '3px 6px', color: '#888', fontSize: 11 }}>{e.date}</td>
                    <td style={{ padding: '3px 6px', color: '#8888bb', fontSize: 11 }}>{e.account}</td>
                    <td style={{ padding: '3px 6px', color: '#e0e0e0', fontSize: 11, textAlign: 'right' }}>{fmtDollar(e.equity)}</td>
                    <td style={{ padding: '3px 6px', textAlign: 'center' }}>
                      <button onClick={() => setEquityData((prev) => prev.filter((_, i) => i !== idx))}
                        style={{ background: 'none', border: 'none', color: '#553333', cursor: 'pointer', fontSize: 11 }}>x</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ borderTop: '1px solid #2a2a4a', marginTop: 12, paddingTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={() => {
              if (confirm('Reset all data to defaults? This will clear all your saved positions, trades, accounts, and equity data.')) {
                localStorage.removeItem(STORAGE_KEY);
                setPositions(defaultPositions);
                setClosedTrades(defaultClosed);
                setAccounts(defaultAccounts);
                setEquityData(defaultEquityData);
              }
            }} style={{ ...actionBtnStyle, color: '#ff4444', borderColor: '#553333', fontSize: 10 }}
              onMouseEnter={(e) => { e.target.style.borderColor = '#ff4444'; }}
              onMouseLeave={(e) => { e.target.style.borderColor = '#553333'; }}>
              Reset All Data to Defaults
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, padding: '12px 20px 0', borderBottom: '1px solid #2a2a4a' }}>
        <TabButton label="Portfolio" active={activeTab === 'portfolio'} onClick={() => setActiveTab('portfolio')} />
        <TabButton label="Closed Trades" active={activeTab === 'closed'} onClick={() => setActiveTab('closed')} />
        <TabButton label="Trading Journal" active={activeTab === 'journal'} onClick={() => setActiveTab('journal')} />
        <TabButton label="DRMA" active={activeTab === 'drma'} onClick={() => setActiveTab('drma')} />
      </div>

      {activeTab === 'portfolio' && <PortfolioTab positions={positions} setPositions={setPositions} onClosePosition={handleClosePosition} accounts={accounts} equityData={equityData} />}
      {activeTab === 'closed' && <ClosedTradesTab closedTrades={closedTrades} setClosedTrades={setClosedTrades} />}
      {activeTab === 'journal' && <JournalTab closedTrades={closedTrades} />}
      {activeTab === 'drma' && <DRMATab closedTrades={closedTrades} />}
    </div>
  );
}
