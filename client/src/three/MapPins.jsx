// Map overview: a pin above every player in town (you in green), tappable for their profile.
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { emojiTexture, labelTexture } from './textures.js';
import { avatarEmoji } from './Avatar.jsx';
import { remotes, local } from '../net.js';
import { useStore } from '../store.js';

function Pin({ getPos, appearance, username, me, onClick }) {
  const g = useRef();
  const face = useMemo(() => emojiTexture(avatarEmoji(appearance), { ring: me ? '#2fb06f' : '#ffffff' }), [appearance, me]);
  const tag = useMemo(() => labelTexture(`@${username}`, { size: 30, bg: me ? '#2fb06f' : 'rgba(17,24,39,.8)', fg: '#fff' }), [username, me]);
  useFrame(() => {
    const [x, z] = getPos();
    g.current.position.set(x, 9, z);
  });
  return (
    <group ref={g}>
      <sprite scale={[0.075, 0.075, 1]} onClick={onClick} renderOrder={9}>
        <spriteMaterial map={face} depthTest={false} sizeAttenuation={false} />
      </sprite>
      <sprite scale={[0.024 * tag.aspect, 0.024, 1]} center={[0.5, 2.6]} renderOrder={9}>
        <spriteMaterial map={tag.texture} depthTest={false} sizeAttenuation={false} />
      </sprite>
    </group>
  );
}

export function MapPins({ me, onPlayer }) {
  const roster = useStore((s) => s.roster);
  const list = useMemo(() => [...remotes.values()].filter((r) => !r.inside), [roster]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <group>
      {me && <Pin me getPos={() => [local.x, local.z]} appearance={me.appearance} username={me.username} />}
      {list.map((r) => (
        <Pin key={r.id} getPos={() => [r.tx, r.tz]} appearance={r.appearance} username={r.username}
          onClick={(e) => { e.stopPropagation(); onPlayer?.(r); }} />
      ))}
    </group>
  );
}
