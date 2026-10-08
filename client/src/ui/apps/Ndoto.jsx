import { useEffect, useState } from 'react';
import { AMBITIONS, ambitionById, fmtTsh, fmtShort } from '@shared/world.js';
import { useStore } from '../../store.js';
import { api } from '../../api.js';
import { AppHead } from '../Phone.jsx';
import { goToPlace } from '../../nav.js';
import { ask } from '../Confirm.jsx';
import { L, pick } from '../../i18n.js';
import { sfx } from '../../audio.js';

const fmtGoal = (have, need) => (need >= 100_000 ? `${fmtShort(Math.min(have, need))} / ${fmtShort(need)}` : `${Math.min(have, need)} / ${need}`);

/** A street dilemma: two choices, real consequences. */
export function Dilemma({ d, onDone }) {
  const run = useStore((s) => s.run);
  const [out, setOut] = useState(null);
  if (out) {
    return (
      <div className="dil-card">
        <div className="dil-em">{d.emoji}</div>
        <p className="dil-out">{pick(out.msg)}</p>
        <div className="dil-fx">
          {out.money ? <span className={out.money > 0 ? 'up' : 'dn'}>{out.money > 0 ? '+' : ''}{fmtTsh(out.money)}</span> : null}
          {out.fame ? <span className="up">⭐ {out.fame > 0 ? '+' : ''}{out.fame}</span> : null}
        </div>
        <button className="btn btn-white btn-sm" onClick={() => onDone(out)}>{L('Sawa', 'OK')}</button>
      </div>
    );
  }
  return (
    <div className="dil-card">
      <div className="dil-k">📰 {L('MAMBO YA MTAA', 'STREET NEWS')}</div>
      <div className="dil-em">{d.emoji}</div>
      <p>{pick(d.text)}</p>
      <div className="dil-btns">
        {d.choices.map((c, i) => (
          <button key={i} className="btn btn-white btn-sm" onClick={async () => {
            const r = await run('/story/dilemma', { method: 'POST', body: { id: d.id, choice: i } });
            if (r) { sfx(r.money > 0 || r.won ? 'cash' : 'pop'); setOut(r); }
          }}>{pick(c.label)}</button>
        ))}
      </div>
    </div>
  );
}

