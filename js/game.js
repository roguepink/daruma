'use strict';
/* game.js — 画面・入力・演出・記録。きまり(アウトの判定・気分・段)は rules.js(window.D)にまかせる。
 * 状態: title(タイトル) / howto(3枚の絵の説明) / play(遊んでいる。G.paused でポーズ) / out(見つかった演出) / result(結果)
 * 論理サイズ 390×780 に固定して、画面に合わせて拡大縮小する。毎フレーム setTransform をかけ直す。 */
(function () {
  var C = D.CONFIG, W = C.W, H = C.H;
  var FONT = '"Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic UI","Meiryo","Noto Sans JP",system-ui,sans-serif';
  var cv = document.getElementById('game'), ctx = cv.getContext('2d');
  var stageEl = document.getElementById('stage');
  var $ = function (id) { return document.getElementById(id); };

  // ------------------------------------------------------------------ 絵(daruma-art.js が無いときの保険つき)
  var ART = window.DARUMA_ART;
  var FB = {   // かんたんな丸・四角で代わりに描く
    HEAD_BOTTOM: 0.45,
    drawHead: function (c, x, y, size, o) {
      var r = size / 2; c.save(); c.fillStyle = '#d83030'; c.beginPath(); c.arc(x, y, r, 0, 6.283); c.fill();
      if ((o.turn || 0) > 0.5) { c.fillStyle = '#fff4e0'; c.beginPath(); c.ellipse(x, y - r * 0.05, r * 0.6, r * 0.5, 0, 0, 6.283); c.fill();
        c.fillStyle = '#222'; c.beginPath(); c.arc(x - r * 0.25, y - r * 0.1, r * 0.08, 0, 6.283); c.arc(x + r * 0.25, y - r * 0.1, r * 0.08, 0, 6.283); c.fill(); }
      c.restore();
    },
    drawBlock: function (c, x, y, w, h, kind) {
      var col = { red: '#e23a3a', blue: '#2f6fd6', green: '#2fa651', yellow: '#f2c230', purple: '#8b4fc6', gold: '#e9b52c', rainbow: '#ff6fa0', hard: '#6e4a2e', timing: '#fff4e0', crack: '#d9cbb0', slide: '#7fd0ee', bounce: '#ff8cc0', double: '#f08a3c', bomb: '#2b2b33' }[kind] || '#e23a3a';
      c.save(); c.fillStyle = col; c.strokeStyle = '#1b1430'; c.lineWidth = 2; c.fillRect(x - w / 2, y - h / 2, w, h); c.strokeRect(x - w / 2, y - h / 2, w, h); c.restore();
    },
    drawHammer: function (c, x, y, a) { c.save(); c.translate(x, y); c.rotate(a || 0); c.fillStyle = '#a0703a'; c.fillRect(-4, -70, 8, 70); c.fillStyle = '#c08a4a'; c.fillRect(-28, -92, 56, 26); c.restore(); },
    drawBackground: function (c, w, h) { var g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#f3e6c8'); g.addColorStop(0.7, '#e8d4a8'); g.addColorStop(0.7, '#b8c890'); g.addColorStop(1, '#98a870'); c.fillStyle = g; c.fillRect(0, 0, w, h); },
    drawItem: function (c, x, y, size) { c.save(); c.fillStyle = '#ffe066'; c.beginPath(); c.arc(x, y, size / 2, 0, 6.283); c.fill(); c.restore(); }
  };
  function art(name) { ART = window.DARUMA_ART; return (ART && typeof ART[name] === 'function') ? ART[name] : FB[name]; }
  function headBottom() { return (ART && ART.HEAD_BOTTOM) || 0.45; }
  function safeDraw(name, args) { try { art(name).apply(null, args); } catch (e) { try { FB[name].apply(null, args); } catch (e2) {} } }

  // ------------------------------------------------------------------ 反応の顔(全部で100個の予定)
  // 絵の係が DARUMA_ART.FACES([{id,name,group}])を作るまでは、いまの14表情を 仮の一覧として使う。絵が来たら 自動でそちらを使う
  var FALLBACK_FACES = [
    { id: 'angry', name: 'ぷんすか', group: 'tsuntsun' }, { id: 'suspicious', name: 'じとー', group: 'tsuntsun' }, { id: 'mean', name: 'にやり', group: 'tsuntsun' },
    { id: 'laugh', name: 'げらげら', group: 'dajare' }, { id: 'dizzy', name: 'くらくら', group: 'dajare' }, { id: 'surprised', name: 'びくっ', group: 'dajare' },
    { id: 'happy', name: 'にこにこ', group: 'kusuguru' }, { id: 'shy', name: 'てれてれ', group: 'kusuguru' },
    { id: 'smug', name: 'ドヤ', group: 'common' }, { id: 'normal', name: 'きょとん', group: 'common' }, { id: 'sleepy', name: 'ねむねむ', group: 'common' }, { id: 'sad', name: 'うるうる', group: 'common' },
    { id: 'oneeye', name: '片目', group: 'rare' }, { id: 'blind', name: '目かくし', group: 'rare' }
  ];
  function realFaces() { var A = window.DARUMA_ART; return A && A.FACES && A.FACES.length ? A.FACES : null; }
  var GOLDEN_FACE = { id: 'golden', name: 'ゴールデンだるま', group: 'rare' };
  function faceList() { var L = realFaces() || FALLBACK_FACES; return L.concat([GOLDEN_FACE]); }
  function reactFaces() { return realFaces() || FALLBACK_FACES; }
  function faceById(id) { var L = faceList(); for (var i = 0; i < L.length; i++) if (L[i].id === id) return L[i]; return null; }
  // 気分・チラ見・アウトの顔(絵の表情名)を、一覧の id か 名前で さがす
  function faceIdOfArt(artMood) { var L = faceList(); for (var i = 0; i < L.length; i++) if (L[i].id === artMood || L[i].name === artMood) return L[i].id; return null; }
  D.setFaces(reactFaces());
  function drawFaceById(c, x, y, size, id, opts) {
    opts = opts || {};
    var A = window.DARUMA_ART;
    try {
      if (realFaces()) {
        if (opts.turn == null && typeof A.drawFace === 'function') { A.drawFace(c, x, y, size, id, { t: opts.t || 0 }); return; }
        A.drawHead(c, x, y, size, { face: id, turn: opts.turn == null ? 1 : opts.turn, t: opts.t || 0, shadow: false, dir: opts.dir }); return;
      }
    } catch (e) {}
    safeDraw('drawHead', [c, x, y, size, { turn: opts.turn == null ? 1 : opts.turn, mood: id, t: opts.t || 0, shadow: false, dir: opts.dir }]);
  }
  function drawFaceLocked(c, x, y, size, id) {
    var A = window.DARUMA_ART;
    try { if (A && typeof A.drawFaceLocked === 'function') { A.drawFaceLocked(c, x, y, size, id); return; } } catch (e) {}
    c.save(); c.fillStyle = 'rgba(255,255,255,0.16)'; c.beginPath(); c.arc(x, y, size * 0.42, 0, 6.283); c.fill();
    c.font = '900 ' + Math.round(size * 0.45) + 'px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = 'rgba(255,255,255,0.65)'; c.fillText('?', x, y + 1); c.restore();
  }
  var REACT_LINES = {
    angry: ['なにすんの!', 'もー!', 'つつかないでよ〜', 'ぷんぷん!'], tsuntsun: ['なにすんの!', 'もー!'], cry: ['いたいよ〜…', 'ひどい… ぐすっ', 'うえ〜ん'],
    joy: ['えへへ、もっと〜♪', 'つんつん すき♪', 'もう1回 やって♪'], neutral: ['……ん?', 'なにか ご用?', 'え、なに?'],
    laugh: ['ひゃははは!', 'くすくす… やめて〜', 'こしょばい〜!'], kusuguru: ['ひゃははは!', 'こしょばい〜!'], uke: ['あはは! いまの もう1回 言って', 'ぶははっ!', 'お腹 いたい〜'],
    flop: ['さむっ… お茶 ちょうだい', '……つまんない', 'しーん…'], bored: ['もう きかないよ〜', 'またそれ〜?'], demo: ['つんつん されると こっちを むくよ! たまに なにか 出るかも?']
  };
  var WATCH_NETA = {
    any: ['…じーっ(目が かわいてきた)', 'まばたき がまん…', 'きみの うしろに なにか いる… うそ', 'いま 動いた? 動いてないね?', 'にらめっこ なら まけないよ'],
    okori: ['ぜったい 見のがさないぞ', 'まだかな〜 ぷんぷん'], gekido: ['ゴゴゴゴ…'], nemui: ['ねむ… いや 見てる 見てる'], ijiwaru: ['つぎは いつ ふりむこうかな〜'], gokigen: ['ふんふふ〜ん♪'], tere: ['あんまり 見ないで…']
  };
  var BACK_NETA = {
    any: ['みかん おいしい…', 'ふんふふ〜ん♪', 'ぼくの スマホ どこ?… 手が なかった', '背中 かゆい… 手が とどかない というか 手が ない', 'ハ…ハ…ハックション!', 'ふぁ〜あ'],
    okori: ['ぶつぶつ… ぶつぶつ…'], nemui: ['むにゃ… おもち…'], ijiwaru: ['ひひひ… いつ ふりむこうかな'], gokigen: ['きょうは いい日だな〜'], nakisou: ['ぐすん… さみしい']
  };
  function netaOf(T, mood) { var a = (T[mood] || []).concat(T.any); return a[Math.floor(G.lastRng() * a.length)]; }
  function seeFace(id) { if (!id) return; if (!G.sessionFaces) G.sessionFaces = {}; G.sessionFaces[id] = true; }

  // ------------------------------------------------------------------ 画面の配置(design.md 1 章)
  var R = {
    pause: { x: 8, y: 4, w: 44, h: 44 }, sound: { x: 338, y: 4, w: 44, h: 44 },
    ton: { x: 16, y: 624, w: 358, h: 140 },
    slots: [{ x: 306, y: 362, w: 72, h: 72 }, { x: 306, y: 442, w: 72, h: 72 }],
    chotto: [{ x: 12, y: 536, w: 120, h: 62 }, { x: 135, y: 536, w: 120, h: 62 }, { x: 258, y: 536, w: 120, h: 62 }],   // 変顔は だるまさんの顔をタッチ
    tower: { x: 95, y: 150, w: 200, h: 370 }
  };
  var HEAD = { x: 195, size: 150 }, TOWER_BOTTOM = 516, BG_H = 740;
  function inR(r, x, y) { return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }

  // ------------------------------------------------------------------ 記録(localStorage。失敗しても止めない)
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function loadRecords() {
    var st = null; try { st = JSON.parse(lsGet(C.STATS_KEY) || 'null'); } catch (e) {}
    st = st || {};
    return { best: +lsGet(C.BEST_KEY) || 0, bestDan: +lsGet(C.BEST_DAN_KEY) || 0, tutorialDone: lsGet(C.TUTORIAL_KEY) === '1',
      stats: { plays: st.plays || 0, totalDan: st.totalDan || 0, faces: st.faces || [], faceIds: st.faceIds || [], titles: st.titles || [], dajareUke: st.dajareUke || 0, hengaoOK: st.hengaoOK || 0 } };
  }
  // 保存場所の記録と 今の記録を合わせる(高いほう・多いほうを残す)。
  // ホーム画面のアプリと ブラウザなど 2か所で開いていると、古い画面が 低いベストで上書きしてしまうため(2026-11-14 ノブさん「最高得点が上がらない」)
  function mergeRecords(a, b) {
    function uni(x, y) { var o = (x || []).slice(); (y || []).forEach(function (v) { if (o.indexOf(v) < 0) o.push(v); }); return o; }
    return { best: Math.max(a.best || 0, b.best || 0), bestDan: Math.max(a.bestDan || 0, b.bestDan || 0), tutorialDone: !!(a.tutorialDone || b.tutorialDone),
      stats: { plays: Math.max(a.stats.plays, b.stats.plays), totalDan: Math.max(a.stats.totalDan, b.stats.totalDan), faces: uni(a.stats.faces, b.stats.faces),
        titles: uni(a.stats.titles, b.stats.titles), faceIds: uni(a.stats.faceIds, b.stats.faceIds), dajareUke: Math.max(a.stats.dajareUke, b.stats.dajareUke), hengaoOK: Math.max(a.stats.hengaoOK, b.stats.hengaoOK) } };
  }
  function refreshRecords() { G.rec = mergeRecords(loadRecords(), G.rec); }
  function saveRecords(r) {
    lsSet(C.BEST_KEY, String(r.best)); lsSet(C.BEST_DAN_KEY, String(r.bestDan));
    lsSet(C.STATS_KEY, JSON.stringify(r.stats));
    if (r.tutorialDone) lsSet(C.TUTORIAL_KEY, '1');
  }

  // ------------------------------------------------------------------ 全体の状態
  var CHALLENGE = (function () { try { var c = parseInt(new URLSearchParams(location.search).get('c'), 10); return c > 0 && c < 100000 ? c : 0; } catch (e) { return 0; } })();
  var today = (function () { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); })();
  var G = window.G = {
    mode: 'title', S: null, paused: false, countdown: 0, at: 0, acc: 0, lastNow: 0,
    rec: loadRecords(), daily: D.dailyDaruma(today),
    fx: [], flyers: [], texts: [], bubble: null, pbubble: null, tip: null, flash: 0, flashCol: '255,40,40', shake: 0,
    swing: 0, fall: 0, chantAt: [], scoreBump: 0, comboEnd: 0, faceOver: null, towerTapHint: 0, tipsShown: {},
    howtoPage: 0, outT: 0, outInfo: null, result: null, tapX: null, lastRng: D.makeRng(Date.now() >>> 0)
  };

  // ------------------------------------------------------------------ 拡大縮小(論理サイズ固定)
  var VIEW = { s: 1, ox: 0, oy: 0, dpr: 1 };
  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 3);
    var w = window.innerWidth, h = window.innerHeight;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    var st = 0, sb = 0, sa = document.getElementById('sa');
    if (sa) { try { var cs = getComputedStyle(sa); st = parseFloat(cs.paddingTop) || 0; sb = parseFloat(cs.paddingBottom) || 0; } catch (e) {} }
    var hh = Math.max(200, h - st - sb);
    var s = Math.min(w / W, hh / H);
    VIEW.s = s; VIEW.dpr = dpr; VIEW.ox = (w - W * s) / 2; VIEW.oy = st + (hh - H * s) / 2;
    stageEl.style.width = W + 'px'; stageEl.style.height = H + 'px';
    stageEl.style.transform = 'translate(' + VIEW.ox + 'px,' + VIEW.oy + 'px) scale(' + s + ')';
  }
  addEventListener('resize', resize); resize();
  function baseTransform() { ctx.setTransform(VIEW.s * VIEW.dpr, 0, 0, VIEW.s * VIEW.dpr, VIEW.ox * VIEW.dpr, VIEW.oy * VIEW.dpr); }
  function toLogical(ev) { return { x: (ev.clientX - VIEW.ox) / VIEW.s, y: (ev.clientY - VIEW.oy) / VIEW.s }; }

  // ------------------------------------------------------------------ 画面の切り替え
  function show(id, on) { var el = $(id); if (el) el.classList.toggle('hidden', !on); }
  function hideAll() { ['title', 'howto', 'pause', 'result', 'zukan', 'faceModal'].forEach(function (id) { show(id, false); }); }
  function fmt(n) { return Math.round(n).toLocaleString('ja-JP'); }

  function toTitle() {
    refreshRecords();
    G.mode = 'title'; G.paused = false; hideAll(); show('title', true);
    var rk = D.rankOf(G.rec.stats.totalDan || 0);
    $('tBest').textContent = (G.rec.best ? 'ベスト ' + fmt(G.rec.best) + '点 / 最高 ' + G.rec.bestDan + '段\n' : '') + '段位 ' + rk.name + (rk.next ? '(' + rk.next + 'まで あと' + rk.toNext + '段)' : '');
    if (false) $('tBest').textContent = G.rec.best ? 'ベスト ' + fmt(G.rec.best) + ' 点 / 最高 ' + G.rec.bestDan + ' 段' : 'はじめての挑戦!';
    $('tDaily').textContent = CHALLENGE ? 'ともだちから 挑戦状!\n' + CHALLENGE + '段を こえろ!' : '今日のだるまさん\n' + G.daily.line;
    AUDIO.bgm('title');
  }
  function toHowto() { G.mode = 'howto'; G.howtoPage = 0; hideAll(); show('howto', true); setHowto(); }
  var HOWTO = [
    ['むこうを むいている あいだに', 'トン!トン!', '下の大きいボタンで、いちばん下の段を叩いて落とそう'],
    ['赤い字が 出たら', '手を とめる', '「こ ろ ん だ」が赤くなったら、もうすぐ ふりむくよ'],
    ['見ているときに おしたら', 'おしまい', 'ちょっかいで きぶんが かわるよ\n見ている時は 顔をタッチ'],
    ['段の いろで', '点数が ちがう', '']
  ];
  function tableHTML() {
    return D.BLOCK_ORDER.map(function (k) {
      var b = D.BLOCKS[k];
      return '<span><i class="chip" style="background:' + (b.chip || b.hex) + '"></i>' + b.color + ' ' + b.name + '</span><span class="how">' + b.how + '</span><span class="pt">' + b.pts + '点</span>';
    }).join('');
  }
  (function () { var h = tableHTML(); if ($('hTable')) $('hTable').innerHTML = h; if ($('pTable')) $('pTable').innerHTML = h; })();
  function setHowto() {
    var p = HOWTO[G.howtoPage];
    var last = HOWTO.length - 1;
    $('hNum').textContent = (G.howtoPage + 1) + ' / ' + HOWTO.length;
    $('hText1').textContent = p[0]; $('hText2').textContent = p[1]; $('hText3').textContent = p[2];
    $('hTable').style.display = G.howtoPage === last ? '' : 'none';
    $('hText3').style.display = G.howtoPage === last ? 'none' : '';
    $('hCard').classList.toggle('tall', G.howtoPage === last);
    $('btnNext').textContent = G.howtoPage < last ? 'つぎへ' : 'はじめる!';
  }
  function howtoNext() { if (G.howtoPage < HOWTO.length - 1) { G.howtoPage++; setHowto(); sfx('tap'); } else startGame(); }

  function startGame(opts) {
    opts = opts || {};
    hideAll();
    refreshRecords(); D.setFaces(reactFaces());
    var tutorial = opts.tutorial != null ? opts.tutorial : !G.rec.tutorialDone;
    var seed = opts.seed || ((Date.now() ^ (Math.random() * 1e9)) >>> 0);
    G.S = D.newGame({ seed: seed, tutorial: tutorial, firstPlay: G.rec.stats.plays === 0, daily: G.daily.mood });
    G.mode = 'play'; G.paused = false; G.countdown = 0; G.acc = 0;
    G.fx = []; G.flyers = []; G.texts = []; G.bubble = null; G.pbubble = null; G.tip = null; G.flash = 0; G.shake = 0; G.fall = 0;
    G.pop = null; G.flop = null; G.goldenView = null; G.big = null; G.ptsText = null;
    G.goalPassed = {}; G.goalBestDan = G.rec.bestDan; G.sceneIdx = null; G.netaAt = null; G.backNetaAt = 0; G.ippoText = G.at + 1.6;
    G.chantAt = []; G.faceOver = null; G.sessionFaces = {}; G.faceTag = null; G.outInfo = null; G.tapX = null; G.comboEnd = 0;
    if (tutorial) { say('れんしゅう だよ!むこうを むいたら トン!', 3); }
    AUDIO.bgm('play');
  }

  function pauseGame() {
    if (G.mode !== 'play' || G.paused) return;
    G.paused = true; G.countdown = 0; show('pause', true); AUDIO.bgm(null);
  }
  function resumeGame() {
    if (G.mode !== 'play') return;
    show('pause', false); G.paused = false; G.countdown = C.RESUME_COUNT; G.acc = 0;
  }

  // ------------------------------------------------------------------ 音
  function sfx(n) { try { AUDIO.sfx(n); } catch (e) {} }
  function moodBgm() {
    var S = G.S; if (!S) return;
    var k = D.kindAt(S.d, S.t);
    if (k === 'PERFECT') AUDIO.bgm('fever');
    else if ((k === 'WATCH' || k === 'GRACE') && !D.isBlind(S, S.t)) AUDIO.bgm(null);
    else AUDIO.bgm(S.d.mood === 'okori' || S.d.mood === 'gekido' ? 'angry' : 'play');
  }

  // ------------------------------------------------------------------ 演出の部品
  function say(text, sec, col) { G.bubble = { text: text, until: G.at + (sec || 1.6), col: col || '#fffaf0', t0: G.at }; }
  function psay(text, sec) { G.pbubble = { text: text, until: G.at + (sec || 2), t0: G.at }; }
  // ヒントを出してはいけない時(だるまさんが見そう・見ている・むてき中)
  function tipBlocked(S) { var k = D.kindAt(S.d, S.t); return k === 'WARN' || k === 'FEINT' || k === 'GRACE' || k === 'WATCH' || k === 'PERFECT' || !!S.golden || midWarn(S, S.t); }
  function tip(key, text) { if (G.tipsShown[key]) return; G.tipsShown[key] = true; G.tip = { text: text, until: G.at + 3.2, t0: G.at }; }
  var BIG_Y = 360, BIG_X = 236, BIG_W = 272;   // 大きな文字の 場所(左の列「ころんだ」「この回」の 右。吹き出しと 重ならない)
  function bigMsg(text, col, size, dur, prio, y) {
    var b = G.big;
    if (b && G.at - b.t0 < b.dur && b.prio > prio) return null;   // もっと大事な字が 出ている
    G.big = { text: text, col: col, size: size, dur: dur || 1.0, prio: prio, t0: G.at, y: y };
    if (prio >= 2 && G.ptsText) { var ix = G.texts.indexOf(G.ptsText); if (ix >= 0) G.texts.splice(ix, 1); G.ptsText = null; }
    return G.big;
  }
  function bigBusy(minPrio) { var b = G.big; return !!b && G.at - b.t0 < b.dur && b.prio >= minPrio; }
  function drawBig() {
    var b = G.big; if (!b) return;
    var rp = G.S && D.phaseAt(G.S.d, G.S.t); if (rp && rp.react && (rp.k === 'WARN' || rp.k === 'GRACE')) return;
    var a = (G.at - b.t0) / b.dur; if (a >= 1) { G.big = null; return; }
    ctx.save(); ctx.globalAlpha = a < 0.75 ? 1 : 1 - (a - 0.75) / 0.25;
    var sc = a < 0.12 ? 0.6 + a / 0.12 * 0.5 : 1.1 - Math.min(0.1, a - 0.12);
    ctx.font = '900 ' + (b.size * sc) + 'px ' + FONT;
    var wmax = ctx.measureText(b.text).width, s2 = wmax > BIG_W ? BIG_W / wmax : 1;
    text(b.text, b.y ? 195 : BIG_X, (b.y || BIG_Y) - a * 16, b.size * sc * s2, b.col, 'center', 900, '#1b1430', Math.max(4, b.size * 0.2));
    ctx.restore();
  }
  function floatText(x, y, text, col, size, dur) { var o = { x: x, y: y, text: text, col: col || '#fff', size: size || 22, t0: G.at, dur: dur || 0.9 }; G.texts.push(o); return o; }
  function burst(x, y, col, n, spd) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * 6.283, v = (spd || 160) * (0.4 + Math.random());
      G.fx.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: 0.5 + Math.random() * 0.4, age: 0, col: col, r: 2 + Math.random() * 3 });
    }
  }
  function blockColor(t) {
    var k = D.BLOCKS[t].art;
    return (ART && ART.BLOCK_COLORS && ART.BLOCK_COLORS[k]) || '#e23a3a';
  }
  function faceOverride(mood, sec) { G.faceOver = { mood: mood, until: G.at + sec }; }

  // ------------------------------------------------------------------ 起きたことに合わせて 音・演出
  function handle(evs) {
    var S = G.S;
    for (var i = 0; i < evs.length; i++) {
      var e = evs[i], blind = D.isBlind(S, S.t);
      switch (e.type) {
        case 'letter':
          if (e.silent) { G.chantAt = []; break; }
          if (e.i === 0) G.chantAt = [];
          G.chantAt[e.i] = G.at;
          if (e.ph && e.ph.dbl) { sfx('voicelast'); break; }
          if (e.ph && e.ph.alt && e.i === 5) { sfx('flop'); floatText(HEAD.x - 40, (G.headY || 230) + 40, 'ぷっ', '#c8a070', 24, 0.9); }
          if (e.i <= 5) sfx('voice');
          else if (e.i <= 8) sfx('warn');
          else sfx('voicelast');
          break;
        case 'phase':
          if (e.k === 'PAUSE' && e.ph.say) say(e.ph.say, Math.min(1.6, e.ph.e - e.ph.s + 0.3));
          if (e.k === 'FROZEN' && e.ph.say) say(e.ph.say, e.ph.e - e.ph.s + 0.3);
          if (e.k === 'SAFE' && e.ph.say === 'なんちゃって') { say('…なんちゃって!', 1.0, '#ffe0f0'); sfx('laugh'); }
          if (e.k === 'WARN') { if (e.ph.dbl) say('…だっ!', 0.8, '#ffd0d0'); if (S.d.mood === 'bikkuri' && !e.ph.dbl) say(S.d.wakeUp ? 'はっ!ねてない!' : '!?', 0.9, '#fff3a0'); }
          if (e.k === 'GRACE' && !blind) sfx('turn');
          if (e.k === 'WATCH' && e.ph.react && !blind) {
            var fobj = faceById(e.ph.face), lines = REACT_LINES[e.ph.react] || REACT_LINES.tsuntsun;
            seeFace(e.ph.face);
            G.faceTag = { name: fobj ? fobj.name : '', until: G.at + 1.3 };
            var rk = e.ph.react;
            say(lines[Math.floor(G.lastRng() * lines.length)], 1.2, rk === 'angry' || rk === 'flop' || rk === 'cry' ? '#ffd8cc' : '#fffaf0');
            sfx(rk === 'angry' ? 'angry' : rk === 'flop' || rk === 'bored' || rk === 'cry' ? 'flop' : rk === 'neutral' ? 'tap' : 'laugh');
          } else if (e.k === 'WATCH') {
            if (!blind) seeFace(faceIdOfArt(D.MOODS[S.d.mood].art));
            if (!blind && e.ph.alt) { faceOverride('shy', 1.6); setTimeout(function () { say('…いまの ぼくじゃ ないよ', 1.4, '#ffe0f0'); }, 150); }
            else if (!blind && e.ph.e - e.ph.s >= 1.4 && G.lastRng() < 0.5) G.netaAt = { at: G.at + 0.55, ph: e.ph, text: netaOf(WATCH_NETA, S.d.mood) };
            if (!blind) { G.flash = 1; G.flashCol = '255,40,40'; G.shake = 0.35; floatText(HEAD.x + 104, 196, 'じーっ', '#ff4040', 24, 0.8); if (S.tutorial) say('見てるよ〜 さわらないでね', 1.4); }
            else { G.blindWatches = (G.blindWatches || 0) + 1; say(G.blindWatches >= 2 && G.lastRng() < 0.6 ? 'むむっ…木の においが する…!' : 'あれ?見えないよ〜', 1.6, '#e6dcff'); }
          }
          if (e.k === 'RETURN') sfx('back');
          if (e.k === 'PERFECT') { sfx('perfect'); say('あっ、ちょうちょ〜♪', 1.6, '#ffe0f0'); }
          if (e.k === 'STOP') { sfx('ring'); }
          moodBgm();
          break;
        case 'returned':
          moodBgm();
          if (e.drops > 0) G.safeShow = { n: e.drops, until: G.at + 1.1 };
          if (e.drops >= 5 && G.lastRng() < 0.35) say('……あれ? なんか 背が ひくくなってない?', 2.2);
          break;
        case 'goldSeen': say('いま 金色の なにか 飛んでかなかった?', 2.0); break;
        case 'perfectEnd':
          say('はっ!ちょうちょ 行っちゃった', 1.8);
          bigMsg('パーフェクト ' + e.count + '段!', '#ffe066', 32, 1.6, 3);
          G.perfText = null;
          break;
        case 'drop': onDrop(e); break;
        case 'damage':
          G.swing = 1;
          e.block.flash = 1;
          sfx(e.block.kind === 'mash' || e.block.kind === 'hibi' ? 'hard' : 'hit');
          burst(130, 498, blockColor(e.block.t), 4, 90);
          if (e.block.kind === 'mash') tip('mash', 'かたい段は 連打で こわそう!');
          if (e.block.kind === 'double') tip('double', '2だんは すばやく 2回!');
          if (e.block.kind === 'mochi') tip('mochi', 'おもちは 手を休めると もどるよ!');
          break;
        case 'miss':
          G.swing = 1; sfx('miss'); if (!bigBusy(2)) floatText(250, 474, 'カン!', '#ffffff', 26, 0.6);
          if (G.S.combo === 0 && G.S.windowDrops > 1) G.comboEnd = G.at + 1;
          if (e.block.kind === 'ring') tip('ring', '輪が まとに 重なったら トン!');
          else tip('slide', '▲が まんなかに 来たら トン!');
          break;
        case 'tooFast': G.swing = 1; sfx('tap'); break;
        case 'tama': floatText(46, 340, '玉 +1', '#ffe066', 20, 1.2); tip('tama', 'ちょっかいを つかってみよう!(下の3つ)'); break;
        case 'item':
          sfx('item'); bigMsg(D.ITEMS[e.item].name + ' ゲット!', '#fff3a0', 24, 1.3, 2);
          tip('item', e.item === 'shield' ? 'まもり:1回だけ 見つかっても セーフ!' : 'アイテムを ためしてみて!(右の わく)');
          break;
        case 'itemPoints': bigMsg('+100', '#fff3a0', 26, 1.0, 1); break;
        case 'bomb':
          sfx('angry'); burst(195, 480, '#ffb020', 26, 260); burst(195, 480, '#555', 14, 200); G.shake = 0.5; G.flash = 0.7; G.flashCol = '255,200,80';
          if (G.ptsText) { var bi = G.texts.indexOf(G.ptsText); if (bi >= 0) G.texts.splice(bi, 1); }
          bigMsg('ドカーン!', '#ffb020', 36, 0.9, 3);
          tip('bomb', 'ばくだんを おとすと びっくりして ふりむくよ!');
          break;
        case 'bombDud': floatText(195, 460, 'ポン', '#ccc', 22, 0.6); break;
        case 'forgive':
          sfx('shield'); say('みーつけた!…でも れんしゅう だから ゆるしてあげる', 2.4); G.flash = 0.6; G.flashCol = '255,120,120';
          break;
        case 'shield':
          sfx('shield'); say('あれ?気のせいかな〜?', 1.8, '#e6dcff'); burst(195, 240, '#d8f4ff', 30, 240); G.flash = 0.6; G.flashCol = '200,240,255';
          break;
        case 'react': break;
        case 'goldenStart': seeFace('golden'); sfx('item'); G.ippoText = 0; bigMsg('ゴールデンだるま!', '#ffe066', 30, 1.3, 3); G.goldenT0 = G.at; G.goldenView = { inflate: 0 }; say('な、なにか 出た…!?', 1.4, '#fff3c0'); AUDIO.bgm('fever'); break;
        case 'goldenTap': try { AUDIO.puu(e.inflate); } catch (x) {} if (e.inflate > 0.75 && G.lastRng() < 0.3) sfx('gpuru'); G.swing = 1; break;
        case 'goldenPop':
          sfx('gpop'); G.pop = { t0: G.at }; G.goldenView = null; G.shake = 0.6; G.flash = 0.9; G.flashCol = '255,230,120';
          for (var cf = 0; cf < 6; cf++) burst(195, 330, ['#ff4a6a', '#ffd84a', '#4ac8ff', '#7ae05a', '#ff9ad0', '#ffffff'][cf], 18, 420);
          bigMsg('+' + fmt(e.pts) + '点', '#ffe066', 40, 1.6, 3, 500);   // 「ドーン!」は くす玉の絵が 出す faceOverride('surprised', 1.8); moodBgm();
          break;
        case 'goldenFlop': sfx('gpshu'); G.flop = { t0: G.at, inflate: e.inflate }; G.goldenView = null; bigMsg('ぷしゅ〜 +' + e.pts, '#ffe8a0', 28, 1.4, 3); say('……おしい!', 1.4); moodBgm(); break;
        case 'korobi': sfx('drop'); G.shake = 0.3; bigMsg('ほんとうに ころんだ!', '#9be15d', 30, 1.4, 3); say('あいたたた…', 1.4); break;
        case 'getup': sfx('ok'); say('よいしょ! 七転び八起き!', 1.2); break;
        case 'girigiri': G.slowUntil = G.at + 0.3; sfx('shield'); bigMsg('ギリギリ セーフ!! +' + C.GIRIGIRI_BONUS, '#ffe066', 38, 1.3, 4); break;
        case 'kinSoon': bigMsg('つぎ 金だるま が 来るよ!', '#ffd84a', 22, 1.6, 2); break;
        case 'kinArrive': sfx('gold'); G.flash = 0.5; G.flashCol = '255,220,80'; say('おや? 金色の だるまさん! 点数3倍', 2.0, '#fff3c0'); break;
        case 'kinLeave': say('金だるま、帰っちゃった', 1.6, '#fff3c0'); break;
        case 'saisen': floatText(130, 58, 'おさいせん ' + e.n + '/' + C.SAISEN_WISH, '#ffe066', 16, 1.2); break;
        case 'saisenWish': sfx('item'); bigMsg('おねがい かなった! つぎは 虹', '#ffe066', 24, 1.6, 2); break;
        case 'ippo': sfx('gold'); G.swing = 1; G.ippoText = 0; bigMsg('いーっぽ!', '#ffe066', 40, 1.0, 2); break;
        case 'reactDemo': tip('react', 'ちょっかいを すると こっちを むくよ。そのあいだは トン!しないで'); break;
        case 'out': onOut(); break;
        case 'tutorialDone':
          sfx('best'); say('じょうず!ほんばん いくよ!', 2.2, '#fff3a0'); G.rec.tutorialDone = true; saveRecords(G.rec);
          break;
        case 'newFace': break;
        case 'peek': seeFace(faceIdOfArt('shy')); sfx('shy'); G.peekText = floatText(HEAD.x - 92, (G.headY || 230) - 52, 'ちらっ', '#ff9ad0', 18, 0.8); break;
        case 'peekCaught': sfx('warn'); faceOverride('suspicious', 1.3); say('ん?', 1.2, '#fff3a0'); break;
        case 'mysteryOpen': G.mystery = { t0: G.at, result: null }; sfx('item'); break;
        case 'mysteryResult':
          if (G.mystery) { G.mystery.result = e.result; G.mystery.t1 = G.at; }
          if (e.result === 'muteki') { sfx('best'); say('え〜!? ずるい〜', 1.6); }
          else { sfx('angry'); G.shake = 0.7; G.flash = 0.8; G.flashCol = '200,0,0'; say('ゆるさなーい!!', 1.6, '#ffc0b0'); }
          moodBgm();
          break;
        case 'mutekiSave': sfx('shield'); say('ずるい!', 1.0, '#fff3a0'); break;
      }
    }
  }
  function onDrop(e) {
    var S = G.S, b = e.block, col = blockColor(b.t);
    G.swing = 1; G.fall = Math.max(G.fall, (b.kind === 'double' ? 2 : 1) * C.BLOCK_H);
    if (!e.auto || G.lastRng() < 0.5) G.flyers.push({ kind: D.BLOCKS[b.t].art, x: 195, y: TOWER_BOTTOM - (b.kind === 'double' ? C.BLOCK_H : C.BLOCK_H / 2), vx: 520 + Math.random() * 100, vy: -720 - Math.random() * 120, rot: 0, vr: 5 + Math.random() * 3, age: 0, h: b.kind === 'double' ? C.BLOCK_H * 2 + 6 : C.BLOCK_H + 6 });
    burst(250, 498, col, e.auto ? 3 : 8, 180);
    if (!e.auto || Math.random() < 0.5) sfx(b.t === 'kin' || b.t === 'niji' ? 'gold' : 'drop');
    var hex = D.BLOCKS[b.t].hex;
    if (e.perfect) {
      if (G.perfText && G.texts.indexOf(G.perfText) >= 0) { G.perfText.text = 'むてき +' + fmt(S.perfPts || 0); G.perfText.t0 = G.at - 0.2; }
      else if (!bigBusy(2)) { G.perfText = floatText(240, 490, 'むてき +' + fmt(S.perfPts || 0), '#ffe066', 24, 1.0); }
    } else {
      if (G.ptsText) { var ix = G.texts.indexOf(G.ptsText); if (ix >= 0) G.texts.splice(ix, 1); G.ptsText = null; }
      if (!bigBusy(2)) G.ptsText = floatText(250, 474, '+' + fmt(e.pts) + (e.squeeze ? ' すべりこみ!' : ''), e.squeeze ? '#ff7070' : hex, e.pts >= 100 ? 26 : 24, 0.8);
    }
    G.scoreBump = 1;
    if (e.squeeze) tip('squeeze', '赤い字の間に落とすと 1.5倍。でも こわいよ');
    if (e.combo && e.combo % 5 === 0) { sfx('combo'); G.comboPop = G.at; }
    if (b.t === 'kin') burst(195, 498, '#fff0a0', 16, 220);
  }
  function onOut() {
    seeFace(faceIdOfArt(G.S.out.mood === 'okori' ? 'angry' : 'smug'));
    var S = G.S;
    sfx('out'); AUDIO.bgm(null);
    G.mode = 'out'; G.outT = 0; G.flash = 1; G.flashCol = '255,0,0'; G.shake = 0.6;
    var watchStart = S.out.phaseStart;
    G.outInfo = { mood: S.out.mood, rush: S.out.t - watchStart < 0.5 };
  }
  function toResult() {
    refreshRecords();
    var S = G.S, st = D.endStats(S), r = G.rec;
    var isBest = st.score > r.best, isBestDan = st.dan > r.bestDan;
    var prevBest = r.best;
    if (isBest) r.best = st.score;
    if (isBestDan) r.bestDan = st.dan;
    var rankBefore = D.rankOf(r.stats.totalDan || 0);
    r.stats.plays++; r.stats.totalDan += st.dan;
    var rankAfter = D.rankOf(r.stats.totalDan);
    r.stats.dajareUke += st.counts.dajareUke; r.stats.hengaoOK += st.counts.hengaoOK;
    st.seen.forEach(function (f) { if (r.stats.faces.indexOf(f) < 0) r.stats.faces.push(f); });
    if (!r.stats.faceIds) r.stats.faceIds = [];
    var newFaces = Object.keys(G.sessionFaces || {}).filter(function (id) { return r.stats.faceIds.indexOf(id) < 0; });
    newFaces.forEach(function (id) { r.stats.faceIds.push(id); });
    G.newFaces = {}; newFaces.forEach(function (id) { G.newFaces[id] = true; });
    var got = D.titlesFor(st, r.stats), news = got.filter(function (id) { return r.stats.titles.indexOf(id) < 0; });
    news.forEach(function (id) { r.stats.titles.push(id); });
    saveRecords(r);
    st.plays = r.stats.plays;
    var line = r.stats.plays === 8 ? '8回目だね。もう 起き上がりの プロだ' : D.endLine(st, isBest && prevBest > 0, G.lastRng);
    var face = isBest && prevBest > 0 ? 'happy' : ({ okori: 'angry', ijiwaru: 'mean', nemui: 'sleepy', bikkuri: 'surprised', nakisou: 'sad', tere: 'shy', gokigen: 'laugh', futsu: 'smug' }[st.outMood] || 'smug');
    G.result = { st: st, face: face, isBest: isBest, oneEye: isBest && prevBest > 0 };
    G.mode = 'result'; hideAll(); show('result', true);
    $('rLine').textContent = '「' + line + '」';
    $('rDan').textContent = st.dan;
    $('rScore').textContent = fmt(st.score) + ' 点';
    $('rBest').textContent = isBest ? '★ ベスト更新!' : 'ベストまで あと ' + fmt(r.best - st.score) + ' 点';
    $('rBest').classList.toggle('best', isBest);
    $('rWin').textContent = (st.bestWindow > 0 ? '1回で いちばん多く ' + st.bestWindow + 'こ / ' : '') + st.scene.name + 'まで 行けた!';
    $('rStats').textContent = 'コンボ ' + st.bestCombo + ' / ギリギリ ' + (st.counts.girigiri || 0) + ' / ゴールデン ' + (st.counts.goldenPop || 0) + ' / ' + Math.floor(st.time / 60) + '分' + Math.floor(st.time % 60) + '秒';
    var nextT = null; for (var ti = 0; ti < D.TITLES.length; ti++) if (r.stats.titles.indexOf(D.TITLES[ti].id) < 0) { nextT = D.TITLES[ti]; break; }
    $('rNext').textContent = nextT ? 'つぎの称号: ' + nextT.name + '(' + nextT.how + ')' : '称号を ぜんぶ とったよ!';
    $('rToast').textContent = '';
    G.shareText = 'こっち見ないで!だるま落とし で ' + st.dan + '段 おとしたよ。この段数を こえられる?' + (CHALLENGE ? (st.dan > CHALLENGE ? '(挑戦状 ' + CHALLENGE + '段に かったよ!)' : '') : '');
    G.shareDan = st.dan;
    ['btnAgain', 'btnShare', 'btnToTitle'].forEach(function (id) { $(id).disabled = true; });
    setTimeout(function () { ['btnAgain', 'btnShare', 'btnToTitle'].forEach(function (id) { $(id).disabled = false; }); }, 800);   // 連打の指で うっかり押さないように
    var tl = got.map(function (id) { for (var i = 0; i < D.TITLES.length; i++) if (D.TITLES[i].id === id) return D.TITLES[i]; }).filter(Boolean);
    var showT = news.length ? tl.filter(function (x) { return news.indexOf(x.id) >= 0; }) : tl.slice(-1);
    var up = rankAfter.idx > rankBefore.idx;
    var rankLine = up ? '祝・' + rankAfter.name + '!' : '段位 ' + rankAfter.name + (rankAfter.next ? '(あと' + rankAfter.toNext + '段で ' + rankAfter.next + ')' : '');
    $('rTitle').textContent = news.length ? '称号 ' + showT.map(function (x) { return x.name; }).join('・') + '(NEW)' + (up ? ' / ' + rankLine : '') : rankLine;
    if (false) $('rTitle').textContent = news.length ? '称号: ' + showT.map(function (x) { return x.name; }).join('・') + ' (NEW)' : (nextT ? 'つぎの称号: ' + nextT.name + '(' + nextT.how + ')' : '称号を ぜんぶ とったよ!');
    $('rNext').textContent = '';
    $('rFaces').textContent = '見たかお ' + countSeen() + ' / ' + faceList().length + (newFaces.length ? '   NEW ' + newFaces.length : '');
    $('rGridBox').scrollTop = 0;
    setTimeout(function () { renderGrid($('rGrid'), G.newFaces); }, 30);
    if (isBest) sfx('best');
    AUDIO.bgm('result');
  }

  // ------------------------------------------------------------------ 入力
  var keyMap = { '1': 0, '2': 1, '3': 2 };
  function gameTimeOf(ev) {
    var S = G.S, ts = ev && ev.timeStamp;
    var t = S.t + G.acc;
    if (ts && ts > 1000) t += (ts - G.lastNow) / 1000;
    return Math.max(S.t, Math.min(t, S.t + G.acc + 0.05));
  }
  function playing() { return G.mode === 'play' && !G.paused && G.countdown <= 0; }
  function doTon(ev, pos) {
    var S = G.S, t = gameTimeOf(ev);
    G.tapX = pos || { x: 195, y: 694 };
    handle(D.pressHit(S, t));
  }
  function doChotto(i, ev) {
    var S = G.S, name = D.CHOTTO_KEYS[i], t = gameTimeOf(ev);
    if (!D.canUseChotto(S, name, t)) {
      var k = D.kindAt(S.d, t);
      if (k === 'WATCH' || k === 'GRACE' || k === 'RETURN') floatText(R.chotto[i].x + 60, 524, '今は むり', '#ffffff', 17, 0.9);
      else if (name === 'ijiwaru') floatText(R.chotto[i].x + 60, 524, 'あと ' + Math.ceil(S.teaseReadyAt - t) + 'びょう', '#ffffff', 17, 0.9);
      else floatText(R.chotto[i].x + 60, 524, '玉が たりない', '#ffffff', 17, 0.9);
      sfx('tap'); return;
    }
    var mood0 = S.d.mood, evs = D.useChotto(S, name, t) || [];
    evs.forEach(function (e) {
      if (e.type === 'tickle') { psay('こちょこちょ〜', 1); }
      if (e.type === 'bored') { psay(name === 'dajare' ? e.joke : 'こちょこちょ〜', 1.2); }
      if (e.type === 'dajare') {
        psay(e.joke, 2.2); sfx('joke');

      }
      if (e.type === 'tease') { sfx('angry'); psay('つんつん', 0.9); tip('nakanaori', 'なかなおりは「ほめる」か「お茶」で'); G.shake = 0.2; }
    });
    if (mood0 !== S.d.mood) moodBgm();
  }
  function doHengao(ev) {
    var S = G.S, t = gameTimeOf(ev);
    if (!D.canUseChotto(S, 'hengao', t)) {
      var k = D.kindAt(S.d, t);
      if (k === 'WATCH' && !D.isBlind(S, t)) floatText(HEAD.x, G.headY - 90, t < (S.hengaoReadyAt || 0) ? 'にらめっこは あと' + Math.ceil(S.hengaoReadyAt - t) + '秒' : 'もう つかったよ', '#ffd0f0', 17, 0.9);
      return;
    }
    var evs = D.useChotto(S, 'hengao', t) || [];
    evs.forEach(function (e) {
      psay('べろべろ〜', 0.9);
      if (e.ok) { sfx('laugh'); faceOverride('laugh', 0.6); say('ぶふっ! …ずるい!いまの なし!', 1.4); }
      else if (e.bored) { sfx('flop'); say('その顔 もう 見あきた', 1.4); }
      else { sfx('flop'); say('……ぼくの ほうが 変な顔だもん', 1.6); }
    });
  }
  function doItem(i, ev) {
    var S = G.S, t = gameTimeOf(ev);
    if (!S.slots[i]) return;
    if (!D.canUseItem(S, i, t)) { floatText(336, R.slots[i].y - 6, '今は むり', '#ffffff', 17, 0.9); sfx('tap'); return; }
    var evs = D.useItem(S, i, t) || [];
    evs.forEach(function (e) {
      if (e.type === 'useItem') {
        var it = e.item;
        if (it === 'mekakushi') { sfx('blind'); say('わっ!まっくら!', 1.4, '#e6dcff'); }
        if (it === 'ocha') { sfx('ok'); psay('お茶 どうぞ', 1); }
        if (it === 'odateru') { sfx('shy'); psay('かっこいい〜!', 1.2); faceOverride('shy', 1.4); say('え〜?ぼく まるいだけだよ〜?', 1.8, '#ffe0f0'); }
        if (it === 'komoriuta') { sfx('sleepy'); psay('ねんねん ころり〜♪', 1.5); }
        if (it === 'perfect') sfx('perfect');
        if (it === 'kizuchi') { sfx('gold'); bigMsg('金の木づち!', '#ffd040', 30, 1.2, 2); }
        if (it === 'bai') { sfx('gold'); bigMsg('点数 2倍!', '#ffd040', 30, 1.2, 2); }
        if (it === 'tokei') { sfx('ring'); bigMsg('ピタッ!', '#bfe0ff', 36, 1.0, 2); }
        if (it === 'perfect') { bigMsg('パーフェクト!', '#ff8ac0', 36, 1.4, 3); }
      }
      if (e.type === 'noSleep') say('ねられるか!', 1.4, '#ffd0c8');
    });
    handle(evs.filter(function (e) { return e.type !== 'useItem' && e.type !== 'noSleep'; }));
    moodBgm();
  }
  function onDown(ev) {
    if (ev.button > 0) return;
    if (G.mode === 'howto') { if (ev.target === cv) howtoNext(); return; }
    if (G.mode !== 'play') return;
    var p = toLogical(ev);
    if (inR(R.pause, p.x, p.y)) { pauseGame(); return; }
    if (inR(R.sound, p.x, p.y)) { toggleSound(); return; }
    if (!playing()) return;
    ev.preventDefault();
    if (p.x >= R.ton.x && p.x <= R.ton.x + R.ton.w && p.y >= R.ton.y && p.y <= H + 40) { doTon(ev, p); return; }
    for (var i = 0; i < D.CHOTTO_KEYS.length; i++) if (inR(R.chotto[i], p.x, p.y)) { doChotto(i, ev); return; }
    for (var j = 0; j < 2; j++) if (inR(R.slots[j], p.x, p.y)) { doItem(j, ev); return; }
    // だるまさんの顔: 見ている間は 変顔(にらめっこ)
    var dx = p.x - HEAD.x, dy = p.y - (G.headY || 230);
    if (dx * dx + dy * dy < 88 * 88) {
      var kk = D.kindAt(G.S.d, G.S.t);
      if (kk === 'WATCH' || kk === 'GRACE') { doHengao(ev); return; }
    }
    if (inR(R.tower, p.x, p.y) && G.towerTapHint < 3) { G.towerTapHint++; floatText(195, 600, '下の ボタンで 叩いてね', '#fff3a0', 18, 1.2); }
  }
  cv.addEventListener('pointerdown', onDown);
  addEventListener('keydown', function (ev) {
    if (ev.repeat) return;
    var k = ev.key;
    if (G.mode === 'play') {
      if (k === 'p' || k === 'P' || k === 'Escape') { if (G.paused) resumeGame(); else pauseGame(); ev.preventDefault(); return; }
      if (k === 'm' || k === 'M') { toggleSound(); return; }
      if (!playing()) return;
      if (k === ' ' || k === 'Enter') { ev.preventDefault(); doTon(ev); return; }
      if (keyMap[k] != null) { doChotto(keyMap[k], ev); return; }
      if (k === '4') { doHengao(ev); return; }
      if (k === '5' || k === 'q' || k === 'Q') { doItem(0, ev); return; }
      if (k === '6' || k === 'w' || k === 'W') { doItem(1, ev); return; }
    } else if (G.mode === 'title' && (k === 'Enter' || k === ' ')) { ev.preventDefault(); onPlayButton(); }
    else if (G.mode === 'howto' && (k === 'Enter' || k === ' ')) { ev.preventDefault(); howtoNext(); }
    else if (G.mode === 'result' && (k === 'Enter' || k === ' ')) { ev.preventDefault(); startGame(); }
  });
  // 最初のタップで音を出せるようにする
  addEventListener('pointerdown', function () { try { AUDIO.unlock(); } catch (e) {} }, true);
  addEventListener('keydown', function () { try { AUDIO.unlock(); } catch (e) {} }, true);

  function toggleSound() { AUDIO.setMute(!AUDIO.isMuted()); updateSoundLabels(); }
  function updateSoundLabels() { var t = AUDIO.isMuted() ? '音:オフ' : '音:オン'; ['tSound', 'pSound'].forEach(function (id) { if ($(id)) $(id).textContent = t; }); }
  function bindBtn(id, fn) {
    var el = $(id); if (!el) return;
    el.addEventListener('click', function (ev) { try { AUDIO.unlock(); } catch (e) {} fn(ev); el.blur(); });
  }
  function fullscreen(ev) {
    if (!ev || !ev.isTrusted) return;
    try { var el = document.documentElement, fs = el.requestFullscreen || el.webkitRequestFullscreen; var pr = fs && fs.call(el); if (pr && pr.catch) pr.catch(function () {}); } catch (e) {}
  }
  function onPlayButton(ev) { fullscreen(ev); sfx('ok'); startGame(); }   // はじめての人も 説明を とばして すぐ練習(説明は「あそびかた」から)
  bindBtn('btnPlay', onPlayButton);
  bindBtn('btnHow', function () { sfx('tap'); toHowto(); });
  bindBtn('btnZukan', function () { sfx('tap'); toZukan(); });
  bindBtn('btnZBack', function () { sfx('tap'); show('zukan', false); show('title', true); });
  bindBtn('btnFmClose', function () { show('faceModal', false); });
  bindBtn('tSound', toggleSound);
  bindBtn('pSound', toggleSound);
  bindBtn('btnNext', howtoNext);
  bindBtn('btnSkip', function () { startGame(); });
  // 説明の絵: ボタン以外の どこを押しても 次へ
  $('howto').addEventListener('click', function (ev) { if (ev.target.tagName === 'BUTTON') return; if (toLogical(ev).y < 410 && G.howtoPage < HOWTO.length - 1) howtoNext(); });
  bindBtn('btnResume', resumeGame);
  bindBtn('btnQuit', function () {
    var b = $('btnQuit');
    if (b.dataset.armed === '1') { b.dataset.armed = ''; b.textContent = 'やめる'; toTitle(); return; }
    b.dataset.armed = '1'; b.textContent = 'もう1回 おす';
    setTimeout(function () { b.dataset.armed = ''; b.textContent = 'やめる'; }, 3000);
  });
  bindBtn('btnShare', function () {
    var url = location.origin + location.pathname + (G.shareDan ? '?c=' + G.shareDan : ''), txt = G.shareText || 'こっち見ないで!だるま落とし';   // 挑戦状: 段数だけを アドレスに(名前は 入れない)
    if (navigator.share) { navigator.share({ title: 'こっち見ないで!だるま落とし', text: txt, url: url }).catch(function () {}); return; }
    var done = function () { $('rToast').textContent = 'アドレスを コピーしたよ。LINE に はりつけてね'; };
    try { navigator.clipboard.writeText(txt + ' ' + url).then(done, function () { $('rToast').textContent = url; }); } catch (e) { $('rToast').textContent = url; }
  });
  bindBtn('btnAgain', function () { startGame(); });
  bindBtn('btnToTitle', function () { toTitle(); });
  updateSoundLabels();

  // 画面が隠れたら一時停止
  document.addEventListener('visibilitychange', function () { if (document.hidden) pauseGame(); });
  addEventListener('blur', function () { if (G.mode === 'play' && !document.hasFocus()) pauseGame(); });
  addEventListener('pagehide', pauseGame);

  // ------------------------------------------------------------------ 描画の部品
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function text(str, x, y, size, col, align, weight, stroke, sw) {
    ctx.font = (weight || 800) + ' ' + size + 'px ' + FONT;
    ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
    if (stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = sw || Math.max(3, size * 0.18); ctx.strokeStyle = stroke; ctx.strokeText(str, x, y); }
    ctx.fillStyle = col; ctx.fillText(str, x, y);
  }
  function wrap(str, maxW, size) {
    ctx.font = '800 ' + size + 'px ' + FONT;
    var words = str.split(' '), lines = [], cur = '';
    function fits(x) { return ctx.measureText(x).width <= maxW; }
    for (var i = 0; i < words.length; i++) {
      var w = words[i], cand = cur ? cur + ' ' + w : w;
      if (fits(cand)) { cur = cand; continue; }
      if (cur) { lines.push(cur); cur = ''; }
      if (fits(w)) { cur = w; continue; }
      for (var j = 0; j < w.length; j++) {   // 1語が長いときだけ 字で折る(「?」「!」だけの行は作らない)
        var ch = w[j];
        if (!fits(cur + ch) && cur && !/[?!、。…〜」]/.test(ch)) { lines.push(cur); cur = ch; } else cur += ch;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  }
  function bubbleBox(str, x, y, maxW, size, fill, tailX, tailY, alpha) {
    var lines = wrap(str, maxW - 20, size), lh = size * 1.3;
    ctx.font = '800 ' + size + 'px ' + FONT;
    var w = 0; lines.forEach(function (l) { w = Math.max(w, ctx.measureText(l).width); });
    w += 22; var h = lines.length * lh + 14;
    var bx = Math.max(4, Math.min(W - 4 - w, x - w / 2)), by = y - h / 2;
    ctx.save(); ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.fillStyle = fill; ctx.strokeStyle = '#1b1430'; ctx.lineWidth = 3;
    if (tailX != null) { ctx.beginPath(); ctx.moveTo(Math.max(bx + 14, Math.min(bx + w - 14, tailX)) - 9, by + (tailY > y ? h - 2 : 2)); ctx.lineTo(tailX, tailY); ctx.lineTo(Math.max(bx + 14, Math.min(bx + w - 14, tailX)) + 9, by + (tailY > y ? h - 2 : 2)); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    rr(bx, by, w, h, 14); ctx.fill(); ctx.stroke();
    if (tailX != null) { ctx.beginPath(); ctx.moveTo(Math.max(bx + 14, Math.min(bx + w - 14, tailX)) - 7, by + (tailY > y ? h - 1.5 : 1.5)); ctx.lineTo(Math.max(bx + 14, Math.min(bx + w - 14, tailX)) + 7, by + (tailY > y ? h - 1.5 : 1.5)); ctx.strokeStyle = fill; ctx.lineWidth = 4; ctx.stroke(); }
    for (var i = 0; i < lines.length; i++) text(lines[i], bx + w / 2, by + 7 + lh * (i + 0.5), size, '#1b1430');
    ctx.restore();
  }

  // ------------------------------------------------------------------ だるまさんの見た目(向き・顔・ゆれ)
  function headPose(S, t) {
    var ph = D.phaseAt(S.d, t), k = ph ? ph.k : 'SAFE', blind = D.isBlind(S, t);
    var mood = S.d.mood, art = D.MOODS[mood].art, turn = 0, shake = 0, look = null;
    var p = ph ? (t - ph.s) / Math.max(0.001, ph.e - ph.s) : 0;
    // 予兆: はっきり横顔へ回し始める(0.15秒で 0.35 まで)。合図が 親指の下だけにならないように
    if (k === 'WARN' || k === 'FEINT') { turn = 0.35 * Math.min(1, (t - ph.s) / 0.15); shake = 1; }
    else if (k === 'GRACE') turn = 0.35 + 0.65 * p;
    else if (k === 'WATCH') turn = 1;
    else if (k === 'RETURN') turn = 1 - p;
    else if (k === 'PERFECT') { art = 'laugh'; }
    else if (midWarn(S, t)) { turn = 0.35; }
    else if (S.peek && t >= S.peek.s && t < S.peek.e && k === 'SAFE') {   // チラ見: 肩ごしに ちらっ(赤い字なし・頭だけ少し・かわいい顔)
      var pq = (t - S.peek.s) / (S.peek.e - S.peek.s);
      turn = 0.42 * Math.sin(Math.min(1, pq) * Math.PI); G.peekDir = -1;   // 本物の振り向き(右から)とは 反対の肩から
      if (mood !== 'okori' && mood !== 'gekido' && mood !== 'ijiwaru') art = 'shy';
      if (S.peek.caught) art = 'suspicious';
    }
    if (k === 'FROZEN' && ph.say && /あはは|くすくす/.test(ph.say)) art = 'laugh';
    if (mood === 'gekido' && shake < 0.45) shake = 0.45;   // げきおこ: ぷるぷる ふるえる
    if (G.faceOver && G.at < G.faceOver.until) art = G.faceOver.mood;
    if (blind) art = 'blind';
    var face = (k === 'WATCH' || k === 'RETURN' || k === 'GRACE') && ph && ph.react && ph.face && !blind ? ph.face : (k === 'RETURN' && ph && ph.react ? null : null);
    if (!face && ph && ph.react && (k === 'GRACE' || k === 'RETURN')) { var nx = S.d.ph[S.d.ph.indexOf(ph) + (k === 'GRACE' ? 1 : -1)]; if (nx && nx.face && !blind) face = nx.face; }
    return { turn: turn, shake: shake, mood: art, look: look, k: k, blind: blind, face: face };
  }

  // ------------------------------------------------------------------ 描画(遊んでいる画面)
  function themeFor(mood) { return mood === 'okori' || mood === 'gekido' ? 'yuyake' : mood === 'nemui' ? 'yoru' : 'washitsu'; }
  var SCENE_LOOK = { asa: ['washitsu', 'rgba(255,225,190,0.18)'], hiru: ['washitsu', null], yuyake: ['yuyake', null], yoru: ['yoru', null], goraiko: ['yuyake', 'rgba(255,200,120,0.28)'] };
  function drawScene(dan, mood, h) {
    var sc = D.sceneOf(dan), look = SCENE_LOOK[sc.id];
    safeDraw('drawBackground', [ctx, W, h, G.at, look[0]]);
    if (look[1]) { ctx.save(); ctx.fillStyle = look[1]; ctx.fillRect(0, 0, W, h); ctx.restore(); }
    if (sc.id === 'goraiko') {   // ご来光: 光の すじ
      ctx.save(); var g = ctx.createRadialGradient(330, 150, 10, 330, 150, 260); g.addColorStop(0, 'rgba(255,240,170,0.75)'); g.addColorStop(1, 'rgba(255,200,120,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, h); ctx.restore();
    }
    var mt = mood === 'okori' ? 'rgba(255,60,30,0.14)' : mood === 'gekido' ? 'rgba(150,0,0,0.22)' : mood === 'nemui' ? 'rgba(60,90,200,0.16)' : mood === 'kin' ? 'rgba(255,215,80,0.18)' : null;
    if (mt) { ctx.save(); ctx.fillStyle = mt; ctx.fillRect(0, 0, W, h); ctx.restore(); }
  }

  function drawTowerAndHead(S, t, opt) {
    opt = opt || {};
    var fall = G.fall, bh = C.BLOCK_H;
    // 塔(下から順に。6段ぶん)
    var slots = 0, y = TOWER_BOTTOM + fall * 0;
    var list = [];
    for (var i = 0; i < S.tower.length && slots < C.TOWER_VISIBLE; i++) {
      var b = S.tower[i], n = b.kind === 'double' ? 2 : 1;
      var cy = TOWER_BOTTOM - (slots + n / 2) * bh - (i === 0 ? 0 : fall);
      list.push({ b: b, cy: cy, h: n * bh + 6, i: i });
      slots += n;
    }
    var topY = TOWER_BOTTOM - slots * bh - fall;
    for (var j = 0; j < list.length; j++) {
      var it = list[j], bb = it.b, kind = D.BLOCKS[bb.t].art;
      var o = { t: G.at, flash: bb.flash || 0, seed: bb.id };
      if (kind === 'hard') { o.hp = bb.hp; o.maxHp = bb.maxhp; }
      if (bb.kind === 'hibi') o.crack = bb.hp < bb.maxhp ? 0.8 : 0.1;

      if (opt.collapse) continue;
      safeDraw('drawBlock', [ctx, 195, it.cy, C.BLOCK_W, it.h, kind, o]);
      if (bb.kind === 'slide') drawSlideMarker(bb, it.cy, S.t);
      if (bb.kind === 'ring') drawRing(bb, it.cy, S.t);
      if (bb.kind === 'double') text('×2', 130, it.cy + 2, 18, '#ffffff', 'center', 900, '#1b1430', 4);
      if (bb.t === 'bakudan') drawFuse(it.cy);
      // 段の点数(色ごとに ちがう)
      text(String(D.BLOCKS[bb.t].pts), 284, it.cy + 2, 16, '#ffffff', 'right', 900, '#1b1430', 4);
      if (it.i === 0) drawBottomMark(bb, it.cy, it.h);
    }
    // 頭
    var pose = headPose(S, t);
    var size = HEAD.size, hy = topY - size * headBottom();
    if (opt.headY != null) { hy = opt.headY; size = opt.headSize; }
    if (pose.k === 'PERFECT' || G.mode === 'out') { /* そのまま */ }
    var peeking = S.peek && t >= S.peek.s && t < S.peek.e && pose.k === 'SAFE';
    var hopts = { turn: opt.turn != null ? opt.turn : pose.turn, mood: opt.mood || pose.mood, t: G.at, shake: pose.shake, dir: peeking ? -1 : 1 };
    // ほんとうに ころんだ: 足もとを 中心に 横へ ころん → よいしょ と起き上がる
    var fall = 0, kph = D.phaseAt(S.d, t);
    if (kph && kph.k === 'KOROBI') fall = 1.15 * Math.min(1, (t - kph.s) / 0.25) + Math.sin(G.at * 9) * 0.04;
    else if (kph && kph.getup) { var gq = (t - kph.s) / (kph.e - kph.s); fall = 1.15 * (1 - gq) - Math.sin(gq * Math.PI) * 0.15; }
    var hop = G.hop && G.at - G.hop < 0.3 ? -Math.sin((G.at - G.hop) / 0.3 * Math.PI) * 14 : 0;
    ctx.save();
    if (fall) { var px = HEAD.x, py = hy + size * headBottom(); ctx.translate(px + size * 0.3, py); ctx.rotate(fall); ctx.translate(-px - size * 0.3, -py); hopts.turn = 0; }
    if (hop) ctx.translate(0, hop);
    if (pose.face && !opt.mood) drawFaceById(ctx, HEAD.x, hy, size, pose.face, { turn: hopts.turn, t: G.at, dir: 1 });
    else if (S.d.mood === 'kin' && !pose.blind) drawGoldHead(HEAD.x, hy, size, hopts);
    else safeDraw('drawHead', [ctx, HEAD.x, hy, size, hopts]);
    ctx.restore();
    if (pose.face && G.faceTag && G.at < G.faceTag.until && G.faceTag.name) {   // 反応の顔の名前
      var ty = Math.max(156, hy - 74);
      ctx.save(); ctx.fillStyle = 'rgba(255,240,200,0.96)'; rr(70, ty - 16, 124, 32, 10); ctx.fill(); ctx.strokeStyle = '#c08a20'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
      text(G.faceTag.name + '!', 132, ty + 1, 18, '#7a4a00', 'center', 900);
    }
    G.headY = hy;
    if (G.mode === 'play' && hopts.turn < 0.6 && !pose.blind) drawBackSign(S.d.mood, hy);
    if (pose.k === 'PERFECT') drawButterfly(hy);
    // まもり: うっすら ガラスの板
    if (S.shield > 0 && G.mode === 'play') {
      ctx.save(); ctx.globalAlpha = 0.28 + 0.08 * Math.sin(G.at * 3);
      ctx.fillStyle = '#cdeeff'; rr(HEAD.x - 88, hy - 70, 176, 140, 18); ctx.fill();
      ctx.globalAlpha = 0.6; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(HEAD.x - 60, hy - 50); ctx.lineTo(HEAD.x - 30, hy - 60); ctx.stroke();
      ctx.restore();
    }
    return { headY: hy, topY: topY };
  }
  // ミステリーボックス(?の箱)。open = 0〜1 で ふたが開く
  function drawBox(x, y, sz, open) {
    var h = sz * 0.8;
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = '#8a4fd8'; ctx.strokeStyle = '#1b1430'; ctx.lineWidth = Math.max(2, sz * 0.06);
    rr(-sz / 2, -h / 2 + sz * 0.12, sz, h - sz * 0.12, sz * 0.12); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffd84a'; ctx.fillRect(-sz * 0.08, -h / 2 + sz * 0.12, sz * 0.16, h - sz * 0.12);
    ctx.save(); ctx.translate(-sz * 0.56, -h / 2 + sz * 0.12); ctx.rotate(-open * 1.1);
    ctx.fillStyle = '#a26aee'; rr(0, -sz * 0.2, sz * 1.12, sz * 0.24, sz * 0.08); ctx.fill(); ctx.stroke(); ctx.restore();
    if (open < 0.5) text('?', 0, sz * 0.12, sz * 0.5, '#ffffff', 'center', 900, '#1b1430', Math.max(3, sz * 0.08));
    ctx.restore();
  }
  function drawMystery() {
    var M = G.mystery; if (!M) return;
    var a = G.at - M.t0, end = M.t1 ? G.at - M.t1 : 0;
    if (M.t1 && end > 0.9) { G.mystery = null; return; }
    ctx.save(); ctx.fillStyle = 'rgba(10,6,24,' + (M.t1 ? 0.45 * (1 - end / 0.9) : 0.45) + ')'; ctx.fillRect(-200, -200, W + 400, H + 400); ctx.restore();
    var x = 195, y = 360;
    if (!M.t1) {   // ガタガタ + 顔のルーレット(だんだん ゆっくり)
      var sh = Math.sin(a * 60) * 6 * Math.min(1, a * 2);
      drawBox(x + sh, y + 40, 110, 0);
      var step = Math.floor(Math.pow(a * 14, 0.8)) % 2;
      if (step === 0) text('むてき?', x, y - 70, 30, '#ffd84a', 'center', 900, '#1b1430', 6);
      else safeDraw('drawHead', [ctx, x, y - 70, 90, { turn: 1, mood: 'furious', t: G.at, shadow: false }]);
      text('なにが でるかな…', x, y + 120, 20, '#ffffff', 'center', 900, '#1b1430', 5);
    } else {        // パカッ
      var sc = Math.min(1, end / 0.15);
      drawBox(x, y + 40, 110, 1);
      if (M.result === 'muteki') { text('むてき!', x, y - 60, 48 * (0.6 + 0.4 * sc), '#ffd84a', 'center', 900, '#1b1430', 8); text('5びょう 見られても セーフ', x, y + 120, 18, '#ffffff', 'center', 900, '#1b1430', 5); }
      else { safeDraw('drawHead', [ctx, x, y - 66, 110 * (0.6 + 0.4 * sc), { turn: 1, mood: 'furious', t: G.at, shadow: false }]); text('げきおこ!!', x, y + 112, 30, '#ff3030', 'center', 900, '#ffffff', 6); text('点数3倍・すぐ ふりむく', x, y + 146, 18, '#ffffff', 'center', 900, '#1b1430', 5); }
    }
  }
  // ゴールデンだるま: 顔が 風船のように パンパンに ふくらむ(均等に大きくしない)。inflate 0〜1
  function drawGolden(c, x, y, size, inflate, t, shake) {
    var A = window.DARUMA_ART;
    try { if (A && typeof A.drawGoldenBalloon === 'function') { A.drawGoldenBalloon(c, x, y, size, inflate, { t: t || 0, shake: shake || 0 }); return; } } catch (e) {}
    var r = size / 2, k = inflate, sq = 1 + 0.18 * k;   // 横に ふくらむ
    c.save(); c.translate(x + (shake ? Math.sin((t || 0) * 70) * shake * 4 : 0), y);
    var g = c.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.05);
    g.addColorStop(0, '#fff8c0'); g.addColorStop(0.45, '#ffd23a'); g.addColorStop(1, '#c08000');
    c.fillStyle = g; c.strokeStyle = '#6a4400'; c.lineWidth = Math.max(2, r * 0.04);
    c.beginPath(); c.ellipse(0, 0, r * sq, r * (1.02 - 0.06 * k), 0, 0, 6.283); c.fill(); c.stroke();
    // 顔の窓
    c.fillStyle = 'rgba(255,250,230,0.92)'; c.beginPath(); c.ellipse(0, -r * 0.05, r * (0.55 + 0.2 * k), r * (0.48 + 0.1 * k), 0, 0, 6.283); c.fill();
    // ほっぺ(パンパン)
    c.fillStyle = 'rgba(255,120,120,' + (0.35 + 0.4 * k) + ')';
    c.beginPath(); c.arc(-r * (0.3 + 0.18 * k), r * 0.08, r * (0.12 + 0.2 * k), 0, 6.283); c.arc(r * (0.3 + 0.18 * k), r * 0.08, r * (0.12 + 0.2 * k), 0, 6.283); c.fill();
    // 目(ふくらむと 細く 上へ)と 口(小さな o)
    c.strokeStyle = '#1b1430'; c.lineWidth = Math.max(2, r * 0.05); c.lineCap = 'round';
    var ey = -r * (0.16 + 0.12 * k), ew = r * 0.1;
    if (k < 0.5) { c.fillStyle = '#1b1430'; c.beginPath(); c.arc(-r * 0.2, ey, r * 0.07, 0, 6.283); c.arc(r * 0.2, ey, r * 0.07, 0, 6.283); c.fill(); }
    else { c.beginPath(); c.moveTo(-r * 0.2 - ew, ey); c.lineTo(-r * 0.2 + ew, ey - r * 0.03); c.moveTo(r * 0.2 - ew, ey - r * 0.03); c.lineTo(r * 0.2 + ew, ey); c.stroke(); }
    c.fillStyle = '#7a2010'; c.beginPath(); c.ellipse(0, r * (0.22 - 0.04 * k), r * (0.06 - 0.02 * k), r * (0.08 - 0.03 * k), 0, 0, 6.283); c.fill();
    // ひげ
    c.beginPath(); c.moveTo(-r * 0.05, r * 0.1); c.quadraticCurveTo(-r * 0.2, r * 0.06, -r * 0.3, r * 0.13); c.moveTo(r * 0.05, r * 0.1); c.quadraticCurveTo(r * 0.2, r * 0.06, r * 0.3, r * 0.13); c.stroke();
    // つや
    c.fillStyle = 'rgba(255,255,255,0.6)'; c.beginPath(); c.ellipse(-r * 0.45, -r * 0.55, r * 0.14, r * 0.07, -0.6, 0, 6.283); c.fill();
    c.restore();
  }
  function drawGoldenScene(S) {
    var gd = S.golden;
    if (gd) {
      var v = G.goldenView || (G.goldenView = { inflate: 0 });
      v.inflate += (gd.inflate - v.inflate) * 0.35;
      var appear = Math.min(1, (G.at - (G.goldenT0 || G.at)) / 0.25), sz = (80 + 560 * Math.pow(v.inflate, 1.3)) * (0.4 + 0.6 * appear);
      var cy = 330 - Math.min(40, sz * 0.05);
      drawGolden(ctx, 195, cy, sz, v.inflate, G.at, v.inflate > 0.75 ? (v.inflate - 0.75) * 4 : 0);
      // 残り時間のゲージ(ボタンの上)
      var left = Math.max(0, (gd.e - S.t) / C.GOLDEN_SEC), secs = Math.ceil(gd.e - S.t);
      ctx.save(); ctx.fillStyle = 'rgba(20,12,42,0.9)'; rr(16, 598, 358, 24, 10); ctx.fill();
      ctx.fillStyle = left < 0.3 ? '#ff6a4a' : '#8fd0ff'; rr(19, 601, Math.max(10, 352 * left), 18, 8); ctx.fill(); ctx.restore();
      text('のこり ' + secs + 'びょう', 195, 610, 17, '#ffffff', 'center', 900, '#1b1430', 4);
      // ふくらみメーター(満タンで 弾ける)
      ctx.save(); ctx.fillStyle = 'rgba(20,12,42,0.85)'; rr(10, 150, 30, 300, 12); ctx.fill();
      var mh = 292 * v.inflate; ctx.fillStyle = v.inflate > 0.8 ? '#ff7a3a' : '#ffd84a'; rr(14, 446 - mh, 22, Math.max(4, mh), 9); ctx.fill(); ctx.restore();
      text('ふくらみ', 25, 466, 16, '#ffe066', 'center', 900, '#1b1430', 4);
      text('パン!', 25, 138, 16, '#ffffff', 'center', 900, '#1b1430', 4);
    }
    if (G.pop) {   // くす玉が 割れるように ドーン!
      var k = (G.at - G.pop.t0) / 0.9, A = window.DARUMA_ART;
      if (k >= 1) G.pop = null;
      else {
        var done = false;
        try { if (A && typeof A.drawGoldenPop === 'function') { A.drawGoldenPop(ctx, 195, 330, 640, k, { t: G.at, text: 'ドーン!', area: { x: 4, y: 58, w: W - 8, h: 540 } }); done = true; } } catch (e) {}
        if (!done) {
          ctx.save();
          var rg = ctx.createRadialGradient(195, 330, 10, 195, 330, 420 * (0.3 + k)); rg.addColorStop(0, 'rgba(255,250,200,' + (1 - k) + ')'); rg.addColorStop(1, 'rgba(255,200,60,0)');
          ctx.fillStyle = rg; ctx.fillRect(-200, -200, W + 400, H + 400);
          for (var hf = -1; hf <= 1; hf += 2) {   // くす玉の 半分ずつ
            ctx.save(); ctx.translate(195 + hf * 30 * k, 330 + 260 * k * k); ctx.rotate(hf * 1.2 * k);
            ctx.fillStyle = '#ffcc30'; ctx.strokeStyle = '#6a4400'; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.arc(0, 0, 110, hf < 0 ? Math.PI / 2 : -Math.PI / 2, hf < 0 ? Math.PI * 1.5 : Math.PI / 2); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
          }
          for (var i = 0; i < 24; i++) { var a = i * 0.7, d = 60 + 380 * k; ctx.fillStyle = ['#ff4a6a', '#4ac8ff', '#7ae05a', '#ff9ad0', '#ffffff', '#ffd84a'][i % 6]; ctx.fillRect(195 + Math.cos(a) * d, 330 + Math.sin(a) * d + 120 * k * k, 10, 6); }
          ctx.restore();
          text('ドーン!', 195, 300, 70 * (0.6 + 0.6 * Math.min(1, k * 3)), '#ff3a50', 'center', 900, '#ffffff', 10);
        }
      }
    }
    if (G.flop) {   // ぷしゅ〜 と しぼんで 飛んでいく
      var q = (G.at - G.flop.t0) / 1.2;
      if (q >= 1) G.flop = null;
      else { var fs = (80 + 560 * Math.pow(G.flop.inflate, 1.3)) * (1 - q * 0.8); drawGolden(ctx, 195 + q * 260 + Math.sin(q * 30) * 20, 330 - q * 380, Math.max(30, fs), Math.max(0, G.flop.inflate * (1 - q)), G.at, 0.5); }
    }
  }
  var goldCv = null;
  function drawGoldHead(x, y, size, hopts) {
    var sc = Math.max(1, VIEW.s * VIEW.dpr), pad = size * 0.9, w = Math.ceil(pad * 2 * sc);
    if (!goldCv) goldCv = document.createElement('canvas');
    if (goldCv.width !== w) { goldCv.width = w; goldCv.height = w; }
    var c = goldCv.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, w, w); c.setTransform(sc, 0, 0, sc, 0, 0);
    try { art('drawHead')(c, pad, pad, size, hopts); } catch (e) { FB.drawHead(c, pad, pad, size, hopts); }
    c.globalCompositeOperation = 'source-atop';
    var g = c.createLinearGradient(0, 0, pad * 2, pad * 2); g.addColorStop(0, 'rgba(255,245,170,0.62)'); g.addColorStop(0.5, 'rgba(240,190,40,0.62)'); g.addColorStop(1, 'rgba(190,130,10,0.62)');
    c.fillStyle = g; c.fillRect(0, 0, pad * 2, pad * 2); c.globalCompositeOperation = 'source-over';
    ctx.drawImage(goldCv, x - pad, y - pad, pad * 2, pad * 2);
    for (var i = 0; i < 4; i++) { var a = G.at * 1.3 + i * 1.57; text('✦', x + Math.cos(a) * size * 0.62, y - size * 0.1 + Math.sin(a) * size * 0.5, 16, '#fff6b0', 'center', 900); }
  }
  function drawFuse(cy) {
    ctx.save();
    ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(98, cy - 4); ctx.quadraticCurveTo(84, cy - 8, 82, cy - 20); ctx.stroke();
    var f = 0.6 + 0.4 * Math.sin(G.at * 23), x = 82, y = cy - 22;
    ctx.fillStyle = 'rgba(255,170,40,0.9)'; ctx.beginPath(); ctx.arc(x, y, 7 * f, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#fff6a0'; ctx.beginPath(); ctx.arc(x, y, 3.5 * f, 0, 6.283); ctx.fill();
    ctx.strokeStyle = '#ffd040'; ctx.lineWidth = 2;
    for (var i = 0; i < 4; i++) { var a = G.at * 9 + i * 1.57; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 6, y + Math.sin(a) * 6); ctx.lineTo(x + Math.cos(a) * 11, y + Math.sin(a) * 11); ctx.stroke(); }
    ctx.restore();
  }
  function dangerNow(S, t) { var k = D.kindAt(S.d, t); return (k === 'WARN' || k === 'FEINT' || k === 'GRACE' || k === 'WATCH') && !D.isBlind(S, t); }
  function drawSlideMarker(b, cy, t) {
    var S = G.S, si = D.slideInfo(b, t), danger = dangerNow(S, t), ok = !danger && si.dist <= C.SLIDE_WINDOW;
    ctx.save();
    ctx.fillStyle = danger ? 'rgba(120,120,120,0.4)' : ok ? 'rgba(80,255,120,0.6)' : 'rgba(255,255,255,0.45)';
    ctx.fillRect(195 - 14, cy - 13, 28, 26);
    var x = 195 + si.x * 78;
    ctx.fillStyle = danger ? '#9a9a9a' : ok ? '#40ff70' : '#ffffff'; ctx.strokeStyle = '#1b1430'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(x, cy - 12); ctx.lineTo(x + 11, cy + 9); ctx.lineTo(x - 11, cy + 9); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  // まと: まんなかの的と、ちぢむ輪(見られている間は灰色で「いま!」は出さない)
  function drawRing(b, cy, t) {
    var S = G.S, ri = D.ringInfo(b, t), danger = dangerNow(S, t), ok = !danger && ri.dist <= D.ringWindow(S);
    ctx.save();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(195, cy + 1, 11, 0, 6.283); ctx.fill();
    ctx.fillStyle = danger ? '#888' : '#e02a2a'; ctx.beginPath(); ctx.arc(195, cy + 1, 6, 0, 6.283); ctx.fill();
    ctx.strokeStyle = danger ? 'rgba(150,150,150,0.8)' : ok ? '#40ff70' : '#ffffff'; ctx.lineWidth = ok ? 5 : 3;
    ctx.beginPath(); ctx.arc(195, cy + 1, Math.max(4, 11 * ri.size), 0, 6.283); ctx.stroke();
    ctx.restore();
  }
  function drawBottomMark(b, cy, h) {
    var S = G.S, k = D.kindAt(S.d, S.t), warn = (k === 'WARN' || k === 'FEINT') && !D.isBlind(S, S.t);
    ctx.save();
    if (warn) {   // 予兆の間は 一番下の段も赤く(ゆっくり脈打つ)
      ctx.globalAlpha = 0.25 + 0.15 * Math.sin(G.at * Math.PI * 2 * PULSE);
      ctx.fillStyle = '#ff2020'; rr(95, cy - h / 2, 200, h, 8); ctx.fill(); ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = warn ? '#ff3030' : 'rgba(255,255,255,0.95)'; ctx.lineWidth = warn ? 4 : 3;
    rr(92, cy - h / 2 - 2, 206, h + 4, 8); ctx.stroke();
    ctx.restore();
    if (b.kind === 'mash' || b.kind === 'mochi' || b.kind === 'double' || b.kind === 'hibi') text('あと' + b.hp + '回', 140, cy + 1, 16, '#ffffff', 'center', 900, '#1b1430', 4);
    if ((b.kind === 'ring' && D.ringInfo(b, S.t).dist <= D.ringWindow(S)) || (b.kind === 'slide' && D.slideInfo(b, S.t).dist <= C.SLIDE_WINDOW)) {
      if (!dangerNow(S, S.t) && D.kindAt(S.d, S.t) !== 'PERFECT') text('いま!', 138, cy - 1, 17, '#40ff70', 'center', 900, '#1b1430', 4);
    }
  }
  // 後ろ姿でも 気分が分かる しるし
  function heart(x, y, sz, col) {
    ctx.save(); ctx.translate(x, y); ctx.scale(sz / 20, sz / 20); ctx.fillStyle = col; ctx.strokeStyle = '#1b1430'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 7); ctx.bezierCurveTo(-12, -2, -8, -12, 0, -5); ctx.bezierCurveTo(8, -12, 12, -2, 0, 7); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  }
  function drawBackSign(mood, hy) {
    var a = G.at, x = HEAD.x, top = hy - 80, i, u;
    ctx.save();
    switch (mood) {
      case 'futsu': text('ふんふん', x + 92, top + 22 + Math.sin(a * 2) * 3, 16, '#ffffff', 'center', 800, '#1b1430', 4); break;
      case 'gokigen':
        for (i = 0; i < 2; i++) { u = (a * 0.6 + i * 0.5) % 1; ctx.globalAlpha = 1 - u; text('♪', x + (i ? 88 : -88) + Math.sin(a * 3 + i) * 6, top + 50 - u * 40, 30, '#ff7fb0', 'center', 900, '#ffffff', 4); }
        break;
      case 'okori':
        for (i = 0; i < 3; i++) { u = (a * 0.9 + i / 3) % 1; ctx.globalAlpha = 0.85 * (1 - u); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x + (i - 1) * 30, top + 10 - u * 36, 8 + u * 10, 0, 6.283); ctx.fill(); }
        ctx.globalAlpha = 1; text('ムカムカ', x + 92, top + 26, 18, '#ff3a2a', 'center', 900, '#ffffff', 4); break;
      case 'ijiwaru': text('ひひひ', x + 90 + Math.sin(a * 6) * 4, top + 24, 20, '#a060ff', 'center', 900, '#ffffff', 4); break;
      case 'nemui': u = (a * 0.5) % 1; ctx.globalAlpha = 1 - u * 0.6; text('Zzz', x + 84 + u * 10, top + 34 - u * 26, 24 + u * 6, '#7fb0ff', 'center', 900, '#ffffff', 4); break;
      case 'nakisou':
        for (i = 0; i < 2; i++) { u = (a * 0.8 + i * 0.5) % 1; ctx.globalAlpha = 1 - u; ctx.fillStyle = '#7fd6ff'; ctx.beginPath(); ctx.ellipse(x + (i ? 78 : -78), top + 60 + u * 40, 5, 8, 0, 0, 6.283); ctx.fill(); }
        ctx.globalAlpha = 1; text('ぐすん', x + 92, top + 22, 17, '#7fd6ff', 'center', 900, '#1b1430', 4); break;
      case 'tere': for (i = 0; i < 2; i++) { u = (a * 0.5 + i * 0.5) % 1; ctx.globalAlpha = 1 - u; heart(x + (i ? 86 : -86), top + 50 - u * 40, 24, '#ff6f9f'); } break;
      case 'kin': text('キラキラ', x + 92, top + 24 + Math.sin(a * 3) * 3, 18, '#ffe066', 'center', 900, '#7a5000', 4); break;
      case 'gekido':
        for (i = 0; i < 5; i++) { u = (a * 1.6 + i / 5) % 1; ctx.globalAlpha = 0.9 * (1 - u); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x + (i - 2) * 26, top + 12 - u * 44, 9 + u * 12, 0, 6.283); ctx.fill(); }
        ctx.globalAlpha = 1; text('ゴゴゴ', x + 92 + Math.sin(a * 30) * 2, top + 26, 20, '#ff1a1a', 'center', 900, '#1b0000', 5); break;
      case 'bikkuri': text('!!', x + 86, top + 26 - Math.abs(Math.sin(a * 8)) * 8, 32, '#ffe066', 'center', 900, '#1b1430', 5); break;
    }
    ctx.restore();
  }
  // パーフェクト: ちょうちょ を見て うっとり
  function drawButterfly(hy) {
    var a = G.at, x = HEAD.x + 100 + Math.sin(a * 1.3) * 26, y = hy - 70 + Math.sin(a * 2.1) * 14, f = 0.3 + 0.7 * Math.abs(Math.sin(a * 14));
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = '#ffb3e6'; ctx.strokeStyle = '#1b1430'; ctx.lineWidth = 2;
    for (var sd = -1; sd <= 1; sd += 2) {
      ctx.beginPath(); ctx.ellipse(sd * 9 * f, -4, 10 * f, 9, 0, 0, 6.283); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(sd * 7 * f, 7, 7 * f, 6, 0, 0, 6.283); ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = '#1b1430'; ctx.fillRect(-1.5, -10, 3, 20);
    ctx.restore();
  }
  function drawHammer() {
    var S = G.S, sw = G.swing;
    var a = 0.12 - (sw > 0 ? Math.sin(Math.min(1, (1 - sw) * 2.2) * Math.PI) * 0.42 : 0);   // 左右反転の中: + で ふりかぶる
    var gold = S && (S.malletHits > 0 || D.kindAt(S.d, S.t) === 'PERFECT');
    ctx.save(); ctx.translate(60, 566); ctx.scale(-1, 1);
    safeDraw('drawHammer', [ctx, 0, 0, a, gold ? 'gold' : 'normal', 92]);
    ctx.restore();
  }
  function drawChant(S, t) {
    var ph = D.phaseAt(S.d, t), k = ph ? ph.k : 'SAFE', blind = D.isBlind(S, t);
    ctx.save();
    ctx.fillStyle = 'rgba(255,250,236,0.92)'; rr(18, 95, 354, 44, 12); ctx.fill();
    ctx.strokeStyle = 'rgba(27,20,48,0.5)'; ctx.lineWidth = 2; ctx.stroke();
    if (k === 'PERFECT') {
      var hue = (G.at * 200) % 360;
      text('うっとり〜♪ いまのうちに 落としまくれ!', 195, 117, 17, 'hsl(' + hue + ',90%,45%)', 'center', 900);
      ctx.restore(); return;
    }
    if (k === 'STOP') { text('時間が とまってる… いまのうち!', 195, 117, 19, '#3a6ab8', 'center', 900); ctx.restore(); return; }
    if (k === 'KOROBI') { text('ころん… ほんとに ころんだ!', 195, 117, 22, '#2a8a20', 'center', 900); ctx.restore(); return; }
    var CH = ph && ph.alt ? C.CHANT_BOUSAN : C.CHANT;
    var said = D.chantIndex(S.d, t);
    if (said === 0 && (k === 'FROZEN' || k === 'PAUSE')) said = G.lastSaid || 0;
    else G.lastSaid = said;
    if (ph && ph.dbl) said = 0;
    for (var i = 0; i < 10; i++) {
      var x = 25 + 34 * i + 17, red = i >= 6, done = i < said;
      var at = G.chantAt[i], pop = done && at != null ? Math.max(0, 1 - (G.at - at) / 0.18) : 0;
      var size = (red ? 30 : 26) * (1 + 0.45 * pop);
      var col = done ? (red ? (blind ? '#8a5ad8' : '#e02020') : '#1b1430') : 'rgba(27,20,48,0.22)';
      text(CH[i], x, 117, size, col, 'center', 900);
    }
    if (ph && ph.react && (k === 'WARN' || k === 'GRACE' || k === 'WATCH')) text('!?', 195, 117, 34, blind ? '#8a5ad8' : '#e02020', 'center', 900, '#fffaf0', 6);
    if (ph && ph.dbl) text('…だっ!', 195, 117, 34, blind ? '#8a5ad8' : '#e02020', 'center', 900, '#fffaf0', 6);
    ctx.restore();
  }
  function moodLabel(S) {
    var m = D.MOODS[S.d.mood], s = 'きぶん:' + m.name;
    if (m.mult > 1) s += ' ×' + m.mult;
    return s;
  }
  function drawHud(S) {
    ctx.save();
    var g = ctx.createLinearGradient(0, 0, 0, 94); g.addColorStop(0, 'rgba(20,12,42,0.94)'); g.addColorStop(1, 'rgba(20,12,42,0.6)');
    ctx.fillStyle = g; ctx.fillRect(-200, -200, W + 400, 294);
    // ポーズ
    ctx.fillStyle = 'rgba(255,255,255,0.14)'; rr(R.pause.x, R.pause.y, 44, 44, 12); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(22, 15, 6, 22); ctx.fillRect(32, 15, 6, 22);
    // 音
    ctx.fillStyle = 'rgba(255,255,255,0.14)'; rr(R.sound.x, R.sound.y, 44, 44, 12); ctx.fill();
    drawSpeaker(360, 26, AUDIO.isMuted());
    // ちょっかい玉
    text('玉', 70, 26, 16, 'rgba(255,255,255,0.9)', 'center', 900);
    for (var i = 0; i < C.TAMA_MAX; i++) {
      ctx.beginPath(); ctx.arc(90 + i * 17, 26, 7, 0, 6.283);
      ctx.fillStyle = i < S.tama ? '#ffe066' : 'rgba(255,255,255,0.15)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    // 点数(と その下に ベスト)
    var bump = G.scoreBump; G.scoreBump = Math.max(0, bump - 0.08);
    var dbl = S.doubleUntil > S.t;
    text(fmt(S.score), 222, 21, 30 * (1 + bump * 0.12), dbl ? '#ffd040' : '#ffffff', 'center', 900, '#1b1430', 5);
    var gl2 = goalNow(S);
    if (gl2 && gl2.base > 0 && !gl2.passed) text(gl2.label + 'まで あと' + gl2.left + '段', 222, 45, 16, gl2.key === 'c' ? '#ffb0c0' : '#a8d8ff', 'center', 900);
    else text(S.tutorial ? 'れんしゅう' : 'ベスト ' + fmt(G.rec.best), 222, 45, 16, S.tutorial ? '#ffe066' : 'rgba(255,255,255,0.85)', 'center', 800);
    // 気分(顔の絵+名前)
    var m = D.MOODS[S.d.mood];
    ctx.fillStyle = m.color; ctx.beginPath(); ctx.arc(28, 72, 19, 0, 6.283); ctx.fill();
    safeDraw('drawHead', [ctx, 28, 72, 34, { turn: 1, mood: D.isBlind(S, S.t) ? 'blind' : m.art, t: G.at, shadow: false }]);
    text(m.name + (m.mult > 1 ? ' ×' + m.mult : ''), 54, 73, 21, '#ffffff', 'left', 900, '#1b1430', 4);
    // 段数
    text(S.dropped + '段', 380, 73, 23, '#ffe066', 'right', 900, '#1b1430', 4);
    ctx.restore();
  }
  // 左の列: 予兆の大きい「ころんだ」/ この向こう向きで落とした数・コンボ / 効いているもの
  function drawLeftColumn(S, t) {
    var ph = D.phaseAt(S.d, t), k = ph ? ph.k : 'SAFE', blind = D.isBlind(S, t);
    if ((k === 'WARN' || k === 'FEINT' || k === 'GRACE' || k === 'WATCH') && !(ph && ph.dbl) && !(ph && ph.react)) {
      var said = D.chantIndex(S.d, t), col = blind ? '#9a6af0' : '#ff2a2a';
      for (var i = 6; i < 10; i++) {
        if (said <= i) break;
        var at = G.chantAt[i], pop = at != null ? Math.max(0, 1 - (G.at - at) / 0.2) : 0;
        text((ph && ph.alt ? C.CHANT_BOUSAN : C.CHANT)[i], 46, 192 + (i - 6) * 46, 44 * (1 + 0.5 * pop), col, 'center', 900, '#ffffff', 7);
      }
    } else if (ph && ph.react && (k === 'WARN' || k === 'GRACE')) {
      text('!?', 46, 230, 48, blind ? '#9a6af0' : '#ff2a2a', 'center', 900, '#ffffff', 7);
    } else if (ph && ph.dbl) {
      text('だっ!', 46, 230, 40, blind ? '#9a6af0' : '#ff2a2a', 'center', 900, '#ffffff', 7);
    } else if (G.safeShow && G.at < G.safeShow.until && !(ph && ph.react)) {
      text(G.safeShow.n + 'こ', 46, 220, 30, '#9be15d', 'center', 900, '#1b1430', 6);
      text('セーフ!', 46, 254, 20, '#9be15d', 'center', 900, '#1b1430', 5);
    } else if (S.windowDrops > 0 && !(ph && ph.react)) {
      text('この回', 46, 200, 16, '#ffffff', 'center', 900, '#1b1430', 4);
      text(S.windowDrops + 'こ', 46, 232, 32, '#9be15d', 'center', 900, '#1b1430', 6);
      if (S.combo >= 2) {
        var cp = G.comboPop != null ? Math.max(0, 1 - (G.at - G.comboPop) / 0.4) : 0;
        text(S.combo + 'コンボ', 46, 272, 18 * (1 + 0.5 * cp), '#ffe066', 'center', 900, '#1b1430', 4);
        text('×' + D.comboMul(S.combo).toFixed(1), 46, 294, 18, '#ffe066', 'center', 900, '#1b1430', 4);
      }
    }
    if (G.at < G.comboEnd) text('コンボ おしまい', 195, 150, 16, '#dddddd', 'center', 800, '#1b1430', 4);
  }
  // 目標の旗: 挑戦状 か 自分の最高段数
  function goalNow(S) {
    if (S.tutorial) return null;
    if (CHALLENGE && !G.goalPassed.c) return { key: 'c', base: CHALLENGE, left: CHALLENGE - S.dropped + 1, passed: S.dropped > CHALLENGE, label: '挑戦状' };
    var b = G.goalBestDan || 0;
    return { key: 'b', base: b, left: b - S.dropped + 1, passed: S.dropped > b, label: '最高' };
  }
  function drawGoal(S) {
    var gl = goalNow(S); if (!gl || gl.base <= 0 || gl.passed) return;
    ctx.save(); ctx.fillStyle = gl.key === 'c' ? 'rgba(200,40,60,0.9)' : 'rgba(30,90,180,0.88)'; rr(304, 290, 80, 52, 10); ctx.fill(); ctx.restore();
    text(gl.label + 'まで', 344, 304, 16, '#ffffff', 'center', 900);
    text('あと' + gl.left + '段', 344, 327, 17, '#ffe066', 'center', 900);
  }
  function drawSpeaker(x, y, off) {
    ctx.save(); ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(x - 12, y - 5); ctx.lineTo(x - 6, y - 5); ctx.lineTo(x + 2, y - 12); ctx.lineTo(x + 2, y + 12); ctx.lineTo(x - 6, y + 5); ctx.lineTo(x - 12, y + 5); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    if (off) { ctx.strokeStyle = '#ff6b6b'; ctx.beginPath(); ctx.moveTo(x - 14, y - 13); ctx.lineTo(x + 14, y + 13); ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(x + 4, y, 6, -0.9, 0.9); ctx.stroke(); ctx.beginPath(); ctx.arc(x + 4, y, 11, -0.9, 0.9); ctx.stroke(); }
    ctx.restore();
  }
  function drawStatus(S) {
    var y = 364, items = [];
    if (D.isBlind(S, S.t)) items.push(['目かくし', S.blindUntil > S.t + 99 ? '' : Math.ceil(S.blindUntil - S.t) + '', '#6a7ff0']);
    if (S.doubleUntil > S.t) items.push(['2倍', Math.ceil(S.doubleUntil - S.t) + '', '#d88a10']);
    if (S.malletHits > 0) items.push(['金づち', S.malletHits + '', '#c89010']);
    if (S.shield > 0) items.push(['まもり', '', '#3aa0c8']);
    if (S.mutekiUntil > S.t) items.push(['むてき', S.mutekiUntil > S.t + 99 ? '' : Math.ceil(S.mutekiUntil - S.t) + '', '#d8a010']);
    if (S.d.mood === 'gekido') items.push(['×3', '', '#c01010']);
    if (S.d.mood === 'kin') items.push(['金 ×3', '', '#c89010']);
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      ctx.save(); ctx.fillStyle = it[2]; ctx.globalAlpha = 0.95; rr(3, y, 88, 28, 14); ctx.fill(); ctx.restore();
      text(it[0] + it[1], 47, y + 14, 16, '#fff', 'center', 900);
      y += 32;
    }
    // 目かくしが外れそう
    if (D.isBlind(S, S.t) && S.blindUntil - S.t < C.BLINDFOLD_WARN && S.blindUntil - S.t > 0) {
      text('目かくし ずれてきた!', 195, 150, 17, '#ffe066', 'center', 900, '#1b1430', 4);
    }
  }
  function drawSlots(S, t) {
    for (var i = 0; i < 2; i++) {
      var r = R.slots[i], it = S.slots[i];
      ctx.save();
      if (!it) {
        ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.setLineDash([5, 4]); ctx.lineWidth = 2; rr(r.x, r.y, r.w, r.h, 12); ctx.stroke();
        ctx.setLineDash([]); ctx.fillStyle = 'rgba(20,12,42,0.3)'; ctx.fill();
        text('アイテム', r.x + r.w / 2, r.y + r.h / 2, 16, 'rgba(255,255,255,0.8)', 'center', 800);
      } else {
        var info = D.ITEMS[it], can = D.canUseItem(S, i, t), cx = r.x + r.w / 2;
        ctx.globalAlpha = can ? 1 : 0.5;
        ctx.fillStyle = 'rgba(255,250,236,0.97)'; rr(r.x, r.y, r.w, r.h, 12); ctx.fill();
        ctx.strokeStyle = can ? '#ffcc00' : '#888'; ctx.lineWidth = can ? 4 : 3; ctx.stroke();
        if (info.art) safeDraw('drawItem', [ctx, cx, r.y + 27, 40, info.art === 'perfect' ? 'perfect' : info.art, G.at]);
        else if (it === 'mystery') drawBox(cx, r.y + 28, 36, 0);
        else {
          ctx.fillStyle = it === 'perfect' ? 'hsl(' + (40 + Math.sin(G.at * 3) * 30 + 300) % 360 + ',85%,62%)' : info.color;
          ctx.beginPath(); ctx.arc(cx, r.y + 27, 20, 0, 6.283); ctx.fill();
          ctx.strokeStyle = '#1b1430'; ctx.lineWidth = 2; ctx.stroke();
          text(info.mark, cx, r.y + 28, 21, '#fff', 'center', 900, '#1b1430', 3);
        }
        text(info.short, cx, r.y + 60, 16, '#1b1430', 'center', 900);
      }
      ctx.restore();
    }
  }
  function chottoReason(S, name, t) {
    var k = D.kindAt(S.d, t);
    if (k === 'WATCH' || k === 'GRACE' || k === 'RETURN') return 'いまは だめ';
    if (k === 'FROZEN' || k === 'STOP' || k === 'PERFECT') return 'まってね';
    if (name === 'ijiwaru' && t < S.teaseReadyAt) return 'あと' + Math.ceil(S.teaseReadyAt - t) + '秒';
    if (S.tama < D.CHOTTO[name].cost) return '玉が たりない';
    return null;
  }
  function drawChotto(S, t) {
    for (var i = 0; i < D.CHOTTO_KEYS.length; i++) {
      var r = R.chotto[i], name = D.CHOTTO_KEYS[i], info = D.CHOTTO[name], can = D.canUseChotto(S, name, t);
      ctx.save();
      ctx.globalAlpha = can ? 1 : 0.55;
      ctx.fillStyle = '#fff6e0'; rr(r.x, r.y, r.w, r.h, 14); ctx.fill();
      ctx.strokeStyle = '#1b1430'; ctx.lineWidth = 3; ctx.stroke();
      if (info.art) safeDraw('drawItem', [ctx, r.x + 16, r.y + 18, 24, info.art, G.at]);
      text(info.name, r.x + 72, r.y + 20, 19, '#1b1430', 'center', 900);
      var sub = can ? (info.cost ? '玉 ' + info.cost + 'こ' : 'タダ') : (chottoReason(S, name, t) || '');
      text(sub, r.x + 62, r.y + 45, 16, can ? '#1b1430' : '#6a2020', 'center', 800);
      ctx.restore();
    }
  }
  // 予兆の途中で止まっている(くすぐり・時間止め など)か: 前も後ろも予兆
  function midWarn(S, t) {
    var ph = S.d.ph, i;
    for (i = ph.length - 1; i >= 0; i--) if (ph[i].s <= t) break;
    if (i < 1 || i >= ph.length - 1) return false;
    var k = ph[i].k;
    return (k === 'FROZEN' || k === 'STOP' || k === 'PAUSE') && ph[i - 1].k === 'WARN' && ph[i + 1].k === 'WARN';
  }
  function tonState(S, t) {
    if (G.countdown > 0) return 'wait';
    var k = D.kindAt(S.d, t), blind = D.isBlind(S, t);
    if (midWarn(S, t)) return blind ? 'blind' : 'warn';
    if (k === 'PERFECT') return 'perfect';
    if (k === 'KOROBI') return 'korobi';
    if (S.golden) return 'golden';
    if (D.isDanger(k) || k === 'FEINT') {
      if (blind) return 'blind';
      if (t < S.mutekiUntil) return 'muteki';
      if (k === 'WARN' || k === 'FEINT') return 'warn';
      return 'watch';
    }
    return 'ok';
  }
  var PULSE = 1.2;   // 脈打つ速さ(1秒に1.2回。点滅は しない: 光に弱い人のため 1秒3回未満)
  function drawTon(S, t) {
    var r = R.ton, st = tonState(S, t), fill, label, col = '#1b1430', border = '#1b1430', bw = 4, grow = 0;
    var pulse = 0.5 + 0.5 * Math.sin(G.at * Math.PI * 2 * PULSE);
    if (st === 'ok') { fill = '#9be15d'; label = 'トン!'; }
    else if (st === 'warn') { fill = '#ffd23f'; label = 'とめて!'; border = '#e01010'; bw = 9 + pulse * 3; grow = pulse * 4; }
    else if (st === 'watch') { fill = '#e5221b'; label = 'さわらないで!'; col = '#ffffff'; border = '#7a0000'; bw = 6; }
    else if (st === 'blind') { fill = '#c9b6f2'; label = '見えてないよ'; }
    else if (st === 'muteki') { fill = '#ffd84a'; label = 'むてき!'; border = '#a06000'; bw = 6; }
    else if (st === 'golden') { var gg2 = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h); gg2.addColorStop(0, '#fff2a0'); gg2.addColorStop(1, '#e8a810'); fill = gg2; label = 'ふくらませろ!'; border = '#8a5a00'; bw = 6; grow = pulse * 3; }
    else if (st === 'korobi') { fill = '#b8f070'; label = 'いまだ!連打!'; grow = pulse * 3; }
    else if (st === 'wait') { fill = '#9a94a8'; label = 'まってね'; }
    else {   // パーフェクト: 桃と金(赤には しない)
      var gg = ctx.createLinearGradient(r.x, 0, r.x + r.w, 0), sh = (G.at * 0.6) % 1;
      gg.addColorStop(0, '#ff9ad0'); gg.addColorStop(sh, '#ffe36a'); gg.addColorStop(1, '#ff9ad0');
      fill = gg; label = '連打!連打!';
    }
    var press = G.swing > 0.6 ? 3 : 0;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; rr(r.x, r.y + 6, r.w, r.h, 26); ctx.fill();
    ctx.fillStyle = fill; rr(r.x - grow, r.y + press - grow, r.w + grow * 2, r.h + grow * 2, 26); ctx.fill();
    ctx.lineWidth = bw; ctx.strokeStyle = border; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; rr(r.x + 10, r.y + press + 8, r.w - 20, 30, 16); ctx.fill();
    if (st === 'watch') { drawEye(r.x + 34, r.y + r.h / 2 + press, 16); drawEye(r.x + r.w - 34, r.y + r.h / 2 + press, 16); }
    text(label, r.x + r.w / 2, r.y + r.h / 2 + press + 2, label.length > 5 ? 34 : label.length > 4 ? 38 : 46, col, 'center', 900, st === 'watch' ? '#7a0000' : null, 4);
    ctx.restore();
  }
  function drawEye(x, y, s) {
    ctx.save(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x, y, s, s * 0.6, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#1b1430'; ctx.beginPath(); ctx.arc(x, y, s * 0.35, 0, 6.283); ctx.fill(); ctx.restore();
  }
  function drawVignette(S, t) {
    var st = tonState(S, t), a = 0, col = '255,30,30';
    var pulse = 0.5 + 0.5 * Math.sin(G.at * Math.PI * 2 * PULSE);
    if (st === 'warn') a = 0.5 + 0.12 * pulse;
    else if (st === 'watch') a = 0.62;
    else if (st === 'blind') { a = 0.28; col = '150,110,230'; }
    else if (st === 'muteki') { a = 0.3; col = '255,210,60'; }
    else if (S.d.mood === 'gekido') { a = 0.32 + 0.14 * pulse; col = '120,0,0'; }   // げきおこ: 赤黒く 脈打つ
    else if (D.kindAt(S.d, t) === 'STOP') { a = 0.3; col = '150,200,255'; }
    if (a <= 0) return;
    ctx.save();
    var g = ctx.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.7);
    g.addColorStop(0, 'rgba(' + col + ',0)'); g.addColorStop(1, 'rgba(' + col + ',' + a + ')');
    ctx.fillStyle = g; ctx.fillRect(-200, -200, W + 400, H + 400);
    if (st === 'warn' || st === 'watch') { ctx.strokeStyle = 'rgba(255,30,30,' + (st === 'watch' ? 0.85 : 0.6 + 0.2 * pulse) + ')'; ctx.lineWidth = st === 'watch' ? 9 : 7; ctx.strokeRect(4, 4, W - 8, H - 8); }
    ctx.restore();
  }
  function drawFlyers(dt) {
    var i;
    for (i = G.flyers.length - 1; i >= 0; i--) {
      var f = G.flyers[i]; f.age += dt; if (f.age > 1.4 || f.y > H + 100) { G.flyers.splice(i, 1); continue; }
      f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 900 * dt; f.rot += f.vr * dt;
      safeDraw('drawBlock', [ctx, f.x, f.y, C.BLOCK_W * 0.75, f.h * 0.85, f.kind, { t: G.at, rot: f.rot, alpha: Math.max(0, 1 - f.age / 1.4) }]);
    }
  }
  function drawFx(dt, withFlyers) {
    var i;
    for (i = G.fx.length - 1; i >= 0; i--) {
      var p = G.fx[i]; p.age += dt; if (p.age > p.life) { G.fx.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 600 * dt;
      ctx.globalAlpha = 1 - p.age / p.life; ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (withFlyers) drawFlyers(dt);
    for (i = G.texts.length - 1; i >= 0; i--) {
      var tx = G.texts[i], a = (G.at - tx.t0) / tx.dur; if (a > 1) { G.texts.splice(i, 1); continue; }
      ctx.globalAlpha = a < 0.7 ? 1 : 1 - (a - 0.7) / 0.3;
      var sc = a < 0.15 ? 0.6 + a / 0.15 * 0.5 : 1.1 - Math.min(0.1, (a - 0.15));
      ctx.font = '900 ' + (tx.size * sc) + 'px ' + FONT;
      var hw = ctx.measureText(tx.text).width / 2 + 6, xx = Math.max(hw, Math.min(W - hw, tx.x));
      text(tx.text, xx, tx.y - a * 34, tx.size * sc, tx.col, 'center', 900, '#1b1430', Math.max(3, tx.size * 0.2));
      ctx.globalAlpha = 1;
    }
  }
  function drawBubbles(headY) {
    if (G.bubble && G.at < G.bubble.until) bubbleBox(G.bubble.text, 300, headY - 66, 176, 17, G.bubble.col, 258, headY - 34);
    if (G.pbubble && G.at < G.pbubble.until) bubbleBox(G.pbubble.text, 112, 486, 200, 17, '#ffffff', 90, 532);
    var S = G.S;
    if (G.tip && G.at < G.tip.until && D.kindAt(S.d, S.t) !== 'PERFECT' && !tipBlocked(S)) {
      var a = Math.min(1, (G.tip.until - G.at) / 0.4);
      ctx.save(); ctx.globalAlpha = a;
      text(G.tip.text, 195, 611, 16, '#ffe066', 'center', 900, '#1b1430', 4);
      ctx.restore();
    }
    // 変顔(にらめっこ): 見ている間だけ、顔をタッチ
    if (D.canUseChotto(S, 'hengao', S.t)) {
      var p2 = 0.5 + 0.5 * Math.sin(G.at * Math.PI * 2 * PULSE);
      var wph = D.phaseAt(S.d, S.t);
      if (wph && G.hengaoHintPh !== wph) { G.hengaoHintPh = wph; G.hengaoHints = (G.hengaoHints || 0) + 1; }
      if ((G.hengaoHints || 0) <= 3) {
        var ty = Math.max(156, headY - 74);
        ctx.save(); ctx.fillStyle = 'rgba(255,224,240,0.95)'; rr(80, ty - 15, 104, 30, 10); ctx.fill(); ctx.strokeStyle = '#c0408a'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
        text('顔タッチ', 132, ty + 1, 17, '#a0206a', 'center', 900);
      }
      ctx.save(); ctx.strokeStyle = 'rgba(255,170,220,' + (0.5 + 0.4 * p2) + ')'; ctx.lineWidth = 3; ctx.setLineDash([8, 6]);
      ctx.beginPath(); ctx.arc(HEAD.x, headY, 84, 0, 6.283); ctx.stroke(); ctx.restore();
    }
  }
  function drawPanel() {
    ctx.save();
    var g = ctx.createLinearGradient(0, 526, 0, H); g.addColorStop(0, 'rgba(36,22,58,0.94)'); g.addColorStop(1, 'rgba(20,12,42,0.98)');
    ctx.fillStyle = g; ctx.fillRect(-200, 528, W + 400, H - 528 + 400);
    ctx.fillStyle = '#5a3a22'; ctx.fillRect(-200, 516, W + 400, 12);
    ctx.fillStyle = '#7a5232'; ctx.fillRect(-200, 516, W + 400, 3);
    ctx.restore();
  }
  function drawPractice(S, t) {
    if (!S.tutorial || G.mode !== 'play') return;
    var st = tonState(S, t);
    if (G.bubble && G.at < G.bubble.until) return;
    var msg = st === 'ok' ? 'いまだよ!トン!トン!' : st === 'warn' ? 'とめて!' : st === 'watch' ? '見てるよ〜' : null;
    if (G.tip && G.at < G.tip.until && st === 'ok') return;   // 「とめて!」「見てるよ〜」はヒントより優先
    if (msg) text(msg, 195, 611, 16, st === 'ok' ? '#9be15d' : '#ff6060', 'center', 900, '#1b1430', 4);
  }

  function drawPlay(dt) {
    var S = G.S, t = S.t;
    var sh = G.shake > 0 ? G.shake * 8 : 0;
    ctx.save();
    if (sh) ctx.translate((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);
    drawScene(S.dropped, S.d.mood, BG_H);
    if (D.kindAt(S.d, t) === 'PERFECT') {
      ctx.save(); ctx.globalAlpha = 0.22;
      var g = ctx.createLinearGradient(0, 0, W, H);
      for (var i = 0; i < 7; i++) g.addColorStop(i / 6, 'hsl(' + ((G.at * 160 + i * 50) % 360) + ',90%,60%)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, BG_H); ctx.restore();
    }
    drawPanel();
    drawHammer();
    var hp = drawTowerAndHead(S, t);
    drawStatus(S);
    drawLeftColumn(S, t);
    drawFlyers(dt);                         // 飛ぶ段は アイテムの枠・ボタンより後ろ
    drawSlots(S, t);
    drawChotto(S, t);
    drawTon(S, t);
    drawHud(S);
    drawChant(S, t);
    drawFx(dt);
    drawBubbles(hp.headY);
    drawPractice(S, t);
    if (S.golden || G.pop || G.flop) { drawGoldenScene(S); drawTon(S, t); }   // トン!(ふくらませろ!)は いちばん上に
    if (G.ippoText && G.at < G.ippoText && !bigBusy(1) && !tipBlocked(S)) { var ia = Math.min(1, (G.ippoText - G.at) / 0.4); ctx.save(); ctx.globalAlpha = ia; text('はじめの… いーっぽ!', BIG_X, BIG_Y, 26, '#ffe066', 'center', 900, '#1b1430', 7); ctx.restore(); }
    drawBig();
    drawVignette(S, t);
    drawMystery();
    ctx.restore();
    if (G.countdown > 0) {
      ctx.save(); ctx.fillStyle = 'rgba(10,6,24,0.45)'; ctx.fillRect(-200, -200, W + 400, H + 400); ctx.restore();
      text(String(Math.ceil(G.countdown)), 195, 380, 120, '#ffe066', 'center', 900, '#1b1430', 10);
      text('だるまさんは まってるよ', 195, 470, 18, '#fff', 'center', 800, '#1b1430', 4);
    }
  }

  function drawOut(dt) {
    var S = G.S, t = S.out.t, ot = G.outT;
    drawScene(G.S.dropped, G.outInfo.mood, BG_H);
    drawPanel();
    var z = Math.max(0, Math.min(1, (ot - C.OUT_FREEZE) / 0.35));
    var ez = z * z * (3 - 2 * z);
    var face = G.outInfo.mood === 'okori' ? 'angry' : 'smug';
    if (ot < C.OUT_FREEZE) drawTowerAndHead(S, t, { turn: 1, mood: 'surprised' });
    else {
      if (!G.outInfo.collapsed) {
        G.outInfo.collapsed = true;
        var slots = 0;
        for (var i = 0; i < S.tower.length && slots < 6; i++) {
          var b = S.tower[i], n = b.kind === 'double' ? 2 : 1;
          G.flyers.push({ kind: D.BLOCKS[b.t].art, x: 195, y: TOWER_BOTTOM - (slots + n / 2) * C.BLOCK_H, vx: (Math.random() - 0.5) * 420, vy: -200 - Math.random() * 260, rot: 0, vr: (Math.random() - 0.5) * 10, age: 0, h: n * C.BLOCK_H + 6 });
          slots += n;
        }
        sfx('drop');
      }
      drawFx(dt, true);
      var hy = 300 - ez * 20, size = HEAD.size + ez * 100;
      safeDraw('drawHead', [ctx, HEAD.x, hy, size, { turn: 1, mood: face, t: G.at, shake: 0 }]);
      var s = 1 + 0.3 * Math.max(0, 1 - (ot - C.OUT_FREEZE) / 0.25);
      text('みーつけた!', 195, 120, 52 * s, '#ff3030', 'center', 900, '#fffaf0', 10);
      if (G.outInfo.rush) text('止まれなかった!', 195, 178, 22, '#ffffff', 'center', 900, '#1b1430', 5);
    }
    if (G.tapX) { text('×', G.tapX.x, Math.min(G.tapX.y, 740), 64, '#ff2020', 'center', 900, '#ffffff', 6); }
    var a = Math.max(0, 1 - ot / 0.4);
    if (a > 0) { ctx.save(); ctx.fillStyle = 'rgba(255,0,0,' + a * 0.5 + ')'; ctx.fillRect(-200, -200, W + 400, H + 400); ctx.restore(); }
  }

  // タイトル・説明・結果の うしろの絵
  function drawTitleBg() {
    safeDraw('drawBackground', [ctx, W, H * 0.95, G.at, themeFor(G.daily.mood)]);
    ctx.save(); ctx.fillStyle = 'rgba(20,12,42,0.35)'; ctx.fillRect(-200, -200, W + 400, H + 400); ctx.restore();
    var kinds = ['red', 'blue', 'timing', 'gold'];
    for (var i = 0; i < kinds.length; i++) safeDraw('drawBlock', [ctx, 195, 470 - i * 36, 180, 42, kinds[i], { t: G.at }]);
    var m = D.MOODS[G.daily.mood];
    safeDraw('drawHead', [ctx, 195, 470 - 3 * 36 - 18 - 170 * headBottom() + 3, 170, { turn: 1, mood: m.art, t: G.at }]);
  }
  function miniTon(x, y, label, fill, col, border) {
    ctx.save(); ctx.fillStyle = fill; rr(x - 70, y - 26, 140, 52, 16); ctx.fill(); ctx.lineWidth = border ? 5 : 3; ctx.strokeStyle = border || '#1b1430'; ctx.stroke(); ctx.restore();
    text(label, x, y + 1, label.length > 4 ? 18 : 24, col, 'center', 900);
  }
  function drawHowto() {
    safeDraw('drawBackground', [ctx, W, H * 0.95, G.at, 'washitsu']);
    ctx.save(); ctx.fillStyle = 'rgba(20,12,42,0.25)'; ctx.fillRect(-200, -200, W + 400, H + 400); ctx.restore();
    var p = G.howtoPage, t = G.at;
    if (p === 3) return;
    for (var i = 0; i < 3; i++) safeDraw('drawBlock', [ctx, 170, 390 - i * 36, 170, 42, ['red', 'blue', 'green'][i], { t: t }]);
    var hy = 390 - 2 * 36 - 18 - 150 * headBottom() + 3;
    if (p === 0) {
      safeDraw('drawHead', [ctx, 170, hy, 150, { turn: 0, mood: 'normal', t: t }]);
      var sw = Math.max(0, Math.sin(t * 6));
      ctx.save(); ctx.translate(48, 460); ctx.scale(-1, 1); safeDraw('drawHammer', [ctx, 0, 0, 0.12 - sw * 0.42, 'normal', 86]); ctx.restore();
      miniTon(312, 380, 'トン!', '#9be15d', '#1b1430');
    } else if (p === 1) {
      safeDraw('drawHead', [ctx, 170, hy, 150, { turn: 0.35, mood: 'normal', t: t, shake: 0.8 }]);
      ctx.save(); ctx.fillStyle = 'rgba(255,250,236,0.95)'; rr(40, 96, 310, 56, 14); ctx.fill(); ctx.restore();
      ['こ', 'ろ', 'ん', 'だ'].forEach(function (ch, i) { text(ch, 95 + i * 68, 124, 40, '#e02020', 'center', 900); });
      miniTon(312, 380, 'とめて!', '#ffd23f', '#1b1430', '#e01010');
    } else {
      safeDraw('drawHead', [ctx, 170, hy, 150, { turn: 1, mood: 'angry', t: t }]);
      miniTon(312, 380, 'さわらないで!', '#e5221b', '#ffffff');
      text('×', 312, 300, 80, '#ff2020', 'center', 900, '#ffffff', 8);
    }
  }
  function drawResultBg() {
    var r = G.result;
    safeDraw('drawBackground', [ctx, W, H * 0.95, G.at, 'yoru']);
    ctx.save(); ctx.fillStyle = 'rgba(20,12,42,0.55)'; ctx.fillRect(-200, -200, W + 400, H + 400); ctx.restore();
    safeDraw('drawHead', [ctx, 195, 50, 80, { turn: 1, mood: r.face, t: G.at, oneEye: r.oneEye }]);
  }

  // ------------------------------------------------------------------ かお図鑑(10×10 の一覧。HTML の canvas に1回だけ描く)
  var GRID_COLS = 8, GRID_CELL = 48;
  function countSeen() { var seen = G.rec.stats.faceIds || [], n = 0; faceList().forEach(function (f) { if (seen.indexOf(f.id) >= 0) n++; }); return n; }
  function renderGrid(cv2, newSet) {
    if (!cv2) return;
    var L = faceList(), rows = Math.ceil(L.length / GRID_COLS), w = GRID_COLS * GRID_CELL, h = rows * GRID_CELL;
    var sc = Math.max(1.5, Math.min(4, VIEW.s * VIEW.dpr));
    cv2.width = Math.round(w * sc); cv2.height = Math.round(h * sc); cv2.style.width = w + 'px'; cv2.style.height = h + 'px';
    var c = cv2.getContext('2d'); c.setTransform(sc, 0, 0, sc, 0, 0); c.clearRect(0, 0, w, h);
    var seen = G.rec.stats.faceIds || [];
    for (var i = 0; i < L.length; i++) {
      var f = L[i], x = (i % GRID_COLS + 0.5) * GRID_CELL, y = (Math.floor(i / GRID_COLS) + 0.5) * GRID_CELL;
      var dia = GRID_CELL / 1.25, A = window.DARUMA_ART, th = null;
      if (seen.indexOf(f.id) >= 0) {
        if (newSet && newSet[f.id]) { c.save(); c.fillStyle = 'rgba(255,224,102,0.35)'; c.beginPath(); c.arc(x, y, GRID_CELL * 0.48, 0, 6.283); c.fill(); c.restore(); }
        if (f.id === 'golden') { drawGolden(c, x, y + 2, dia * 0.95, 0.45, 0); continue; }
        try { if (realFaces() && A.faceThumb) th = A.faceThumb(f.id, dia, sc); } catch (e) { th = null; }
        if (th) c.drawImage(th, x - dia * 0.75, y + 3 - dia * 0.78, dia * 1.5, dia * 1.5);   // 1回だけ描いて覚えた 小さな絵
        else drawFaceById(c, x, y + 1, GRID_CELL * 0.8, f.id, {});
        if (newSet && newSet[f.id]) {
          c.save(); c.font = '900 10px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 3; c.strokeStyle = '#1b1430'; c.strokeText('NEW', x, y - GRID_CELL * 0.38); c.fillStyle = '#ff5a5a'; c.fillText('NEW', x, y - GRID_CELL * 0.38);
          c.fillStyle = '#fff6a0'; c.beginPath(); var sx = x + GRID_CELL * 0.36, sy = y - GRID_CELL * 0.3; for (var k = 0; k < 8; k++) { var a = k * Math.PI / 4, rr2 = k % 2 ? 2 : 6; c.lineTo(sx + Math.cos(a) * rr2, sy + Math.sin(a) * rr2); } c.closePath(); c.fill(); c.restore();
        }
      } else drawFaceLocked(c, x, y + 3, dia, f.id);
    }
  }
  function gridTap(ev, cv2) {
    var r = cv2.getBoundingClientRect(), L = faceList();
    var col = Math.floor((ev.clientX - r.left) / r.width * GRID_COLS), row = Math.floor((ev.clientY - r.top) / r.height * Math.ceil(L.length / GRID_COLS));
    var i = row * GRID_COLS + col, f = L[i]; if (!f) return;
    var seen = (G.rec.stats.faceIds || []).indexOf(f.id) >= 0;
    var fc = $('fmCanvas'), c = fc.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, fc.width, fc.height);
    if (seen) drawFaceById(c, 200, 205, 330, f.id, { t: G.at }); else drawFaceLocked(c, 200, 200, 330, f.id);
    $('fmName').textContent = seen ? f.name : '?????';
    $('fmGroup').textContent = seen ? ({ tsuntsun: 'つんつん の かお', dajare: 'ダジャレ の かお', kusuguru: 'くすぐる の かお', common: 'いつもの かお', rare: 'めずらしい かお!' }[f.group] || '') : 'まだ 見ていない かお';
    show('faceModal', true); sfx('tap');
  }
  $('rGrid').addEventListener('click', function (ev) { gridTap(ev, $('rGrid')); });
  $('zGrid').addEventListener('click', function (ev) { gridTap(ev, $('zGrid')); });
  $('faceModal').addEventListener('click', function () { show('faceModal', false); });
  function toZukan() { refreshRecords(); show('title', false); show('zukan', true); $('zCount').textContent = '見たかお ' + countSeen() + ' / ' + faceList().length; $('zGridBox').scrollTop = 0; setTimeout(function () { renderGrid($('zGrid'), null); }, 30); }

  // ------------------------------------------------------------------ ループ(固定 1/60 秒)
  function update(dt) {
    var S = G.S;
    var nowPh = D.phaseAt(S.d, S.t);
    if (G.netaAt && G.at >= G.netaAt.at) { if (nowPh === G.netaAt.ph && !(G.bubble && G.at < G.bubble.until)) say(G.netaAt.text, 1.0); G.netaAt = null; }
    if (!G.backNetaAt) G.backNetaAt = G.at + 10 + G.lastRng() * 10;
    if (G.at >= G.backNetaAt && nowPh && nowPh.k === 'SAFE' && nowPh.e - S.t > 1.6 && D.chantIndex(S.d, S.t) <= 3 && !(G.bubble && G.at < G.bubble.until) && !S.peek) {
      var bn = netaOf(BACK_NETA, S.d.mood); say(bn, 1.4);
      if (/ハックション/.test(bn)) G.hop = G.at + 0.6;
      G.backNetaAt = G.at + 12 + G.lastRng() * 10;
    }
    if (!S.tutorial && S.playT > 20 && D.canUseChotto(S, 'ijiwaru', S.t) && !S.goldenCount) tip('tsuntsun', 'つんつんすると たまに… なにかが 出るかも?');
    var scn = D.sceneOf(S.dropped).idx;
    if (G.sceneIdx != null && scn > G.sceneIdx) bigMsg(D.SCENES[scn][2] + ' に なった!', '#ffffff', 26, 1.6, 2);
    G.sceneIdx = scn;
    var gl = goalNow(S);
    if (gl && gl.passed && !G.goalPassed[gl.key]) { G.goalPassed[gl.key] = true; if (gl.base > 0) { sfx('combo'); bigMsg(gl.key === 'c' ? '挑戦状 クリア!' : '最高 こえた!', '#9be15d', 32, 1.6, 2); } }
    handle(D.step(S, dt));
    for (var i = 0; i < S.tower.length; i++) if (S.tower[i].flash) S.tower[i].flash = Math.max(0, S.tower[i].flash - dt * 6);
    // はじめての段は 1回だけ説明する
    var bt = S.tower[0];
    if (bt && G.mode === 'play') {
      if (bt.kind === 'ring') tip('ring', '輪が まとに 重なったら トン!(緑になったら)');
      else if (bt.kind === 'slide') tip('slide', '▲が まんなかに 来たら トン!');
      else if (bt.t === 'bakudan') tip('bomb', 'ばくだんを おとすと びっくりして ふりむくよ!');
      else if (bt.t === 'kin') tip('kin', '金の段は 8回 連打で 100点!');
      else if (bt.t === 'hoshi') tip('hoshi', 'ほしの段を おとすと ちょっかい玉 +1');
    }
  }
  function loop(now) {
    requestAnimationFrame(loop);
    try {
      var dt = Math.min((now - (G.lastNow || now)) / 1000, 0.05);
      G.lastNow = now; G.at += dt;
      G.swing = Math.max(0, G.swing - dt * 7);
      G.fall = Math.max(0, G.fall - dt * 420);
      G.shake = Math.max(0, G.shake - dt * 2);
      G.flash = Math.max(0, G.flash - dt * 3);
      if (G.tip && G.mode === 'play' && G.S && (G.paused || tipBlocked(G.S))) G.tip.until += dt;
      if (G.mode === 'play' && !G.paused) {
        if (G.countdown > 0) {
          G.countdown -= dt;
          if (G.countdown <= 0) { G.countdown = 0; D.refreshTell(G.S, G.S.t); moodBgm(); }
        } else {
          G.acc += G.slowUntil && G.at < G.slowUntil ? dt * 0.3 : dt;
          while (G.acc >= C.DT && G.mode === 'play') { update(C.DT); G.acc -= C.DT; }
        }
      }
      if (G.mode === 'out') { G.outT += dt; if (G.outT >= C.OUT_TOTAL) toResult(); }
      draw(dt);
    } catch (e) { console.error(e); }
  }
  function draw(dt) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#140c2a'; ctx.fillRect(0, 0, cv.width, cv.height);
    baseTransform();
    if (G.mode === 'play' && G.S) drawPlay(G.paused ? 0 : dt);
    else if (G.mode === 'out') drawOut(dt);
    else if (G.mode === 'howto') drawHowto();
    else if (G.mode === 'result' && G.result) drawResultBg();
    else drawTitleBg();
    if (G.flash > 0 && G.mode !== 'title') { ctx.save(); ctx.fillStyle = 'rgba(' + G.flashCol + ',' + G.flash * 0.35 + ')'; ctx.fillRect(-200, -200, W + 400, H + 400); ctx.restore(); }
  }
  cv.addEventListener('contextlost', function () {});
  cv.addEventListener('contextrestored', function () { resize(); });

  // 確認用のしかけ(自動確認の台本が使う)
  window.DBG = {
    phase: function () { return G.S ? D.kindAt(G.S.d, G.S.t) : null; },
    blind: function () { return G.S ? D.isBlind(G.S, G.S.t) : false; },
    info: function () { var S = G.S; return S ? { t: S.t, k: D.kindAt(S.d, S.t), mood: S.d.mood, score: S.score, dropped: S.dropped, tama: S.tama, slots: S.slots.slice(), out: !!S.out, tutorial: S.tutorial, mode: G.mode } : { mode: G.mode }; },
    tonPoint: function () { return { x: VIEW.ox + (R.ton.x + R.ton.w / 2) * VIEW.s, y: VIEW.oy + (R.ton.y + R.ton.h / 2) * VIEW.s }; },
    pointOf: function (x, y) { return { x: VIEW.ox + x * VIEW.s, y: VIEW.oy + y * VIEW.s }; },
    R: R, start: startGame, give: function (it) { if (G.S) { G.S.slots[0] = it; } }, toResult: toResult
  };

  requestAnimationFrame(function (t) { G.lastNow = t; loop(t); });
  // 確認用: #play でタイトルを飛ばす(はじめてなら れんしゅう)。#playreal で れんしゅうも飛ばす
  var h = location.hash;
  if (h.indexOf('#playreal') === 0) startGame({ tutorial: false });
  else if (h.indexOf('#play') === 0) startGame();
  else toTitle();
})();
