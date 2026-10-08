import { CITIES, PLACES, cityAt, TRIP_MODES, tripKey, fmtShort } from '@shared/world.js';
import { useStore } from '../../store.js';
import { local } from '../../net.js';
import { AppHead } from '../Phone.jsx';
import { L, loc } from '../../i18n.js';

const BLURB = {
  dar: ['Jiji la biashara — Kariakoo, Masaki, Coco Beach na Elements.', 'The business city — Kariakoo, Masaki, Coco Beach and Elements.'],
  znz: ['Mji Mkongwe, Forodhani, Nungwi na Full Moon Party ya Kendwa.', 'Stone Town, Forodhani, Nungwi and the Kendwa Full Moon Party.'],
  aru: ['Lango la safari: Ngorongoro, Serengeti, Kilimanjaro na Mlima Meru.', 'The safari gateway: Ngorongoro, Serengeti, Kilimanjaro and Mount Meru.'],
};
const FEATURED = { dar: ['kariakoo', 'lounge', 'coco', 'casino'], znz: ['stonetown', 'forodhani', 'nungwi', 'kendwa', 'therock'], aru: ['safari', 'meru', 'maasai', 'clocktower', 'coffee'] };

/** Book a trip to Zanzibar, Arusha or back to Dar. */
export function Safari({ back }) {
  const here = cityAt(local.x, local.z)?.id || 'dar';
  const book = (placeId) => useStore.setState({ phone: null, sheet: { type: 'travel', id: placeId } });
  return (
    <>
      <AppHead title={L('Safari · Miji', 'Travel · Cities')} onBack={back} />
      <div className="app-body">
        {CITIES.map((c) => {
          const cheapest = Object.values(TRIP_MODES).map((m) => m.price[tripKey(here, c.id)]).filter(Boolean).sort((a, b) => a - b)[0];
          const modes = Object.values(TRIP_MODES).filter((m) => m.price[tripKey(here, c.id)]).map((m) => m.emoji).join(' ');
          return (
            <div key={c.id} className={`city-card ${c.id}`}>
              <div className="cc-top">
                <span className="cc-ic">{c.icon}</span>
                <div className="grow">
                  <b>{c.name}</b>
                  <small>{c.id === here ? L('Uko hapa sasa', "You're here") : `${modes} · ${L('kuanzia', 'from')} TSh ${fmtShort(cheapest)}`}</small>
                </div>
              </div>
              <p>{L(...BLURB[c.id])}</p>
              <div className="cc-places">
                {FEATURED[c.id].map((id) => {
                  const p = PLACES.find((x) => x.id === id);
                  return p ? <button key={id} onClick={() => book(id)}>{p.icon} {loc(p)}</button> : null;
                })}
              </div>
            </div>
          );
        })}
        <div className="hint">{L('🛡️ Ongeza bima ya safari kuepuka wahala barabarani, baharini au angani.', '🛡️ Add travel insurance to avoid wahala on the road, at sea or in the air.')}</div>
      </div>
    </>
  );
}
