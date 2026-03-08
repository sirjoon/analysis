import React, { useState, useCallback, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

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
const rprColor = (v) => (v >= 80 ? '#00ff88' : v >= 40 ? '#ffd700' : '#ff4444');

// ─── Editable Cell ───────────────────────────────────────────────────────────

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

// ─── Tab Button ──────────────────────────────────────────────────────────────

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

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1: PORTFOLIO
// ═══════════════════════════════════════════════════════════════════════════════

const defaultPositions = [
  { id: 1, symbol: 'OPEN', changePct: -3.47, last: 5.00, rpr: 99, tpr: 'D', entryDate: '9/10/25', shares: 2000, avgCost: 9.22, stopLoss: 8.93, off52WH: -45.2 },
  { id: 2, symbol: 'MP', changePct: -0.43, last: 58.23, rpr: 94, tpr: 'D', entryDate: '9/16/25', shares: 690, avgCost: 66.83, stopLoss: 63.42, off52WH: -12.8 },
  { id: 3, symbol: 'TSLA', changePct: -2.17, last: 396.73, rpr: 81, tpr: 'D', entryDate: '9/17/25', shares: 60, avgCost: 415.57, stopLoss: 399.33, off52WH: -8.5 },
  { id: 4, symbol: 'HOOD', changePct: -4.31, last: 77.09, rpr: 29, tpr: 'D', entryDate: '9/18/25', shares: 400, avgCost: 121.22, stopLoss: 119.00, off52WH: -36.4 },
  { id: 5, symbol: 'CRWV', changePct: -2.45, last: 72.99, rpr: 34, tpr: 'D', entryDate: '9/18/25', shares: 500, avgCost: 121.18, stopLoss: 115.00, off52WH: -39.8 },
];

const portfolioCols = [
  { key: 'symbol', label: 'Symbol', width: 72 },
  { key: 'changePct', label: 'Change%', width: 78 },
  { key: 'last', label: 'Last', width: 78 },
  { key: 'rpr', label: 'RPR', width: 56 },
  { key: 'tpr', label: 'TPR', width: 48 },
  { key: 'entryDate', label: 'Entry Date', width: 84 },
  { key: 'shares', label: 'Shares', width: 68 },
  { key: 'plPct', label: 'P&L%', width: 74, computed: true },
  { key: 'avgCost', label: 'Avg Cost', width: 82 },
  { key: 'stopLoss', label: 'Stop Loss', width: 82 },
  { key: 'stopLossPct', label: 'Stop Loss%', width: 82, computed: true },
  { key: 'risk', label: 'Risk', width: 88, computed: true },
  { key: 'plDollar', label: 'P&L $', width: 100, computed: true },
  { key: 'rs', label: "R's", width: 60, computed: true },
  { key: 'off52WH', label: '% Off 52W High', width: 108 },
  { key: 'positionValue', label: 'Position Value', width: 110, computed: true },
  { key: 'changeDollar', label: 'Change $', width: 100, computed: true },
];

function PortfolioTab() {
  const [positions, setPositions] = useState(defaultPositions);
  const [nextId, setNextId] = useState(6);
  const [hoveredRow, setHoveredRow] = useState(null);

  const updateField = useCallback((id, field, value) => {
    setPositions((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  }, []);
  const addRow = useCallback(() => {
    setPositions((prev) => [...prev, { id: nextId, symbol: 'NEW', changePct: 0, last: 0, rpr: 50, tpr: 'D', entryDate: '', shares: 0, avgCost: 0, stopLoss: 0, off52WH: 0 }]);
    setNextId((n) => n + 1);
  }, [nextId]);
  const deleteRow = useCallback((id) => { setPositions((prev) => prev.filter((p) => p.id !== id)); }, []);

  const computed = useMemo(() => positions.map((p) => {
    const plPct = p.avgCost ? ((p.last - p.avgCost) / p.avgCost) * 100 : 0;
    const plDollar = (p.last - p.avgCost) * p.shares;
    const risk = (p.avgCost - p.stopLoss) * p.shares;
    const positionValue = p.last * p.shares;
    const changeDollar = (p.changePct / 100) * positionValue;
    const stopLossPct = p.avgCost ? ((p.stopLoss - p.avgCost) / p.avgCost) * 100 : 0;
    const rs = risk !== 0 ? plDollar / risk : 0;
    return { ...p, plPct, plDollar, risk, positionValue, changeDollar, stopLossPct, rs };
  }), [positions]);

  const totals = useMemo(() => {
    let dts = 0, plTotal = 0, totalValue = 0;
    computed.forEach((c) => { dts += c.changeDollar; plTotal += c.plDollar; totalValue += c.positionValue; });
    return { dts, plTotal, totalValue };
  }, [computed]);

  const renderCell = (row, col) => {
    const v = row[col.key];
    const ec = (display, color, type, align) => (
      <EditableCell value={v} display={display} color={color} onSave={(val) => updateField(row.id, col.key, val)} type={type} align={align} />
    );
    switch (col.key) {
      case 'symbol': return ec(v, '#ffffff', 'text', 'left');
      case 'changePct': return ec(fmtPct(v), colorVal(v), 'number');
      case 'last': return ec(fmtDollar(v), '#e0e0e0', 'number');
      case 'rpr': return ec(v, rprColor(v), 'number');
      case 'tpr': return ec(v, '#c0c0c0', 'text');
      case 'entryDate': return ec(v, '#8888aa', 'text', 'center');
      case 'shares': return ec(v?.toLocaleString(), '#e0e0e0', 'number');
      case 'avgCost': case 'stopLoss': return ec(fmtDollar(v), '#e0e0e0', 'number');
      case 'off52WH': return ec(fmtPct(v), colorVal(v), 'number');
      case 'plPct': case 'stopLossPct': return <StaticCell display={fmtPct(v)} color={colorVal(v)} />;
      case 'risk': return <StaticCell display={fmtDollar(v)} color="#ffd700" />;
      case 'plDollar': case 'changeDollar': return <StaticCell display={fmtDollar(v)} color={colorVal(v)} />;
      case 'rs': return <StaticCell display={fmt(v)} color={colorVal(v)} />;
      case 'positionValue': return <StaticCell display={fmtDollar(v)} color="#e0e0e0" />;
      default: return <span style={{ color: '#888' }}>{String(v)}</span>;
    }
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 20px 6px', gap: 16 }}>
        <Badge label="DTS" value={fmtDollar(totals.dts)} color={colorVal(totals.dts)} />
        <Badge label="P&L Total" value={fmtDollar(totals.plTotal)} color={colorVal(totals.plTotal)} />
        <Badge label="Portfolio" value={fmtDollar(totals.totalValue)} color="#00bfff" />
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 1500 }}>
          <colgroup>
            {portfolioCols.map((c) => <col key={c.key} style={{ width: c.width }} />)}
            <col style={{ width: 36 }} />
          </colgroup>
          <thead>
            <tr>
              {portfolioCols.map((col, i) => (
                <th key={col.key} style={{ padding: '8px 6px', textAlign: col.key === 'symbol' ? 'left' : col.key === 'entryDate' ? 'center' : 'right', color: '#7777aa', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, borderBottom: '2px solid #2a2a4a', borderRight: i < portfolioCols.length - 1 ? '1px solid #1a1a35' : 'none', background: '#10102a', position: 'sticky', top: 0, zIndex: 1, whiteSpace: 'nowrap', userSelect: 'none' }}>
                  {col.label}
                </th>
              ))}
              <th style={{ padding: '8px 4px', borderBottom: '2px solid #2a2a4a', background: '#10102a', position: 'sticky', top: 0, zIndex: 1 }} />
            </tr>
          </thead>
          <tbody>
            {computed.map((row) => (
              <tr key={row.id} onMouseEnter={() => setHoveredRow(row.id)} onMouseLeave={() => setHoveredRow(null)}
                style={{ background: hoveredRow === row.id ? '#1a1a3a' : 'transparent', transition: 'background 0.15s' }}>
                {portfolioCols.map((col, i) => (
                  <td key={col.key} style={{ padding: '6px 4px', borderBottom: '1px solid #1a1a30', borderRight: i < portfolioCols.length - 1 ? '1px solid #1a1a30' : 'none', verticalAlign: 'middle', lineHeight: '20px' }}>
                    {renderCell(row, col)}
                  </td>
                ))}
                <td style={{ padding: '6px 4px', borderBottom: '1px solid #1a1a30', textAlign: 'center', verticalAlign: 'middle' }}>
                  <button onClick={() => deleteRow(row.id)} title="Delete row"
                    style={{ background: 'none', border: 'none', color: '#553333', cursor: 'pointer', fontSize: 14, padding: '0 4px', lineHeight: 1 }}
                    onMouseEnter={(e) => (e.target.style.color = '#ff4444')}
                    onMouseLeave={(e) => (e.target.style.color = '#553333')}>x</button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: '#12122a' }}>
              <td colSpan={2} style={{ padding: '8px 6px', borderTop: '2px solid #2a2a4a', color: '#7777aa', fontWeight: 600, fontSize: 11 }}>TOTALS</td>
              {portfolioCols.slice(2).map((col, i) => {
                let content = '', color = '#555';
                if (col.key === 'risk') { const t = computed.reduce((s, r) => s + r.risk, 0); content = fmtDollar(t); color = '#ffd700'; }
                else if (col.key === 'plDollar') { content = fmtDollar(totals.plTotal); color = colorVal(totals.plTotal); }
                else if (col.key === 'positionValue') { content = fmtDollar(totals.totalValue); color = '#e0e0e0'; }
                else if (col.key === 'changeDollar') { content = fmtDollar(totals.dts); color = colorVal(totals.dts); }
                return (
                  <td key={col.key} style={{ padding: '8px 4px', borderTop: '2px solid #2a2a4a', borderRight: i < portfolioCols.length - 3 ? '1px solid #1a1a30' : 'none', textAlign: 'right', color, fontWeight: content ? 700 : 400 }}>
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
        <button onClick={addRow}
          style={{ background: '#1a1a3a', color: '#7777aa', border: '1px dashed #2a2a4a', borderRadius: 4, padding: '8px 20px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, letterSpacing: 0.5 }}
          onMouseEnter={(e) => { e.target.style.borderColor = '#00ff88'; e.target.style.color = '#00ff88'; }}
          onMouseLeave={(e) => { e.target.style.borderColor = '#2a2a4a'; e.target.style.color = '#7777aa'; }}>
          + Add Position
        </button>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2: TRADING JOURNAL
// ═══════════════════════════════════════════════════════════════════════════════

const defaultJournal = [
  { id: 1, date: 'Mar 2026', avgGain: 0, avgLoss: 0, wins: 0, losses: 0, breakeven: 0, trades: 0, lgGain: 0, lgLoss: 0, avgLG: 0, avgDays: 0, comm: 0 },
  { id: 2, date: 'Feb 2026', avgGain: 0, avgLoss: 0, wins: 0, losses: 0, breakeven: 0, trades: 0, lgGain: 0, lgLoss: 0, avgLG: 0, avgDays: 0, comm: 0 },
  { id: 3, date: 'Jan 2026', avgGain: 0, avgLoss: 0, wins: 0, losses: 0, breakeven: 0, trades: 0, lgGain: 0, lgLoss: 0, avgLG: 0, avgDays: 0, comm: 0 },
  { id: 4, date: 'Dec 2025', avgGain: 0, avgLoss: 0, wins: 0, losses: 0, breakeven: 0, trades: 0, lgGain: 0, lgLoss: 0, avgLG: 0, avgDays: 0, comm: 0 },
  { id: 5, date: 'Nov 2025', avgGain: 0, avgLoss: 0, wins: 0, losses: 0, breakeven: 0, trades: 0, lgGain: 0, lgLoss: 0, avgLG: 0, avgDays: 0, comm: 0 },
  { id: 6, date: 'Oct 2025', avgGain: 0, avgLoss: 0, wins: 0, losses: 0, breakeven: 0, trades: 0, lgGain: 0, lgLoss: 0, avgLG: 0, avgDays: 0, comm: 0 },
  { id: 7, date: 'Sep 2025', avgGain: 7.55, avgLoss: -2.35, wins: 11, losses: 19, breakeven: 0, trades: 30, lgGain: 26.72, lgLoss: -4.68, avgLG: 10, avgDays: 5, comm: 0 },
  { id: 8, date: 'Aug 2025', avgGain: 7.92, avgLoss: -2.85, wins: 29, losses: 25, breakeven: 0, trades: 54, lgGain: 48.69, lgLoss: -14.17, avgLG: 12, avgDays: 4, comm: 0 },
  { id: 9, date: 'Jul 2025', avgGain: 8.14, avgLoss: -2.06, wins: 11, losses: 15, breakeven: 0, trades: 26, lgGain: 34.92, lgLoss: -4.25, avgLG: 14, avgDays: 6, comm: 0 },
  { id: 10, date: 'Jun 2025', avgGain: 9.00, avgLoss: -4.97, wins: 25, losses: 18, breakeven: 0, trades: 43, lgGain: 32.86, lgLoss: -27.71, avgLG: 19, avgDays: 6, comm: 0 },
  { id: 11, date: 'May 2025', avgGain: 5.63, avgLoss: -3.30, wins: 10, losses: 16, breakeven: 0, trades: 26, lgGain: 9.85, lgLoss: -14.66, avgLG: 18, avgDays: 4, comm: 0 },
];

const journalCols = [
  { key: 'date', label: 'Date', type: 'text', width: 90, align: 'left' },
  { key: 'avgGain', label: 'Avg Gain', type: 'number', width: 72 },
  { key: 'avgLoss', label: 'Avg Loss', type: 'number', width: 72 },
  { key: 'net', label: 'Net', computed: true, width: 66 },
  { key: 'ratio', label: 'Ratio', computed: true, width: 56 },
  { key: 'winPct', label: 'Win%', computed: true, width: 62 },
  { key: 'lossPct', label: 'Loss%', computed: true, width: 62 },
  { key: 'wins', label: 'Wins', type: 'number', width: 50 },
  { key: 'losses', label: 'Losses', type: 'number', width: 55 },
  { key: 'breakeven', label: 'BE', type: 'number', width: 40 },
  { key: 'trades', label: '#Trades', type: 'number', width: 60 },
  { key: 'lgGain', label: 'LG Gain', type: 'number', width: 72 },
  { key: 'lgLoss', label: 'LG Loss', type: 'number', width: 72 },
  { key: 'lgNet', label: 'LG Net', computed: true, width: 66 },
  { key: 'lgRatio', label: 'LG Ratio', computed: true, width: 66 },
  { key: 'avgLG', label: 'Avg LG', type: 'number', width: 56 },
  { key: 'avgDays', label: 'Avg Days', type: 'number', width: 62 },
  { key: 'comm', label: 'COMM', type: 'number', width: 56 },
];

function JournalTab() {
  const [rows, setRows] = useState(defaultJournal);
  const [nextId, setNextId] = useState(12);
  const [hoveredRow, setHoveredRow] = useState(null);

  const updateField = useCallback((id, field, value) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }, []);

  const computed = useMemo(() => rows.map((r) => {
    const net = r.avgGain + r.avgLoss;
    const ratio = r.avgLoss !== 0 ? r.avgGain / Math.abs(r.avgLoss) : 0;
    const winPct = r.trades > 0 ? (r.wins / r.trades) * 100 : 0;
    const lossPct = r.trades > 0 ? (r.losses / r.trades) * 100 : 0;
    const lgNet = r.lgGain + r.lgLoss;
    const lgRatio = r.lgLoss !== 0 ? r.lgGain / Math.abs(r.lgLoss) : 0;
    return { ...r, net, ratio, winPct, lossPct, lgNet, lgRatio };
  }), [rows]);

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
    const lgGain = active.reduce((s, r) => s + r.lgGain, 0) / active.length;
    const lgLoss = active.reduce((s, r) => s + r.lgLoss, 0) / active.length;
    const lgNet = lgGain + lgLoss;
    const lgRatio = lgLoss !== 0 ? lgGain / Math.abs(lgLoss) : 0;
    const avgLG = active.reduce((s, r) => s + r.avgLG, 0) / active.length;
    const avgDays = active.reduce((s, r) => s + r.avgDays, 0) / active.length;
    const battingAvg = winPct;
    const adjustedWLR = ratio * (winPct / 100) / (lossPct / 100 || 1);
    return { avgGain, avgLoss, net, ratio, winPct, lossPct, wins: totalWins, losses: totalLosses, breakeven: 0, trades: totalTrades, lgGain, lgLoss, lgNet, lgRatio, avgLG, avgDays, comm: 0, battingAvg, adjustedWLR };
  }, [computed]);

  const addTrade = useCallback(() => {
    const now = new Date();
    const monthStr = now.toLocaleString('en-US', { month: 'short' }) + ' ' + now.getFullYear();
    const existing = rows.find((r) => r.date === monthStr);
    if (existing) {
      setRows((prev) => prev.map((r) => r.id === existing.id ? { ...r, trades: r.trades + 1 } : r));
    } else {
      setRows((prev) => [{ id: nextId, date: monthStr, avgGain: 0, avgLoss: 0, wins: 0, losses: 0, breakeven: 0, trades: 1, lgGain: 0, lgLoss: 0, avgLG: 0, avgDays: 0, comm: 0 }, ...prev]);
      setNextId((n) => n + 1);
    }
  }, [rows, nextId]);

  const deleteRow = useCallback((id) => { setRows((prev) => prev.filter((r) => r.id !== id)); }, []);

  const renderJournalCell = (row, col, isSummary) => {
    const v = row[col.key];
    if (isSummary) {
      let display = '', color = '#e0e0e0';
      if (col.key === 'date') return <StaticCell display="SUMMARY" color="#ffffff" align="left" />;
      if (['avgGain', 'avgLoss', 'net', 'lgGain', 'lgLoss', 'lgNet'].includes(col.key)) { display = fmt(v) + '%'; color = colorVal(v); }
      else if (['ratio', 'lgRatio'].includes(col.key)) { display = fmt(v); color = '#e0e0e0'; }
      else if (['winPct', 'lossPct'].includes(col.key)) { display = fmt(v) + '%'; color = col.key === 'winPct' ? (v > 50 ? '#00ff88' : '#ff4444') : '#e0e0e0'; }
      else if (['avgLG', 'avgDays'].includes(col.key)) { display = fmt(v, 0); color = '#e0e0e0'; }
      else { display = String(v); color = '#e0e0e0'; }
      return <StaticCell display={display} color={color} />;
    }

    if (col.computed) {
      let display = '', color = '#c0c0c0';
      if (['net', 'lgNet'].includes(col.key)) { display = fmt(v) + '%'; color = colorVal(v); }
      else if (['ratio', 'lgRatio'].includes(col.key)) { display = fmt(v); }
      else if (['winPct', 'lossPct'].includes(col.key)) { display = fmt(v) + '%'; color = col.key === 'winPct' ? (v > 50 ? '#00ff88' : '#ff4444') : '#c0c0c0'; }
      return <StaticCell display={display} color={color} />;
    }

    if (col.key === 'date') return <EditableCell value={v} display={v} color="#e0e0e0" onSave={(val) => updateField(row.id, col.key, val)} type="text" align="left" />;
    if (['avgGain', 'avgLoss', 'lgGain', 'lgLoss'].includes(col.key)) {
      return <EditableCell value={v} display={fmt(v) + '%'} color={colorVal(v)} onSave={(val) => updateField(row.id, col.key, val)} type="number" />;
    }
    return <EditableCell value={v} display={v} color="#c0c0c0" onSave={(val) => updateField(row.id, col.key, val)} type="number" />;
  };

  return (
    <>
      {/* Summary Header */}
      {summary && (
        <div style={{ padding: '12px 20px', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { label: 'Batting Average', value: fmt(summary.battingAvg) + '%' },
            { label: 'Average Gain', value: fmt(summary.avgGain) + '%' },
            { label: 'Average Loss', value: fmt(summary.avgLoss) + '%' },
            { label: 'Win/Loss Ratio', value: fmt(summary.ratio) },
            { label: 'Adj W/L Ratio', value: fmt(summary.adjustedWLR) },
          ].map((m) => (
            <div key={m.label} style={{ background: '#12122a', border: '1px solid #2a2a4a', borderRadius: 6, padding: '8px 16px', minWidth: 140 }}>
              <div style={{ fontSize: 10, color: '#7777aa', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{m.label}</div>
              <div style={{ fontSize: 16, color: '#e0e0e0', fontWeight: 700 }}>{m.value}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 1200 }}>
          <colgroup>
            {journalCols.map((c) => <col key={c.key} style={{ width: c.width }} />)}
            <col style={{ width: 36 }} />
          </colgroup>
          <thead>
            <tr>
              {journalCols.map((col, i) => (
                <th key={col.key} style={{ padding: '8px 6px', textAlign: col.align || 'right', color: '#7777aa', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, borderBottom: '2px solid #2a2a4a', borderRight: i < journalCols.length - 1 ? '1px solid #1a1a35' : 'none', background: '#10102a', whiteSpace: 'nowrap', userSelect: 'none' }}>
                  {col.label}
                </th>
              ))}
              <th style={{ borderBottom: '2px solid #2a2a4a', background: '#10102a' }} />
            </tr>
          </thead>
          <tbody>
            {computed.map((row) => (
              <tr key={row.id} onMouseEnter={() => setHoveredRow(row.id)} onMouseLeave={() => setHoveredRow(null)}
                style={{ background: hoveredRow === row.id ? '#1a1a3a' : 'transparent', transition: 'background 0.15s' }}>
                {journalCols.map((col, i) => (
                  <td key={col.key} style={{ padding: '6px 4px', borderBottom: '1px solid #1a1a30', borderRight: i < journalCols.length - 1 ? '1px solid #1a1a30' : 'none', verticalAlign: 'middle', lineHeight: '20px' }}>
                    {renderJournalCell(row, col, false)}
                  </td>
                ))}
                <td style={{ padding: '6px 4px', borderBottom: '1px solid #1a1a30', textAlign: 'center' }}>
                  <button onClick={() => deleteRow(row.id)} title="Delete" style={{ background: 'none', border: 'none', color: '#553333', cursor: 'pointer', fontSize: 14, padding: '0 4px' }}
                    onMouseEnter={(e) => (e.target.style.color = '#ff4444')}
                    onMouseLeave={(e) => (e.target.style.color = '#553333')}>x</button>
                </td>
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
                <td style={{ borderTop: '2px solid #2a2a4a' }} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <div style={{ padding: '12px 20px' }}>
        <button onClick={addTrade}
          style={{ background: '#1a1a3a', color: '#7777aa', border: '1px dashed #2a2a4a', borderRadius: 4, padding: '8px 20px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, letterSpacing: 0.5 }}
          onMouseEnter={(e) => { e.target.style.borderColor = '#00ff88'; e.target.style.color = '#00ff88'; }}
          onMouseLeave={(e) => { e.target.style.borderColor = '#2a2a4a'; e.target.style.color = '#7777aa'; }}>
          + Add Trade
        </button>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3: DRMA
// ═══════════════════════════════════════════════════════════════════════════════

function makeDRMARows() {
  const preData = {
    '0-2%': { gains: 37, losses: 44 },
    '2-4%': { gains: 9, losses: 38 },
    '4-6%': { gains: 8, losses: 11 },
    '6-8%': { gains: 11, losses: 5 },
    '8-10%': { gains: 8, losses: 0 },
    '10-12%': { gains: 5, losses: 2 },
    '12-14%': { gains: 2, losses: 1 },
    '14-16%': { gains: 3, losses: 3 },
    '16-18%': { gains: 2, losses: 0 },
    '18-20%': { gains: 1, losses: 0 },
    '20-22%': { gains: 1, losses: 0 },
    '22-24%': { gains: 1, losses: 0 },
    '24-26%': { gains: 0, losses: 0 },
    '26-28%': { gains: 2, losses: 1 },
    '28-30%': { gains: 1, losses: 0 },
  };
  const rows = [];
  let id = 1;
  for (let i = 0; i <= 72; i += 2) {
    const label = `${i}-${i + 2}%`;
    const pre = preData[label];
    rows.push({ id: id++, range: label, gains: pre ? pre.gains : 0, losses: pre ? pre.losses : 0 });
  }
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

function DRMATab() {
  const [rows, setRows] = useState(makeDRMARows);
  const [hoveredRow, setHoveredRow] = useState(null);
  const [showRefill, setShowRefill] = useState(false);
  const [refillText, setRefillText] = useState('');
  const [capInput, setCapInput] = useState('');
  const [showCap, setShowCap] = useState(false);
  const [moveInput, setMoveInput] = useState('');
  const [showMove, setShowMove] = useState(false);

  const updateField = useCallback((id, field, value) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }, []);

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
    const wins = totalGains;
    const losses = totalLosses;
    const trades = totalTrades;
    const battingAvg = trades > 0 ? (wins / trades) * 100 : 0;
    // Weighted average gain/loss
    let wGain = 0, wLoss = 0;
    rows.forEach((r) => {
      const mid = parseFloat(r.range) + 1;
      wGain += r.gains * mid;
      wLoss += r.losses * mid;
    });
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
    newRows.forEach((r) => { r.gains = 0; r.losses = 0; });
    lines.forEach((v) => {
      const abs = Math.abs(v);
      const bucket = Math.floor(abs / 2) * 2;
      const row = newRows.find((r) => parseFloat(r.range) === bucket);
      if (row) { if (v >= 0) row.gains++; else row.losses++; }
    });
    setRows(newRows);
    setShowRefill(false);
    setRefillText('');
  }, [refillText]);

  const handleCapLosses = useCallback(() => {
    const cap = parseFloat(capInput);
    if (isNaN(cap) || cap <= 0) return;
    const capBucket = Math.floor(cap / 2) * 2;
    setRows((prev) => {
      const next = prev.map((r) => ({ ...r }));
      let overflow = 0;
      next.forEach((r) => {
        const lo = parseFloat(r.range);
        if (lo > capBucket) { overflow += r.losses; r.losses = 0; }
      });
      const target = next.find((r) => parseFloat(r.range) === capBucket);
      if (target) target.losses += overflow;
      return next;
    });
    setShowCap(false);
    setCapInput('');
  }, [capInput]);

  const handleMoveLosses = useCallback(() => {
    const offset = parseFloat(moveInput);
    if (isNaN(offset)) return;
    const buckets = Math.round(offset / 2);
    setRows((prev) => {
      const next = prev.map((r) => ({ ...r, losses: 0 }));
      prev.forEach((r) => {
        if (r.losses > 0) {
          const lo = parseFloat(r.range);
          const newLo = lo + buckets * 2;
          const target = next.find((nr) => parseFloat(nr.range) === newLo);
          if (target) target.losses += r.losses;
        }
      });
      return next;
    });
    setShowMove(false);
    setMoveInput('');
  }, [moveInput]);

  const actionBtnStyle = { background: 'transparent', color: '#9999cc', border: '1px solid #3a3a6a', borderRadius: 4, padding: '6px 14px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, letterSpacing: 0.5 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: 8, padding: '12px 20px', flexWrap: 'wrap' }}>
        <button style={actionBtnStyle} onClick={() => setShowRefill(true)}
          onMouseEnter={(e) => { e.target.style.borderColor = '#7777cc'; e.target.style.color = '#ccccff'; }}
          onMouseLeave={(e) => { e.target.style.borderColor = '#3a3a6a'; e.target.style.color = '#9999cc'; }}>
          Refill Data
        </button>
        <button style={actionBtnStyle} onClick={() => setRows(makeDRMARows())}
          onMouseEnter={(e) => { e.target.style.borderColor = '#7777cc'; e.target.style.color = '#ccccff'; }}
          onMouseLeave={(e) => { e.target.style.borderColor = '#3a3a6a'; e.target.style.color = '#9999cc'; }}>
          Clear
        </button>
        <button style={actionBtnStyle} onClick={() => setShowCap(true)}
          onMouseEnter={(e) => { e.target.style.borderColor = '#7777cc'; e.target.style.color = '#ccccff'; }}
          onMouseLeave={(e) => { e.target.style.borderColor = '#3a3a6a'; e.target.style.color = '#9999cc'; }}>
          Cap Losses
        </button>
        <button style={actionBtnStyle} onClick={() => setShowMove(true)}
          onMouseEnter={(e) => { e.target.style.borderColor = '#7777cc'; e.target.style.color = '#ccccff'; }}
          onMouseLeave={(e) => { e.target.style.borderColor = '#3a3a6a'; e.target.style.color = '#9999cc'; }}>
          Move Losses
        </button>
      </div>

      {/* Modals */}
      {showRefill && (
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
      )}
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
        {/* Left Side */}
        <div style={{ flex: '0 0 55%', paddingRight: 16 }}>
          {/* Summary Card */}
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

          {/* Charts 2x2 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ background: '#12122a', border: '1px solid #2a2a4a', borderRadius: 6, padding: '12px 8px 4px' }}>
              <div style={{ fontSize: 10, color: '#7777aa', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8, paddingLeft: 8 }}>Gains & Losses</div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={chartGainsLosses} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
                  <XAxis dataKey="range" tick={{ fontSize: 8, fill: '#555' }} interval={1} />
                  <YAxis tick={{ fontSize: 8, fill: '#555' }} />
                  <Tooltip contentStyle={{ background: '#1a1a3a', border: '1px solid #2a2a4a', fontSize: 11 }} />
                  <Bar dataKey="gains" fill="#00ff88" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="losses" fill="#ff4444" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ background: '#12122a', border: '1px solid #2a2a4a', borderRadius: 6, padding: '12px 8px 4px' }}>
              <div style={{ fontSize: 10, color: '#7777aa', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8, paddingLeft: 8 }}>DRMA Curve</div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={chartDRMA} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
                  <XAxis dataKey="range" tick={{ fontSize: 8, fill: '#555' }} interval={1} />
                  <YAxis tick={{ fontSize: 8, fill: '#555' }} />
                  <Tooltip contentStyle={{ background: '#1a1a3a', border: '1px solid #2a2a4a', fontSize: 11 }} />
                  <Bar dataKey="drma" radius={[2, 2, 0, 0]}>
                    {chartDRMA.map((entry, i) => (
                      <Cell key={i} fill={entry.drma >= 0 ? '#6666cc' : '#cc6666'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ background: '#12122a', border: '1px solid #2a2a4a', borderRadius: 6, padding: '12px 8px 4px' }}>
              <div style={{ fontSize: 10, color: '#7777aa', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8, paddingLeft: 8 }}>Gain Magnitude</div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={chartGainMag} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
                  <XAxis dataKey="range" tick={{ fontSize: 8, fill: '#555' }} interval={1} />
                  <YAxis tick={{ fontSize: 8, fill: '#555' }} />
                  <Tooltip contentStyle={{ background: '#1a1a3a', border: '1px solid #2a2a4a', fontSize: 11 }} />
                  <Bar dataKey="count" fill="#00ff88" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ background: '#12122a', border: '1px solid #2a2a4a', borderRadius: 6, padding: '12px 8px 4px' }}>
              <div style={{ fontSize: 10, color: '#7777aa', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8, paddingLeft: 8 }}>Loss Magnitude</div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={chartLossMag} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
                  <XAxis dataKey="range" tick={{ fontSize: 8, fill: '#555' }} interval={1} />
                  <YAxis tick={{ fontSize: 8, fill: '#555' }} />
                  <Tooltip contentStyle={{ background: '#1a1a3a', border: '1px solid #2a2a4a', fontSize: 11 }} />
                  <Bar dataKey="count" fill="#ff4444" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Right Side — Table */}
        <div style={{ flex: '0 0 45%', overflowY: 'auto', maxHeight: 600 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {drmaCols.map((col, i) => (
                  <th key={col.key} style={{ padding: '6px 4px', textAlign: col.align || 'right', color: '#7777aa', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '2px solid #2a2a4a', borderRight: i < drmaCols.length - 1 ? '1px solid #1a1a35' : 'none', background: '#10102a', whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 1 }}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {computed.map((row) => (
                <tr key={row.id} onMouseEnter={() => setHoveredRow(row.id)} onMouseLeave={() => setHoveredRow(null)}
                  style={{ background: hoveredRow === row.id ? '#1a1a3a' : 'transparent', transition: 'background 0.15s' }}>
                  {drmaCols.map((col, i) => {
                    let content;
                    if (col.key === 'range') {
                      content = <StaticCell display={row.range} color="#e0e0e0" align="left" />;
                    } else if (col.key === 'gains') {
                      content = <EditableCell value={row.gains} display={row.gains} color="#00ff88" onSave={(v) => updateField(row.id, 'gains', v)} type="number" />;
                    } else if (col.key === 'losses') {
                      content = <EditableCell value={row.losses} display={row.losses} color="#ff4444" onSave={(v) => updateField(row.id, 'losses', v)} type="number" />;
                    } else if (col.key === 'gainPct') {
                      content = <StaticCell display={row.gains > 0 || row.losses > 0 ? fmt(row.gainPct) + '%' : '—'} color="#c0c0c0" />;
                    } else if (col.key === 'lossPct') {
                      content = <StaticCell display={row.gains > 0 || row.losses > 0 ? fmt(row.lossPct) + '%' : '—'} color="#c0c0c0" />;
                    } else if (col.key === 'net') {
                      const hasData = row.gains > 0 || row.losses > 0;
                      content = <StaticCell display={hasData ? fmt(row.net) + '%' : '—'} color={hasData ? colorVal(row.net) : '#555'} />;
                    } else if (col.key === 'drma') {
                      const hasData = row.gains > 0 || row.losses > 0;
                      content = <StaticCell display={hasData ? fmt(row.drma) : '—'} color={hasData ? colorVal(row.drma) : '#555'} />;
                    }
                    return (
                      <td key={col.key} style={{ padding: '4px 4px', borderBottom: '1px solid #1a1a30', borderRight: i < drmaCols.length - 1 ? '1px solid #1a1a30' : 'none', verticalAlign: 'middle', lineHeight: '18px' }}>
                        {content}
                      </td>
                    );
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
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function StockPortfolioTracker() {
  const [activeTab, setActiveTab] = useState('portfolio');

  return (
    <div style={{ background: '#0d0d1a', minHeight: '100vh', color: '#c0c0c0', fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Courier New', monospace", fontSize: 12 }}>
      {/* Top Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px 0', background: '#0d0d1a' }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#ffffff', letterSpacing: 1 }}>TRADING DASHBOARD</span>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, padding: '12px 20px 0', borderBottom: '1px solid #2a2a4a' }}>
        <TabButton label="Portfolio" active={activeTab === 'portfolio'} onClick={() => setActiveTab('portfolio')} />
        <TabButton label="Trading Journal" active={activeTab === 'journal'} onClick={() => setActiveTab('journal')} />
        <TabButton label="DRMA" active={activeTab === 'drma'} onClick={() => setActiveTab('drma')} />
      </div>

      {/* Tab Content */}
      {activeTab === 'portfolio' && <PortfolioTab />}
      {activeTab === 'journal' && <JournalTab />}
      {activeTab === 'drma' && <DRMATab />}
    </div>
  );
}
