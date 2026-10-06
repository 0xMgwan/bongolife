// Legal documents for Bongo Life, in Kiswahili and English.
// ⚠️ Fill in OPERATOR before launch and have a Tanzanian advocate review the final text.

export const OPERATOR = {
  brand: 'Bongo Life',
  entity: 'NEDA Labs Limited', // legal entity that runs the game
  address: 'Dar es Salaam, Tanzania',
  email: 'support@bongolife.app',
  privacyEmail: 'privacy@bongolife.app',
  adsEmail: 'ads@bongolife.app',
  updated: ['6 Oktoba 2026', '6 October 2026'],
};

const O = OPERATOR;
const CUR = ['Shilingi za Bongo (TSh za mchezo)', 'Bongo Shillings (in-game TSh)'];

// Section body items: [sw, en] for a paragraph, or { list: [[sw, en], ...] }.
export const DOCS = {
  terms: {
    path: '/terms',
    title: ['Masharti ya Matumizi', 'Terms of Service'],
    intro: [
      `Masharti haya ni makubaliano kati yako na ${O.entity} ("sisi"), mwendeshaji wa ${O.brand}. Kwa kufungua akaunti au kucheza, unakubali Masharti haya, Sera ya Faragha na Sera ya Matangazo. Kama hukubaliani, usitumie ${O.brand}.`,
      `These Terms are an agreement between you and ${O.entity} ("we", "us"), the operator of ${O.brand}. By creating an account or playing, you accept these Terms, our Privacy Policy and our Advertising Policy. If you do not agree, do not use ${O.brand}.`,
    ],
    sections: [
      {
        h: ['1. Umri na sifa', '1. Eligibility'],
        body: [
          { list: [
            ['Lazima uwe na miaka 18 au zaidi.', 'You must be at least 18 years old.'],
            ['Akaunti moja kwa mtu mmoja. Taarifa unazotoa ziwe za kweli.', 'One account per person. The information you give us must be true.'],
            ['Huwezi kutumia huduma kama umefungiwa awali au sheria inakukataza.', 'You may not use the service if you were previously banned or the law prohibits you.'],
          ] },
        ],
      },
      {
        h: ['2. Akaunti yako', '2. Your account'],
        body: [
          ['Unawajibika kulinda password yako na kila kinachofanyika kwenye akaunti yako. Usimpe mtu mwingine akaunti yako wala kuiuza. Tujulishe mara moja ukihisi akaunti yako imeingiliwa.',
            'You are responsible for keeping your password safe and for everything done through your account. Do not share, sell or transfer your account. Tell us immediately if you think it has been compromised.'],
          ['Bila email, hatuwezi kukusaidia kurudisha password iliyopotea.', 'Without an email address we cannot help you recover a lost password.'],
        ],
      },
      {
        h: ['3. Mchezo na vitu vya kidijitali', '3. The game and virtual items'],
        body: [
          [`Tunakupa ruhusa binafsi, isiyo ya kipekee na inayoweza kusitishwa ya kucheza ${O.brand}. Viwanja, nyumba, magari, nguo, biashara na vitu vingine vya ndani ya mchezo ni leseni ya matumizi tu — si mali halisi, na hayana thamani nje ya mchezo.`,
            `We give you a personal, non-exclusive, revocable licence to play ${O.brand}. Plots, houses, vehicles, outfits, businesses and every other in-game item are a licence to use only — they are not real property and have no value outside the game.`],
          ['Tunaweza kubadilisha bei, mishahara, mapato, ramani na sheria za mchezo ili kuweka uwiano mzuri. Mabadiliko haya yanaweza kuathiri thamani ya vitu ulivyonavyo.',
            'We may change prices, wages, income, the map and game rules to keep the game balanced. Such changes may affect the value of items you hold.'],
        ],
      },
      {
        h: [`4. ${CUR[0]}`, `4. ${CUR[1]}`],
        body: [
          [`Pesa ya ndani ya mchezo ("${CUR[0]}") SI shilingi halisi za Tanzania, SI pesa ya kielektroniki (e-money) na SI amana. Ni kipimo cha kidijitali cha kucheza tu.`,
            `The in-game currency ("${CUR[1]}") is NOT Tanzanian shillings, NOT electronic money and NOT a deposit. It is a digital game token only.`],
          { list: [
            ['Unaweza kuinunua kwa TZS halisi kupitia mobile money (M-Pesa, Mixx by Yas, Airtel Money) au njia nyingine tunazotoa. Kiwango cha ubadilishaji kinaonyeshwa kabla ya kulipa.',
              'You may buy it with real TZS through mobile money (M-Pesa, Mixx by Yas, Airtel Money) or other methods we offer. The exchange rate is shown before you pay.'],
            ['HAIWEZI kutolewa, kubadilishwa kuwa pesa taslimu, kuhamishiwa benki au mobile money, wala kurudishwa kama TZS — kwa namna yoyote.',
              'It CANNOT be withdrawn, cashed out, sent to a bank or mobile money account, or converted back into TZS — in any way.'],
            ['Haina riba, haina dhamana ya serikali, na haiwezi kutumika nje ya Bongo Life.', 'It earns no interest, carries no government guarantee and cannot be used outside Bongo Life.'],
            ['Kutuma pesa kwa mchezaji mwingine kunaruhusiwa ndani ya mchezo tu. Ni MARUFUKU kuuza au kununua pesa ya mchezo, vitu au akaunti kwa pesa halisi nje ya mchezo.',
              'Sending money to another player is allowed inside the game only. Selling or buying in-game money, items or accounts for real money outside the game is PROHIBITED.'],
            ['Akaunti ikifungiwa kwa kuvunja Masharti, salio na vitu vyake vinaweza kupotea bila fidia.', 'If an account is banned for breaking these Terms, its balance and items may be forfeited without compensation.'],
          ] },
        ],
      },
      {
        h: ['5. Malipo na urejeshaji', '5. Payments and refunds'],
        body: [
          ['Malipo yanachakatwa na mshirika wetu wa malipo (nTZS) na mitandao ya simu. Hatuoni wala kuhifadhi PIN yako. Lazima utumie namba ya simu iliyosajiliwa kwa jina lako au uliyoruhusiwa kuitumia.',
            'Payments are processed by our payment partner (nTZS) and mobile networks. We never see or store your PIN. You must use a phone number registered in your name or that you are authorised to use.'],
          ['Ununuzi wa pesa ya mchezo ni wa mwisho. Tutarudisha pesa tu pale: (a) ulikatwa lakini salio halikuingia; (b) ulikatwa mara mbili kwa kosa; au (c) sheria inatutaka. Tuandikie ndani ya siku 30 ukiwa na namba ya muamala.',
            'Purchases of in-game currency are final. We refund only where: (a) you were charged but the balance was not credited; (b) you were charged twice by mistake; or (c) the law requires it. Contact us within 30 days with the transaction reference.'],
          ['Malipo ya matangazo yanafuata Sera ya Matangazo.', 'Payments for ads follow the Advertising Policy.'],
        ],
      },
      {
        h: ['6. Tabia', '6. Conduct'],
        body: [
          ['Hauruhusiwi:', 'You must not:'],
          { list: [
            ['kutukana, kunyanyasa, kutishia au kudhalilisha wengine;', 'insult, harass, threaten or demean others;'],
            ['kutuma maudhui ya ngono, chuki, ukabila, udini au ubaguzi;', 'post sexual, hateful, tribal, religious-hate or discriminatory content;'],
            ['kufanya utapeli, kuomba pesa halisi, au kuweka links za hila (phishing);', 'scam, solicit real money, or share deceptive (phishing) links;'],
            ['kujifanya mtu mwingine, kampuni au mfanyakazi wa Bongo Life;', 'impersonate any person, company or Bongo Life staff;'],
            ['kutumia bots, hacks, kudukua au kutumia hitilafu (bugs) kujinufaisha;', 'use bots, cheats, hacks or exploit bugs for advantage;'],
            ['kuuza vitu vya mchezo kwa pesa halisi au kufungua akaunti nyingi kwa udanganyifu;', 'trade in-game items for real money or create multiple accounts to cheat;'],
            ['kuvunja Sheria ya Makosa ya Mtandao, 2015 au sheria nyingine za Tanzania.', 'break the Cybercrimes Act, 2015 or any other law of Tanzania.'],
          ] },
        ],
      },
      {
        h: ['7. Maudhui yako', '7. Your content'],
        body: [
          ['Unabaki kuwa mmiliki wa meseji, majina na matangazo unayoweka. Unatupa leseni ya bure, ya dunia nzima, ya kuyaonyesha, kuyahifadhi na kuyasambaza ndani ya huduma kwa ajili ya kuendesha mchezo. Unathibitisha una haki zote juu ya maudhui hayo.',
            'You keep ownership of the messages, names and ads you post. You give us a free, worldwide licence to display, store and distribute them within the service in order to run the game. You confirm you hold all rights needed for that content.'],
        ],
      },
      {
        h: ['8. Usimamizi', '8. Moderation and enforcement'],
        body: [
          ['Tunaweza, bila taarifa ya awali, kufuta maudhui, kunyamazisha, kusimamisha au kufunga akaunti, kuondoa vitu au salio lililopatikana kwa udanganyifu, na kutoa taarifa kwa mamlaka pale sheria inapotutaka. Unaweza kukata rufaa kwa kutuandikia.',
            'We may, without prior notice, remove content, mute, suspend or close accounts, remove items or balances obtained by cheating, and report to the authorities where the law requires. You may appeal by writing to us.'],
        ],
      },
      {
        h: ['9. Upatikanaji wa huduma', '9. Availability'],
        body: [
          ['Huduma inatolewa "kama ilivyo". Tunaweza kuifunga kwa matengenezo, kubadilisha au kusitisha kipengele chochote. Hatuahidi kwamba haitakuwa na hitilafu au kukatika.',
            'The service is provided "as is". We may take it down for maintenance, change or discontinue any feature. We do not promise it will be error-free or uninterrupted.'],
        ],
      },
      {
        h: ['10. Hakimiliki na maeneo halisi', '10. Intellectual property and real places'],
        body: [
          [`${O.brand}, nembo yake, michoro na code ni mali ya ${O.entity}. Maeneo halisi ya Dar es Salaam yametumika kwa burudani tu. Biashara, majina ya vilabu na chapa zilizotajwa ndani ya mchezo hazijaidhinisha wala kuhusiana na ${O.brand}, isipokuwa pale imeelezwa wazi kuwa ni ubia.`,
            `${O.brand}, its logo, artwork and code belong to ${O.entity}. Real Dar es Salaam locations are used for entertainment only. Businesses, club names and brands mentioned in the game do not endorse and are not affiliated with ${O.brand}, unless clearly marked as a partnership.`],
        ],
      },
      {
        h: ['11. Kikomo cha dhima', '11. Limitation of liability'],
        body: [
          ['Kwa kiwango kinachoruhusiwa na sheria za Tanzania, hatutawajibika kwa hasara isiyo ya moja kwa moja, kupotea kwa vitu vya mchezo, au faida iliyopotea. Jumla ya dhima yetu kwako haitazidi kiasi ulichotulipa katika miezi 6 iliyopita.',
            'To the extent permitted by Tanzanian law, we are not liable for indirect losses, loss of in-game items, or lost profits. Our total liability to you will not exceed the amount you paid us in the previous 6 months.'],
          ['Unakubali kutufidia kwa madai yanayotokana na ukiukaji wako wa Masharti haya au maudhui uliyoweka.', 'You agree to indemnify us against claims arising from your breach of these Terms or content you posted.'],
        ],
      },
      {
        h: ['12. Kufunga akaunti', '12. Closing your account'],
        body: [
          [`Unaweza kuomba akaunti yako ifungwe muda wowote kwa kutuandikia ${O.email}. Salio la mchezo halitarejeshwa kama pesa. Baadhi ya kumbukumbu za malipo zitahifadhiwa kama sheria inavyotaka.`,
            `You can ask us to close your account at any time by writing to ${O.email}. Remaining in-game balance is not refunded as money. Some payment records are kept as the law requires.`],
        ],
      },
      {
        h: ['13. Sheria inayotumika', '13. Governing law'],
        body: [
          ['Masharti haya yanaongozwa na sheria za Jamhuri ya Muungano wa Tanzania. Migogoro tutajaribu kwanza kuimaliza kwa mazungumzo; ikishindikana, itasikilizwa na mahakama zenye mamlaka Dar es Salaam.',
            'These Terms are governed by the laws of the United Republic of Tanzania. We will first try to resolve disputes by negotiation; failing that, they will be heard by the competent courts in Dar es Salaam.'],
        ],
      },
      {
        h: ['14. Mabadiliko', '14. Changes'],
        body: [
          ['Tunaweza kubadilisha Masharti haya. Mabadiliko makubwa tutayatangaza ndani ya mchezo kabla hayajaanza kutumika. Ukiendelea kucheza baada ya hapo, umekubali.',
            'We may update these Terms. We will announce significant changes in the game before they take effect. Continuing to play afterwards means you accept them.'],
        ],
      },
      {
        h: ['15. Wasiliana nasi', '15. Contact'],
        body: [[`${O.entity}, ${O.address} · ${O.email}`, `${O.entity}, ${O.address} · ${O.email}`]],
      },
    ],
  },

  privacy: {
    path: '/privacy',
    title: ['Sera ya Faragha', 'Privacy Policy'],
    intro: [
      `Sera hii inaeleza jinsi ${O.entity} ("sisi") tunavyokusanya, kutumia na kulinda taarifa zako binafsi ukitumia ${O.brand}, kwa mujibu wa Sheria ya Ulinzi wa Taarifa Binafsi, 2022 (Tanzania).`,
      `This policy explains how ${O.entity} ("we") collects, uses and protects your personal data when you use ${O.brand}, in line with Tanzania's Personal Data Protection Act, 2022.`,
    ],
    sections: [
      {
        h: ['1. Mdhibiti wa taarifa', '1. Data controller'],
        body: [[`${O.entity}, ${O.address}. Maswali ya faragha: ${O.privacyEmail}`, `${O.entity}, ${O.address}. Privacy questions: ${O.privacyEmail}`]],
      },
      {
        h: ['2. Taarifa tunazokusanya', '2. What we collect'],
        body: [
          { list: [
            ['Akaunti: jina, username, password (huhifadhiwa ikiwa imefichwa kwa bcrypt — hatuioni), email (hiari), na uthibitisho wa umri wa miaka 18+.',
              'Account: name, username, password (stored only as a bcrypt hash — we cannot read it), optional email, and your 18+ confirmation.'],
            ['Malipo: namba ya simu unayolipia, kiasi, hali ya malipo na namba za muamala kutoka kwa mtoa huduma. HATUPOKEI PIN wala taarifa za kadi.',
              'Payments: the phone number you pay from, amounts, payment status and provider transaction references. We NEVER receive your PIN or card details.'],
            ['Mchezo: muonekano wa Sim wako, mahali ulipo ndani ya ramani ya mchezo, shughuli, kazi, mali, salio na historia ya miamala ya mchezo.',
              'Gameplay: your Sim\'s appearance, position on the in-game map, activities, jobs, assets, balance and in-game transaction history.'],
            ['Mawasiliano: meseji za chat ya wazi, meseji za faragha (DM), matangazo na picha unazopakia, na ripoti unazotuma.',
              'Communications: public chat messages, private messages (DMs), ads and images you upload, and reports you submit.'],
            ['Kiufundi: anwani ya IP (kwa usalama na kuzuia matumizi mabaya), lugha ya kifaa, na kitambulisho cha nasibu cha mgeni kwenye kifaa chako kuhesabu wageni.',
              'Technical: IP address (for security and abuse prevention), device language, and a random visitor ID stored on your device to count visits.'],
          ] },
          ['HATUKUSANYI mahali halisi (GPS), anwani za simu yako (contacts), picha zako wala namba ya NIDA.', 'We do NOT collect your real-world location (GPS), phone contacts, photos or NIDA number.'],
        ],
      },
      {
        h: ['3. Tunavyozitumia na msingi wa kisheria', '3. How we use it and our legal basis'],
        body: [
          { list: [
            ['Kuendesha mchezo na akaunti yako (mkataba).', 'To run the game and your account (contract).'],
            ['Kuchakata malipo na kuweka kumbukumbu za fedha (mkataba na wajibu wa kisheria).', 'To process payments and keep financial records (contract and legal obligation).'],
            ['Usalama, kuzuia udanganyifu, kusimamia chat na matangazo (maslahi halali).', 'Security, fraud prevention, moderating chat and ads (legitimate interest).'],
            ['Kuboresha mchezo kwa takwimu za jumla zisizokutambulisha (maslahi halali).', 'Improving the game using aggregated statistics that do not identify you (legitimate interest).'],
            ['Kukutumia taarifa kuhusu akaunti yako; hatutakutumia matangazo ya biashara kwa email bila ridhaa yako (ridhaa).', 'Sending you account notices; we will not send marketing emails without your consent (consent).'],
          ] },
        ],
      },
      {
        h: ['4. Kinachoonekana kwa wachezaji wengine', '4. What other players can see'],
        body: [
          ['Username, jina, muonekano wa Sim, mahali ulipo ndani ya mchezo, chat ya wazi, matangazo yako, mali unazomiliki, umaarufu na nafasi kwenye orodha ya matajiri. Namba ya simu na email yako HAZIONYESHWI kwa wachezaji.',
            'Your username, name, Sim appearance, in-game position, public chat, your ads, the property you own, your fame and leaderboard rank. Your phone number and email are NEVER shown to players.'],
        ],
      },
      {
        h: ['5. Meseji za faragha (DM)', '5. Private messages (DMs)'],
        body: [
          ['DM huhifadhiwa ili ziweze kufika kwa unayemtumia. Hazionyeshwi kwenye admin panel. Tunaweza kuzifikia tu pale inapohitajika kuchunguza ripoti ya unyanyasaji au utapeli, au tukitakiwa na sheria.',
            'DMs are stored so they can be delivered. They are not shown in our admin panel. We access them only when needed to investigate a report of abuse or fraud, or when required by law.'],
        ],
      },
      {
        h: ['6. Tunaowapa taarifa', '6. Who we share data with'],
        body: [
          { list: [
            ['Mtoa huduma wa malipo (nTZS) na mitandao ya simu — namba ya simu na kiasi, pale tu unapoongeza salio.', 'Our payment provider (nTZS) and mobile networks — your phone number and amount, only when you top up.'],
            ['Watoa huduma wa server na hifadhi (hosting), wanaoweza kuwa nje ya Tanzania; tunahakikisha kuna kinga stahiki kama sheria inavyotaka.', 'Hosting and infrastructure providers, which may be located outside Tanzania; we put appropriate safeguards in place as the law requires.'],
            ['Mamlaka za kisheria pale tunapolazimika kisheria.', 'Law enforcement or regulators when legally required.'],
          ] },
          ['HATUUZI taarifa zako. Watangazaji HAWAPEWI taarifa zako binafsi.', 'We do NOT sell your data. Advertisers receive NO personal data about you.'],
        ],
      },
      {
        h: ['7. Muda wa kuhifadhi', '7. How long we keep it'],
        body: [
          { list: [
            ['Akaunti na mchezo: muda wote akaunti ipo hai; tunafuta ndani ya siku 30 baada ya ombi la kufuta.', 'Account and gameplay: while your account is active; deleted within 30 days of a deletion request.'],
            ['Kumbukumbu za malipo: hadi miaka 5 kwa matakwa ya kodi na fedha.', 'Payment records: up to 5 years for tax and financial requirements.'],
            ['Chat ya wazi: hadi miezi 12; kumbukumbu za usimamizi (audit log): hadi miaka 2.', 'Public chat: up to 12 months; moderation audit records: up to 2 years.'],
          ] },
        ],
      },
      {
        h: ['8. Usalama', '8. Security'],
        body: [
          ['Tunatumia HTTPS, password zilizofichwa (bcrypt), tokens zinazoweza kufutwa, mipaka ya majaribio ya kuingia, na ruhusa za admin zinazokaguliwa (audit log). Hakuna mfumo ulio salama 100%; tukigundua uvujaji unaokuathiri, tutakujulisha wewe na Tume ya Ulinzi wa Taarifa Binafsi kama sheria inavyotaka.',
            'We use HTTPS, hashed passwords (bcrypt), revocable sessions, login rate limits and audited admin access. No system is 100% secure; if we discover a breach that affects you, we will notify you and the Personal Data Protection Commission as the law requires.'],
        ],
      },
      {
        h: ['9. Haki zako', '9. Your rights'],
        body: [
          ['Chini ya Sheria ya Ulinzi wa Taarifa Binafsi, 2022 una haki ya: kuona taarifa zako; kurekebisha zisizo sahihi; kuomba zifutwe; kupinga matumizi fulani; na kuondoa ridhaa uliyotoa. Tuandikie ' + O.privacyEmail + '; tutajibu ndani ya siku 30. Pia unaweza kuwasilisha malalamiko kwa Tume ya Ulinzi wa Taarifa Binafsi (PDPC).',
            'Under the Personal Data Protection Act, 2022 you have the right to: access your data; correct inaccurate data; request deletion; object to certain processing; and withdraw consent you gave. Write to ' + O.privacyEmail + '; we reply within 30 days. You may also complain to the Personal Data Protection Commission (PDPC).'],
        ],
      },
      {
        h: ['10. Watoto', '10. Children'],
        body: [['Bongo Life ni ya watu wa miaka 18+. Tukigundua akaunti ya mtoto, tutaifunga na kufuta taarifa zake.', 'Bongo Life is for people aged 18+. If we learn an account belongs to a child, we will close it and delete its data.']],
      },
      {
        h: ['11. Hifadhi kwenye kifaa', '11. Storage on your device'],
        body: [
          ['Hatutumii cookies za matangazo. Tunahifadhi kwenye kifaa chako (localStorage) tu: token ya kuingia, lugha uliyochagua, mpangilio wa graphics na kitambulisho cha nasibu cha mgeni.',
            'We use no advertising cookies. We store only the following in your browser (localStorage): your sign-in token, chosen language, graphics setting and a random visitor ID.'],
        ],
      },
      {
        h: ['12. Mabadiliko', '12. Changes'],
        body: [['Tukibadilisha sera hii kwa kiasi kikubwa tutatangaza ndani ya mchezo. Tarehe ya juu inaonyesha toleo la sasa.', 'If we change this policy significantly we will announce it in the game. The date at the top shows the current version.']],
      },
    ],
  },

  ads: {
    path: '/ads-policy',
    title: ['Sera ya Matangazo', 'Advertising Policy'],
    intro: [
      `Sera hii inahusu kila tangazo kwenye mabango na maeneo ya udhamini ndani ya ${O.brand}, liwe limewekwa na mchezaji au kampuni.`,
      `This policy covers every ad on billboards and sponsored spots inside ${O.brand}, whether placed by a player or a brand.`,
    ],
    sections: [
      {
        h: ['1. Jinsi mabango yanavyofanya kazi', '1. How billboards work'],
        body: [
          { list: [
            ['Kila bango lina bei kwa siku. Tangazo linaanza mara moja au baada ya tangazo lililopo kwenye bango hilo kuisha (foleni).', 'Each billboard has a daily price. Your ad starts immediately, or after the current ad on that billboard ends (queue).'],
            ['Matangazo yanaonekana kwa kila mchezaji anayepita, na yanaonyesha "Tangazo · @mtangazaji".', 'Ads are visible to every player passing by and are labelled "Ad · @advertiser".'],
            ['Matangazo ya kampuni na udhamini (viwanja vyenye chapa, mabango makubwa, nafasi kwenye ukurasa wa mwanzo) hupangwa kwa makubaliano maalum na huhakikiwa kabla ya kuwekwa.', 'Brand campaigns and sponsorships (branded plots, premium billboards, landing-page spots) are arranged by separate agreement and reviewed before going live.'],
          ] },
        ],
      },
      {
        h: ['2. Maudhui yaliyokatazwa', '2. Prohibited content'],
        body: [
          { list: [
            ['Bidhaa au huduma haramu, dawa za kulevya, silaha.', 'Illegal goods or services, drugs, weapons.'],
            ['Kamari, betting na bahati nasibu.', 'Gambling, betting and lotteries.'],
            ['Uwekezaji usio na leseni, "double your money", piramidi, au crypto zisizodhibitiwa.', 'Unlicensed investments, "double your money" schemes, pyramids or unregulated crypto offers.'],
            ['Maudhui ya ngono, tumbaku na vape.', 'Sexual content, tobacco and vapes.'],
            ['Kampeni za kisiasa au za kidini, chuki na ubaguzi.', 'Political or religious campaigning, hate and discrimination.'],
            ['Madai ya uongo, kujifanya kampuni nyingine, au kutumia chapa ya mtu bila ruhusa.', 'False claims, impersonating another business, or using someone else\'s brand without permission.'],
            ['Links za hila (phishing), malware, au zinazoomba password/PIN.', 'Deceptive (phishing) links, malware, or anything asking for passwords or PINs.'],
          ] },
        ],
      },
      {
        h: ['3. Maudhui yenye masharti', '3. Restricted content'],
        body: [
          { list: [
            ['Vinywaji vyenye kilevi: kwa watu wazima tu, ujumbe wa kunywa kwa kiasi, na mtangazaji awe na leseni.', 'Alcohol: adults only, responsible-drinking messaging, and the advertiser must be licensed.'],
            ['Huduma za fedha (mikopo, bima, malipo): lazima ziwe na leseni ya BoT, TIRA au CMSA inavyostahili.', 'Financial services (loans, insurance, payments): must be licensed by the BoT, TIRA or CMSA as applicable.'],
          ] },
        ],
      },
      {
        h: ['4. Ukaguzi na kuondolewa', '4. Review and removal'],
        body: [
          ['Wachezaji wanaweza kuripoti tangazo; likipata ripoti 5 linafichwa moja kwa moja hadi likaguliwe. Tunaweza kuondoa tangazo lolote linalovunja sera hii. Tangazo likiondolewa kwa kuvunja sera, malipo HAYARUDISHWI. Tukiliondoa kwa kosa letu, tutarudisha sehemu ya muda uliobaki.',
            'Players can report an ad; after 5 reports it is hidden automatically until reviewed. We may remove any ad that breaks this policy. Ads removed for policy violations are NOT refunded. If we remove an ad in error, we refund the unused time.'],
        ],
      },
      {
        h: ['5. Wajibu wako', '5. Your responsibility'],
        body: [
          ['Wewe unawajibika kwa maudhui ya tangazo, picha na link zake, na unathibitisha kuwa una haki juu yake na kwamba linatii sheria za Tanzania, ikiwemo Kanuni za Maudhui ya Mtandaoni.',
            'You are responsible for your ad\'s content, images and links, and you confirm you hold the rights to them and that they comply with Tanzanian law, including the Online Content Regulations.'],
        ],
      },
      {
        h: ['6. Ubia wa chapa', '6. Brand partnerships'],
        body: [[`Kwa kampeni za kampuni, viwanja vyenye chapa au udhamini wa matukio, tuandikie ${O.adsEmail}.`, `For brand campaigns, branded landmarks or event sponsorships, contact ${O.adsEmail}.`]],
      },
    ],
  },
};

export const docByPath = Object.fromEntries(Object.values(DOCS).map((d) => [d.path, d]));
