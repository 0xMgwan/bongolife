import { HEALTH, fmtTsh } from '@shared/world.js';
import { useStore } from '../store.js';
import { avatarEmoji } from '../three/Avatar.jsx';
import { L } from '../i18n.js';
import { answerInvite, callAmbulance, goHospital, leaveVisit } from './social.js';
import { placeById } from '@shared/world.js';
import { replyHangout } from '../net.js';
import { loc } from '../i18n.js';

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
      <AccidentModal />
    </>
  );
}
