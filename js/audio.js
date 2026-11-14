'use strict';
/* 音: すべて WebAudio でその場で作る(音のファイルは使わない)。
   最初のタップのあとに AUDIO.unlock() を呼ぶ。AUDIO.bgm('town') で曲、AUDIO.sfx('coin') で効果音。 */
var AUDIO = (function () {
  var ctx = null, master = null, muted = false, cur = null, timer = null, step = 0, nextT = 0;
  var MUTE_KEY = 'daruma-mute';
  try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch (e) {}
  function unlock() {
    if (document.hidden) return;   // 画面が隠れているときは 鳴らさない(閉じたあとに音が残らないように)
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); startTimer(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(ctx.destination);
    if (cur) { var name = cur; cur = null; bgm(name); }
  }
  function setMute(m) { muted = m; try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch (e) {} if (master) master.gain.value = m ? 0 : 0.5; }
  function isMuted() { return muted; }
  // 音の名前 → 周波数
  var NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
  function freq(n) { if (!n || n === '-') return 0; var m = /^([A-G]#?)(\d)$/.exec(n); if (!m) return 0; return 440 * Math.pow(2, (NOTE[m[1]] + (m[2] - 4) * 12 - 9) / 12); }
  function tone(f, t0, dur, type, vol, dest) {
    if (!ctx || !f) return;
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'square'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest || master); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function noise(t0, dur, vol) {
    if (!ctx) return;
    var buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    var s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = buf; g.gain.value = vol; s.connect(g); g.connect(master); s.start(t0);
  }
  /* 曲: 16分音符ごとの列。mel(主旋律)・bass(低音)・chord(和音, 4分ごと) */
  var SONGS = {
    // タイトル: のんびりした和風(ヨナ抜き)
    title: { bpm: 96, lead: 'triangle', mel: 'E5 - G5 - A5 - - - G5 - E5 - D5 - - - E5 - G5 - C6 - A5 - G5 - - - - - - -'.split(' '),
             bass: 'C3 - - - G2 - - - A2 - - - E2 - - - F2 - - - G2 - - - C3 - - - - - - -'.split(' ') },
    // あそび中(向こう向き): 軽快なお囃子ふう
    play: { bpm: 138, lead: 'square', mel: 'A4 C5 D5 - E5 - D5 C5 A4 - G4 - A4 - - - C5 D5 E5 - G5 - E5 D5 C5 - A4 - C5 - - -'.split(' '),
            bass: 'A2 - E3 - A2 - E3 - G2 - D3 - G2 - D3 - F2 - C3 - F2 - C3 - E2 - B2 - E2 - B2 -'.split(' ') },
    // おこりモード: 速くて低い
    angry: { bpm: 168, lead: 'sawtooth', mel: 'A4 - A4 A#4 A4 - G4 - A4 - A4 A#4 C5 - A#4 - A4 - A4 A#4 A4 - G4 - F4 - E4 - D4 - E4 -'.split(' '),
             bass: 'A2 A2 - A2 A2 - A2 - A2 A2 - A2 A2 - A2 - F2 F2 - F2 F2 - F2 - E2 E2 - E2 E2 - E2 -'.split(' ') },
    // 落としまくりタイム
    fever: { bpm: 176, lead: 'square', mel: 'C5 E5 G5 C6 G5 E5 C5 E5 D5 F5 A5 D6 A5 F5 D5 F5 E5 G5 B5 E6 B5 G5 E5 G5 C6 - G5 - C6 - - -'.split(' '),
             bass: 'C3 - C3 - C3 - C3 - D3 - D3 - D3 - D3 - E3 - E3 - E3 - E3 - C3 - G2 - C3 - - -'.split(' ') },
    result: { bpm: 100, lead: 'triangle', mel: 'G5 - E5 - C5 - - - A5 - G5 - E5 - - - F5 - D5 - B4 - - - C5 - - - - - - -'.split(' '),
              bass: 'C3 - - - - - - - F2 - - - - - - - G2 - - - - - - - C3 - - - - - - -'.split(' ') }
  };
  function tick() {
    if (!ctx || !cur || !SONGS[cur]) return;
    var s = SONGS[cur], spb = 60 / s.bpm / 4;
    while (nextT < ctx.currentTime + 0.25) {
      var i = step % s.mel.length, m = s.mel[i], b = s.bass[i % s.bass.length];
      var ml = 1; while (s.mel[(i + ml) % s.mel.length] === '-' && ml < 8) ml++;
      if (m && m !== '-') tone(freq(m), nextT, spb * ml * 0.9, s.lead, 0.16);
      var bl = 1; while (s.bass[(i + bl) % s.bass.length] === '-' && bl < 8) bl++;
      if (b && b !== '-') tone(freq(b), nextT, spb * bl * 0.8, 'triangle', 0.22);
      if (cur === 'play' || cur === 'angry' || cur === 'fever') { if (i % 4 === 0) noise(nextT, 0.05, 0.12); if (i % 8 === 4) noise(nextT, 0.03, 0.06); }
      nextT += spb; step++;
    }
  }
  function bgm(name) {
    if (name === cur) return;
    cur = name; step = 0;
    if (timer) { clearInterval(timer); timer = null; }
    if (!ctx || !name) return;
    startTimer(); tick();
  }
  function stop() { bgm(null); }
  /* 曲を進める時計。画面が隠れたら止める(鳴っている間は ブラウザが時計を止めないため、閉じたあとも曲が続いてしまう) */
  function startTimer() {
    if (!ctx || !cur || timer || document.hidden) return;
    nextT = ctx.currentTime + 0.05; timer = setInterval(tick, 100);
  }
  function suspend() {
    if (timer) { clearInterval(timer); timer = null; }
    try { if (ctx && ctx.state === 'running') ctx.suspend(); } catch (e) {}
  }
  function resume() {
    if (document.hidden || !ctx) return;
    try { if (ctx.state === 'suspended') ctx.resume(); } catch (e) {}
    startTimer();
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden) suspend(); else resume(); });
  addEventListener('pagehide', suspend);
  addEventListener('pageshow', function () { resume(); });
  document.addEventListener('freeze', suspend);
  // 画面が隠れていても 曲の名前だけ覚えておき、戻ったら続きから
  /* 効果音 */
  function sfx(name) {
    if (!ctx || document.hidden) return; var t = ctx.currentTime;
    switch (name) {
      case 'tap': tone(880, t, 0.05, 'square', 0.1); break;
      case 'ok': tone(660, t, 0.06, 'square', 0.12); tone(990, t + 0.06, 0.1, 'square', 0.12); break;
      case 'hit': noise(t, 0.05, 0.25); tone(240, t, 0.06, 'square', 0.18); break;            // 木づちで コン
      case 'hard': noise(t, 0.04, 0.2); tone(520, t, 0.05, 'square', 0.12); tone(1040, t + 0.01, 0.04, 'triangle', 0.08); break; // 鉄 カン
      case 'drop': noise(t, 0.09, 0.3); tone(180, t, 0.08, 'triangle', 0.25); tone(320, t + 0.04, 0.1, 'triangle', 0.15); break; // スコーン
      case 'gold': [1320, 1760, 2093, 2637].forEach(function (f, i) { tone(f, t + i * 0.05, 0.18, 'square', 0.1); }); break;
      case 'combo': tone(990, t, 0.05, 'square', 0.1); tone(1320, t + 0.05, 0.08, 'square', 0.1); break;
      case 'miss': tone(300, t, 0.1, 'triangle', 0.14); tone(220, t + 0.08, 0.14, 'triangle', 0.12); break;
      case 'ring': tone(1500, t, 0.03, 'sine', 0.08); break;                                   // タイミングの合図
      case 'item': [523, 659, 784, 1047, 1319].forEach(function (f, i) { tone(f, t + i * 0.05, 0.15, 'square', 0.11); }); break;
      case 'perfect': for (var i = 0; i < 10; i++) tone(500 + i * 120, t + i * 0.035, 0.12, 'square', 0.1); noise(t + 0.35, 0.3, 0.12); break;
      case 'voice': tone(560, t, 0.11, 'triangle', 0.16); tone(840, t, 0.11, 'sine', 0.05); break; // だ・る・ま…の1文字
      case 'voicelast': tone(420, t, 0.25, 'triangle', 0.2); tone(630, t, 0.25, 'sine', 0.06); break;
      case 'turn': noise(t, 0.08, 0.2); tone(880, t, 0.05, 'square', 0.15); tone(1320, t + 0.05, 0.12, 'square', 0.15); break; // くるっ
      case 'back': tone(660, t, 0.06, 'triangle', 0.1); tone(440, t + 0.05, 0.08, 'triangle', 0.08); break;
      case 'laugh': [520, 470, 540, 480, 560, 490].forEach(function (f, i) { tone(f, t + i * 0.07, 0.06, 'square', 0.1); }); break;
      case 'angry': tone(120, t, 0.3, 'sawtooth', 0.22); tone(90, t + 0.1, 0.3, 'sawtooth', 0.18); noise(t, 0.2, 0.15); break;
      case 'shy': tone(1200, t, 0.08, 'sine', 0.1); tone(1500, t + 0.08, 0.12, 'sine', 0.1); break;
      case 'sleepy': tone(300, t, 0.4, 'sine', 0.12); tone(250, t + 0.35, 0.5, 'sine', 0.1); break;
      case 'blind': noise(t, 0.15, 0.15); tone(700, t + 0.05, 0.1, 'triangle', 0.1); break;
      case 'joke': tone(660, t, 0.08, 'square', 0.1); tone(880, t + 0.1, 0.08, 'square', 0.1); break;
      case 'flop': tone(400, t, 0.15, 'triangle', 0.12); tone(300, t + 0.15, 0.3, 'triangle', 0.12); break; // すべった
      case 'warn': tone(880, t, 0.06, 'square', 0.12); break;
      case 'out': tone(200, t, 0.15, 'sawtooth', 0.25); tone(150, t + 0.15, 0.2, 'sawtooth', 0.22); tone(100, t + 0.35, 0.5, 'sawtooth', 0.2); noise(t, 0.3, 0.2); break;
      case 'shield': [800, 1000, 1200].forEach(function (f, i) { tone(f, t + i * 0.06, 0.15, 'sine', 0.14); }); break;
      // ゴールデンだるま(2026-11-14): 弾ける「パーン!」+ファンファーレ / しぼむ「ぷしゅ〜」 / ぷるぷる
      case 'gpop': noise(t, 0.35, 0.45); tone(160, t, 0.2, 'square', 0.25); [523, 659, 784, 1047, 1319, 1568].forEach(function (f, i) { tone(f, t + 0.12 + i * 0.07, 0.22, 'square', 0.13); }); tone(1047, t + 0.6, 0.5, 'triangle', 0.15); break;
      case 'gpshu': (function () { if (!ctx) return; var o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(700, t); o.frequency.exponentialRampToValueAtTime(90, t + 0.9); g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.95); o.connect(g); g.connect(master); o.start(t); o.stop(t + 1); })(); noise(t, 0.8, 0.08); break;
      case 'gpuru': [0, 1, 2, 3].forEach(function (i) { tone(520 + (i % 2) * 60, t + i * 0.05, 0.05, 'triangle', 0.1); }); break;
      case 'best': [523, 659, 784, 1047, 784, 1047].forEach(function (f, i) { tone(f, t + [0, .12, .24, .36, .6, .72][i], 0.2, 'square', 0.13); }); break;
    }
  }
  // ふくらむ音「ぷぅ」: k = 0〜1 で だんだん高くなる
  function puu(k) { if (!ctx || document.hidden) return; var t = ctx.currentTime, f = 220 + 900 * Math.max(0, Math.min(1, k)); tone(f, t, 0.07, 'triangle', 0.14); tone(f * 1.5, t + 0.02, 0.05, 'sine', 0.05); }
  return { puu: puu, unlock: unlock, bgm: bgm, stop: stop, sfx: sfx, setMute: setMute, isMuted: isMuted, suspend: suspend, resume: resume, state: function () { return { ctx: ctx ? ctx.state : 'none', timer: !!timer, cur: cur }; } };
})();
