import { useEffect, useState } from 'react';
import { DATE_SPOTS, LOVE_GIFTS, LOVE, LOVE_STATUS, ambitionById, placeById, fmtTsh, fmtShort } from '@shared/world.js';
import { useStore } from '../../store.js';
import { api } from '../../api.js';
import { AppHead } from '../Phone.jsx';
import { AvatarPreview } from '../Creator.jsx';
import { avatarEmoji } from '../../three/Avatar.jsx';
import { ask } from '../Confirm.jsx';
import { L, pick, loc } from '../../i18n.js';
import { sfx } from '../../audio.js';

function Setup({ s, onSaved, onCancel }) {
  const run = useStore((st) => st.run);
  const [f, setF] = useState({ open: true, adult: s.profile.adult, bio: s.profile.bio, looking: s.profile.looking });
  const save = async () => {
    const r = await run('/love/profile', { method: 'POST', body: f });
    if (r) { sfx('pop'); onSaved(r); }
  };
  return (
    <div className="love-setup">
      <div className="love-hero">💘</div>
      <h3>{L('Penzi — uchumba wa Bongo Life', 'Penzi — dating in Bongo Life')}</h3>
      <p className="small muted">{L('Kutana na wachezaji wengine, nendeni deti, pandisha mapenzi hadi harusi. Ni hiari: ni walio washa uchumba tu wanaonekana hapa.', 'Meet other players, go on dates, grow your bond all the way to a wedding. Opt-in only: just people who turned dating on appear here.')}</p>
      <div className="label">{L('Kuhusu wewe', 'About you')}</div>
      <textarea className="field" rows={3} maxLength={LOVE.bioMax} placeholder={L('mf. Napenda bahari, chipsi mayai na Bongo Flava 🌊', 'e.g. I love the ocean, chips mayai and Bongo Flava 🌊')} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} />
      <div className="label">{L('Unatafuta', 'Interested in')}</div>
      <div className="seg">
        {[['any', L('Wote', 'Everyone')], ['men', L('Wanaume', 'Men')], ['women', L('Wanawake', 'Women')]].map(([k, t]) => <button key={k} className={f.looking === k ? 'on' : ''} onClick={() => setF({ ...f, looking: k })}>{t}</button>)}
      </div>
      {!s.profile.adult && (
        <label className="love-check"><input type="checkbox" checked={f.adult} onChange={(e) => setF({ ...f, adult: e.target.checked })} /> {L('Nina umri wa miaka 18 au zaidi', "I'm 18 or older")}</label>
      )}
      <div className="hint">🛡️ {L('Usishiriki namba ya simu wala anwani. Unaweza kuzuia (🚫) au kuripoti mtu yeyote kwenye wasifu wake.', "Don't share your phone number or address. You can block (🚫) or report anyone from their profile.")}</div>
      <button className="btn btn-green btn-block" style={{ marginTop: 12 }} disabled={!f.adult} onClick={save}>💘 {L('Washa uchumba', 'Turn on dating')}</button>
      {onCancel && <button className="btn btn-ghost btn-block btn-sm" style={{ marginTop: 6 }} onClick={onCancel}>{L('Rudi', 'Back')}</button>}
    </div>
  );
}

function Discover({ s, reload }) {
  const run = useStore((st) => st.run);
  const [i, setI] = useState(0);
  const deck = s.discover || [];
  const card = deck[i];
  const swipe = async (kind) => {
    const r = await run('/love/swipe', { method: 'POST', body: { username: card.username, kind } });
    if (!r) return;
    sfx(kind === 'like' ? 'pop' : 'click');
    if (r.match) useStore.setState({ loveMatch: { with: r.with, rid: r.rid } });
    if (i + 1 >= deck.length) { setI(0); reload(); } else setI(i + 1);
  };
  if (!card) return <div className="box center small muted" style={{ padding: 24 }}>💤 {L('Hakuna wapya kwa sasa. Rudi baadaye — wachezaji wapya huwasha uchumba kila siku.', 'No one new right now. Check back later — new players turn dating on every day.')}</div>;
  const amb = card.amb && ambitionById[card.amb];
  return (
    <>
      {s.likesYou > 0 && <div className="love-likes">💘 {L(`Watu ${s.likesYou} wamekupenda — endelea kugundua!`, `${s.likesYou} people liked you — keep discovering!`)}</div>}
      <div className="love-card">
        <div className="lc-av"><AvatarPreview appearance={card.appearance} /></div>
        <div className="lc-info">
          <b>{card.name} {card.online && <i className="dot-on" />}</b>
          <small>@{card.username} · ⭐ {card.fame}{amb ? ` · ${amb.emoji} ${pick(amb.name)}` : ''}</small>
          {card.bio && <p>“{card.bio}”</p>}
        </div>
        <div className="lc-btns">
          <button className="pass" onClick={() => swipe('pass')} aria-label={L('Pita', 'Pass')}>✕</button>
          <button className="like" onClick={() => swipe('like')} aria-label={L('Penda', 'Like')}>❤️</button>
        </div>
      </div>
    </>
  );
}

