import { AppHead } from '../Phone.jsx';
import { L } from '../../i18n.js';

const SECTIONS = [
  ['🚶', ['Kutembea', 'Getting around'], ['Gusa ardhi au tumia joystick. Vuta skrini kuzungusha kamera. Kwenye Mjini, chips za juu zinakupeleka kwenye ramani.', 'Tap the ground or use the joystick. Drag the screen to turn the camera. In Town, the chips at the top open the map.']],
  ['🍛', ['Mahitaji', 'Needs'], ['Njaa, Nguvu, Raha, Usafi na Jamii zikishuka, mood na mshahara vinashuka. Vidokezo vilivyo juu vinakuonyesha cha kufanya.', 'When Hunger, Energy, Fun, Hygiene or Social drop, your mood and pay drop too. The tips at the top tell you what to do.']],
  ['🏠', ['Kwangu', 'Home'], ['Lala, oga na pika nyumbani. Kwenye Duka nunua fanicha, iburute mahali unapotaka, izungushe na uweke.', 'Sleep, shower and cook at home. In the Shop, buy furniture, drag it where you want it, rotate and place.']],
  ['💼', ['Kazi na pesa', 'Jobs & money'], ['Fanya shifti upate mshahara na upandishwe cheo. Ongeza salio kwa M-Pesa kwenye Bongo Pesa. Pesa ya mchezo haitolewi.', 'Work shifts to earn and get promoted. Top up with M-Pesa in Bongo Pesa. In-game money cannot be withdrawn.']],
  ['🪩', ['Starehe', 'Going out'], ['Ingia ndani ya 1245 Club, Elements, Bar ya Kona au Uwanja wa Benjamin Mkapa uone wanaocheza na ujiunge.', 'Go inside 1245 Club, Elements, the Corner Bar or Benjamin Mkapa Stadium to see who is there and join in.']],
  ['📢', ['Matangazo', 'Ads'], ['Mabango ni skrini za kidijitali: tangazo lako linapokezana na mengine kila sekunde 10.', 'Billboards are digital screens: your ad takes turns with others every 10 seconds.']],
];

export function Msaada({ back }) {
  return (
    <>
      <AppHead title={L('Msaada & Mwongozo', 'Help & guide')} onBack={back} />
      <div className="app-body">
        {SECTIONS.map(([icon, t, b]) => (
          <div key={t[1]} className="box">
            <div className="bold" style={{ marginBottom: 4 }}>{icon} {L(...t)}</div>
            <div className="small muted" style={{ lineHeight: 1.55 }}>{L(...b)}</div>
          </div>
        ))}
        <div className="small muted center">{L('Bado una swali? Tuandikie', 'Still stuck? Email')} support@bongolife.app</div>
      </div>
    </>
  );
}
