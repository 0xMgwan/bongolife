// Anasa (Luxury): buy yachts and private jets, board them from anywhere, invite friends aboard,
// and sail/fly everyone aboard to another city.
import { useEffect, useState } from 'react';
import { fmtTsh, fmtShort, luxuryById, CITIES } from '@shared/world.js';
import { useStore } from '../../store.js';
import { api } from '../../api.js';
import { boardLuxury, setInside, local } from '../../net.js';
import { AppHead } from '../Phone.jsx';
import { ask } from '../Confirm.jsx';
import { L } from '../../i18n.js';
import { sfx } from '../../audio.js';

const KINDS = [['yacht', '🛥️', ['Yacht', 'Yachts']], ['jet', '🛩️', ['Jet binafsi', 'Private jets']]];
const cityName = (id) => (id === 'dar' ? 'Dar es Salaam' : CITIES.find((c) => c.id === id)?.name || id);

export function Anasa({ back }) {
  const me = useStore((s) => s.me);
  const run = useStore((s) => s.run);
  const [d, setD] = useState(null);
  const [kind, setKind] = useState('yacht');
  const [color, setColor] = useState({});
  const load = () => api('/luxury').then(setD).catch(() => {});
  useEffect(() => { load(); }, []);
  if (!d) return (<><AppHead title={L('Anasa', 'Luxury')} onBack={back} /><div className="app-body"><div className="small muted" style={{ padding: 12 }}>{L('Inapakia…', 'Loading…')}</div></div></>);
  const mine = d.mine.filter((m) => m.kind === kind);
  const owned = new Set(d.mine.map((m) => m.model));
  const buy = async (m) => {
    if (!(await ask({ icon: m.emoji, title: L(`Nunua ${m.name}?`, `Buy the ${m.name}?`), text: `${fmtTsh(m.price)} · ${L(`wageni ${m.guests}`, `${m.guests} guests`)}`, ok: L('Nunua', 'Buy') }))) return;
    const r = await run('/luxury/buy', { method: 'POST', body: { model: m.id, color: color[m.id] || d.colors[0] } });
    if (r) { setD(r); sfx('levelup'); useStore.getState().toast(L(`${m.emoji} ${m.name} ni yako! Panda sasa.`, `${m.emoji} The ${m.name} is yours! Step aboard.`)); }
  };
  const sell = async (b) => {
    const m = luxuryById[b.model];
    if (!(await ask({ icon: '🏷️', title: L(`Uza ${b.name}?`, `Sell ${b.name}?`), text: L(`Utapata ${fmtTsh(Math.round(m.price * d.resale))}.`, `You'll get ${fmtTsh(Math.round(m.price * d.resale))}.`), ok: L('Uza', 'Sell'), danger: true }))) return;
    const r = await run(`/luxury/${b.id}/sell`, { method: 'POST' });
    if (r) { setD(r); sfx('cash'); }
  };
  return (
    <>
      <AppHead title={L('Anasa · Yacht na Jet', 'Luxury · Yachts & Jets')} onBack={back} />
      <div className="app-body">
        <div className="lux-hero">
          <b>{L('Maisha ya kifahari', 'Live large')}</b>
          <small>{L('Panda yacht au jet yako popote ulipo, waalike marafiki, safirini pamoja Zanzibar na Arusha.', 'Board your yacht or jet from anywhere, invite friends, and travel together to Zanzibar and Arusha.')}</small>
        </div>
        {d.invitedTo.length > 0 && (
          <>
            <div className="section-t">{L('UMEALIKWA', 'YOU’RE INVITED')}</div>
            {d.invitedTo.map((i) => (
              <div key={`${i.hostId}${i.kind}`} className="inv-row">
                <span className="em">{i.kind === 'jet' ? '🛩️' : '🛥️'}</span>
                <div className="grow"><b>{i.name}</b><small>@{i.host}</small></div>
                <button className="btn btn-green btn-sm" onClick={() => boardLuxury(i.kind, i.hostId)}>{L('Panda', 'Board')}</button>
              </div>
            ))}
          </>
        )}
        <div className="chips inv-tabs" style={{ margin: '10px 0' }}>
          {KINDS.map(([k, e, n]) => <button key={k} className={`chip ${kind === k ? 'on' : ''}`} onClick={() => setKind(k)}>{e} {L(n[0], n[1])}</button>)}
        </div>
        {mine.length > 0 && <div className="section-t">{L('ZAKO', 'YOURS')}</div>}
        {mine.map((b) => {
          const m = luxuryById[b.model];
          return (
            <div key={b.id} className="lux-card own" style={{ '--lux': b.color }}>
              <div className="lux-top"><span className="lux-em">{m.emoji}</span><div className="grow"><b>{b.name}</b><small>{m.name} · {L(`wageni ${m.guests}`, `${m.guests} guests`)}</small></div></div>
              <div className="row" style={{ gap: 6, marginTop: 8 }}>
                <button className="btn btn-green grow" onClick={() => boardLuxury(kind, me.id)}>{kind === 'jet' ? '🛫' : '⚓'} {L('Panda sasa', 'Board now')}</button>
                <button className="btn btn-ghost btn-sm" onClick={() => sell(b)}>{L('Uza', 'Sell')}</button>
              </div>
            </div>
          );
        })}
        <div className="section-t">{L('DUKANI', 'FOR SALE')}</div>
        {d.catalog.filter((m) => m.kind === kind).map((m) => (
          <div key={m.id} className="lux-card" style={{ '--lux': color[m.id] || d.colors[0] }}>
            <div className="lux-top">
              <span className="lux-em">{m.emoji}</span>
              <div className="grow"><b>{m.name}</b><small>{L(m.blurb[0], m.blurb[1])}</small></div>
            </div>
            <div className="lux-swatches">
              {d.colors.map((c) => <button key={c} className={(color[m.id] || d.colors[0]) === c ? 'on' : ''} style={{ background: c }} onClick={() => setColor({ ...color, [m.id]: c })} aria-label={c} />)}
            </div>
            <div className="row" style={{ gap: 8, marginTop: 8, alignItems: 'center' }}>
              <b className="grow">{fmtTsh(m.price)}</b>
              <button className="btn btn-green btn-sm" disabled={owned.has(m.id) || me.money < m.price} onClick={() => buy(m)}>{owned.has(m.id) ? L('Unayo', 'Owned') : L('Nunua', 'Buy')}</button>
            </div>
          </div>
        ))}
        <div className="hint">{L(`Ukiuza unapata ${Math.round(d.resale * 100)}% ya bei.`, `Resale gets ${Math.round(d.resale * 100)}% of the price.`)}</div>
      </div>
    </>
  );
}

