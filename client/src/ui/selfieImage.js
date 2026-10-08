// Branded selfie image (Bongo Life Brand Kit v1.0): Ink ground, the gold diagonal, the Taji
// crown lockup, both players with @username tags, and the play link. Drawn on a canvas so the
// card on screen is exactly the image that gets shared or saved.

const W = 1080;
const H = 1350;
const GOLD = '#F5B800';
const INK = '#0F172A';
const GROUND = '#F5F9FD';
const EMOJI = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

/** The Taji crown mark: three points, the flag's rising diagonal cut through it, a base bar. */
function crown(ctx, x, y, s, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s / 100, s / 100);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(6, 74); ctx.lineTo(6, 34); ctx.lineTo(30, 52); ctx.lineTo(50, 16);
  ctx.lineTo(70, 52); ctx.lineTo(94, 34); ctx.lineTo(94, 74); ctx.closePath();
  ctx.fill();
  // The diagonal cut (rises left to right) through the crown.
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.moveTo(0, 70); ctx.lineTo(100, 44); ctx.lineTo(100, 54); ctx.lineTo(0, 80); ctx.closePath();
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillRect(6, 84, 88, 12);
  ctx.restore();
}

function tag(ctx, cx, top, text) {
  ctx.font = `600 38px Archivo, sans-serif`;
  const w = ctx.measureText(text).width + 44;
  const h = 64;
  const x = cx - w / 2;
  ctx.fillStyle = GROUND;
  ctx.beginPath();
  ctx.moveTo(cx - 16, top + 14); ctx.lineTo(cx, top - 4); ctx.lineTo(cx + 16, top + 14); ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(x, top + 12, w, h, 32);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, top + 12 + h / 2 + 2);
}

/**
 * Render the selfie card and resolve with a PNG data URL.
 * @param {{ me: { username: string, face: string }, them: { username: string, face: string }, place: string, sw: boolean }} o
 */
export async function drawSelfie({ me, them, place, sw }) {
  try {
    await Promise.all([document.fonts.load('800 96px Archivo'), document.fonts.load('600 38px Archivo'), document.fonts.load('400 40px Archivo')]);
  } catch {}
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');

  // Ink ground with the gold diagonal block (as on the kit's social post).
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.moveTo(W * 0.38, 0); ctx.lineTo(W, 0); ctx.lineTo(W, H * 0.62); ctx.closePath();
  ctx.fill();

  // Lockup: mark + wordmark, flush left on one baseline.
  crown(ctx, 72, 64, 92, GROUND);
  ctx.fillStyle = GROUND;
  ctx.font = '800 58px Archivo, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('Bongo Life', 182, 140);

  // The two of you, side by side, each tagged.
  const faceY = H * 0.5;
  ctx.font = `300px ${EMOJI}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,.45)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 18;
  ctx.fillText(me.face, W * 0.3, faceY);
  ctx.fillText(them.face, W * 0.7, faceY);
  ctx.shadowColor = 'transparent';
  ctx.font = `110px ${EMOJI}`;
  ctx.fillText('🤳', W * 0.5, faceY - 210);
  tag(ctx, W * 0.3, faceY + 170, `@${me.username}`);
  tag(ctx, W * 0.7, faceY + 170, `@${them.username}`);

  // Headline, place and the way in.
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = GROUND;
  ctx.font = '800 104px Archivo, sans-serif';
  ctx.fillText(sw ? 'Selfie mtaani.' : 'Selfie in the city.', 72, H - 250);
  ctx.font = '400 42px Archivo, sans-serif';
  ctx.fillText(`📍 ${place}`, 72, H - 180);
  ctx.fillStyle = GOLD;
  ctx.fillRect(72, H - 132, 120, 6);
  ctx.fillStyle = GROUND;
  ctx.font = '600 38px Archivo, sans-serif';
  ctx.fillText(sw ? 'Cheza bure — play.bongolife.app' : 'Play free — play.bongolife.app', 72, H - 72);

  return c.toDataURL('image/png');
}
