/*
 * Pitíčko – české texty aplikace.
 * Nový jazyk: zkopírujte tento soubor (např. strings.en.js), přeložte hodnoty,
 * změňte klíč `cs` na kód jazyka a přidejte soubor do index.html a sw.js.
 * Zástupné symboly {nazev} se nahrazují hodnotami z kódu.
 * Soubor je klasický skript, aby ho šlo načíst i v service workeru.
 */
(function (g) {
  'use strict';
  g.PITICKO_STRINGS = g.PITICKO_STRINGS || {};
  g.PITICKO_STRINGS.cs = {
    _locale: 'cs-CZ',

    app: {
      name: 'Pitíčko',
      disclaimer: 'Pitíčko nenahrazuje lékařskou radu a neposkytuje doporučení, kolik pít. Při omezení příjmu tekutin se řiďte pokyny lékaře.',
      privacyLink: 'Zásady ochrany osobních údajů',
      updated: 'Aplikace byla aktualizována.',
      noIndexedDB: 'Tento prohlížeč neumožňuje ukládat data. Zkuste jiný prohlížeč nebo vypněte anonymní režim.'
    },

    nav: {
      today: 'Dnes',
      stats: 'Statistiky',
      settings: 'Nastavení',
      add: 'Přidat'
    },

    common: {
      ml: '{n} ml',
      cancel: 'Zrušit',
      close: 'Zavřít',
      save: 'Uložit',
      continue: 'Pokračovat',
      back: 'Zpět',
      undo: 'Zpět',
      later: 'Později',
      prev: 'Předchozí',
      next: 'Další',
      edit: 'Upravit',
      delete: 'Smazat'
    },

    mode: {
      limit: 'Mám omezení od lékaře',
      limitDesc: 'Lékař ti stanovil, kolik můžeš denně vypít. Aplikace ukáže, kolik z limitu zbývá.',
      low: 'Piju málo',
      lowDesc: 'Chceš mít přehled, kolik vypiješ. Pokud chceš, nastavíš si vlastní orientační cíl.',
      limitShort: 'Omezení od lékaře',
      lowShort: 'Piju málo'
    },

    onboarding: {
      welcome: 'Vítej v Pitíčku',
      chooseMode: 'Vyber, jak chceš aplikaci používat. Volbu můžeš později změnit v nastavení.',
      limitTitle: 'Jaký limit ti stanovil lékař?',
      limitText: 'Zadej denní množství tekutin podle pokynů lékaře. Aplikace limit nepočítá ani nedoporučuje.',
      limitLater: 'Nastavím později',
      goalTitle: 'Chceš si nastavit orientační cíl?',
      goalText: 'Cíl je jen tvůj orientační údaj. Aplikace žádné množství nedoporučuje. Vhodná hodnota se může lišit, při pochybnostech se zeptej lékaře.',
      goalSkip: 'Bez cíle',
      remindersTitle: 'Chceš připomínky k zápisu?',
      remindersText: 'Navrhujeme připomínky v tyto časy. Připomínka jen připomene zápis, nevybízí k pití.',
      yes: 'Ano, chci',
      adjust: 'Upravit',
      no: 'Ne, nechci'
    },

    amount: {
      label: 'Množství (ml)',
      limitLabel: 'Denní limit (ml)',
      goalLabel: 'Orientační cíl (ml)',
      invalidEntry: 'Zadej celé číslo od 1 do 2 000 ml.',
      invalidLimit: 'Zadej celé číslo od 100 do 10 000 ml.'
    },

    today: {
      title: 'Dnes',
      remaining: 'Zbývá {left} z {limit}',
      gaugeLeft: 'ml zbývá',
      gaugeOver: 'ml nad limit',
      gaugeDrunk: 'ml vypito',
      over: 'Limit je překročen o {over}',
      reachedLimit: 'Limit je dosažen ({limit})',
      stateOk: 'V limitu',
      stateNear: 'Blízko limitu',
      stateOver: 'Limit překročen',
      noLimit: 'Limit nemáš nastavený. Můžeš ho nastavit v nastavení.',
      drunk: 'Vypito {total}',
      drunkShort: 'vypito',
      goalProgress: 'Vypito {total} z cíle {goal}',
      goalReached: 'Cíl je splněn',
      noGoal: 'Cíl nemáš nastavený. Můžeš ho nastavit v nastavení.',
      noGoalNote: 'Orientační hodnota se může u každého lišit. Při pochybnostech se zeptej lékaře.',
      openSettings: 'Otevřít nastavení',
      quickTitle: 'Rychlý zápis',
      custom: 'Vlastní',
      entriesTitle: 'Dnešní záznamy',
      empty: 'Dnes zatím tichounko.',
      added: 'Zapsáno {amount}',
      deleted: 'Záznam smazán',
      editAria: 'Upravit záznam {amount} z {time}',
      deleteAria: 'Smazat záznam {amount} z {time}',
      total: 'Celkem {total}'
    },

    entry: {
      addTitle: 'Přidat záznam',
      editTitle: 'Upravit záznam',
      time: 'Čas',
      saved: 'Uloženo'
    },

    stats: {
      title: 'Statistiky',
      day: 'Den',
      week: 'Týden',
      month: 'Měsíc',
      dayChartAria: 'Příjem tekutin po hodinách',
      weekChartAria: 'Příjem tekutin po dnech',
      dayTotal: 'Celkem za den: {total}',
      noData: 'Za toto období nejsou žádné záznamy.',
      average: 'Průměr: {avg}',
      averageNote: 'Počítají se jen dny se záznamem.',
      daysInLimit: 'Dny v limitu: {n} / {of}',
      highestDay: 'Nejvyšší den: {date} – {total}',
      compareLess: 'Průměr je o {diff} nižší než v předchozím období.',
      compareMore: 'Průměr je o {diff} vyšší než v předchozím období.',
      compareSame: 'Průměr je stejný jako v předchozím období.',
      compareNone: 'Pro předchozí období nejsou data k porovnání.',
      goalDays: 'Dny se splněným cílem: {n} / {of}',
      goalPositive: 'Každý zápis ti pomáhá mít přehled.',
      goalNotSet: 'Cíl nemáš nastavený, ukazujeme jen vypité množství.',
      limitNotSet: 'Limit nemáš nastavený, ukazujeme jen vypité množství.',
      exportWeek: 'Exportovat týden jako obrázek',
      legendLimit: 'Čárkovaná čára = limit dne',
      legendGoal: 'Čárkovaná čára = cíl dne',
      legendAvg: 'Dlouze čárkovaná čára = průměr',
      overMark: 'Vykřičník = limit překročen'
    },

    export: {
      title: 'Export',
      weekPng: 'Obrázek týdne (PNG)',
      csv: 'Data jako CSV',
      json: 'Data jako JSON',
      done: 'Soubor je připraven.',
      shareTitle: 'Pitíčko – přehled týdne',
      failed: 'Export se nepodařil.',
      imgTitle: 'Přehled příjmu tekutin',
      imgMode: 'Režim: {mode}',
      imgLimit: 'Denní limit: {v}',
      imgGoal: 'Orientační cíl: {v}',
      imgPerDay: 'podle dne (viz tabulka)',
      imgNotSet: 'nezadán',
      colDay: 'Den',
      colTotal: 'Vypito',
      colLimit: 'Limit',
      colGoal: 'Cíl',
      colState: 'Stav',
      stInLimit: 'v limitu',
      stOver: 'překročeno o {v}',
      stReached: 'cíl splněn',
      stNoData: 'bez záznamu',
      imgAverage: 'Průměr (dny se záznamem): {v}',
      imgFooter: 'Údaje zapsal uživatel v aplikaci Pitíčko (piticko.online). Nejde o lékařské měření.',
      imgCreated: 'Vytvořeno {date}'
    },

    settings: {
      title: 'Nastavení',
      modeTitle: 'Režim',
      modeCurrent: 'Aktuální režim: {mode}',
      changeMode: 'Změnit režim',
      limitTitle: 'Denní limit',
      goalTitle: 'Orientační cíl',
      limitHelp: 'Změna platí od dneška. Minulé dny zůstanou beze změny.',
      goalHelp: 'Cíl je jen tvůj orientační údaj. Změna platí od dneška. Pole můžeš nechat prázdné.',
      savedValue: 'Uloženo. Platí od dneška.',
      themeTitle: 'Vzhled',
      themeSystem: 'Systémový',
      themeLight: 'Světlý',
      themeDark: 'Tmavý',
      remindersTitle: 'Upozornění',
      remindersOff: 'Upozornění jsou vypnutá.',
      remindersOn: 'Upozornění jsou zapnutá: {times}',
      remindersSetup: 'Nastavit upozornění',
      remindersEdit: 'Upravit časy',
      remindersDisable: 'Vypnout upozornění',
      onlyNearLimit: 'Jen když se blížím limitu',
      remindersNote: 'Upozornění jsou orientační. Telefon je může zdržet, přesnost na minutu nelze zaručit.',
      remindersInfoClosed: 'Když je aplikace zavřená, nemusí prohlížeč připomínku doručit. Spolehlivější doručení přidáme v další verzi.',
      iosNotInstalled: 'Na iPhonu fungují upozornění jen v aplikaci přidané na plochu, od iOS 16.4.',
      notSupported: 'Tento prohlížeč upozornění nepodporuje.',
      permissionDenied: 'Upozornění jsou v systému zakázaná. Povol je v nastavení telefonu nebo prohlížeče.',
      addTime: 'Přidat čas',
      removeTime: 'Odebrat čas {time}',
      maxTimes: 'Nejvýše 5 časů.',
      timesTitle: 'Časy připomínek',
      exportTitle: 'Export dat',
      exportHelp: 'Pravidelný export ti pomůže nepřijít o záznamy, například při výměně telefonu.',
      storageTitle: 'Úložiště',
      storageOk: 'Záznamy jsou uložené jen v tomto zařízení.',
      storageWarn: 'Prohlížeč nepotvrdil trvalé uložení. Safari může data smazat po delší době, kdy aplikaci nepoužíváš. Doporučujeme pravidelný export.',
      aboutTitle: 'O aplikaci',
      deleteAll: 'Smazat všechna data',
      deleteAllHelp: 'Smaže záznamy, limity i nastavení z tohoto zařízení.'
    },

    modeChange: {
      exportTitle: 'Než změníš režim',
      exportText: 'Při změně režimu se smažou všechny záznamy. Doporučujeme si je nejdřív uložit.',
      exportBtn: 'Exportovat',
      skip: 'Pokračovat bez exportu',
      exportChoose: 'Co chceš uložit?',
      confirmTitle: 'Smazat záznamy?',
      confirmText: 'Všechny záznamy z tohoto zařízení budou smazány.'
    },

    deleteAll: {
      exportTitle: 'Před smazáním',
      exportText: 'Chceš si data nejdřív uložit? Po smazání je nepůjde obnovit.',
      confirm1Title: 'Smazat všechna data?',
      confirm1Text: 'Smažou se všechny záznamy, limity i nastavení z tohoto zařízení.',
      confirm2Title: 'Opravdu smazat?',
      confirm2Text: 'Tuto akci nelze vrátit.',
      confirmBtn: 'Ano, smazat vše'
    },

    install: {
      title: 'Přidej si Pitíčko na plochu',
      text: 'Bude se otevírat jako aplikace a fungovat i bez internetu.',
      installBtn: 'Nainstalovat',
      howBtn: 'Jak na to',
      iosTitle: 'Přidání na plochu (iPhone)',
      iosStep1: 'Dole v Safari klepni na tlačítko Sdílet (čtvereček se šipkou).',
      iosStep2: 'Sjeď níž a vyber „Přidat na plochu“.',
      iosStep3: 'Potvrď klepnutím na „Přidat“.'
    },

    notify: {
      title: 'Pitíčko',
      generic1: 'Zapsat příjem?',
      generic2: 'Nezapomeň zapsat, co jsi vypil/a.',
      near: 'Blížíš se limitu pro dnešek.',
      reached: 'Dnešní limit je dosažen.'
    },

    dates: {
      weekdaysShort: ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So']
    }
  };
})(typeof self !== 'undefined' ? self : this);
