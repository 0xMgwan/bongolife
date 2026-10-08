import { HEALTH, fmtTsh, CRIME } from '@shared/world.js';
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { sfx } from '../audio.js';
import { pick } from '../i18n.js';
import { CasinoModal } from './Casino.jsx';
import { useStore } from '../store.js';
import { avatarEmoji } from '../three/Avatar.jsx';
import { L } from '../i18n.js';
import { answerInvite, callAmbulance, goHospital, leaveVisit } from './social.js';
import { placeById } from '@shared/world.js';
import { replyHangout } from '../net.js';
import { loc } from '../i18n.js';
import { ConfirmModal } from './Confirm.jsx';

/** Incoming "come to my place" invite. */
function InviteModal() {
  const inv = useStore((s) => s.invite);
  if (!inv) return null;
  return (
    <div className="modal-wrap">
      <div className="modal card pop">
        <div className="big">{avatarEmoji(inv.appearance)}</div>
        <h3>{L('Mwaliko! 🏠', 'Invitation! 🏠')}</h3>
        <p className="muted">{L(`@${inv.from} anakualika nyumbani kwake.`, `@${inv.from} is inviting you over to their place.`)}</p>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-ghost grow" onClick={() => answerInvite(false)}>{L('Sasa hivi siwezi', 'Not now')}</button>
          <button className="btn btn-green grow" onClick={() => answerInvite(true)}>✓ {L('Nakuja!', "I'm coming!")}</button>
        </div>
      </div>
    </div>
  );
}

/** "Let's go out" invite from someone you met in town. */
function HangoutModal() {
  const h = useStore((s) => s.hangout);
  if (!h) return null;
  const p = placeById[h.placeId];
  const answer = (yes) => {
    replyHangout(h.fromId, h.placeId, yes);
    useStore.setState({ hangout: null, ...(yes ? { meetup: { with: h.from, placeId: h.placeId, until: Date.now() + 30 * 60_000 }, sheet: { type: 'travel', id: h.placeId }, tab: 'town', phone: null } : {}) });
  };
  return (
    <div className="modal-wrap">
      <div className="modal card pop">
        <div className="big">{avatarEmoji(h.appearance)} {p?.icon}</div>
        <h3>{L('Twende tukale bata! 🎉', "Let's go out! 🎉")}</h3>
        <p className="muted">{L(`@${h.from} anakuita mkutane ${p?.name}.`, `@${h.from} wants to meet you at ${loc(p)}.`)}</p>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-ghost grow" onClick={() => answer(false)}>{L('Sasa hivi siwezi', 'Not now')}</button>
          <button className="btn btn-green grow" onClick={() => answer(true)}>✓ {L('Twende!', "I'm in!")}</button>
        </div>
      </div>
    </div>
  );
}

/** Someone just robbed you. */
function RobbedModal() {
  const r = useStore((s) => s.robbed);
  const run = useStore((s) => s.run);
  if (!r) return null;
  const close = () => useStore.setState({ robbed: null });
  const report = async () => {
    close();
    const res = await run(`/players/${r.by}/report-police`, { method: 'POST' });
    if (!res) return;
    const toast = useStore.getState().toast;
    if (res.caught) { sfx('cash'); toast(L(`🚓 Polisi wamemkamata @${r.by}! Umerudishiwa ${fmtTsh(res.back || 0)}.`, `🚓 Police caught @${r.by}! ${fmtTsh(res.back || 0)} returned to you.`)); }
    else toast(L(`🚓 Polisi wanamtafuta @${r.by} lakini ametoroka.`, `🚓 Police are after @${r.by} but they got away.`));
  };
  return (
    <div className="modal-wrap">
      <div className="modal card pop">
        <div className="big badge-ic">😱</div>
        <h3>{L('Umeibiwa!', 'You got robbed!')}</h3>
        <p className="muted">{L(`@${r.by} amekuibia ${fmtTsh(r.amount)}. Ripoti polisi haraka — wakimkamata utarudishiwa pesa yako.`, `@${r.by} snatched ${fmtTsh(r.amount)} from you. Report it fast — if the police catch them you get your money back.`)}</p>
        <button className="choice primary" onClick={report}><b>🚓 {L('Ripoti polisi', 'Report to police')}</b><small>{L(`Nafasi ya kumkamata ${Math.round(CRIME.catchChance * 100)}%`, `${Math.round(CRIME.catchChance * 100)}% chance they get caught`)}</small></button>
        <button className="choice" onClick={close}><b>{L('Achana nayo', 'Let it go')}</b></button>
      </div>
    </div>
  );
}

