// A company's till: every sale, wage, deposit, withdrawal, rent payment and trading day.
import { useEffect, useState } from 'react';
import { fmtShort, fmtTsh } from '@shared/world.js';
import { api } from '../../api.js';
import { L } from '../../i18n.js';

const KIND = {
  sale: ['🛍️', 'Mauzo', 'Sale'], wage: ['💼', 'Mshahara', 'Wage'], output: ['🧑🏾‍🔧', 'Kazi ya timu', 'Team work'],
  deposit: ['⬇️', 'Mtaji', 'Deposit'], withdraw: ['⬆️', 'Umetoa', 'Withdrawal'], rent: ['🏪', 'Kodi ya duka', 'Shop rent'],
  day: ['📅', 'Siku ya biashara', 'Trading day'], marketing: ['📣', 'Matangazo', 'Marketing'],
};
const when = (t) => new Date(t).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function Till({ companyId }) {
  const [rows, setRows] = useState(null);
  const [week, setWeek] = useState(null);
  const [more, setMore] = useState(true);
  const [filter, setFilter] = useState('all');
  const load = async (before = null) => {
    const r = await api(`/companies/${companyId}/till?limit=40${before ? `&before=${before}` : ''}`).catch(() => ({ rows: [] }));
    setRows((prev) => (before ? [...(prev || []), ...r.rows] : r.rows));
    if (r.week) setWeek(r.week);
    setMore(r.rows.length === 40);
  };
  useEffect(() => { load(); }, [companyId]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = (rows || []).filter((r) => filter === 'all' || (filter === 'in' ? r.amount > 0 : r.amount < 0));
  return (
    <>
      <div className="section-t">{L('TILL · HISTORIA YA PESA', 'TILL · MONEY HISTORY')}</div>
      <div className="co-box">
        {week && <div className="row between small"><span>{L('Siku 7:', 'Last 7 days:')} <b className="green">+{fmtShort(week.in)}</b> · <b className="red">−{fmtShort(week.out)}</b></span><span className="muted">{L('Halisi', 'Net')} <b>{fmtShort(week.in - week.out)}</b></span></div>}
        <div className="seg" style={{ margin: '8px 0' }}>
          {[['all', 'Zote', 'All'], ['in', 'Zilizoingia', 'In'], ['out', 'Zilizotoka', 'Out']].map(([k, sw, en]) => <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{L(sw, en)}</button>)}
        </div>
        {rows === null && <small className="muted">{L('Inapakia…', 'Loading…')}</small>}
        {rows && !shown.length && <small className="muted">{L('Bado hakuna kitu kwenye till.', 'Nothing in the till yet.')}</small>}
        {shown.map((r) => {
          const k = KIND[r.kind] || ['•', r.kind, r.kind];
          return (
            <div key={r.id} className="till-row">
              <span className="tr-ic">{k[0]}</span>
              <span className="grow"><b>{L(k[1], k[2])}</b>{r.memo && <small>{r.memo}</small>}<small className="muted">{when(r.at)}</small></span>
              <b className={r.amount > 0 ? 'green' : r.amount < 0 ? 'red' : 'muted'}>{r.amount > 0 ? '+' : r.amount < 0 ? '−' : ''}{fmtTsh(Math.abs(r.amount)).replace('TSh ', '')}</b>
            </div>
          );
        })}
        {rows && more && <button className="btn btn-ghost btn-sm btn-block" style={{ marginTop: 8 }} onClick={() => load(rows[rows.length - 1].id)}>{L('Zaidi', 'Load more')}</button>}
      </div>
    </>
  );
}
