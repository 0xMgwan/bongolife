import { useEffect, useState } from 'react';
import { fmtShort } from '@shared/world.js';
import { api } from '../../api.js';
import { useStore } from '../../store.js';
import { avatarEmoji } from '../../three/Avatar.jsx';
import { AppHead } from '../Phone.jsx';
import { L } from '../../i18n.js';

export function Viongozi({ back, open }) {
  const [lb, setLb] = useState(null);
  const [tab, setTab] = useState('rich');
  const me = useStore((s) => s.me);
  useEffect(() => {
    api('/leaderboard').then(setLb).catch(() => {});
  }, []);
  const rows = lb?.[tab] || [];
  return (
    <>
      <AppHead title={L('Matajiri wa Dar', 'Richest in Dar')} onBack={back} />
      <div className="app-body">
        <div className="seg">
          <button className={tab === 'rich' ? 'on' : ''} onClick={() => setTab('rich')}>💰 {L('Utajiri', 'Wealth')}</button>
          <button className={tab === 'famous' ? 'on' : ''} onClick={() => setTab('famous')}>⭐ {L('Umaarufu', 'Fame')}</button>
        </div>
        <div className="box small" style={{ background: '#fef9c3' }}>👑 {L('Tajiri namba 1 anakuwa Mkuu wa Mkoa na jina lake linaonekana kwa kila mtu anayefungua Bongo Life.', 'The richest player becomes Mayor, shown to everyone who opens Bongo Life.')}</div>
        <div className="box" style={{ padding: '2px 12px' }}>
          {!lb && <div className="small muted" style={{ padding: 12 }}>{L('Inapakia…', 'Loading…')}</div>}
          {rows.map((r, i) => (
            <button key={r.id} className="lb-row" style={{ width: '100%', textAlign: 'left', background: r.username === me.username ? 'var(--green-l)' : undefined, borderRadius: 12 }} onClick={() => r.username !== me.username && open('dm', r.username)}>
              <span className="rank">{i === 0 ? '👑' : i + 1}</span>
              <span className="avatar-dot" style={{ width: 34, height: 34, fontSize: 17 }}>{avatarEmoji(r.appearance)}</span>
              <div className="grow"><b>@{r.username}</b><div className="small muted">{r.name}</div></div>
              <b>{tab === 'rich' ? `TSh ${fmtShort(r.worth)}` : `⭐ ${r.fame}`}</b>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