/** In the dock while aboard: invite friends, sail/fly somewhere (owner), get off. */
export function LuxControls({ kind }) {
  const me = useStore((s) => s.me);
  const boat = useStore((s) => s.boat);
  const host = useStore((s) => s.insideHost);
  const run = useStore((s) => s.run);
  const [pop, setPop] = useState(null);
  const [friends, setFriends] = useState([]);
  const owner = host === me.id;
  const here = (() => {
    const x = local.x;
    return CITIES.find((c) => Math.abs(x - c.center[0]) <= c.half)?.id || 'dar';
  })();
  const ports = { yacht: ['dar', 'znz', 'pwa'], jet: ['dar', 'znz', 'aru', 'mwz'] }[kind].filter((c) => c !== here);
  const inviteOpen = async () => {
    const list = await api('/contacts').catch(() => []);
    setFriends(list.filter((c) => c.mutual));
    setPop(pop === 'invite' ? null : 'invite');
  };
  const invite = async (u) => {
    const r = await run('/luxury/invite', { method: 'POST', body: { to: u, kind } });
    if (r) useStore.getState().toast(L(`📨 Mwaliko umetumwa kwa @${r.to}`, `📨 Invite sent to @${r.to}`));
  };
  const go = async (city) => {
    setPop(null);
    const r = await run('/luxury/travel', { method: 'POST', body: { kind, city } });
    if (r) sfx(kind === 'jet' ? 'levelup' : 'pop');
  };
  return (
    <div className="lux-dock">
      <div className="pd-chips">
        {owner && <button className={pop === 'invite' ? 'sel' : ''} onClick={inviteOpen}><span>📨</span>{L('Alika', 'Invite')}</button>}
        {owner && <button className={pop === 'go' ? 'sel' : ''} onClick={() => setPop(pop === 'go' ? null : 'go')}><span>{kind === 'jet' ? '🛫' : '🧭'}</span>{kind === 'jet' ? L('Ruka kwenda…', 'Fly to…') : L('Safiri kwenda…', 'Sail to…')}</button>}
        {!owner && boat?.hostName && <button onClick={() => useStore.setState({ sheet: { type: 'player', id: boat.hostName } })}><span>👑</span>@{boat.hostName}</button>}
        <button onClick={() => { sfx('close'); setInside(null); }}><span>🚪</span>{L('Shuka', 'Get off')}</button>
      </div>
      {pop === 'invite' && (
        <div className="lux-pop">
          {friends.length ? friends.map((f) => <button key={f.username} onClick={() => invite(f.username)}>{f.online ? '🟢' : '⚪'} @{f.username}</button>) : <small className="muted">{L('Ongeza marafiki kwanza (Watu).', 'Add some friends first (People).')}</small>}
        </div>
      )}
      {pop === 'go' && (
        <div className="lux-pop">
          {ports.map((c) => <button key={c} onClick={() => go(c)}>{kind === 'jet' ? '🛬' : '⚓'} {cityName(c)} <small>{L('— wote walio ndani wanakuja', '— everyone aboard comes')}</small></button>)}
        </div>
      )}
    </div>
  );
}

/** "@x invited you aboard" banner. */
export function LuxInvite() {
  const inv = useStore((s) => s.luxInvite);
  useEffect(() => {
    if (!inv) return;
    const t = setTimeout(() => useStore.setState({ luxInvite: null }), 25_000);
    return () => clearTimeout(t);
  }, [inv]);
  if (!inv) return null;
  return (
    <div className="watch-invite card">
      <span>{L(inv.text[0], inv.text[1])}</span>
      <div className="row" style={{ gap: 6 }}>
        <button className="btn btn-green btn-xs" onClick={() => boardLuxury(inv.kind, inv.hostId)}>{L('Panda', 'Board')}</button>
        <button className="btn btn-ghost btn-xs" onClick={() => useStore.setState({ luxInvite: null })}>✕</button>
      </div>
    </div>
  );
}

void fmtShort;
