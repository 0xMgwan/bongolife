// In-game camera: hide the HUD, frame your shot, snap it with a Bongo Life frame, then save it to
// your phone's gallery or post it to Bongo Gist.
import { useEffect, useState } from 'react';
import { useStore } from '../store.js';
import { api } from '../api.js';
import { sfx } from '../audio.js';
import { L } from '../i18n.js';

/** Set by the 3D canvas (see GameScene): renders a fresh frame and returns it as a canvas. */
export const cameraHook = { grab: null };

function compose(src, { username, place }) {
  // Frame + watermark: a cream border, the place and the date, @username and the crown.
  const W = src.width, H = src.height;
  const pad = Math.round(W * 0.03), foot = Math.round(W * 0.09);
  const c = document.createElement('canvas');
  c.width = W + pad * 2; c.height = H + pad + foot;
  const x = c.getContext('2d');
  x.fillStyle = '#fffdf8'; x.fillRect(0, 0, c.width, c.height);
  x.drawImage(src, pad, pad, W, H);
  x.fillStyle = '#141414';
  const fs = Math.round(foot * 0.34);
  x.font = `900 ${fs}px "Archivo Variable","Archivo","Arial Narrow",sans-serif`;
  x.textBaseline = 'middle';
  x.fillText('👑 BONGO LIFE', pad, H + pad + foot / 2);
  x.font = `700 ${Math.round(fs * 0.7)}px "Plus Jakarta Sans",sans-serif`;
  x.textAlign = 'right';
  const date = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  x.fillText(`@${username}${place ? ' · ' + place : ''} · ${date}`, c.width - pad, H + pad + foot / 2);
  return c;
}
const toBlob = (c) => new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));

export function CameraOverlay() {
  const on = useStore((s) => s.cameraMode);
  const me = useStore((s) => s.me);
  const place = useStore((s) => s.cameraPlace);
  const [shot, setShot] = useState(null); // { url, blob }
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useStore((s) => s.toast);
  useEffect(() => { if (!on) { setShot(null); setCaption(''); } }, [on]);
  if (!on) return null;
  const close = () => useStore.setState({ cameraMode: false });
  const snap = async () => {
    const src = cameraHook.grab?.();
    if (!src) return toast(L('Kamera haipatikani hapa.', "The camera isn't available here."), 'err');
    sfx('pop');
    document.body.classList.add('cam-flash');
    setTimeout(() => document.body.classList.remove('cam-flash'), 300);
    const framed = compose(src, { username: me.username, place });
    const blob = await toBlob(framed);
    setShot({ url: URL.createObjectURL(blob), blob });
  };
  const save = async () => {
    const file = new File([shot.blob], `bongo-life-${Date.now()}.jpg`, { type: 'image/jpeg' });
    // Phones: the share sheet has "Save Image" (Gallery / Photos). Computers: a download.
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Bongo Life', text: caption || 'Bongo Life 🇹🇿' }); return; } catch (e) { if (e?.name === 'AbortError') return; }
    }
    const a = document.createElement('a');
    a.href = shot.url; a.download = file.name; a.click();
    toast(L('📥 Picha imehifadhiwa', '📥 Photo saved'));
  };
  const post = async () => {
    setBusy(true);
    try {
      const form = new FormData();
      form.append('photo', shot.blob, 'photo.jpg');
      form.append('caption', caption);
      form.append('place', place || '');
      await api('/gist', { method: 'POST', form });
      sfx('coin');
      toast(L('📸 Imepostiwa kwenye Bongo Gist!', '📸 Posted to Bongo Gist!'));
      useStore.setState({ cameraMode: false });
      useStore.getState().openPhone('gist');
    } catch (e) { toast(e.message, 'err'); }
    setBusy(false);
  };
  if (shot) {
    return (
      <div className="cam-preview">
        <img src={shot.url} alt="" />
        <input className="field" maxLength={200} placeholder={L('Andika maelezo… (si lazima)', 'Write a caption… (optional)')} value={caption} onChange={(e) => setCaption(e.target.value)} />
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button className="btn btn-green" disabled={busy} onClick={post}>📤 {L('Posti Gist', 'Post to Gist')}</button>
          <button className="btn btn-white" onClick={save}>💾 {L('Hifadhi Gallery', 'Save to Gallery')}</button>
          <button className="btn btn-ghost" onClick={() => setShot(null)}>↺ {L('Piga tena', 'Retake')}</button>
          <button className="btn btn-ghost" onClick={close}>✕</button>
        </div>
      </div>
    );
  }
  return (
    <div className="cam-ui">
      <div className="cam-frame" />
      <div className="cam-hint">{L('Zungusha kamera kwa kidole, kisha piga picha', 'Drag to frame your shot, then snap')}</div>
      <div className="cam-bar">
        <button className="cam-x" onClick={close}>✕</button>
        <button className="cam-shutter" onClick={snap} aria-label={L('Piga picha', 'Take photo')} />
        <span style={{ width: 44 }} />
      </div>
    </div>
  );
}

export function openCamera(place) {
  useStore.setState({ cameraMode: true, cameraPlace: place || null, phone: null });
}
