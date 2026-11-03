// Penzi → Bongo Singles: date game characters (chat, dates, gifts, partner, proposal, wedding)
// when you haven't matched with a real player — or just because.
import { useEffect, useState } from 'react';
import { DATE_SPOTS, LOVE_GIFTS, LOVE, LOVE_STATUS, placeById, fmtShort, fmtTsh, GLOW, OUTFITS, outfitFits, outfitById, partnerOutfitPrice, HAIR_COLORS, HAIRSTYLES } from '@shared/world.js';
import { useStore } from '../../store.js';
import { api } from '../../api.js';
import { AvatarPortrait } from '../AvatarPortrait.jsx';
import { ask } from '../Confirm.jsx';
import { goToPlace } from '../../nav.js';
import { L, loc } from '../../i18n.js';
import { sfx } from '../../audio.js';

const STYLE = { sweet: '💕', fun: '😂', chill: '😌' };

/** Glow-up: salon treatments (sent from anywhere), luxury pieces and outfits (at the shops). */
function GlowUp({ r, act, close }) {
  const me = useStore((s) => s.me);
  const n = r.npc;
  const [tab, setTab] = useState('salon');
  const [hair, setHair] = useState(n.look.hair);
  const [color, setColor] = useState(n.look.hairColor ?? 0);
  const busy = r.salonReadyAt > Date.now();
  const done = (res) => L(`✨ ${n.name} anang'aa! Glow ${res.glow} · 💗 ${res.affection}`, `✨ ${n.name} is glowing! Glow ${res.glow} · 💗 ${res.affection}`);
  const outfits = OUTFITS.filter((o) => outfitFits(o, n.body) && !r.closet.outfits.includes(o.id)).sort((a, b) => partnerOutfitPrice(a) - partnerOutfitPrice(b));
  return (
    <div className="npc-pane">
      <div className="glow-bar"><span>✨ Glow</span><div><i style={{ width: `${r.glow}%` }} />{r.glowFloor > 0 && <em style={{ left: `${r.glowFloor}%` }} />}</div><b>{r.glow}</b></div>
      <small className="muted">{L(`Glow inaongeza 💗 kwenye kila deti (+1 kwa kila ${GLOW.dateBonusPer}). Inapungua kila siku — vitu vya thamani alivyonavyo vinaizuia isishuke sana.`, `Glow adds 💗 to every date (+1 per ${GLOW.dateBonusPer}). It fades daily — the luxury pieces they own stop it dropping too far.`)}</small>
      <div className="seg" style={{ margin: '8px 0' }}>
        {[['salon', L('💇🏾‍♀️ Saluni', '💇🏾‍♀️ Salon')], ['shop', L('🛍️ Shopping', '🛍️ Shopping')], ['closet', L('👗 Kabati', '👗 Closet')]].map(([k, t]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{t}</button>)}
      </div>
      {tab === 'salon' && (
        <>
          {busy && <small className="muted">⏳ {L(`${n.name} yuko saluni — dakika ${Math.ceil((r.salonReadyAt - Date.now()) / 60000)}`, `${n.name} is at the salon — ${Math.ceil((r.salonReadyAt - Date.now()) / 60000)} min`)}</small>}
          <div className="glow-hair">
            <small>{L('Mtindo (kwa nywele mpya / VIP):', 'Style (for new hair / VIP):')}</small>
            <div className="chips">{GLOW.hair.map((h) => <button key={h} className={`chip ${hair === h ? 'on' : ''}`} onClick={() => setHair(h)}>{HAIRSTYLES.find((x) => x.id === h)?.name || h}</button>)}</div>
            <div className="glow-colors">{HAIR_COLORS.map((c, i) => <button key={c} className={color === i ? 'on' : ''} style={{ background: c }} onClick={() => setColor(i)} aria-label={`colour ${i + 1}`} />)}</div>
          </div>
          {GLOW.salon.map((t) => (
            <div key={t.id} className="inv-row">
              <span className="em">{t.emoji}</span>
              <div className="grow"><b>{L(t.name[0], t.name[1])}</b><small>{fmtShort(t.price)} · +{t.glow} ✨ · +{t.affection} 💗</small></div>
              <button className="btn btn-green btn-xs" disabled={busy || me.money < t.price} onClick={() => act('salon', { treat: t.id, hair, color }, done)}>{L('Mtume', 'Send')}</button>
            </div>
          ))}
          <div className="hint">{L(`Mtume ${n.name} saluni ukiwa popote. Nywele mpya na VIP zinabadilisha mtindo wake.`, `Send ${n.name} to the salon from anywhere. New hair and VIP change their style.`)}</div>
        </>
      )}
      {tab === 'shop' && (
        <>
          <div className="section-t">{L('VITU VYA THAMANI', 'LUXURY PIECES')}</div>
          {GLOW.items.map((g) => {
            const owned = r.closet.items.includes(g.id);
            return (
              <div key={g.id} className="inv-row">
                <span className="em">{g.emoji}</span>
                <div className="grow"><b>{L(g.name[0], g.name[1])}</b><small>{fmtShort(g.price)} · +{g.glow} ✨ · +{g.affection} 💗 · {L(`kinga ${g.floor}`, `floor +${g.floor}`)}</small></div>
                <button className="btn btn-green btn-xs" disabled={owned || me.money < g.price} onClick={() => act('shop', { kind: 'item', id: g.id }, done)}>{owned ? '✓' : L('Nunua', 'Buy')}</button>
              </div>
            );
          })}
          <div className="section-t">{L('NGUO', 'OUTFITS')}</div>
          {outfits.map((o) => (
            <div key={o.id} className="inv-row">
              <span className="em" style={{ color: o.top }}>👗</span>
              <div className="grow"><b>{L(o.name, o.nameEn || o.name)}</b><small>{fmtShort(partnerOutfitPrice(o))} · +{GLOW.outfitGlow} ✨</small></div>
              <button className="btn btn-green btn-xs" disabled={me.money < partnerOutfitPrice(o)} onClick={() => act('shop', { kind: 'outfit', id: o.id }, done)}>{L('Nunua', 'Buy')}</button>
            </div>
          ))}
          <div className="hint">{L(`Mpeleke ${n.name} dukani: nenda Kariakoo Fashion, Mlimani City au mall yoyote, kisha nunua. (Dubai ni safari — popote.)`, `Take ${n.name} shopping: go to Kariakoo Fashion, Mlimani City or any mall, then buy. (Dubai is a trip — works anywhere.)`)}</div>
          <button className="btn btn-ghost btn-sm btn-block" onClick={() => { close?.(); goToPlace('fashion'); }}>📍 Kariakoo Fashion</button>
        </>
      )}
      {tab === 'closet' && (
        <>
          {!r.closet.outfits.length && !r.closet.items.length && <small className="muted">{L('Kabati tupu — mpeleke shopping!', 'Empty closet — take them shopping!')}</small>}
          {r.closet.items.length > 0 && <div className="chips">{r.closet.items.map((id) => { const g = GLOW.items.find((x) => x.id === id); return g && <span key={id} className="chip on">{g.emoji} {L(g.name[0], g.name[1])}</span>; })}</div>}
          {r.closet.outfits.map((id) => {
            const o = outfitById[id];
            const on = n.look.outfit === id;
            return o && (
              <div key={id} className="inv-row">
                <span className="em" style={{ color: o.top }}>👗</span>
                <div className="grow"><b>{L(o.name, o.nameEn || o.name)}</b></div>
                <button className="btn btn-ghost btn-xs" disabled={on} onClick={() => act('shop', { kind: 'wear', id })}>{on ? L('Amevaa', 'Wearing') : L('Mvalishe', 'Wear')}</button>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

function Romance({ r, set, close }) {
  const run = useStore((s) => s.run);
  const me = useStore((s) => s.me);
  const [pane, setPane] = useState(null); // 'date' | 'gift'
  const [said, setSaid] = useState(null);
  const n = r.npc;
  const chatReady = r.chat.readyAt <= Date.now();
  const act = async (path, body, ok) => {
    const res = await run(`/love/npc/${n.id}/${path}`, { method: 'POST', body });
    if (!res) return null;
    set(res);
    if (ok) { sfx('levelup'); useStore.getState().toast(ok(res)); }
    return res;
  };
  const reply = async (style) => {
    const res = await act('chat', { style });
    if (res) { sfx(res.good ? 'levelup' : 'pop'); setSaid({ me: r.chat.a[style], them: res.reply, good: res.good }); }
  };
  const step = async (kind) => {
    const conf = {
      couple: { icon: '❤️', title: L(`Mwombe ${n.name} awe mpenzi wako?`, `Ask ${n.name} to be your partner?`) },
      propose: { icon: '💍', title: L(`Mchumbie ${n.name}?`, `Propose to ${n.name}?`), text: L(`Pete: ${fmtTsh(LOVE.ringPrice)}`, `Ring: ${fmtTsh(LOVE.ringPrice)}`) },
      wed: { icon: '💒', title: L(`Funga ndoa na ${n.name}?`, `Marry ${n.name}?`), text: L(`Harusi: ${fmtTsh(LOVE.weddingPrice)}`, `Wedding: ${fmtTsh(LOVE.weddingPrice)}`) },
    }[kind];
    if (!(await ask({ ...conf, ok: L('Ndiyo!', 'Yes!') }))) return;
    await act('step', { kind }, () => ({ couple: L(`❤️ ${n.name} amekubali — sasa ni wapenzi!`, `❤️ ${n.name} said yes — you're partners!`), propose: L(`💍 ${n.name} amesema NDIYO!`, `💍 ${n.name} said YES!`), wed: L(`💒 Mmeoana! ${n.name} anakuja kuishi Kwangu.`, `💒 You're married! ${n.name} moves into your home.`) }[kind]));
  };
  return (
    <div className="npc-rel">
      <div className="npc-top">
        <div className="npc-av"><AvatarPortrait appearance={n.look} alt={n.name} /></div>
        <div className="grow">
          <b>{n.name}, {n.age}</b>
          <small>{L(n.job[0], n.job[1])} · {n.city}</small>
          <span className="tag friend">{L(LOVE_STATUS[r.status][0], LOVE_STATUS[r.status][1])}</span>
          <div className="aff"><i style={{ width: `${r.affection}%` }} /></div>
          <small>💗 {r.affection}/100 · ✨ {r.glow} · {r.dates} {L('deti', 'dates')}</small>
        </div>
      </div>
      {/* chat */}
      <div className="npc-chat">
        {said ? (
          <>
            <div className="bubble me">{L(said.me[0], said.me[1])}</div>
            <div className="bubble">{L(said.them[0], said.them[1])}</div>
          </>
        ) : (
          <div className="bubble">{L(r.chat.q[0], r.chat.q[1])}</div>
        )}
        {!said && chatReady && (
          <div className="npc-replies">
            {Object.entries(r.chat.a).map(([k, v]) => <button key={k} onClick={() => reply(k)}>{STYLE[k]} {L(v[0], v[1])}</button>)}
          </div>
        )}
        {!chatReady && !said && <small className="muted">📱 {L(`${n.name} anaandika… (dakika ${Math.ceil((r.chat.readyAt - Date.now()) / 60000)})`, `${n.name} is typing… (${Math.ceil((r.chat.readyAt - Date.now()) / 60000)} min)`)}</small>}
      </div>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        <button className="btn btn-green btn-sm grow" onClick={() => setPane(pane === 'date' ? null : 'date')}>🌹 {L('Deti', 'Date')}</button>
        <button className="btn btn-white btn-sm grow" style={{ border: '1px solid var(--line)' }} onClick={() => setPane(pane === 'gift' ? null : 'gift')}>🎁 {L('Zawadi', 'Gift')}</button>
        <button className="btn btn-white btn-sm grow" style={{ border: '1px solid var(--line)' }} onClick={() => setPane(pane === 'glow' ? null : 'glow')}>✨ Glow</button>
        {r.canCouple && <button className="btn btn-dark btn-sm grow" onClick={() => step('couple')}>❤️ {L('Uwe mpenzi wangu?', 'Be my partner?')}</button>}
        {r.canPropose && <button className="btn btn-dark btn-sm grow" disabled={me.money < LOVE.ringPrice} onClick={() => step('propose')}>💍 {L('Chumbia', 'Propose')}</button>}
        {r.canWed && <button className="btn btn-dark btn-sm grow" disabled={me.money < LOVE.weddingPrice} onClick={() => step('wed')}>💒 {L('Harusi', 'Wedding')}</button>}
      </div>
      {pane === 'date' && (
        <div className="npc-pane">
          {r.nextDateIn > 0 && <small className="muted">{L(`Deti inayofuata baada ya dakika ${Math.ceil(r.nextDateIn / 60000)}.`, `Next date in ${Math.ceil(r.nextDateIn / 60000)} min.`)}</small>}
          {DATE_SPOTS.map((d) => (
            <div key={d.id} className="inv-row">
              <span className="em">{d.emoji}</span>
              <div className="grow"><b>{L(d.name[0], d.name[1])}</b><small>{fmtShort(d.cost)} · +{d.affection} 💗{n.spot === d.id ? ` · ⭐ ${L('anapenda hii!', 'their favourite!')}` : ''}</small></div>
              <button className="btn btn-ghost btn-xs" onClick={() => { close?.(); goToPlace(d.placeId); }}>📍</button>
              <button className="btn btn-green btn-xs" disabled={r.nextDateIn > 0 || me.money < d.cost} onClick={() => act('date', { spot: d.id }, (res) => L(`💕 Deti na ${n.name}${res.fav ? ' — pahali anapopenda! ⭐' : ''} · 💗 ${res.affection}`, `💕 Date with ${n.name}${res.fav ? ' — their favourite spot! ⭐' : ''} · 💗 ${res.affection}`))}>{L('Anza', 'Go')}</button>
            </div>
          ))}
          <div className="hint">{L(`Nenda mahali hapo (📍) kisha bonyeza Anza — ${n.name} atakukuta.`, `Head to the spot (📍), then tap Go — ${n.name} will meet you there.`)}</div>
        </div>
      )}
      {pane === 'glow' && <GlowUp r={r} act={act} close={close} />}
      {pane === 'gift' && (
        <div className="npc-pane npc-gifts">
          {LOVE_GIFTS.map((g) => (
            <button key={g.id} disabled={me.money < g.price} onClick={() => act('gift', { gift: g.id }, (res) => L(`${g.emoji} ${n.name} amefurahi${res.fav ? ' sana — ndiyo anayopenda! ⭐' : '!'} · 💗 ${res.affection}`, `${g.emoji} ${n.name} loved it${res.fav ? ' — their favourite! ⭐' : '!'} · 💗 ${res.affection}`))}>
              <span>{g.emoji}</span><small>{fmtShort(g.price)}{n.gift === g.id ? ' ⭐' : ''}</small>
            </button>
          ))}
        </div>
      )}
      <button className="rel-end" onClick={async () => { if (await ask({ icon: '💔', title: L(`Achana na ${n.name}?`, `Break up with ${n.name}?`), ok: L('Achana', 'Break up'), danger: true })) { const res = await run(`/love/npc/${n.id}/end`, { method: 'POST' }); if (res) set(res); } }}>{L('Achana', 'Break up')}</button>
    </div>
  );
}

export function BongoSingles({ close, romancesOnly = false }) {
  const run = useStore((s) => s.run);
  const [d, setD] = useState(null);
  const [filter, setFilter] = useState(null);
  useEffect(() => { api('/love/npc').then((r) => { setD(r); setFilter(r.looking); }).catch(() => {}); }, []);
  if (!d) return romancesOnly ? null : <div className="small muted" style={{ padding: 12 }}>{L('Inapakia…', 'Loading…')}</div>;
  // With dating switched off you still look after the partner you already have.
  if (romancesOnly) return d.romances.map((r) => <Romance key={r.npc.id} r={r} set={setD} close={close} />);
  const like = async (n) => {
    const r = await run(`/love/npc/${n.id}/like`, { method: 'POST' });
    if (r) { setD(r); sfx('levelup'); useStore.getState().toast(L(`💘 Mmeendana na ${n.name}! Mwandikie sasa.`, `💘 It's a match with ${n.name}! Say hi now.`)); }
  };
  const singles = d.singles.filter((n) => !filter || filter === 'any' || n.body === filter);
  return (
    <>
      <div className="box small" style={{ background: '#fff1f2' }}>🌹 {L('Bado hujapata match? Kutana na wahusika wa Bongo Life — ongea nao, nendeni deti, mpe zawadi, hadi harusi. Ukipata match ya mchezaji halisi, safi zaidi!', "No match yet? Meet Bongo Life's characters — chat, go on dates, send gifts, all the way to a wedding. If you match with a real player too, even better!")}</div>
      {d.romances.map((r) => <Romance key={r.npc.id} r={r} set={setD} close={close} />)}
      <div className="section-t">{L('WASEJA WA BONGO', 'BONGO SINGLES')}</div>
      <div className="seg" style={{ marginBottom: 8 }}>
        {[['woman', L('Wanawake', 'Women')], ['man', L('Wanaume', 'Men')], ['any', L('Wote', 'Everyone')]].map(([k, t]) => <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{t}</button>)}
      </div>
      <div className="npc-grid">
        {singles.map((n) => (
          <div key={n.id} className="npc-card">
            <div className="npc-av"><AvatarPortrait appearance={n.look} alt={n.name} /></div>
            <b>{n.name}, {n.age}</b>
            <small>{L(n.job[0], n.job[1])} · {n.city}</small>
            <small className="bio">“{L(n.bio[0], n.bio[1])}”</small>
            <small>⭐ {loc(placeById[DATE_SPOTS.find((x) => x.id === n.spot).placeId])}</small>
            <button className="btn btn-green btn-sm btn-block" onClick={() => like(n)}>💘 {L('Penda', 'Like')}</button>
          </div>
        ))}
      </div>
    </>
  );
}