function RelCard({ r, open, reload }) {
  const run = useStore((st) => st.run);
  const me = useStore((st) => st.me);
  const [panel, setPanel] = useState(null); // date | gift
  const post = async (path, body, ok) => {
    const res = await run(path, { method: 'POST', body });
    if (res) { sfx('pop'); if (ok) useStore.getState().toast(ok); reload(); }
    return res;
  };
  const st = LOVE_STATUS[r.status];
  return (
    <div className={`rel-card s-${r.status}`}>
      <div className="row" style={{ gap: 12, alignItems: 'center' }}>
        <span className="rel-av">{avatarEmoji(r.partner.appearance)}{r.partner.online && <i />}</span>
        <div className="grow">
          <b>@{r.partner.username}</b>
          <small>{pick(st)} · {r.dates} {L('deti', r.dates === 1 ? 'date' : 'dates')}</small>
        </div>
        <button className="btn btn-ghost btn-xs" onClick={() => open('dm', r.partner.username)}>💬</button>
      </div>
      <div className="rel-bar"><i style={{ width: `${r.affection}%` }} /></div>
      <div className="small muted">❤️ {L('Mapenzi', 'Affection')} {r.affection}/100{r.status === 'match' ? ` · ${L(`wapenzi kuanzia ${LOVE.coupleAt}`, `partners from ${LOVE.coupleAt}`)}` : r.status === 'couple' ? ` · ${L(`uchumba kuanzia ${LOVE.proposeAt}`, `propose from ${LOVE.proposeAt}`)}` : ''}</div>
      <div className="rel-acts">
        <button onClick={() => setPanel(panel === 'date' ? null : 'date')}>📅 {L('Deti', 'Date')}</button>
        <button onClick={() => setPanel(panel === 'gift' ? null : 'gift')}>🎁 {L('Zawadi', 'Gift')}</button>
        {r.canCouple && <button className="hot" onClick={() => post(`/love/${r.id}/ask-partner`, {}, L('❤️ Umeuliza — subiri jibu!', '❤️ Asked — waiting for an answer!'))}>❤️ {L('Uwe mpenzi wangu?', 'Be my partner?')}</button>}
        {r.canPropose && <button className="hot" disabled={me.money < LOVE.ringPrice} onClick={async () => { if (await ask({ icon: '💍', title: L(`Mchumbie @${r.partner.username}?`, `Propose to @${r.partner.username}?`), text: L(`Pete inagharimu ${fmtTsh(LOVE.ringPrice)} — inalipwa wakikubali.`, `The ring costs ${fmtTsh(LOVE.ringPrice)} — paid if they say yes.`), ok: L('Piga goti 💍', 'Get down on one knee 💍') })) post(`/love/${r.id}/propose`, {}, L('💍 Umeuliza swali kubwa…', '💍 You popped the question…')); }}>💍 {L('Chumbia', 'Propose')}</button>}
        {r.canWed && <button className="hot" disabled={me.money < LOVE.weddingPrice} onClick={async () => { if (await ask({ icon: '💒', title: L('Fanya harusi?', 'Hold the wedding?'), text: L(`Harusi inagharimu ${fmtTsh(LOVE.weddingPrice)}. Jiji zima litasikia! 🎉`, `The wedding costs ${fmtTsh(LOVE.weddingPrice)}. The whole city will hear about it! 🎉`), ok: L('Twende harusini 💒', "Let's get married 💒") })) post(`/love/${r.id}/wedding`, {}, L('💒 Hongera kwa ndoa!', '💒 Congratulations on your wedding!')); }}>💒 {L('Harusi', 'Wedding')}</button>}
      </div>
      {panel === 'date' && (
        <div className="rel-panel">
          <small className="muted">{r.nextDateIn ? L(`Deti inayofuata baada ya dk ${Math.ceil(r.nextDateIn / 60000)}`, `Next date in ${Math.ceil(r.nextDateIn / 60000)} min`) : L('Mwalike — mkikutana pale, anzisheni deti.', 'Invite them — when you’re both there, start the date.')}</small>
          {DATE_SPOTS.map((d) => (
            <button key={d.id} className="rel-opt" disabled={me.money < d.cost} onClick={() => { post(`/love/${r.id}/date-invite`, { spot: d.id }, L(`📅 Mwaliko umetumwa: ${d.name[0]}`, `📅 Invite sent: ${d.name[1]}`)); setPanel(null); }}>
              <span>{d.emoji}</span><span className="grow"><b>{pick(d.name)}</b><small>{loc(placeById[d.placeId])} · ❤️+{d.affection}</small></span><b>{fmtShort(d.cost)}</b>
            </button>
          ))}
        </div>
      )}
      {panel === 'gift' && (
        <div className="rel-panel">
          {LOVE_GIFTS.map((g) => (
            <button key={g.id} className="rel-opt" disabled={me.money < g.price} onClick={() => { post(`/love/${r.id}/gift`, { gift: g.id }, L(`${g.emoji} Zawadi imetumwa!`, `${g.emoji} Gift sent!`)); setPanel(null); }}>
              <span>{g.emoji}</span><span className="grow"><b>{pick(g.name)}</b><small>❤️+{g.affection}</small></span><b>{fmtShort(g.price)}</b>
            </button>
          ))}
        </div>
      )}
      <button className="rel-end" onClick={async () => { if (await ask({ icon: '💔', title: r.status === 'match' ? L('Ondoa match?', 'Unmatch?') : L('Achana?', 'Break up?'), ok: r.status === 'match' ? L('Ondoa', 'Unmatch') : L('Achana', 'Break up'), danger: true })) { await run(`/love/${r.id}/end`, { method: 'POST' }); reload(); } }}>{r.status === 'match' ? L('Ondoa match', 'Unmatch') : L('Achana', 'Break up')}</button>
    </div>
  );
}

