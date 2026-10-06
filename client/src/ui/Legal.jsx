import { L } from '../i18n.js';
import { LangToggle } from './LangToggle.jsx';

export default function Legal() {
  const privacy = location.pathname === '/privacy';
  return (
    <div className="legal scroll">
      <div className="row between">
        <a href="/" className="small">← {L('Rudi Bongo Life', 'Back to Bongo Life')}</a>
        <LangToggle />
      </div>
      {privacy ? (
        <>
          <h1>{L('Sera ya Faragha', 'Privacy Policy')}</h1>
          <p>{L(
            'Tunahifadhi tu taarifa unazotupa: jina, username, password (iliyofichwa kwa bcrypt), email (hiari) na namba ya simu unayotumia kuongeza salio. Tunahifadhi pia shughuli zako ndani ya mchezo, meseji na matangazo uliyoweka.',
            'We only store what you give us: your name, username, password (hashed with bcrypt), optional email and the phone number you use to top up. We also store your in-game activity, messages and the ads you post.',
          )}</p>
          <p>{L(
            'Namba ya simu inatumwa kwa mtoa huduma wa malipo (nTZS) pale tu unapoongeza salio. Hatuuzi wala kushiriki taarifa zako na watangazaji.',
            'Your phone number is sent to our payment provider (nTZS) only when you top up. We never sell or share your data with advertisers.',
          )}</p>
          <p>{L(
            'Wasimamizi wanaweza kuona chat ya wazi kwa ajili ya usalama. Meseji za faragha (DM) hazionyeshwi kwenye admin panel.',
            'Moderators can see the public chat for safety. Private messages (DMs) are not shown in the admin panel.',
          )}</p>
          <p>{L('Unaweza kuomba akaunti yako ifutwe muda wowote kwa kuwasiliana na timu ya Bongo Life.', 'You can ask for your account to be deleted at any time by contacting the Bongo Life team.')}</p>
        </>
      ) : (
        <>
          <h1>{L('Masharti ya Matumizi', 'Terms of Use')}</h1>
          <p>{L('Bongo Life ni mchezo wa watu wenye miaka 18 na kuendelea. Kwa kujisajili unathibitisha umri wako.', 'Bongo Life is for people aged 18 and over. By signing up you confirm your age.')}</p>
          <p>{L(
            <><b>Pesa ya mchezo:</b> TSh za ndani ya mchezo hazina thamani nje ya Bongo Life, haziwezi kutolewa kama pesa taslimu, na hazirudishwi baada ya kununuliwa isipokuwa kama sheria inavyotaka.</>,
            <><b>In-game money:</b> in-game TSh has no value outside Bongo Life, cannot be cashed out, and is non-refundable once bought except where the law requires.</>,
          )}</p>
          <p>{L(
            <><b>Tabia:</b> Usitukane, usinyanyase, usitume utapeli wala maudhui ya ngono au chuki. Akaunti zinazokiuka zinaweza kunyamazishwa au kufungiwa.</>,
            <><b>Conduct:</b> No insults, harassment, scams, sexual or hateful content. Accounts that break the rules may be muted or banned.</>,
          )}</p>
          <p>{L(
            <><b>Matangazo:</b> Wewe ndiye unawajibika na tangazo lako na link yake. Usitangaze bidhaa haramu, kamari au huduma za kifedha zisizo na leseni. Matangazo yanayokiuka yataondolewa.</>,
            <><b>Ads:</b> You are responsible for your ad and its link. No illegal goods, gambling or unlicensed financial services. Violating ads will be removed.</>,
          )}</p>
          <p>{L('Maeneo halisi ya Dar es Salaam yametumika kwa burudani; biashara zilizo kwenye mchezo ni za kubuni.', 'Real Dar es Salaam places are used for fun; the businesses in the game are fictional.')}</p>
        </>
      )}
    </div>
  );
}