/** Arrested: pay the fine, sit in the cell, or call a lawyer and go to court. */
function ArrestModal() {
  const me = useStore((s) => s.me);
  const run = useStore((s) => s.run);
  const j = me?.jail;
  if (!j || j.phase !== 'arrested') return null;
  const choose = async (option) => {
    const r = await run('/jail/choose', { method: 'POST', body: { option } });
    if (!r) return;
    if (r.free) { sfx('cash'); useStore.getState().toast(L('✅ Umelipa faini — uko huru.', '✅ Fine paid — you walk out of the station.')); }
    if (r.court) useStore.getState().toast(L('⚖️ Wakili amepatikana. Kesi yako inasikilizwa Kisutu karibuni.', '⚖️ Lawyer hired. Your case will be heard at Kisutu shortly.'));
  };
  return (
    <div className="modal-wrap">
      <div className="modal card pop">
        <div className="big badge-ic">🚓</div>
        <h3>{L('Umekamatwa!', 'Arrested!')}</h3>
        <p className="muted">{L(
          `"Ingia kwenye gari!" Polisi wamekukamata kwa kosa la ${pick(j.reason).toLowerCase()}. Lipa faini ${fmtTsh(j.fine)}, kaa rumande dakika ${Math.round(CRIME.cellMs / 60000)} Kituo cha Polisi Oysterbay (unaweza kulipa dhamana kutoka mapema), au mwite wakili (${fmtTsh(CRIME.lawyerFee)}) mkapambane Mahakama ya Kisutu.`,
          `"Get in the car!" The police caught you for ${pick(j.reason).toLowerCase()}. Pay the ${fmtTsh(j.fine)} fine, spend ${Math.round(CRIME.cellMs / 60000)} minutes in the cell at Oysterbay Police Station (you can pay bail to leave early), or call a lawyer (${fmtTsh(CRIME.lawyerFee)}) and fight it at Kisutu Court.`,
        )}</p>
        <button className="choice primary" disabled={me.money < j.fine} onClick={() => choose('fine')}><b>{L('Lipa faini', 'Pay the fine')} · {fmtTsh(j.fine)}</b><small>{L('Toka kituoni sasa hivi', 'Walk out of the station')}</small></button>
        <button className="choice" onClick={() => choose('cell')}><b>{L('Kaa rumande', 'Sit in the cell')}</b><small>{L(`Hakuna faini sasa, subiri (au lipa dhamana ${fmtTsh(j.bail)})`, `No fine now, but you wait it out (or pay ${fmtTsh(j.bail)} bail)`)}</small></button>
        <button className="choice" disabled={me.money < CRIME.lawyerFee} onClick={() => choose('lawyer')}><b>{L('Mwite wakili', 'Call a lawyer')} ⚖️ · {fmtTsh(CRIME.lawyerFee)}</b><small>{L(`Kesi Kisutu baada ya dakika ${Math.round(CRIME.courtDelayMs / 60000)}: ukishinda uko huru, ukishindwa nusu ya muda rumande`, `Court at Kisutu in ${Math.round(CRIME.courtDelayMs / 60000)} min: win and you walk, lose and it's half the time`)}</small></button>
      </div>
    </div>
  );
}

