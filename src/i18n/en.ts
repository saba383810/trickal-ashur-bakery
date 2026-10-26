// 画面に出る文言（英語）。ja.ts と同じ形
import type { Strings } from './ja';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const listAnd = (items: string[], sep = ' and ') =>
  items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')}${sep}${items[items.length - 1]}`;

export const en: Strings = {
  locale: 'en-US',
  langName: 'English',
  wrapByChar: false,
  docTitle: "Ashur's Bakery",
  disclaimer:
    'This is an unofficial fan game based on "Trickcal: Chibi Go". It is not affiliated with the official game or its creators. All rights to the original work belong to their respective owners.',

  breads: {
    roll: 'Roll',
    croissant: 'Croissant',
    melon: 'Melon Bun',
    anpan: 'Red Bean Bun',
    curry: 'Curry Bun',
    cornet: 'Choco Cornet',
    shokupan: 'Milk Loaf',
  },

  stages: {
    tutorial: { title: 'Tutorial', blurb: "I'll show you the ropes, from serving customers to handling Her Majesty and friends!" },
    mild: { title: 'Mild', blurb: "A laid-back day. Two kinds of bread, one item per order. Baked bread won't burn, so no need to rush!" },
    medium: {
      title: 'Medium',
      blurb: "More customers are coming in. Three kinds of bread, and some orders come in pairs. Bread still won't burn, so check each order carefully!",
    },
    spicy: {
      title: 'Hot',
      blurb: 'Lunch rush! Four kinds of bread. From here on, baked bread burns if you leave it, so take it out as soon as you see "Ready!"',
    },
    hot: { title: 'Extra Hot', blurb: 'Every bread, every customer. Bread burns faster, and Her Majesty is starving. Brace yourself, Master!' },
    endless: { title: 'Endless', blurb: 'Keep your Combo going to stretch the clock. The shop just keeps getting busier. How long can you last?' },
  },

  common: {
    back: 'Back',
    close: 'Close',
    modeSelect: 'Mode Select',
    retry: 'Try Again',
    mute: 'Mute',
    howTo: 'How to Play',
    settings: 'Settings',
    language: 'Language',
  },

  title: {
    sub: 'A Trickcal: Chibi Go fan game',
    logo1: "Ashur's",
    logo2: 'Bakery',
    say: "It's not a bakery, it's a great wizard's shop!",
    hint: "You can pinch and pull everyone's cheeks",
    start: 'Start',
    stars: (n: number, max: number) => `★ ${n} / ${max} collected`,
  },

  modes: {
    heading: 'Choose a Mode',
    heat: (heat: number) => (heat > 4 ? 'Spice ∞' : `Spice ${heat}`),
    metaTutorial: 'All the basics, plus handling Erpin, Ner, Kommy and Butter',
    metaEndless: (sec: number, breads: number) => `Starts at ${sec}s · ${plural(breads, 'bread')}`,
    meta: (sec: number, breads: number, seats: number) => `${sec}s · ${plural(breads, 'bread')} · ${plural(seats, 'seat')}`,
    cleared: 'Cleared',
    recommend: 'Recommended for first-timers',
    noRecord: 'No record yet',
  },

  intro: {
    elfin: 'Erpin',
    elfinTip: "Dashes in now and then and grabs one bread. It goes on her tab and doesn't count toward sales.",
    nell: 'Ner',
    nellTip: (reveal: number, buff: number, rate: number) =>
      `Her order shows for just ${reveal}s. Serve it exactly from memory to collect the tab and get sales ×${rate} for ${buff}s.`,
    komi: 'Kommy',
    komiTip: "Dozes off and won't order. Pull her cheeks to wake her up.",
    butter: 'Butter',
    butterTip: 'While seated, she shoos Erpin away with her slingshot.',
    burumi: 'Youngchun',
    burumiTip: (reward: number) => `Sometimes sticks to the window. Tap the window for +${reward} G.`,
    fever: 'Fever Time',
    feverTip: (serves: number, sec: number) =>
      `Fill the gauge with ${plural(serves, 'sale')}. For ${sec}s, the tray holds every bread, so just tap customers to serve them.`,
    endlessInfo: (sec: number, ovens: number, seats: number) =>
      `Starting time ${sec}s · ${plural(ovens, 'oven')} · ${plural(seats, 'seat')}`,
    timedInfo: (sec: number, ovens: number, seats: number) => `Time limit ${sec}s · ${plural(ovens, 'oven')} · ${plural(seats, 'seat')}`,
    ruleExtend: (base: number, perCombo: number, max: number, nell: number) =>
      `Each sale adds time: ${base}s + Combo × ${perCombo}s (up to ${max}s left). A perfect Ner order adds ${nell}s.`,
    ruleLevel: (sec: number) => `Level up every ${sec}s. More customers, bigger orders, shorter tempers.`,
    ruleFever: "During Fever Time, the clock stops (sales don't add time either).",
    ruleBurn: (level: number, sec: number) => `From Level ${level}, baked bread burns after ${sec}s.`,
    mochiHint: 'Press and drag a customer to pull their cheeks and cheer them up (once each).',
    goals: 'Sales Goals',
    open: 'Open Shop',
  },

  tutorialDone: {
    heading: 'Tutorial Complete!',
    text: (stage: string) => `Now you're a full-fledged shop assistant, Master! Let's try the real thing, starting with ${stage}.`,
    play: (stage: string) => `Play ${stage}`,
  },

  settings: {
    sfx: 'Sound Effects',
    bgm: 'Music',
    keyHints: 'Show keyboard hints',
    tutorialNote: 'You can play the tutorial anytime from mode select via "Start".',
  },

  howTo: {
    prev: 'Prev',
    next: 'Next',
    tray: 'Tray',
    happy: 'Happy!',
    combo: 'Combo',
    bake: 'Bake',
    baked: 'Ready!',
    burnFrom: (stage: string, level: number) => `${stage} (from Level ${level})`,
    burnNames: (names: string[]) => listAnd(names),
    burnAt: (names: string, sec: number) => `after ${sec}s in ${names}`,
    burnText: (safe: string, burns: string[]) => {
      const never = safe ? `Bread never burns in ${safe}.` : '';
      if (burns.length === 0) return never;
      return `${never}${safe ? ' It' : 'Bread'} burns ${listAnd(burns, ', and ')}.`;
    },
    flow: {
      title: 'How the Shop Works',
      text: [
        'Earn as much as you can before time runs out. Your sales decide your ★.',
        'Tap bread in the display case to put it on your tray (up to 4).',
        'Tap a customer to hand over just the bread they ordered from your tray.',
        'Picked the wrong bread? Tap it on the tray to put it back.',
      ],
    },
    cheek: {
      title: 'Pulling Cheeks',
      text: [
        'Press a customer and drag your finger to pull their cheeks (a tap serves them).',
        'Pull and let go to refill their patience. Once per customer.',
        'You can pull the cheeks of the characters on the title screen and here, too.',
      ],
    },
    pay: (tip: number, step: number, max: number) => ({
      title: 'Checkout',
      text: [
        `The faster you serve, the bigger the tip (up to +${tip}%).`,
        `Keep serving without making anyone angry for a Combo: +${step}% per customer (up to +${max}%).`,
        'Keep them waiting too long and they leave angry, breaking your Combo.',
      ],
    }),
    oven: (burn: string) => ({
      title: 'Ovens',
      text: ['Tap an empty oven and choose bread to bake.', "When it's done, tap to take it out. It goes into the display case.", burn],
    }),
    elfin: {
      title: 'Erpin',
      text: [
        'Now and then she dashes in shouting "Snack time~!" and grabs one bread from the display case (the priciest first).',
        "It goes on her tab, which doesn't count toward sales. Serve Ner perfectly and the whole tab gets paid.",
        "There's no stopping her, but she won't block your taps either: the bread and customers behind her still respond. If Butter is seated, she'll slingshot Erpin away.",
      ],
    },
    nell: (lead: number, reveal: number, buff: number, rate: number, peek: number) => ({
      title: "Ner's Memory Test",
      text: [
        `You get a heads-up ${lead}s before she arrives. Her order only shows for the first ${reveal}s.`,
        'Load your tray with the bread you memorized and hand it over in one go. No more, no less (in any sequence).',
        `Success: the whole tab is paid, plus sales ×${rate} for ${buff}s. Fail: the tab stays unpaid.`,
        `Tap her with an empty tray or pull her cheeks to see the order again (costs ${peek}s of her patience).`,
      ],
    }),
    fever: (sec: number) => ({
      title: 'Fever Time',
      text: [
        "Every sale fills Speaki's gauge at the top right. When it's full, it's Fever Time!",
        `For ${sec}s, the tray holds every kind of bread. Just tap a customer to hand over their whole order (even a sleeping Kommy, or Nell).`,
        "Customers who want just one bread keep coming. Nobody gets tired of waiting and bread never burns. Erpin and friends won't show up until it ends.",
        'Bread you had on the tray comes back when Fever ends. If time runs out during Fever, the shop closes once it ends. Serve until the very end!',
      ],
    }),
    guests: {
      title: 'Kommy and Butter',
      text: [
        "Kommy dozes off in her seat and won't order. Pull her cheeks to wake her up.",
        "Keep her waiting too long after she wakes up, and she'll fall back asleep.",
        'While Butter is seated, she slingshots Erpin away before she can grab any bread. Serve Butter early and her watch ends there.',
      ],
    },
    burumi: (reward: number) => ({
      title: 'Youngchun',
      text: [
        'Now and then, Youngchun squishes up against the window from outside.',
        `Tap the window while she's stuck there for +${reward} G. Wait too long and she'll slide off and leave.`,
      ],
    }),
    modes: (titles: string[], secs: number[]) => ({
      title: 'Modes',
      text: [
        `${titles.join(' / ')}: ${secs.map((s) => `${s}s`).join(' / ')}. The spicier it gets, the more bread and customers.`,
        'Endless: every sale adds time, and longer Combos add more. The longer you last, the more customers come.',
        'Play the tutorial anytime from mode select. You can also skip it partway through.',
      ],
    }),
    keys: {
      title: 'Keyboard',
      text: [
        '1–4: Put bread on the tray (also picks bread to bake)',
        'A S D F: Serve customers from the left · Shift+A S D F: Pull cheeks',
        'Z X: Ovens · Backspace: Remove the last tray item',
        'B: Youngchun · Esc / P: Pause',
      ],
    },
  },

  pause: {
    heading: 'Paused',
    resume: 'Resume',
    skipTutorial: 'Skip Tutorial',
    restart: 'Restart',
    quit: 'Back to Mode Select',
  },

  result: {
    heading: "Today's Sales",
    best: 'New Best!',
    longest: 'Longest Shift!',
    base: 'Bread Sales',
    tip: 'Speed Tips',
    combo: 'Combo',
    nell: (rate: number) => `Ner's Blessing ×${rate}`,
    tab: 'Tab Collected',
    burumi: 'Youngchun',
    unpaid: 'Unpaid Tab (not counted)',
    none: 'None',
    endlessTime: (time: string, added: number) => `Open for ${time} (+${added}s gained)`,
    level: (n: number) => `Level ${n}`,
    served: (n: number) => `${n} served`,
    bestCombo: (n: number) => `Best Combo ${n}`,
    angry: (n: number) => `${n} left angry`,
    burnt: (n: number) => `${n} burnt`,
    elfinAte: (n: number) => plural(n, 'bread snatched', 'breads snatched'),
    nellServed: (ok: number, all: number) => `Ner orders ${ok}/${all}`,
    fever: (n: number, served: number) => `${plural(n, 'Fever')} (${served} served)`,
    mochi: (n: number) => plural(n, 'cheek pull'),
    butter: (n: number) => plural(n, 'Butter assist'),
    burumiTimes: (n: number) => `Youngchun ×${n}`,
    comment3: "Amazing! That'll fully fund my magic research!",
    commentTab: "Thanks to Ner, Her Majesty's tab got paid off. What a relief!",
    comment2: "You're pretty good! That's my assistant!",
    comment1Tab: "Not bad, I suppose. …Though Her Majesty's tab grew again.",
    comment1: "Not bad, I suppose. Let's earn more next time, Master!",
    commentBurnt: "The bread's burnt…! Take it out as soon as it's done!",
    commentAngry: 'You kept customers waiting too long! Loading the tray all at once is faster.',
    comment0: "Ugh, in the red again… This is supposed to be a great wizard's shop!",
  },

  game: {
    sign: "Ashur's Bakery",
    open: "We're Open!",
    closed: 'Closed!',
    fast: 'Fast!',
    combo: (n: number) => `${n} Combo`,
    comboBroken: 'Combo broken…',
    happy: 'Happy!',
    trayFull: 'Tray full',
    feverTray: "It's all on the tray!",
    feverTap: 'Tap!',
    komiArrive: "Yawn… Kommy's taking a little nap.",
    komiSleep: 'Mmm… zzz…',
    komiSleepAgain: 'Zzz…',
    komiTitle: 'Kommy is dozing!',
    komiHint: 'Pull her cheeks to wake her!',
    komiWake: "Wha!? …Kommy'll have this and this.",
    butterArrive: 'Hello! Butter will keep watch!',
    butterTitle: 'Butter on guard!',
    butterHint: 'Slingshots Erpin away while seated',
    butterShot: 'Hiyah!',
    elfinEnter: 'Snack time~!',
    elfinTitle: 'Erpin is here!',
    elfinHint: 'She takes one bread on her tab. Ner can pay it off!',
    elfinEat: (price: number) => `Tab +${price}`,
    elfinTook: 'Put it on the royal tab~!',
    elfinSulk: 'Aww, nothing left…',
    elfinShot: 'Ow!',
    elfinFleeNell: 'N-Ner…!?',
    elfinFleeFever: "Wh-what's that light…!?",
    nellAnnounce: 'Ner is coming!',
    nellAnnounceSub: (sec: number) => `Her order shows for only ${sec}s`,
    nellArrive: 'Good day. I am here on an errand.',
    nellArriveTab: "I am here to settle Her Majesty's tab.",
    nellPeek: 'Just once more, then.',
    nellWrong: 'That is not what I ordered.',
    nellTapAgain: 'Tap to see again',
    tabPaid: (n: number) => `Tab paid +${n}`,
    nellSuccess: 'Perfect. Thank you very much.',
    nellSuccessTab: 'Perfect. Allow me to settle the tab.',
    nellBlessing: "Ner's Blessing!",
    nellBlessingSub: (sec: number, rate: number) => `Sales ×${rate} for ${sec}s`,
    nellBye: '…I will come back another time.',
    nellFail: 'Ner went home…',
    nellFailSub: 'Tab not collected',
    burumiHint: (reward: number) => `Tap for +${reward} G`,
    burumiCaught: 'Hehe, you found me!',
    feverStart: 'Fever Time!',
    feverStartSub: 'Just tap your customers!',
    feverEnd: 'Fever over',
    timeLeft: (sec: number) => `${sec}s left!`,
    timeExtend: (sec: string) => `+${sec}s`,
    levelUp: (n: number) => `Level ${n}!`,
    levelBurn: (sec: number) => `Bread burns now! Take it out within ${sec}s`,
    level2: "More customers! It's getting busy",
    levelMore: 'Getting even busier!',
    overtime: 'Overtime!',
    hudCombo: (n: number) => `${n} Combo`,
    hudTab: (tab: string) => `Tab ${tab}`,
    hudNellIn: (sec: number) => `Ner in ${sec}`,
    hudNellNow: "Ner's here!",
    hudFever: 'Fever!',
    bakeWhat: 'What to bake?',
    bakeInfo: (sec: number, count: number) => `${sec}s · ${count} pcs`,
    soldOut: 'Sold out',
    ovenBake: 'Bake',
    ovenReady: 'Ready!',
    ovenBurnt: 'Burnt…',
  },

  tutorial: {
    next: 'Tap to continue ▶',
    skip: 'Skip ▶▶',
    welcome:
      'Welcome to the shop of the great wizard Ashur, mightiest of all sprites! You\'re helping me out today, Master. (Tap "Skip" at the top right to skip anytime.)',
    pick: 'A customer! The bread they want shows up in their speech bubble. Tap the Croissant in the display case to put it on your tray.',
    serve: "It's on the tray. Now tap the customer to hand it over!",
    tips: "That's it! The faster you serve, the bigger the tip, and serving in a row builds a Combo for even more.",
    two: "If they order two, put both on the tray and hand them over together. It's faster! Picked the wrong one? Tap it on the tray to put it back.",
    mochi:
      "Keep customers waiting too long and they'll leave angry. If they're getting impatient, press a customer and drag your finger to pull their cheeks! Their mood fills right back up (once per customer).",
    mochiDone: "They're happy again. Hand them the Curry Bun, too.",
    bake: 'Bread runs low as it sells. Tap an empty oven and choose bread to bake!',
    baking: "It'll be ready in a moment.",
    takeOut:
      "It's done! Tap to take it out. Bread won't burn in Mild and Medium, but from Hot on, it burns if you leave it, so be careful!",
    elfin: "Ah, it's Her Majesty (Erpin)! She grabs a bread from the display case and puts it on her tab. And tabs don't count as sales…!",
    elfinTab: "There's no stopping Her Majesty, but her tab piles up at the top of the screen. Serve Ner exactly right when she visits, and she'll pay the whole thing off!",
    komi: "Kommy's here. She dozes off in her seat and won't order. Pull her cheeks to wake her up!",
    komiAwake: "She's up! Hand her the bread she ordered. Keep her waiting too long and she'll fall asleep again, so be careful.",
    butter: "That's Butter! While she's seated, she'll chase off Erpin's snack raids with her slingshot!",
    butterServe: 'Give Butter her bread, too. She leaves once served, and her watch ends with it.',
    nell: "Last up is Ner. Her order only shows for the first 3 seconds, so memorize it well! Get it exactly right and she'll pay off Her Majesty's whole tab.",
    nellHow: "Gather the bread you memorized on your tray and hand it over in one go. If you forget, pull her cheeks and she'll show you again.",
    fever: "Finally, reward time! Keep serving to fill Speaki's gauge. When it's full, it's Fever Time!",
    feverHow: 'During Fever, the tray has every bread. Just tap your customers to serve them. Tap, tap, tap!',
    done: "Now you can handle everyone! Start with Mild. Once you're used to it, turn up the spice bit by bit and try Endless, too!",
  },

  html: {
    canvas: 'Game screen',
  },
};
