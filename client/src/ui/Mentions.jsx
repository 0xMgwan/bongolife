import { useMemo } from 'react';
import { useStore } from '../store.js';
import { remotes } from '../net.js';
import { sfx } from '../audio.js';

const MENTION = /(@[a-z0-9_.]{3,24})/gi;

/** Chat text with @names highlighted and tappable (opens their profile). */
export function MentionText({ text }) {
  const me = useStore((s) => s.me?.username?.toLowerCase());
  const parts = String(text || '').split(MENTION);
  return parts.map((p, i) => {
    if (!MENTION.test(p)) { MENTION.lastIndex = 0; return <span key={i}>{p}</span>; }
    MENTION.lastIndex = 0;
    const name = p.slice(1);
    return (
      <button key={i} className={`mention ${name.toLowerCase() === me ? 'me' : ''}`} onClick={(e) => { e.stopPropagation(); sfx('click'); useStore.setState({ phone: null, sheet: { type: 'player', id: name } }); }}>{p}</button>
    );
  });
}

/** While typing "@ab…", suggest players who are around or chatting. */
export function MentionSuggest({ text, setText }) {
  const feed = useStore((s) => s.publicFeed);
  const me = useStore((s) => s.me?.username);
  const m = /(^|\s)@([a-z0-9_.]*)$/i.exec(text);
  const names = useMemo(() => {
    if (!m) return [];
    const q = m[2].toLowerCase();
    const pool = new Set([...[...remotes.values()].map((r) => r.username), ...feed.slice(-40).map((f) => f.username)]);
    pool.delete(me);
    return [...pool].filter((n) => n && n.toLowerCase().startsWith(q)).slice(0, 6);
  }, [m?.[2], feed.length]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!names.length) return null;
  return (
    <div className="mention-suggest">
      {names.map((n) => <button key={n} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setText(text.replace(/@([a-z0-9_.]*)$/i, `@${n} `))}>@{n}</button>)}
    </div>
  );
}