/** In the cell or waiting for your hearing: countdown, bail, verdict. */
export function JailPanel() {
  const me = useStore((s) => s.me);
  const run = useStore((s) => s.run);
  const [now, setNow] = useState(Date.now());
  const j = me?.jail;
  const end = j?.phase === 'cell' ? j.until : j?.phase === 'court' ? j.courtAt : null;
  useEffect(() => {
    if (!end) return undefined;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [end]);
  useEffect(() => {
    if (!end || now < end + 300) return;
    api('/jail/tick', { method: 'POST' }).then((r) => {
      useStore.setState({ me: r.me });
      const toast = useStore.getState().toast;
      if (r.verdict === 'win') { sfx('levelup'); toast(L('⚖️ Hakimu: HUNA HATIA! Uko huru. 🎉', '⚖️ The magistrate says NOT GUILTY! You walk free. 🎉')); }
      else if (r.verdict === 'lose') { sfx('error'); toast(L('⚖️ Umeshindwa kesi — nusu ya muda rumande.', '⚖️ You lost the case — half the time in the cell.')); }
      else if (r.released) { sfx('pop'); toast(L('🔓 Muda umeisha — uko huru. Usirudie!', "🔓 Time's up — you're free. Don't do it again!")); }
    }).catch(() => {});
  }, [now, end]);
  if (!j || (j.phase !== 'cell' && j.phase !== 'court')) return null;
  const total = j.phase === 'cell' ? (j.verdict ? CRIME.cellMs / 2 : CRIME.cellMs) : CRIME.courtDelayMs;
  const left = Math.max(0, end - now);
  const pct = Math.min(100, 100 - (left / total) * 100);
  const mm = `${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}`;
  return (
    <div className="jail-panel">
      <div className="jp-t">{j.phase === 'cell' ? L('🔒 Uko rumande · Kituo cha Polisi Oysterbay', '🔒 In the cell · Oysterbay Police Station') : L('⚖️ Mahakama ya Kisutu · kesi yako inasikilizwa', '⚖️ Kisutu Court · your case is being heard')}</div>
      <div className="jp-s">{pick(j.reason)} · {j.phase === 'cell' ? L(`unatoka baada ya ${mm}`, `out in ${mm}`) : L(`hukumu baada ya ${mm}`, `verdict in ${mm}`)}</div>
      <div className="jp-bar"><i style={{ width: `${pct}%` }} /></div>
      {j.phase === 'cell' && <button className="btn btn-white btn-block btn-sm" disabled={me.money < j.bail} onClick={() => run('/jail/bail', { method: 'POST' }).then((r) => r && (sfx('cash'), useStore.getState().toast(L('🔓 Dhamana imelipwa — uko huru.', '🔓 Bail paid — you are free.'))))}>{L('Lipa dhamana', 'Pay bail')} · {fmtTsh(j.bail)}</button>}
    </div>
  );
}

/** Knocked down by a car. */
function AccidentModal() {
  const acc = useStore((s) => s.accident);
  const money = useStore((s) => s.me?.money ?? 0);
  if (!acc) return null;
  const cost = acc.health < HEALTH.injuredBelow ? HEALTH.ambulanceCost : HEALTH.ambulanceCost * 2;
  return (
    <div className="modal-wrap">
      <div className="modal card pop">
        <div className="big">🚗💥</div>
        <h3>{L('Umegongwa na gari!', 'You got hit by a car!')}</h3>
        <p className="muted">
          {L('Afya yako imeshuka hadi', 'Your health dropped to')} <b style={{ color: acc.health < HEALTH.injuredBelow ? '#ef4444' : '#f59e0b' }}>❤️ {acc.health}%</b>.{' '}
          {acc.health < HEALTH.injuredBelow
            ? L('Huwezi kufanya kazi mpaka utibiwe hospitali.', "You can't work until you're treated at the hospital.")
            : L('Pita hospitali ukaangaliwe.', 'Get yourself checked at the hospital.')}
        </p>
        <div style={{ display: 'grid', gap: 8 }}>
          <button className="btn btn-red" disabled={money <= 0} onClick={callAmbulance}>🚑 {L('Ita gari la wagonjwa', 'Call an ambulance')} · {fmtTsh(cost)}</button>
          <button className="btn btn-white" style={{ border: '1px solid var(--line)' }} onClick={goHospital}>🚶 {L('Tembea hadi Muhimbili', 'Walk to Muhimbili')}</button>
          <button className="btn btn-ghost" onClick={() => useStore.setState({ accident: null })}>{L('Niko poa, endelea', "I'm fine, carry on")}</button>
        </div>
      </div>
    </div>
  );
}

/** "You're at @host's place" bar while visiting. */
export function VisitBar() {
  const v = useStore((s) => s.visiting);
  const tab = useStore((s) => s.tab);
  if (!v || tab !== 'home') return null;
  return (
    <div className="visit-bar">
      <span className="pill">🏠 {L(`Kwa @${v.host.username}`, `At @${v.host.username}'s`)}</span>
      <button className="btn btn-red btn-xs" onClick={leaveVisit}>{L('Ondoka', 'Leave')} ↩</button>
    </div>
  );
}

export function SocialModals() {
  return (
    <>
      <InviteModal />
      <HangoutModal />
      <RobbedModal />
      <ArrestModal />
      <JailPanel />
      <CasinoModal />
      <ConfirmModal />
      <AccidentModal />
    </>
  );
}
