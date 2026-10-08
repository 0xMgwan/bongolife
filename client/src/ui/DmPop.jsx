import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store.js';
import { api } from '../api.js';
import { sendDm } from '../net.js';
import { L } from '../i18n.js';

const IDLE_MS = 12_000;

/**
 * A DM pops up beside the 💬 button: the last few lines of that conversation and a reply box,
 * so you can keep chatting without leaving the city. Opening it marks the thread read.
 */
export function DmPop() {
  const pop = useStore((s) => s.dmPop);
  if (!pop) return null;
  return <Bubble key={pop.from} from={pop.from} />;
}

function Bubble({ from }) {
  const me = useStore((s) => s.me);
  const lastDm = useStore((s) => s.lastDm);
  const [thread, setThread] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [poke, setPoke] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const input = useRef(null);
  const list = useRef(null);

  const close = () => {
    setLeaving(true);
    setTimeout(() => useStore.setState({ dmPop: null }), 220);
  };

  // Load the conversation (this also marks it read), then refresh the unread count.
  useEffect(() => {
    api(`/messages/dm/${encodeURIComponent(from)}`)
      .then((d) => {
        setThread(d);
        useStore.getState().refreshMe().catch(() => {});
      })
      .catch(() => close());
  }, [from]); // eslint-disable-line react-hooks/exhaustive-deps

  // New messages in this conversation (theirs, or ours echoed back) join the bubble.
  useEffect(() => {
    if (!lastDm || !thread) return;
    const other = thread.user.id;
    const involved = (lastDm.from_id === other && lastDm.to_id === me.id) || (lastDm.from_id === me.id && lastDm.to_id === other);
    if (involved && !thread.messages.some((m) => m.id === lastDm.id)) {
      setThread({ ...thread, messages: [...thread.messages, lastDm] });
      setPoke((n) => n + 1);
      if (lastDm.from_id === other) api(`/messages/dm/${encodeURIComponent(from)}`).then(() => useStore.getState().refreshMe()).catch(() => {});
    }
  }, [lastDm]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [thread]);

  // Tuck away after a while — but never while you're typing a reply.
  useEffect(() => {
    if (text || document.activeElement === input.current) return;
    const t = setTimeout(close, IDLE_MS);
    return () => clearTimeout(t);
  }, [poke, text]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    const r = await sendDm(from, body);
    setBusy(false);
    if (r?.error) return useStore.getState().toast(r.error, 'err');
    // The server doesn't echo your own message back; add it from the send result.
    if (r?.msg) setThread((t) => (t && !t.messages.some((m) => m.id === r.msg.id) ? { ...t, messages: [...t.messages, r.msg] } : t));
    setText('');
    input.current?.focus({ preventScroll: true });
  };
  const openFull = () => {
    useStore.setState({ dmPop: null, phone: 'dm', phoneArg: from });
  };
  const askAlerts = async () => {
    try {
      await Notification.requestPermission();
    } catch {}
    setPoke((n) => n + 1);
  };
  const canAsk = typeof Notification !== 'undefined' && Notification.permission === 'default';
  const lines = (thread?.messages || []).slice(-4);

  return (
    <div className={`dm-pop ${leaving ? 'leaving' : ''}`} role="dialog" aria-label={`@${from}`} onPointerDown={() => setPoke((n) => n + 1)}>
      <div className="dm-head">
        <b>💬 @{from}</b>
        <button className="dm-open" onClick={openFull}>{L('Fungua', 'Open')} ›</button>
        <button className="dm-x" onClick={close} aria-label={L('Funga', 'Close')}>✕</button>
      </div>
      <div className="dm-lines" ref={list}>
        {!thread && <div className="dm-line theirs">…</div>}
        {lines.map((m) => (
          <div key={m.id} className={`dm-line ${m.from_id === me.id ? 'mine' : 'theirs'}`}>{m.body}</div>
        ))}
      </div>
      <form className="dm-reply" onSubmit={send}>
        <input
          ref={input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setPoke((n) => n + 1)}
          placeholder={L(`Jibu @${from}…`, `Reply to @${from}…`)}
          maxLength={500}
          enterKeyHint="send"
        />
        <button className="dm-send" disabled={!text.trim() || busy} aria-label={L('Tuma', 'Send')}>➤</button>
      </form>
      {canAsk && <button className="dm-alerts" onClick={askAlerts}>🔔 {L('Nijulishe kwenye simu', 'Alert me on my phone')}</button>}
    </div>
  );
}