/** Ambitions: choose a life path and live its story, chapter by chapter. */
export function Ndoto({ back, close, open }) {
  const run = useStore((s) => s.run);
  const [s, setS] = useState(null);
  const [picking, setPicking] = useState(false);
  const load = () => api('/story').then(setS).catch(() => {});
  useEffect(() => { load(); }, []);
  if (!s) return (<><AppHead title={L('Ndoto', 'Ambitions')} onBack={back} /><div className="app-body"><div className="small muted" style={{ padding: 12 }}>{L('Inapakia…', 'Loading…')}</div></div></>);
  const amb = s.amb && ambitionById[s.amb];
  const choose = async (id) => {
    if (s.amb && id !== s.amb && !(await ask({ icon: ambitionById[id].emoji, title: L(`Badili kwenda ${ambitionById[id].name[0]}?`, `Switch to ${ambitionById[id].name[1]}?`), text: L('Maendeleo yako yatabaki — unaweza kurudi baadaye. Unaweza kubadili mara moja kwa siku.', 'Your progress is kept — you can come back later. You can switch once a day.'), ok: L('Badili', 'Switch') }))) return;
    const r = await run('/story/choose', { method: 'POST', body: { amb: id } });
    if (r) { sfx('levelup'); setS(r.story); setPicking(false); }
  };
  const claim = async () => {
    const r = await run('/story/claim', { method: 'POST' });
    if (!r) return;
    sfx('levelup');
    setS(r.story);
    useStore.getState().toast(L(`🌟 Zawadi: ${fmtTsh(r.reward.money)}${r.reward.fame ? ` · ⭐+${r.reward.fame}` : ''}`, `🌟 Reward: ${fmtTsh(r.reward.money)}${r.reward.fame ? ` · ⭐+${r.reward.fame}` : ''}`));
  };
  const goTo = (go) => {
    if (!go) return;
    if (go.place) { close?.(); goToPlace(go.place); }
    else if (go.app) open?.(go.app);
  };
  const dilemma = s.dilemma && <Dilemma d={s.dilemma} onDone={() => load()} />;

  if (!amb || picking) {
    return (
      <>
        <AppHead title={L('Ndoto', 'Ambitions')} onBack={picking ? () => setPicking(false) : back} />
        <div className="app-body">
          {dilemma}
          <div className="amb-intro">
            <b>{L('Unataka kuwa nani Bongo?', 'Who do you want to be in Bongo?')}</b>
            <small>{L('Chagua ndoto. Kila moja ina hadithi ya sura 6, malengo na zawadi.', 'Pick an ambition. Each has a 6-chapter story, goals and rewards.')}</small>
          </div>
          {AMBITIONS.map((a) => (
            <button key={a.id} className="amb-pick" style={{ background: `linear-gradient(135deg, ${a.color[0]}, ${a.color[1]})` }} onClick={() => choose(a.id)}>
              <span className="em">{a.emoji}</span>
              <span className="grow">
                <b>{pick(a.name)}</b>
                <small>{pick(a.blurb)}</small>
                {s.progress[a.id] > 0 && <small className="amb-prog">{L('Sura', 'Chapter')} {Math.min(s.progress[a.id] + 1, a.chapters.length)}/{a.chapters.length}{a.id === s.amb ? ` · ${L('sasa', 'current')}` : ''}</small>}
              </span>
            </button>
          ))}
        </div>
      </>
    );
  }

  const cur = s.current;
  const ch = !cur?.done && amb.chapters[cur.step];
  const pct = ch ? Math.min(100, (cur.have / cur.need) * 100) : 100;
  return (
    <>
      <AppHead title={L('Ndoto', 'Ambitions')} onBack={back} right={<button className="btn btn-ghost btn-xs" onClick={() => setPicking(true)}>{L('Badili', 'Switch')}</button>} />
      <div className="app-body">
        {dilemma}
        <div className="amb-card" style={{ background: `linear-gradient(135deg, ${amb.color[0]}, ${amb.color[1]})` }}>
          <div className="amb-k">{amb.emoji} {pick(amb.name).toUpperCase()}</div>
          {ch ? (
            <>
              <div className="amb-ch">{L('Sura', 'Chapter')} {cur.step + 1} · {pick(ch.title)}</div>
              <p className="amb-story">{pick(ch.story)}</p>
              <div className="amb-goal">🎯 {pick(ch.hint)}</div>
              <div className="amb-bar"><i style={{ width: `${pct}%` }} /></div>
              <div className="amb-row">
                <span>{fmtGoal(cur.have, cur.need)}</span>
                <span>🎁 {fmtShort(ch.reward.money)}{ch.reward.fame ? ` · ⭐+${ch.reward.fame}` : ''}</span>
              </div>
              {cur.ready
                ? <button className="btn btn-white btn-block" onClick={claim}>🌟 {L('Dai zawadi', 'Claim reward')}</button>
                : ch.go && <button className="btn btn-white btn-block" onClick={() => goTo(ch.go)}>{L('Twende', "Let's go")} →</button>}
            </>
          ) : (
            <>
              <div className="amb-ch">🏆 {L('Umekamilisha hadithi yote!', 'You completed the whole story!')}</div>
              <p className="amb-story">{L('Jina lako limeandikwa kwenye historia ya Bongo. Chagua ndoto nyingine uendelee.', "Your name is written into Bongo history. Pick another ambition to keep going.")}</p>
              <button className="btn btn-white btn-block" onClick={() => setPicking(true)}>{L('Ndoto mpya', 'New ambition')}</button>
            </>
          )}
        </div>
        <div className="section-t">{L('SURA', 'CHAPTERS')}</div>
        {amb.chapters.map((c, i) => (
          <div key={i} className={`amb-step ${i < cur.step ? 'done' : i === cur.step ? 'now' : ''}`}>
            <span className="n">{i < cur.step ? '✓' : i + 1}</span>
            <div className="grow"><b>{pick(c.title)}</b><small>{i <= cur.step ? pick(c.hint) : L('Itafunguka baadaye…', 'Unlocks later…')}</small></div>
            <small className="rw">{fmtShort(c.reward.money)}</small>
          </div>
        ))}
      </div>
    </>
  );
}
