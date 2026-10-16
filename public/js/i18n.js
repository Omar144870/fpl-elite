// UI text in Arabic and English.
const D = {
  ar: {
    teamIdLabel: 'رقم الفريق', teamIdPh: 'رقم الفريق', load: 'افتح',
    heroTitle: 'كل اللي محتاجه عشان تطلع لأول 500، في صفحة واحدة',
    heroLede: 'اكتب رقم فريقك في فانتازي الدوري الإنجليزي، وهتلاقي النقاط الحية وترتيبك المتوقع، توقعات نقاط كل لاعب لثماني جولات، أفضل تبديلات بميزانيتك، الكابتن، وأحسن وقت لكل تشيب.',
    howto: 'تلاقي رقم فريقك في رابط صفحة "Points" على موقع الفانتازي:',
    recent: 'آخر فرق فتحتها',
    f1: 'لايف', f1d: 'نقاطك لحظة بلحظة، البونص المتوقع، والتبديل التلقائي',
    f2: 'توقعات', f2d: 'نقاط متوقعة لكل لاعب مبنية على xG وxA وقوة الخصم',
    f3: 'تبديلات', f3d: 'أفضل تبديلة وتبديلتين، ومتى يستاهل تاخد -4',
    f4: 'الصفوة', f4d: 'إيه اللي بيمتلكه أول 500 مدير وفرق النقاط بينك وبينهم',
    f5: 'التشيبس', f5d: 'أحسن جولة للوايلد كارد والفري هت والبنش بوست والتريبل',
    f6: 'المباريات', f6d: 'جدول صعوبة مبني على النموذج، مش الأرقام الثابتة',
    loadingData: 'بنجيب البيانات من الفانتازي…',
    errNotFound: 'مفيش فريق بالرقم ده. اتأكد من الرقم من رابط صفحة النقاط.',
    errUpdating: 'موقع الفانتازي بيتحدث دلوقتي (ده بيحصل بعد الديدلاين). جرّب تاني بعد دقايق.',
    errNetwork: 'مقدرناش نوصل لموقع الفانتازي. اتأكد من النت وجرّب تاني.',
    retry: 'جرّب تاني',
    tabLive: 'لايف', tabTeam: 'تشكيلتي', tabTransfers: 'التبديلات', tabCaptain: 'الكابتن', tabChips: 'التشيبس',
    tabElite: 'أول 500', tabFixtures: 'المباريات', tabPlayers: 'اللاعبين', tabLeagues: 'الدوريات', tabRank: 'ترتيبي', tabPrices: 'الأسعار',
    overallRank: 'الترتيب العام', gwPoints: 'نقاط الجولة', totalPoints: 'المجموع', bank: 'البنك', freeTransfers: 'تبديلات مجانية',
    value: 'قيمة الفريق', gw: 'الجولة', gwShort: 'ج', xp: 'متوقع', xpNext: 'متوقع الجولة الجاية', pts: 'نقاط',
    livePoints: 'النقاط الحية', afterHits: 'بعد خصم التبديلات', bench: 'الدكة', playersLeft: 'لاعبين لسه هيلعبوا',
    estRank: 'ترتيب متوقع لايف', estRankNote: 'تقدير تقريبي مبني على ملكية اللاعبين، مش الرقم الرسمي.',
    vsElite: 'مقارنة بأول 500', vsAvg: 'مقارنة بالمتوسط', autoSubs: 'تبديلات تلقائية', provBonus: 'بونص متوقع',
    matches: 'مباريات الجولة', threats: 'لاعبين بيمتلكهم أول 500 ومش عندك', yourDiffs: 'لاعبينك اللي أول 500 مش بيمتلكوهم',
    eo: 'ملكية فعلية', owned: 'ملكية', captainPct: 'كابتن', noLive: 'الجولة لسه مبدأتش. أول ما الماتشات تبدأ هتلاقي النقاط هنا.',
    refreshIn: 'تحديث تلقائي كل دقيقة', lastUpdate: 'آخر تحديث',
    planFor: 'خطة الجولة', bestXI: 'أحسن تشكيلة', formation: 'الخطة', captain: 'الكابتن', vice: 'نائب الكابتن',
    benchOrder: 'ترتيب الدكة', squadTable: 'التوقعات للجولات الجاية', nextFixtures: 'المباريات الجاية', xpTotal: 'مجموع متوقع',
    recommendation: 'التوصية', rollTransfer: 'احتفظ بالتبديلة', rollWhy: 'مفيش تبديلة تستاهل دلوقتي. التبديلة المجانية هتتنقل للجولة الجاية.',
    makeTransfers: 'اعمل التبديلات دي', gainOver: 'زيادة متوقعة خلال', weeks: 'جولات', hit: 'خصم',
    singles: 'أفضل تبديلة واحدة', doubles: 'أفضل تبديلتين', horizon: 'عدد الجولات', sellNote: 'سعر البيع الحقيقي مش متاح للعامة، فبنحسب بسعر اللاعب الحالي. عدّل البنك لو حابب.',
    out: 'بيع', in: 'اشتري', costDiff: 'فرق السعر', wildcardBuild: 'ابني تشكيلة وايلد كارد', wcSquad: 'تشكيلة الوايلد كارد المقترحة',
    fhSquad: 'تشكيلة الفري هت المقترحة', buildNote: 'بنحسبها بميزانيتك كاملة (البنك + قيمة الفريق).', computing: 'بنحسب…',
    captainPicks: 'أحسن اختيارات الكابتن', fromSquad: 'من تشكيلتك', eliteCap: 'كابتن عند أول 500', safe: 'آمن', diff: 'مختلف',
    capRisk: 'لو مختارتهوش وجاب', capRiskNote: 'لو لاعب ملكيته الفعلية عند الصفوة عالية وانت مش مكبتنه، كل نقطة بيجيبها بتبعدك عنهم.',
    chipsTitle: 'خطة التشيبس', available: 'متاح', used: 'اتلعب', bboost: 'بنش بوست', tc: 'تريبل كابتن', freehit: 'فري هت', wildcard: 'وايلد كارد',
    chipBest: 'أحسن جولة', chipValue: 'القيمة المتوقعة', chipsNote: 'القيم دي بتفترض إنك مش هتعمل تبديلات. العب التشيب لما القيمة تبقى أعلى من المعتاد، خصوصاً في الجولات المزدوجة.',
    wcGain: 'الوايلد كارد هيزود حوالي', wcGainSuffix: 'نقطة خلال 6 جولات',
    eliteTitle: 'الطريق لأول 500', cutoffs: 'نقاط كل شريحة', youAre: 'انت', gapTo: 'الفرق', perWeek: 'محتاج كل جولة', toReach: 'عشان توصل في',
    remaining: 'جولة باقية', template: 'التشكيلة اللي الصفوة متفقة عليها', differentials: 'لاعبين مختلفين ملكيتهم قليلة ومتوقعلهم كتير',
    eliteChips: 'تشيبس الصفوة الجولة دي', eliteSample: 'العينة', managers: 'مدير', noElite: 'بيانات الصفوة مش متاحة دلوقتي.',
    fixturesTitle: 'جدول المباريات', attack: 'هجوم', defence: 'دفاع', avgEase: 'متوسط السهولة', team: 'الفريق', dgw: 'جولة مزدوجة', bgw: 'مفيش ماتش',
    fixturesNote: 'الألوان مبنية على النموذج: الأهداف المتوقعة للهجوم، وفرصة الشباك النظيفة للدفاع.',
    search: 'دوّر على لاعب', position: 'المركز', all: 'الكل', maxPrice: 'أقصى سعر', sortBy: 'رتب حسب', price: 'السعر',
    form: 'الفورمة', ownership: 'الملكية', xmins: 'دقايق متوقعة', perMillion: 'نقاط/مليون', showing: 'معروض',
    leaguesTitle: 'دورياتك', liveTable: 'الترتيب لايف', liveNote: 'بنحسب النقاط الحية لأول 25 في الدوري.', rank: 'المركز', manager: 'المدير',
    rankTitle: 'ترتيبك عبر الموسم', pastSeasons: 'المواسم اللي فاتت', season: 'الموسم', avgScore: 'المتوسط', benchPts: 'نقاط الدكة',
    transfersCount: 'تبديلات', bestGw: 'أحسن جولة', worstGw: 'أسوأ جولة',
    pricesTitle: 'توقع تغيير الأسعار', risers: 'مرشحين للزيادة', fallers: 'مرشحين للنزول', progress: 'التقدم',
    pricesNote: 'مؤشر تقريبي مبني على صافي التبديلات الجولة دي مقارنة بالملكية. الأسعار بتتغير بالليل بتوقيت لندن.',
    netTransfers: 'صافي التبديلات', inYourTeam: 'في فريقك',
    playerFixtures: 'المباريات والتوقعات', season_: 'الموسم', news: 'الأخبار', xg: 'xG', xa: 'xA', mins: 'دقايق', goals: 'أهداف', assists: 'أسيست',
    cs: 'شباك نظيفة', bonusPts: 'بونص', selectedBy: 'ملكية',
    modelNote: 'التوقعات مبنية على نموذج إحصائي (xG، xA، الدقايق، قوة الخصم، الإصابات). استخدمها كمساعد لقرارك، مش ضمان.',
    disclaimer: 'موقع غير رسمي. البيانات من موقع Fantasy Premier League الرسمي.',
    copied: 'اتنسخ', demo: 'بيانات تجريبية',
    statusYet: 'لسه', statusPlaying: 'بيلعب', statusDone: 'خلص', statusDnp: 'ملعبش', blank: 'مفيش ماتش',
    weeksShort: 'ج', home: 'أرضه', away: 'برا', yes: 'أيوه', no: 'لأ',
  },
  en: {
    teamIdLabel: 'Team ID', teamIdPh: 'Team ID', load: 'Open',
    heroTitle: 'Everything you need to climb into the top 500, on one page',
    heroLede: 'Enter your FPL team ID to get live points and an estimated live rank, eight-week projections for every player, the best transfers for your budget, captaincy, and the right week for each chip.',
    howto: 'Your team ID is in the address of your "Points" page on the FPL site:',
    recent: 'Recently opened',
    f1: 'Live', f1d: 'Your points as they happen, provisional bonus and auto-subs',
    f2: 'Projections', f2d: 'Expected points from xG, xA, minutes and opponent strength',
    f3: 'Transfers', f3d: 'Best one and two moves, and when a -4 is worth it',
    f4: 'Top 500', f4d: 'What the top 500 own and your points gap to them',
    f5: 'Chips', f5d: 'The best week for Wildcard, Free Hit, Bench Boost and Triple Captain',
    f6: 'Fixtures', f6d: 'Difficulty built from the model, not fixed ratings',
    loadingData: 'Fetching your FPL data…',
    errNotFound: 'No team with that ID. Check the number in your Points page address.',
    errUpdating: 'FPL is updating right now (this happens after the deadline). Try again in a few minutes.',
    errNetwork: "Couldn't reach FPL. Check your connection and try again.",
    retry: 'Try again',
    tabLive: 'Live', tabTeam: 'My team', tabTransfers: 'Transfers', tabCaptain: 'Captain', tabChips: 'Chips',
    tabElite: 'Top 500', tabFixtures: 'Fixtures', tabPlayers: 'Players', tabLeagues: 'Leagues', tabRank: 'My rank', tabPrices: 'Prices',
    overallRank: 'Overall rank', gwPoints: 'GW points', totalPoints: 'Total', bank: 'Bank', freeTransfers: 'Free transfers',
    value: 'Team value', gw: 'Gameweek', gwShort: 'GW', xp: 'xP', xpNext: 'xP next GW', pts: 'pts',
    livePoints: 'Live points', afterHits: 'after hits', bench: 'Bench', playersLeft: 'players still to play',
    estRank: 'Estimated live rank', estRankNote: 'A rough estimate from ownership, not the official figure.',
    vsElite: 'vs top 500', vsAvg: 'vs average', autoSubs: 'Auto-subs', provBonus: 'Provisional bonus',
    matches: 'Gameweek matches', threats: 'Owned by the top 500, not by you', yourDiffs: 'Your players the top 500 don’t own',
    eo: 'EO', owned: 'Owned', captainPct: 'Captain', noLive: 'The gameweek hasn’t started. Live points appear here once matches kick off.',
    refreshIn: 'Updates every minute', lastUpdate: 'Updated',
    planFor: 'Plan for', bestXI: 'Best XI', formation: 'Formation', captain: 'Captain', vice: 'Vice',
    benchOrder: 'Bench order', squadTable: 'Projections for the coming weeks', nextFixtures: 'Next fixtures', xpTotal: 'Total xP',
    recommendation: 'Recommendation', rollTransfer: 'Roll the transfer', rollWhy: 'No move is worth it right now. Your free transfer carries over to next week.',
    makeTransfers: 'Make these transfers', gainOver: 'Expected gain over', weeks: 'weeks', hit: 'hit',
    singles: 'Best single transfers', doubles: 'Best double transfers', horizon: 'Horizon', sellNote: 'Real selling prices aren’t public, so current prices are used. Adjust your bank if needed.',
    out: 'Out', in: 'In', costDiff: 'Cost', wildcardBuild: 'Build a wildcard squad', wcSquad: 'Suggested wildcard squad',
    fhSquad: 'Suggested Free Hit squad', buildNote: 'Uses your full budget (bank + squad value).', computing: 'Working…',
    captainPicks: 'Best captain picks', fromSquad: 'From your squad', eliteCap: 'Top 500 captaincy', safe: 'Safe', diff: 'Differential',
    capRisk: 'If you skip him and he scores', capRiskNote: 'When the top 500 heavily captain a player you don’t, every point he scores pushes you further from them.',
    chipsTitle: 'Chip planner', available: 'Available', used: 'Used', bboost: 'Bench Boost', tc: 'Triple Captain', freehit: 'Free Hit', wildcard: 'Wildcard',
    chipBest: 'Best week', chipValue: 'Expected value', chipsNote: 'Values assume no transfers. Play a chip when its value is well above normal, especially in double gameweeks.',
    wcGain: 'A wildcard adds about', wcGainSuffix: 'points over 6 weeks',
    eliteTitle: 'Your path to the top 500', cutoffs: 'Points by rank band', youAre: 'You', gapTo: 'Gap', perWeek: 'Needed per week', toReach: 'to get there in',
    remaining: 'weeks left', template: 'The template the top 500 agree on', differentials: 'Low-owned players with high projections',
    eliteChips: 'Top 500 chips this week', eliteSample: 'Sample', managers: 'managers', noElite: 'Top 500 data isn’t available right now.',
    fixturesTitle: 'Fixture ticker', attack: 'Attack', defence: 'Defence', avgEase: 'Avg ease', team: 'Team', dgw: 'Double', bgw: 'Blank',
    fixturesNote: 'Colours come from the model: expected goals for attack, clean-sheet chance for defence.',
    search: 'Search players', position: 'Position', all: 'All', maxPrice: 'Max price', sortBy: 'Sort by', price: 'Price',
    form: 'Form', ownership: 'Owned', xmins: 'xMins', perMillion: 'pts/£m', showing: 'Showing',
    leaguesTitle: 'Your leagues', liveTable: 'Live table', liveNote: 'Live points are calculated for the top 25 in the league.', rank: 'Rank', manager: 'Manager',
    rankTitle: 'Your season', pastSeasons: 'Past seasons', season: 'Season', avgScore: 'Average', benchPts: 'Bench pts',
    transfersCount: 'Transfers', bestGw: 'Best GW', worstGw: 'Worst GW',
    pricesTitle: 'Price change watch', risers: 'Likely to rise', fallers: 'Likely to fall', progress: 'Progress',
    pricesNote: 'A rough indicator from this week’s net transfers relative to ownership. Prices change overnight UK time.',
    netTransfers: 'Net transfers', inYourTeam: 'In your team',
    playerFixtures: 'Fixtures and projections', season_: 'Season', news: 'News', xg: 'xG', xa: 'xA', mins: 'Mins', goals: 'Goals', assists: 'Assists',
    cs: 'Clean sheets', bonusPts: 'Bonus', selectedBy: 'Owned',
    modelNote: 'Projections come from a statistical model (xG, xA, minutes, opponent strength, injuries). Use them to inform your decision, not as a guarantee.',
    disclaimer: 'Unofficial site. Data from the official Fantasy Premier League site.',
    copied: 'Copied', demo: 'Demo data',
    statusYet: 'Yet to play', statusPlaying: 'Playing', statusDone: 'Done', statusDnp: 'Didn’t play', blank: 'No fixture',
    weeksShort: 'GW', home: 'Home', away: 'Away', yes: 'Yes', no: 'No',
  },
};

let lang = 'ar';
try {
  lang = localStorage.getItem('lang') || 'ar';
} catch (e) {}

export function getLang() {
  return lang;
}
export function setLang(l) {
  lang = l;
  try { localStorage.setItem('lang', l); } catch (e) {}
  document.documentElement.lang = l;
  document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-i18n]').forEach((el) => (el.textContent = t(el.dataset.i18n)));
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => (el.placeholder = t(el.dataset.i18nPh)));
}
export function t(k) {
  return (D[lang] && D[lang][k]) || D.en[k] || k;
}
export function fmtNum(n, d = 0) {
  if (n == null || !Number.isFinite(+n)) return '–';
  return (+n).toLocaleString(lang === 'ar' ? 'en-US' : 'en-GB', { minimumFractionDigits: d, maximumFractionDigits: d });
}
export function fmtRank(n) {
  if (!n) return '–';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e4) return Math.round(n / 1e3) + 'k';
  return fmtNum(n);
}
export function money(n) {
  return '£' + (n / 10).toFixed(1);
}
