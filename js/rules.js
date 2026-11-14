'use strict';
/* rules.js — 「こっち見ないで!だるま落とし」のきまり(数字・気分・振り向き・段・点数)
 * 画面・音・保存には さわらない。状態(state)を受けとって中身を書きかえ、起きたこと(events)を返す。
 * 乱数は makeRng(種) だけを使う(Math.random は使わない)。同じ種なら同じ流れになる。
 * 数字は docs/design.md の 12 章どおり。変えるときは docs/sim.py も同じに変えて確かめる。
 * ES modules なし。window.D に生やす。 */
(function () {
  var D = window.D = window.D || {};

  // ------------------------------------------------------------------ 数字(design.md 12-1)
  var CONFIG = {
    W: 390, H: 780, DT: 1 / 60,
    // 振り向き(フェア)
    TELL_MIN: 0.60,            // 予兆の最短。絶対にこれより短くしない
    GRACE: 0.12,               // 首が回る間はセーフ
    RETURN_DUR: 0.20,          // 戻る動き(始まったら安全)
    CHANT: ['だ', 'る', 'ま', 'さ', 'ん', 'が', 'こ', 'ろ', 'ん', 'だ'],
    CHANT_BOUSAN: ['ぼ', 'う', 'さ', 'ん', 'が', 'へ', 'を', 'こ', 'い', 'た'],
    FEINT_LETTERS_DUR: [0.35, 0.55],
    DOUBLE_GAP: 0.35, DOUBLE_FACING: [0.6, 1.0],
    LATE_DOUBLE_ADD: 0.05,     // 段階7から 1段階ごとに 二度見 +5%
    // 段階
    STAGE_DROPS: [0, 20, 45, 80, 125, 180, 250, 330, 430, 550],
    STAGE_SPEED: [1.00, 0.95, 0.90, 0.85, 0.80, 0.76, 0.72, 0.69, 0.66, 0.64],
    STAGE_TIME: 45,
    TELL_SPEED_K: 0.6, FACING_SPEED_K: 0.5,
    WARMUP_SEC: 30, WARMUP_LETTER_MUL: 1.25, WARMUP_TELL_ADD: 0.40, WARMUP_RING_WINDOW: 0.14,
    // 練習
    TUTORIAL_LETTER_MUL: 1.6, TUTORIAL_TELL_MUL: 1.5, TUTORIAL_FORGIVE: 2, TUTORIAL_TURNS: 3,
    // 入力
    HIT_MIN_GAP: 0.045, BUTTON_DEAD_EDGE: 8, DROP_COOLDOWN: 0.12,
    // 段
    RING_PERIOD: 1.0, RING_WINDOW: 0.10, RING_TARGET_U: 6 / 7,
    SLIDE_PERIOD: 1.2, SLIDE_WINDOW: 0.12,
    HARD_BASE: 3, HARD_MAX: 6, MOCHI_HP: 5, MOCHI_REGEN: 0.30, DOUBLE_TAP_GAP: 0.35, GOLD_HP: 8,
    TOWER_VISIBLE: 6, TOWER_AHEAD: 7, BLOCK_H: 36, BLOCK_W: 200,
    FIRST_RAINBOW_AT: 12, RAINBOW_PITY: 30, BOMB_GAP: 5,
    // 点数
    COMBO_STEP: 0.2, COMBO_MAX: 3.0, SQUEEZE_MUL: 1.5, FULL_SLOT_POINTS: 100, DAILY_BONUS: 1.1,
    // ちょっかい・アイテム
    TAMA_START: 1, TAMA_MAX: 3, TAMA_EVERY: 20,
    TEASE_COOLDOWN: 15, BORED_SEC: 20, BORED_FAIL: 0.5,
    TICKLE_PAUSE: 0.8, DAJARE_PAUSE: 1.5, OCHA_PAUSE: 1.0, LULLABY_SEC: 1.5, OCHA_FACING_MUL: 0.5,
    HAGAO_SUCCESS: 0.65, HAGAO_CUT: 0.30, HAGAO_FAIL_ADD: 0.5,
    ITEM_SLOTS: 2, BLINDFOLD_SEC: 5, BLINDFOLD_WARN: 1.0,
    // 2026-11-14 ノブさんの直し: スリル(気分を問わず たまに)・チラ見・ミステリーボックス・げきおこ
    SPICE_FEINT: 0.10, SPICE_FAST: 0.12, SPICE_DOUBLE: 0.08,      // 気分の確率に足す
    FAST_LETTER_MUL: 0.35, FAST_LETTER_MIN: 0.06, TELL_MIN_FAST: 0.53,   // 早口: 予兆+猶予 = 0.65 秒以上
    PEEK_EVERY: [15, 25], PEEK_DUR: 0.4, PEEK_SAFE_LEFT: 0.7, PEEK_SPEEDUP: 0.6, PEEK_TUTORIAL_AT: 7,
    // 企画の係の案(2026-11-14)
    KOROBI_P: 0.04, KOROBI_P_SLEEPY: 0.08, KOROBI_SEC: 2.5, KOROBI_UP: 0.5,       // ほんとうに ころんだ
    GIRIGIRI_SEC: 0.15, GIRIGIRI_BONUS: 50,                                     // ギリギリセーフ
    KIN_EVERY: 50, KIN_CYCLES: 3,                                               // 金だるま
    BOUSAN_P: 0.08, SAISEN_WISH: 5, RENDA_TITLE: 15, IPPO_DROPS: 3,
    REACT_PRE: 0.3, REACT_GRACE: 0.25, REACT_WATCH: 1.2, REACT_DEMO_PRE: 1.0, TSUNTSUN_JOY_P: 0.15, FACE_COMMON_P: 0.10, FACE_RARE_P: 0.025,
    MYSTERY_REVEAL: 1.0, MUTEKI_SEC: 5, GEKIDO_SEC: [8, 10], MYSTERY_MUTEKI_P: 0.5,
    PERFECT_SEC: 5, PERFECT_DROP_RATE: 3.5, PERFECT_TAP_DROPS: 2, HENGAO_COOLDOWN: 12, TICKLE_MOOD_CYCLES: 1, TIMESTOP_SEC: 3, DOUBLE_SCORE_SEC: 10, GOLD_MALLET_HITS: 6,
    // 演出
    OUT_FREEZE: 0.25, OUT_TOTAL: 1.6, RESUME_COUNT: 3,
    // 記録
    BEST_KEY: 'daruma-best', BEST_DAN_KEY: 'daruma-best-dan', STATS_KEY: 'daruma-stats',
    TUTORIAL_KEY: 'daruma-tutorial', SOUND_KEY: 'daruma-sound'
  };

  // 気分。letter=だるまさんが1文字、tell=ころんだ全体、facing=こっち向き(秒)
  // art = 絵(DARUMA_ART)の表情の名前 / say = 止まったときの一言 / color = 気分の色
  var MOODS = {
    futsu:   { name: 'ふつう',   art: 'normal',    color: '#f4efe4', letter: [0.26, 0.40], jitter: 0.15, pauseP: 0.10, pause: [0.4, 0.8], restartP: 0,    tell: [0.85, 1.00], feintP: 0.05, doubleP: 0,    facing: [1.0, 1.6], cycles: [3, 5], mult: 1.0, say: 'ん〜' },
    gokigen: { name: 'ごきげん', art: 'happy',     color: '#ffb3c8', letter: [0.36, 0.50], jitter: 0.15, pauseP: 0.30, pause: [0.5, 1.0], restartP: 0,    tell: [1.00, 1.20], feintP: 0,    doubleP: 0,    facing: [0.7, 1.1], cycles: [2, 2], mult: 1.0, say: 'ふふっ♪' },
    okori:   { name: 'おこり',   art: 'angry',     color: '#ff5a4a', letter: [0.10, 0.30], jitter: null, pauseP: 0,    pause: [0, 0],     restartP: 0,    tell: [0.60, 0.70], feintP: 0.10, doubleP: 0.10, facing: [1.6, 2.4], cycles: [4, 4], mult: 2.0, say: 'むかっ' },
    ijiwaru: { name: 'いじわる', art: 'mean',      color: '#b98cff', letter: [0.18, 0.40], jitter: 0.25, pauseP: 0.15, pause: [0.3, 0.9], restartP: 0,    tell: [0.65, 0.80], feintP: 0.40, doubleP: 0.25, facing: [1.0, 1.5], cycles: [4, 4], mult: 1.5, say: 'ひひひ…' },
    nemui:   { name: 'ねむい',   art: 'sleepy',    color: '#8fb8ff', letter: [0.50, 0.75], jitter: 0.15, pauseP: 0.40, pause: [0.8, 1.6], restartP: 0,    tell: [1.20, 1.50], feintP: 0,    doubleP: 0,    facing: [0.8, 1.2], cycles: [3, 3], mult: 1.0, say: 'zzz…' },
    nakisou: { name: 'なきそう', art: 'sad',       color: '#7fd6e8', letter: [0.25, 0.60], jitter: null, pauseP: 0.20, pause: [0.5, 1.0], restartP: 0.30, tell: [0.80, 1.00], feintP: 0,    doubleP: 0,    facing: [2.0, 3.0], cycles: [3, 3], mult: 1.2, say: 'ぐすっ' },
    tere:    { name: 'てれ',     art: 'shy',       color: '#ff8fb0', letter: [0.32, 0.46], jitter: 0.15, pauseP: 0.25, pause: [0.4, 0.8], restartP: 0,    tell: [0.90, 1.10], feintP: 0,    doubleP: 0,    facing: [0.4, 0.7], cycles: [3, 3], mult: 1.0, say: 'えへへ' },
    gekido:  { name: 'げきおこ', art: 'angry',   color: '#ff1a1a', letter: [0.08, 0.26], jitter: null, pauseP: 0.10, pause: [0.2, 0.5], restartP: 0,    tell: [0.60, 0.66], feintP: 0.30, doubleP: 0.25, facing: [1.4, 2.2], cycles: [99, 99], mult: 3.0, say: 'ぐぬぬ…' },
    kin:     { name: '金だるま', art: 'normal',    color: '#ffd84a', letter: [0.26, 0.40], jitter: 0.15, pauseP: 0,    pause: [0, 0],     restartP: 0,    tell: [0.85, 1.00], feintP: 0,    doubleP: 0,    facing: [2.0, 2.0], cycles: [3, 3], mult: 3.0, say: 'まじめに いくよ' },
    bikkuri: { name: 'びっくり', art: 'surprised', color: '#ffe066', letter: [0, 0],       jitter: null, pauseP: 0,    pause: [0, 0],     restartP: 0,    tell: [0.60, 0.60], feintP: 0,    doubleP: 0,    facing: [1.2, 1.8], cycles: [1, 1], mult: 1.0, say: '!?' }
  };
  var MOOD_KEYS = ['futsu', 'gokigen', 'okori', 'ijiwaru', 'nemui', 'nakisou', 'tere', 'bikkuri'];
  var FACE_KEYS = MOOD_KEYS.concat(['gekido', 'mekakushi']);   // 見たかお 図鑑(10)
  var MOOD_DRIFT = [
    { futsu: 60, gokigen: 30, nemui: 10 },
    { futsu: 45, gokigen: 20, nemui: 10, ijiwaru: 15, tere: 10 },
    { futsu: 35, gokigen: 15, nemui: 10, ijiwaru: 20, okori: 10, tere: 5, nakisou: 5 },
    { futsu: 30, gokigen: 10, nemui: 8, ijiwaru: 22, okori: 18, tere: 6, nakisou: 6 },
    { futsu: 25, gokigen: 8, nemui: 7, ijiwaru: 25, okori: 23, tere: 6, nakisou: 6 }
  ];
  var WARMUP_DRIFT = { futsu: 70, gokigen: 30 };

  // 段。art = 絵の種類(DARUMA_ART.drawBlock の kind)。絵の色に合わせて名前をつけた
  var BLOCKS = {
    aka:      { pts: 10,  kind: 'tap',    art: 'red',     color: '赤',   name: 'ふつう',   how: '1回',          hex: '#e23a3a' },
    ao:       { pts: 20,  kind: 'mash',   art: 'blue',    color: '青',   name: 'かたい',   how: '連打 3〜6回',  hex: '#3f7fe6' },
    midori:   { pts: 30,  kind: 'ring',   art: 'green',   color: '緑',   name: 'まと',     how: '輪が重なったら', hex: '#2fb05a' },
    kiiro:    { pts: 30,  kind: 'slide',  art: 'yellow',  color: '黄',   name: 'すべる',   how: '▲がまんなかで', hex: '#f2c230' },
    hibi:     { pts: 15,  kind: 'hibi',   art: 'crack',   color: '灰',   name: 'ヒビ',     how: '2回',          hex: '#c8bca4' },
    murasaki: { pts: 50,  kind: 'double', art: 'purple',  color: '紫',   name: '2だん',    how: 'すばやく2回',  hex: '#a065dc' },
    mochi:    { pts: 40,  kind: 'mochi',  art: 'mochi',   color: '白',   name: 'おもち',   how: '連打 5回',     hex: '#f7f3ea' },
    kin:      { pts: 100, kind: 'mash',   art: 'gold',    color: '金',   name: 'きん',       how: '連打 8回',     hex: '#f0c030' },
    niji:     { pts: 50,  kind: 'tap',    art: 'rainbow', color: '虹',   name: 'にじ',       how: '1回・アイテム', hex: '#ff7fb0' },
    bakudan:  { pts: 80,  kind: 'tap',    art: 'bomb',    color: '黒',   name: 'ばくだん', how: '1回・ふりむく', hex: '#b0b0c0', chip: '#2b2b33' },
    hoshi:    { pts: 10,  kind: 'tap',    art: 'star',    color: '水色', name: 'ほし',     how: '1回・玉+1',    hex: '#6cc8ec' }
  };
  var BLOCK_ORDER = ['aka', 'hibi', 'ao', 'hoshi', 'midori', 'kiiro', 'mochi', 'murasaki', 'niji', 'bakudan', 'kin'];
  var BLOCK_WEIGHTS = [
    { aka: 60, ao: 20, midori: 12, hibi: 8 },
    { aka: 40, ao: 20, midori: 14, kiiro: 8, hibi: 8, hoshi: 5, niji: 3 },
    { aka: 30, ao: 18, midori: 14, kiiro: 10, hibi: 8, murasaki: 5, hoshi: 5, niji: 3, bakudan: 3, kin: 2 },
    { aka: 22, ao: 18, midori: 14, kiiro: 12, hibi: 7, murasaki: 6, mochi: 6, hoshi: 4, niji: 3, bakudan: 4, kin: 2 },
    { aka: 16, ao: 18, midori: 14, kiiro: 13, hibi: 6, murasaki: 7, mochi: 9, hoshi: 4, niji: 3, bakudan: 5, kin: 3 }
  ];
  var TUTORIAL_WEIGHTS = { aka: 60, ao: 25, midori: 15 };

  var ITEM_POOL = { mekakushi: 30, ocha: 12, odateru: 8, komoriuta: 8, shield: 6, kizuchi: 8, bai: 10, tokei: 8, mystery: 10 };   // パーフェクトは やめた(強すぎる)
  var ITEMS = {
    mekakushi: { name: '目かくし',   short: '目かくし', art: 'blindfold', mark: '目', color: '#4a5fc0', desc: '5びょう 見えなくなる' },
    ocha:      { name: 'お茶',       short: 'お茶',   art: null, mark: '茶', color: '#3f8f4a', desc: 'きぶんが おちつく' },
    odateru:   { name: 'おだてる',   short: 'ほめる', art: null, mark: '褒', color: '#e0679a', desc: 'てれて すぐ戻る' },
    komoriuta: { name: '子守歌',     short: '子守歌', art: null, mark: '歌', color: '#5a6fd8', desc: 'ねむくなる' },
    shield:    { name: 'まもり',     short: 'まもり', art: null, mark: '守', color: '#58b8d8', desc: '1回だけ セーフ' },
    kizuchi:   { name: '金の木づち', short: '金づち', art: 'perfect', mark: '槌', color: '#e0a820', desc: '10回 つよく叩く' },
    bai:       { name: '点数2倍',    short: '2倍',    art: null, mark: '倍', color: '#e8a020', desc: '15びょう 点数2倍' },
    tokei:     { name: '時間止め',   short: 'とめる', art: null, mark: '止', color: '#6a8ab8', desc: '4びょう かたまる' },
    perfect:   { name: 'パーフェクト', short: 'むてき', art: null, mark: '極', color: '#ff5fa0', desc: '(つかわない)' },
    mystery:   { name: 'ミステリーボックス', short: 'はこ', art: null, mark: '?', color: '#8a4fd8', desc: 'むてき? げきおこ? あけてみないと わからない' }
  };
  var CHOTTO = {
    kusuguru: { name: 'くすぐる', cost: 1, art: 'feather' },
    dajare:   { name: 'ダジャレ', cost: 1, art: 'joke' },
    ijiwaru:  { name: 'つんつん', cost: 0, art: 'prank' },
    hengao:   { name: '変顔',     cost: 0, art: null }
  };
  var CHOTTO_KEYS = ['kusuguru', 'dajare', 'ijiwaru'];   // 下のボタン。変顔は だるまさんの顔をタッチ
  var DAJARE_UKE = { gekido: 0.10, futsu: 0.60, gokigen: 0.85, okori: 0.25, ijiwaru: 0.40, nemui: 0.50, nakisou: 0.70, tere: 0.60, bikkuri: 0.30 };
  var DAJARE = [
    'ふとんが ふっとんだ', 'アルミ缶の上に ある ミカン', 'イクラは いくら?', 'カエルが かえる', 'パンダの パンだ',
    '電話に でんわ', 'だるまが だるーまった', 'ネコが ねころんだ', 'トイレに いっといれ', '内容が ないよう',
    '和尚が ふたりで おしょうがつ', 'ゾウが ぞうきんがけ', 'この板 いたい', 'スキーが 好き', 'ラクダに 乗ると らくだ',
    'サンマは 3枚', '校長先生 ぜっこうちょう', 'コーディネートは こーでねーと', 'ソースは どこ? そーっす', 'ダジャレを 言うのは だれじゃ'
  ];

  // 終わりの一言(場面ごと)
  var LINES = {
    ijiwaru: ['ひっかかったね〜 ひひひ', 'いま 叩いたでしょ〜?', 'ふりむくと 思わなかった?'],
    okori:   ['見てたぞ!ぜーんぶ!', 'こらーっ!', 'おこってるって 言ったでしょ!'],
    gekido:  ['げきおこ だって 言ったでしょ!!', 'ぜったい 見のがさないぞ!!', 'こわかった? ふんっ!'],
    bikkuri: ['びっくりさせないでよ〜!', 'ドカンは ずるいよ〜', 'しんぞうが とまるかと…'],
    nemui:   ['ねてないよ…ほんとだよ…', 'うとうと…はっ!見えた!', 'ねむくても 見えるんだよ'],
    antic:   ['まだ こっち見てるよ?', 'あわてんぼうさん!', 'もどるまで まってね'],
    early:   ['だいじょうぶ、赤い字が出たら 手をとめてね', '赤い「ころんだ」が 合図だよ', 'あせらず いこうね'],
    best:    ['まいった!左目に 目を入れて あげよう', 'まいった!きみ、すごいね!', 'こんなに 落とされたの はじめて!'],
    nanakorobi: ['ころんでも 起きるのが だるまだよ。七転び八起き!', '何回ころんでも 起き上がるのが だるま流!'],
    long:    ['つかれた〜。また遊ぼうね', 'ながい しょうぶ だったね', 'もう ふらふら…'],
    normal:  ['手も足も 出なかったでしょ? …あ、それは ぼくか', 'みーつけた!', 'だるまさんは 見のがさないよ', 'ぼく、手も足もないけど 目は いいんだよ'],
    nakisou: ['さみしかったんだもん…', 'ずっと 見てたのに…', 'ぐすっ…みつけちゃった'],
    tere:    ['えへへ、見つけちゃった', 'はずかしいけど みてたよ', 'てへっ'],
    gokigen: ['ふふっ、見えちゃった♪', 'たのしいね〜', 'ごきげんでも 見てるよ']
  };
  var TITLES = [
    { id: 'ippo',    name: 'はじめの一段',     how: '1回 遊ぶ' },
    { id: 'nanakoro', name: '七転び八起き',    how: '通算 8回 遊ぶ' },
    { id: 'suberi',  name: 'すべりこみ名人',   how: '1回で すべりこみ 10回' },
    { id: 'okorase', name: 'おこらせ上手',     how: 'おこり中に 30段' },
    { id: 'dajare',  name: 'ダジャレ王',       how: 'ダジャレ ウケ 通算10回' },
    { id: 'kin',     name: '金の手',           how: '1回で 金を 3つ' },
    { id: 'bomb',    name: 'ばくだん処理班',   how: '1回で ばくだん 5つ' },
    { id: 'nekashi', name: 'ねかしつけ名人',   how: 'ねむい中に 20段' },
    { id: 'nirame',  name: 'にらめっこ王',     how: '変顔せいこう 通算10回' },
    { id: 'renda',   name: '連打の鬼',         how: '1回の 向こう向きで 15段' },
    { id: 'kakure',  name: 'かくれんぼの達人', how: '5分 生きのこる' }
  ];
  var DAILY_LINES = {
    futsu: 'きょうは ふつうの日。のんびり いこう', gokigen: 'きょうは ごきげん!わらいやすいよ', okori: 'きょうは おこりっぽい…でも 点数アップ',
    ijiwaru: 'きょうは いじわるな気分。フェイントに 注意', nemui: 'きょうは ねむたい日。ゆっくり しゃべるよ',
    nakisou: 'きょうは なきむし。じっと 見つめてくる', tere: 'きょうは てれやさん。すぐ戻るよ'
  };

  // ------------------------------------------------------------------ 乱数
  function makeRng(seed) {           // mulberry32
    var a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function rRange(rng, ab) { return ab[0] + (ab[1] - ab[0]) * rng(); }
  function rInt(rng, a, b) { return a + Math.floor(rng() * (b - a + 1)); }
  function wpick(rng, w) {
    var k, tot = 0;
    for (k in w) tot += w[k];
    var r = rng() * tot;
    for (k in w) { r -= w[k]; if (r < 0) return k; }
    return k;
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // ------------------------------------------------------------------ 段階
  function stageOf(dropped, t) {
    var s = 0, i;
    for (i = 0; i < CONFIG.STAGE_DROPS.length; i++) if (dropped >= CONFIG.STAGE_DROPS[i]) s = i;
    return Math.max(s, Math.min(Math.floor(t / CONFIG.STAGE_TIME), CONFIG.STAGE_DROPS.length - 1));
  }

  // ------------------------------------------------------------------ だるまさんの1回ぶん
  /* phases: [{k, s, e, L:[{at,i,silent}], say, cy}]  k = SAFE PAUSE FEINT WARN GRACE WATCH RETURN FROZEN STOP PERFECT
   * L の i は「かけ声の何文字目か」(0〜9)。表示は その文字まで言ったことにする。
   * o = { warm, tutorial, from(言い終わった文字数 0〜6) } */
  function makeCycle(mood, stage, o, rng, t0) {
    var m = MOODS[mood], spd = CONFIG.STAGE_SPEED[clamp(stage, 0, 9)];
    var lmul = spd * (o.warm ? CONFIG.WARMUP_LETTER_MUL : 1) * (o.tutorial ? CONFIG.TUTORIAL_LETTER_MUL : 1);
    var out = [], t = t0;
    function push(k, dur) { var p = { k: k, s: t, e: t + dur, L: [] }; out.push(p); t += dur; return p; }
    function warn(dur, dbl) {
      var p = push('WARN', dur);
      if (dbl) { p.dbl = true; p.L.push({ at: p.s, i: 9 }); return p; }
      p.L.push({ at: p.s, i: 6 }, { at: p.s + dur / 3, i: 7 }, { at: p.s + dur * 2 / 3, i: 8 });
      return p;
    }
    if (mood === 'bikkuri') {
      var bw = warn(CONFIG.TELL_MIN, false); bw.say = '!?';
    } else {
      var base = rRange(rng, m.letter);
      var one = function () { return (m.jitter == null ? rRange(rng, m.letter) : base * rRange(rng, [1 - m.jitter, 1 + m.jitter])) * lmul; };
      var from = clamp(o.from || 0, 0, 6);
      var spice = !o.warm && !o.tutorial && mood !== 'kin';
      var fast = spice && from === 0 && rng() < CONFIG.SPICE_FAST;      // 早口「だるまさんがころんだ!」
      if (fast) one = function () { return Math.max(CONFIG.FAST_LETTER_MIN, base * CONFIG.FAST_LETTER_MUL * lmul); };
      var sp = push('SAFE', 0), i, k;
      if (fast) sp.fast = true;
      if (from > 0) sp.L.push({ at: t, i: from - 1, silent: true });   // 言い終わった字は そのまま
      // 言い直し「だ…だる…」(はじめから言うときだけ)
      if (from === 0 && !fast && rng() < m.restartP) {
        var n = rInt(rng, 2, 4);
        for (i = 0; i < n; i++) { sp.L.push({ at: t, i: i }); t += one(); }
        sp.stutter = true;
      }
      var pauseAt = !fast && rng() < m.pauseP ? rInt(rng, Math.max(from, 1), 5) : -1;   // この文字の前で止まる
      for (i = from; i < 6; i++) {
        if (i === pauseAt) {
          sp.e = t;
          var pp = push('PAUSE', rRange(rng, m.pause) * lmul); pp.say = m.say;
          sp = push('SAFE', 0);
        }
        sp.L.push({ at: t, i: i }); t += one();
        sp.e = t;
      }
      sp.e = t;
      // ほんとうに ころんだ!(本当に前に転ぶ。起き上がるまで 叩き放題。予兆なし=振り向かない)
      var kp = (mood === 'nemui' || mood === 'gokigen') ? CONFIG.KOROBI_P_SLEEPY : CONFIG.KOROBI_P;
      if (spice && !fast && mood !== 'gekido' && from === 0 && rng() < kp) {
        var kr = push('KOROBI', CONFIG.KOROBI_SEC); kr.L.push({ at: kr.s, i: 6 }, { at: kr.s + 0.15, i: 7 }, { at: kr.s + 0.3, i: 8 });
        var up = push('FROZEN', CONFIG.KOROBI_UP); up.say = 'よいしょ! 七転び八起き!'; up.getup = true;
        return out.filter(function (p) { return p.e > p.s + 1e-9; });
      }
      // フェイント「ころ…なんちゃって」→「さんが」から言い直し
      if (spice && !fast && rng() < m.feintP + CONFIG.SPICE_FEINT) {
        var fd = rRange(rng, CONFIG.FEINT_LETTERS_DUR);
        var fp = push('FEINT', fd); fp.L.push({ at: fp.s, i: 6 }, { at: fp.s + fd / 2, i: 7 });
        var s2 = push('SAFE', 0); s2.say = 'なんちゃって'; s2.L.push({ at: t, i: 2, silent: true });
        t += one();
        for (k = 3; k < 6; k++) { s2.L.push({ at: t, i: k }); t += one(); }
        s2.e = t;
      }
      var tell = rRange(rng, m.tell) * ((1 - CONFIG.TELL_SPEED_K) + CONFIG.TELL_SPEED_K * spd) + (o.warm ? CONFIG.WARMUP_TELL_ADD : 0);
      if (o.tutorial) tell *= CONFIG.TUTORIAL_TELL_MUL;
      if (fast) { var fw = warn(CONFIG.TELL_MIN_FAST, false); fw.fast = true; }   // 早口でも 予兆+猶予は 0.65 秒
      else warn(Math.max(CONFIG.TELL_MIN, tell), false);
    }
    var g = push('GRACE', CONFIG.GRACE); g.L.push({ at: g.s, i: 9 });
    push('WATCH', rRange(rng, m.facing) * ((1 - CONFIG.FACING_SPEED_K) + CONFIG.FACING_SPEED_K * spd));
    push('RETURN', CONFIG.RETURN_DUR);
    if (!o.warm && !o.tutorial && rng() < m.doubleP + CONFIG.SPICE_DOUBLE + CONFIG.LATE_DOUBLE_ADD * Math.max(0, stage - 6)) {
      var ds = push('SAFE', CONFIG.DOUBLE_GAP); ds.say = '…';
      warn(CONFIG.TELL_MIN, true);
      push('GRACE', CONFIG.GRACE);
      push('WATCH', rRange(rng, CONFIG.DOUBLE_FACING));
      push('RETURN', CONFIG.RETURN_DUR);
    }
    // 長さ 0 の区間(はじめから言い終わっていた など)は のぞく
    return out.filter(function (p) { return p.e > p.s + 1e-9 || p.k === 'WARN'; });
  }

  // ------------------------------------------------------------------ だるまさんの状態
  function newDaruma(mood) { return { mood: mood || 'futsu', prev: mood || 'futsu', left: 4, ph: [], cy: 0, started: false, lastK: null }; }

  function phaseAt(d, t) {
    var ph = d.ph;
    for (var i = ph.length - 1; i >= 0; i--) { if (ph[i].s <= t) return t < ph[i].e ? ph[i] : null; }
    return null;
  }
  function phaseIndex(d, t) {
    for (var i = d.ph.length - 1; i >= 0; i--) if (d.ph[i].s <= t) return t < d.ph[i].e ? i : -1;
    return -1;
  }
  function kindAt(d, t) { var p = phaseAt(d, t); return p ? p.k : 'SAFE'; }
  var SAFE_KINDS = { SAFE: 1, PAUSE: 1, FROZEN: 1, STOP: 1, PERFECT: 1, KOROBI: 1 };
  function isDanger(k) { return k === 'WARN' || k === 'GRACE' || k === 'WATCH'; }

  // 今のかけ声で、何文字目まで言ったか(0〜10)
  function chantIndex(d, t) {
    var idx = phaseIndex(d, t);
    if (idx < 0) return 0;
    var cy = d.ph[idx].cy;
    for (var i = idx; i >= 0 && d.ph[i].cy === cy; i--) {
      var L = d.ph[i].L;
      for (var j = L.length - 1; j >= 0; j--) if (L[j].at <= t) return L[j].i + 1;
      if (d.ph[i].k === 'RETURN') return 0;
    }
    return 0;
  }
  function isBlind(S, t) { return t < S.blindUntil; }
  function isWatching(d, t, blindUntil) { var p = phaseAt(d, t); return !!p && p.k === 'WATCH' && !(t < blindUntil); }

  // この1回の中で、本物の予兆がもう始まっているか
  function warnStarted(d, t) {
    var idx = phaseIndex(d, t); if (idx < 0) return true;
    var cy = d.ph[idx].cy;
    for (var i = idx; i >= 0 && d.ph[i].cy === cy; i--) if (d.ph[i].k !== 'SAFE' && d.ph[i].k !== 'PAUSE' && d.ph[i].k !== 'FROZEN' && d.ph[i].k !== 'STOP' && d.ph[i].k !== 'FEINT') return true;
    return false;
  }

  function cycleCtx(S) {
    return { warm: !S.tutorial && S.playT < CONFIG.WARMUP_SEC, tutorial: S.tutorial, stage: S.tutorial ? 0 : stageOf(S.stageDrops || 0, S.playT) };
  }
  function addCycle(S, t0, from) {
    var d = S.d, c = cycleCtx(S);
    d.cy++;
    var arr = makeCycle(d.mood, c.stage, { warm: c.warm, tutorial: c.tutorial, from: from || 0 }, S.rng, t0);
    var alt = !c.warm && !c.tutorial && !from && d.mood !== 'gekido' && d.mood !== 'kin' && d.mood !== 'bikkuri' && S.rng() < CONFIG.BOUSAN_P;
    for (var i = 0; i < arr.length; i++) { arr[i].cy = d.cy; if (alt) arr[i].alt = true; d.ph.push(arr[i]); }
  }
  function changeMoodNatural(S) {
    var d = S.d, rng = S.rng, c = cycleCtx(S);
    if (d.mood === 'kin') { S.kinDone = (S.kinDone || 0) + 1; S.kinLeave = true; }
    if (d.mood === 'bikkuri') { setMoodRaw(d, rng() < 0.5 ? 'okori' : d.prev, 2); return; }
    if (d.mood === 'nemui' && rng() < 0.3) { setMoodRaw(d, 'bikkuri', 1); d.wakeUp = true; return; }
    var drift;
    if (S.tutorial) drift = { futsu: 1 };
    else if (c.warm) drift = WARMUP_DRIFT;
    else {
      drift = {}; var src = MOOD_DRIFT[Math.min(c.stage, MOOD_DRIFT.length - 1)];
      for (var k in src) drift[k] = src[k] * (k === S.daily ? 1.5 : 1);
    }
    var nm = wpick(rng, drift);
    setMoodRaw(d, nm, rInt(rng, MOODS[nm].cycles[0], MOODS[nm].cycles[1]));
  }
  function setMoodRaw(d, mood, cycles) {
    if (d.mood === 'kin' && d.left > 0 && mood !== 'kin') return;   // 金だるまの 3回は まじめ(ちょっかいで 気分は かわらない)
    if (d.mood !== 'bikkuri' && d.mood !== 'gekido' && d.mood !== 'kin') d.prev = d.mood;
    d.mood = mood; d.left = cycles;
  }
  // 次の1回を足す(回数が終わったら 気分を変える)
  function nextCycle(S, t0) {
    var d = S.d;
    if (d.mood === 'gekido') {
      d.started = true;
      if (t0 >= (S.gekidoUntil || 0)) setMoodRaw(d, 'okori', 2);   // げきおこが おさまって おこり
      addCycle(S, t0, 0);
      return;
    }
    if (d.started) { d.left--; d.wakeUp = false; if (d.left <= 0) changeMoodNatural(S); }
    d.started = true;
    if (S.kinPending && d.mood !== 'gekido' && d.mood !== 'kin' && !S.tutorial) {   // 金だるま: 来る前に 知らせてから 3回
      S.kinPending = false; setMoodRaw(d, 'kin', CONFIG.KIN_CYCLES); S.kinArrive = true;
    }
    addCycle(S, t0, 0);
  }

  // 時刻 t で区切り、t から後ろを捨てる
  function cutAt(d, t) {
    var keep = [];
    for (var i = 0; i < d.ph.length; i++) {
      var p = d.ph[i];
      if (p.s >= t) continue;
      if (p.e > t) { p.e = t; p.L = p.L.filter(function (l) { return l.at < t; }); }
      keep.push(p);
    }
    d.ph = keep;
  }
  // 作り直し: t で区切り、(止まる区間を入れて)、新しい1回を足す
  function rebuild(S, t, pause, from) {
    var d = S.d;
    cutAt(d, t);
    var t0 = t;
    if (pause && pause.sec > 0) {
      d.cy++;
      d.ph.push({ k: pause.kind || 'FROZEN', s: t, e: t + pause.sec, L: [], say: pause.say, cy: d.cy });
      t0 = t + pause.sec;
    }
    addCycle(S, t0, from || 0);
  }
  // 気分を変える。まだ「だるまさんが」の途中なら、言っていない文字から作り直す。予兆が始まっていたら その1回は そのまま
  function setMood(S, mood, cycles, t) {
    var d = S.d;
    if (!warnStarted(d, t)) {
      var from = Math.min(6, chantIndex(d, t));
      setMoodRaw(d, mood, cycles);
      rebuild(S, t, null, from);
      return true;
    }
    setMoodRaw(d, mood, cycles + 1);   // 次の1回から(次の区切りで1つ減るので +1)
    return false;
  }
  // 区間を ずらす(t より後ろ全部)
  function shiftAfter(d, idx, by) {
    for (var i = idx; i < d.ph.length; i++) {
      var p = d.ph[i]; p.s += by; p.e += by;
      for (var j = 0; j < p.L.length; j++) p.L[j].at += by;
    }
  }
  // 時刻 t に 止まる区間(sec 秒)を入れる。予兆の途中なら、残りを TELL_MIN 以上にして「こ」から言い直す
  function insertPause(S, t, sec, kind, say) {
    var d = S.d, idx = phaseIndex(d, t);
    if (idx < 0) { rebuild(S, t, { sec: sec, kind: kind, say: say }, 0); return; }
    var p = d.ph[idx];
    if (p.k === 'GRACE' || p.k === 'WATCH' || p.k === 'RETURN') return;
    var rest = { k: p.k, s: t, e: p.e, L: p.L.filter(function (l) { return l.at >= t; }), say: p.say, cy: p.cy, dbl: p.dbl };
    p.L = p.L.filter(function (l) { return l.at < t; }); p.e = t;
    var fr = { k: kind || 'FROZEN', s: t, e: t + sec, L: [], say: say, cy: p.cy };
    var extra = 0;
    if (p.k === 'WARN') {
      var remain = Math.max(CONFIG.TELL_MIN, rest.e - rest.s);
      extra = remain - (rest.e - rest.s);
      rest.e = rest.s + remain;
      rest.L = rest.dbl ? [{ at: rest.s, i: 9 }] : [{ at: rest.s, i: 6 }, { at: rest.s + remain / 3, i: 7 }, { at: rest.s + remain * 2 / 3, i: 8 }];
    }
    // rest を sec ずらす(WARN のときは L を作り直したので s 基準)
    rest.s += sec; rest.e += sec; for (var j = 0; j < rest.L.length; j++) rest.L[j].at += sec;
    d.ph.splice(idx + 1, 0, fr, rest);
    shiftAfter(d, idx + 3, sec + extra);
    if (p.e <= p.s + 1e-9 && p.k !== 'WARN') d.ph.splice(idx, 1);
    else if (p.k === 'WARN' && p.e <= p.s + 1e-9) d.ph.splice(idx, 1);
  }
  // こっち向きを短く/長くする(変顔・まもり)。ratio=残りに掛ける / add=足す秒
  function cutWatch(S, t, ratio, add) {
    var d = S.d, idx = phaseIndex(d, t);
    if (idx < 0 || d.ph[idx].k !== 'WATCH') return false;
    var p = d.ph[idx], ne = add ? p.e + add : t + (p.e - t) * ratio;
    var by = ne - p.e; p.e = ne;
    shiftAfter(d, idx + 1, by);
    return true;
  }
  // 今の向こう向き(SAFE)の のこりを ちぢめる(チラ見で うたがわれた)。予兆には さわらない
  function compressSafe(S, t, f) {
    var d = S.d, idx = phaseIndex(d, t);
    if (idx < 0 || d.ph[idx].k !== 'SAFE') return;
    var p = d.ph[idx], ne = t + (p.e - t) * f;
    for (var j = 0; j < p.L.length; j++) if (p.L[j].at > t) p.L[j].at = t + (p.L[j].at - t) * f;
    var by = ne - p.e; p.e = ne; shiftAfter(d, idx + 1, by);
  }
  // 次のこっち向きを短く(お茶)
  function scaleNextWatch(S, t, mul) {
    var d = S.d;
    for (var i = 0; i < d.ph.length; i++) {
      var p = d.ph[i];
      if (p.k === 'WATCH' && p.s >= t) { var nd = (p.e - p.s) * mul, by = nd - (p.e - p.s); p.e = p.s + nd; shiftAfter(d, i + 1, by); return; }
    }
  }
  // 反応の顔の一覧(game.js が DARUMA_ART.FACES か 仮の一覧を入れる)
  var FACE_LIST = [];
  function setFaces(list) { FACE_LIST = list || []; }
  function pickFace(S, group) {
    if (!FACE_LIST.length) return null;
    var r = S.rng(), g = group;
    if (r < CONFIG.FACE_RARE_P) g = 'rare'; else if (r < CONFIG.FACE_RARE_P + CONFIG.FACE_COMMON_P) g = 'common';
    var c = FACE_LIST.filter(function (f) { return f.group === g; });
    if (!c.length) c = FACE_LIST.filter(function (f) { return f.group === group; });
    if (!c.length) c = FACE_LIST;
    return c[Math.floor(S.rng() * c.length)].id;
  }
  // ちょっかいの反応: 「!?」(pre 秒)→ 首が回る(0.25秒はセーフ)→ 反応の顔(1.2秒 見ている)→ 戻る → 「だ」から言い直し
  function reactTurn(S, t, face, kind, pre) {
    var d = S.d;
    cutAt(d, t);
    d.cy++;
    var t0 = t, cy = d.cy;
    function push(k, dur) { var p = { k: k, s: t0, e: t0 + dur, L: [], cy: cy, react: kind || true }; d.ph.push(p); t0 += dur; return p; }
    push('WARN', pre || CONFIG.REACT_PRE).say = '!?';
    push('GRACE', CONFIG.REACT_GRACE);
    push('WATCH', CONFIG.REACT_WATCH).face = face;
    push('RETURN', CONFIG.RETURN_DUR);
    addCycle(S, t0, 0);
    return { type: 'react', face: face, kind: kind };
  }
  // ばくだん: 向こう向きなら、今から最短の予兆で振り向く
  function forceTurn(S, t) {
    var k = kindAt(S.d, t);
    if (k === 'WARN' || k === 'GRACE' || k === 'WATCH' || k === 'RETURN' || k === 'PERFECT' || k === 'STOP') return false;
    setMoodRaw(S.d, 'bikkuri', 1);
    rebuild(S, t, null, 0);
    return true;
  }
  // ポーズ・時間止めのあと: 予兆の途中なら残りを TELL_MIN 以上に
  function refreshTell(S, t) {
    var d = S.d, idx = phaseIndex(d, t);
    if (idx < 0 || d.ph[idx].k !== 'WARN') return;
    if (d.ph[idx].e - t < CONFIG.TELL_MIN) insertPause(S, t, 0.0001, 'FROZEN', null);
  }

  // 時刻 t0 → t1 の間に起きたこと(文字・区間の変わり目)
  function darumaStep(S, t0, t1) {
    var d = S.d, ev = [];
    var guard = 0;
    while ((!d.ph.length || d.ph[d.ph.length - 1].e <= t1) && guard++ < 8) nextCycle(S, d.ph.length ? d.ph[d.ph.length - 1].e : t1);
    for (var i = 0; i < d.ph.length; i++) {
      var p = d.ph[i];
      if (p.e < t0 - 0.0001) continue;
      if (p.s >= t1) break;
      // [t0, t1) で数える(ちょうど今の時刻に入れた区間も、次の1コマで拾える)
      if (p.s >= t0 && p.s < t1) ev.push({ type: 'phase', k: p.k, ph: p, prev: i > 0 ? d.ph[i - 1].k : null });
      for (var j = 0; j < p.L.length; j++) { var l = p.L[j]; if (l.at >= t0 && l.at < t1) ev.push({ type: 'letter', i: l.i, silent: l.silent, ph: p }); }
    }
    // 古い区間を捨てる(5秒より前)
    while (d.ph.length > 2 && d.ph[0].e < t1 - 5) d.ph.shift();
    return ev;
  }

  // ------------------------------------------------------------------ 段
  function nextBlockType(S) {
    var st = S.bst, rng = S.rng;
    var c = cycleCtx(S), stage = Math.min(c.stage, BLOCK_WEIGHTS.length - 1);
    var total = S.dropped + S.tower.length, type;
    if (S.tutorial) type = wpick(rng, TUTORIAL_WEIGHTS);
    else if (!st.firstRainbow && total >= CONFIG.FIRST_RAINBOW_AT) { type = 'niji'; st.firstRainbow = true; }
    else if (st.sinceRainbow >= CONFIG.RAINBOW_PITY || st.wishNiji) { type = 'niji'; st.wishNiji = false; }
    else {
      var w = {}, src = BLOCK_WEIGHTS[c.warm ? 0 : stage];
      for (var k in src) w[k] = src[k];
      if (st.sinceBomb < CONFIG.BOMB_GAP || c.warm) delete w.bakudan;
      type = wpick(rng, w);
    }
    st.sinceRainbow = type === 'niji' ? 0 : st.sinceRainbow + 1;
    st.sinceBomb = type === 'bakudan' ? 0 : st.sinceBomb + 1;
    return type;
  }
  var blockId = 0;
  function makeBlock(type, stage, rng) {
    var b = BLOCKS[type], hp = 1;
    if (type === 'kin') hp = CONFIG.GOLD_HP;
    else if (b.kind === 'mash') hp = Math.min(CONFIG.HARD_MAX, CONFIG.HARD_BASE + Math.floor(Math.min(stage, 6) / 2));
    else if (b.kind === 'hibi' || b.kind === 'double') hp = 2;
    else if (b.kind === 'mochi') hp = CONFIG.MOCHI_HP;
    return { id: ++blockId, t: type, kind: b.kind, hp: hp, maxhp: hp, ph: rng(), last: -9, flash: 0 };
  }
  function fillTower(S) {
    var c = cycleCtx(S);
    while (S.tower.length < CONFIG.TOWER_AHEAD) S.tower.push(makeBlock(nextBlockType(S), c.stage, S.rng));
  }
  // 輪(まと): u は 0→1。輪の大きさ 2.2 → 0.8、ぴったり(1.0)は u = 6/7
  function ringInfo(b, t) {
    var u = ((t / CONFIG.RING_PERIOD + b.ph) % 1 + 1) % 1;
    return { size: 2.2 - 1.4 * u, dist: Math.abs(u - CONFIG.RING_TARGET_U) * CONFIG.RING_PERIOD };
  }
  // すべる: ▲ の位置 x(-1〜1)、真ん中までの秒
  function slideInfo(b, t) {
    var u = ((t / CONFIG.SLIDE_PERIOD + b.ph) % 1 + 1) % 1;
    var h = u % 0.5, dist = Math.min(h, 0.5 - h) * CONFIG.SLIDE_PERIOD;
    return { x: Math.sin(u * Math.PI * 2), dist: dist };
  }
  // 叩く。power 3 = 金の木づち(輪・すべるは いつでも成功)
  function hitBlock(b, t, power, win) {
    var k = b.kind;
    if (k === 'tap') return 'drop';
    if (k === 'ring' || k === 'slide') {
      if (power > 1) return 'drop';
      var info = k === 'ring' ? ringInfo(b, t) : slideInfo(b, t);
      var w = k === 'ring' ? win.ring : CONFIG.SLIDE_WINDOW;
      return info.dist <= w ? 'drop' : 'miss';
    }
    if (k === 'mochi' && b.last > 0) b.hp = Math.min(b.maxhp, b.hp + Math.floor((t - b.last) / CONFIG.MOCHI_REGEN));
    if (k === 'double' && b.last > 0 && t - b.last > CONFIG.DOUBLE_TAP_GAP) b.hp = b.maxhp;
    b.last = t;
    b.hp -= power;
    return b.hp <= 0 ? 'drop' : 'damage';
  }

  // ------------------------------------------------------------------ 点数
  function comboMul(combo) { return Math.min(1 + CONFIG.COMBO_STEP * (combo - 1), CONFIG.COMBO_MAX); }
  function scoreFor(type, combo, mood, squeeze, doubled, daily) {
    var m = comboMul(combo) * MOODS[mood].mult * (squeeze ? CONFIG.SQUEEZE_MUL : 1) * (doubled ? 2 : 1) * (daily ? CONFIG.DAILY_BONUS : 1);
    return Math.round(BLOCKS[type].pts * m);
  }

  // ------------------------------------------------------------------ ゲームの状態
  function newGame(opts) {
    opts = opts || {};
    var seed = opts.seed >>> 0 || 1;
    var S = {
      seed: seed, rng: makeRng(seed), t: 0, playT: 0,
      tutorial: !!opts.tutorial, tutForgive: CONFIG.TUTORIAL_FORGIVE, tutTurns: 0,
      firstPlay: !!opts.firstPlay, daily: opts.daily || null,
      dropped: 0, score: 0, combo: 0, bestCombo: 0, squeezes: 0, windowDrops: 0, bestWindow: 0,
      tower: [], blockReadyAt: 0, bst: { sinceRainbow: 0, sinceBomb: 99, firstRainbow: false, rainbows: 0 },
      d: newDaruma('futsu'),
      tama: CONFIG.TAMA_START, tamaCounter: 0, teaseReadyAt: 0, lastUsed: {}, hengaoPh: null,
      mutekiUntil: -1, gekidoUntil: -1, pendingMystery: null, peek: null, nextPeekAt: opts.tutorial ? CONFIG.PEEK_TUTORIAL_AT : 0, peeks: 0,
      slots: [null, null], shield: 0, blindUntil: -1, malletHits: 0, doubleUntil: -1, perfAcc: 0,
      lastHitAt: -9, out: null,
      counts: { gold: 0, bomb: 0, okoriDrops: 0, nemuiDrops: 0, hengaoOK: 0, dajareUke: 0, perfects: 0, shieldSaves: 0 },
      seen: {}
    };
    S.d.left = 4;
    fillTower(S);
    darumaStep(S, -1, 0);
    return S;
  }

  // 難しさの段階は、むてき(パーフェクト)で落とした段を数えない(一気に難しくならないように)
  function stageNow(S) { return S.tutorial ? 0 : stageOf(S.stageDrops || 0, S.playT); }

  function step(S, dt) {
    var t0 = S.t, t1 = S.t + dt, ev = [];
    S.t = t1; if (!S.tutorial) S.playT += dt;
    var de = darumaStep(S, t0, t1);
    for (var i = 0; i < de.length; i++) {
      var e = de[i]; ev.push(e);
      if (e.type !== 'phase') continue;
      if (e.prev === 'RETURN' && e.k !== 'WARN') {   // 戻り終わった(二度見の予兆は のぞく)
        if (S.windowDrops > S.bestWindow && S.playT >= CONFIG.WARMUP_SEC) S.bestWindow = S.windowDrops;   // はじめの30秒(ならし)は 数えない
        ev.push({ type: 'returned', drops: S.windowDrops });
        S.windowDrops = 0; S.combo = 0; S.goldWin = false;
        if (S.tutorial) {
          S.tutTurns++;
          if (S.tutTurns >= CONFIG.TUTORIAL_TURNS) { endTutorial(S); ev.push({ type: 'tutorialDone' }); }
          else if (S.tutTurns === 1 && !S.tutReactShown) { S.tutReactShown = true; ev.push(reactTurn(S, t1 + 0.6, pickFace(S, 'tsuntsun'), 'demo', CONFIG.REACT_DEMO_PRE)); ev.push({ type: 'reactDemo' }); }
        }
      }
      if (e.k === 'WATCH' && !e.ph.react && !isBlind(S, t1) && S.lastHitAt < e.ph.s && e.ph.s - S.lastHitAt <= CONFIG.GIRIGIRI_SEC) {
        S.counts.girigiri = (S.counts.girigiri || 0) + 1; S.score += CONFIG.GIRIGIRI_BONUS; ev.push({ type: 'girigiri' });   // 見せ方と おまけ点だけ(ルールは かえない)
      }
      if (e.k === 'KOROBI') ev.push({ type: 'korobi' });
      if (e.k === 'FROZEN' && e.ph.getup) ev.push({ type: 'getup' });
      if (S.kinArrive) { S.kinArrive = false; ev.push({ type: 'kinArrive' }); }
      if (S.kinLeave) { S.kinLeave = false; ev.push({ type: 'kinLeave' }); }
      if (e.prev === 'PERFECT') ev.push({ type: 'perfectEnd', count: S.perfCount || 0, pts: S.perfPts || 0 });
      if (e.k === 'WATCH' && S.goldWin && !isBlind(S, t1)) ev.push({ type: 'goldSeen' });
      if (e.k === 'WATCH') {
        var face = isBlind(S, t1) ? 'mekakushi' : S.d.mood;
        if (!S.seen[face]) { S.seen[face] = true; ev.push({ type: 'newFace', face: face }); }
      }
    }
    // 目かくしは こっち向きの途中では外れない(戻り終わるまで のばす)
    var k = kindAt(S.d, t1);
    if (isBlind(S, t1) && isDanger(k)) {
      var idx = phaseIndex(S.d, t1);
      for (var j = idx; j < S.d.ph.length; j++) if (S.d.ph[j].k === 'RETURN') { S.blindUntil = Math.max(S.blindUntil, S.d.ph[j].e); break; }
    }
    // むてき も こっち向きの途中では切れない
    if (t1 < S.mutekiUntil && isDanger(k)) {
      var mi = phaseIndex(S.d, t1);
      for (var mj = mi; mj < S.d.ph.length; mj++) if (S.d.ph[mj].k === 'RETURN') { S.mutekiUntil = Math.max(S.mutekiUntil, S.d.ph[mj].e); break; }
    }
    // ミステリーボックスが 開いた
    if (S.pendingMystery && t1 >= S.pendingMystery.at) {
      var pm = S.pendingMystery; S.pendingMystery = null;
      if (pm.result === 'muteki') S.mutekiUntil = t1 + CONFIG.MUTEKI_SEC;
      else { S.gekidoUntil = t1 + rRange(S.rng, CONFIG.GEKIDO_SEC); setMood(S, 'gekido', 99, t1); }
      ev.push({ type: 'mysteryResult', result: pm.result });
    }
    // チラ見(向こう向きの間に たまに 肩ごしに ちらっ。アウトには ならない)
    if (S.peek && t1 >= S.peek.e) { if (S.peek.caught) ev.push({ type: 'peekEnd', caught: true }); S.peek = null; }
    if (!S.nextPeekAt) S.nextPeekAt = t1 + rRange(S.rng, CONFIG.PEEK_EVERY);
    if (!S.peek && t1 >= S.nextPeekAt && !(S.tutorial && S.peeks >= 1)) {
      var pp2 = phaseAt(S.d, t1);
      if (pp2 && pp2.k === 'SAFE' && pp2.e - t1 >= CONFIG.PEEK_SAFE_LEFT && !isBlind(S, t1)) {
        S.peek = { s: t1, e: t1 + CONFIG.PEEK_DUR, caught: false }; S.peeks++;
        S.nextPeekAt = t1 + rRange(S.rng, CONFIG.PEEK_EVERY);
        ev.push({ type: 'peek' });
      }
    }
    // パーフェクト: 自動でも 1秒に8段
    if (k === 'PERFECT') {
      S.perfAcc += dt * CONFIG.PERFECT_DROP_RATE;
      while (S.perfAcc >= 1) { S.perfAcc -= 1; ev = ev.concat(dropBlock(S, t1, { perfect: true, auto: true })); }
    } else S.perfAcc = 0;
    return ev;
  }

  function endTutorial(S) {
    S.tutorial = false; S.playT = 0; S.score = 0; S.dropped = 0; S.stageDrops = 0; S.combo = 0; S.bestCombo = 0; S.squeezes = 0; S.bestWindow = 0;
    S.counts = { gold: 0, bomb: 0, okoriDrops: 0, nemuiDrops: 0, hengaoOK: 0, dajareUke: 0, perfects: 0, shieldSaves: 0 };
    S.tama = CONFIG.TAMA_START; S.tamaCounter = 0;
  }

  // ちょっかい玉: 満タンのときは おさいせん へ。5つで おねがい(次の段が 虹)
  function gainTama(S, ev) {
    if (S.tama < CONFIG.TAMA_MAX) { S.tama++; ev.push({ type: 'tama' }); return; }
    S.saisen = (S.saisen || 0) + 1;
    if (S.saisen >= CONFIG.SAISEN_WISH) { S.saisen = 0; S.bst.wishNiji = true; ev.push({ type: 'saisenWish' }); }
    else ev.push({ type: 'saisen', n: S.saisen });
  }
  function addItem(S, it, ev) {
    if (it === 'shield') {
      if (S.shield > 0) { S.score += CONFIG.FULL_SLOT_POINTS; ev.push({ type: 'itemPoints', item: it }); }
      else { S.shield = 1; ev.push({ type: 'item', item: it }); }
      return;
    }
    for (var i = 0; i < S.slots.length; i++) if (!S.slots[i]) { S.slots[i] = it; ev.push({ type: 'item', item: it, slot: i }); return; }
    S.score += CONFIG.FULL_SLOT_POINTS; ev.push({ type: 'itemPoints', item: it });
  }

  // 一番下の段を落とす
  function dropBlock(S, t, o) {
    o = o || {};
    var ev = [], b = S.tower.shift(); if (!b) return ev;
    var dbl = t < S.doubleUntil, mood = S.d.mood, pts;
    if (o.perfect) { pts = Math.round(BLOCKS[b.t].pts * (dbl ? 2 : 1)); S.perfCount = (S.perfCount || 0) + (b.kind === 'double' ? 2 : 1); S.perfPts = (S.perfPts || 0) + pts; }
    else {
      S.combo++; if (S.combo > S.bestCombo) S.bestCombo = S.combo;
      S.windowDrops++;
      if (o.squeeze) S.squeezes++;
      pts = scoreFor(b.t, S.combo, mood, o.squeeze, dbl, mood === S.daily);
    }
    S.score += pts;
    var n = b.kind === 'double' ? 2 : 1;
    var before = S.dropped;
    S.dropped += n;
    if (!S.tutorial && Math.floor(S.dropped / CONFIG.KIN_EVERY) > Math.floor(before / CONFIG.KIN_EVERY)) { S.kinPending = true; ev.push({ type: 'kinSoon' }); }
    if (!o.perfect) S.stageDrops = (S.stageDrops || 0) + n;
    if (mood === 'okori') S.counts.okoriDrops += n;
    if (mood === 'nemui') S.counts.nemuiDrops += n;
    S.blockReadyAt = t + CONFIG.DROP_COOLDOWN;
    ev.push({ type: 'drop', block: b, pts: pts, combo: o.perfect ? 0 : S.combo, squeeze: !!o.squeeze, perfect: !!o.perfect, auto: !!o.auto });
    S.tamaCounter += n;
    if (S.tamaCounter >= CONFIG.TAMA_EVERY) { S.tamaCounter -= CONFIG.TAMA_EVERY; gainTama(S, ev); }
    if (b.t === 'hoshi') gainTama(S, ev);
    if (b.t === 'kin') { S.counts.gold++; S.goldWin = true; }
    if (b.t === 'niji') {
      S.bst.rainbows++;
      var it = (S.firstPlay && S.bst.rainbows === 2) ? 'mystery' : S.bst.rainbows === 1 ? 'mekakushi' : wpick(S.rng, ITEM_POOL);
      if (S.tutorial) it = 'mekakushi';
      addItem(S, it, ev);
    }
    if (b.t === 'bakudan') {
      S.counts.bomb++;
      if (o.perfect) ev.push({ type: 'bombDud' });
      else if (isBlind(S, t)) ev.push({ type: 'bomb', turned: false });
      else ev.push({ type: 'bomb', turned: forceTurn(S, t) });
    }
    fillTower(S);
    return ev;
  }

  function ringWindow(S) { return (!S.tutorial && S.playT < CONFIG.WARMUP_SEC) || S.tutorial ? CONFIG.WARMUP_RING_WINDOW : CONFIG.RING_WINDOW; }

  // 「トン!」を押した。t = 押した瞬間のゲームの時刻。ここでアウトを決める
  function pressHit(S, t) {
    var ev = [];
    if (S.out) return ev;
    if (t - S.lastHitAt < CONFIG.HIT_MIN_GAP) return ev;
    S.lastHitAt = t;
    var ph = phaseAt(S.d, t), k = ph ? ph.k : 'SAFE';
    if (isWatching(S.d, t, S.blindUntil) && t < S.mutekiUntil) {   // むてき: 見られても「ずるい!」で おしまい
      if (S.mutekiSavedPh !== ph) { S.mutekiSavedPh = ph; ev.push({ type: 'mutekiSave' }); }
    } else if (isWatching(S.d, t, S.blindUntil)) {
      if (S.tutorial && S.tutForgive > 0) {
        S.tutForgive--; cutWatch(S, t, 0); ev.push({ type: 'forgive', left: S.tutForgive }); return ev;
      }
      if (S.shield > 0) {
        S.shield = 0; S.counts.shieldSaves++;
        cutWatch(S, t, 0); setMood(S, 'ijiwaru', 2, t);
        ev.push({ type: 'shield' }); return ev;
      }
      S.out = { t: t, mood: S.d.mood, phaseStart: ph.s, early: S.playT < 30, antic: t - ph.s > 0.45 };
      ev.push({ type: 'out' });
      return ev;
    }
    if (S.peek && !S.peek.caught && t >= S.peek.s && t < S.peek.e) {   // チラ見中に 叩いた:「ん?」→ 次の振り向きが少し早く
      S.peek.caught = true; compressSafe(S, t, CONFIG.PEEK_SPEEDUP); ev.push({ type: 'peekCaught' });
    }
    if (k === 'PERFECT') { var pe = ev; for (var q = 0; q < CONFIG.PERFECT_TAP_DROPS; q++) pe = pe.concat(dropBlock(S, t, { perfect: true })); return pe; }
    if (t < S.blockReadyAt) { ev.push({ type: 'tooFast' }); return ev; }
    if (!S.ippoDone) {
      S.ippoDone = true; ev.push({ type: 'ippo' });
      for (var ip = 0; ip < CONFIG.IPPO_DROPS; ip++) ev = ev.concat(dropBlock(S, t, {}));
      return ev;
    }
    var b = S.tower[0], power = 1;
    if (S.malletHits > 0) { power = 3; S.malletHits--; }
    var res = hitBlock(b, t, power, { ring: ringWindow(S) });
    if (res === 'drop') return ev.concat(dropBlock(S, t, { squeeze: k === 'WARN' && !isBlind(S, t) }));   // チラ見の「ん?」も いっしょに返す
    if (res === 'miss') { S.combo = 0; ev.push({ type: 'miss', block: b }); return ev; }
    ev.push({ type: 'damage', block: b, power: power });
    return ev;
  }

  // ------------------------------------------------------------------ ちょっかい・アイテム
  var CHOTTO_PHASES = { SAFE: 1, PAUSE: 1, FEINT: 1, WARN: 1 };
  var HENGAO_P = { gekido: 0.15, okori: 0.25, bikkuri: 0.30, ijiwaru: 0.35 };   // 変顔が効く確率(ほかの気分は HAGAO_SUCCESS)
  function canUseChotto(S, name, t) {
    if (S.out) return false;
    var k = kindAt(S.d, t);
    var cp = phaseAt(S.d, t);
    if (name === 'hengao') { return k === 'WATCH' && S.hengaoPh !== cp && !isBlind(S, t) && t >= (S.hengaoReadyAt || 0) && !(cp && cp.react); }
    if (!CHOTTO_PHASES[k] || (cp && cp.react)) return false;
    if (name === 'ijiwaru') return t >= S.teaseReadyAt;
    return S.tama >= CHOTTO[name].cost;
  }
  function bored(S, name, t) {
    var b = t - (S.lastUsed[name] == null ? -99 : S.lastUsed[name]) < CONFIG.BORED_SEC && S.rng() < CONFIG.BORED_FAIL;
    S.lastUsed[name] = t;
    return b;
  }
  function useChotto(S, name, t) {
    if (!canUseChotto(S, name, t)) return null;
    var ev = [], mood = S.d.mood, rng = S.rng;
    // ちょっかいを すると「!?」→ くるっと こっちを向いて 反応の顔を見せる(2026-11-14 ノブさん)
    S.tutReactShown = true;
    if (name === 'kusuguru') {
      S.tama -= 1;
      if (bored(S, name, t)) { setMoodRaw(S.d, 'ijiwaru', 2); ev.push(reactTurn(S, t, pickFace(S, 'common'), 'bored')); ev.push({ type: 'bored', name: name }); return ev; }
      setMoodRaw(S.d, 'gokigen', CONFIG.TICKLE_MOOD_CYCLES);
      ev.push(reactTurn(S, t, pickFace(S, 'kusuguru'), 'kusuguru'));
      ev.push({ type: 'tickle' });
    } else if (name === 'dajare') {
      S.tama -= 1;
      var joke = DAJARE[Math.floor(rng() * DAJARE.length)];
      if (bored(S, name, t)) { setMoodRaw(S.d, 'ijiwaru', 2); ev.push(reactTurn(S, t, pickFace(S, 'common'), 'bored')); ev.push({ type: 'bored', name: name, joke: joke }); return ev; }
      var uke = rng() < DAJARE_UKE[mood];
      if (uke) { S.counts.dajareUke++; setMoodRaw(S.d, 'gokigen', 2); }
      else if (mood !== 'nemui') setMoodRaw(S.d, 'okori', 2);
      ev.push(reactTurn(S, t, pickFace(S, 'dajare'), uke ? 'uke' : 'flop'));
      ev.push({ type: 'dajare', joke: joke, uke: uke, sleep: !uke && mood === 'nemui' });
    } else if (name === 'ijiwaru') {
      S.teaseReadyAt = t + CONFIG.TEASE_COOLDOWN;
      var joy = rng() < CONFIG.TSUNTSUN_JOY_P;     // つんつんで たまに よろこぶ
      if (joy) setMoodRaw(S.d, 'gokigen', 1);
      else if (mood === 'okori' || mood === 'gekido') setMoodRaw(S.d, 'nakisou', 3);
      else setMoodRaw(S.d, 'okori', 4);
      ev.push(reactTurn(S, t, pickFace(S, joy ? 'kusuguru' : 'tsuntsun'), joy ? 'joy' : 'tsuntsun'));
      ev.push({ type: 'tease', cry: !joy && (mood === 'okori' || mood === 'gekido'), joy: joy });
    } else if (name === 'hengao') {
      // にらめっこ: こっち向きを縮めるだけ(気分は変えない)。使ったら待ち時間。同じ手を続けると あきる
      S.hengaoPh = phaseAt(S.d, t);
      S.hengaoReadyAt = t + CONFIG.HENGAO_COOLDOWN;
      if (bored(S, name, t)) { cutWatch(S, t, 1, CONFIG.HAGAO_FAIL_ADD); ev.push({ type: 'hengao', ok: false, bored: true }); return ev; }
      var hp = HENGAO_P[mood] != null ? HENGAO_P[mood] : CONFIG.HAGAO_SUCCESS;
      if (rng() < hp) {
        cutWatch(S, t, CONFIG.HAGAO_CUT); S.counts.hengaoOK++;
        ev.push({ type: 'hengao', ok: true });
      } else {
        cutWatch(S, t, 1, CONFIG.HAGAO_FAIL_ADD);
        ev.push({ type: 'hengao', ok: false });
      }
    }
    return ev;
  }
  function canUseItem(S, slot, t) {
    if (S.out || !S.slots[slot]) return false;
    var ip = phaseAt(S.d, t);
    return !!CHOTTO_PHASES[kindAt(S.d, t)] && !(ip && ip.react);
  }
  function useItem(S, slot, t) {
    if (!canUseItem(S, slot, t)) return null;
    var it = S.slots[slot], ev = [{ type: 'useItem', item: it }], mood = S.d.mood;
    S.slots[slot] = null;
    var bad = mood === 'okori' || mood === 'nakisou' || mood === 'ijiwaru' || mood === 'gekido';
    switch (it) {
      case 'mekakushi': S.blindUntil = t + CONFIG.BLINDFOLD_SEC; break;
      case 'ocha':
        setMood(S, bad ? 'futsu' : 'gokigen', 3, t);
        insertPause(S, t, CONFIG.OCHA_PAUSE, 'FROZEN', 'ずずっ…');
        scaleNextWatch(S, t, CONFIG.OCHA_FACING_MUL);
        break;
      case 'odateru': setMood(S, mood === 'nakisou' ? 'gokigen' : 'tere', 3, t); break;
      case 'komoriuta':
        if (mood === 'okori' || mood === 'gekido') { ev.push({ type: 'noSleep' }); break; }
        setMood(S, 'nemui', 3, t);
        insertPause(S, t, CONFIG.LULLABY_SEC, 'FROZEN', 'ねないよ… ねないって ば… ふぁ〜あ');
        break;
      case 'kizuchi': S.malletHits = CONFIG.GOLD_MALLET_HITS; break;
      case 'bai': S.doubleUntil = t + CONFIG.DOUBLE_SCORE_SEC; break;
        case 'tokei': insertPause(S, t, CONFIG.TIMESTOP_SEC, 'STOP', null); break;   // 予兆の途中なら insertPause が残りを TELL_MIN 以上にする
      case 'mystery':   // ガタガタ…パカッ(1秒)。むてき か げきおこ か は 開けるまで ないしょ
        S.counts.mystery = (S.counts.mystery || 0) + 1;
        var res = S.d.mood === 'kin' || S.rng() < CONFIG.MYSTERY_MUTEKI_P ? 'muteki' : 'gekido';
        insertPause(S, t, CONFIG.MYSTERY_REVEAL, 'FROZEN', 'なになに…?');
        S.pendingMystery = { at: t + CONFIG.MYSTERY_REVEAL, result: res };
        ev.push({ type: 'mysteryOpen' });
        break;
      case 'perfect':
        S.counts.perfects++;
        S.perfCount = 0; S.perfPts = 0;
        rebuild(S, t, { sec: CONFIG.PERFECT_SEC, kind: 'PERFECT', say: 'あっ、ちょうちょ〜♪' }, 0);   // 終わったら「だ」から言い直し
        break;
    }
    return ev;
  }

  // ------------------------------------------------------------------ 終わり
  function endStats(S) {
    return {
      dan: S.dropped, score: Math.round(S.score), bestCombo: S.bestCombo, squeezes: S.squeezes, time: S.playT,
      bestWindow: S.playT >= CONFIG.WARMUP_SEC ? Math.max(S.bestWindow, S.windowDrops) : S.bestWindow, scene: sceneOf(S.dropped), seen: Object.keys(S.seen), counts: S.counts,
      outMood: S.out ? S.out.mood : null, early: S.out ? S.out.early : false, antic: S.out ? S.out.antic : false
    };
  }
  // 称号。rec = 通算の記録 {dajareUke, hengaoOK, titles:[]}
  function titlesFor(st, rec) {
    var got = [];
    function c(id, ok) { if (ok) got.push(id); }
    c('ippo', true);
    c('nanakoro', (rec.plays || 0) >= 8);
    c('suberi', st.squeezes >= 10);
    c('okorase', st.counts.okoriDrops >= 30);
    c('dajare', (rec.dajareUke || 0) >= 10);
    c('kin', st.counts.gold >= 3);
    c('bomb', st.counts.bomb >= 5);
    c('nekashi', st.counts.nemuiDrops >= 20);
    c('nirame', (rec.hengaoOK || 0) >= 10);
    c('renda', st.bestWindow >= CONFIG.RENDA_TITLE);
    c('kakure', st.time >= 300);
    return got;
  }
  function endLine(st, isBest, rng) {
    var key = 'normal';
    if (isBest && st.dan > 0) key = 'best';
    else if ((st.plays || 0) >= 3 && rng() < 0.35) key = 'nanakorobi';
    else if (st.early) key = 'early';
    else if (st.time >= 300) key = 'long';
    else if (st.antic) key = 'antic';
    else if (LINES[st.outMood]) key = st.outMood;
    var arr = LINES[key];
    return arr[Math.floor(rng() * arr.length)];
  }
  // 段位: 通算で落とした段の合計で上がる(だるま落としの「段」と 将棋・柔道の「段」をかけた しゃれ)
  var RANKS = [[0, '10級'], [100, '9級'], [200, '8級'], [350, '7級'], [500, '6級'], [700, '5級'], [900, '4級'], [1150, '3級'], [1400, '2級'], [1700, '1級'],
    [2000, '初段'], [3000, '二段'], [5000, '三段'], [8000, '四段'], [12000, '五段'], [17000, '六段'], [25000, '七段'], [35000, '八段'], [50000, '九段'], [70000, '十段'], [100000, '名人']];
  function rankOf(total) {
    var i = 0; while (i + 1 < RANKS.length && total >= RANKS[i + 1][0]) i++;
    var nx = RANKS[i + 1];
    return { idx: i, name: RANKS[i][1], next: nx ? nx[1] : null, toNext: nx ? nx[0] - total : 0 };
  }
  // 景色: 落とした段で 時間が進む(朝 → 昼 → 夕焼け → 夜 → ご来光)
  var SCENES = [[0, 'asa', '朝'], [60, 'hiru', '昼'], [150, 'yuyake', '夕焼け'], [250, 'yoru', '夜'], [400, 'goraiko', 'ご来光']];
  function sceneOf(dan) { var i = 0; while (i + 1 < SCENES.length && dan >= SCENES[i + 1][0]) i++; return { idx: i, id: SCENES[i][1], name: SCENES[i][2] }; }
  // 今日のだるまさん(日付から決まる)
  function dailyDaruma(dateStr) {
    var h = 0;
    for (var i = 0; i < dateStr.length; i++) h = (h * 31 + dateStr.charCodeAt(i)) >>> 0;
    var keys = ['futsu', 'gokigen', 'okori', 'ijiwaru', 'nemui', 'nakisou', 'tere'];
    var m = keys[makeRng(h)() * keys.length | 0];
    return { mood: m, line: DAILY_LINES[m] };
  }

  // ------------------------------------------------------------------ 公開
  var api = {
    CONFIG: CONFIG, MOODS: MOODS, MOOD_KEYS: MOOD_KEYS, FACE_KEYS: FACE_KEYS, MOOD_DRIFT: MOOD_DRIFT, WARMUP_DRIFT: WARMUP_DRIFT,
    BLOCKS: BLOCKS, BLOCK_ORDER: BLOCK_ORDER, BLOCK_WEIGHTS: BLOCK_WEIGHTS, ITEM_POOL: ITEM_POOL, ITEMS: ITEMS, CHOTTO: CHOTTO, CHOTTO_KEYS: CHOTTO_KEYS,
    DAJARE: DAJARE, DAJARE_UKE: DAJARE_UKE, LINES: LINES, TITLES: TITLES,
    setFaces: setFaces, pickFace: pickFace, reactTurn: reactTurn,
    rankOf: rankOf, sceneOf: sceneOf, SCENES: SCENES,
    makeRng: makeRng, rRange: rRange, rInt: rInt, wpick: wpick, clamp: clamp,
    stageOf: stageOf, stageNow: stageNow, makeCycle: makeCycle, phaseAt: phaseAt, kindAt: kindAt, chantIndex: chantIndex,
    isWatching: isWatching, isBlind: isBlind, isDanger: isDanger, setMood: setMood, insertPause: insertPause, cutWatch: cutWatch,
    forceTurn: forceTurn, refreshTell: refreshTell, darumaStep: darumaStep,
    nextBlockType: nextBlockType, makeBlock: makeBlock, fillTower: fillTower, ringInfo: ringInfo, slideInfo: slideInfo, hitBlock: hitBlock,
    comboMul: comboMul, scoreFor: scoreFor, newGame: newGame, step: step, pressHit: pressHit, dropBlock: dropBlock, ringWindow: ringWindow,
    canUseChotto: canUseChotto, useChotto: useChotto, canUseItem: canUseItem, useItem: useItem,
    endStats: endStats, titlesFor: titlesFor, endLine: endLine, dailyDaruma: dailyDaruma
  };
  for (var key in api) D[key] = api[key];
})();
