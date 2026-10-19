// Habari: the in-game press — Forbz Bongo, Mwanabongo, Wasafa TV, TBX Taifa, EA Vision and
// The Bongo Daily, all reporting on what players actually do. Plus the breaking-news ticker.
import { useEffect, useState } from 'react';
import { NEWS_OUTLETS, NEWS_CATS, outletById } from '@shared/world.js';
import { useStore } from '../../store.js';
import { api } from '../../api.js';
import { AppHead } from '../Phone.jsx';
import { L } from '../../i18n.js';

export const ago = (t) => {
  const m = Math.floor((Date.now() - t) / 60_000);
  if (m < 1) return L('sasa hivi', 'just now');
  if (m < 60) return L(`dk ${m}`, `${m}m`);
  const h = Math.floor(m / 60);
  if (h < 24) return L(`saa ${h}`, `${h}h`);
  return L(`siku ${Math.floor(h / 24)}`, `${Math.floor(h / 24)}d`);
};

/** One story card. Tapping the name opens their profile. */
export function NewsClip({ n, big }) {
  const o = outletById[n.outlet] || NEWS_OUTLETS[0];
  const c = NEWS_CATS[n.cat];
  return (
    <div className={`news-card ${big ? 'lead' : ''}`} style={{ '--o': o.color, '--oa': o.accent }}>
      <div className="nc-top">
        <span className="nc-outlet">{o.emoji} {o.name}</span>
        {c && <span className="nc-cat">{c.emoji} {L(c.name[0], c.name[1])}</span>}
        {n.big && <span className="nc-breaking">{L('HABARI KUBWA', 'BREAKING')}</span>}
        <small className="nc-ago">{ago(n.created_at)}</small>
      </div>
      <b className="nc-title">{L(n.title[0], n.title[1])}</b>
      {n.body && <div className="nc-body">{L(n.body[0], n.body[1])}</div>}
      {n.username && <button className="nc-who" onClick={() => useStore.setState({ sheet: { type: 'player', id: n.username } })}>@{n.username} →</button>}
    </div>
  );
}

export function Habari({ back }) {
  const [outlet, setOutlet] = useState('all');
  const [cat, setCat] = useState('all');
  const [list, setList] = useState(null);
  useEffect(() => {
    let live = true;
    const load = () => api(`/headlines${outlet === 'all' ? '' : `?outlet=${outlet}`}`).then((r) => live && setList(r.stories)).catch(() => {});
    load();
    const t = setInterval(load, 30_000);
    return () => { live = false; clearInterval(t); };
  }, [outlet]);
  const o = outletById[outlet];
  const shown = (list || []).filter((n) => cat === 'all' || n.cat === cat);
  return (
    <>
      <AppHead title={L('Habari · Vyombo vya habari', 'News · Bongo media')} onBack={back} />
      <div className="app-body">
        <div className="news-outlets">
          <button className={outlet === 'all' ? 'on' : ''} onClick={() => setOutlet('all')} style={{ '--o': '#111827' }}><span>🗞️</span>{L('Zote', 'All')}</button>
          {NEWS_OUTLETS.map((x) => <button key={x.id} className={outlet === x.id ? 'on' : ''} onClick={() => setOutlet(x.id)} style={{ '--o': x.color }}><span>{x.emoji}</span>{x.name}</button>)}
        </div>
        {o && <div className="news-mast" style={{ '--o': o.color, '--oa': o.accent }}><b>{o.emoji} {o.name}</b><small>{L(o.tag[0], o.tag[1])}</small></div>}
        <div className="chips" style={{ margin: '8px 0', flexWrap: 'nowrap', overflowX: 'auto' }}>
          <button className={`chip ${cat === 'all' ? 'on' : ''}`} onClick={() => setCat('all')}>{L('Kila kitu', 'Everything')}</button>
          {Object.entries(NEWS_CATS).map(([k, c]) => <button key={k} className={`chip ${cat === k ? 'on' : ''}`} onClick={() => setCat(k)}>{c.emoji} {L(c.name[0], c.name[1])}</button>)}
        </div>
        {!list && <div className="small muted" style={{ padding: 12 }}>{L('Inapakia…', 'Loading…')}</div>}
        {list && !shown.length && <div className="box small muted">{L('Hakuna habari bado. Fanya kitu kikubwa — utaandikwa!', 'No stories yet. Do something big — you’ll make the papers!')}</div>}
        {shown.map((n, i) => <NewsClip key={n.id} n={n} big={i === 0 && cat === 'all'} />)}
        <div className="hint">{L('Habari zinaandikwa kutokana na unachofanya mjini: utajiri, uhalifu, mapenzi, biashara na orodha ya matajiri.', 'Stories are written from what happens in town: fortunes, crime, love, business and the rich list.')}</div>
      </div>
    </>
  );
}

/** Slim "breaking news" banner when a story lands. */
export function NewsTicker() {
  const n = useStore((s) => s.newsFlash);
  const tab = useStore((s) => s.tab);
  useEffect(() => {
    if (!n) return;
    const t = setTimeout(() => useStore.setState({ newsFlash: null }), n.big ? 9000 : 6000);
    return () => clearTimeout(t);
  }, [n]);
  if (!n || tab === 'shop') return null;
  const o = outletById[n.outlet] || NEWS_OUTLETS[0];
  return (
    <button className={`news-ticker ${n.big ? 'big' : ''}`} style={{ '--o': o.color }} onClick={() => { useStore.setState({ newsFlash: null }); useStore.getState().openPhone('habari'); }}>
      <span className="nt-tag">{n.big ? L('HABARI KUBWA', 'BREAKING') : `${o.emoji} ${o.name}`}</span>
      <span className="nt-text">{L(n.title[0], n.title[1])}</span>
    </button>
  );
}
