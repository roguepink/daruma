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

  // ------------------------------------------------------------------ 画面の配置(design.md 1 章)
  var R = {
    pause: { x: 8, y: 4, w: 44, h: 44 }, sound: { x: 338, y: 4, w: 44, h: 44 },
    ton: { x: 16, y: 624, w: 358, h: 140 },
    slots: [{ x: 306, y: 380, w: 60, h: 60 }, { x: 306, y: 448, w: 60, h: 60 }],
    chotto: [{ x: 12, y: 540, w: 86, h: 60 }, { x: 108, y: 540, w: 86, h: 60 }, { x: 204, y: 540, w: 86, h: 60 }, { x: 300, y: 540, w: 86, h: 60 }],
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
      stats: { plays: st.plays || 0, totalDan: st.totalDan || 0, faces: st.faces || [], titles: st.titles || [], dajareUke: st.dajareUke || 0, hengaoOK: st.hengaoOK || 0 } };
  }
  function saveRecords(r) {
    lsSet(C.BEST_KEY, String(r.best)); lsSet(C.BEST_DAN_KEY, String(r.bestDan));
    lsSet(C.STATS_KEY, JSON.stringify(r.stats));
    if (r.tutorialDone) lsSet(C.TUTORIAL_KEY, '1');
  }

  // ------------------------------------------------------------------ 全体の状態
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
    var s = Math.min(w / W, h / H);
    VIEW.s = s; VIEW.dpr = dpr; VIEW.ox = (w - W * s) / 2; VIEW.oy = (h - H * s) / 2;
    stageEl.style.width = W + 'px'; stageEl.style.height = H + 'px';
    stageEl.style.transform = 'translate(' + VIEW.ox + 'px,' + VIEW.oy + 'px) scale(' + s + ')';
  }
  addEventListener('resize', resize); resize();
  function baseTransform() { ctx.setTransform(VIEW.s * VIEW.dpr, 0, 0, VIEW.s * VIEW.dpr, VIEW.ox * VIEW.dpr, VIEW.oy * VIEW.dpr); }
  function toLogical(ev) { return { x: (ev.clientX - VIEW.ox) / VIEW.s, y: (ev.clientY - VIEW.oy) / VIEW.s }; }

  // ------------------------------------------------------------------ 画面の切り替え
  function show(id, on) { var el = $(id); if (el) el.classList.toggle('hidden', !on); }
  function hideAll() { ['title', 'howto', 'pause', 'result'].forEach(function (id) { show(id, false); }); }
  function fmt(n) { return Math.round(n).toLocaleString('ja-JP'); }

  function toTitle() {
    G.mode = 'title'; G.paused = false; hideAll(); show('title', true);
    $('tBest').textContent = G.rec.best ? 'ベスト ' + fmt(G.rec.best) + ' 点 / 最高 ' + G.rec.bestDan + ' 段' : 'はじめての挑戦!';
    $('tDaily').textContent = '今日のだるまさん\n' + G.daily.line;
    AUDIO.bgm('title');
  }
  function toHowto() { G.mode = 'howto'; G.howtoPage = 0; hideAll(); show('howto', true); setHowto(); }
  var HOWTO = [
    ['むこうを むいている あいだに', 'トン!トン!', '下の大きいボタンで、いちばん下の段を叩いて落とそう'],
    ['赤い字が 出たら', '手を とめる', '「こ ろ ん だ」が赤くなったら、もうすぐ ふりむくよ'],
    ['見ているときに おしたら', 'おしまい', 'くすぐる・ダジャレなどの ちょっかいで、きぶんを かえられるよ']
  ];
  function setHowto() {
    var p = HOWTO[G.howtoPage];
    $('hNum').textContent = (G.howtoPage + 1) + ' / 3';
    $('hText1').textContent = p[0]; $('hText2').textContent = p[1]; $('hText3').textContent = p[2];
    $('btnNext').textContent = G.howtoPage < 2 ? 'つぎへ' : 'はじめる!';
  }
  function howtoNext() { if (G.howtoPage < 2) { G.howtoPage++; setHowto(); sfx('tap'); } else startGame(); }

  function startGame(opts) {
    opts = opts || {};
    hideAll();
    var tutorial = opts.tutorial != null ? opts.tutorial : !G.rec.tutorialDone;
    var seed = opts.seed || ((Date.now() ^ (Math.random() * 1e9)) >>> 0);
    G.S = D.newGame({ seed: seed, tutorial: tutorial, firstPlay: G.rec.stats.plays === 0, daily: G.daily.mood });
    G.mode = 'play'; G.paused = false; G.countdown = 0; G.acc = 0;
    G.fx = []; G.flyers = []; G.texts = []; G.bubble = null; G.pbubble = null; G.tip = null; G.flash = 0; G.shake = 0; G.fall = 0;
    G.chantAt = []; G.faceOver = null; G.outInfo = null; G.tapX = null; G.comboEnd = 0;
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
    else AUDIO.bgm(S.d.mood === 'okori' ? 'angry' : 'play');
  }

  // ------------------------------------------------------------------ 演出の部品
  function say(text, sec, col) { G.bubble = { text: text, until: G.at + (sec || 1.6), col: col || '#fffaf0', t0: G.at }; }
  function psay(text, sec) { G.pbubble = { text: text, until: G.at + (sec || 2), t0: G.at }; }
  function tip(key, text) { if (G.tipsShown[key]) return; G.tipsShown[key] = true; G.tip = { text: text, until: G.at + 3.2, t0: G.at }; }
  function floatText(x, y, text, col, size, dur) { G.texts.push({ x: x, y: y, text: text, col: col || '#fff', size: size || 22, t0: G.at, dur: dur || 0.9 }); }
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
          if (e.k === 'WATCH') {
            if (!blind) { G.flash = 1; G.flashCol = '255,40,40'; G.shake = 0.35; floatText(HEAD.x + 70, 175, 'じーっ', '#ff4040', 26, 0.8); if (S.tutorial) say('見てるよ〜 さわらないでね', 1.4); }
            else { say('あれ?見えないよ〜', 1.4, '#e6dcff'); }
          }
          if (e.k === 'RETURN') sfx('back');
          if (e.k === 'PERFECT') { sfx('perfect'); say('うっとり〜♪', 1.6, '#ffe0f0'); }
          if (e.prev === 'PERFECT') { say('はっ!', 0.8); }
          if (e.k === 'STOP') { sfx('ring'); }
          moodBgm();
          break;
        case 'returned': moodBgm(); break;
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
          G.swing = 1; sfx('miss'); floatText(195, 470, 'カン!', '#ffffff', 28, 0.6);
          if (G.S.combo === 0 && G.S.windowDrops > 1) G.comboEnd = G.at + 1;
          if (e.block.kind === 'ring') tip('ring', '輪が まとに 重なったら トン!');
          else tip('slide', '▲が まんなかに 来たら トン!');
          break;
        case 'tooFast': G.swing = 1; sfx('tap'); break;
        case 'tama': floatText(110, 58, 'ちょっかい玉 +1', '#ffe066', 18, 1.2); tip('tama', 'ちょっかいを つかってみよう!(下の4つ)'); break;
        case 'item':
          sfx('item'); floatText(300, 360, D.ITEMS[e.item].name + ' ゲット!', '#fff3a0', 20, 1.4);
          tip('item', e.item === 'shield' ? 'まもり:1回だけ 見つかっても セーフ!' : 'アイテムを ためしてみて!(右の わく)');
          break;
        case 'itemPoints': floatText(300, 360, '+100', '#fff3a0', 22, 1); break;
        case 'bomb':
          sfx('angry'); burst(195, 480, '#ffb020', 26, 260); burst(195, 480, '#555', 14, 200); G.shake = 0.5; G.flash = 0.7; G.flashCol = '255,200,80';
          floatText(195, 450, 'ドカーン!', '#ffb020', 34, 0.9);
          tip('bomb', 'ばくだんを おとすと びっくりして ふりむくよ!');
          break;
        case 'bombDud': floatText(195, 460, 'ポン', '#ccc', 22, 0.6); break;
        case 'forgive':
          sfx('shield'); say('みーつけた!…でも れんしゅう だから ゆるしてあげる', 2.4); G.flash = 0.6; G.flashCol = '255,120,120';
          break;
        case 'shield':
          sfx('shield'); say('あれ?気のせいかな〜?', 1.8, '#e6dcff'); burst(195, 240, '#d8f4ff', 30, 240); G.flash = 0.6; G.flashCol = '200,240,255';
          break;
        case 'out': onOut(); break;
        case 'tutorialDone':
          sfx('best'); say('じょうず!ほんばん いくよ!', 2.2, '#fff3a0'); G.rec.tutorialDone = true; saveRecords(G.rec);
          break;
        case 'newFace': break;
      }
    }
  }
  function onDrop(e) {
    var S = G.S, b = e.block, col = blockColor(b.t);
    G.swing = 1; G.fall = Math.max(G.fall, (b.kind === 'double' ? 2 : 1) * C.BLOCK_H);
    G.flyers.push({ kind: D.BLOCKS[b.t].art, x: 195, y: TOWER_BOTTOM - (b.kind === 'double' ? C.BLOCK_H : C.BLOCK_H / 2), vx: 520 + Math.random() * 120, vy: -120, rot: 0, vr: 5 + Math.random() * 3, age: 0, h: b.kind === 'double' ? C.BLOCK_H * 2 + 6 : C.BLOCK_H + 6 });
    burst(250, 498, col, e.auto ? 3 : 8, 180);
    if (!e.auto || Math.random() < 0.5) sfx(b.t === 'kin' || b.t === 'niji' ? 'gold' : 'drop');
    if (!e.auto || Math.random() < 0.35) floatText(240 + Math.random() * 40, 470, '+' + fmt(e.pts), e.squeeze ? '#ff8080' : (S.doubleUntil > S.t ? '#ffd040' : '#ffffff'), e.pts >= 100 ? 26 : 22, 0.8);
    G.scoreBump = 1;
    if (e.squeeze) floatText(195, 430, 'すべりこみ!', '#ff7070', 24, 0.9);
    if (e.combo && e.combo % 5 === 0) { sfx('combo'); floatText(195, 400, e.combo + 'コンボ!', '#ffe066', 32, 1.0); }
    if (b.t === 'kin') burst(195, 498, '#fff0a0', 16, 220);
  }
  function onOut() {
    var S = G.S;
    sfx('out'); AUDIO.bgm(null);
    G.mode = 'out'; G.outT = 0; G.flash = 1; G.flashCol = '255,0,0'; G.shake = 0.6;
    var watchStart = S.out.phaseStart;
    G.outInfo = { mood: S.out.mood, rush: S.out.t - watchStart < 0.5 };
  }
  function toResult() {
    var S = G.S, st = D.endStats(S), r = G.rec;
    var isBest = st.score > r.best, isBestDan = st.dan > r.bestDan;
    var prevBest = r.best;
    if (isBest) r.best = st.score;
    if (isBestDan) r.bestDan = st.dan;
    r.stats.plays++; r.stats.totalDan += st.dan;
    r.stats.dajareUke += st.counts.dajareUke; r.stats.hengaoOK += st.counts.hengaoOK;
    st.seen.forEach(function (f) { if (r.stats.faces.indexOf(f) < 0) r.stats.faces.push(f); });
    var got = D.titlesFor(st, r.stats), news = got.filter(function (id) { return r.stats.titles.indexOf(id) < 0; });
    news.forEach(function (id) { r.stats.titles.push(id); });
    saveRecords(r);
    var line = D.endLine(st, isBest && prevBest > 0, G.lastRng);
    var face = isBest && prevBest > 0 ? 'dizzy' : ({ okori: 'angry', ijiwaru: 'mean', nemui: 'sleepy', bikkuri: 'surprised', nakisou: 'sad', tere: 'shy', gokigen: 'laugh', futsu: 'smug' }[st.outMood] || 'smug');
    G.result = { st: st, face: face, isBest: isBest };
    G.mode = 'result'; hideAll(); show('result', true);
    $('rLine').textContent = '「' + line + '」';
    $('rDan').textContent = st.dan;
    $('rScore').textContent = fmt(st.score) + ' 点';
    $('rBest').textContent = isBest ? '★ ベスト更新!' : 'ベストまで あと ' + fmt(r.best - st.score) + ' 点';
    $('rBest').classList.toggle('best', isBest);
    $('rStats').textContent = 'さいだいコンボ ' + st.bestCombo + ' / すべりこみ ' + st.squeezes + ' / ' + Math.floor(st.time / 60) + '分' + Math.floor(st.time % 60) + '秒';
    var tl = got.map(function (id) { for (var i = 0; i < D.TITLES.length; i++) if (D.TITLES[i].id === id) return D.TITLES[i]; }).filter(Boolean);
    var showT = news.length ? tl.filter(function (x) { return news.indexOf(x.id) >= 0; }) : tl.slice(-1);
    $('rTitle').textContent = showT.length ? '称号: ' + showT.map(function (x) { return x.name; }).join('・') + (news.length ? ' (NEW)' : '') : '';
    $('rFaces').textContent = '見たかお ' + r.stats.faces.length + ' / 9';
    if (isBest) sfx('best');
    AUDIO.bgm('result');
  }

  // ------------------------------------------------------------------ 入力
  var keyMap = { '1': 0, '2': 1, '3': 2, '4': 3 };
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
      if (name === 'hengao') floatText(R.chotto[i].x + 43, 530, k === 'WATCH' ? 'もう つかったよ' : '見てる時だけ', '#ddd', 15, 0.9);
      else if (k === 'WATCH' || k === 'GRACE' || k === 'RETURN') floatText(R.chotto[i].x + 43, 530, '今は むり', '#ddd', 15, 0.8);
      else if (name === 'ijiwaru') floatText(R.chotto[i].x + 43, 530, 'あと ' + Math.ceil(S.teaseReadyAt - t) + 'びょう', '#ddd', 15, 0.8);
      else floatText(R.chotto[i].x + 43, 530, '玉が たりない', '#ddd', 15, 0.8);
      sfx('tap'); return;
    }
    var mood0 = S.d.mood, evs = D.useChotto(S, name, t) || [];
    evs.forEach(function (e) {
      if (e.type === 'tickle') { sfx('laugh'); faceOverride('laugh', 0.9); psay('こちょこちょ〜', 1); }
      if (e.type === 'bored') { sfx('flop'); psay(name === 'dajare' ? e.joke : 'こちょこちょ〜', 1.2); say('もう きかないよ〜', 1.6, '#e6dcff'); }
      if (e.type === 'dajare') {
        psay(e.joke, 2.2); sfx('joke');
        if (e.uke) { setTimeout(function () { sfx('laugh'); }, 300); faceOverride('laugh', 1.5); }
        else if (e.sleep) say('zzz…', 1.4);
        else { setTimeout(function () { sfx('flop'); }, 300); say('……さむい', 1.6, '#d8ecff'); }
      }
      if (e.type === 'tease') { sfx('angry'); psay('つんつん', 0.9); say(e.cry ? 'ひどい…ぐすっ' : 'むかーっ!', 1.4, e.cry ? '#d8f4ff' : '#ffd0c8'); G.shake = 0.2; }
      if (e.type === 'hengao') { psay('べろべろ〜', 0.9); if (e.ok) { sfx('laugh'); faceOverride('laugh', 0.6); say('ぶふっ!', 1); } else { sfx('flop'); say('……', 1.2); } }
    });
    if (mood0 !== S.d.mood) moodBgm();
  }
  function doItem(i, ev) {
    var S = G.S, t = gameTimeOf(ev);
    if (!S.slots[i]) return;
    if (!D.canUseItem(S, i, t)) { floatText(336, R.slots[i].y - 6, '今は むり', '#ddd', 15, 0.8); sfx('tap'); return; }
    var evs = D.useItem(S, i, t) || [];
    evs.forEach(function (e) {
      if (e.type === 'useItem') {
        var it = e.item;
        if (it === 'mekakushi') { sfx('blind'); say('わっ!まっくら!', 1.4, '#e6dcff'); }
        if (it === 'ocha') { sfx('ok'); psay('お茶 どうぞ', 1); }
        if (it === 'odateru') { sfx('shy'); psay('かっこいい〜!', 1.2); faceOverride('shy', 1); }
        if (it === 'komoriuta') { sfx('sleepy'); psay('ねんねん ころり〜♪', 1.5); }
        if (it === 'kizuchi') { sfx('gold'); floatText(60, 440, '金の木づち!', '#ffd040', 22, 1.2); }
        if (it === 'bai') { sfx('gold'); floatText(195, 60, '点数 2倍!', '#ffd040', 26, 1.2); }
        if (it === 'tokei') { sfx('ring'); floatText(195, 300, 'ピタッ!', '#bfe0ff', 34, 1.0); }
        if (it === 'perfect') { floatText(195, 300, 'パーフェクト!', '#ff8ac0', 36, 1.4); }
      }
      if (e.type === 'noSleep') say('ねられるか!', 1.4, '#ffd0c8');
    });
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
    for (var i = 0; i < 4; i++) if (inR(R.chotto[i], p.x, p.y)) { doChotto(i, ev); return; }
    for (var j = 0; j < 2; j++) if (inR(R.slots[j], p.x, p.y)) { doItem(j, ev); return; }
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
  function onPlayButton(ev) { fullscreen(ev); sfx('ok'); if (!G.rec.tutorialDone && G.rec.stats.plays === 0) toHowto(); else startGame(); }
  bindBtn('btnPlay', onPlayButton);
  bindBtn('btnHow', function () { sfx('tap'); toHowto(); });
  bindBtn('tSound', toggleSound);
  bindBtn('pSound', toggleSound);
  bindBtn('btnNext', howtoNext);
  bindBtn('btnSkip', function () { startGame(); });
  // 説明の絵: ボタン以外の どこを押しても 次へ
  $('howto').addEventListener('click', function (ev) { if (ev.target.tagName !== 'BUTTON') howtoNext(); });
  bindBtn('btnResume', resumeGame);
  bindBtn('btnQuit', function () { toTitle(); });
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
    var lines = [], cur = '';
    for (var i = 0; i < str.length; i++) {
      var ch = str[i];
      if (ch === ' ' && ctx.measureText(cur).width > maxW * 0.55) { lines.push(cur); cur = ''; continue; }
      if (ctx.measureText(cur + ch).width > maxW) { lines.push(cur); cur = ch === ' ' ? '' : ch; } else cur += ch;
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
    if (k === 'WARN' || k === 'FEINT') { turn = 0.12; shake = 0.7; }
    else if (k === 'GRACE') turn = 0.12 + 0.88 * p;
    else if (k === 'WATCH') turn = 1;
    else if (k === 'RETURN') turn = 1 - p;
    else if (k === 'PERFECT') { art = 'laugh'; }
    if (k === 'FROZEN' && ph.say && /あはは|くすくす/.test(ph.say)) art = 'laugh';
    if (G.faceOver && G.at < G.faceOver.until) art = G.faceOver.mood;
    if (blind) art = 'blind';
    return { turn: turn, shake: shake, mood: art, look: look, k: k, blind: blind };
  }

  // ------------------------------------------------------------------ 描画(遊んでいる画面)
  function themeFor(mood) { return mood === 'okori' ? 'yuyake' : mood === 'nemui' ? 'yoru' : 'washitsu'; }

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
      if (bb.kind === 'ring') o.ring = D.ringInfo(bb, S.t).size;
      if (bb.kind === 'slide') o.dir = D.slideInfo(bb, S.t).x > 0 ? 1 : -1;
      if (opt.collapse) continue;
      safeDraw('drawBlock', [ctx, 195, it.cy, C.BLOCK_W, it.h, kind, o]);
      if (bb.kind === 'slide') drawSlideMarker(bb, it.cy, S.t);
      if (bb.t === 'hoshi') text('★', 195, it.cy + 2, 22, '#ffffff', 'center', 900, '#1b1430', 3);
      if (it.i === 0) drawBottomMark(bb, it.cy, it.h);
    }
    // 頭
    var pose = headPose(S, t);
    var size = HEAD.size, hy = topY - size * headBottom();
    if (opt.headY != null) { hy = opt.headY; size = opt.headSize; }
    if (pose.k === 'PERFECT' || G.mode === 'out') { /* そのまま */ }
    var hopts = { turn: opt.turn != null ? opt.turn : pose.turn, mood: opt.mood || pose.mood, t: G.at, shake: pose.shake, dir: 1 };
    safeDraw('drawHead', [ctx, HEAD.x, hy, size, hopts]);
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
  function drawSlideMarker(b, cy, t) {
    var si = D.slideInfo(b, t), ok = si.dist <= C.SLIDE_WINDOW;
    ctx.save();
    ctx.fillStyle = ok ? 'rgba(80,255,120,0.55)' : 'rgba(255,255,255,0.35)';
    ctx.fillRect(195 - 14, cy - 13, 28, 26);
    var x = 195 + si.x * 78;
    ctx.fillStyle = ok ? '#40ff70' : '#ffe14a'; ctx.strokeStyle = '#1b1430'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(x, cy - 12); ctx.lineTo(x + 11, cy + 9); ctx.lineTo(x - 11, cy + 9); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  function drawBottomMark(b, cy, h) {
    var S = G.S;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 3; ctx.setLineDash([]);
    rr(92, cy - h / 2 - 2, 206, h + 4, 8); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(296, cy); ctx.lineTo(306, cy - 7); ctx.lineTo(306, cy + 7); ctx.closePath(); ctx.fill();
    ctx.restore();
    var label = null;
    if (b.kind === 'mash' && b.t === 'kin') label = 'あと' + b.hp + '回';
    else if (b.kind === 'mochi' || b.kind === 'double' || (b.kind === 'hibi')) label = 'あと' + b.hp + '回';
    if (label && b.t !== 'ao') text(label, 195, cy + h / 2 + 12, 15, '#ffffff', 'center', 900, '#1b1430', 4);
    if (b.kind === 'ring') {
      var ri = D.ringInfo(b, S.t);
      if (ri.dist <= D.ringWindow(S)) text('いま!', 270, cy - 2, 16, '#40ff70', 'center', 900, '#1b1430', 4);
    }
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
    var said = D.chantIndex(S.d, t);
    if (said === 0 && (k === 'FROZEN' || k === 'PAUSE')) said = G.lastSaid || 0;
    else G.lastSaid = said;
    if (ph && ph.dbl) said = 0;
    for (var i = 0; i < 10; i++) {
      var x = 25 + 34 * i + 17, red = i >= 6, done = i < said;
      var at = G.chantAt[i], pop = done && at != null ? Math.max(0, 1 - (G.at - at) / 0.18) : 0;
      var size = (red ? 30 : 26) * (1 + 0.45 * pop);
      var col = done ? (red ? (blind ? '#8a5ad8' : '#e02020') : '#1b1430') : 'rgba(27,20,48,0.22)';
      if (!done && red) col = 'rgba(224,32,32,0.25)';
      text(C.CHANT[i], x, 117, size, col, 'center', 900);
    }
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
    var g = ctx.createLinearGradient(0, 0, 0, 94); g.addColorStop(0, 'rgba(20,12,42,0.92)'); g.addColorStop(1, 'rgba(20,12,42,0.55)');
    ctx.fillStyle = g; ctx.fillRect(-200, -200, W + 400, 294);
    // ポーズ
    ctx.fillStyle = 'rgba(255,255,255,0.14)'; rr(R.pause.x, R.pause.y, 44, 44, 12); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(22, 15, 6, 22); ctx.fillRect(32, 15, 6, 22);
    // 音
    ctx.fillStyle = 'rgba(255,255,255,0.14)'; rr(R.sound.x, R.sound.y, 44, 44, 12); ctx.fill();
    drawSpeaker(360, 26, AUDIO.isMuted());
    // 点数
    var bump = G.scoreBump; G.scoreBump = Math.max(0, bump - 0.08);
    var dbl = S.doubleUntil > S.t;
    text(fmt(S.score), 195, 27, 32 * (1 + bump * 0.12), dbl ? '#ffd040' : '#ffffff', 'center', 900, '#1b1430', 5);
    if (S.tutorial) text('れんしゅう', 195, 50, 12, '#ffe066', 'center', 800);
    // ベスト
    text('ベスト ' + fmt(G.rec.best), 330, 18, 13, 'rgba(255,255,255,0.85)', 'right', 700);
    text('いま ' + S.dropped + '段', 330, 36, 12, 'rgba(255,255,255,0.8)', 'right', 800);
    // 気分
    var m = D.MOODS[S.d.mood];
    ctx.fillStyle = m.color; ctx.beginPath(); ctx.arc(20, 72, 8, 0, 6.283); ctx.fill();
    ctx.strokeStyle = '#1b1430'; ctx.lineWidth = 2; ctx.stroke();
    text(moodLabel(S), 33, 72, 18, '#ffffff', 'left', 900, '#1b1430', 4);
    // ちょっかい玉
    for (var i = 0; i < C.TAMA_MAX; i++) {
      ctx.beginPath(); ctx.arc(80 + i * 17, 26, 7, 0, 6.283);
      ctx.fillStyle = i < S.tama ? '#ffe066' : 'rgba(255,255,255,0.15)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    text('玉', 66, 26, 13, 'rgba(255,255,255,0.85)', 'right', 800);
    // コンボ
    if (S.combo >= 2) text(S.combo + 'コンボ ×' + D.comboMul(S.combo).toFixed(1), 380, 72, 16, '#ffe066', 'right', 900, '#1b1430', 4);
    else if (G.at < G.comboEnd) text('コンボおしまい', 380, 72, 15, '#aaa', 'right', 800);
    ctx.restore();
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
    // だるまさんの左に、効いているものを小さく出す
    var y = 160, items = [];
    if (D.isBlind(S, S.t)) items.push(['目かくし', S.blindUntil > S.t + 99 ? '…' : Math.ceil(S.blindUntil - S.t) + '', '#6a7ff0']);
    if (S.doubleUntil > S.t) items.push(['2倍', Math.ceil(S.doubleUntil - S.t) + '', '#e8a020']);
    if (S.malletHits > 0) items.push(['金づち', S.malletHits + '回', '#d8a020']);
    if (S.shield > 0) items.push(['まもり', '', '#58b8d8']);
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      ctx.save(); ctx.fillStyle = it[2]; ctx.globalAlpha = 0.92; rr(6, y, 84, 26, 13); ctx.fill(); ctx.restore();
      text(it[0] + ' ' + it[1], 48, y + 13, 13, '#fff', 'center', 900);
      y += 32;
    }
    // 目かくしが外れそう
    if (D.isBlind(S, S.t) && S.blindUntil - S.t < C.BLINDFOLD_WARN && S.blindUntil - S.t > 0) {
      if (Math.floor(G.at * 6) % 2) text('目かくし ずれてきた!', 195, 150, 16, '#ffe066', 'center', 900, '#1b1430', 4);
    }
  }
  function drawSlots(S, t) {
    for (var i = 0; i < 2; i++) {
      var r = R.slots[i], it = S.slots[i];
      ctx.save();
      if (!it) {
        ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.setLineDash([5, 4]); ctx.lineWidth = 2; rr(r.x, r.y, r.w, r.h, 12); ctx.stroke();
        ctx.setLineDash([]); ctx.fillStyle = 'rgba(20,12,42,0.25)'; ctx.fill();
        text('アイテム', r.x + 30, r.y + 30, 11, 'rgba(255,255,255,0.7)', 'center', 700);
      } else {
        var info = D.ITEMS[it], can = D.canUseItem(S, i, t);
        ctx.globalAlpha = can ? 1 : 0.45;
        ctx.fillStyle = 'rgba(255,250,236,0.95)'; rr(r.x, r.y, r.w, r.h, 12); ctx.fill();
        ctx.strokeStyle = can ? '#ffe066' : '#888'; ctx.lineWidth = 3; ctx.stroke();
        if (info.art === 'blindfold') safeDraw('drawItem', [ctx, r.x + 30, r.y + 25, 36, 'blindfold', G.at]);
        else if (info.art === 'perfect') safeDraw('drawItem', [ctx, r.x + 30, r.y + 25, 36, 'perfect', G.at]);
        else {
          ctx.fillStyle = it === 'perfect' ? 'hsl(' + (G.at * 220 % 360) + ',85%,58%)' : info.color;
          ctx.beginPath(); ctx.arc(r.x + 30, r.y + 25, 18, 0, 6.283); ctx.fill();
          ctx.strokeStyle = '#1b1430'; ctx.lineWidth = 2; ctx.stroke();
          text(info.mark, r.x + 30, r.y + 26, 19, '#fff', 'center', 900, '#1b1430', 3);
        }
        text(info.short, r.x + 30, r.y + 52, info.short.length > 4 ? 9 : 12, '#1b1430', 'center', 900);
      }
      ctx.restore();
    }
  }
  function drawChotto(S, t) {
    for (var i = 0; i < 4; i++) {
      var r = R.chotto[i], name = D.CHOTTO_KEYS[i], info = D.CHOTTO[name], can = D.canUseChotto(S, name, t);
      ctx.save();
      ctx.globalAlpha = can ? 1 : 0.42;
      ctx.fillStyle = name === 'hengao' && can ? '#ffd0e0' : '#fff6e0'; rr(r.x, r.y, r.w, r.h, 14); ctx.fill();
      ctx.strokeStyle = '#1b1430'; ctx.lineWidth = 3; ctx.stroke();
      text(info.name, r.x + r.w / 2, r.y + 19, 17, '#1b1430', 'center', 900);
      var cost;
      if (name === 'ijiwaru') cost = t < S.teaseReadyAt ? 'あと' + Math.ceil(S.teaseReadyAt - t) + 'びょう' : 'タダ';
      else if (name === 'hengao') cost = '見てる時';
      else cost = '玉 ' + info.cost;
      if (info.art) safeDraw('drawItem', [ctx, r.x + 17, r.y + 42, 22, info.art, G.at]);
      else { ctx.fillStyle = '#ffcc66'; ctx.beginPath(); ctx.arc(r.x + 17, r.y + 42, 10, 0, 6.283); ctx.fill(); ctx.strokeStyle = '#1b1430'; ctx.lineWidth = 1.5; ctx.stroke(); text('べ', r.x + 17, r.y + 43, 11, '#1b1430', 'center', 900); }
      text(cost, r.x + 52, r.y + 43, 12, '#5a4a6a', 'center', 800);
      ctx.restore();
    }
  }
  function tonState(S, t) {
    var k = D.kindAt(S.d, t), blind = D.isBlind(S, t);
    if (k === 'PERFECT') return 'perfect';
    if (D.isDanger(k) || k === 'FEINT') {
      if (blind) return 'blind';
      if (k === 'WARN' || k === 'FEINT') return 'warn';
      return 'watch';
    }
    return 'ok';
  }
  function drawTon(S, t) {
    var r = R.ton, st = tonState(S, t), fill, label, col = '#1b1430', border = '#1b1430', bw = 4;
    if (st === 'ok') { fill = '#9be15d'; label = 'トン!'; }
    else if (st === 'warn') { var on = Math.floor(G.at * 8) % 2 === 0; fill = on ? '#ffd23f' : '#ff5a3c'; label = 'とめて!'; border = '#e01010'; bw = 8; }
    else if (st === 'watch') { fill = '#e5221b'; label = 'さわらないで!'; col = '#ffffff'; border = '#7a0000'; bw = 6; }
    else if (st === 'blind') { fill = '#c9b6f2'; label = '見えてないよ'; }
    else { fill = 'hsl(' + (G.at * 300 % 360) + ',90%,62%)'; label = '連打!連打!'; }
    var press = G.swing > 0.6 ? 3 : 0, jig = st === 'perfect' ? Math.sin(G.at * 30) * 2 : 0;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; rr(r.x, r.y + 6, r.w, r.h, 26); ctx.fill();
    ctx.fillStyle = fill; rr(r.x + jig, r.y + press, r.w, r.h, 26); ctx.fill();
    ctx.lineWidth = bw; ctx.strokeStyle = border; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; rr(r.x + 10 + jig, r.y + press + 8, r.w - 20, 30, 16); ctx.fill();
    if (st === 'watch') { drawEye(r.x + 34, r.y + r.h / 2 + press, 16); drawEye(r.x + r.w - 34, r.y + r.h / 2 + press, 16); }
    text(label, r.x + r.w / 2 + jig, r.y + r.h / 2 + press + 2, label.length > 5 ? 34 : label.length > 4 ? 38 : 46, col, 'center', 900, st === 'watch' ? '#7a0000' : null, 4);
    ctx.restore();
  }
  function drawEye(x, y, s) {
    ctx.save(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x, y, s, s * 0.6, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#1b1430'; ctx.beginPath(); ctx.arc(x, y, s * 0.35, 0, 6.283); ctx.fill(); ctx.restore();
  }
  function drawVignette(S, t) {
    var st = tonState(S, t), a = 0, col = '255,30,30';
    if (st === 'warn') a = 0.28 + 0.12 * Math.sin(G.at * 25);
    else if (st === 'watch') a = 0.55;
    else if (st === 'blind') { a = 0.25; col = '150,110,230'; }
    else if (D.kindAt(S.d, t) === 'STOP') { a = 0.3; col = '150,200,255'; }
    if (a <= 0) return;
    ctx.save();
    var g = ctx.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 0.72);
    g.addColorStop(0, 'rgba(' + col + ',0)'); g.addColorStop(1, 'rgba(' + col + ',' + a + ')');
    ctx.fillStyle = g; ctx.fillRect(-200, -200, W + 400, H + 400);
    if (st === 'watch') { ctx.strokeStyle = 'rgba(255,30,30,0.8)'; ctx.lineWidth = 8; ctx.strokeRect(4, 4, W - 8, H - 8); }
    ctx.restore();
  }
  function drawFx(dt) {
    var i;
    for (i = G.fx.length - 1; i >= 0; i--) {
      var p = G.fx[i]; p.age += dt; if (p.age > p.life) { G.fx.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 600 * dt;
      ctx.globalAlpha = 1 - p.age / p.life; ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (i = G.flyers.length - 1; i >= 0; i--) {
      var f = G.flyers[i]; f.age += dt; if (f.age > 1.4 || f.y > H + 100) { G.flyers.splice(i, 1); continue; }
      f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 900 * dt; f.rot += f.vr * dt;
      safeDraw('drawBlock', [ctx, f.x, f.y, C.BLOCK_W * 0.75, f.h * 0.85, f.kind, { t: G.at, rot: f.rot, alpha: Math.max(0, 1 - f.age / 1.4) }]);
    }
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
    if (G.bubble && G.at < G.bubble.until) bubbleBox(G.bubble.text, 316, headY - 62, 170, 16, G.bubble.col, 262, headY - 30);
    if (G.pbubble && G.at < G.pbubble.until) bubbleBox(G.pbubble.text, 72, 330, 132, 15, '#ffffff', 60, 380);
    if (G.tip && G.at < G.tip.until) {
      var a = Math.min(1, (G.tip.until - G.at) / 0.4);
      ctx.save(); ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(20,12,42,0.88)'; rr(20, 143, 350, 32, 12); ctx.fill(); ctx.strokeStyle = '#ffe066'; ctx.lineWidth = 2; ctx.stroke();
      text(G.tip.text, 195, 159, 15, '#ffe066', 'center', 900);
      ctx.restore();
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
    if (msg) text(msg, 195, 606, 16, st === 'ok' ? '#9be15d' : '#ff6060', 'center', 900, '#1b1430', 4);
  }

  function drawPlay(dt) {
    var S = G.S, t = S.t;
    var sh = G.shake > 0 ? G.shake * 8 : 0;
    ctx.save();
    if (sh) ctx.translate((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);
    safeDraw('drawBackground', [ctx, W, BG_H, G.at, themeFor(S.d.mood)]);
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
    drawSlots(S, t);
    drawChotto(S, t);
    drawTon(S, t);
    drawHud(S);
    drawChant(S, t);
    drawFx(dt);
    drawBubbles(hp.headY);
    drawPractice(S, t);
    drawVignette(S, t);
    ctx.restore();
    if (G.countdown > 0) {
      ctx.save(); ctx.fillStyle = 'rgba(10,6,24,0.45)'; ctx.fillRect(-200, -200, W + 400, H + 400); ctx.restore();
      text(String(Math.ceil(G.countdown)), 195, 380, 120, '#ffe066', 'center', 900, '#1b1430', 10);
      text('だるまさんは まってるよ', 195, 470, 18, '#fff', 'center', 800, '#1b1430', 4);
    }
  }

  function drawOut(dt) {
    var S = G.S, t = S.out.t, ot = G.outT;
    safeDraw('drawBackground', [ctx, W, BG_H, G.at, themeFor(G.outInfo.mood)]);
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
      drawFx(dt);
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
  function drawHowto() {
    safeDraw('drawBackground', [ctx, W, H * 0.95, G.at, 'washitsu']);
    ctx.save(); ctx.fillStyle = 'rgba(20,12,42,0.25)'; ctx.fillRect(-200, -200, W + 400, H + 400); ctx.restore();
    var p = G.howtoPage, t = G.at;
    for (var i = 0; i < 3; i++) safeDraw('drawBlock', [ctx, 195, 400 - i * 36, 170, 42, ['red', 'blue', 'green'][i], { t: t }]);
    var hy = 400 - 2 * 36 - 18 - 150 * headBottom() + 3;
    if (p === 0) {
      safeDraw('drawHead', [ctx, 195, hy, 150, { turn: 0, mood: 'normal', t: t }]);
      var sw = Math.max(0, Math.sin(t * 6));
      ctx.save(); ctx.translate(70, 470); ctx.scale(-1, 1); safeDraw('drawHammer', [ctx, 0, 0, 0.3 - sw * 0.42, 'normal', 100]); ctx.restore();
      text('トン!', 300, 380, 34, '#9be15d', 'center', 900, '#1b1430', 6);
    } else if (p === 1) {
      safeDraw('drawHead', [ctx, 195, hy, 150, { turn: 0.12, mood: 'normal', t: t, shake: 0.8 }]);
      ctx.save(); ctx.fillStyle = 'rgba(255,250,236,0.95)'; rr(40, 110, 310, 56, 14); ctx.fill(); ctx.restore();
      ['こ', 'ろ', 'ん', 'だ'].forEach(function (ch, i) { text(ch, 95 + i * 68, 138, 40, '#e02020', 'center', 900); });
      text('とめて!', 300, 380, 30, '#ff5a3c', 'center', 900, '#1b1430', 6);
    } else {
      safeDraw('drawHead', [ctx, 195, hy, 150, { turn: 1, mood: 'angry', t: t }]);
      text('×', 300, 370, 90, '#ff2020', 'center', 900, '#ffffff', 8);
    }
  }
  function drawResultBg() {
    var r = G.result;
    safeDraw('drawBackground', [ctx, W, H * 0.95, G.at, 'yoru']);
    ctx.save(); ctx.fillStyle = 'rgba(20,12,42,0.55)'; ctx.fillRect(-200, -200, W + 400, H + 400); ctx.restore();
    safeDraw('drawHead', [ctx, 195, 105, 130, { turn: 1, mood: r.face, t: G.at }]);
    // 見たかお(9つ)
    var faces = G.rec.stats.faces;
    for (var i = 0; i < 9; i++) {
      var key = D.FACE_KEYS[i], x = 51 + i * 36, y = 565, seen = faces.indexOf(key) >= 0;
      if (seen) safeDraw('drawHead', [ctx, x, y, 30, { turn: 1, mood: key === 'mekakushi' ? 'blind' : D.MOODS[key].art, t: 0, shadow: false }]);
      else { ctx.save(); ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.beginPath(); ctx.arc(x, y, 14, 0, 6.283); ctx.fill(); ctx.restore(); text('?', x, y + 1, 14, 'rgba(255,255,255,0.6)', 'center', 900); }
    }
  }

  // ------------------------------------------------------------------ ループ(固定 1/60 秒)
  function update(dt) {
    var S = G.S;
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
      if (G.mode === 'play' && !G.paused) {
        if (G.countdown > 0) {
          G.countdown -= dt;
          if (G.countdown <= 0) { G.countdown = 0; D.refreshTell(G.S, G.S.t); moodBgm(); }
        } else {
          G.acc += dt;
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
