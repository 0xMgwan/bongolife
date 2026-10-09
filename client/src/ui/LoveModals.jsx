import { dateSpotById, placeById, fmtTsh } from '@shared/world.js';
import { useStore } from '../store.js';
import { api } from '../api.js';
import { avatarEmoji } from '../three/Avatar.jsx';
import { L, pick, loc } from '../i18n.js';
import { sfx } from '../audio.js';

/** Head to a date spot: set the meetup chip and open the travel card. */
export function goToDate(spotId, withUser) {
  const spot = dateSpotById[spotId];
  if (!spot) return;
  useStore.setState({ meetup: { with: withUser, placeId: spot.placeId, until: Date.now() + 30 * 60_000, date: spot.id }, sheet: { type: 'travel', id: spot.placeId }, tab: 'town', phone: null });
}

/** Match celebration + incoming asks (date / be my partner / proposal). */
export function LoveModals() {
  const match = useStore((s) => s.loveMatch);
  const askIn = useStore((s) => s.loveAsk);
  if (askIn) {
    const spot = askIn.spot && dateSpotById[askIn.spot];
    const answer = async (yes) => {
      useStore.setState({ loveAsk: null });
      try {
        const r = await api(`/love/answer/${askIn.id}`, { method: 'POST', body: { accept: yes } });
        if (r.me) useStore.setState({ me: r.me });
        sfx(yes ? 'levelup' : 'close');
        if (yes && askIn.kind === 'date') goToDate(askIn.spot, askIn.from);
        if (yes && askIn.kind === 'couple') useStore.getState().toast(L(`❤️ Sasa wewe na @${askIn.from} ni wapenzi!`, `❤️ You and @${askIn.from} are now partners!`));
        if (yes && askIn.kind === 'propose') useStore.getState().toast(L(`💍 Mmechumbiana na @${askIn.from}!`, `💍 You're engaged to @${askIn.from}!`));
      } catch (e) { useStore.getState().toast(e.message, 'err'); }
    };
    const title = askIn.kind === 'date' ? L(`@${askIn.from} anakualika deti!`, `@${askIn.from} asked you on a date!`)
      : askIn.kind === 'couple' ? L(`@${askIn.from}: "Uwe mpenzi wangu?"`, `@${askIn.from}: "Will you be my partner?"`)
        : L(`💍 @${askIn.from} anakuchumbia!`, `💍 @${askIn.from} is proposing!`);
    return (
      <div className="modal-wrap confirm-wrap">
        <div className="modal card confirm-card love-ask">
          <div className="big badge-ic">{askIn.kind === 'propose' ? '💍' : avatarEmoji(askIn.appearance)}</div>
          <h3>{title}</h3>
          {spot && <p className="confirm-text">{spot.emoji} {pick(spot.name)} · {loc(placeById[spot.placeId])}<br /><small>{L(`@${askIn.from} analipa ${fmtTsh(spot.cost)}`, `@${askIn.from} pays ${fmtTsh(spot.cost)}`)}</small></p>}
          <div className="confirm-btns">
            <button className="btn btn-ghost" onClick={() => answer(false)}>{L('Si sasa', 'Not now')}</button>
            <button className="btn btn-green" onClick={() => answer(true)}>{askIn.kind === 'propose' ? L('Ndiyo! 💍', 'Yes! 💍') : askIn.kind === 'couple' ? L('Ndiyo ❤️', 'Yes ❤️') : L('Twende 💘', "Let's go 💘")}</button>
          </div>
        </div>
      </div>
    );
  }
  if (match) {
    const close = () => useStore.setState({ loveMatch: null });
    return (
      <div className="modal-wrap confirm-wrap" onClick={close}>
        <div className="modal card confirm-card love-match" onClick={(e) => e.stopPropagation()}>
          <div className="lm-hearts">💘</div>
          <h3>{L('Mmeendana!', "It's a match!")}</h3>
          <p className="confirm-text">{L(`Wewe na @${match.with} mmependana. Msalimie, kisha mwalike deti!`, `You and @${match.with} like each other. Say hi, then ask them on a date!`)}</p>
          <div className="confirm-btns">
            <button className="btn btn-ghost" onClick={close}>{L('Endelea', 'Keep going')}</button>
            <button className="btn btn-green" onClick={() => { close(); useStore.getState().openPhone('dm', match.with); }}>💬 {L('Msalimie', 'Say hi')}</button>
          </div>
        </div>
      </div>
    );
  }
  return null;
}