/** Penzi: opt-in dating — discover, match, dates, gifts, partners, proposals, weddings. */
export function Penzi({ back, open }) {
  const [s, setS] = useState(null);
  const [tab, setTab] = useState('discover');
  const [editing, setEditing] = useState(false);
  const load = () => api('/love').then(setS).catch(() => {});
  useEffect(() => { load(); }, []);
  if (!s) return (<><AppHead title="Penzi" onBack={back} /><div className="app-body"><div className="small muted" style={{ padding: 12 }}>{L('Inapakia…', 'Loading…')}</div></div></>);
  const rels = s.relationships;
  if (!s.profile.open || editing) {
    return (
      <>
        <AppHead title="Penzi 💘" onBack={back} />
        <div className="app-body">
          <Setup s={s} onSaved={(r) => { setS(r); setEditing(false); }} onCancel={editing ? () => setEditing(false) : null} />
          {rels.length > 0 && !editing && <div className="hint center">{L('Uhusiano wako unaendelea hata uchumba ukiwa umezimwa.', 'Your relationships carry on even with dating switched off.')}</div>}
        </div>
      </>
    );
  }
  return (
    <>
      <AppHead title="Penzi 💘" onBack={back} right={<button className="btn btn-ghost btn-xs" onClick={() => setEditing(true)}>⚙️</button>} />
      <div className="app-body">
        <div className="seg">
          <button className={tab === 'discover' ? 'on' : ''} onClick={() => setTab('discover')}>✨ {L('Gundua', 'Discover')}</button>
          <button className={tab === 'rels' ? 'on' : ''} onClick={() => setTab('rels')}>💞 {L('Mahusiano', 'Matches')} ({rels.length})</button>
        </div>
        {tab === 'discover' ? <Discover s={s} reload={load} /> : (
          <>
            {rels.length === 0 && <div className="box center small muted" style={{ padding: 20 }}>{L('Bado huna match. Penda mtu kwenye Gundua — mkipendana wote wawili, mtakutana hapa.', 'No matches yet. Like someone in Discover — when it’s mutual, they show up here.')}</div>}
            {rels.map((r) => <RelCard key={r.id} r={r} open={open} reload={load} />)}
            <button className="btn btn-ghost btn-block btn-sm" style={{ marginTop: 8 }} onClick={async () => { await useStore.getState().run('/love/profile', { method: 'POST', body: { open: false, bio: s.profile.bio, looking: s.profile.looking } }); load(); }}>{L('Zima uchumba (usionekane kwenye Gundua)', 'Turn dating off (hide from Discover)')}</button>
          </>
        )}
      </div>
    </>
  );
}
