import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store.js';
import { api } from '../../api.js';
import { sendDm, sendChat } from '../../net.js';
import { avatarEmoji } from '../../three/Avatar.jsx';
import { AppHead } from '../Phone.jsx';
import { L } from '../../i18n.js';

const ago = (t) => {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return L('sasa hivi', 'just now');
  if (s < 3600) return L(`dk ${Math.floor(s / 60)}`, `${Math.floor(s / 60)}m`);
  if (s < 86400) return L(`saa ${Math.floor(s / 3600)}`, `${Math.floor(s / 3600)}h`);
  return new Date(t).toLocaleDateString();
};

export function Threads({ open, back }) {
  const [threads, setThreads] = useState(null);
  const [to, setTo] = useState('');
  const dmVersion = useStore((s) => s.dmVersion);
  useEffect(() => {
    api('/messages/threads').then(setThreads).catch(() => setThreads([]));
  }, [dmVersion]);
  return (
    <>
      <AppHead title={L('Ujumbe', 'Messages')} onBack={back} />
      <div className="app-body">
        <form className="row" style={{ marginBottom: 10 }} onSubmit={(e) => { e.preventDefault(); if (to.trim()) open('dm', to.trim().replace(/^@/, '')); }}>
          <input className="field" style={{ padding: '11px 16px' }} placeholder={L('@username kuanzisha chat', '@username to start a chat')} value={to} onChange={(e) => setTo(e.target.value)} autoCapitalize="none" />
          <button className="btn btn-green btn-sm">{L('Anza', 'Start')}</button>
        </form>
        <div className="box" style={{ padding: '4px 12px' }}>
          {threads === null && <div className="muted small" style={{ padding: 12 }}>{L('Inapakia…', 'Loading…')}</div>}
          {threads?.length === 0 && <div className="muted small" style={{ padding: 12 }}>{L('Bado huna meseji. Gusa mtu mtaani kumtumia ujumbe 👋', 'No messages yet. Tap someone on the street to message them 👋')}</div>}
          {threads?.map((t) => (
            <button key={t.user.id} className="thread" onClick={() => open('dm', t.user.username)}>
              <span className="avatar-dot">{avatarEmoji(t.user.appearance)}{t.user.online && <span className="dot" style={{ position: 'absolute', right: 0, bottom: 0 }} />}</span>
              <div className="grow">
                <div className="row between"><b>@{t.user.username}</b><span className="small muted">{ago(t.at)}</span></div>
                <div className="small muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.mine ? L('Wewe: ', 'You: ') : ''}{t.last}</div>
              </div>
              {t.unread > 0 && <span className="badge" style={{ position: 'static' }}>{t.unread}</span>}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

export function Dm({ arg: username, back }) {
  const me = useStore((s) => s.me);
  const lastDm = useStore((s) => s.lastDm);
  const [data, setData] = useState(null);
  const [text, setText] = useState('');
  const end = useRef();
  useEffect(() => {
    api(`/messages/dm/${encodeURIComponent(username)}`)
      .then((d) => {
        setData(d);
        useStore.getState().refreshMe().catch(() => {});
      })
      .catch((e) => {
        useStore.getState().toast(e.message, 'err');
        back();
      });
  }, [username]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!lastDm || !data) return;
    const involved = (lastDm.from_id === data.user.id && lastDm.to_id === me.id) || (lastDm.from_id === me.id && lastDm.to_id === data.user.id);
    if (involved && !data.messages.some((m) => m.id === lastDm.id)) setData({ ...data, messages: [...data.messages, lastDm] });
  }, [lastDm]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => end.current?.scrollIntoView({ block: 'end' }), [data?.messages.length]);
  const send = async (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setText('');
    const r = await sendDm(username, t);
    if (r.error) useStore.getState().toast(r.error === 'muted' ? L('Umezuiwa kuchat kwa muda.', 'You are muted for now.') : r.error, 'err');
    else setData((d) => (d.messages.some((m) => m.id === r.msg.id) ? d : { ...d, messages: [...d.messages, r.msg] }));
  };
  return (
    <>
      <AppHead title={`@${username}`} onBack={back} right={data?.user.online ? <span className="small green bold">online</span> : null} />
      <div className="app-body" style={{ background: '#eef2f6' }}>
        <div className="msgs">
          {data?.messages.length === 0 && <div className="center small muted" style={{ padding: 20 }}>{L('Anza stori! Sema "Mambo vipi?" 👋', 'Start chatting! Say "Mambo vipi?" 👋')}</div>}
          {data?.messages.map((m) => (
            <div key={m.id} className={`bubble ${m.from_id === me.id ? 'me' : ''}`}>
              {m.body}
              <small>{ago(m.created_at)}</small>
            </div>
          ))}
          <div ref={end} />
        </div>
      </div>
      <form className="composer" onSubmit={send}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={L('Andika ujumbe…', 'Write a message…')} maxLength={200} enterKeyHint="send" />
        <button className="btn btn-green btn-sm" disabled={!text.trim()}>{L('Tuma', 'Send')}</button>
      </form>
    </>
  );
}

export function Mtaa({ back, open }) {
  const feed = useStore((s) => s.publicFeed);
  const myName = useStore((s) => s.me?.username);
  const [text, setText] = useState('');
  const end = useRef();
  useEffect(() => end.current?.scrollIntoView({ block: 'end' }), [feed.length]);
  const send = (e) => {
    e.preventDefault();
    if (text.trim()) sendChat(text.trim());
    setText('');
  };
  return (
    <>
      <AppHead title={L('Mtaa · Chat ya wote', 'Street · Public chat')} onBack={back} />
      <div className="app-body" style={{ background: '#eef2f6' }}>
        <div className="msgs">
          {feed.map((m) => (
            <div key={`${m.mid ?? m.id}-${m.at}`} className={`bubble ${m.username === myName ? 'me' : ''}`}>
              {m.username !== myName && (
                <button className="bold small" style={{ display: 'block', color: 'var(--green-d)' }} onClick={() => open('dm', m.username)}>@{m.username}</button>
              )}
              {m.text}
              <small>{ago(m.at)}</small>
            </div>
          ))}
          <div ref={end} />
        </div>
      </div>
      <form className="composer" onSubmit={send}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={L('Niaje wanangu…', 'Hey everyone…')} maxLength={200} enterKeyHint="send" />
        <button className="btn btn-green btn-sm" disabled={!text.trim()}>{L('Tuma', 'Send')}</button>
      </form>
    </>
  );
}
