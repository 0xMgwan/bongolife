import { useEffect, useState } from 'react';
import { audioSettings, onAudioSettings } from '../audio.js';

export function useAudioSettings() {
  const [s, setS] = useState({ ...audioSettings });
  useEffect(() => onAudioSettings(setS), []);
  return s;
}
