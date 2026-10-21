// The "it's play money" disclaimer, shown wherever money comes up.
import { L } from '../i18n.js';

export const VIRTUAL_TEXT = () => L(
  'Pesa zote za Bongo Life (TSh za mchezoni) ni pesa za mchezo tu — si pesa halisi, hazina thamani nje ya mchezo na HAZIWEZI kutolewa, kuhamishiwa benki au M-Pesa, wala kubadilishwa kuwa pesa halisi.',
  'All Bongo Life money (in-game TSh) is virtual game currency only — it is not real money, has no value outside the game and CANNOT be withdrawn, cashed out, sent to a bank or mobile money, or exchanged for real money.',
);

export function VirtualNote({ compact = false, style }) {
  return (
    <div className={`virtual-note ${compact ? 'compact' : ''}`} style={style} role="note">
      <span className="vn-ic">🪙</span>
      <span>{VIRTUAL_TEXT()}</span>
    </div>
  );
}
