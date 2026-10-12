// Live room bar: join the voice chat of the venue you're in, see who's talking, mute, leave.
import { useEffect } from 'react';
import { useStore } from '../store.js';
import { joinVoice, leaveVoice, toggleMute, pollVoice, resumeAudio } from '../voice.js';
import { L } from '../i18n.js';

export function VoiceBar({ room }) {
  const v = useStore((s) => s.voice) || {};
  const toast = useStore((s) => s.toast);
  useEffect(() => { pollVoice(); }, [room]);
  // Leaving the room ends the call.
  useEffect(() => () => { const st = useStore.getState().voice; if (st?.on && st.kind === 'room') leaveVoice(); }, [room]);
  const live = v.room === room ? v.count || 0 : 0;
  if (v.on && v.kind === 'call') return null; // you're on a call; the call bar shows instead
  if (!v.on) {
    return (
      <button className="voice-join" onClick={async () => {
        const r = await joinVoice();
        if (r.error === 'mic') toast(L('Ruhusu maikrofoni kuongea.', 'Allow the microphone to talk.'), 'err');
        else if (r.error === 'full') toast(L('Chumba kimejaa (watu 8).', 'The room is full (8 people).'), 'err');
        else if (r.error) toast(L('Imeshindikana kuunganisha sauti.', "Couldn't connect voice."), 'err');
      }}>
        🎙️ {live ? L(`Live · ${live} wanaongea — jiunge`, `Live · ${live} talking — join`) : L('Anzisha chumba cha sauti', 'Start a live room')}
      </button>
    );
  }
  return (
    <div className="voice-bar">
      <span className={`vb-me ${v.meSpeaking && !v.muted ? 'talk' : ''}`}>{v.muted ? '🔇' : '🎙️'} {L('Wewe', 'You')}</span>
      {(v.peers || []).map((p) => <span key={p.id} className={`vb-p ${p.speaking ? 'talk' : ''} ${p.state !== 'connected' ? 'dim' : ''}`}>@{p.username}{p.state === 'failed' ? ' ⚠️' : p.state !== 'connected' ? ' …' : ''}</span>)}
      {v.needTap && <button onClick={resumeAudio}>🔊 {L('Gusa kusikia', 'Tap to hear')}</button>}
      {!(v.peers || []).length && <span className="vb-wait">{L('Unasubiri wengine…', 'Waiting for others…')}</span>}
      <button onClick={toggleMute}>{v.muted ? L('Washa mic', 'Unmute') : L('Zima mic', 'Mute')}</button>
      <button className="vb-leave" onClick={leaveVoice}>{L('Toka', 'Leave')}</button>
    </div>
  );
}
