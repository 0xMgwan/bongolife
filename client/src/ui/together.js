import { L } from '../i18n.js';

/** "Together" interactions: both sims play them, so the other player accepts first (server: interact.js). */
export const TOGETHER = [
  { id: 'highfive', emoji: '✋', name: () => L('Gonga tano', 'High-five') },
  { id: 'fistbump', emoji: '👊', name: () => L('Gonga ngumi', 'Fist-bump') },
  { id: 'hug', emoji: '🤗', name: () => L('Kumbatia', 'Hug') },
  { id: 'dance', emoji: '💃', name: () => L('Cheza pamoja', 'Dance together') },
  { id: 'treat', emoji: '🍹', name: () => L('Mnunulie kinywaji', 'Treat them'), note: () => 'TSh 2,000' },
  { id: 'selfie', emoji: '🤳', name: () => L('Selfie', 'Selfie') },
  { id: 'fight', emoji: '🥊', name: () => L('Pigana kirafiki', 'Play-fight'), note: () => L('kirafiki tu', 'just for fun') },
];
export const togetherById = Object.fromEntries(TOGETHER.map((t) => [t.id, t]));

/** How each one looks: the avatar animation both sims play. */
export const TOGETHER_ANIM = { highfive: 'highfive', fistbump: 'highfive', hug: 'hug', dance: 'dance', treat: 'cheer', selfie: 'pose', fight: 'box' };
