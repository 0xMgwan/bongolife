import { furnitureById } from '@shared/world.js';
import { useStore } from '../store.js';
import { loadHome } from './HomeUI.jsx';
import { homeAvatar } from '../three/HomeScene.jsx';
import { L } from '../i18n.js';

/** Open Kwangu and walk to the first item of a category (sleep/bath/kitchen), then open it. */
export async function goHomeTo(cat) {
  useStore.setState({ tab: 'home', phone: null, sheet: null, visiting: null });
  if (!useStore.getState().homeItems.length) await loadHome();
  const item = useStore.getState().homeItems.find((i) => furnitureById[i.item]?.cat === cat && furnitureById[i.item]?.use);
  if (!item) {
    useStore.getState().toast(L('Huna kitu hicho bado — kinunue Dukani.', "You don't have one yet — buy it in the Shop."));
    return;
  }
  homeAvatar.target = [item.x, item.z + 0.9];
  homeAvatar.arrive = () => useStore.setState({ homeSel: item.id });
}
