import { useEffect, useState } from 'react';
import { useStore } from '../../store.js';
import { api } from '../../api.js';
import { AppHead } from '../Phone.jsx';
import { avatarEmoji } from '../../three/Avatar.jsx';
import { knockOn } from '../Neighbours.jsx';
import { L } from '../../i18n.js';

/** Neighbours: who's home right now — knock and hang out together. */
export function Majirani({ back }) {
  const me = useStore((s) => s.me);
  const [list, setList] = useState(null);
  const load = () => api('/neighbours').then(setList).catch(() => setList([]));
  useEffect(() => {
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, []);
  const home = (n) => (n.home.kind === 'house' ? L(`Nyumba · ${n.home.district}`, `House · ${n.home.district}`) : L('Apartment', 'Apartment'));
  return (
    <>
      <AppHead title={L('Majirani', 'Neighbours')} onBack={back} />
      <div className="app-body">
        <div className="hint" style={{ marginTop: 0 }}>🏘️ {L('Unaweza kugonga mlango wakiwa nyumbani. Wakifungua, mkae pamoja — filamu, FIFA, chai na stori.', "You can drop by when they're home. If they open up, hang out — movies, FIFA, tea and gist.")}</div>
        {!list && <div className="small muted" style={{ padding: 12 }}>{L('Inapakia…', 'Loading…')}</div>}
        {list?.length === 0 && <div className="box small muted">{L('Hakuna majirani bado.', 'No neighbours yet.')}</div>}
        {list?.map((n) => (
          <div key={n.username} className="nb-row">
            <span className="nb-av">{avatarEmoji(n.appearance)}{n.online && <i className={n.atHome ? 'home' : 'on'} />}</span>
            <div className="grow">
              <b>@{n.username}</b>
              <small>{home(n)} · {n.items} {L('vitu', 'items')} · {n.atHome ? L('yuko nyumbani', 'home now') : n.online ? L('yuko mtaani', 'out in town') : L('hayupo', 'away')}</small>
            </div>
            <button className="btn btn-sm btn-green" disabled={!n.atHome || me.username === n.username} onClick={() => knockOn(n.username)}>{L('Tembelea', 'Visit')}</button>
          </div>
        ))}
      </div>
    </>
  );
}
