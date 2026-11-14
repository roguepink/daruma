/* daruma-art.js — だるまさん・だるま落としの段・木づち・背景 を canvas 2D の図形だけで描く
 * (画像ファイルなし・ライブラリなし・ES modules なし)
 *
 * 使い方: <script src="js/daruma-art.js"></script> のあと window.DARUMA_ART を使う。
 *
 *  DARUMA_ART.drawHead(ctx, cx, cy, size, opts)
 *     cx, cy … 頭(赤い丸)のまんなか。size … 頭の大きさ(直径・px。180 くらいが見ばえ良い)
 *     頭の底(平らなところ)は cy + size * DARUMA_ART.HEAD_BOTTOM。段の上にのせるときは
 *     cy = 段の上のふち - size * HEAD_BOTTOM。
 *     opts = {
 *       mood:  'normal' など(DARUMA_ART.MOODS を見る)
 *       turn:  0=後ろ向き / 0.5=横 / 1=前向き(0〜1 でなめらかに回る)
 *       dir:   1=右から振り向く(既定) / -1=左から
 *       t:     秒(まばたき・呼吸・湯気・涙などの小さな動き)
 *       shake: 0〜1 予兆のゆれ(ぐらぐら)
 *       look:  [x, y] 黒目の向き(-1〜1)を強制したいとき
 *       backText: 背中の字(既定 '福'。'必勝' のように2文字なら縦書き)
 *       shadow: false で足もとの影を描かない
 *       oneEye: true で(どの表情でも)右目の黒目を描かない=だるまの伝統の片目
 *     }
 *  DARUMA_ART.drawBlock(ctx, x, y, w, h, kind, opts)
 *     x, y … 段のまんなか(回転の中心)。w, h … 段の幅と高さ(上の楕円もふくむ)
 *     kind … DARUMA_ART.BLOCK_KINDS のどれか
 *     opts = { t, crack:0〜1, hp, maxHp, flash:0〜1, rot:ラジアン, alpha, glow:'色',
 *              ring:(timing の輪の大きさ。1 でぴったり), dir:(slide の向き 1/-1), seed }
 *     ※ 下の段から順に描くと、上の段が下の段の上ぶたを自然にかくす。
 *  DARUMA_ART.drawHammer(ctx, x, y, angle, kind, size)
 *     x, y … 柄のにぎり(回転の中心)。angle=0 で柄が真上・頭が上、打つ面は左向き。
 *     正の角度で時計回り(右へたおれる=ふりかぶり)。kind 'normal' / 'gold'。size 既定 140。
 *  DARUMA_ART.drawBackground(ctx, w, h, t, theme)
 *     theme 'washitsu'(和室)/ 'yuyake'(縁側の夕焼け)/ 'yoru'(夜の和室・月)
 *     動かない部分は内部でキャッシュするので毎フレーム呼んでよい。床の線は h * FLOOR_Y あたり。
 *  DARUMA_ART.drawItem(ctx, x, y, size, name, t)
 *     道具のアイコン: 'perfect'(金のつち)/'blindfold'(目かくし)/'feather'(くすぐる羽)/
 *     'prank'(いたずら・カエル)/'joke'(ダジャレ・扇子)
 */
(function () {
  'use strict';

  var PI = Math.PI, TAU = PI * 2;
  var INK = '#24160f';          // 線の色(黒すぎない こげ茶)
  var TILT = 0.07;              // 少し上から見下ろす感じ(横の線が下にふくらむ)
  var BOTTOM = 0.9;             // 頭の底(半径に対する位置)

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function fract(v) { return v - Math.floor(v); }

  // ---------------------------------------------------------------
  // 小さな道具
  // ---------------------------------------------------------------
  // 3次ベジェの点
  function bez(p0, p1, p2, p3, t) {
    var u = 1 - t;
    return [
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]
    ];
  }
  // 筆で書いたような「入りが太く、抜きが細い」線(ぬりつぶし)
  function brush(ctx, p0, p1, p2, p3, w0, w1, belly) {
    var N = 18, L = [], Rt = [], i, t, a, b, dx, dy, len, w;
    belly = belly || 0;
    for (i = 0; i <= N; i++) {
      t = i / N;
      a = bez(p0, p1, p2, p3, Math.max(0, t - 0.01));
      b = bez(p0, p1, p2, p3, Math.min(1, t + 0.01));
      dx = b[0] - a[0]; dy = b[1] - a[1]; len = Math.hypot(dx, dy) || 1;
      var p = bez(p0, p1, p2, p3, t);
      w = (lerp(w0, w1, t) + belly * Math.sin(PI * t)) / 2;
      L.push([p[0] - dy / len * w, p[1] + dx / len * w]);
      Rt.push([p[0] + dy / len * w, p[1] - dx / len * w]);
    }
    ctx.beginPath();
    ctx.moveTo(L[0][0], L[0][1]);
    for (i = 1; i < L.length; i++) ctx.lineTo(L[i][0], L[i][1]);
    for (i = Rt.length - 1; i >= 0; i--) ctx.lineTo(Rt[i][0], Rt[i][1]);
    ctx.closePath();
    ctx.fill();
    // 入りを丸く
    ctx.beginPath(); ctx.arc(p0[0], p0[1], w0 / 2, 0, TAU); ctx.fill();
  }
  function rrect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function star(ctx, x, y, r, n, inner, rot) {
    ctx.beginPath();
    for (var i = 0; i < n * 2; i++) {
      var a = rot + i * PI / n - PI / 2, rr = i % 2 ? r * inner : r;
      if (i) ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
  }
  function sparkle(ctx, x, y, r, col) {
    ctx.save();
    ctx.fillStyle = col || '#fff6c0';
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.quadraticCurveTo(x + r * 0.15, y - r * 0.15, x + r, y);
    ctx.quadraticCurveTo(x + r * 0.15, y + r * 0.15, x, y + r);
    ctx.quadraticCurveTo(x - r * 0.15, y + r * 0.15, x - r, y);
    ctx.quadraticCurveTo(x - r * 0.15, y - r * 0.15, x, y - r);
    ctx.fill();
    ctx.restore();
  }
  function heart(ctx, x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.35);
    ctx.bezierCurveTo(x - s * 0.9, y - s * 0.2, x - s * 0.45, y - s * 0.95, x, y - s * 0.4);
    ctx.bezierCurveTo(x + s * 0.45, y - s * 0.95, x + s * 0.9, y - s * 0.2, x, y + s * 0.35);
    ctx.closePath();
  }
  function drop(ctx, x, y, s) { // なみだ・汗のしずく(とがりが上)
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.bezierCurveTo(x + s * 0.2, y - s * 0.5, x + s * 0.62, y - s * 0.05, x + s * 0.62, y + s * 0.3);
    ctx.arc(x, y + s * 0.3, s * 0.62, 0, PI);
    ctx.bezierCurveTo(x - s * 0.62, y - s * 0.05, x - s * 0.2, y - s * 0.5, x, y - s);
    ctx.closePath();
  }
  function outlinedText(ctx, str, x, y, px, fill, stroke, font) {
    ctx.save();
    ctx.font = 'bold ' + px + 'px ' + (font || '"Arial Rounded MT Bold","Hiragino Maru Gothic ProN","Hiragino Sans",sans-serif');
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, px * 0.18);
    ctx.strokeStyle = stroke || INK;
    ctx.strokeText(str, x, y);
    ctx.fillStyle = fill;
    ctx.fillText(str, x, y);
    ctx.restore();
  }
  // 決まった乱数(毎回同じヒビになるように)
  function rng(seed) {
    var s = (seed * 9301 + 49297) % 233280 || 1;
    return function () { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  }
  function shade(hex, k) { // k>0 明るく, k<0 暗く
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    if (k >= 0) { r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k; }
    else { r *= 1 + k; g *= 1 + k; b *= 1 + k; }
    return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
  }

  // ---------------------------------------------------------------
  // だるまさんの頭
  // ---------------------------------------------------------------
  // 高さ n(-1=てっぺん, 1=底)での 横はば(半径に対する比)。下が少しふっくら。
  function rowR(n) {
    if (n <= -1 || n >= 1) return 0;
    return 0.97 * Math.sqrt(1 - n * n) * (1 + 0.08 * n);
  }
  function bodyPath(ctx, R) {
    var N = 40, i, th, n, tmax = Math.acos(-BOTTOM);
    ctx.beginPath();
    for (i = 0; i <= N; i++) {
      th = tmax * i / N; n = -Math.cos(th);
      if (i === 0) ctx.moveTo(0, -R); else ctx.lineTo(rowR(n) * R, n * R);
    }
    for (i = N; i >= 0; i--) {
      th = tmax * i / N; n = -Math.cos(th);
      ctx.lineTo(-rowR(n) * R, n * R);
    }
    ctx.closePath();
  }
  // 球の表面の点(u=顔の横位置, v=高さ。どちらも半径が1)を画面に写す。
  // off … 経度のずらし(背中は PI)。もどり値 [x, y, c]。c は「こちらを向いている度合い」(1=正面, 0=ふち, マイナス=裏)。
  function proj(P, u, v, off) {
    if (P.k && !off) { u *= P.k; v = FACE.v + (v - FACE.v) * P.k; }
    var r = rowR(v) * P.R, y = v * P.R;
    if (r < 0.5) return [0, y, 0];
    var k = clamp(u * P.R / r, -1, 1);
    var ang = P.yaw + (off || 0) + Math.asin(k);
    var c = Math.cos(ang), s = Math.sin(ang);
    var x = c >= 0 ? r * s : r * (s >= 0 ? 1 : -1);
    return [P.dir * x, y + TILT * r * Math.max(c, 0), c];
  }
  // 顔の部品を、その場所で横につぶして描く(fn の中は 1=半径 の座標)
  function feat(ctx, P, u, v, fn, off, minC) {
    var p = proj(P, u, v, off);
    if (p[2] < (minC == null ? 0.05 : minC)) return null;
    ctx.save();
    ctx.translate(p[0], p[1]);
    var kk = (P.k && !off) ? P.k : 1;
    ctx.scale(P.dir * p[2] * P.R * kk, P.R * kk);
    fn(p[2]);
    ctx.restore();
    return p;
  }

  // 顔の白い部分(だ円)
  var FACE = { v: -0.09, rx: 0.7, ry: 0.56 };
  var EYE = { u: 0.27, v: -0.19, r: 0.165 };
  var MOUTH_V = 0.265;
  var MS = 1.35; // 口の大きさ

  function facePath(ctx, P, shrink) {
    var N = 56, i, a, p;
    shrink = shrink || 0;
    ctx.beginPath();
    for (i = 0; i <= N; i++) {
      a = i / N * TAU;
      p = proj(P, Math.cos(a) * (FACE.rx - shrink), FACE.v + Math.sin(a) * (FACE.ry - shrink));
      if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]);
    }
    ctx.closePath();
  }

  // まばたき(0=閉じ, 1=開き)
  function blinkOpen(t, seed) {
    var per = 3.3 + (seed || 0) * 0.7;
    var ph = fract((t + 0.37) / per) * per;
    var b = 1;
    if (ph < 0.16) b = Math.abs(ph - 0.08) / 0.08;
    // ときどき2回まばたき
    if (Math.floor((t + 0.37) / per) % 3 === 2 && ph > 0.24 && ph < 0.4) b = Math.abs(ph - 0.32) / 0.08;
    return clamp(b, 0, 1);
  }

  // ===============================================================
  // 表情のしくみ: 「部品の組み合わせ(レシピ)」で顔を作る
  // ===============================================================
  // レシピ(recipe)のキー:
  //   b / bR : 眉(BROWS の名前 / 'none' / [内u,内v,外u,外v,そり,太さ])。bR があれば見て右の眉だけ変える
  //   e / eR : 目(EYES の名前 / ['名前', {上書き}] )。eR があれば見て右の目だけ変える
  //   m      : 口(drawMouth の種類)      c : ほっぺの赤さ(0〜1.3。1より大きいと斜線)
  //   puff   : ほっぺぷくー             tint : 顔の色(angry furious mean sad pale gloom green yellow soot pink gold stone gekiga grey)
  //   body   : 体の色(red fire gold white blue stone soot pink rainbow)
  //   fx     : まわりの動くもの(湯気・汗・音符…)の名前の配列。'text:ムッ' で文字も出せる
  //   acc    : 小物(glasses sunglasses hachimaki bandage urna horns catEars afro towel flower)
  //   anim   : 体の動き(tremble trembleBig bounce wobble jump roll squash shake twitch tiltL tiltBig bow …)
  //   st     : 口ひげの上げ下げ(-で上)  wig : 口ひげがぴょこぴょこ   nose : 'red'(赤い大きな鼻)
  //   yaw    : 前向きでも少し横を向く(ぷいっ)   bubble : 鼻ちょうちん   blind : 目かくし
  // brow: 眉(左の眉の 内はし iu,iv / 外はし ou,ov / そり arch / 太さ w)。右は左右反転。
  // eye : type, lid=上まぶた 0〜1, lidAng=つり具合(+で内側が下がる=怒り), low=下まぶた, pr=黒目の大きさ,
  //       look=[x,y] 黒目の向き, size=目の大きさ, wet=うるうる, sparkle=キラキラ, glow=光る, fire=炎, gek=劇画, stream=滝なみだ
  function B(iu, iv, ou, ov, arch, w) { return { iu: iu * 1.05, iv: iv - 0.02, ou: ou * 1.08, ov: ov - 0.02, arch: arch, w: (w || 0.11) * 1.12 }; }
  function E(o) {
    var e = { type: 'open', lid: 0, lidAng: 0, low: 0, pr: 0.56, look: [0, 0.12], size: 1, wet: false };
    for (var k in o) e[k] = o[k];
    return e;
  }
  var BROWS = {
    normal: [0.07, -0.47, 0.43, -0.49, 0.07], happy: [0.07, -0.52, 0.43, -0.52, 0.1], laugh: [0.07, -0.55, 0.43, -0.5, 0.12],
    angry: [0.05, -0.34, 0.44, -0.55, -0.02, 0.15], angry2: [0.06, -0.4, 0.43, -0.52, 0, 0.12], furious: [0.04, -0.3, 0.45, -0.62, -0.05, 0.18],
    low: [0.06, -0.38, 0.43, -0.47, 0, 0.13], up: [0.07, -0.52, 0.42, -0.63, 0.13, 0.11], relaxed: [0.07, -0.46, 0.43, -0.41, 0.05, 0.1],
    sad: [0.06, -0.6, 0.42, -0.42, -0.05, 0.12], worried: [0.07, -0.56, 0.43, -0.46, 0, 0.11], high: [0.07, -0.62, 0.43, -0.62, 0.12, 0.09],
    flat: [0.06, -0.41, 0.43, -0.43, 0, 0.12], smug: [0.07, -0.5, 0.43, -0.58, 0.1, 0.11], blind: [0.07, -0.53, 0.43, -0.55, 0.09, 0.1],
    dizzy: [0.07, -0.53, 0.43, -0.44, -0.02, 0.1], thick: [0.06, -0.44, 0.44, -0.52, 0.06, 0.21], gekiga: [0.05, -0.36, 0.46, -0.5, -0.04, 0.2],
    tiny: [0.16, -0.5, 0.34, -0.51, 0.03, 0.07]
  };
  var EYES = {
    open: {}, big: { size: 1.15, pr: 0.6 }, tiny: { size: 1.12, pr: 0.26, look: [0, 0] },
    happy: { type: 'arcUp' }, crescent: { type: 'crescent' }, closed: { type: 'arcDown' }, squeeze: { type: 'squeeze' }, spiral: { type: 'spiral' },
    white: { type: 'blank' }, none: { type: 'none' }, half: { lid: 0.5 },
    sleepy: { lid: 0.6, lidAng: -0.12, pr: 0.5, look: [0, 0.45], sway: true },
    angry: { pr: 0.38, lid: 0.36, lidAng: 0.55, look: [0, 0.05] }, furious: { glow: true, lid: 0.34, lidAng: 0.6 },
    glare: { pr: 0.28, lid: 0.45, lidAng: 0.6, low: 0.18, look: [0.85, 0] },
    wet: { pr: 0.64, look: [0, 0.2], wet: true }, shy: { pr: 0.6, look: [-0.8, 0.55], wet: true },
    mean: { lid: 0.5, lidAng: 0.38, low: 0.2, pr: 0.5, look: [0.75, 0.1] }, meanR: { lid: 0.42, lidAng: 0.3, low: 0.18, pr: 0.5, look: [0.75, 0.1] },
    smug: { lid: 0.5, lidAng: -0.3, low: 0.12, pr: 0.55, look: [0, 0.1] }, suspicious: { lid: 0.52, low: 0.24, pr: 0.55, look: [-0.85, 0] },
    star: { type: 'star' }, heart: { type: 'heart' }, x: { type: 'x' }, line: { type: 'line' }, wave: { type: 'wave' },
    sparkle: { pr: 0.7, wet: true, sparkle: true, look: [0, 0.05], size: 1.08 }, fire: { fire: true, lid: 0.22, lidAng: 0.45 },
    gekiga: { gek: true, pr: 0.22, lid: 0.3, lidAng: 0.45, look: [0, 0] }, buddha: { lid: 0.64, lidAng: -0.15, pr: 0.55, look: [0, 0.7] },
    cryHappy: { type: 'arcUp', stream: true }, cry: { type: 'arcDown', stream: true }, ink: { type: 'ink' }, dot: { type: 'dot' }
  };
  function browOf(x) {
    if (x === 'none') return null;
    if (x == null) x = 'normal';
    if (typeof x === 'string') x = BROWS[x] || BROWS.normal;
    if (Array.isArray(x)) return B.apply(null, x);
    return x;
  }
  function eyeOf(x) {
    var base = {}, over = null, k;
    if (typeof x === 'string') base = EYES[x] || {};
    else if (Array.isArray(x)) { base = EYES[x[0]] || {}; over = x[1]; }
    else if (x) over = x;
    var e = E(base);
    if (over) for (k in over) e[k] = over[k];
    return e;
  }
  function specOf(r) {
    r = r || {};
    var S = {
      browL: browOf(r.b), browR: r.bR !== undefined ? browOf(r.bR) : undefined,
      eyeL: eyeOf(r.e || 'open'), eyeR: r.eR ? eyeOf(r.eR) : null,
      mouth: r.m || 'smile', cheek: r.c == null ? 0.45 : r.c, puff: !!r.puff, tint: r.tint || null, body: r.body || 'red',
      fx: r.fx || [], acc: r.acc || [], anim: r.anim || null, st: r.st || 0, wig: !!r.wig, nose: r.nose || 'normal',
      yaw: r.yaw || 0, bubble: !!r.bubble, blind: !!r.blind
    };
    if (S.browR === undefined) S.browR = S.browL;
    if (!S.eyeR) S.eyeR = eyeOf(r.e || 'open');
    return S;
  }
  function has(arr, name) { return arr.indexOf(name) >= 0; }

  // ---- いまの14+1の気分(ゲームで使う名前) ----
  var MOOD_LABELS = {
    normal: 'ふつう', happy: 'にこにこ', laugh: '大笑い', angry: 'おこり', mean: 'いじわる', sleepy: 'ねむい',
    sad: 'なきそう', shy: 'てれ', surprised: 'びっくり', blind: '目かくし', dizzy: 'めがまわる', smug: 'ドヤ',
    suspicious: 'うたがい', oneeye: '片目(伝統)', furious: 'げきおこ'
  };
  var MOODS = Object.keys(MOOD_LABELS);
  var MOOD_RECIPES = {
    normal: {},
    happy: { b: 'happy', e: 'happy', m: 'open', c: 0.7, fx: ['notes'], anim: 'sway', st: -0.025 },
    laugh: { b: 'laugh', e: 'squeeze', m: 'big', c: 0.85, fx: ['notes', 'laughTears'], anim: 'bounce', st: -0.025, wig: true },
    angry: { b: 'angry', e: 'angry', m: 'grit', c: 0, tint: 'angry', fx: ['steam', 'vein'], anim: 'tremble', st: -0.02 },
    furious: { b: 'furious', e: 'furious', m: 'shout', c: 0, tint: 'furious', body: 'fire', fx: ['steamBig', 'veinMany'], anim: 'trembleBig', st: -0.04 },
    mean: { b: 'low', bR: 'up', e: 'mean', eR: 'meanR', m: 'smirk', c: 0.15, tint: 'mean', fx: ['sweat'] },
    sleepy: { b: 'relaxed', e: 'sleepy', m: 'yawn', c: 0.35, fx: ['zzz'], bubble: true, anim: 'doze' },
    sad: { b: 'sad', e: 'wet', m: 'sad', c: 0.25, tint: 'sad', fx: ['tears'], anim: 'trembleSmall', st: 0.02 },
    shy: { b: 'worried', e: 'shy', m: 'wavy', c: 1.2, fx: ['hearts', 'sweat'], anim: 'shy' },
    surprised: { b: 'high', e: 'tiny', m: 'O', c: 0.15, fx: ['excl', 'shock', 'sweat'] },
    blind: { b: 'blind', e: 'none', m: 'open', c: 0.55, blind: true, fx: ['question'] },
    dizzy: { b: 'dizzy', e: 'spiral', m: 'wavy', c: 0.3, fx: ['stars'], anim: 'wobble' },
    smug: { b: 'smug', e: 'smug', m: 'smug', c: 0.5, fx: ['sparkle'], anim: 'tiltUp' },
    suspicious: { b: 'flat', e: 'suspicious', m: 'flat', c: 0.15, fx: ['dots', 'sweat'] },
    oneeye: { e: 'open', eR: 'ink' }
  };

  // ---- 表情 100 こ ----
  var FACE_GROUPS = { tsuntsun: 'つんつん', dajare: 'ダジャレ', kusuguru: 'くすぐる', common: 'いつでも', rare: 'レア' };
  var FACES = [];
  function F(id, name, group, recipe) { FACES.push({ id: id, name: name, group: group, recipe: recipe }); }
  // つんつん(24) … おこるけど、たまに よろこぶ
  F('angry', 'ぷんすか', 'tsuntsun', MOOD_RECIPES.angry);
  F('furious', 'げきおこ', 'tsuntsun', MOOD_RECIPES.furious);
  F('puff', 'ほっぺぷくー', 'tsuntsun', { b: 'angry2', e: ['half', { look: [0, 0], lid: 0.42 }], m: 'puffLips', puff: true, c: 1, fx: ['text:ぷー'] });
  F('mutt', 'むっ', 'tsuntsun', { b: 'low', e: ['open', { pr: 0.4, look: [0, 0] }], m: 'frown', c: 0, fx: ['twitch', 'text:ムッ'] });
  F('girori', 'ぎろり', 'tsuntsun', { b: 'angry', e: 'glare', m: 'flat', c: 0, tint: 'mean', fx: ['text:ギロッ'] });
  F('chabudai', 'ちゃぶだい', 'tsuntsun', { b: 'furious', e: 'angry', m: 'shout', c: 0, tint: 'angry', fx: ['table', 'wiggle'], anim: 'shake' });
  F('gununu', 'ぐぬぬ', 'tsuntsun', { b: 'angry2', bR: 'sad', e: 'squeeze', m: 'bite', c: 0, tint: 'mean', fx: ['sweat', 'text:ぐぬぬ', 'twitch'], anim: 'tremble' });
  F('kora', 'こらーっ', 'tsuntsun', { b: 'furious', e: ['angry', { size: 1.12 }], m: 'shout', c: 0, tint: 'angry', fx: ['excl2', 'shock'], anim: 'jump' });
  F('bakuhatsu', 'ばくはつ', 'tsuntsun', { b: 'none', e: ['tiny', { size: 1.15, pr: 0.2 }], m: 'O', c: 0, body: 'soot', tint: 'soot', acc: ['afro'], fx: ['smoke'] });
  F('iraira', 'いらいら', 'tsuntsun', { b: 'angry', e: ['half', { lidAng: 0.4, pr: 0.4, look: [0, 0] }], m: 'zigzag', c: 0, fx: ['veinMany'] });
  F('pui', 'ぷいっ', 'tsuntsun', { b: 'flat', e: ['half', { look: [-1, 0], lid: 0.4 }], m: 'pout', c: 0.7, yaw: 0.45, anim: 'tiltL', fx: ['text:ぷいっ'] });
  F('oni', 'おにモード', 'tsuntsun', { b: 'thick', e: 'furious', m: 'fang', c: 0, tint: 'angry', acc: ['horns'] });
  F('meramera', 'めらめら', 'tsuntsun', { b: 'angry', e: 'fire', m: 'grinTeeth', c: 0.2, fx: ['flames'] });
  F('shiranpuri', 'しらんぷり', 'tsuntsun', { b: 'up', e: 'closed', m: 'whistle', c: 0.3, yaw: 0.55, anim: 'tiltL', fx: ['notes'] });
  F('itai', 'いたっ', 'tsuntsun', { b: 'sad', e: 'squeeze', m: 'wail', c: 0.4, fx: ['bump', 'stars', 'tearSmall'] });
  F('bansoukou', 'ばんそうこう', 'tsuntsun', { b: 'sad', e: 'wet', m: 'sad', c: 0.3, acc: ['bandage'], fx: ['tears'] });
  F('motto', 'もっとやって', 'tsuntsun', { b: 'happy', e: 'heart', m: 'open', c: 1, fx: ['hearts'], anim: 'sway' });
  F('tehepero', 'てへぺろ', 'tsuntsun', { b: 'happy', e: 'open', eR: 'squeeze', m: 'tongue', c: 0.8, fx: ['star1'] });
  F('manzara', 'まんざらでも', 'tsuntsun', { b: 'worried', e: ['open', { look: [-0.9, 0.3], lid: 0.3 }], m: 'ehe', c: 1.2, fx: ['sweat'] });
  F('mean', 'にやり', 'tsuntsun', MOOD_RECIPES.mean);
  F('puttsun', 'ぷっつん', 'tsuntsun', { b: 'furious', e: 'white', m: 'grit', c: 0, tint: 'angry', fx: ['vein', 'steam'], anim: 'tremble' });
  F('gaman', 'がまんがまん', 'tsuntsun', { b: 'worried', e: 'line', m: 'bite', c: 0.5, fx: ['sweatMany'], anim: 'tremble' });
  F('ijiiji', 'いじいじ', 'tsuntsun', { b: 'sad', e: 'dot', m: 'tiny', c: 0, tint: 'gloom', fx: ['gloom'] });
  F('uwaan', 'うわーん', 'tsuntsun', { b: 'sad', e: 'cry', m: 'wail', c: 0.5, anim: 'tremble' });
  // ダジャレ(22)
  F('fuita', 'ぷぷっ', 'dajare', { b: 'happy', e: 'squeeze', m: 'puffLips', puff: true, c: 0.9, fx: ['spray', 'text:ぶっ'], anim: 'shake' });
  F('samu', 'さむっ', 'dajare', { b: 'worried', e: 'dot', m: 'zigzag', c: 0, body: 'blue', tint: 'pale', fx: ['snow', 'icicle'], anim: 'tremble' });
  F('jiwajiwa', 'じわじわ', 'dajare', { b: 'worried', e: ['half', { lid: 0.45, look: [0, 0.3] }], m: 'wobbly', c: 0.7, fx: ['sweat', 'text:じわ…'], anim: 'trembleSmall' });
  F('ooke', 'まさかの大ウケ', 'dajare', { b: 'laugh', e: 'cryHappy', m: 'big', c: 1, fx: ['confetti'], anim: 'bounce', st: -0.03 });
  F('akire', 'あきれがお', 'dajare', { b: 'flat', e: ['half', { lid: 0.55, look: [0.6, -0.7] }], m: 'flat', c: 0, fx: ['sigh'] });
  F('shirome', 'しろめ', 'dajare', { b: 'high', e: 'white', m: 'O', c: 0, tint: 'pale' });
  F('nukegara', 'ぬけがら', 'dajare', { b: 'sad', e: 'line', m: 'o', c: 0, tint: 'pale', fx: ['ghost'] });
  F('shiin', 'しーん', 'dajare', { b: 'flat', e: 'dot', m: 'tiny', c: 0, tint: 'grey', fx: ['crow', 'text:シーン'] });
  F('kusu', 'くすっ', 'dajare', { b: 'relaxed', e: 'closed', m: 'omega', c: 1.2, tint: 'pink', fx: ['text:くすっ', 'sparkle'] });
  F('fuun', 'ふーん', 'dajare', { b: 'flat', bR: 'up', e: ['open', { look: [0.9, 0], pr: 0.4 }], m: 'flat', c: 0, fx: ['dots'] });
  F('zukoo', 'ずこーっ', 'dajare', { b: 'high', e: 'x', m: 'O', c: 0.2, anim: 'tiltBig', fx: ['shock'] });
  F('gaan', 'がーん', 'dajare', { b: 'sad', e: 'white', m: 'square', c: 0, tint: 'gloom', fx: ['lightning'] });
  F('zabuton', 'ざぶとん1まい', 'dajare', { b: 'happy', e: 'sparkle', m: 'grinTeeth', c: 0.8, fx: ['zabuton'] });
  F('katamatta', 'かたまった', 'dajare', { b: 'flat', e: 'dot', m: 'flat', c: 0, body: 'stone', tint: 'stone' });
  F('nigawarai', 'にがわらい', 'dajare', { b: 'worried', e: 'happy', m: 'grimace', c: 0.2, tint: 'grey', fx: ['sweatBig'] });
  F('pokaan', 'ぽかーん', 'dajare', { b: 'high', e: 'dot', m: 'yawnBig', c: 0, fx: ['butterfly'] });
  F('tooime', 'とおいめ', 'dajare', { b: 'relaxed', e: ['tiny', { look: [0.5, -0.8], pr: 0.18 }], m: 'flat', c: 0, tint: 'pale', fx: ['birds'] });
  F('mouikkai', 'もういっかい!', 'dajare', { b: 'high', e: 'big', m: 'triangle', c: 0.9, fx: ['excl'], anim: 'jump' });
  F('shirake', 'しらけー', 'dajare', { b: 'flat', e: 'line', m: 'flat', c: 0, tint: 'grey', fx: ['wind'] });
  F('gakkari', 'がっかり', 'dajare', { b: 'sad', e: ['half', { look: [0, 0.9] }], m: 'frown', c: 0, tint: 'sad', fx: ['sigh'] });
  F('futon', 'ふとんがー', 'dajare', { b: 'high', e: 'tiny', m: 'O', c: 0.3, fx: ['futon'] });
  F('osomatsu', 'おそまつさま', 'dajare', { b: 'relaxed', e: 'closed', m: 'smile', c: 0.5, anim: 'bow', fx: ['sensu', 'text:ペコ'] });
  // くすぐる(19)
  F('laugh', 'ひーひー', 'kusuguru', MOOD_RECIPES.laugh);
  F('namidawarai', 'なみだわらい', 'kusuguru', { b: 'laugh', e: 'wet', m: 'big', c: 0.9, fx: ['laughTears'], anim: 'bounce', st: -0.025 });
  F('koraegao', 'こらえがお', 'kusuguru', { b: 'worried', e: 'line', m: 'puffLips', puff: true, c: 1, tint: 'angry', anim: 'tremble', fx: ['text:ぷるぷる', 'sweatMany'] });
  F('gunyagunya', 'ぐにゃぐにゃ', 'kusuguru', { b: 'relaxed', e: 'wave', m: 'wavy', c: 0.7, body: 'green', anim: 'squash', fx: ['wiggle'] });
  F('hanachouchin', 'はなちょうちん', 'kusuguru', { b: 'laugh', e: 'crescent', m: 'grinTeeth', c: 0.8, bubble: true, body: 'blue' });
  F('koshokosho', 'こしょこしょ', 'kusuguru', { b: 'worried', e: 'squeeze', m: 'ehe', c: 1.2, fx: ['feather', 'text:こしょ'] });
  F('yamete', 'やめてー', 'kusuguru', { b: 'sad', e: 'wet', m: 'wail', c: 0.8, fx: ['sweatMany', 'wiggle'], anim: 'shake' });
  F('waraisugi', 'わらいすぎ', 'kusuguru', { b: 'laugh', e: 'squeeze', m: 'big', c: 1.2, tint: 'pink', body: 'pink', fx: ['snot', 'laughTears', 'text:ヒーッ'], anim: 'roll' });
  F('korokoro', 'ころころ', 'kusuguru', { b: 'laugh', e: 'crescent', m: 'big', c: 0.8, body: 'yellow', anim: 'roll', fx: ['text:コロコロ'] });
  F('uhyahya', 'うひゃひゃ', 'kusuguru', { b: 'laugh', bR: 'up', e: 'squeeze', eR: ['tiny', { size: 1.25 }], m: 'grinTeeth', c: 0.8, fx: ['notes'], anim: 'bounce' });
  F('torokegao', 'とろけがお', 'kusuguru', { b: 'relaxed', e: 'wave', m: 'drool', c: 1.1, tint: 'pink', anim: 'squash', fx: ['hearts', 'onsen'] });
  F('moudame', 'もうだめ…', 'kusuguru', { b: 'sad', e: 'x', m: 'tongueLoose', c: 0.3, tint: 'pale', fx: ['sweatMany'] });
  F('pikupiku', 'ぴくぴく', 'kusuguru', { b: 'worried', bR: 'up', e: 'tiny', eR: 'squeeze', m: 'zigzag', c: 0.5, body: 'purple', fx: ['twitch', 'sweatBig'], anim: 'twitch' });
  F('geragera', 'げらげら', 'kusuguru', { b: 'laugh', e: 'cryHappy', m: 'shout', c: 1, fx: ['text:ゲラゲラ'], anim: 'bounce' });
  F('maitta', 'まいった', 'kusuguru', { b: 'sad', e: 'dot', m: 'wavy', c: 0.6, fx: ['whiteFlag', 'sweatBig'] });
  F('nyanko', 'にゃんこ', 'kusuguru', { b: 'relaxed', e: 'happy', m: 'omega', c: 0.7, acc: ['catEars'], fx: ['text:にゃ'] });
  F('shakkuri', 'しゃっくり', 'kusuguru', { b: 'high', e: ['tiny', { size: 1.05 }], m: 'o', c: 0.4, fx: ['text:ヒック'], anim: 'jump' });
  F('shikaeshi', 'しかえしだ', 'kusuguru', { b: 'angry2', e: 'happy', m: 'grinTeeth', c: 0, body: 'black', fx: ['sparkle'] });
  F('dizzy', 'めがまわる', 'kusuguru', MOOD_RECIPES.dizzy);
  // いつでも(27)
  F('normal', 'ふつう', 'common', MOOD_RECIPES.normal);
  F('happy', 'にこにこ', 'common', MOOD_RECIPES.happy);
  F('sleepy', 'ねむねむ', 'common', MOOD_RECIPES.sleepy);
  F('sad', 'なきそう', 'common', MOOD_RECIPES.sad);
  F('shy', 'てれてれ', 'common', MOOD_RECIPES.shy);
  F('surprised', 'びっくり', 'common', MOOD_RECIPES.surprised);
  F('blind', 'めかくし', 'common', MOOD_RECIPES.blind);
  F('smug', 'ドヤッ', 'common', MOOD_RECIPES.smug);
  F('suspicious', 'じとー', 'common', MOOD_RECIPES.suspicious);
  F('kyoton', 'きょとん', 'common', { b: 'high', e: 'dot', m: 'tiny', c: 0.5, fx: ['q1'] });
  F('mitore', 'みとれ', 'common', { b: 'happy', e: 'sparkle', m: 'o', c: 0.9, fx: ['sparkle'] });
  F('hirameki', 'ひらめいた', 'common', { b: 'high', e: ['open', { look: [0.3, -0.9] }], m: 'open', c: 0.5, fx: ['bulb'] });
  F('uttori', 'うっとり', 'common', { b: 'relaxed', e: 'heart', m: 'o', c: 1, fx: ['flowers'] });
  F('kangae', 'かんがえちゅう', 'common', { b: 'flat', bR: 'up', e: ['open', { look: [0.7, -0.7] }], m: 'pout', c: 0.3, fx: ['think'] });
  F('harapeko', 'はらぺこ', 'common', { b: 'worried', e: 'wet', m: 'drool', c: 0.4, fx: ['riceball'] });
  F('hakushon', 'はっくしょん', 'common', { b: 'high', e: 'squeeze', m: 'O', c: 0.6, nose: 'red', fx: ['spray', 'snot', 'text:ハクション'], anim: 'jump' });
  F('akubi', 'ふわぁ', 'common', { b: 'relaxed', e: 'line', m: 'yawnBig', c: 0.4, acc: ['nightcap'], fx: ['tearSmall'] });
  F('pachi', 'ぱちっ', 'common', { b: 'happy', e: 'open', eR: 'happy', m: 'smile', c: 0.6, fx: ['star1'] });
  F('kimatta', 'きまった!', 'common', { b: 'up', e: 'open', m: 'smug', c: 0.3, acc: ['sunglasses'], fx: ['sparkle'] });
  F('megane', 'めがねさん', 'common', { b: 'normal', e: ['open', { size: 0.9, look: [0, 0] }], m: 'ehe', c: 0.4, acc: ['glasses'] });
  F('yaruki', 'やるき!', 'common', { b: 'angry', e: ['open', { pr: 0.55, look: [0, 0] }], m: 'grinTeeth', c: 0.5, acc: ['hachimaki'], fx: ['text:よし!'] });
  F('buruburu', 'ぶるぶる', 'common', { b: 'sad', e: 'tiny', m: 'zigzag', c: 0, tint: 'pale', fx: ['sweatMany'], anim: 'trembleBig' });
  F('onsen', 'いいゆだな', 'common', { b: 'relaxed', e: 'closed', m: 'smile', c: 1, acc: ['towel'], fx: ['onsen'] });
  F('osumashi', 'おすまし', 'common', { b: 'high', e: 'closed', m: 'tiny', c: 0.6, body: 'purple', acc: ['flower'] });
  F('chuu', 'ちゅー', 'common', { b: 'happy', e: 'closed', m: 'kiss', c: 1, body: 'pink', fx: ['hearts'] });
  F('gege', 'げげっ', 'common', { b: 'worried', e: ['open', { pr: 0.3 }], m: 'grimace', c: 0, tint: 'green', fx: ['sweat'] });
  F('suppa', 'すっぱー', 'common', { b: 'worried', e: 'squeeze', m: 'pucker', c: 0, tint: 'yellow', fx: ['lemon'] });
  // レア(8)
  F('kinpika', 'きんぴかだるま', 'rare', { b: 'happy', e: 'happy', m: 'open', c: 0.6, body: 'gold', tint: 'gold', fx: ['aura', 'sparkleBig'] });
  F('hoshime', 'ほしのおめめ', 'rare', { b: 'high', e: 'star', m: 'open', c: 0.9, fx: ['sparkleBig'], anim: 'jump' });
  F('hotoke', 'ほとけさま', 'rare', { b: 'relaxed', e: 'buddha', m: 'smile', c: 0.3, acc: ['urna'], fx: ['halo'] });
  F('gekiga', 'げきがタッチ', 'rare', { b: 'gekiga', e: 'gekiga', m: 'gekiga', c: 0, tint: 'gekiga', fx: ['dododo'] });
  F('hengao', 'へんがおめいじん', 'rare', { b: 'up', bR: 'sad', e: ['big', { size: 1.35, look: [0.6, 0.4] }], eR: ['tiny', { size: 0.7 }], m: 'tongue', nose: 'red', c: 0.8 });
  F('oneeye', 'かためいり', 'rare', MOOD_RECIPES.oneeye);
  F('shirodaruma', 'しろだるま', 'rare', { b: 'normal', e: 'open', m: 'smile', c: 0.5, body: 'white', fx: ['sparkle'] });
  F('niji', 'にじいろだるま', 'rare', { b: 'happy', e: 'happy', m: 'open', c: 0.6, body: 'rainbow', fx: ['auraRainbow'] });
  var FACE_BY_ID = {};
  FACES.forEach(function (f) { FACE_BY_ID[f.id] = f; });

  // ---- 部品: 眉(s=-1 見て左, +1 見て右) ----
  function drawBrow(ctx, P, b, s) {
    if (!b) return;
    var mu = s * (b.iu + b.ou) / 2, mv = (b.iv + b.ov) / 2;
    feat(ctx, P, mu, mv, function () {
      var p0 = [s * b.iu - mu, b.iv - mv], p3 = [s * b.ou - mu, b.ov - mv];
      var dx = p3[0] - p0[0], dy = p3[1] - p0[1];
      var p1 = [p0[0] + dx * 0.33, p0[1] + dy * 0.33 - b.arch];
      var p2 = [p0[0] + dx * 0.7, p0[1] + dy * 0.7 - b.arch * 0.9];
      ctx.fillStyle = INK;
      brush(ctx, p0, p1, p2, p3, b.w, b.w * 0.18, b.w * 0.35);
      var tip = bez(p0, p1, p2, p3, 0.86);
      brush(ctx, tip, [tip[0] + s * 0.03, tip[1] - 0.01], [tip[0] + s * 0.06, tip[1] - 0.03], [tip[0] + s * 0.07, tip[1] - 0.07], 0.035, 0.005, 0);
    }, 0, 0.08);
  }

  // ---- 部品: 目 ----
  function drawEye(ctx, P, e, s, t, blink, faceColor, lookAdd) {
    if (e.type === 'none') return;
    feat(ctx, P, s * EYE.u, EYE.v, function () {
      var r = EYE.r * e.size, i;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = INK;
      switch (e.type) {
        case 'arcUp':           // にこっ(^ ^)
          ctx.lineWidth = 0.065;
          ctx.beginPath(); ctx.moveTo(-r * 0.95, r * 0.35); ctx.quadraticCurveTo(0, -r * 1.05, r * 0.95, r * 0.35); ctx.stroke();
          return;
        case 'crescent':        // 塗りつぶしの にこっ目(◠)
          ctx.fillStyle = INK;
          ctx.beginPath(); ctx.moveTo(-r * 1.05, r * 0.35); ctx.quadraticCurveTo(0, -r * 1.35, r * 1.05, r * 0.35); ctx.quadraticCurveTo(0, -r * 0.45, -r * 1.05, r * 0.35); ctx.fill();
          return;
        case 'arcDown':         // すやっ(U U)
          ctx.lineWidth = 0.06;
          ctx.beginPath(); ctx.moveTo(-r, -r * 0.1); ctx.quadraticCurveTo(0, r * 0.75, r, -r * 0.1); ctx.stroke();
          return;
        case 'squeeze':         // > <
          ctx.lineWidth = 0.07;
          ctx.beginPath(); ctx.moveTo(s * r * 0.8, -r * 0.75); ctx.lineTo(-s * r * 0.75, 0); ctx.lineTo(s * r * 0.8, r * 0.75); ctx.stroke();
          return;
        case 'line':            // ぎゅっ(ー ー)
          ctx.lineWidth = 0.07;
          ctx.beginPath(); ctx.moveTo(-r * 1.05, 0); ctx.quadraticCurveTo(0, r * 0.12, r * 1.05, 0); ctx.stroke();
          return;
        case 'x':               // × ×
          ctx.lineWidth = 0.065;
          ctx.beginPath(); ctx.moveTo(-r * 0.75, -r * 0.75); ctx.lineTo(r * 0.75, r * 0.75); ctx.moveTo(r * 0.75, -r * 0.75); ctx.lineTo(-r * 0.75, r * 0.75); ctx.stroke();
          return;
        case 'wave':            // ~ ~
          ctx.lineWidth = 0.055;
          ctx.beginPath();
          for (i = 0; i <= 16; i++) { var wx = -r * 1.05 + r * 2.1 * i / 16, wy = Math.sin(i / 16 * TAU * 1.5 + t * 6) * r * 0.28; if (i) ctx.lineTo(wx, wy); else ctx.moveTo(wx, wy); }
          ctx.stroke();
          return;
        case 'dot':             // ・ ・(きょとん)
          ctx.fillStyle = INK;
          ctx.beginPath(); ctx.ellipse(0, r * 0.05, r * 0.36, r * 0.46, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.arc(-r * 0.1, -r * 0.14, r * 0.12, 0, TAU); ctx.fill();
          return;
        case 'star': {          // ★
          var sp = 1 + 0.08 * Math.sin(t * 8);
          var sg = ctx.createRadialGradient(-r * 0.2, -r * 0.3, 0, 0, 0, r * 1.2);
          sg.addColorStop(0, '#fffbd0'); sg.addColorStop(0.5, '#ffd23a'); sg.addColorStop(1, '#f08a00');
          ctx.fillStyle = sg; star(ctx, 0, r * 0.08, r * 1.25 * sp, 5, 0.48, 0); ctx.fill();
          ctx.lineWidth = 0.03; ctx.stroke();
          ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(-r * 0.22, -r * 0.2, r * 0.16, 0, TAU); ctx.fill();
          return;
        }
        case 'heart': {         // ♥
          var hp = 1 + 0.1 * Math.abs(Math.sin(t * 6));
          ctx.fillStyle = '#ff3d7f'; heart(ctx, 0, r * 0.42 * hp, r * 1.25 * hp); ctx.fill();
          ctx.lineWidth = 0.03; ctx.stroke();
          ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(-r * 0.4, -r * 0.35, r * 0.16, r * 0.11, -0.6, 0, TAU); ctx.fill();
          return;
        }
      }
      // 白目
      ctx.beginPath(); ctx.ellipse(0, 0, r, r * 1.04, 0, 0, TAU);
      if (e.glow) {
        var gg = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        gg.addColorStop(0, '#ffffff'); gg.addColorStop(0.55, '#fff59a'); gg.addColorStop(1, '#ffb21e');
        ctx.save(); ctx.shadowColor = 'rgba(255,225,60,0.95)'; ctx.shadowBlur = P.R * 0.35;
        ctx.fillStyle = gg; ctx.fill(); ctx.restore();
      } else { ctx.fillStyle = '#ffffff'; ctx.fill(); }
      if (e.type === 'blank') {           // 白目だけ
        ctx.lineWidth = 0.04; ctx.strokeStyle = INK; ctx.stroke();
        return;
      }
      if (e.type === 'ink') {             // 筆で入れた 伝統の黒目
        ctx.lineWidth = 0.04; ctx.stroke();
        ctx.fillStyle = '#111111';
        ctx.beginPath();
        for (i = 0; i <= 18; i++) {
          var a = i / 18 * TAU, rr = r * (0.62 + 0.06 * Math.sin(a * 3 + 1) + 0.03 * Math.sin(a * 7));
          if (i) ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr + r * 0.04); else ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr + r * 0.04);
        }
        ctx.closePath(); ctx.fill();
        brush(ctx, [r * 0.3, -r * 0.45], [r * 0.5, -r * 0.6], [r * 0.6, -r * 0.7], [r * 0.75, -r * 0.8], 0.05, 0.01, 0);
        return;
      }
      if (e.type === 'spiral') {          // ぐるぐる目
        ctx.save();
        ctx.clip();
        ctx.rotate(t * 7 * s);
        ctx.strokeStyle = INK; ctx.lineWidth = 0.032;
        ctx.beginPath();
        for (i = 0; i <= 60; i++) {
          var sa = i / 60 * TAU * 2.6, sr = r * 0.92 * i / 60;
          if (i) ctx.lineTo(Math.cos(sa) * sr, Math.sin(sa) * sr); else ctx.moveTo(0, 0);
        }
        ctx.stroke();
        ctx.restore();
        ctx.beginPath(); ctx.ellipse(0, 0, r, r * 1.04, 0, 0, TAU);
        ctx.lineWidth = 0.035; ctx.strokeStyle = INK; ctx.stroke();
        return;
      }
      var lid = e.lid + (e.sway ? 0.14 * Math.sin(t * 1.3) : 0);
      lid = Math.max(lid, 1 - blink);
      if (lid > 0.9) {                    // 閉じた目(まばたき)
        ctx.fillStyle = faceColor;
        ctx.beginPath(); ctx.ellipse(0, 0, r * 1.06, r * 1.1, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = INK; ctx.lineWidth = 0.05;
        ctx.beginPath(); ctx.moveTo(-r, r * 0.05); ctx.quadraticCurveTo(0, r * 0.6, r, r * 0.05); ctx.stroke();
        return;
      }
      ctx.save();
      ctx.beginPath(); ctx.ellipse(0, 0, r, r * 1.04, 0, 0, TAU); ctx.clip();
      if (e.wet) {
        ctx.fillStyle = 'rgba(120,190,255,0.45)';
        ctx.beginPath(); ctx.ellipse(0, r * 0.95, r * 1.1, r * 0.45, 0, 0, TAU); ctx.fill();
      }
      var lx = clamp(e.look[0] + lookAdd[0], -1, 1), ly = clamp(e.look[1] + lookAdd[1], -1, 1);
      var pr = r * e.pr, px = lx * (r - pr) * 0.9, py = ly * (r - pr) * 0.9;
      if (e.fire) {                       // 目の中が炎
        var fl = 1 + 0.1 * Math.sin(t * 22);
        var fgr = ctx.createLinearGradient(0, r, 0, -r);
        fgr.addColorStop(0, '#d61a0a'); fgr.addColorStop(0.5, '#ff7a12'); fgr.addColorStop(1, '#ffe04a');
        ctx.fillStyle = fgr;
        ctx.beginPath(); ctx.moveTo(0, r * 0.85);
        ctx.bezierCurveTo(r * 0.85, r * 0.6, r * 0.5, -r * 0.3 * fl, r * 0.1, -r * 0.95 * fl);
        ctx.bezierCurveTo(-r * 0.05, -r * 0.45, -r * 0.35, -r * 0.5 * fl, -r * 0.4, -r * 0.7 * fl);
        ctx.bezierCurveTo(-r * 0.9, -r * 0.1, -r * 0.7, r * 0.6, 0, r * 0.85);
        ctx.fill();
        ctx.fillStyle = '#fff6a8';
        ctx.beginPath(); ctx.ellipse(0, r * 0.4, r * 0.25, r * 0.38 * fl, 0, 0, TAU); ctx.fill();
      } else if (!e.glow) {
        ctx.fillStyle = INK;
        ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU); ctx.fill();
        if (!e.gek) {
          ctx.fillStyle = '#4a2a1a';
          ctx.beginPath(); ctx.arc(px, py + pr * 0.25, pr * 0.62, 0, TAU); ctx.fill();
          ctx.fillStyle = INK;
          ctx.beginPath(); ctx.arc(px, py, pr * 0.42, 0, TAU); ctx.fill();
        }
        ctx.fillStyle = '#ffffff';
        var hl = e.wet ? 1.35 : 1;
        ctx.beginPath(); ctx.arc(px - pr * 0.36, py - pr * 0.4, pr * 0.34 * hl, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(px + pr * 0.38, py + pr * 0.34, pr * 0.15 * hl, 0, TAU); ctx.fill();
        if (e.wet) { ctx.beginPath(); ctx.arc(px + pr * 0.1, py - pr * 0.62, pr * 0.1, 0, TAU); ctx.fill(); }
        if (e.sparkle) {
          var tw = 0.75 + 0.25 * Math.sin(t * 7);
          sparkle(ctx, px + pr * 0.35, py - pr * 0.3, pr * 0.42 * tw, '#ffffff');
          ctx.fillStyle = 'rgba(255,170,220,0.9)';
          star(ctx, px - pr * 0.25, py + pr * 0.42, pr * 0.2, 5, 0.5, 0); ctx.fill();
        }
      }
      // 上まぶた
      if (lid > 0.01) {
        var k = -s * Math.tan(e.lidAng), y0 = -r * 1.04 + 2 * r * 1.04 * lid;
        ctx.fillStyle = faceColor;
        ctx.beginPath();
        ctx.moveTo(-r * 1.2, y0 - k * r * 1.2); ctx.lineTo(r * 1.2, y0 + k * r * 1.2);
        ctx.lineTo(r * 1.2, -r * 1.4); ctx.lineTo(-r * 1.2, -r * 1.4); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = INK; ctx.lineWidth = e.gek ? 0.07 : 0.05;
        ctx.beginPath(); ctx.moveTo(-r * 1.2, y0 - k * r * 1.2); ctx.lineTo(r * 1.2, y0 + k * r * 1.2); ctx.stroke();
      }
      // 下まぶた
      if (e.low > 0.01) {
        var y1 = r * 1.04 - 2 * r * 1.04 * e.low;
        ctx.fillStyle = faceColor;
        ctx.beginPath(); ctx.moveTo(-r * 1.2, y1 + r * 0.12); ctx.quadraticCurveTo(0, y1 - r * 0.12, r * 1.2, y1 + r * 0.12);
        ctx.lineTo(r * 1.2, r * 1.4); ctx.lineTo(-r * 1.2, r * 1.4); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = INK; ctx.lineWidth = 0.035;
        ctx.beginPath(); ctx.moveTo(-r * 1.2, y1 + r * 0.12); ctx.quadraticCurveTo(0, y1 - r * 0.12, r * 1.2, y1 + r * 0.12); ctx.stroke();
      }
      ctx.restore();
      ctx.beginPath(); ctx.ellipse(0, 0, r, r * 1.04, 0, 0, TAU);
      ctx.lineWidth = e.gek ? 0.06 : 0.04; ctx.strokeStyle = INK; ctx.stroke();
      if (e.gek) {                        // 劇画の影線
        ctx.lineWidth = 0.022;
        ctx.beginPath();
        for (i = 0; i < 4; i++) { ctx.moveTo(-r * 0.8 + i * r * 0.45, r * 1.25); ctx.lineTo(-r * 0.6 + i * r * 0.45, r * 1.6); }
        ctx.stroke();
      }
      // まつげ
      if (lid < 0.4 && !e.wet && !e.gek && !e.glow) {
        ctx.lineWidth = 0.03;
        ctx.beginPath();
        ctx.moveTo(s * r * 0.82, -r * 0.62); ctx.lineTo(s * r * 1.08, -r * 0.86);
        ctx.moveTo(s * r * 0.98, -r * 0.3); ctx.lineTo(s * r * 1.26, -r * 0.4);
        ctx.stroke();
      }
    }, 0, 0.06);
  }

  // ---- 部品: 口 ----
  var CLOSED_MOUTHS = { smile: 1, wavy: 1, flat: 1, omega: 1, frown: 1, ehe: 1, tiny: 1, pout: 1, puffLips: 1, smileBig: 1,
    fang: 1, gekiga: 1, whistle: 1, kiss: 1, pucker: 1, bite: 1, zigzag: 1, wobbly: 1 };
  function drawMouth(ctx, P, type, t) {
    feat(ctx, P, 0, MOUTH_V, function () {
      ctx.scale(MS, MS);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = INK; ctx.lineWidth = 0.038;
      var inside = '#9b2228', tongue = '#ff8a92', i;
      function dMouth(w, d, teeth) {
        function pth() {
          ctx.beginPath();
          ctx.moveTo(-w, -0.02); ctx.quadraticCurveTo(0, 0.01, w, -0.02);
          ctx.bezierCurveTo(w * 0.9, d * 0.9, -w * 0.9, d * 0.9, -w, -0.02);
          ctx.closePath();
        }
        pth(); ctx.fillStyle = inside; ctx.fill();
        ctx.save(); ctx.clip();
        ctx.fillStyle = tongue;
        ctx.beginPath(); ctx.ellipse(0, d * 0.8, w * 0.6, d * 0.36, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-w, -0.04, w * 2, teeth || 0.045);
        if (teeth) {
          ctx.lineWidth = 0.016;
          ctx.beginPath();
          for (i = -3; i <= 3; i++) { ctx.moveTo(i * w / 3.5, -0.04); ctx.lineTo(i * w / 3.5, -0.04 + teeth); }
          ctx.moveTo(-w, -0.04 + teeth); ctx.lineTo(w, -0.04 + teeth);
          ctx.stroke();
        }
        ctx.restore();
        ctx.lineWidth = 0.038; pth(); ctx.stroke();
      }
      function oval(x, y, rx, ry, tg) {
        ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
        ctx.fillStyle = inside; ctx.fill();
        if (tg) {
          ctx.save(); ctx.clip(); ctx.fillStyle = tongue;
          ctx.beginPath(); ctx.ellipse(x, y + ry * 0.8, rx * 0.75, ry * 0.4, 0, 0, TAU); ctx.fill(); ctx.restore();
          ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
        }
        ctx.stroke();
      }
      switch (type) {
        case 'open': dMouth(0.11, 0.14); break;
        case 'big': dMouth(0.16, 0.2 + 0.03 * Math.sin(t * 24)); break;
        case 'grinTeeth': dMouth(0.17, 0.14, 0.075); break;
        case 'triangle':
          ctx.beginPath(); ctx.moveTo(-0.1, -0.03); ctx.lineTo(0.1, -0.03); ctx.lineTo(0, 0.13); ctx.closePath();
          ctx.fillStyle = inside; ctx.fill();
          ctx.save(); ctx.clip(); ctx.fillStyle = tongue; ctx.beginPath(); ctx.ellipse(0, 0.11, 0.05, 0.04, 0, 0, TAU); ctx.fill(); ctx.restore();
          ctx.beginPath(); ctx.moveTo(-0.1, -0.03); ctx.lineTo(0.1, -0.03); ctx.lineTo(0, 0.13); ctx.closePath(); ctx.stroke();
          break;
        case 'grit': {
          var gp = function () {
            ctx.beginPath();
            ctx.moveTo(-0.15, 0.06);
            ctx.bezierCurveTo(-0.1, -0.06, 0.1, -0.06, 0.15, 0.06);
            ctx.bezierCurveTo(0.07, 0.1, -0.07, 0.1, -0.15, 0.06);
            ctx.closePath();
          };
          gp(); ctx.fillStyle = '#ffffff'; ctx.fill();
          ctx.save(); ctx.clip();
          ctx.lineWidth = 0.022;
          ctx.beginPath();
          ctx.moveTo(-0.16, 0.035); ctx.quadraticCurveTo(0, 0.0, 0.16, 0.035);
          for (i = -2; i <= 2; i++) { ctx.moveTo(i * 0.055, -0.06); ctx.lineTo(i * 0.055, 0.12); }
          ctx.stroke();
          ctx.restore();
          ctx.lineWidth = 0.038; gp(); ctx.stroke();
          break;
        }
        case 'grimace': {   // げっ: 横長に歯を食いしばる
          var gm = function () {
            ctx.beginPath(); ctx.moveTo(-0.17, 0.05); ctx.quadraticCurveTo(-0.16, -0.03, -0.1, -0.03); ctx.lineTo(0.1, -0.03);
            ctx.quadraticCurveTo(0.16, -0.03, 0.17, 0.05); ctx.quadraticCurveTo(0, 0.05, -0.17, 0.05); ctx.closePath();
          };
          gm(); ctx.fillStyle = '#ffffff'; ctx.fill();
          ctx.save(); ctx.clip(); ctx.lineWidth = 0.018; ctx.beginPath();
          ctx.moveTo(-0.17, 0.012); ctx.lineTo(0.17, 0.012);
          for (i = -4; i <= 4; i++) { ctx.moveTo(i * 0.035, -0.04); ctx.lineTo(i * 0.035, 0.06); }
          ctx.stroke(); ctx.restore();
          ctx.lineWidth = 0.035; gm(); ctx.stroke();
          break;
        }
        case 'shout': {     // さけぶ: 上下の歯つき
          var sh = function () {
            ctx.beginPath(); ctx.moveTo(-0.13, -0.05); ctx.lineTo(0.13, -0.05);
            ctx.quadraticCurveTo(0.17, 0.15, 0.0, 0.18); ctx.quadraticCurveTo(-0.17, 0.15, -0.13, -0.05); ctx.closePath();
          };
          sh(); ctx.fillStyle = inside; ctx.fill();
          ctx.save(); ctx.clip();
          ctx.fillStyle = tongue; ctx.beginPath(); ctx.ellipse(0, 0.17, 0.08, 0.05, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.moveTo(-0.15, -0.06);
          for (i = 0; i <= 6; i++) { ctx.lineTo(-0.15 + i * 0.05, -0.06 + (i % 2 ? 0.05 : 0.025)); }
          ctx.lineTo(0.16, -0.06); ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.moveTo(-0.12, 0.2); ctx.lineTo(-0.08, 0.12); ctx.lineTo(-0.04, 0.2); ctx.moveTo(0.04, 0.2); ctx.lineTo(0.08, 0.12); ctx.lineTo(0.12, 0.2); ctx.fill();
          ctx.restore();
          sh(); ctx.stroke();
          break;
        }
        case 'square':      // がーん: 四角い口
          ctx.save(); rrect(ctx, -0.12, -0.05, 0.24, 0.14, 0.03); ctx.fillStyle = inside; ctx.fill(); ctx.clip();
          ctx.fillStyle = '#ffffff'; ctx.fillRect(-0.13, -0.06, 0.26, 0.05); ctx.fillRect(-0.13, 0.055, 0.26, 0.04);
          ctx.lineWidth = 0.015; ctx.beginPath();
          for (i = -3; i <= 3; i++) { ctx.moveTo(i * 0.035, -0.06); ctx.lineTo(i * 0.035, -0.01); ctx.moveTo(i * 0.035, 0.055); ctx.lineTo(i * 0.035, 0.1); }
          ctx.stroke(); ctx.restore();
          rrect(ctx, -0.12, -0.05, 0.24, 0.14, 0.03); ctx.stroke();
          break;
        case 'smirk': {
          var sm = function () {
            ctx.beginPath();
            ctx.moveTo(-0.13, 0.03);
            ctx.quadraticCurveTo(0.0, 0.05, 0.15, -0.07);
            ctx.quadraticCurveTo(0.06, 0.13, -0.13, 0.03);
            ctx.closePath();
          };
          sm(); ctx.fillStyle = inside; ctx.fill();
          ctx.save(); ctx.clip();
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.moveTo(-0.14, 0.02); ctx.quadraticCurveTo(0.0, 0.045, 0.16, -0.08); ctx.lineTo(0.16, 0.0); ctx.quadraticCurveTo(0.0, 0.09, -0.14, 0.05); ctx.closePath(); ctx.fill();
          ctx.lineWidth = 0.015;
          for (i = -2; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * 0.045, -0.1); ctx.lineTo(i * 0.045 + 0.01, 0.08); ctx.stroke(); }
          ctx.restore();
          ctx.lineWidth = 0.035; sm(); ctx.stroke();
          ctx.lineWidth = 0.025;
          ctx.beginPath(); ctx.moveTo(0.14, -0.12); ctx.quadraticCurveTo(0.2, -0.08, 0.17, -0.03); ctx.stroke();
          break;
        }
        case 'yawn': {
          var ph = fract(t / 4.2), op = ph < 0.35 ? Math.sin(ph / 0.35 * PI) : 0;
          oval(0, 0.02 + (0.045 + 0.08 * op) * 0.3, 0.05 + 0.04 * op, 0.045 + 0.08 * op, false);
          break;
        }
        case 'yawnBig': oval(0, 0.07, 0.09, 0.13, true); break;
        case 'O': oval(0, 0.045, 0.08, 0.105, true); break;
        case 'o': oval(0, 0.03, 0.045, 0.055, false); break;
        case 'whistle':
          ctx.lineWidth = 0.04; oval(0.03, 0.015, 0.032, 0.032, false);
          break;
        case 'drool': {
          oval(0, 0.025, 0.06, 0.05, false);
          var dl = 0.04 + 0.03 * Math.sin(t * 2);
          ctx.strokeStyle = 'rgba(120,190,255,0.95)'; ctx.lineWidth = 0.022;
          ctx.beginPath(); ctx.moveTo(0.05, 0.05); ctx.lineTo(0.06, 0.06 + dl); ctx.stroke();
          ctx.fillStyle = 'rgba(150,210,255,0.95)'; ctx.strokeStyle = '#2f78c4'; ctx.lineWidth = 0.012;
          drop(ctx, 0.06, 0.08 + dl, 0.03); ctx.fill(); ctx.stroke();
          break;
        }
        case 'tongue':      // てへぺろ
          ctx.beginPath(); ctx.moveTo(-0.11, -0.02); ctx.quadraticCurveTo(0, 0.07, 0.11, -0.02); ctx.stroke();
          ctx.fillStyle = tongue; ctx.lineWidth = 0.025;
          ctx.beginPath(); ctx.moveTo(0.0, 0.025); ctx.quadraticCurveTo(-0.005, 0.13, 0.05, 0.13); ctx.quadraticCurveTo(0.1, 0.13, 0.09, 0.015); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.lineWidth = 0.014; ctx.beginPath(); ctx.moveTo(0.045, 0.04); ctx.lineTo(0.048, 0.095); ctx.stroke();
          break;
        case 'tongueLoose': // ぐったり、舌がでろーん
          oval(0, 0.02, 0.07, 0.05, false);
          ctx.fillStyle = tongue; ctx.lineWidth = 0.022;
          ctx.beginPath(); ctx.moveTo(-0.03, 0.04); ctx.quadraticCurveTo(-0.02, 0.2, 0.05, 0.22); ctx.quadraticCurveTo(0.1, 0.2, 0.04, 0.04); ctx.closePath(); ctx.fill(); ctx.stroke();
          break;
        case 'pout':        // むすっ(すぼめた口)
          ctx.beginPath(); ctx.ellipse(0, 0.02, 0.045, 0.03, 0, 0, TAU); ctx.fillStyle = '#e0606a'; ctx.fill(); ctx.lineWidth = 0.03; ctx.stroke();
          ctx.lineWidth = 0.018; ctx.beginPath(); ctx.moveTo(-0.075, 0.005); ctx.lineTo(-0.06, 0.02); ctx.moveTo(0.075, 0.005); ctx.lineTo(0.06, 0.02); ctx.stroke();
          break;
        case 'kiss':        // ちゅー(3の口)
          ctx.lineWidth = 0.04; ctx.strokeStyle = '#c0283a';
          ctx.beginPath(); ctx.moveTo(-0.035, -0.06); ctx.quadraticCurveTo(0.08, -0.06, 0.0, 0.0); ctx.quadraticCurveTo(0.08, 0.06, -0.035, 0.06); ctx.stroke();
          break;
        case 'pucker':      // すっぱい(しわしわ)
          ctx.beginPath(); ctx.arc(0, 0.02, 0.03, 0, TAU); ctx.fillStyle = inside; ctx.fill(); ctx.lineWidth = 0.03; ctx.stroke();
          ctx.lineWidth = 0.016; ctx.beginPath();
          for (i = 0; i < 8; i++) { var pa = i / 8 * TAU; ctx.moveTo(Math.cos(pa) * 0.045, 0.02 + Math.sin(pa) * 0.045); ctx.lineTo(Math.cos(pa) * 0.075, 0.02 + Math.sin(pa) * 0.075); }
          ctx.stroke();
          break;
        case 'puffLips':    // ぷくー(口をぎゅっと)
          ctx.lineWidth = 0.04; ctx.beginPath(); ctx.moveTo(-0.05, 0.02); ctx.quadraticCurveTo(0, 0.035, 0.05, 0.02); ctx.stroke();
          ctx.lineWidth = 0.018; ctx.beginPath(); ctx.arc(-0.065, 0.02, 0.018, -1, 1); ctx.moveTo(0.065, 0.02); ctx.arc(0.065, 0.02, 0.018, PI - 1, PI + 1); ctx.stroke();
          break;
        case 'bite': {      // ぐぬぬ(下くちびるをかむ)
          var bw = Math.sin(t * 30) * 0.004;
          ctx.beginPath(); ctx.moveTo(-0.12, 0.05); ctx.quadraticCurveTo(-0.06, 0.0 + bw, 0, 0.03); ctx.quadraticCurveTo(0.06, 0.0 - bw, 0.12, 0.05); ctx.stroke();
          ctx.fillStyle = '#ffffff'; ctx.lineWidth = 0.018;
          ctx.fillRect(-0.04, 0.0, 0.038, 0.04); ctx.strokeRect(-0.04, 0.0, 0.038, 0.04);
          ctx.fillRect(0.002, 0.0, 0.038, 0.04); ctx.strokeRect(0.002, 0.0, 0.038, 0.04);
          break;
        }
        case 'zigzag':      // ガタガタ
          ctx.beginPath();
          for (i = 0; i <= 8; i++) { var zx = -0.13 + i * 0.0325, zy = (i % 2 ? -0.025 : 0.03) + Math.sin(t * 40 + i) * 0.004; if (i) ctx.lineTo(zx, zy); else ctx.moveTo(zx, zy); }
          ctx.stroke();
          break;
        case 'wail': {      // うわーん(大きな への字)
          var wl = Math.sin(t * 30) * 0.006;
          var wp = function () {
            ctx.beginPath(); ctx.moveTo(-0.16, 0.13); ctx.quadraticCurveTo(-0.14, -0.06 + wl, 0, -0.06); ctx.quadraticCurveTo(0.14, -0.06 - wl, 0.16, 0.13);
            ctx.quadraticCurveTo(0, 0.09, -0.16, 0.13); ctx.closePath();
          };
          wp(); ctx.fillStyle = inside; ctx.fill();
          ctx.save(); ctx.clip(); ctx.fillStyle = tongue; ctx.beginPath(); ctx.ellipse(0, 0.12, 0.09, 0.05, 0, 0, TAU); ctx.fill(); ctx.restore();
          wp(); ctx.stroke();
          break;
        }
        case 'sad': {
          var tr = Math.sin(t * 30) * 0.006;
          var sp = function () {
            ctx.beginPath(); ctx.moveTo(-0.11, 0.08);
            ctx.bezierCurveTo(-0.08, -0.04 + tr, 0.08, -0.04 - tr, 0.11, 0.08);
            ctx.quadraticCurveTo(0, 0.05, -0.11, 0.08); ctx.closePath();
          };
          sp(); ctx.fillStyle = inside; ctx.fill(); ctx.stroke();
          break;
        }
        case 'frown':
          ctx.beginPath(); ctx.moveTo(-0.1, 0.05); ctx.quadraticCurveTo(0, -0.04, 0.1, 0.05); ctx.stroke();
          break;
        case 'wavy': case 'wobbly': {
          var wa = type === 'wobbly' ? Math.sin(t * 25) * 0.01 : 0;
          ctx.beginPath(); ctx.moveTo(-0.11, 0.01 - (type === 'wobbly' ? 0.02 : 0));
          for (var j = 1; j <= 4; j++) {
            ctx.quadraticCurveTo(-0.11 + (j - 0.5) * 0.055, (j % 2 ? -0.035 : 0.055) + wa, -0.11 + j * 0.055, 0.01 + (type === 'wobbly' && j === 4 ? -0.02 : 0));
          }
          ctx.stroke();
          break;
        }
        case 'omega':
          ctx.beginPath(); ctx.moveTo(-0.13, -0.03);
          ctx.quadraticCurveTo(-0.07, 0.08, 0, 0.0);
          ctx.quadraticCurveTo(0.07, 0.08, 0.13, -0.03);
          ctx.stroke();
          break;
        case 'smug':
          ctx.beginPath(); ctx.moveTo(-0.15, -0.05);
          ctx.quadraticCurveTo(-0.12, 0.02, -0.06, 0.03);
          ctx.quadraticCurveTo(0, 0.045, 0.06, 0.03);
          ctx.quadraticCurveTo(0.12, 0.02, 0.15, -0.05);
          ctx.stroke();
          ctx.lineWidth = 0.025;
          ctx.beginPath(); ctx.moveTo(-0.17, -0.08); ctx.lineTo(-0.13, -0.03); ctx.moveTo(0.17, -0.08); ctx.lineTo(0.13, -0.03); ctx.stroke();
          break;
        case 'ehe':         // えへへ(はしが くるっ)
          ctx.beginPath(); ctx.moveTo(-0.13, -0.035); ctx.quadraticCurveTo(-0.13, 0.005, -0.1, 0.0);
          ctx.quadraticCurveTo(0, 0.07, 0.1, 0.0); ctx.quadraticCurveTo(0.13, 0.005, 0.13, -0.035); ctx.stroke();
          break;
        case 'fang':        // にっ(きばつき)
          ctx.beginPath(); ctx.moveTo(-0.13, -0.02); ctx.quadraticCurveTo(0, 0.07, 0.13, -0.02); ctx.stroke();
          ctx.fillStyle = '#ffffff'; ctx.lineWidth = 0.018;
          [-1, 1].forEach(function (q) {
            ctx.beginPath(); ctx.moveTo(q * 0.075, 0.02); ctx.lineTo(q * 0.04, 0.03); ctx.lineTo(q * 0.06, 0.09); ctx.closePath(); ctx.fill(); ctx.stroke();
          });
          break;
        case 'gekiga':
          ctx.lineWidth = 0.055; ctx.beginPath(); ctx.moveTo(-0.13, 0.025); ctx.lineTo(0.13, 0.015); ctx.stroke();
          ctx.lineWidth = 0.02; ctx.beginPath(); ctx.moveTo(-0.05, 0.075); ctx.lineTo(0.05, 0.075); ctx.moveTo(-0.17, 0.0); ctx.lineTo(-0.15, 0.05); ctx.moveTo(0.17, 0.0); ctx.lineTo(0.15, 0.05); ctx.stroke();
          break;
        case 'tiny':
          ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(0, 0.015, 0.024, 0.02, 0, 0, TAU); ctx.fill();
          break;
        case 'flat':
          ctx.beginPath(); ctx.moveTo(-0.08, 0.02); ctx.lineTo(0.08, 0.02); ctx.stroke();
          break;
        case 'smileBig':
          ctx.beginPath(); ctx.moveTo(-0.15, -0.04); ctx.quadraticCurveTo(0, 0.1, 0.15, -0.04); ctx.stroke();
          break;
        default: // smile
          ctx.beginPath(); ctx.moveTo(-0.1, -0.015); ctx.quadraticCurveTo(0, 0.08, 0.1, -0.015); ctx.stroke();
      }
    }, 0, 0.1);
  }

  // ---- 部品: ひげ(鼻の下の口ひげ と あごひげ) ----
  function drawMustache(ctx, P, s, S, t) {
    var lift = S.st, wig = S.wig ? Math.sin(t * 24) * 0.012 : 0;
    feat(ctx, P, s * 0.19, 0.115, function () {
      ctx.fillStyle = INK;
      var o = -s * 0.19;
      brush(ctx, [o + s * 0.035, -0.015], [o + s * 0.12, -0.06], [o + s * 0.27, 0.08 + lift],
        [o + s * 0.37, -0.04 + lift + wig], 0.085, 0.014, 0.012);
    }, 0, 0.08);
  }
  function drawBeard(ctx, P, mouth) {
    if (!CLOSED_MOUTHS[mouth]) return;
    feat(ctx, P, 0, 0.455, function () {
      ctx.fillStyle = INK;
      brush(ctx, [0, -0.035], [0.012, -0.0], [-0.012, 0.03], [0.006, 0.06], 0.05, 0.01, 0);
      brush(ctx, [-0.06, -0.04], [-0.07, -0.005], [-0.1, 0.02], [-0.13, 0.035], 0.045, 0.008, 0);
      brush(ctx, [0.06, -0.04], [0.07, -0.005], [0.1, 0.02], [0.13, 0.035], 0.045, 0.008, 0);
    }, 0, 0.12);
  }

  // ---- 背中の飾り ----
  function drawBack(ctx, P, opts) {
    var txt = opts.backText || '福';
    feat(ctx, P, 0, -0.08, function () {
      ctx.lineWidth = 0.05; ctx.strokeStyle = P.deco;
      ctx.beginPath(); ctx.arc(0, 0, 0.5, 0, TAU); ctx.stroke();
      ctx.lineWidth = 0.018; ctx.strokeStyle = P.deco2;
      ctx.beginPath(); ctx.arc(0, 0, 0.44, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 0.56, 0, TAU); ctx.stroke();
      if (P.dir < 0) ctx.scale(-1, 1); // 左から回るときも字が裏返らないように
      ctx.font = 'bold ' + (txt.length > 1 ? 0.36 : 0.58) + 'px "Hiragino Mincho ProN","Yu Mincho","Noto Serif JP","Noto Serif CJK JP",serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      var g = ctx.createLinearGradient(0, -0.35, 0, 0.35);
      if (P.deco === '#f2c53d') { g.addColorStop(0, '#fff3b0'); g.addColorStop(0.5, '#f5c542'); g.addColorStop(1, '#c48a12'); }
      else { g.addColorStop(0, P.deco); g.addColorStop(1, P.deco2); }
      ctx.lineJoin = 'round';
      for (var i = 0; i < txt.length; i++) {
        var yy = txt.length > 1 ? (i - (txt.length - 1) / 2) * 0.37 : 0.02;
        ctx.lineWidth = 0.05; ctx.strokeStyle = '#6b1010'; ctx.strokeText(txt[i], 0, yy);
        ctx.fillStyle = g; ctx.fillText(txt[i], 0, yy);
      }
    }, PI, 0.05);
  }
  function drawSideSwirls(ctx, P) {
    [-1, 1].forEach(function (s) {
      feat(ctx, P, 0, -0.05, function () {
        ctx.strokeStyle = P.deco; ctx.lineWidth = 0.04; ctx.lineCap = 'round';
        ctx.beginPath();
        for (var i = 0; i <= 40; i++) {
          var a = i / 40 * TAU * 1.6, rr = 0.03 + 0.15 * i / 40;
          var x = Math.cos(a) * rr * s, y = Math.sin(a) * rr;
          if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        }
        ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0.18 * s, 0); ctx.quadraticCurveTo(0.22 * s, 0.25, 0.08 * s, 0.38); ctx.stroke();
      }, s * PI * 0.56, 0.05);
    });
  }
  function drawBelly(ctx, P) {
    var R = P.R;
    function ring(v, lw, col) {
      var r = rowR(v) * R;
      ctx.beginPath();
      for (var i = 0; i <= 30; i++) {
        var th = -PI / 2 + PI * i / 30;
        var x = r * Math.sin(th), y = v * R + TILT * r * Math.cos(th);
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.lineWidth = lw; ctx.strokeStyle = col; ctx.stroke();
    }
    ring(0.57, R * 0.035, P.deco);
    ring(0.83, R * 0.035, P.deco);
    if (R < 26) return; // 小さいときは梅を省く(速さのため)
    for (var k = 0; k < 10; k++) {
      feat(ctx, P, 0, 0.70, function () {
        ctx.fillStyle = P.deco;
        for (var i = 0; i < 5; i++) {
          var a = i / 5 * TAU - PI / 2;
          ctx.beginPath(); ctx.arc(Math.cos(a) * 0.055, Math.sin(a) * 0.055, 0.045, 0, TAU); ctx.fill();
        }
        ctx.fillStyle = '#c0392b';
        ctx.beginPath(); ctx.arc(0, 0, 0.028, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ffe680';
        ctx.beginPath(); ctx.arc(0, 0, 0.012, 0, TAU); ctx.fill();
      }, k / 10 * TAU + PI / 10, 0.08);
    }
  }
  // 頭をぐるっと一周する布(目かくし・はちまき)
  function drawBand(ctx, P, t, v0, v1, kind) {
    var R = P.R;
    function edge(v, rev) {
      var r = rowR(v) * R, pts = [];
      for (var i = 0; i <= 30; i++) {
        var th = -PI / 2 + PI * i / 30;
        pts.push([r * Math.sin(th), v * R + TILT * r * Math.cos(th) + Math.sin(i * 0.9) * R * 0.006]);
      }
      if (rev) pts.reverse();
      return pts;
    }
    var a = edge(v0, false), b = edge(v1, true);
    ctx.beginPath();
    a.concat(b).forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); });
    ctx.closePath();
    var g = ctx.createLinearGradient(0, v0 * R, 0, v1 * R + TILT * R);
    var main = kind === 'hachimaki' ? '#fffaf0' : '#2a3b8f';
    if (kind === 'hachimaki') { g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#e6dccb'); }
    else { g.addColorStop(0, '#3b4fa8'); g.addColorStop(0.5, '#2a3b8f'); g.addColorStop(1, '#1d2a6b'); }
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = R * 0.03; ctx.strokeStyle = INK; ctx.stroke();
    if (kind === 'hachimaki') {   // 前に赤い丸
      feat(ctx, P, 0, (v0 + v1) / 2 + 0.01, function () {
        ctx.fillStyle = '#e02020'; ctx.beginPath(); ctx.arc(0, 0, 0.075, 0, TAU); ctx.fill();
      }, 0, 0.05);
    } else {
      for (var k = 0; k < 14; k++) {
        feat(ctx, P, 0, (v0 + v1) / 2 + (k % 2 ? 0.05 : -0.05), function () {
          ctx.fillStyle = 'rgba(255,255,255,0.92)';
          ctx.beginPath(); ctx.arc(0, 0, 0.035, 0, TAU); ctx.fill();
        }, k / 14 * TAU, 0.05);
      }
    }
    feat(ctx, P, 0, (v0 + v1) / 2 + 0.02, function () {   // 結び目(背中がわ)
      ctx.fillStyle = main; ctx.strokeStyle = INK; ctx.lineWidth = 0.03;
      var sw = Math.sin(t * 2.4) * 0.04;
      ctx.beginPath(); ctx.moveTo(-0.03, 0.02); ctx.quadraticCurveTo(-0.12, 0.3, -0.2 + sw, 0.5); ctx.lineTo(-0.1 + sw, 0.5);
      ctx.quadraticCurveTo(-0.03, 0.3, 0.02, 0.05); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0.03, 0.02); ctx.quadraticCurveTo(0.14, 0.28, 0.24 + sw, 0.44); ctx.lineTo(0.14 + sw, 0.47);
      ctx.quadraticCurveTo(0.05, 0.3, -0.02, 0.05); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(-0.1, -0.02, 0.1, 0.07, 0.3, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0.1, -0.02, 0.1, 0.07, -0.3, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, 0, 0.055, 0.065, 0, 0, TAU); ctx.fill(); ctx.stroke();
    }, PI, 0.05);
  }

  // ---- まわりの動くもの ----
  function puff(ctx, x, y, pr) {
    ctx.beginPath();
    ctx.arc(x, y, pr, 0, TAU); ctx.arc(x + pr * 0.8, y + pr * 0.2, pr * 0.7, 0, TAU); ctx.arc(x - pr * 0.75, y + pr * 0.25, pr * 0.65, 0, TAU);
    ctx.fill();
  }
  function angerMark(ctx, x, y, sc) {
    ctx.save(); ctx.translate(x, y);
    for (var q = 0; q < 2; q++) {
      ctx.lineWidth = q ? sc * 0.17 : sc * 0.36;
      ctx.strokeStyle = q ? '#e01b24' : '#ffffff';
      for (var i = 0; i < 4; i++) {
        ctx.save(); ctx.rotate(i * PI / 2);
        ctx.beginPath(); ctx.moveTo(sc * 0.12, -sc * 0.55); ctx.quadraticCurveTo(sc * 0.14, -sc * 0.14, sc * 0.55, -sc * 0.12); ctx.stroke();
        ctx.restore();
      }
    }
    ctx.restore();
  }
  function sweatDrop(ctx, x, y, s, R) {
    ctx.fillStyle = '#8fd3ff'; ctx.strokeStyle = '#2a6aa8'; ctx.lineWidth = Math.max(1, R * 0.02);
    drop(ctx, x, y, s); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x - s * 0.2, y + s * 0.2, s * 0.18, 0, TAU); ctx.fill();
  }
  function flower(ctx, x, y, s, col, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0);
    ctx.fillStyle = col; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1, s * 0.12);
    for (var i = 0; i < 5; i++) { var a = i / 5 * TAU; ctx.beginPath(); ctx.ellipse(Math.cos(a) * s * 0.55, Math.sin(a) * s * 0.55, s * 0.42, s * 0.32, a, 0, TAU); ctx.fill(); ctx.stroke(); }
    ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(0, 0, s * 0.3, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  // 後ろ(体より先に描く)
  function drawFxBack(ctx, R, S, t) {
    var i, a;
    ctx.save();
    if (has(S.fx, 'flames')) {
      for (i = 0; i < 11; i++) {
        a = PI + PI * (i + 0.5) / 11 - 0.25 + 0.5 * i / 11;
        var bx = Math.cos(a) * R * 0.8, by = Math.sin(a) * R * 0.85 - R * 0.05;
        var len = R * (0.45 + 0.18 * Math.sin(t * 11 + i * 1.7));
        var tx = bx + Math.cos(a) * len, ty = by + Math.sin(a) * len - R * 0.15;
        var fg = ctx.createLinearGradient(bx, by, tx, ty);
        fg.addColorStop(0, '#ff4a12'); fg.addColorStop(0.6, '#ff9a1f'); fg.addColorStop(1, '#ffe14a');
        ctx.fillStyle = fg;
        var nx = -Math.sin(a) * R * 0.2, ny = Math.cos(a) * R * 0.2;
        ctx.beginPath(); ctx.moveTo(bx + nx, by + ny); ctx.quadraticCurveTo(bx + nx * 0.6 + (tx - bx) * 0.6, by + ny * 0.6 + (ty - by) * 0.6, tx, ty);
        ctx.quadraticCurveTo(bx - nx * 0.6 + (tx - bx) * 0.6, by - ny * 0.6 + (ty - by) * 0.6, bx - nx, by - ny); ctx.closePath(); ctx.fill();
      }
    }
    if (has(S.fx, 'halo')) {   // 後光
      var hg = ctx.createRadialGradient(0, -R * 0.1, R * 0.6, 0, -R * 0.1, R * 1.4);
      hg.addColorStop(0, 'rgba(255,230,140,0.95)'); hg.addColorStop(0.6, 'rgba(255,210,90,0.5)'); hg.addColorStop(1, 'rgba(255,210,90,0)');
      ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(0, -R * 0.1, R * 1.4, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#f2b91e'; ctx.lineWidth = R * 0.06; ctx.beginPath(); ctx.arc(0, -R * 0.1, R * 1.15, 0, TAU); ctx.stroke();
      ctx.lineWidth = R * 0.02;
      for (i = 0; i < 24; i++) { a = i / 24 * TAU + t * 0.2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * R * 1.18, -R * 0.1 + Math.sin(a) * R * 1.18); ctx.lineTo(Math.cos(a) * R * 1.35, -R * 0.1 + Math.sin(a) * R * 1.35); ctx.stroke(); }
    }
    if (has(S.fx, 'aura') || has(S.fx, 'auraRainbow')) {
      var rb = has(S.fx, 'auraRainbow');
      for (i = 0; i < 16; i++) {
        a = i / 16 * TAU + t * 0.5;
        ctx.fillStyle = rb ? 'hsla(' + ((i * 45 + t * 120) % 360) + ',90%,60%,0.8)' : (i % 2 ? 'rgba(255,220,90,0.75)' : 'rgba(255,250,200,0.55)');
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R * 1.42, a, a + TAU / 32); ctx.closePath(); ctx.fill();
      }
    }
    ctx.restore();
  }
  // 前(体のあとに描く)。頭の中心が原点、単位は px
  function drawFxTop(ctx, R, S, t, faceC, dir) {
    var fx = S.fx, i, p, x, y, a;
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    var lw = Math.max(1, R * 0.02);
    function steamPuffs(n, sc, sp) {
      for (i = 0; i < n; i++) {
        var s = i % 2 ? 1 : -1;
        p = fract(t * sp + i / n);
        x = s * (R * 0.42 + p * R * 0.3 * sc); y = -R * 0.88 - p * R * 0.6;
        ctx.globalAlpha = (1 - p) * 0.9;
        ctx.fillStyle = '#ffffff';
        puff(ctx, x, y, R * (0.09 + p * 0.1) * sc);
      }
      ctx.globalAlpha = 1;
    }
    fx.forEach(function (name) {
      if (name.indexOf('text:') === 0) {
        var str = name.slice(5), fs = Math.round(R * (str.length > 3 ? 0.24 : 0.3));
        ctx.save(); ctx.translate(R * 0.82, -R * 0.98 + Math.sin(t * 3) * R * 0.03); ctx.rotate(-0.12);
        outlinedText(ctx, str, 0, 0, Math.max(6, fs), '#ffffff', INK);
        ctx.restore();
        return;
      }
      switch (name) {
        case 'steam': steamPuffs(4, 1, 0.9); break;
        case 'steamBig': steamPuffs(8, 1.5, 1.4); break;
        case 'vein': angerMark(ctx, R * 0.58, -R * 0.72, R * (0.24 + 0.03 * Math.sin(t * 12))); break;
        case 'veinMany':
          angerMark(ctx, R * 0.6, -R * 0.7, R * (0.26 + 0.04 * Math.sin(t * 12)));
          angerMark(ctx, -R * 0.62, -R * 0.6, R * (0.2 + 0.04 * Math.sin(t * 12 + 1)));
          angerMark(ctx, R * 0.05, -R * 1.02, R * (0.18 + 0.04 * Math.sin(t * 12 + 2)));
          break;
        case 'zzz':
          for (i = 0; i < 3; i++) {
            p = fract(t * 0.35 + i / 3);
            ctx.globalAlpha = p < 0.15 ? p / 0.15 : (1 - p);
            outlinedText(ctx, 'Z', R * (0.55 + p * 0.45), -R * (0.75 + p * 0.6), Math.max(5, Math.round(R * (0.18 + p * 0.18))), '#cfe3ff', '#2b3a66');
          }
          ctx.globalAlpha = 1;
          break;
        case 'notes':
          for (i = 0; i < 2; i++) {
            p = fract(t * 0.5 + i * 0.5);
            x = (i ? -1 : 1) * R * (0.8 + Math.sin(p * 6) * 0.06); y = -R * (0.45 + p * 0.65);
            ctx.globalAlpha = Math.min(1, (1 - p) * 2);
            ctx.fillStyle = i ? '#ff7ab0' : '#ffd23f'; ctx.strokeStyle = INK; ctx.lineWidth = lw;
            var ns = R * 0.11;
            ctx.save(); ctx.translate(x, y); ctx.rotate(-0.25);
            ctx.beginPath(); ctx.ellipse(0, 0, ns * 0.75, ns * 0.55, -0.4, 0, TAU); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(ns * 0.6, -ns * 0.1); ctx.lineTo(ns * 0.6, -ns * 1.9); ctx.quadraticCurveTo(ns * 1.3, -ns * 1.5, ns * 1.2, -ns * 0.9); ctx.stroke();
            ctx.restore();
          }
          ctx.globalAlpha = 1;
          break;
        case 'stars':
          for (i = 0; i < 3; i++) {
            a = t * 3 + i * TAU / 3;
            ctx.fillStyle = '#ffd93b'; ctx.strokeStyle = INK; ctx.lineWidth = lw;
            star(ctx, Math.cos(a) * R * 0.62, -R * 1.02 + Math.sin(a) * R * 0.14, R * (0.1 + 0.02 * Math.sin(a)), 5, 0.48, a * 0.5); ctx.fill(); ctx.stroke();
          }
          break;
        case 'birds':
          ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1.2, R * 0.035);
          for (i = 0; i < 3; i++) {
            a = t * 1.5 + i * TAU / 3;
            x = Math.cos(a) * R * 0.7; y = -R * 1.08 + Math.sin(a) * R * 0.12;
            var fl = Math.sin(t * 12 + i) * R * 0.04;
            ctx.beginPath(); ctx.moveTo(x - R * 0.1, y - fl); ctx.quadraticCurveTo(x - R * 0.04, y - R * 0.05, x, y); ctx.quadraticCurveTo(x + R * 0.04, y - R * 0.05, x + R * 0.1, y - fl); ctx.stroke();
          }
          break;
        case 'sparkle': case 'sparkleBig': {
          var big = name === 'sparkleBig';
          var pos = big ? [[0.86, -0.72], [-0.92, -0.5], [0.95, 0.05], [-0.7, -1.0], [0.35, -1.12], [-1.0, 0.25]] : [[0.86, -0.72], [-0.92, -0.5], [0.95, 0.05]];
          for (i = 0; i < pos.length; i++) {
            var k = 0.5 + 0.5 * Math.sin(t * 4 + i * 1.6);
            sparkle(ctx, pos[i][0] * R, pos[i][1] * R, R * (big ? 0.09 + 0.12 * k : 0.06 + 0.09 * k), big ? ['#fff3a0', '#ffffff', '#ffd0f0'][i % 3] : '#fff3a0');
          }
          break;
        }
        case 'star1':
          ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = INK; ctx.lineWidth = lw;
          star(ctx, R * 0.82, -R * 0.42, R * (0.13 + 0.02 * Math.sin(t * 6)), 5, 0.48, t); ctx.fill(); ctx.stroke();
          break;
        case 'hearts':
          for (i = 0; i < 2; i++) {
            p = fract(t * 0.45 + i * 0.5);
            ctx.globalAlpha = Math.min(1, (1 - p) * 1.6);
            ctx.fillStyle = '#ff6fa3'; ctx.strokeStyle = INK; ctx.lineWidth = lw;
            heart(ctx, (i ? -0.85 : 0.9) * R + Math.sin(p * 7) * R * 0.05, -R * (0.4 + p * 0.7), R * 0.13);
            ctx.fill(); ctx.stroke();
          }
          ctx.globalAlpha = 1;
          break;
        case 'excl':
          outlinedText(ctx, '!', R * 0.8, -R * 0.92 - Math.abs(Math.sin(t * 9)) * R * 0.05, Math.max(6, Math.round(R * 0.5)), '#ffe14d', INK);
          break;
        case 'excl2':
          outlinedText(ctx, '!!', R * 0.78, -R * 0.92 - Math.abs(Math.sin(t * 12)) * R * 0.06, Math.max(6, Math.round(R * 0.5)), '#ff4a3a', INK);
          break;
        case 'shock':
          ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1.2, R * 0.035);
          for (i = -1; i <= 1; i++) {
            a = -PI / 2 + i * 0.45 - 0.75;
            ctx.beginPath(); ctx.moveTo(Math.cos(a) * R * 1.08, Math.sin(a) * R * 1.08); ctx.lineTo(Math.cos(a) * R * 1.3, Math.sin(a) * R * 1.3); ctx.stroke();
          }
          break;
        case 'question': {
          var bob = Math.sin(t * 2.5) * R * 0.05;
          outlinedText(ctx, '?', R * 0.82, -R * 0.85 + bob, Math.max(6, Math.round(R * 0.38)), '#ffffff', INK);
          outlinedText(ctx, '?', -R * 0.86, -R * 0.62 - bob, Math.max(5, Math.round(R * 0.26)), '#ffffff', INK);
          break;
        }
        case 'q1':
          ctx.save(); ctx.translate(R * 0.8, -R * 0.9); ctx.rotate(Math.sin(t * 2) * 0.15);
          outlinedText(ctx, '?', 0, 0, Math.max(6, Math.round(R * 0.5)), '#7fd3ff', INK); ctx.restore();
          break;
        case 'dots':
          for (i = 0; i < 3; i++) {
            if (fract(t * 0.8) * 4 <= i) continue;
            ctx.fillStyle = INK;
            ctx.beginPath(); ctx.arc(R * (0.62 + i * 0.16), -R * 0.92, Math.max(1, R * 0.045), 0, TAU); ctx.fill();
          }
          break;
        case 'sweat':
          if (faceC > 0.3) { p = fract(t * 0.6); ctx.globalAlpha = p < 0.8 ? 1 : (1 - p) * 5; sweatDrop(ctx, -R * 0.78, -R * 0.45 + p * R * 0.18, R * 0.1, R); ctx.globalAlpha = 1; }
          break;
        case 'sweatBig':
          sweatDrop(ctx, R * 0.74, -R * 0.5 + Math.sin(t * 2) * R * 0.03, R * 0.2, R);
          break;
        case 'sweatMany':
          for (i = 0; i < 4; i++) {
            p = fract(t * 1.2 + i / 4);
            a = [-2.4, -0.7, -2.0, -1.1][i];
            ctx.globalAlpha = 1 - p;
            sweatDrop(ctx, Math.cos(a) * R * (0.95 + p * 0.3), Math.sin(a) * R * (0.85 + p * 0.3), R * 0.09, R);
          }
          ctx.globalAlpha = 1;
          break;
        case 'snow':
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1, R * 0.025);
          for (i = 0; i < 7; i++) {
            p = fract(t * 0.25 + i / 7);
            x = (-1.1 + (i * 0.37 % 2.2)) * R + Math.sin(t * 2 + i) * R * 0.08; y = -R * 1.25 + p * R * 2.1;
            var ss = R * 0.07;
            ctx.beginPath();
            for (var q = 0; q < 3; q++) { var qa = q * PI / 3; ctx.moveTo(x - Math.cos(qa) * ss, y - Math.sin(qa) * ss); ctx.lineTo(x + Math.cos(qa) * ss, y + Math.sin(qa) * ss); }
            ctx.stroke();
          }
          break;
        case 'wind':
          ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = Math.max(1.2, R * 0.035);
          for (i = 0; i < 3; i++) {
            p = fract(t * 0.6 + i / 3);
            x = (-1.4 + p * 2.8) * R; y = (-0.6 + i * 0.45) * R;
            ctx.globalAlpha = Math.sin(p * PI);
            ctx.beginPath(); ctx.moveTo(x - R * 0.4, y); ctx.quadraticCurveTo(x, y - R * 0.08, x + R * 0.2, y); ctx.arc(x + R * 0.2, y - R * 0.08, R * 0.08, PI / 2, -PI, true); ctx.stroke();
          }
          ctx.globalAlpha = 1;
          break;
        case 'flowers': {
          var fp = [[-1.0, 0.6, '#ff8fc0'], [1.0, 0.5, '#ffd23f'], [-0.95, -0.5, '#ffd23f'], [0.95, -0.7, '#ff8fc0'], [0.05, -1.18, '#ffb0d0']];
          for (i = 0; i < fp.length; i++) flower(ctx, fp[i][0] * R, fp[i][1] * R, R * 0.13, fp[i][2], t * 0.6 + i);
          break;
        }
        case 'gloom':
          ctx.fillStyle = '#5a5470'; puff(ctx, 0, -R * 1.15, R * 0.22); puff(ctx, -R * 0.3, -R * 1.1, R * 0.16); puff(ctx, R * 0.3, -R * 1.1, R * 0.16);
          ctx.strokeStyle = 'rgba(120,150,220,0.9)'; ctx.lineWidth = Math.max(1, R * 0.025);
          for (i = 0; i < 4; i++) { p = fract(t * 1.2 + i / 4); x = (-0.35 + i * 0.23) * R; y = -R * 1.0 + p * R * 0.3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - R * 0.03, y + R * 0.1); ctx.stroke(); }
          break;
        case 'lightning':
          ctx.fillStyle = '#ffe14d'; ctx.strokeStyle = INK; ctx.lineWidth = lw;
          ctx.save(); ctx.translate(R * 0.78, -R * 0.95); ctx.scale(R / 50, R / 50);
          ctx.beginPath(); ctx.moveTo(4, -22); ctx.lineTo(-10, 4); ctx.lineTo(0, 4); ctx.lineTo(-6, 26); ctx.lineTo(12, -4); ctx.lineTo(2, -4); ctx.lineTo(10, -22); ctx.closePath();
          ctx.restore(); ctx.fill(); ctx.stroke();
          break;
        case 'ghost': {   // たましいが ぬけていく
          p = fract(t * 0.35);
          x = R * (0.1 + p * 0.6); y = R * (0.15 - p * 1.1);
          ctx.globalAlpha = 0.9 * Math.min(1, (1 - p) * 2.5);
          ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#7a8aa8'; ctx.lineWidth = lw;
          var gs = R * 0.22;
          ctx.beginPath(); ctx.arc(x, y, gs, PI, 0); ctx.quadraticCurveTo(x + gs, y + gs * 1.2, x + gs * 0.2, y + gs * 1.6); ctx.quadraticCurveTo(x - gs * 0.6, y + gs * 1.2, x - gs, y); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x - gs * 0.35, y, gs * 0.12, 0, TAU); ctx.arc(x + gs * 0.3, y, gs * 0.12, 0, TAU); ctx.fill();
          ctx.globalAlpha = 1;
          break;
        }
        case 'table': {   // ちゃぶ台が とんでいく
          ctx.save(); ctx.translate(R * 0.85, -R * 1.0); ctx.rotate(-0.6 + Math.sin(t * 5) * 0.25);
          ctx.fillStyle = '#7a4a26'; ctx.strokeStyle = INK; ctx.lineWidth = lw;
          ctx.fillRect(-R * 0.25, R * 0.04, R * 0.06, R * 0.18); ctx.strokeRect(-R * 0.25, R * 0.04, R * 0.06, R * 0.18);
          ctx.fillRect(R * 0.19, R * 0.04, R * 0.06, R * 0.18); ctx.strokeRect(R * 0.19, R * 0.04, R * 0.06, R * 0.18);
          ctx.fillStyle = '#a8683a'; ctx.beginPath(); ctx.ellipse(0, 0, R * 0.36, R * 0.1, 0, 0, TAU); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(-R * 0.08, -R * 0.06, R * 0.06, R * 0.04, 0, 0, TAU); ctx.fill(); ctx.stroke();
          ctx.restore();
          break;
        }
        case 'bump': {    // たんこぶ
          ctx.fillStyle = '#ff6a5a'; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1.5, R * 0.04);
          ctx.beginPath(); ctx.arc(R * 0.18, -R * 1.0, R * 0.2, PI * 0.95, PI * 2.05); ctx.fill(); ctx.stroke();
          ctx.beginPath(); ctx.arc(R * 0.18, -R * 1.16, R * 0.12, PI * 0.95, PI * 2.05); ctx.fill(); ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(R * 0.13, -R * 1.2, R * 0.03, 0, TAU); ctx.fill();
          break;
        }
        case 'pain':
          ctx.fillStyle = '#ffe14d'; ctx.strokeStyle = INK; ctx.lineWidth = lw;
          for (i = 0; i < 2; i++) { star(ctx, (i ? -0.55 : 0.6) * R, -R * (1.05 - i * 0.1), R * 0.09, 4, 0.4, t * 3); ctx.fill(); ctx.stroke(); }
          break;
        case 'confetti': {
          var cols = ['#ff4a6a', '#ffd23f', '#3cc8ff', '#7ce06a', '#c38bff'];
          for (i = 0; i < 14; i++) {
            p = fract(t * 0.4 + i * 0.137);
            x = (-1.2 + (i * 0.53 % 2.4)) * R + Math.sin(t * 3 + i) * R * 0.1; y = -R * 1.35 + p * R * 2.4;
            ctx.save(); ctx.translate(x, y); ctx.rotate(t * 4 + i);
            ctx.fillStyle = cols[i % cols.length]; ctx.fillRect(-R * 0.05, -R * 0.025, R * 0.1, R * 0.05);
            ctx.restore();
          }
          break;
        }
        case 'crow': {    // カラスが とんでいく(しーん…)
          x = (fract(t * 0.18) * 2.8 - 1.4) * R; y = -R * 1.12;
          var wf = Math.sin(t * 10) * R * 0.08;
          ctx.fillStyle = '#1a1a22';
          ctx.beginPath(); ctx.ellipse(x, y, R * 0.12, R * 0.06, 0, 0, TAU); ctx.fill();
          ctx.beginPath(); ctx.moveTo(x - R * 0.05, y); ctx.lineTo(x - R * 0.2, y - R * 0.05 - wf); ctx.lineTo(x + R * 0.02, y - R * 0.02); ctx.fill();
          ctx.beginPath(); ctx.moveTo(x + R * 0.0, y); ctx.lineTo(x + R * 0.18, y - R * 0.04 - wf); ctx.lineTo(x + R * 0.06, y - R * 0.01); ctx.fill();
          ctx.beginPath(); ctx.moveTo(x + R * 0.12, y - R * 0.01); ctx.lineTo(x + R * 0.18, y + R * 0.01); ctx.lineTo(x + R * 0.11, y + R * 0.03); ctx.fill();
          break;
        }
        case 'zabuton': { // ざぶとん1まい!
          ctx.save(); ctx.translate(0, -R * 1.18 + Math.sin(t * 2) * R * 0.03);
          ctx.fillStyle = '#8a3fb8'; ctx.strokeStyle = INK; ctx.lineWidth = lw;
          ctx.beginPath(); ctx.moveTo(-R * 0.5, 0); ctx.quadraticCurveTo(0, -R * 0.08, R * 0.5, 0); ctx.quadraticCurveTo(R * 0.58, R * 0.1, R * 0.45, R * 0.2);
          ctx.quadraticCurveTo(0, R * 0.26, -R * 0.45, R * 0.2); ctx.quadraticCurveTo(-R * 0.58, R * 0.1, -R * 0.5, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#f2c53d';
          [[-0.5, 0.0], [0.5, 0.0], [-0.46, 0.2], [0.46, 0.2]].forEach(function (c) { ctx.beginPath(); ctx.arc(c[0] * R, c[1] * R, R * 0.04, 0, TAU); ctx.fill(); });
          ctx.restore();
          break;
        }
        case 'sigh':
          p = fract(t * 0.5);
          ctx.globalAlpha = 0.85 * (1 - p); ctx.fillStyle = '#ffffff';
          puff(ctx, R * (0.45 + p * 0.45), R * (0.32 + p * 0.1), R * (0.08 + p * 0.1));
          ctx.globalAlpha = 1;
          break;
        case 'think': case 'riceball': {
          ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = lw;
          ctx.beginPath(); ctx.arc(R * 0.55, -R * 0.78, R * 0.05, 0, TAU); ctx.fill(); ctx.stroke();
          ctx.beginPath(); ctx.arc(R * 0.66, -R * 0.92, R * 0.07, 0, TAU); ctx.fill(); ctx.stroke();
          ctx.beginPath(); ctx.ellipse(R * 0.88, -R * 1.15, R * 0.3, R * 0.22, 0, 0, TAU); ctx.fill(); ctx.stroke();
          if (name === 'think') outlinedText(ctx, '?', R * 0.88, -R * 1.15, Math.max(5, Math.round(R * 0.28)), '#ffd23f', INK);
          else {
            ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(R * 0.88, -R * 1.3); ctx.quadraticCurveTo(R * 1.08, -R * 1.02, R * 1.02, -R * 1.02);
            ctx.lineTo(R * 0.74, -R * 1.02); ctx.quadraticCurveTo(R * 0.68, -R * 1.02, R * 0.88, -R * 1.3); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#1d3a2a'; ctx.fillRect(R * 0.8, -R * 1.11, R * 0.16, R * 0.09);
          }
          break;
        }
        case 'wiggle':
          ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1.2, R * 0.035);
          for (i = 0; i < 2; i++) {
            ctx.beginPath(); ctx.arc(0, -R * 0.05, R * (1.1 + i * 0.15), -0.45, 0.45); ctx.stroke();
            ctx.beginPath(); ctx.arc(0, -R * 0.05, R * (1.1 + i * 0.15), PI - 0.45, PI + 0.45); ctx.stroke();
          }
          break;
        case 'feather':
          ctx.save(); ctx.translate(R * 0.95, R * 0.15); ctx.rotate(-0.9 + Math.sin(t * 10) * 0.3);
          ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = lw;
          ctx.beginPath(); ctx.moveTo(0, -R * 0.4); ctx.bezierCurveTo(R * 0.2, -R * 0.25, R * 0.15, R * 0.15, 0, R * 0.28); ctx.bezierCurveTo(-R * 0.15, R * 0.15, -R * 0.2, -R * 0.25, 0, -R * 0.4); ctx.fill(); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(0, -R * 0.35); ctx.lineTo(0, R * 0.42); ctx.stroke();
          ctx.restore();
          break;
        case 'whiteFlag':
          ctx.strokeStyle = '#8a5a2c'; ctx.lineWidth = Math.max(1.5, R * 0.04);
          ctx.beginPath(); ctx.moveTo(R * 0.9, R * 0.45); ctx.lineTo(R * 0.95, -R * 0.75); ctx.stroke();
          var fw = Math.sin(t * 6) * R * 0.05;
          ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = lw;
          ctx.beginPath(); ctx.moveTo(R * 0.95, -R * 0.75); ctx.quadraticCurveTo(R * 1.15, -R * 0.8 + fw, R * 1.32, -R * 0.72); ctx.lineTo(R * 1.3, -R * 0.42);
          ctx.quadraticCurveTo(R * 1.12, -R * 0.5 - fw, R * 0.94, -R * 0.45); ctx.closePath(); ctx.fill(); ctx.stroke();
          break;
        case 'futon': {   // ふとんが ふっとんだ
          ctx.save(); ctx.translate(R * 0.8 + Math.sin(t * 3) * R * 0.08, -R * 1.05); ctx.rotate(0.3 + Math.sin(t * 4) * 0.2);
          ctx.fillStyle = '#ff9ab8'; ctx.strokeStyle = INK; ctx.lineWidth = lw;
          rrect(ctx, -R * 0.35, -R * 0.18, R * 0.7, R * 0.36, R * 0.08); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#ffffff';
          for (i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-R * 0.18 + i * R * 0.18, (i % 2 ? 0.06 : -0.05) * R, R * 0.05, 0, TAU); ctx.fill(); }
          ctx.restore();
          ctx.strokeStyle = INK; ctx.lineWidth = lw;
          for (i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(R * 0.3, -R * (0.85 + i * 0.12)); ctx.lineTo(R * 0.4, -R * (0.9 + i * 0.12)); ctx.stroke(); }
          break;
        }
        case 'butterfly': {
          x = R * (0.85 + Math.sin(t * 1.3) * 0.15); y = -R * (0.85 + Math.cos(t * 1.7) * 0.15);
          var wg = Math.abs(Math.sin(t * 12));
          ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1, R * 0.015);
          [-1, 1].forEach(function (s) { ctx.beginPath(); ctx.ellipse(x + s * R * 0.07 * wg, y, R * 0.08 * wg + R * 0.01, R * 0.1, s * 0.3, 0, TAU); ctx.fill(); ctx.stroke(); });
          ctx.fillStyle = INK; ctx.fillRect(x - R * 0.01, y - R * 0.07, R * 0.02, R * 0.14);
          break;
        }
        case 'sensu': {   // 扇子(落語)
          ctx.save(); ctx.translate(R * 0.95, R * 0.25); ctx.rotate(-0.5 + Math.sin(t * 3) * 0.15);
          for (i = 0; i < 7; i++) {
            var a0 = -PI / 2 - 0.9 + i * 1.8 / 7;
            ctx.fillStyle = i % 2 ? '#ffffff' : '#e84a6a';
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R * 0.42, a0, a0 + 1.8 / 7); ctx.closePath(); ctx.fill();
          }
          ctx.strokeStyle = INK; ctx.lineWidth = lw;
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R * 0.42, -PI / 2 - 0.9, -PI / 2 + 0.9); ctx.closePath(); ctx.stroke();
          ctx.restore();
          break;
        }
        case 'onsen':     // ♨ のゆげ
          ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = Math.max(1.5, R * 0.045);
          for (i = -1; i <= 1; i++) {
            ctx.beginPath();
            for (var q2 = 0; q2 <= 10; q2++) { var oy = -R * 1.1 - q2 * R * 0.04, ox = i * R * 0.22 + Math.sin(q2 * 0.9 + t * 4 + i) * R * 0.05; if (q2) ctx.lineTo(ox, oy); else ctx.moveTo(ox, oy); }
            ctx.stroke();
          }
          break;
        case 'lemon':
          ctx.save(); ctx.translate(R * 0.88, -R * 0.78); ctx.rotate(Math.sin(t * 2) * 0.2);
          ctx.fillStyle = '#ffe14a'; ctx.strokeStyle = INK; ctx.lineWidth = lw;
          ctx.beginPath(); ctx.arc(0, 0, R * 0.2, 0, TAU); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#fff8c0'; ctx.beginPath(); ctx.arc(0, 0, R * 0.15, 0, TAU); ctx.fill();
          ctx.strokeStyle = '#e6b800';
          for (i = 0; i < 6; i++) { a = i / 6 * TAU; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * R * 0.15, Math.sin(a) * R * 0.15); ctx.stroke(); }
          ctx.restore();
          break;
        case 'dododo':    // ゴゴゴ…
          for (i = 0; i < 3; i++) {
            var jx = Math.sin(t * 30 + i) * R * 0.02;
            outlinedText(ctx, 'ゴ', -R * 1.05 + jx, -R * (0.75 - i * 0.4), Math.max(5, Math.round(R * 0.3)), '#7a3cc8', '#ffffff');
            outlinedText(ctx, 'ゴ', R * 1.05 - jx, -R * (0.95 - i * 0.4), Math.max(5, Math.round(R * 0.3)), '#7a3cc8', '#ffffff');
          }
          break;
        case 'smoke':
          for (i = 0; i < 6; i++) {
            p = fract(t * 0.3 + i / 6);
            a = PI + i / 5 * PI;
            ctx.globalAlpha = 0.75 * (1 - p); ctx.fillStyle = '#8a8a90';
            puff(ctx, Math.cos(a) * R * (0.9 + p * 0.3), Math.sin(a) * R * 0.8 - p * R * 0.4, R * (0.1 + p * 0.08));
          }
          ctx.globalAlpha = 1;
          break;
        case 'bulb': {    // ひらめいた!
          x = R * 0.78; y = -R * 1.05;
          var glow = 0.6 + 0.4 * Math.sin(t * 6);
          ctx.strokeStyle = 'rgba(255,220,60,' + glow + ')'; ctx.lineWidth = Math.max(1.2, R * 0.035);
          for (i = 0; i < 7; i++) { a = -PI + i / 6 * PI; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * R * 0.26, y + Math.sin(a) * R * 0.26); ctx.lineTo(x + Math.cos(a) * R * 0.38, y + Math.sin(a) * R * 0.38); ctx.stroke(); }
          ctx.fillStyle = '#fff36b'; ctx.strokeStyle = INK; ctx.lineWidth = lw;
          ctx.beginPath(); ctx.arc(x, y, R * 0.19, PI * 0.8, PI * 2.2); ctx.lineTo(x + R * 0.08, y + R * 0.24); ctx.lineTo(x - R * 0.08, y + R * 0.24); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#9aa0a8'; ctx.fillRect(x - R * 0.08, y + R * 0.24, R * 0.16, R * 0.09); ctx.strokeRect(x - R * 0.08, y + R * 0.24, R * 0.16, R * 0.09);
          break;
        }
        case 'twitch':
          if (Math.sin(t * 9) > -0.3) {
            ctx.strokeStyle = '#e01b24'; ctx.lineWidth = Math.max(1.2, R * 0.035);
            for (i = -1; i <= 1; i++) { a = -0.7 + i * 0.35; ctx.beginPath(); ctx.moveTo(R * 0.72 + Math.cos(a) * R * 0.1, -R * 0.62 + Math.sin(a) * R * 0.1); ctx.lineTo(R * 0.72 + Math.cos(a) * R * 0.22, -R * 0.62 + Math.sin(a) * R * 0.22); ctx.stroke(); }
          }
          break;
      }
    });
    ctx.restore();
  }

  // 顔に付いて動くもの(なみだ・鼻水・つらら・つば)
  function drawFaceFx(ctx, P, S, t) {
    var fx = S.fx;
    [-1, 1].forEach(function (s) {
      var e = s < 0 ? S.eyeL : S.eyeR;
      if (has(fx, 'tears')) {
        feat(ctx, P, s * (EYE.u + 0.06), EYE.v + 0.14, function () {
          ctx.strokeStyle = '#2f78c4'; ctx.lineWidth = 0.02;
          ctx.beginPath(); ctx.moveTo(-0.03, 0); ctx.quadraticCurveTo(-0.035, 0.18, -0.02, 0.32);
          ctx.lineTo(0.02, 0.32); ctx.quadraticCurveTo(0.035, 0.18, 0.03, 0); ctx.closePath();
          ctx.fillStyle = 'rgba(150,210,255,0.75)'; ctx.fill();
          var p = fract(t * 0.9 + (s > 0 ? 0.5 : 0));
          ctx.fillStyle = 'rgba(140,205,255,0.95)';
          drop(ctx, 0, 0.05 + p * 0.38, 0.055); ctx.fill(); ctx.stroke();
        }, 0, 0.15);
      }
      if (e && e.stream) {   // 滝のようななみだ
        feat(ctx, P, s * EYE.u, EYE.v + 0.06, function () {
          var w = Math.sin(t * 14) * 0.01;
          ctx.fillStyle = 'rgba(130,200,255,0.85)'; ctx.strokeStyle = '#2f78c4'; ctx.lineWidth = 0.018;
          ctx.beginPath(); ctx.moveTo(-0.09, 0); ctx.lineTo(0.09, 0);
          ctx.quadraticCurveTo(0.08 + w, 0.25, 0.1, 0.5); ctx.lineTo(-0.1, 0.5); ctx.quadraticCurveTo(-0.08 - w, 0.25, -0.09, 0); ctx.closePath();
          ctx.fill(); ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 0.015;
          for (var i = 0; i < 2; i++) { var yy = fract(t * 1.5 + i * 0.5) * 0.45; ctx.beginPath(); ctx.moveTo(-0.03 + i * 0.05, yy); ctx.lineTo(-0.03 + i * 0.05, yy + 0.08); ctx.stroke(); }
        }, 0, 0.12);
      }
      if (has(fx, 'laughTears') || has(fx, 'tearSmall')) {
        var small = !has(fx, 'laughTears');
        feat(ctx, P, s * (EYE.u + 0.12), EYE.v, function () {
          for (var i = 0; i < (small ? 1 : 2); i++) {
            var p = small ? 0.3 : fract(t * 1.6 + i * 0.5);
            var x = s * (0.04 + p * 0.3), y = -0.05 - Math.sin(p * PI) * 0.18 + p * 0.1;
            ctx.globalAlpha = small ? 1 : 1 - p;
            ctx.fillStyle = 'rgba(150,210,255,0.95)'; ctx.strokeStyle = '#2f78c4'; ctx.lineWidth = 0.015;
            drop(ctx, x, y, 0.045); ctx.fill(); ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }, 0, 0.1);
      }
    });
    if (has(fx, 'snot')) {   // 鼻水
      feat(ctx, P, 0.03, 0.08, function () {
        var l = 0.06 + 0.05 * Math.sin(t * 1.8);
        ctx.fillStyle = 'rgba(140,210,255,0.9)'; ctx.strokeStyle = '#2f78c4'; ctx.lineWidth = 0.015;
        ctx.beginPath(); ctx.moveTo(-0.015, 0); ctx.lineTo(0.015, 0); ctx.lineTo(0.012, l); ctx.lineTo(-0.012, l); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.arc(0, l, 0.025, 0, TAU); ctx.fill(); ctx.stroke();
      }, 0, 0.2);
    }
    if (has(fx, 'icicle')) { // つらら
      for (var k = -3; k <= 3; k++) {
        feat(ctx, P, k * 0.1, FACE.v + FACE.ry - 0.02 - Math.abs(k) * 0.01, function () {
          ctx.fillStyle = 'rgba(200,240,255,0.95)'; ctx.strokeStyle = '#4a9ad0'; ctx.lineWidth = 0.012;
          ctx.beginPath(); ctx.moveTo(-0.035, 0); ctx.lineTo(0.035, 0); ctx.lineTo(0, 0.09 + (k % 2 ? 0.04 : 0)); ctx.closePath(); ctx.fill(); ctx.stroke();
        }, 0, 0.15);
      }
    }
    if (has(fx, 'spray')) {  // ぶっ(つばが とぶ)
      feat(ctx, P, 0, MOUTH_V + 0.02, function () {
        ctx.fillStyle = 'rgba(150,210,255,0.95)';
        for (var i = 0; i < 8; i++) {
          var p = fract(t * 1.8 + i / 8), a = -0.2 + (i % 4) * 0.45 + (i > 3 ? PI * 0.5 : 0);
          var d = 0.08 + p * 0.3;
          ctx.globalAlpha = 1 - p;
          ctx.beginPath(); ctx.arc(Math.cos(a) * d * (i % 2 ? 1 : -1) * 1.4, Math.abs(Math.sin(a)) * d * 0.7 + 0.04, 0.035, 0, TAU); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }, 0, 0.2);
    }
  }

  // 顔の小物(めがね・サングラス・ばんそうこう・おでこの点)
  function drawAccFace(ctx, P, S, t) {
    var acc = S.acc;
    if (has(acc, 'glasses') || has(acc, 'sunglasses')) {
      var sun = has(acc, 'sunglasses');
      [-1, 1].forEach(function (s) {
        feat(ctx, P, s * EYE.u, EYE.v + 0.01, function () {
          var r = EYE.r * 1.38;
          ctx.lineWidth = sun ? 0.04 : 0.035; ctx.strokeStyle = sun ? '#111' : '#6b3a1a';
          ctx.beginPath();
          if (sun) { ctx.moveTo(-r, -r * 0.55); ctx.lineTo(r, -r * 0.55); ctx.quadraticCurveTo(r * 1.0, r * 0.8, 0, r * 0.75); ctx.quadraticCurveTo(-r * 1.0, r * 0.8, -r, -r * 0.55); }
          else ctx.arc(0, 0, r * 0.95, 0, TAU);
          ctx.closePath();
          ctx.fillStyle = sun ? '#15151c' : 'rgba(200,230,255,0.25)'; ctx.fill(); ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 0.025;
          ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.2); ctx.lineTo(-r * 0.15, -r * 0.5); ctx.stroke();
        }, 0, 0.08);
      });
      var a = proj(P, -EYE.u + EYE.r * 1.3, EYE.v - 0.04), b = proj(P, EYE.u - EYE.r * 1.3, EYE.v - 0.04);
      if (a[2] > 0 || b[2] > 0) {
        ctx.strokeStyle = sun ? '#111' : '#6b3a1a'; ctx.lineWidth = P.R * 0.035;
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo((a[0] + b[0]) / 2, a[1] - P.R * 0.04, b[0], b[1]); ctx.stroke();
      }
    }
    if (has(acc, 'bandage')) {
      feat(ctx, P, -0.45, 0.06, function () {
        ctx.rotate(-0.6);
        ctx.fillStyle = '#f3c99a'; ctx.strokeStyle = INK; ctx.lineWidth = 0.02;
        rrect(ctx, -0.13, -0.045, 0.26, 0.09, 0.04); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#e8b07a'; ctx.fillRect(-0.04, -0.045, 0.08, 0.09);
        ctx.fillStyle = 'rgba(120,70,30,0.5)';
        for (var i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-0.1 + i * 0.1 + (i === 1 ? 0 : 0), 0, 0.008, 0, TAU); ctx.fill(); }
      }, 0, 0.1);
    }
    if (has(acc, 'urna')) {
      feat(ctx, P, 0, -0.4, function () {
        ctx.fillStyle = '#ffe680'; ctx.strokeStyle = '#a8700c'; ctx.lineWidth = 0.015;
        ctx.beginPath(); ctx.arc(0, 0, 0.035, 0, TAU); ctx.fill(); ctx.stroke();
      }, 0, 0.1);
    }
  }
  // 頭の上の小物
  function drawAccTop(ctx, R, S, t, bodyCol) {
    var acc = S.acc, lw = Math.max(1.5, R * 0.04);
    ctx.save(); ctx.lineJoin = 'round';
    if (has(acc, 'horns')) {
      [-1, 1].forEach(function (s) {
        ctx.fillStyle = '#ffe9b0'; ctx.strokeStyle = INK; ctx.lineWidth = lw;
        ctx.beginPath(); ctx.moveTo(s * R * 0.24, -R * 0.93); ctx.quadraticCurveTo(s * R * 0.42, -R * 1.25, s * R * 0.52, -R * 1.32); ctx.quadraticCurveTo(s * R * 0.5, -R * 1.05, s * R * 0.5, -R * 0.82); ctx.closePath(); ctx.fill(); ctx.stroke();
      });
    }
    if (has(acc, 'catEars')) {
      [-1, 1].forEach(function (s) {
        ctx.fillStyle = bodyCol; ctx.strokeStyle = INK; ctx.lineWidth = lw;
        ctx.beginPath(); ctx.moveTo(s * R * 0.25, -R * 0.94); ctx.lineTo(s * R * 0.62, -R * 1.22); ctx.lineTo(s * R * 0.72, -R * 0.7); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ffb0c8';
        ctx.beginPath(); ctx.moveTo(s * R * 0.37, -R * 0.92); ctx.lineTo(s * R * 0.6, -R * 1.1); ctx.lineTo(s * R * 0.65, -R * 0.8); ctx.closePath(); ctx.fill();
      });
    }
    if (has(acc, 'afro')) {
      ctx.fillStyle = '#2a2420'; ctx.strokeStyle = '#111'; ctx.lineWidth = lw;
      for (var i = 0; i < 9; i++) { var a = PI + i / 8 * PI; ctx.beginPath(); ctx.arc(Math.cos(a) * R * 0.62, -R * 0.62 + Math.sin(a) * R * 0.5, R * 0.26, 0, TAU); ctx.fill(); }
      ctx.beginPath(); ctx.arc(0, -R * 1.0, R * 0.35, 0, TAU); ctx.fill();
    }
    if (has(acc, 'towel')) {
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(-R * 0.45, -R * 0.86); ctx.quadraticCurveTo(0, -R * 1.12, R * 0.45, -R * 0.86); ctx.lineTo(R * 0.42, -R * 1.0);
      ctx.quadraticCurveTo(0, -R * 1.26, -R * 0.42, -R * 1.0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#4a8ad8'; ctx.lineWidth = Math.max(1, R * 0.025);
      ctx.beginPath(); ctx.moveTo(-R * 0.43, -R * 0.93); ctx.quadraticCurveTo(0, -R * 1.18, R * 0.43, -R * 0.93); ctx.stroke();
    }
    if (has(acc, 'nightcap')) {   // ねぼすけ帽子
      ctx.fillStyle = '#4a7ad8'; ctx.strokeStyle = INK; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(-R * 0.5, -R * 0.8); ctx.quadraticCurveTo(0, -R * 1.25, R * 0.5, -R * 0.8);
      ctx.quadraticCurveTo(R * 0.7, -R * 1.3, R * 1.0, -R * 1.05); ctx.quadraticCurveTo(R * 0.4, -R * 1.45, -R * 0.5, -R * 0.8); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1, R * 0.05);
      ctx.beginPath(); ctx.moveTo(-R * 0.1, -R * 1.07); ctx.lineTo(R * 0.05, -R * 0.98); ctx.moveTo(R * 0.35, -R * 1.18); ctx.lineTo(R * 0.45, -R * 1.05); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.ellipse(0, -R * 0.84, R * 0.55, R * 0.1, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(R * 1.0, -R * 1.05, R * 0.11, 0, TAU); ctx.fill(); ctx.stroke();
    }
    if (has(acc, 'flower')) {
      flower(ctx, R * 0.5, -R * 0.88, R * 0.17, '#ff8fc0', 0.3);
    }
    ctx.restore();
  }

  // 体の色
  var BODY = {
    red: ['#ef3a37', '#bf1d25'], fire: ['#ff2a1a', '#9e0a10'], gold: ['#ffe27a', '#c98f12'], white: ['#ffffff', '#d4cdc2'],
    blue: ['#9ad6ff', '#3a7fd0'], yellow: ['#ffe24a', '#e0a010'], green: ['#5cd06a', '#1f8a3a'], purple: ['#b07ae0', '#5a2a9a'], black: ['#4a4450', '#141018'], stone: ['#bdb9b2', '#77736c'], soot: ['#6a2a24', '#2e100c'], pink: ['#ff9ac2', '#e0558f']
  };
  var FACE_COL = { angry: '#ffe9de', furious: '#ffd5c8', gold: '#fff2c8', stone: '#e4e2de', soot: '#e2d6c8', pale: '#eef6ff' };

  // ===== 頭を描く =====
  function drawHead(ctx, cx, cy, size, opts) {
    opts = opts || {};
    var R = size / 2;
    var t = opts.t || 0;
    var faceDef = opts.face ? FACE_BY_ID[opts.face] : null;
    var mood = MOOD_RECIPES[opts.mood] ? opts.mood : 'normal';
    var S = specOf(faceDef ? faceDef.recipe : MOOD_RECIPES[mood]);
    if (opts.oneEye) S.eyeR = eyeOf('white');
    var turn = clamp(opts.turn == null ? 1 : opts.turn, 0, 1);
    var dir = opts.dir === -1 ? -1 : 1;
    var shake = clamp(opts.shake || 0, 0, 1);
    // 0.5(横)で顔がちゃんと見えるように、回る角度を少しゆがめる
    var yaw = PI * Math.pow(1 - turn, 1.7) + S.yaw * turn * turn;
    var deco = '#f2c53d', deco2 = '#a8700c';
    if (S.body === 'gold') { deco = '#c0392b'; deco2 = '#7a1a10'; }
    else if (S.body === 'blue') { deco = '#ffffff'; deco2 = '#4a8ad8'; }
    else if (S.body === 'yellow') { deco = '#d0302a'; deco2 = '#7a1a10'; }
    else if (S.body === 'stone') { deco = '#8f8b84'; deco2 = '#5a5751'; }
    else if (S.body === 'soot') { deco = '#9a7a3a'; deco2 = '#5a4520'; }
    var P = { R: R, yaw: yaw, dir: dir, deco: deco, deco2: deco2, k: size < 70 ? 1.13 : 0 };
    var faceC = Math.cos(yaw);

    // 体の動き(起き上がりこぼしのように、底を中心にゆれる)
    var rot = 0, ox = 0, oy = 0, sx = 1, sy = 1;
    switch (S.anim) {
      case 'bounce': oy = -Math.abs(Math.sin(t * 12)) * R * 0.05; rot = Math.sin(t * 12) * 0.05; break;
      case 'wobble': rot = Math.sin(t * 2.6) * 0.12; break;
      case 'tremble': ox = Math.sin(t * 70) * R * 0.01; break;
      case 'trembleBig': ox = Math.sin(t * 70) * R * 0.025; rot = Math.sin(t * 53) * 0.03; break;
      case 'trembleSmall': ox = Math.sin(t * 45) * R * 0.005; break;
      case 'sway': rot = Math.sin(t * 3) * 0.035; break;
      case 'shy': rot = 0.05 * dir + Math.sin(t * 1.6) * 0.03; break;
      case 'doze': rot = Math.sin(t * 0.9) * 0.05; break;
      case 'tiltUp': rot = -0.07 * dir; break;
      case 'tiltL': rot = -0.12 * dir; break;
      case 'tiltBig': rot = 0.38 * dir; break;
      case 'bow': rot = 0.2 * dir; sy = 0.96; break;
      case 'shake': ox = Math.sin(t * 40) * R * 0.035; break;
      case 'jump': oy = -Math.abs(Math.sin(t * 5)) * R * 0.12; break;
      case 'roll': rot = Math.sin(t * 4) * 0.3; break;
      case 'squash': sx = 1 + 0.08 * Math.sin(t * 6); sy = 1 - 0.08 * Math.sin(t * 6); break;
      case 'twitch': if (fract(t * 1.3) < 0.12) { ox = R * 0.03; rot = 0.04; } break;
    }
    if (shake) { ox += Math.sin(t * 48) * shake * R * 0.05; rot += Math.sin(t * 37) * shake * 0.06; }
    var breathe = 1 + 0.012 * Math.sin(t * 2.2);

    ctx.save();
    ctx.translate(cx, cy);
    if (opts.shadow !== false) {
      var sg = ctx.createRadialGradient(0, R * BOTTOM, 0, 0, R * BOTTOM, R * 0.75);
      sg.addColorStop(0, 'rgba(0,0,0,0.32)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sg;
      ctx.beginPath(); ctx.ellipse(0, R * BOTTOM, R * 0.75, R * 0.14, 0, 0, TAU); ctx.fill();
    }
    ctx.translate(ox, oy + R * BOTTOM);
    ctx.rotate(rot);
    ctx.scale((2 - breathe) * sx, breathe * sy);
    ctx.translate(0, -R * BOTTOM);

    drawFxBack(ctx, R, S, t);

    // 体
    bodyPath(ctx, R);
    var bodyCol;
    if (S.body === 'rainbow') {
      var rg = ctx.createLinearGradient(-R, -R, R, R);
      for (var hi = 0; hi <= 6; hi++) rg.addColorStop(hi / 6, 'hsl(' + ((hi * 55 + t * 80) % 360) + ',85%,58%)');
      ctx.fillStyle = rg; bodyCol = '#ff6fa0';
    } else {
      var bc = BODY[S.body] || BODY.red;
      if (S.body === 'red' && S.tint === 'angry') bc = ['#ff3b2f', '#b3121c'];
      var base = ctx.createLinearGradient(0, -R, 0, R);
      base.addColorStop(0, bc[0]); base.addColorStop(1, bc[1]);
      ctx.fillStyle = base; bodyCol = bc[0];
    }
    ctx.fill();

    ctx.save();
    bodyPath(ctx, R); ctx.clip();

    drawBelly(ctx, P);
    drawSideSwirls(ctx, P);
    if (Math.cos(yaw - PI) > 0.02) drawBack(ctx, P, opts);

    var fc = FACE_COL[S.tint] || (S.body === 'gold' ? FACE_COL.gold : '#fffaf0');
    if (faceC > -0.6) {
      facePath(ctx, P);
      var fg = ctx.createRadialGradient(-R * 0.12, -R * 0.3, R * 0.05, 0, -R * 0.1, R * 0.75);
      fg.addColorStop(0, '#ffffff'); fg.addColorStop(0.7, fc); fg.addColorStop(1, '#f1dfc4');
      ctx.fillStyle = fg; ctx.fill();
      if (S.tint) {
        ctx.save(); facePath(ctx, P); ctx.clip();
        var tg = null, i2, pp;
        switch (S.tint) {
          case 'angry':
            tg = ctx.createLinearGradient(0, -R * 0.6, 0, R * 0.2);
            tg.addColorStop(0, 'rgba(255,40,30,' + (0.35 + 0.12 * Math.sin(t * 8)) + ')'); tg.addColorStop(1, 'rgba(255,60,40,0.08)'); break;
          case 'furious':
            tg = ctx.createLinearGradient(0, -R * 0.7, 0, R * 0.5);
            tg.addColorStop(0, 'rgba(230,10,10,' + (0.7 + 0.15 * Math.sin(t * 10)) + ')'); tg.addColorStop(1, 'rgba(255,40,20,0.35)'); break;
          case 'mean':
            tg = ctx.createLinearGradient(0, -R * 0.68, 0, -R * 0.3);
            tg.addColorStop(0, 'rgba(90,30,140,0.38)'); tg.addColorStop(1, 'rgba(90,30,140,0)'); break;
          case 'sad':
            tg = ctx.createLinearGradient(0, -R * 0.65, 0, -R * 0.2);
            tg.addColorStop(0, 'rgba(60,90,200,0.3)'); tg.addColorStop(1, 'rgba(60,90,200,0)'); break;
          case 'gloom':
            tg = ctx.createLinearGradient(0, -R * 0.7, 0, R * 0.1);
            tg.addColorStop(0, 'rgba(60,40,110,0.65)'); tg.addColorStop(1, 'rgba(60,40,110,0.05)'); break;
          case 'pale': tg = 'rgba(120,170,255,0.32)'; break;
          case 'green':
            tg = ctx.createLinearGradient(0, -R * 0.7, 0, R * 0.3);
            tg.addColorStop(0, 'rgba(90,190,60,0.6)'); tg.addColorStop(1, 'rgba(90,190,60,0.05)'); break;
          case 'yellow': tg = 'rgba(255,225,40,0.42)'; break;
          case 'pink': tg = 'rgba(255,110,160,0.26)'; break;
          case 'gold': tg = 'rgba(255,200,60,0.3)'; break;
          case 'grey': tg = 'rgba(120,120,130,0.4)'; break;
          case 'stone': tg = 'rgba(110,108,104,0.5)'; break;
          case 'soot': tg = 'rgba(60,40,30,0.45)'; break;
        }
        if (tg) { ctx.fillStyle = tg; ctx.fillRect(-R, -R, R * 2, R * 1.6); }
        if (S.tint === 'sad' || S.tint === 'gloom') {   // 縦線
          ctx.strokeStyle = S.tint === 'sad' ? 'rgba(50,70,160,0.55)' : 'rgba(30,20,60,0.7)'; ctx.lineWidth = Math.max(1, R * 0.018);
          for (i2 = -4; i2 <= 4; i2++) {
            pp = proj(P, i2 * 0.07, -0.6);
            ctx.beginPath(); ctx.moveTo(pp[0], pp[1]); ctx.lineTo(pp[0], pp[1] + R * (S.tint === 'gloom' ? 0.28 : (i2 % 2 ? 0.12 : 0.17))); ctx.stroke();
          }
        }
        if (S.tint === 'gekiga') {   // 劇画の斜線
          ctx.strokeStyle = 'rgba(30,20,15,0.6)'; ctx.lineWidth = Math.max(1, R * 0.018);
          for (i2 = 0; i2 < 7; i2++) {
            [-1, 1].forEach(function (s) {
              var q = proj(P, s * (0.5 - i2 * 0.012), -0.4 + i2 * 0.11);
              ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.lineTo(q[0] - s * R * 0.12, q[1] + R * 0.07); ctx.stroke();
            });
          }
        }
        if (S.tint === 'stone') {    // 石のヒビ
          ctx.strokeStyle = 'rgba(60,58,55,0.8)'; ctx.lineWidth = Math.max(1, R * 0.02);
          var c1 = proj(P, -0.2, -0.55), c2 = proj(P, -0.1, -0.3), c3 = proj(P, -0.22, -0.1);
          ctx.beginPath(); ctx.moveTo(c1[0], c1[1]); ctx.lineTo(c2[0], c2[1]); ctx.lineTo(c3[0], c3[1]); ctx.stroke();
        }
        ctx.restore();
      }
      // 金のふち
      facePath(ctx, P);
      ctx.lineJoin = 'round';
      ctx.lineWidth = R * 0.085; ctx.strokeStyle = S.body === 'gold' ? '#7a1a10' : '#a8700c'; ctx.stroke();
      ctx.lineWidth = R * 0.055; ctx.strokeStyle = S.body === 'gold' ? '#c0392b' : (S.body === 'stone' ? '#9a968f' : '#f4c63e'); ctx.stroke();
      ctx.lineWidth = R * 0.015; ctx.strokeStyle = '#fff1a8';
      facePath(ctx, P, 0.012); ctx.stroke();

      // ほっぺ
      if (S.cheek > 0 || S.puff) {
        [-1, 1].forEach(function (s) {
          feat(ctx, P, s * (S.puff ? 0.42 : 0.45), S.puff ? 0.17 : 0.1, function () {
            var big = S.cheek > 1 ? 1.3 : 1, a = Math.min(1, S.cheek);
            if (S.puff) {   // ぷくー
              var pg = ctx.createRadialGradient(-0.05, -0.06, 0.02, 0, 0, 0.21);
              pg.addColorStop(0, '#ffd0d4'); pg.addColorStop(1, '#ff7f8c');
              ctx.fillStyle = pg; ctx.strokeStyle = INK; ctx.lineWidth = 0.03;
              ctx.beginPath(); ctx.arc(0, 0, 0.21, 0, TAU); ctx.fill(); ctx.stroke();
              ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(-0.07, -0.08, 0.04, 0, TAU); ctx.fill();
              return;
            }
            var cg = ctx.createRadialGradient(0, 0, 0, 0, 0, 0.11 * big);
            cg.addColorStop(0, 'rgba(255,95,120,' + (0.75 * a) + ')'); cg.addColorStop(1, 'rgba(255,95,120,0)');
            ctx.fillStyle = cg;
            ctx.beginPath(); ctx.ellipse(0, 0, 0.14 * big, 0.09 * big, 0, 0, TAU); ctx.fill();
            if (S.cheek > 1) {
              ctx.strokeStyle = 'rgba(220,40,80,0.8)'; ctx.lineWidth = 0.018; ctx.lineCap = 'round';
              ctx.beginPath();
              for (var k = -1; k <= 1; k++) { ctx.moveTo(k * 0.055 - 0.02, 0.035); ctx.lineTo(k * 0.055 + 0.025, -0.035); }
              ctx.stroke();
            }
          }, 0, 0.1);
        });
      }
      drawBrow(ctx, P, S.browL, -1);
      drawBrow(ctx, P, S.browR, 1);
      var bl = blinkOpen(t, 0);
      var lookAdd = [0, 0];
      if (opts.look) { S.eyeL.look = opts.look; S.eyeR.look = opts.look; }
      else if (turn < 1 && faceC > 0) lookAdd = [-dir * Math.sin(yaw) * 0.8, 0];
      drawEye(ctx, P, S.eyeL, -1, t, bl, fc, lookAdd);
      drawEye(ctx, P, S.eyeR, 1, t, bl, fc, lookAdd);
      // 鼻
      feat(ctx, P, 0, 0.04, function () {
        var red = S.nose === 'red';
        ctx.fillStyle = red ? '#ff3b30' : '#f5a48e'; ctx.strokeStyle = INK; ctx.lineWidth = 0.022;
        ctx.beginPath(); ctx.ellipse(0, red ? 0.01 : 0, red ? 0.09 : 0.05, red ? 0.08 : 0.04, 0, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath(); ctx.arc(red ? -0.03 : -0.012, red ? -0.02 : -0.01, red ? 0.022 : 0.01, 0, TAU); ctx.fill();
      }, 0, 0.1);
      drawMustache(ctx, P, -1, S, t);
      drawMustache(ctx, P, 1, S, t);
      drawMouth(ctx, P, S.mouth, t);
      drawBeard(ctx, P, S.mouth);
      if (S.bubble) {   // 鼻ちょうちん
        feat(ctx, P, 0.04, 0.07, function () {
          var br = 0.13 + 0.07 * (0.5 + 0.5 * Math.sin(t * 1.4));
          ctx.fillStyle = 'rgba(190,230,255,0.55)'; ctx.strokeStyle = 'rgba(70,130,200,0.9)'; ctx.lineWidth = 0.015;
          ctx.beginPath(); ctx.arc(br * 0.8, br * 0.6, br, 0, TAU); ctx.fill(); ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.beginPath(); ctx.arc(br * 0.5, br * 0.25, br * 0.22, 0, TAU); ctx.fill();
        }, 0, 0.2);
      }
      drawFaceFx(ctx, P, S, t);
      drawAccFace(ctx, P, S, t);
    }
    if (S.blind) drawBand(ctx, P, t, EYE.v - 0.15, EYE.v + 0.13, 'blind');
    if (has(S.acc, 'hachimaki')) drawBand(ctx, P, t, -0.86, -0.7, 'hachimaki');

    // 光と影(つやつやの漆)
    var sh = ctx.createRadialGradient(-R * 0.32, -R * 0.42, R * 0.1, 0, 0, R * 1.2);
    sh.addColorStop(0, 'rgba(255,255,255,0.16)');
    sh.addColorStop(0.5, 'rgba(255,255,255,0)');
    sh.addColorStop(0.85, 'rgba(70,0,10,0.18)');
    sh.addColorStop(1, 'rgba(60,0,10,0.45)');
    ctx.fillStyle = sh; ctx.fillRect(-R * 1.2, -R * 1.2, R * 2.4, R * 2.4);
    ctx.save();
    ctx.translate(-R * 0.45, -R * 0.62); ctx.rotate(-0.65);
    var hg = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.22);
    hg.addColorStop(0, 'rgba(255,255,255,0.75)'); hg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.ellipse(0, 0, R * 0.24, R * 0.1, 0, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.restore(); // clip

    bodyPath(ctx, R);
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(R < 25 ? 1.5 : 2.5, R * 0.05); ctx.strokeStyle = INK; ctx.stroke();

    drawAccTop(ctx, R, S, t, bodyCol);
    drawFxTop(ctx, R, S, t, faceC, dir);
    ctx.restore();
  }

  // 表情 id で前向きのだるまを描く
  function drawFace(ctx, cx, cy, size, faceId, opts) {
    var o = {}, k;
    if (opts) for (k in opts) o[k] = opts[k];
    o.face = faceId; if (o.turn == null) o.turn = 1;
    drawHead(ctx, cx, cy, size, o);
  }
  // まだ見ていない顔(「?」の影絵)
  function drawFaceLocked(ctx, cx, cy, size) {
    var R = size / 2;
    ctx.save(); ctx.translate(cx, cy);
    bodyPath(ctx, R);
    ctx.fillStyle = '#3b3152'; ctx.fill();
    ctx.lineWidth = Math.max(1.5, R * 0.05); ctx.strokeStyle = '#1d1730'; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, (FACE.v + 0.04) * R, FACE.rx * R, FACE.ry * R, 0, 0, TAU);
    ctx.fillStyle = '#4e4469'; ctx.fill();
    outlinedText(ctx, '?', 0, (FACE.v + 0.06) * R, Math.max(8, Math.round(R * 0.85)), '#d9d0f0', '#1d1730');
    ctx.restore();
  }
  // 結果画面用: 表情の小さな絵を1回だけ描いてためておく(毎フレーム100こ描かなくてよい)
  var thumbCache = {};
  function faceThumb(faceId, size, scale) {
    scale = scale || 2;
    var key = faceId + '|' + size + '|' + scale;
    if (thumbCache[key]) return thumbCache[key];
    var W = Math.ceil(size * 1.5 * scale), c = makeCanvas(W, W), x = c.getContext('2d');
    x.setTransform(scale, 0, 0, scale, 0, 0);
    if (faceId && FACE_BY_ID[faceId]) drawFace(x, size * 0.75, size * 0.78, size, faceId, { t: 0.8, shadow: false });
    else drawFaceLocked(x, size * 0.75, size * 0.78, size);
    thumbCache[key] = c;
    return c;
  }

  // ===============================================================
  // ゴールデンだるま(風船のように顔がパンパンにふくらむ → くす玉のように弾ける)
  // ===============================================================
  // ふくらみの度合い。顔(ほっぺ)が先、体はあとから、最後にパンパンでテカる
  function gbState(R, u, t) {
    u = clamp(u, 0, 1);
    return { R: R, u: u, t: t, fa: smooth(u / 0.55), ba: smooth((u - 0.15) / 0.85), ta: smooth((u - 0.86) / 0.14) };
  }
  function gbW(n, G) {   // 高さ n での体の横はば(px)
    var base = rowR(n), circ = 0.98 * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(n), 2.4)), 1 / 2.4) * (1 + 0.04 * n);
    var w = lerp(base, circ, G.ba) * (1 + 0.2 * G.ba + 0.05 * G.fa * Math.exp(-Math.pow((n - 0.1) / 0.5, 2)));
    return w * G.R;
  }
  function gbY(n, G) { return n < 0 ? n * G.R * (1 + 0.55 * G.ba) : n * G.R * (1 + 0.08 * G.ba); }
  function gbPath(ctx, G) {
    var N = 56, i, th, n, tmax = Math.acos(-BOTTOM), pts = [];
    for (i = 0; i <= N; i++) {
      th = tmax * i / N; n = -Math.cos(th);
      var wob = G.ta * G.R * 0.014 * Math.sin(th * 7 + G.t * 26);   // パンパンで表面がぷるぷる
      pts.push([gbW(n, G) + wob, gbY(n, G)]);
    }
    ctx.beginPath();
    ctx.moveTo(0, pts[0][1]);
    for (i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    for (i = pts.length - 1; i >= 0; i--) ctx.lineTo(-pts[i][0], pts[i][1]);
    ctx.closePath();
  }
  // 顔の位置と大きさ
  function gbFace(G) {
    var R = G.R, fa = G.fa, ba = G.ba;
    var fy = -0.04 * R;
    var F = {
      fy: fy, rx: 0.7 * R * (1 + 0.12 * ba + 0.05 * fa), ry: 0.56 * R * (1 + 0.12 * ba + 0.03 * fa),
      cx: (0.45 + 0.16 * fa + 0.16 * ba) * R, cy: fy + 0.2 * R * (1 + 0.2 * ba), cr: R * (0.05 + 0.3 * fa + 0.13 * ba)
    };
    F.ex = 0.26 * R * (1 + 0.12 * ba); F.ey = fy - (0.13 + 0.06 * fa) * R * (1 + 0.15 * ba); F.er = 0.165 * R * (1 - 0.18 * fa);
    F.ny = fy + 0.11 * R * (1 + 0.2 * ba); F.my = fy + 0.31 * R * (1 + 0.22 * ba);
    return F;
  }
  function gbFaceShapes(ctx, F, grow) {
    ctx.beginPath(); ctx.ellipse(0, F.fy, F.rx + grow, F.ry + grow, 0, 0, TAU);
    if (F.cr > 2) { ctx.moveTo(F.cx + F.cr + grow, F.cy); ctx.arc(F.cx, F.cy, F.cr + grow, 0, TAU); ctx.moveTo(-F.cx + F.cr + grow, F.cy); ctx.arc(-F.cx, F.cy, F.cr + grow, 0, TAU); }
  }

  // ゴールデンだるま本体(原点=頭の中心。底は R*BOTTOM の高さに固定)
  function drawGB(ctx, R, u, t, opts) {
    var G = gbState(R, u, t), F = gbFace(G), fa = G.fa, ba = G.ba, ta = G.ta, i, s;
    var lw = Math.max(2, R * 0.045);
    ctx.save();
    ctx.translate(0, R * BOTTOM - gbY(BOTTOM, G));   // 底を動かさない(上へ のびる)
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';

    var bare = opts && opts.bare;
    // 後ろの金の光(パンパンになるほど強く)
    var glowR = R * (1.3 + 0.5 * u);
    var ag = ctx.createRadialGradient(0, -R * 0.1, R * 0.4, 0, -R * 0.1, glowR);
    ag.addColorStop(0, 'rgba(255,225,120,' + (0.35 + 0.35 * u) + ')'); ag.addColorStop(1, 'rgba(255,225,120,0)');
    if (!bare) { ctx.fillStyle = ag; ctx.beginPath(); ctx.arc(0, -R * 0.1, glowR, 0, TAU); ctx.fill(); }

    // 金の体
    gbPath(ctx, G);
    var bg = ctx.createRadialGradient(-R * 0.35, -R * 0.55 * (1 + 0.3 * ba), R * 0.05, 0, 0, R * (1.35 + 0.4 * ba));
    bg.addColorStop(0, '#fff8c8'); bg.addColorStop(0.35, '#ffd84a'); bg.addColorStop(0.75, '#e0a516'); bg.addColorStop(1, '#9a6406');
    ctx.fillStyle = bg; ctx.fill();

    ctx.save();
    gbPath(ctx, G); ctx.clip();
    // 赤い帯(のびた体に沿う)
    [0.57, 0.83].forEach(function (n) {
      var w = gbW(n, G), y = gbY(n, G);
      ctx.beginPath(); ctx.ellipse(0, y, w, w * TILT * 1.4, 0, 0, PI);
      ctx.lineWidth = R * 0.05; ctx.strokeStyle = '#c62828'; ctx.stroke();
    });
    ctx.restore(); // ここで体のクリップをやめる(ほっぺが体からはみ出す)
    gbPath(ctx, G); ctx.lineWidth = lw; ctx.strokeStyle = '#5a3a06'; ctx.stroke();
    // 顔(ほっぺが ぷくーっと張り出す)
    ctx.fillStyle = '#5a3a06'; gbFaceShapes(ctx, F, R * 0.05 + lw * 0.6); ctx.fill();
    ctx.fillStyle = '#a8700c'; gbFaceShapes(ctx, F, R * 0.05); ctx.fill();
    ctx.fillStyle = '#f7cf48'; gbFaceShapes(ctx, F, R * 0.032); ctx.fill();
    var fg = ctx.createRadialGradient(-R * 0.1, F.fy - R * 0.2, R * 0.05, 0, F.fy, F.rx * 1.2);
    fg.addColorStop(0, '#ffffff'); fg.addColorStop(0.75, '#fff8ea'); fg.addColorStop(1, '#f6e2c2');
    ctx.fillStyle = fg; gbFaceShapes(ctx, F, 0); ctx.fill();
    // 赤らむ
    var red = smooth((u - 0.4) / 0.45);
    ctx.save(); gbFaceShapes(ctx, F, 0); ctx.clip();
    if (red > 0) { ctx.fillStyle = 'rgba(255,60,50,' + (0.42 * red + 0.06 * red * Math.sin(t * 9)) + ')'; ctx.fillRect(-R * 2, -R * 2, R * 4, R * 4); }
    // ほっぺの赤と つや
    [-1, 1].forEach(function (s2) {
      var x = s2 * F.cx, r = Math.max(F.cr, R * 0.12);
      var cg = ctx.createRadialGradient(x, F.cy, 0, x, F.cy, r * 0.95);
      cg.addColorStop(0, 'rgba(255,90,110,' + (0.35 + 0.45 * fa) + ')'); cg.addColorStop(1, 'rgba(255,90,110,0)');
      ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(x, F.cy, r, 0, TAU); ctx.fill();
      if (fa > 0.15) {
        ctx.fillStyle = 'rgba(255,255,255,' + (0.85 * fa) + ')';
        ctx.beginPath(); ctx.ellipse(x - s2 * F.cr * 0.15 - F.cr * 0.25, F.cy - F.cr * 0.45, F.cr * 0.26, F.cr * 0.15, -0.5, 0, TAU); ctx.fill();
      }
    });
    ctx.restore();
    // ほっぺの ふくらみの線
    if (F.cr > R * 0.12) {
      ctx.strokeStyle = 'rgba(160,80,40,0.55)'; ctx.lineWidth = Math.max(1, R * 0.02);
      [-1, 1].forEach(function (s2) { ctx.beginPath(); ctx.arc(s2 * F.cx, F.cy, F.cr * 0.98, s2 > 0 ? 0.2 : PI - 1.2, s2 > 0 ? 1.2 : PI - 0.2); ctx.stroke(); });
    }

    // 眉(ふんばって ハの字に上がる)
    [-1, 1].forEach(function (s2) {
      var st = u, ix = s2 * (0.08 * R), iy = F.ey - R * (0.25 + 0.14 * st), ox = s2 * (F.ex + 0.2 * R), oy = F.ey - R * (0.27 - 0.03 * st);
      ctx.fillStyle = INK;
      brush(ctx, [ix, iy], [lerp(ix, ox, 0.33), lerp(iy, oy, 0.33) - R * 0.08], [lerp(ix, ox, 0.7), lerp(iy, oy, 0.7) - R * 0.07], [ox, oy], R * (0.13 + 0.03 * st), R * 0.025, R * 0.04);
    });
    // 目
    var sq = u >= 0.52 && u < 0.8, pop = u >= 0.8;
    [-1, 1].forEach(function (s2) {
      var x = s2 * F.ex, y = F.ey, r = F.er;
      if (pop) {   // 目玉が とびだしそう
        var pk = smooth((u - 0.8) / 0.15), rr = r * (1.05 + 0.4 * pk), jx = Math.sin(t * 47 + s2 * 2) * R * 0.012, jy = Math.cos(t * 39 + s2) * R * 0.012;
        ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = R * 0.045;
        ctx.beginPath(); ctx.arc(x + jx, y + jy, rr, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(230,40,40,0.85)'; ctx.lineWidth = Math.max(1, R * 0.014);
        for (var vi = 0; vi < 6; vi++) {
          var va = vi / 6 * TAU + 0.3;
          ctx.beginPath(); ctx.moveTo(x + jx + Math.cos(va) * rr * 0.95, y + jy + Math.sin(va) * rr * 0.95);
          ctx.quadraticCurveTo(x + jx + Math.cos(va + 0.3) * rr * 0.6, y + jy + Math.sin(va + 0.3) * rr * 0.6, x + jx + Math.cos(va) * rr * 0.4, y + jy + Math.sin(va) * rr * 0.4); ctx.stroke();
        }
        ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x + jx, y + jy, rr * 0.2, 0, TAU); ctx.fill();
        ctx.strokeStyle = INK; ctx.lineWidth = R * 0.045; ctx.beginPath(); ctx.arc(x + jx, y + jy, rr, 0, TAU); ctx.stroke();
        return;
      }
      if (sq) {   // > < (ぎゅーっ)
        var k = 0.75 + 0.35 * smooth((u - 0.52) / 0.4), tr = ta * Math.sin(t * 50 + s2) * R * 0.01;
        ctx.strokeStyle = INK; ctx.lineWidth = R * (0.06 + 0.02 * k);
        ctx.beginPath(); ctx.moveTo(x + s2 * r * 0.9 * k, y - r * 0.8 * k + tr); ctx.lineTo(x - s2 * r * 0.8 * k, y + tr); ctx.lineTo(x + s2 * r * 0.9 * k, y + r * 0.8 * k + tr); ctx.stroke();
        // しわ
        ctx.lineWidth = Math.max(1, R * 0.018);
        ctx.beginPath(); ctx.moveTo(x + s2 * r * 1.3, y - r * 0.5); ctx.lineTo(x + s2 * r * 1.6, y - r * 0.7); ctx.moveTo(x + s2 * r * 1.35, y + r * 0.1); ctx.lineTo(x + s2 * r * 1.7, y + r * 0.1); ctx.stroke();
        return;
      }
      var low = Math.min(0.7, fa * 1.1), lid = 0.12 * fa + 0.3 * smooth((u - 0.35) / 0.17);
      ctx.save();
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 1.04, 0, 0, TAU); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.clip();
      var pr = r * (0.56 - 0.12 * fa);
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x, y - r * 0.15 * fa, pr, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x - pr * 0.35, y - r * 0.15 * fa - pr * 0.4, pr * 0.33, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff8ea';
      var y1 = y + r * 1.04 - 2 * r * 1.04 * low;   // 下からほっぺに押される
      ctx.beginPath(); ctx.moveTo(x - r * 1.2, y1 + r * 0.25); ctx.quadraticCurveTo(x, y1 - r * 0.25, x + r * 1.2, y1 + r * 0.25); ctx.lineTo(x + r * 1.2, y + r * 2); ctx.lineTo(x - r * 1.2, y + r * 2); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = R * 0.03; ctx.stroke();
      if (lid > 0.01) {
        var y0 = y - r * 1.04 + 2 * r * 1.04 * lid;
        ctx.fillStyle = '#fff8ea'; ctx.fillRect(x - r * 1.2, y - r * 1.5, r * 2.4, y0 - (y - r * 1.5));
        ctx.lineWidth = R * 0.04; ctx.beginPath(); ctx.moveTo(x - r * 1.2, y0); ctx.lineTo(x + r * 1.2, y0); ctx.stroke();
      }
      ctx.restore();
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 1.04, 0, 0, TAU); ctx.strokeStyle = INK; ctx.lineWidth = R * 0.04; ctx.stroke();
    });
    // なみだ(ぎゅーっのとき、ぴゅっと出る)
    if (u > 0.7) {
      [-1, 1].forEach(function (s2) {
        for (var j = 0; j < 2; j++) {
          var p = fract(t * 1.8 + j * 0.5 + (s2 > 0 ? 0.25 : 0)), x = s2 * (F.ex + F.er * (1 + p * 2.2)), y = F.ey - Math.sin(p * PI) * R * 0.18 + p * R * 0.1;
          ctx.globalAlpha = 1 - p; ctx.fillStyle = 'rgba(150,215,255,0.95)'; ctx.strokeStyle = '#2f78c4'; ctx.lineWidth = Math.max(1, R * 0.015);
          drop(ctx, x, y, R * 0.06); ctx.fill(); ctx.stroke();
        }
      });
      ctx.globalAlpha = 1;
    }
    // 鼻(パンパンになると鼻の穴が広がる)
    var nf = smooth((u - 0.58) / 0.3), np = 1 + 0.12 * nf * Math.sin(t * 9);
    ctx.save(); ctx.translate(0, F.ny); ctx.scale(np, np);
    ctx.fillStyle = red > 0.3 ? '#ff7a6a' : '#f5a48e'; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1, R * 0.022);
    ctx.beginPath(); ctx.ellipse(0, 0, R * (0.05 + 0.06 * nf), R * (0.04 + 0.045 * nf), 0, 0, TAU); ctx.fill(); ctx.stroke();
    if (nf > 0.02) {
      ctx.fillStyle = '#3a1410';
      [-1, 1].forEach(function (s2) { ctx.beginPath(); ctx.ellipse(s2 * R * 0.04 * (0.6 + 0.4 * nf), R * 0.012, R * 0.018 * (0.4 + nf), R * 0.026 * (0.4 + nf), s2 * 0.4, 0, TAU); ctx.fill(); });
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(-R * 0.012, -R * 0.01, R * 0.01, 0, TAU); ctx.fill();
    }
    ctx.restore();
    // 口ひげ(ほっぺに押されて 横へ・上へ)
    [-1, 1].forEach(function (s2) {
      var ny = F.ny + R * 0.06, tipx = s2 * (0.37 + 0.33 * fa + 0.15 * ba) * R, tipy = ny - R * (0.05 + 0.12 * fa);
      var wig = ta * Math.sin(t * 30) * R * 0.015;
      ctx.fillStyle = INK;
      brush(ctx, [s2 * R * 0.04, ny], [s2 * R * 0.14, ny - R * 0.05], [tipx * 0.72, ny + R * 0.08], [tipx, tipy + wig], R * 0.09, R * 0.016, R * 0.012);
    });
    // 口(段階で変わる: o → むぎゅ → 3 → ちいさな o)
    var my = F.my, mt = ta * Math.sin(t * 40) * R * 0.006;
    ctx.save(); ctx.translate(mt, my);
    ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1.2, R * 0.035);
    if (u < 0.18) {
      ctx.fillStyle = '#9b2228'; ctx.beginPath(); ctx.ellipse(0, 0, R * 0.06, R * 0.075, 0, 0, TAU); ctx.fill(); ctx.stroke();
    } else if (u < 0.42) {
      var mw = R * (0.09 - 0.04 * smooth((u - 0.18) / 0.24));
      ctx.lineWidth = R * 0.045; ctx.beginPath(); ctx.moveTo(-mw, 0); ctx.quadraticCurveTo(0, R * 0.02, mw, 0); ctx.stroke();
      ctx.lineWidth = Math.max(1, R * 0.02); ctx.beginPath(); ctx.arc(-mw - R * 0.02, 0, R * 0.02, -1, 1); ctx.moveTo(mw + R * 0.02 + R * 0.02 * Math.cos(PI - 1), R * 0.02 * Math.sin(PI - 1)); ctx.arc(mw + R * 0.02, 0, R * 0.02, PI - 1, PI + 1); ctx.stroke();
    } else if (u < 0.72) {   // 「3」のとがらせ口(ピンクのくちびる)
      var lk = R * (0.07 + 0.03 * smooth((u - 0.42) / 0.3));
      ctx.beginPath(); ctx.moveTo(-lk * 0.45, -lk * 0.85); ctx.quadraticCurveTo(lk * 1.1, -lk * 0.95, 0, 0); ctx.quadraticCurveTo(lk * 1.1, lk * 0.95, -lk * 0.45, lk * 0.85);
      ctx.lineWidth = lk * 0.55; ctx.strokeStyle = '#7a1020'; ctx.stroke();
      ctx.lineWidth = lk * 0.32; ctx.strokeStyle = '#ff6f86'; ctx.stroke();
    } else {                 // ちいさな o(すぼまって しわしわ)
      var orr = R * (0.045 - 0.018 * smooth((u - 0.72) / 0.25));
      ctx.fillStyle = '#9b2228'; ctx.beginPath(); ctx.arc(0, 0, orr, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.lineWidth = Math.max(1, R * 0.018); ctx.beginPath();
      for (i = 0; i < 10; i++) { var a = i / 10 * TAU; ctx.moveTo(Math.cos(a) * orr * 1.5, Math.sin(a) * orr * 1.5); ctx.lineTo(Math.cos(a) * orr * 2.4, Math.sin(a) * orr * 2.4); }
      ctx.stroke();
    }
    ctx.restore();

    // つや(パンパンになるほど テカテカ)
    var sh = ctx.createRadialGradient(-R * 0.3, -R * 0.4, R * 0.1, 0, 0, R * (1.3 + 0.4 * ba));
    sh.addColorStop(0, 'rgba(255,255,255,0.12)'); sh.addColorStop(0.55, 'rgba(255,255,255,0)'); sh.addColorStop(0.88, 'rgba(120,60,0,0.15)'); sh.addColorStop(1, 'rgba(90,40,0,0.45)');
    ctx.save(); gbPath(ctx, G); ctx.clip();
    ctx.fillStyle = sh; ctx.fillRect(-R * 2.5, -R * 2.5, R * 5, R * 5);
    var topY = gbY(-1, G);
    ctx.save(); ctx.translate(-R * (0.42 + 0.15 * ba), topY * 0.62); ctx.rotate(-0.7);
    var hl = ctx.createRadialGradient(0, 0, 0, 0, 0, R * (0.26 + 0.12 * u));
    hl.addColorStop(0, 'rgba(255,255,255,' + (0.8 + 0.2 * u) + ')'); hl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hl; ctx.beginPath(); ctx.ellipse(0, 0, R * (0.28 + 0.14 * u), R * (0.11 + 0.05 * u), 0, 0, TAU); ctx.fill();
    ctx.restore();
    if (ta > 0) {    // もう限界: 体が ピカピカ点滅
      ctx.fillStyle = 'rgba(255,255,230,' + (0.22 * ta * (0.5 + 0.5 * Math.sin(t * 22))) + ')'; ctx.fillRect(-R * 2.5, -R * 2.5, R * 5, R * 5);
    }
    if (u > 0.6) {   // 窓のような光の帯
      var k2 = smooth((u - 0.6) / 0.35);
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.7 * k2) + ')'; ctx.lineWidth = R * 0.05 * k2;
      ctx.beginPath(); ctx.arc(0, -R * 0.05, gbW(0, G) * 0.86, PI * 1.12, PI * 1.38); ctx.stroke();
      ctx.lineWidth = R * 0.03 * k2; ctx.beginPath(); ctx.arc(0, -R * 0.05, gbW(0, G) * 0.86, PI * 1.43, PI * 1.5); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -R * 0.05, gbW(0, G) * 0.9, PI * 0.08, PI * 0.2); ctx.stroke();
    }
    ctx.restore(); // clip

    if (bare) { ctx.restore(); return G; }
    // まわり: キラキラ・汗・血管マーク・ピキピキ線
    var nsp = 3 + Math.round(4 * u), wB = gbW(0, G), hT = -topY;
    for (i = 0; i < nsp; i++) {
      var a2 = i / nsp * TAU + 0.4, tw = 0.5 + 0.5 * Math.sin(t * 5 + i * 1.9);
      sparkle(ctx, Math.cos(a2) * (wB + R * 0.22), -R * 0.1 + Math.sin(a2) * (hT * 0.55 + R * 0.4), R * (0.05 + 0.08 * tw), i % 2 ? '#fff6c0' : '#ffffff');
    }
    var nsw = Math.floor(smooth((u - 0.38) / 0.5) * 4 + 0.001);
    for (i = 0; i < nsw; i++) {
      var p2 = fract(t * 1.3 + i / 4), a3 = [-2.5, -0.65, -2.05, -1.1][i];
      ctx.globalAlpha = 1 - p2;
      sweatDrop(ctx, Math.cos(a3) * (wB * 0.9 + p2 * R * 0.35), -R * 0.15 + Math.sin(a3) * (hT * 0.75 + p2 * R * 0.3), R * 0.09, R);
    }
    ctx.globalAlpha = 1;
    if (u > 0.64) angerMark(ctx, wB * 0.62, -hT * 0.62, R * (0.22 + 0.04 * Math.sin(t * 12)));
    if (u > 0.8) {
      angerMark(ctx, -wB * 0.66, -hT * 0.5, R * (0.18 + 0.04 * Math.sin(t * 12 + 1)));
      angerMark(ctx, wB * 0.1, -hT * 0.92, R * (0.16 + 0.04 * Math.sin(t * 12 + 2)));
    }
    if (ta > 0) {   // ピキピキ(もう限界)
      ctx.strokeStyle = 'rgba(90,50,0,' + ta + ')'; ctx.lineWidth = Math.max(1.2, R * 0.03);
      for (i = 0; i < 10; i++) {
        if ((Math.floor(t * 14) + i) % 3 === 0) continue;
        var a4 = i / 10 * TAU, ex = Math.cos(a4), ey = Math.sin(a4);
        var bx = ex * (wB + R * 0.12), by = -R * 0.1 + ey * (hT * 0.8 + R * 0.12);
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + ex * R * 0.16, by + ey * R * 0.16); ctx.stroke();
      }
    }
    ctx.restore();
    return G;
  }

  // inflate 0〜1。size は ふくらむ前の直径(底は cy + size*HEAD_BOTTOM に固定。ふくらむと 横1.4倍・上へ1.4倍くらいになる)
  function drawGoldenBalloon(ctx, cx, cy, size, inflate, opts) {
    opts = opts || {};
    var R = size / 2, t = opts.t || 0, u = clamp(inflate || 0, 0, 1), shake = clamp(opts.shake || 0, 0, 1);
    var ta = smooth((u - 0.86) / 0.14);
    var ox = Math.sin(t * 61) * R * 0.012 * ta + Math.sin(t * 48) * shake * R * 0.05;
    var rot = Math.sin(t * 37) * shake * 0.06 + Math.sin(t * 43) * 0.01 * ta;
    ctx.save();
    ctx.translate(cx, cy);
    if (opts.shadow !== false) {
      var sg = ctx.createRadialGradient(0, R * BOTTOM, 0, 0, R * BOTTOM, R * 0.8);
      sg.addColorStop(0, 'rgba(0,0,0,0.3)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sg; ctx.beginPath(); ctx.ellipse(0, R * BOTTOM, R * 0.8, R * 0.14, 0, 0, TAU); ctx.fill();
    }
    ctx.translate(ox, R * BOTTOM); ctx.rotate(rot); ctx.translate(0, -R * BOTTOM);
    var br = 1 + 0.015 * Math.sin(t * 2.4) * (1 - ta);
    ctx.translate(0, R * BOTTOM); ctx.scale(2 - br, br); ctx.translate(0, -R * BOTTOM);
    drawGB(ctx, R, u, t, opts);
    ctx.restore();
  }

  // ---- 弾ける(くす玉) ----
  var popParts = null;
  function makePopParts() {
    var r = rng(4242), list = [], i, types = ['conf', 'conf', 'conf', 'conf', 'star', 'star', 'petal', 'petal', 'daruma'];
    var cols = ['#ff3b5c', '#ffd23f', '#3cc8ff', '#7ce06a', '#c38bff', '#ff8fc0', '#ffffff', '#ff9a1f'];
    for (i = 0; i < 150; i++) {
      var tp = types[Math.floor(r() * types.length)];
      list.push({
        tp: tp, a: -PI / 2 + (r() - 0.5) * PI * 1.9, sp: 1.4 + 2.6 * r(), spin: (r() - 0.5) * 18, flip: 4 + r() * 10,
        col: tp === 'star' ? (r() < 0.6 ? 'gold' : 'silver') : tp === 'petal' ? (r() < 0.5 ? '#ffb7d0' : '#ffd9e6') : cols[Math.floor(r() * cols.length)],
        sz: 0.7 + r() * 0.7, ph: r() * TAU, dl: r() * 0.06, sway: 0.5 + r()
      });
    }
    for (i = 0; i < 14; i++) list.push({ tp: 'tape', a: -PI / 2 + (r() - 0.5) * PI * 1.7, sp: 1.6 + 1.6 * r(), col: cols[i % cols.length], ph: r() * TAU, dl: 0, sz: 1, spin: 0, flip: 0, sway: 1 });
    return list;
  }
  // 粒の位置(空気抵抗と重力つき)。tau 秒後
  function partPos(p, tau, S) {
    var T = 0.32, f = T * (1 - Math.exp(-tau / T));
    return [Math.cos(p.a) * p.sp * S * f + Math.sin(tau * 3 * p.sway + p.ph) * S * 0.06 * Math.min(1, tau * 2),
      Math.sin(p.a) * p.sp * S * f + 0.55 * S * tau * tau];
  }
  function drawPart(ctx, p, x, y, tau, S, alpha) {
    var s = S * 0.03 * p.sz;
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.rotate(p.ph + p.spin * tau);
    var fl = Math.cos(p.ph + p.flip * tau);
    switch (p.tp) {
      case 'conf':
        ctx.scale(1, fl); ctx.fillStyle = p.col; ctx.fillRect(-s * 0.7, -s * 0.4, s * 1.4, s * 0.8); break;
      case 'star': {
        var g = ctx.createRadialGradient(-s * 0.3, -s * 0.3, 0, 0, 0, s * 1.3);
        if (p.col === 'gold') { g.addColorStop(0, '#fffbd0'); g.addColorStop(0.5, '#ffd23a'); g.addColorStop(1, '#d08a00'); }
        else { g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#d8dde6'); g.addColorStop(1, '#8a93a3'); }
        ctx.fillStyle = g; star(ctx, 0, 0, s * 1.25 * (0.85 + 0.15 * Math.sin(tau * 20 + p.ph)), 5, 0.47, 0); ctx.fill();
        ctx.lineWidth = Math.max(1, s * 0.12); ctx.strokeStyle = 'rgba(120,70,0,0.6)'; ctx.stroke();
        break;
      }
      case 'petal':
        ctx.scale(1, 0.6 + 0.4 * Math.abs(fl)); ctx.fillStyle = p.col;
        ctx.beginPath(); ctx.moveTo(0, s); ctx.bezierCurveTo(s * 0.9, s * 0.5, s * 0.7, -s * 0.8, s * 0.15, -s * 0.9); ctx.lineTo(0, -s * 0.6); ctx.lineTo(-s * 0.15, -s * 0.9);
        ctx.bezierCurveTo(-s * 0.7, -s * 0.8, -s * 0.9, s * 0.5, 0, s); ctx.fill();
        break;
      case 'daruma': {   // 小さなだるま顔の紙
        var d = s * 1.3; ctx.scale(1, 0.4 + 0.6 * Math.abs(fl));
        ctx.fillStyle = '#e8352f'; ctx.beginPath(); ctx.ellipse(0, 0, d, d * 1.08, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fffaf0'; ctx.beginPath(); ctx.ellipse(0, -d * 0.12, d * 0.68, d * 0.55, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(-d * 0.26, -d * 0.18, d * 0.11, 0, TAU); ctx.arc(d * 0.26, -d * 0.18, d * 0.11, 0, TAU); ctx.fill();
        ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1, d * 0.09); ctx.beginPath(); ctx.arc(0, d * 0.05, d * 0.18, 0.3, PI - 0.3); ctx.stroke();
        ctx.lineWidth = Math.max(1, d * 0.07); ctx.strokeStyle = '#f2c53d'; ctx.beginPath(); ctx.ellipse(0, -d * 0.12, d * 0.68, d * 0.55, 0, 0, TAU); ctx.stroke();
        break;
      }
    }
    ctx.restore();
  }
  // いま見えている範囲(canvas 全体を、いまの座標で)
  function visibleArea(ctx) {
    try {
      var inv = ctx.getTransform().inverse(), W = ctx.canvas.width, H = ctx.canvas.height;
      var a = inv.transformPoint({ x: 0, y: 0 }), b = inv.transformPoint({ x: W, y: H });
      return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
    } catch (e) { return null; }
  }
  // k 0〜1(弾けてから約1.2秒)。opts.area = {x, y, w, h} で画面の範囲を渡すと、垂れ幕と「ドーン!」を その中に収める。size は drawGoldenBalloon と同じ値(弾ける直前の だるまと ぴったり重なる)
  function drawGoldenPop(ctx, cx, cy, size, k, opts) {
    opts = opts || {};
    if (!popParts) popParts = makePopParts();
    k = clamp(k || 0, 0, 1);
    var R = size / 2, t = opts.t || 0, tau = k * 1.2, spread = opts.spread || 1;
    var area = opts.area || visibleArea(ctx);   // 画面の範囲(この範囲に垂れ幕と「ドーン!」を収める)
    var G1 = gbState(R, 1, t), dy = R * BOTTOM - gbY(BOTTOM, G1);
    var topY = gbY(-1, G1) + dy;                  // くす玉の てっぺん(ちょうつがい)
    var S = Math.max(size, 200) * 1.25 * spread;  // 紙吹雪のとぶ広さ
    var oc = -R * 0.15;                           // 中心(だるまの おなか)
    var i, a, j;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    var fade = 1 - smooth((k - 0.82) / 0.18) * 0.5;

    // 放射状の光
    if (k < 0.7) {
      var ra = (1 - k / 0.7), RR = S * 1.6;
      ctx.save(); ctx.rotate(t * 0.6 + k * 1.5);
      for (i = 0; i < 18; i++) {
        a = i / 18 * TAU;
        ctx.fillStyle = i % 2 ? 'rgba(255,230,120,' + (0.5 * ra) + ')' : 'rgba(255,255,255,' + (0.35 * ra) + ')';
        ctx.beginPath(); ctx.moveTo(0, oc); ctx.arc(0, oc, RR, a, a + TAU / 36); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
    // 金の輪(衝撃波)
    if (k < 0.45) {
      var rk = k / 0.45;
      ctx.strokeStyle = 'rgba(255,215,90,' + (1 - rk) + ')'; ctx.lineWidth = Math.max(3, R * 0.25 * (1 - rk));
      ctx.beginPath(); ctx.arc(0, oc, R * (1.1 + 4 * smooth(rk)) * spread, 0, TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.8 * (1 - rk)) + ')'; ctx.lineWidth = Math.max(2, R * 0.08 * (1 - rk));
      ctx.beginPath(); ctx.arc(0, oc, R * (0.9 + 3 * smooth(rk)) * spread, 0, TAU); ctx.stroke();
    }

    // くす玉(左右に割れて ぱかっと開く)
    var op = clamp(k / 0.32, 0, 1), ang = 1.0 * (1 + 2.70158 * Math.pow(op - 1, 3) + 1.70158 * Math.pow(op - 1, 2));   // ばね(はねかえる)
    var shellA = 1 - smooth((k - 0.7) / 0.3);
    if (shellA > 0.01) {
      [-1, 1].forEach(function (s) {
        ctx.save();
        ctx.globalAlpha = shellA;
        ctx.translate(0, topY); ctx.rotate(-s * ang); ctx.translate(0, -topY);
        ctx.save();
        ctx.beginPath(); if (s < 0) ctx.rect(-R * 4, -R * 4, R * 4, R * 8); else ctx.rect(0, -R * 4, R * 4, R * 8); ctx.clip();
        drawGB(ctx, R, 1, 0.35, { bare: true });
        ctx.restore();
        // 切り口(中が見える)
        ctx.translate(0, dy);
        var h0 = gbY(-1, G1), h1 = gbY(BOTTOM, G1);
        var ig = ctx.createLinearGradient(0, h0, 0, h1);
        ig.addColorStop(0, '#c62828'); ig.addColorStop(1, '#7a1010');
        ctx.fillStyle = ig; ctx.strokeStyle = '#5a3a06'; ctx.lineWidth = Math.max(2, R * 0.04);
        ctx.beginPath(); ctx.ellipse(0, (h0 + h1) / 2, R * 0.13 * Math.min(1, ang * 1.5), (h1 - h0) / 2, 0, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.restore();
      });
    }
    // ひも(てっぺん)
    ctx.strokeStyle = '#d9a520'; ctx.lineWidth = Math.max(2, R * 0.04);
    ctx.beginPath(); ctx.moveTo(0, topY); ctx.lineTo(0, topY - R * 0.35); ctx.stroke();
    ctx.fillStyle = '#f2c53d'; ctx.beginPath(); ctx.arc(0, topY - R * 0.38, Math.max(3, R * 0.07), 0, TAU); ctx.fill();

    // 垂れ幕
    var txt = opts.text == null ? '大当たり!' : String(opts.text);
    var bt = opts.boomText == null ? 'ドーン!' : String(opts.boomText);
    // 置き場所: 画面(area)の上から「ドーン!」→ その下に垂れ幕。垂れ幕は画面の 6割より下へ出ない
    var nT = Math.max(1, txt.length), bw, fullL, bTop, boomY, fs;
    if (area) {
      var ay = area.y - cy, ah = area.h, aw = area.w;
      fs = clamp(aw * 0.15, 30, 96);
      if (bt) fs = Math.min(fs, aw * 0.85 / (bt.length * 0.95 * 1.1));
      boomY = ay + ah * 0.07 + fs * 0.55;
      var limTop = bt ? boomY + fs * 1.0 : ay + ah * 0.06, limBot = ay + ah * 0.6;
      bw = clamp(size * 0.24, 38, Math.min(78, aw * 0.2));
      fullL = bw * (nT * 0.82 + 0.6);
      if (fullL > limBot - limTop) { bw = Math.max(18, (limBot - limTop) / (nT * 0.82 + 0.6)); fullL = bw * (nT * 0.82 + 0.6); }
      bTop = Math.max(limTop, topY + R * 0.05);
      if (bTop + fullL > limBot) bTop = Math.max(limTop, limBot - fullL);
    } else {
      bw = Math.max(36, size * 0.24); fullL = bw * (nT * 0.82 + 0.6); bTop = topY + R * 0.05;
      fs = Math.max(44, size * 0.38); boomY = Math.min(oc - R * 1.1, bTop - fs * 0.8);
    }
    var un = smooth((k - 0.1) / 0.35);
    if (un > 0 && txt) {
      var L = fullL * un;
      var sw = Math.sin(tau * 5) * 0.04 * (1 - un * 0.5);
      if (bTop > topY + R * 0.06) {   // くす玉から垂れ幕まで ひも
        ctx.strokeStyle = '#d9a520'; ctx.lineWidth = Math.max(2, bw * 0.06);
        ctx.beginPath(); ctx.moveTo(0, area ? Math.max(topY, area.y - cy) : topY); ctx.lineTo(0, bTop); ctx.stroke();
      }
      ctx.save(); ctx.translate(0, bTop); ctx.rotate(sw);
      ctx.fillStyle = '#d9a520'; ctx.fillRect(-bw * 0.62, -bw * 0.06, bw * 1.24, bw * 0.12);
      ctx.save(); ctx.beginPath(); ctx.rect(-bw, 0, bw * 2, L); ctx.clip();
      ctx.fillStyle = '#fffaf0'; ctx.fillRect(-bw / 2, 0, bw, fullL);
      ctx.fillStyle = '#d42a2a'; ctx.fillRect(-bw / 2, 0, bw * 0.1, fullL); ctx.fillRect(bw * 0.4, 0, bw * 0.1, fullL);
      ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1.5, bw * 0.04); ctx.strokeRect(-bw / 2, 0, bw, fullL);
      ctx.font = '900 ' + Math.round(bw * 0.6) + 'px "Hiragino Mincho ProN","Yu Mincho","Noto Serif JP",serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (j = 0; j < txt.length; j++) {
        ctx.fillStyle = '#c41a1a';
        if (txt[j] === 'ー' || txt[j] === '〜') { ctx.save(); ctx.translate(0, bw * (0.55 + j * 0.82)); ctx.rotate(PI / 2); ctx.fillText(txt[j], 0, 0); ctx.restore(); }   // 縦書きの のばし棒
        else ctx.fillText(txt[j], 0, bw * (0.55 + j * 0.82));
      }
      ctx.restore();
      if (un > 0.98) {   // 房
        [-1, 1].forEach(function (s) {
          ctx.fillStyle = '#d42a2a'; ctx.beginPath(); ctx.moveTo(s * bw * 0.4, L); ctx.lineTo(s * bw * 0.48, L + bw * 0.45); ctx.lineTo(s * bw * 0.3, L + bw * 0.45); ctx.closePath(); ctx.fill();
        });
      }
      ctx.restore();
    }

    // 紙吹雪・紙テープ・星・花びら・だるま顔
    popParts.forEach(function (p) {
      var tt = tau - p.dl - 0.03;
      if (tt <= 0) return;
      if (p.tp === 'tape') {   // 紙テープは 通ったあとが線になる
        ctx.strokeStyle = p.col; ctx.lineWidth = Math.max(2, S * 0.014); ctx.globalAlpha = fade;
        ctx.beginPath();
        for (var q = 0; q <= 12; q++) {
          var tq = Math.max(0, tt - q * 0.035), pq = partPos(p, tq, S);
          var wv = Math.sin(tq * 14 + p.ph + q) * S * 0.015;
          if (q) ctx.lineTo(pq[0] + wv, pq[1] + oc); else ctx.moveTo(pq[0] + wv, pq[1] + oc);
        }
        ctx.stroke(); ctx.globalAlpha = 1;
        return;
      }
      var pp = partPos(p, tt, S);
      drawPart(ctx, p, pp[0], pp[1] + oc, tt, S, fade);
    });

    // 「ドーン!」
    if (bt && k > 0.02 && k < 0.5) {
      var bk = (k - 0.02) / 0.48, sc = bk < 0.2 ? 0.4 + 0.7 * (bk / 0.2) : 1.1 - 0.1 * (bk - 0.2);
      ctx.save(); ctx.globalAlpha = bk > 0.75 ? (1 - bk) / 0.25 : 1;
      ctx.translate(0, boomY); ctx.rotate(-0.06); ctx.scale(sc, sc);
      outlinedText(ctx, bt, 0, 0, Math.round(fs), '#ffe14d', '#c4320a', '"Hiragino Maru Gothic ProN","Arial Rounded MT Bold",sans-serif');
      ctx.restore();
    }
    // 白い閃光(はじめの 0.1)
    if (k < 0.12) {
      var fk = 1 - k / 0.12;
      var wg = ctx.createRadialGradient(0, oc, 0, 0, oc, S * 1.6);
      wg.addColorStop(0, 'rgba(255,255,255,' + fk + ')'); wg.addColorStop(0.4, 'rgba(255,250,220,' + (0.85 * fk) + ')'); wg.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.fillStyle = wg; ctx.fillRect(-S * 2, oc - S * 2, S * 4, S * 4);
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------
  // だるま落としの段
  // ---------------------------------------------------------------
  var KIND = {
    red:     { c: '#e23a3a', label: '赤' },
    blue:    { c: '#2f6fd6', label: '青' },
    green:   { c: '#2fa651', label: '緑' },
    yellow:  { c: '#f2c230', label: '黄' },
    purple:  { c: '#8b4fc6', label: '紫' },
    gold:    { c: '#e9b52c', label: '金' },
    rainbow: { c: '#ff6fa0', label: '虹' },
    hard:    { c: '#6e4a2e', label: '連打' },
    timing:  { c: '#fff4e0', label: 'タイミング' },
    crack:   { c: '#d9cbb0', label: 'ヒビ' },
    slide:   { c: '#7fd0ee', label: 'すべる' },
    bounce:  { c: '#ff8cc0', label: 'はねる' },
    double:  { c: '#f08a3c', label: '2段' },
    bomb:    { c: '#2b2b33', label: 'ばくだん' },
    mystery: { c: '#5b3fa8', label: 'なぞ' },
    mochi:   { c: '#f7f3ea', label: 'おもち' },   // (作る係が足した)白いおもち
    star:    { c: '#6cc8ec', label: 'ほし' }      // (作る係が足した)水色に白い星
  };
  var BLOCK_KINDS = Object.keys(KIND);

  function blockSide(ctx, w, y0, y1, ry) {
    ctx.beginPath();
    ctx.moveTo(-w / 2, y0);
    ctx.lineTo(-w / 2, y1);
    ctx.ellipse(0, y1, w / 2, ry, 0, PI, 0, true);
    ctx.lineTo(w / 2, y0);
    ctx.ellipse(0, y0, w / 2, ry, 0, 0, PI, false);
    ctx.closePath();
  }
  // 円柱に沿って模様を置く(th = -PI/2〜PI/2)
  function cylX(w, th) { return w / 2 * Math.sin(th); }

  function drawPattern(ctx, kind, w, h, y0, y1, ry, opts, t) {
    var i, j, th, x, ym = (y0 + y1) / 2 + ry * 0.15, hh = y1 - y0;
    var col = KIND[kind].c;
    function band(y, lw, c) { // 円柱のまわりの細い帯(下にふくらむ)
      ctx.beginPath(); ctx.ellipse(0, y, w / 2, ry, 0, 0, PI, false);
      ctx.lineWidth = lw; ctx.strokeStyle = c; ctx.stroke();
    }
    switch (kind) {
      case 'red': // 白い水玉
        for (j = 0; j < 2; j++) for (i = -3; i <= 3; i++) {
          th = (i + (j ? 0.5 : 0)) * 0.42; if (Math.abs(th) > 1.45) continue;
          x = cylX(w, th);
          ctx.fillStyle = 'rgba(255,240,230,0.85)';
          ctx.beginPath(); ctx.ellipse(x, y0 + hh * (0.35 + j * 0.38) + ry * Math.cos(th) * 0.9, hh * 0.1 * Math.cos(th), hh * 0.1, 0, 0, TAU); ctx.fill();
        }
        break;
      case 'blue': // 青海波(なみ)
        ctx.strokeStyle = 'rgba(200,230,255,0.8)'; ctx.lineWidth = Math.max(1.5, hh * 0.05);
        for (j = 0; j < 2; j++) for (i = -4; i <= 4; i++) {
          th = (i + (j ? 0.5 : 0)) * 0.36; if (Math.abs(th) > 1.5) continue;
          x = cylX(w, th);
          var yy = y0 + hh * (0.5 + j * 0.34) + ry * Math.cos(th) * 0.9;
          for (var k = 1; k <= 3; k++) {
            ctx.beginPath(); ctx.ellipse(x, yy, hh * 0.09 * k * Math.cos(th), hh * 0.09 * k, 0, PI, 0); ctx.stroke();
          }
        }
        break;
      case 'green': // たてじま(竹)
        for (i = -6; i <= 6; i++) {
          th = i * 0.24; x = cylX(w, th);
          ctx.fillStyle = i % 2 ? 'rgba(20,90,40,0.35)' : 'rgba(200,255,200,0.28)';
          ctx.fillRect(x - w * 0.02 * Math.cos(th), y0 - ry, w * 0.04 * Math.cos(th), hh + ry * 3);
        }
        // 竹のふし
        band(y0 + hh * 0.5, Math.max(1.5, hh * 0.05), 'rgba(15,80,35,0.6)');
        break;
      case 'yellow': // 山形
        ctx.strokeStyle = 'rgba(220,110,20,0.75)'; ctx.lineWidth = Math.max(2, hh * 0.08); ctx.lineJoin = 'round';
        for (j = 0; j < 2; j++) {
          ctx.beginPath();
          for (i = 0; i <= 16; i++) {
            th = -1.5 + 3 * i / 16; x = cylX(w, th);
            var yz = y0 + hh * (0.38 + j * 0.34) + ry * Math.cos(th) * 0.9 + (i % 2 ? -1 : 1) * hh * 0.09;
            if (i) ctx.lineTo(x, yz); else ctx.moveTo(x, yz);
          }
          ctx.stroke();
        }
        break;
      case 'purple': // ひし形
        for (i = -4; i <= 4; i++) {
          th = i * 0.34; if (Math.abs(th) > 1.45) continue;
          x = cylX(w, th); var yc = ym + ry * Math.cos(th) * 0.4, cs = Math.cos(th);
          ctx.fillStyle = 'rgba(240,210,255,0.7)';
          ctx.beginPath(); ctx.moveTo(x, yc - hh * 0.28); ctx.lineTo(x + hh * 0.2 * cs, yc); ctx.lineTo(x, yc + hh * 0.28); ctx.lineTo(x - hh * 0.2 * cs, yc); ctx.closePath(); ctx.fill();
          ctx.fillStyle = 'rgba(110,40,160,0.7)';
          ctx.beginPath(); ctx.moveTo(x, yc - hh * 0.12); ctx.lineTo(x + hh * 0.09 * cs, yc); ctx.lineTo(x, yc + hh * 0.12); ctx.lineTo(x - hh * 0.09 * cs, yc); ctx.closePath(); ctx.fill();
        }
        break;
      case 'gold': {
        // 動く光の帯
        var sx = (fract(t * 0.5) * 2 - 0.5) * w;
        var gg = ctx.createLinearGradient(sx - w * 0.3, 0, sx + w * 0.3, 0);
        gg.addColorStop(0, 'rgba(255,255,255,0)'); gg.addColorStop(0.5, 'rgba(255,255,255,0.65)'); gg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gg; ctx.fillRect(-w, y0 - ry, w * 2, hh + ry * 3);
        // 「金」
        outlinedText(ctx, '金', 0, ym + ry * 0.3, Math.round(hh * 0.62), '#fff6c8', '#8a5a00', '"Hiragino Mincho ProN","Yu Mincho","Noto Serif JP",serif');
        break;
      }
      case 'rainbow':
        break; // 色そのものが模様
      case 'hard': {
        // 木目
        ctx.strokeStyle = 'rgba(30,15,5,0.35)'; ctx.lineWidth = 1.2;
        for (i = 0; i < 6; i++) {
          ctx.beginPath();
          var gy = y0 + hh * (0.1 + i * 0.16);
          ctx.moveTo(-w / 2, gy + ry);
          ctx.bezierCurveTo(-w * 0.2, gy + ry * 1.6 + Math.sin(i) * 3, w * 0.2, gy + ry * 1.6 - Math.sin(i) * 3, w / 2, gy + ry);
          ctx.stroke();
        }
        // 鉄の帯
        [0.2, 0.8].forEach(function (f) {
          var by = y0 + hh * f;
          var mg = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
          mg.addColorStop(0, '#4a4f57'); mg.addColorStop(0.3, '#c9ced6'); mg.addColorStop(0.45, '#8d939c'); mg.addColorStop(1, '#3a3e45');
          ctx.beginPath();
          ctx.ellipse(0, by - hh * 0.08, w / 2, ry, 0, 0, PI, false);
          ctx.ellipse(0, by + hh * 0.08, w / 2, ry, 0, PI, 0, true);
          ctx.closePath(); ctx.fillStyle = mg; ctx.fill();
          ctx.lineWidth = 1.5; ctx.strokeStyle = '#1e2126'; ctx.stroke();
          for (var b = -3; b <= 3; b++) { // ボルト
            var bth = b * 0.45, bx = cylX(w, bth), byy = by + ry * Math.cos(bth);
            ctx.fillStyle = '#e6e9ee'; ctx.strokeStyle = '#1e2126'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.ellipse(bx, byy, hh * 0.05 * Math.cos(bth), hh * 0.05, 0, 0, TAU); ctx.fill(); ctx.stroke();
          }
        });
        break;
      }
      case 'timing': {
        // 赤い帯
        band(y0 + hh * 0.08, Math.max(2, hh * 0.1), '#d93030');
        band(y1 - hh * 0.06, Math.max(2, hh * 0.1), '#d93030');
        // 的
        var tr = Math.min(hh * 0.4, w * 0.2), ty = ym + ry * 0.35;
        var rings = ['#d93030', '#ffffff', '#d93030', '#ffffff', '#d93030'];
        for (i = 0; i < rings.length; i++) {
          ctx.fillStyle = rings[i];
          ctx.beginPath(); ctx.arc(0, ty, tr * (1 - i / rings.length), 0, TAU); ctx.fill();
        }
        ctx.lineWidth = 1.5; ctx.strokeStyle = INK;
        ctx.beginPath(); ctx.arc(0, ty, tr, 0, TAU); ctx.stroke();
        break;
      }
      case 'crack': // 陶器のような青い模様
        ctx.strokeStyle = 'rgba(40,70,150,0.55)'; ctx.lineWidth = Math.max(1.5, hh * 0.05);
        for (i = -3; i <= 3; i++) {
          th = i * 0.45; x = cylX(w, th);
          var cy2 = ym + ry * Math.cos(th) * 0.4, c2 = Math.cos(th);
          ctx.beginPath(); ctx.ellipse(x, cy2, hh * 0.16 * c2, hh * 0.16, 0, 0, TAU); ctx.stroke();
          ctx.beginPath(); ctx.ellipse(x, cy2, hh * 0.06 * c2, hh * 0.06, 0, 0, TAU); ctx.stroke();
        }
        band(y0 + hh * 0.08, Math.max(1.5, hh * 0.05), 'rgba(40,70,150,0.6)');
        band(y1 - hh * 0.06, Math.max(1.5, hh * 0.05), 'rgba(40,70,150,0.6)');
        break;
      case 'slide': {
        // 氷のすじ
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-w * 0.38, y0 + hh * 0.3); ctx.lineTo(-w * 0.22, y0 + hh * 0.15);
        ctx.moveTo(w * 0.25, y1); ctx.lineTo(w * 0.36, y1 - hh * 0.12); ctx.stroke();
        // 矢印(動く)
        var d = opts.dir === -1 ? -1 : 1, off = fract(t * 1.2) * w * 0.22;
        ctx.save();
        ctx.lineWidth = Math.max(3, hh * 0.12); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        for (i = -3; i <= 3; i++) {
          x = d * (i * w * 0.22 + off);
          if (Math.abs(x) > w * 0.4) continue;
          var a2 = 1 - Math.abs(x) / (w * 0.42);
          ctx.globalAlpha = a2;
          ctx.strokeStyle = '#ffffff';
          ctx.beginPath(); ctx.moveTo(x - d * hh * 0.14, ym + ry * 0.4 - hh * 0.25); ctx.lineTo(x + d * hh * 0.1, ym + ry * 0.4); ctx.lineTo(x - d * hh * 0.14, ym + ry * 0.4 + hh * 0.25); ctx.stroke();
        }
        ctx.restore();
        break;
      }
      case 'bounce': // ばねの波線
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = Math.max(2, hh * 0.08);
        for (j = 0; j < 2; j++) {
          ctx.beginPath();
          for (i = 0; i <= 40; i++) {
            th = -1.5 + 3 * i / 40; x = cylX(w, th);
            var yb = y0 + hh * (0.4 + j * 0.3) + ry * Math.cos(th) * 0.9 + Math.sin(i * 1.2 + t * 6) * hh * 0.07;
            if (i) ctx.lineTo(x, yb); else ctx.moveTo(x, yb);
          }
          ctx.stroke();
        }
        break;
      case 'double': {
        // 下半分は青緑
        ctx.fillStyle = '#2aa79b';
        ctx.beginPath(); ctx.moveTo(-w / 2, ym); ctx.ellipse(0, ym, w / 2, ry, 0, PI, 0, true); ctx.lineTo(w / 2, y1 + ry * 2); ctx.lineTo(-w / 2, y1 + ry * 2); ctx.closePath(); ctx.fill();
        // しめ縄(ねじり)
        ctx.beginPath();
        ctx.ellipse(0, ym - hh * 0.06, w / 2, ry, 0, 0, PI, false);
        ctx.ellipse(0, ym + hh * 0.06, w / 2, ry, 0, PI, 0, true);
        ctx.closePath(); ctx.fillStyle = '#e8cf8a'; ctx.fill();
        ctx.save(); ctx.clip();
        ctx.strokeStyle = '#a07a2a'; ctx.lineWidth = Math.max(1.5, hh * 0.025);
        for (i = -12; i <= 12; i++) {
          th = i * 0.13; if (Math.abs(th) > 1.57) continue; x = cylX(w, th);
          var yr = ym + ry * Math.cos(th);
          ctx.beginPath(); ctx.moveTo(x - hh * 0.03, yr - hh * 0.07); ctx.lineTo(x + hh * 0.03, yr + hh * 0.07); ctx.stroke();
        }
        ctx.restore();
        ctx.lineWidth = 1.5; ctx.strokeStyle = INK;
        ctx.beginPath(); ctx.ellipse(0, ym - hh * 0.06, w / 2, ry, 0, 0, PI, false); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(0, ym + hh * 0.06, w / 2, ry, 0, 0, PI, false); ctx.stroke();
        outlinedText(ctx, '×2', w * 0.28, ym - hh * 0.25 + ry, Math.round(hh * 0.2), '#ffffff', INK);
        break;
      }
      case 'bomb': {
        // 黄色と黒のしましま帯
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(0, ym - hh * 0.2, w / 2, ry, 0, 0, PI, false);
        ctx.ellipse(0, ym + hh * 0.2, w / 2, ry, 0, PI, 0, true);
        ctx.closePath(); ctx.fillStyle = '#ffd12e'; ctx.fill(); ctx.clip();
        ctx.fillStyle = '#1b1b20';
        for (i = -10; i <= 10; i++) {
          x = i * hh * 0.24;
          ctx.beginPath(); ctx.moveTo(x, ym - hh * 0.5); ctx.lineTo(x + hh * 0.12, ym - hh * 0.5); ctx.lineTo(x + hh * 0.12 - hh * 0.3, ym + hh * 0.6); ctx.lineTo(x - hh * 0.3, ym + hh * 0.6); ctx.closePath(); ctx.fill();
        }
        ctx.restore();
        // 赤く光る
        var pulse = 0.5 + 0.5 * Math.sin(t * 9);
        ctx.fillStyle = 'rgba(255,40,40,' + (0.12 + 0.18 * pulse) + ')';
        ctx.fillRect(-w, y0 - ry, w * 2, hh + ry * 3);
        break;
      }
      case 'mystery':
        for (i = 0; i < 5; i++) {
          var sp = 0.5 + 0.5 * Math.sin(t * 3 + i * 1.7);
          sparkle(ctx, (-0.4 + i * 0.2) * w, y0 + hh * (i % 2 ? 0.3 : 0.75), hh * (0.05 + 0.07 * sp), 'rgba(255,240,180,0.9)');
        }
        outlinedText(ctx, '?', 0, ym + ry * 0.3, Math.round(hh * 0.72), '#ffd84a', INK);
        break;
      case 'mochi': // (作る係が足した)ぷにぷにの白いおもち: ほんのり桃色の影と つや
        ctx.fillStyle = 'rgba(255,190,200,0.35)';
        ctx.beginPath(); ctx.ellipse(-w * 0.28, ym + ry * 0.3, w * 0.09, hh * 0.18, 0, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.ellipse(w * 0.28, ym + ry * 0.3, w * 0.09, hh * 0.18, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath(); ctx.ellipse(-w * 0.1, y0 + hh * 0.35, w * 0.12, hh * 0.1, -0.1, 0, TAU); ctx.fill();
        break;
      case 'star': // (作る係が足した)白い星もよう
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        for (i = -2; i <= 2; i++) {
          th = i * 0.55; x = cylX(w, th);
          star(ctx, x, ym + ry * Math.cos(th) * 0.4, hh * 0.22 * (0.6 + 0.4 * Math.cos(th)), 5, 0.45, 0);
          ctx.fill();
        }
        break;
    }
    // 上下の金(白)の細い帯
    if (kind === 'red' || kind === 'blue' || kind === 'green' || kind === 'yellow' || kind === 'purple' || kind === 'rainbow' || kind === 'gold' || kind === 'bounce' || kind === 'mystery') {
      var bc = kind === 'gold' ? '#fff3b8' : '#f6cf4a';
      band(y0 + hh * 0.06, Math.max(2, hh * 0.07), bc);
      band(y1 - hh * 0.04, Math.max(2, hh * 0.07), bc);
    }
  }

  function drawCracks(ctx, w, h, y0, y1, amount, seed) {
    if (amount <= 0) return;
    var r = rng(seed || 7), n = 2 + Math.round(amount * 4), i, k;
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (i = 0; i < n; i++) {
      var x = (r() - 0.5) * w * 0.7, y = lerp(y0, y1, r()), a = r() * TAU;
      var len = (0.2 + 0.5 * amount) * w * (0.5 + r() * 0.5);
      var pts = [[x, y]], steps = 5;
      for (k = 0; k < steps; k++) {
        a += (r() - 0.5) * 1.4;
        x += Math.cos(a) * len / steps; y += Math.sin(a) * len / steps * 0.6;
        pts.push([x, y]);
      }
      for (var pass = 0; pass < 2; pass++) {
        ctx.beginPath();
        pts.forEach(function (p, j) { if (j) ctx.lineTo(p[0], p[1] + (pass ? 0 : 1.2)); else ctx.moveTo(p[0], p[1] + (pass ? 0 : 1.2)); });
        ctx.lineWidth = pass ? Math.max(1.5, h * 0.035) : Math.max(1.2, h * 0.03);
        ctx.strokeStyle = pass ? 'rgba(25,15,10,0.85)' : 'rgba(255,255,255,0.55)';
        ctx.stroke();
      }
      // 枝分かれ
      var mid = pts[2];
      ctx.beginPath(); ctx.moveTo(mid[0], mid[1]);
      ctx.lineTo(mid[0] + Math.cos(a + 1.2) * len * 0.3, mid[1] + Math.sin(a + 1.2) * len * 0.2);
      ctx.lineWidth = Math.max(1, h * 0.022); ctx.strokeStyle = 'rgba(25,15,10,0.8)'; ctx.stroke();
    }
    ctx.restore();
  }

  function drawBlock(ctx, x, y, w, h, kind, opts) {
    opts = opts || {};
    if (!KIND[kind]) kind = 'red';
    var t = opts.t || 0;
    var ry = Math.min(h * 0.14, w * 0.075);
    var y0 = -h / 2 + ry, y1 = h / 2 - ry;
    var col = KIND[kind].c;
    var lw = clamp(h * 0.05, 2, 4);
    ctx.save();
    ctx.translate(x, y);
    if (opts.rot) ctx.rotate(opts.rot);
    if (opts.alpha != null) ctx.globalAlpha = clamp(opts.alpha, 0, 1);

    // 光るふち(金・選択中など)
    if (kind === 'gold' || kind === 'rainbow' || opts.glow) {
      ctx.save();
      ctx.shadowColor = opts.glow || (kind === 'gold' ? 'rgba(255,215,80,0.9)' : 'rgba(255,150,255,0.8)');
      ctx.shadowBlur = h * (0.5 + 0.2 * Math.sin(t * 4));
      blockSide(ctx, w, y0, y1, ry); ctx.fillStyle = col; ctx.fill();
      ctx.restore();
    }

    // 側面の色
    blockSide(ctx, w, y0, y1, ry);
    if (kind === 'gold') {
      var gg = ctx.createLinearGradient(0, y0 - ry, 0, y1 + ry);
      gg.addColorStop(0, '#fff0a0'); gg.addColorStop(0.45, '#f0c030'); gg.addColorStop(1, '#b07a0a');
      ctx.fillStyle = gg;
    } else if (kind === 'rainbow') {
      var rg = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
      for (var i = 0; i <= 6; i++) rg.addColorStop(i / 6, 'hsl(' + ((i * 52 + t * 90) % 360) + ',88%,60%)');
      ctx.fillStyle = rg;
    } else {
      ctx.fillStyle = col;
    }
    ctx.fill();

    ctx.save();
    blockSide(ctx, w, y0, y1, ry); ctx.clip();
    drawPattern(ctx, kind, w, h, y0, y1, ry, opts, t);
    // 円柱の丸み(左右が暗く、左寄りに光のすじ)
    var cg = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    cg.addColorStop(0, 'rgba(0,0,0,0.38)');
    cg.addColorStop(0.18, 'rgba(0,0,0,0.05)');
    cg.addColorStop(0.27, 'rgba(255,255,255,0.42)');
    cg.addColorStop(0.33, 'rgba(255,255,255,0.08)');
    cg.addColorStop(0.62, 'rgba(0,0,0,0)');
    cg.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = cg; ctx.fillRect(-w / 2, -h, w, h * 2);
    // ヒビ
    var crack = opts.crack || 0;
    if (kind === 'crack') crack = Math.max(crack, 0.25);
    if (kind === 'hard' && opts.hp != null && opts.maxHp) crack = Math.max(crack, (1 - opts.hp / opts.maxHp) * 0.9);
    drawCracks(ctx, w, h, y0, y1 + ry, crack, opts.seed || (kind.length * 13 + 5));
    ctx.restore();

    // 上の面(木口)
    ctx.beginPath(); ctx.ellipse(0, y0, w / 2, ry, 0, 0, TAU);
    var top;
    if (kind === 'gold') { top = ctx.createLinearGradient(-w / 2, 0, w / 2, 0); top.addColorStop(0, '#d9a020'); top.addColorStop(0.5, '#fff2a8'); top.addColorStop(1, '#d9a020'); }
    else if (kind === 'bomb') top = '#3a3a44';
    else if (kind === 'hard') top = '#8a6646';
    else {
      top = ctx.createRadialGradient(0, y0, 0, 0, y0, w / 2);
      top.addColorStop(0, '#f6dcae'); top.addColorStop(1, '#d9a76a');
    }
    ctx.fillStyle = top; ctx.fill();
    if (kind !== 'gold' && kind !== 'bomb') { // 年輪
      ctx.strokeStyle = 'rgba(140,85,35,0.35)'; ctx.lineWidth = 1;
      for (var k = 1; k <= 3; k++) { ctx.beginPath(); ctx.ellipse(w * 0.03, y0, w / 2 * k / 4.2, ry * k / 4.2, 0, 0, TAU); ctx.stroke(); }
    }
    // 上のふち(色の縁)
    ctx.beginPath(); ctx.ellipse(0, y0, w / 2 - lw * 0.9, ry - lw * 0.5, 0, 0, TAU);
    ctx.lineWidth = lw * 1.1; ctx.strokeStyle = kind === 'rainbow' ? '#ffffff' : shade(kind === 'timing' ? '#d93030' : col, kind === 'gold' ? 0.3 : -0.1); ctx.stroke();

    // ふちどり
    blockSide(ctx, w, y0, y1, ry);
    ctx.lineJoin = 'round'; ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, y0, w / 2, ry, 0, 0, TAU); ctx.stroke();

    // 上にはみ出すもの
    if (kind === 'bomb') {
      var fx = w * 0.3, fy = y0;
      ctx.strokeStyle = '#d8c39a'; ctx.lineWidth = Math.max(3, h * 0.08); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(fx, fy); ctx.quadraticCurveTo(fx + w * 0.05, fy - h * 0.5, fx + w * 0.16, fy - h * 0.55); ctx.stroke();
      ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke();
      var spx = fx + w * 0.16, spy = fy - h * 0.55, fl = 0.7 + 0.3 * Math.sin(t * 30);
      ctx.save();
      ctx.fillStyle = '#ff9a1f'; star(ctx, spx, spy, h * 0.24 * fl, 8, 0.45, t * 5); ctx.fill();
      ctx.fillStyle = '#fff36b'; star(ctx, spx, spy, h * 0.13 * fl, 8, 0.5, -t * 4); ctx.fill();
      ctx.restore();
    }
    if (kind === 'gold') {
      for (var q = 0; q < 3; q++) {
        var tw = 0.5 + 0.5 * Math.sin(t * 5 + q * 2.1);
        sparkle(ctx, [-0.42, 0.45, 0.2][q] * w, [y0 - ry * 0.5, y0 + h * 0.2, y1 + ry * 0.4][q], h * (0.06 + 0.12 * tw), '#ffffff');
      }
    }
    if (kind === 'hard' && opts.hp != null) {
      var pr = h * 0.27, py = (y0 + y1) / 2 + ry * 0.6;
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, py, pr, 0, TAU); ctx.fill(); ctx.stroke();
      outlinedText(ctx, String(opts.hp), 0, py + 1, Math.round(pr * 1.35), '#e23a3a', '#ffffff');
    }
    if (kind === 'timing' && opts.ring != null) {
      var tr = Math.min((y1 - y0) * 0.4, w * 0.2), ty = (y0 + y1) / 2 + ry * 0.85;
      var ok = Math.abs(opts.ring - 1) < 0.15;
      ctx.save();
      ctx.lineWidth = Math.max(3, h * 0.08);
      ctx.strokeStyle = ok ? '#3cff6a' : '#ffd84a';
      ctx.shadowColor = ok ? '#3cff6a' : 'rgba(0,0,0,0)'; ctx.shadowBlur = ok ? 12 : 0;
      ctx.beginPath(); ctx.arc(0, ty, Math.max(2, tr * opts.ring), 0, TAU); ctx.stroke();
      ctx.restore();
    }
    // ピカッ
    if (opts.flash) {
      blockSide(ctx, w, y0, y1, ry);
      ctx.fillStyle = 'rgba(255,255,255,' + clamp(opts.flash, 0, 1) + ')'; ctx.fill();
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------
  // 木づち
  // ---------------------------------------------------------------
  function drawHammer(ctx, x, y, angle, kind, size) {
    size = size || 140;
    var gold = kind === 'gold' || kind === 'perfect';
    var L = size * 0.74, hw = size * 0.09;
    var HW = size * 0.56, HH = size * 0.3;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle || 0);
    ctx.lineJoin = 'round';
    if (gold) { ctx.shadowColor = 'rgba(255,220,90,0.9)'; ctx.shadowBlur = size * 0.15; }
    // 柄
    var hg = ctx.createLinearGradient(-hw / 2, 0, hw / 2, 0);
    if (gold) { hg.addColorStop(0, '#8e1a1a'); hg.addColorStop(0.4, '#e04a3a'); hg.addColorStop(1, '#7a1414'); }
    else { hg.addColorStop(0, '#9a6532'); hg.addColorStop(0.4, '#e3b17a'); hg.addColorStop(1, '#8a5528'); }
    rrect(ctx, -hw / 2, -L, hw, L + hw * 0.4, hw * 0.5);
    ctx.fillStyle = hg; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = Math.max(2, size * 0.022); ctx.strokeStyle = INK; ctx.stroke();
    // にぎりの巻き
    ctx.save(); rrect(ctx, -hw / 2, -L * 0.28, hw, L * 0.28 + hw * 0.4, hw * 0.5); ctx.clip();
    ctx.fillStyle = gold ? '#f2c53d' : '#3a5fb0'; ctx.fillRect(-hw, -L * 0.3, hw * 2, L * 0.4);
    ctx.strokeStyle = gold ? '#a8700c' : '#1f356b'; ctx.lineWidth = Math.max(1, size * 0.012);
    for (var i = 0; i < 7; i++) { var yy = -L * 0.28 + i * L * 0.045; ctx.beginPath(); ctx.moveTo(-hw, yy + hw * 0.6); ctx.lineTo(hw, yy); ctx.stroke(); }
    ctx.restore();
    rrect(ctx, -hw / 2, -L * 0.28, hw, L * 0.28 + hw * 0.4, hw * 0.5);
    ctx.lineWidth = Math.max(2, size * 0.02); ctx.strokeStyle = INK; ctx.stroke();
    // 頭(横にした円柱)
    var cy = -L - HH * 0.42;
    if (gold) { ctx.shadowColor = 'rgba(255,220,90,0.95)'; ctx.shadowBlur = size * 0.2; }
    var g2 = ctx.createLinearGradient(0, cy - HH / 2, 0, cy + HH / 2);
    if (gold) { g2.addColorStop(0, '#fff3a6'); g2.addColorStop(0.35, '#f5c93a'); g2.addColorStop(1, '#a8700c'); }
    else { g2.addColorStop(0, '#f0c48a'); g2.addColorStop(0.35, '#d39a5c'); g2.addColorStop(1, '#8c5a2c'); }
    ctx.beginPath();
    ctx.moveTo(-HW / 2, cy - HH / 2);
    ctx.lineTo(HW / 2, cy - HH / 2);
    ctx.ellipse(HW / 2, cy, HH * 0.16, HH / 2, 0, -PI / 2, PI / 2, false);
    ctx.lineTo(-HW / 2, cy + HH / 2);
    ctx.ellipse(-HW / 2, cy, HH * 0.16, HH / 2, 0, PI / 2, PI * 1.5, false);
    ctx.closePath();
    ctx.fillStyle = g2; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = Math.max(2, size * 0.024); ctx.strokeStyle = INK; ctx.stroke();
    // 両はしの帯
    [-1, 1].forEach(function (s) {
      var bx = s * HW * 0.36;
      ctx.fillStyle = gold ? '#d93a2a' : '#4a4f57';
      ctx.fillRect(bx - HW * 0.05, cy - HH / 2, HW * 0.1, HH);
      ctx.lineWidth = Math.max(1, size * 0.012); ctx.strokeRect(bx - HW * 0.05, cy - HH / 2, HW * 0.1, HH);
    });
    // 打つ面(左のはしの楕円)
    ctx.beginPath(); ctx.ellipse(-HW / 2, cy, HH * 0.16, HH / 2, 0, 0, TAU);
    ctx.fillStyle = gold ? '#ffe680' : '#f2d3a6'; ctx.fill();
    ctx.lineWidth = Math.max(2, size * 0.02); ctx.stroke();
    // 光
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    rrect(ctx, -HW * 0.3, cy - HH * 0.36, HW * 0.55, HH * 0.12, HH * 0.06); ctx.fill();
    if (gold) {
      var tt = (typeof performance !== 'undefined' ? performance.now() / 1000 : 0);
      sparkle(ctx, HW * 0.25, cy - HH * 0.7, size * (0.04 + 0.03 * Math.sin(tt * 6)), '#ffffff');
      sparkle(ctx, -HW * 0.55, cy + HH * 0.5, size * (0.03 + 0.02 * Math.sin(tt * 5 + 1)), '#fff6c0');
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------
  // 道具アイコン
  // ---------------------------------------------------------------
  function drawItem(ctx, x, y, size, name, t) {
    t = t || 0;
    var s = size / 2;
    ctx.save();
    ctx.translate(x, y);
    // 丸い台
    var bg = ctx.createRadialGradient(-s * 0.3, -s * 0.3, s * 0.1, 0, 0, s);
    var colors = { perfect: ['#fff4b0', '#f0b820'], blindfold: ['#c9d4ff', '#4a5fc0'], feather: ['#e0fff0', '#3cb88a'],
      prank: ['#e6ffd0', '#6aa82a'], joke: ['#ffe0ec', '#e05a8a'] };
    var cc = colors[name] || ['#ffffff', '#999999'];
    bg.addColorStop(0, cc[0]); bg.addColorStop(1, cc[1]);
    ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU); ctx.fillStyle = bg; ctx.fill();
    ctx.lineWidth = Math.max(2, s * 0.08); ctx.strokeStyle = INK; ctx.stroke();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    switch (name) {
      case 'perfect':
        drawHammer(ctx, s * 0.12, s * 0.62, -0.5, 'gold', s * 1.5);
        break;
      case 'blindfold': {
        ctx.fillStyle = '#2a3b8f'; ctx.strokeStyle = INK; ctx.lineWidth = s * 0.07;
        ctx.beginPath(); ctx.moveTo(-s * 0.75, -s * 0.22); ctx.quadraticCurveTo(0, -s * 0.38, s * 0.75, -s * 0.22);
        ctx.lineTo(s * 0.75, s * 0.18); ctx.quadraticCurveTo(0, s * 0.02, -s * 0.75, s * 0.18); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff';
        for (var i = -2; i <= 2; i++) { ctx.beginPath(); ctx.arc(i * s * 0.28, -s * 0.12 + (i % 2 ? s * 0.08 : 0), s * 0.06, 0, TAU); ctx.fill(); }
        ctx.fillStyle = '#2a3b8f';
        ctx.beginPath(); ctx.moveTo(s * 0.6, s * 0.05); ctx.lineTo(s * 0.45, s * 0.7); ctx.lineTo(s * 0.7, s * 0.62); ctx.closePath(); ctx.fill(); ctx.stroke();
        break;
      }
      case 'feather': {
        ctx.save(); ctx.rotate(-0.7 + Math.sin(t * 6) * 0.15);
        var fg = ctx.createLinearGradient(0, -s * 0.8, 0, s * 0.8);
        fg.addColorStop(0, '#ffffff'); fg.addColorStop(1, '#ffd0e6');
        ctx.fillStyle = fg; ctx.strokeStyle = INK; ctx.lineWidth = s * 0.06;
        ctx.beginPath(); ctx.moveTo(0, -s * 0.82);
        ctx.bezierCurveTo(s * 0.45, -s * 0.5, s * 0.35, s * 0.3, 0, s * 0.55);
        ctx.bezierCurveTo(-s * 0.35, s * 0.3, -s * 0.45, -s * 0.5, 0, -s * 0.82); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, -s * 0.7); ctx.lineTo(0, s * 0.85); ctx.stroke();
        ctx.lineWidth = s * 0.03;
        for (var k = 0; k < 5; k++) { var fy = -s * 0.5 + k * s * 0.2; ctx.beginPath(); ctx.moveTo(0, fy + s * 0.08); ctx.lineTo(s * 0.25, fy - s * 0.04); ctx.moveTo(0, fy + s * 0.08); ctx.lineTo(-s * 0.25, fy - s * 0.04); ctx.stroke(); }
        ctx.restore();
        break;
      }
      case 'prank': { // カエルのおもちゃ(いたずら)
        var hop = Math.abs(Math.sin(t * 5)) * s * 0.12;
        ctx.translate(0, -hop);
        ctx.fillStyle = '#5cc23a'; ctx.strokeStyle = INK; ctx.lineWidth = s * 0.06;
        ctx.beginPath(); ctx.ellipse(0, s * 0.15, s * 0.55, s * 0.4, 0, 0, TAU); ctx.fill(); ctx.stroke();
        [-1, 1].forEach(function (q) {
          ctx.fillStyle = '#5cc23a';
          ctx.beginPath(); ctx.arc(q * s * 0.28, -s * 0.22, s * 0.2, 0, TAU); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(q * s * 0.28, -s * 0.24, s * 0.12, 0, TAU); ctx.fill();
          ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(q * s * 0.28, -s * 0.22, s * 0.065, 0, TAU); ctx.fill();
        });
        ctx.beginPath(); ctx.moveTo(-s * 0.25, s * 0.15); ctx.quadraticCurveTo(0, s * 0.35, s * 0.25, s * 0.15); ctx.stroke();
        ctx.fillStyle = 'rgba(255,110,130,0.7)';
        ctx.beginPath(); ctx.arc(-s * 0.38, s * 0.12, s * 0.07, 0, TAU); ctx.arc(s * 0.38, s * 0.12, s * 0.07, 0, TAU); ctx.fill();
        break;
      }
      case 'joke': { // 扇子
        ctx.save(); ctx.translate(0, s * 0.45);
        var open = 0.95 + Math.sin(t * 4) * 0.05;
        for (var r = 0; r < 9; r++) {
          var a0 = -PI / 2 - open + r * open * 2 / 9, a1 = a0 + open * 2 / 9;
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, s * 0.95, a0, a1); ctx.closePath();
          ctx.fillStyle = r % 2 ? '#fff4f8' : '#ff8fb3'; ctx.fill();
        }
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, s * 0.95, -PI / 2 - open, -PI / 2 + open); ctx.closePath();
        ctx.lineWidth = s * 0.06; ctx.strokeStyle = INK; ctx.stroke();
        ctx.fillStyle = '#e8b923'; ctx.beginPath(); ctx.arc(0, 0, s * 0.1, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.restore();
        break;
      }
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------
  // 背景
  // ---------------------------------------------------------------
  var FLOOR_Y = 0.7;   // 床(畳・縁側)の始まり(高さに対する比)
  var bgCache = {};
  function makeCanvas(w, h) {
    if (typeof document !== 'undefined') { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
    return new OffscreenCanvas(w, h);
  }
  function getScale(ctx) {
    try { var m = ctx.getTransform(); return Math.max(1, Math.min(3, Math.hypot(m.a, m.b))); } catch (e) { return 2; }
  }

  // 畳(遠近感あり)
  function tatami(ctx, w, h, fy, tone) {
    var g = ctx.createLinearGradient(0, fy, 0, h);
    g.addColorStop(0, tone[0]); g.addColorStop(1, tone[1]);
    ctx.fillStyle = g; ctx.fillRect(0, fy, w, h - fy);
    // い草の線
    ctx.strokeStyle = 'rgba(80,90,30,0.18)'; ctx.lineWidth = 1;
    for (var y = fy + 2; y < h; y += 3 + (y - fy) * 0.03) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    // 畳のへり(遠近)
    var vx = w / 2, vy = fy - h * 0.5;
    ctx.strokeStyle = '#2f3a24'; ctx.lineWidth = 5;
    [-1.1, 0, 1.1].forEach(function (k) {
      var bx = w / 2 + k * w * 0.62;
      ctx.beginPath(); ctx.moveTo(lerp(vx, bx, (fy - vy) / (h - vy)), fy); ctx.lineTo(bx, h); ctx.stroke();
    });
    var ly = fy + (h - fy) * 0.45;
    ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(w, ly); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, ly - 3); ctx.lineTo(w, ly - 3); ctx.stroke();
  }
  function goldCloud(ctx, x, y, s) {
    ctx.beginPath();
    ctx.ellipse(x, y, s * 1.6, s * 0.5, 0, 0, TAU);
    ctx.ellipse(x - s * 0.8, y - s * 0.3, s * 0.7, s * 0.45, 0, 0, TAU);
    ctx.ellipse(x + s * 0.6, y - s * 0.35, s * 0.8, s * 0.5, 0, 0, TAU);
    ctx.fill();
  }
  function pine(ctx, x, y, s, col) {
    ctx.strokeStyle = '#5a3a22'; ctx.lineWidth = s * 0.12; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y + s * 1.4); ctx.bezierCurveTo(x - s * 0.4, y + s * 0.8, x + s * 0.5, y + s * 0.3, x - s * 0.2, y - s * 0.3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + s * 0.05, y + s * 0.5); ctx.quadraticCurveTo(x + s * 0.6, y + s * 0.3, x + s * 1.1, y + s * 0.2); ctx.stroke();
    ctx.fillStyle = col;
    [[-0.2, -0.4, 0.8], [0.9, 0.05, 0.6], [0.3, -0.1, 0.5], [-0.6, 0.15, 0.45]].forEach(function (p) {
      ctx.beginPath(); ctx.ellipse(x + p[0] * s, y + p[1] * s, p[2] * s, p[2] * s * 0.35, 0, 0, TAU); ctx.fill();
    });
  }

  function bgWashitsu(ctx, w, h) {
    var fy = h * FLOOR_Y;
    // 壁(土壁)
    ctx.fillStyle = '#e9d9b4'; ctx.fillRect(0, 0, w, fy);
    // 欄間
    ctx.fillStyle = '#5b3a22'; ctx.fillRect(0, h * 0.08, w, h * 0.012);
    ctx.fillRect(0, h * 0.15, w, h * 0.016);
    ctx.strokeStyle = 'rgba(91,58,34,0.8)'; ctx.lineWidth = 2;
    for (var x = 8; x < w; x += 14) { ctx.beginPath(); ctx.moveTo(x, h * 0.09); ctx.lineTo(x, h * 0.15); ctx.stroke(); }
    // ふすま(金地に雲と松)
    var top = h * 0.166, n = 4, fw = w / n;
    for (var i = 0; i < n; i++) {
      var x0 = i * fw;
      var g = ctx.createLinearGradient(0, top, 0, fy);
      g.addColorStop(0, '#f3dc9a'); g.addColorStop(1, '#d8b563');
      ctx.fillStyle = g; ctx.fillRect(x0, top, fw, fy - top);
      // 金箔の四角
      ctx.strokeStyle = 'rgba(170,130,40,0.18)'; ctx.lineWidth = 1;
      for (var yy = top; yy < fy; yy += fw / 3) for (var xx = x0; xx < x0 + fw; xx += fw / 3) ctx.strokeRect(xx, yy, fw / 3, fw / 3);
    }
    ctx.fillStyle = 'rgba(255,248,220,0.7)';
    goldCloud(ctx, w * 0.2, top + (fy - top) * 0.25, w * 0.08);
    goldCloud(ctx, w * 0.78, top + (fy - top) * 0.18, w * 0.07);
    goldCloud(ctx, w * 0.55, top + (fy - top) * 0.6, w * 0.06);
    pine(ctx, w * 0.12, top + (fy - top) * 0.5, w * 0.12, '#3f6b3a');
    pine(ctx, w * 0.86, top + (fy - top) * 0.45, w * 0.1, '#3f6b3a');
    // 枠と引手
    ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 5;
    for (i = 0; i <= n; i++) { ctx.beginPath(); ctx.moveTo(i * fw, top); ctx.lineTo(i * fw, fy); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(0, top); ctx.lineTo(w, top); ctx.stroke();
    [1, 3].forEach(function (k) {
      [-1, 1].forEach(function (s) {
        var hx = k * fw + s * fw * 0.14, hy = top + (fy - top) * 0.55;
        ctx.fillStyle = '#2a1a10'; ctx.beginPath(); ctx.ellipse(hx, hy, 5, 7, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#c99a3a'; ctx.beginPath(); ctx.ellipse(hx, hy, 3, 4.5, 0, 0, TAU); ctx.fill();
      });
    });
    // 敷居
    ctx.fillStyle = '#6b4428'; ctx.fillRect(0, fy - 6, w, 8);
    tatami(ctx, w, h, fy + 2, ['#c9c27a', '#a59a50']);
    // まわりを暗く
    var v = ctx.createRadialGradient(w / 2, h * 0.5, h * 0.3, w / 2, h * 0.5, h * 0.8);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(40,20,0,0.35)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
  }

  function bgYuyake(ctx, w, h) {
    var fy = h * FLOOR_Y;
    var sky = ctx.createLinearGradient(0, 0, 0, fy);
    sky.addColorStop(0, '#3a2a6e'); sky.addColorStop(0.35, '#b44a7a'); sky.addColorStop(0.7, '#ff8a4a'); sky.addColorStop(1, '#ffd27a');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, fy);
    // 夕日
    var sx = w * 0.7, sy = fy * 0.72;
    var sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, w * 0.45);
    sg.addColorStop(0, 'rgba(255,240,180,0.95)'); sg.addColorStop(0.15, 'rgba(255,190,90,0.7)'); sg.addColorStop(1, 'rgba(255,140,60,0)');
    ctx.fillStyle = sg; ctx.fillRect(0, 0, w, fy);
    ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(sx, sy, w * 0.09, 0, TAU); ctx.fill();
    // 山
    ctx.fillStyle = '#6a3a6a';
    ctx.beginPath(); ctx.moveTo(0, fy * 0.82);
    ctx.quadraticCurveTo(w * 0.2, fy * 0.62, w * 0.42, fy * 0.8); ctx.quadraticCurveTo(w * 0.62, fy * 0.7, w * 0.8, fy * 0.84); ctx.quadraticCurveTo(w * 0.92, fy * 0.76, w, fy * 0.8);
    ctx.lineTo(w, fy); ctx.lineTo(0, fy); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#3e2346';
    ctx.beginPath(); ctx.moveTo(0, fy * 0.9);
    for (var i = 0; i <= 12; i++) ctx.lineTo(w * i / 12, fy * (0.86 + (i % 3 === 0 ? -0.04 : 0.01) + Math.sin(i * 2.1) * 0.015));
    ctx.lineTo(w, fy); ctx.lineTo(0, fy); ctx.closePath(); ctx.fill();
    // 軒(上の屋根)
    ctx.fillStyle = '#2a1712';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, 0); ctx.lineTo(w, h * 0.07); ctx.quadraticCurveTo(w / 2, h * 0.1, 0, h * 0.07); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#4a2a1c';
    for (i = 0; i < 10; i++) ctx.fillRect(i * w / 10 + 4, h * 0.06, w / 10 - 8, h * 0.02);
    // 柱
    ctx.fillStyle = '#3a2216'; ctx.fillRect(0, 0, w * 0.06, fy); ctx.fillRect(w * 0.94, 0, w * 0.06, fy);
    // 縁側の床板
    var fg = ctx.createLinearGradient(0, fy, 0, h);
    fg.addColorStop(0, '#9a6236'); fg.addColorStop(1, '#5e3a1e');
    ctx.fillStyle = fg; ctx.fillRect(0, fy, w, h - fy);
    ctx.strokeStyle = 'rgba(40,20,8,0.6)'; ctx.lineWidth = 2;
    var vx = w / 2, vy = fy - h * 0.6;
    for (i = -6; i <= 6; i++) {
      var bx = w / 2 + i * w * 0.2;
      ctx.beginPath(); ctx.moveTo(lerp(vx, bx, (fy - vy) / (h - vy)), fy); ctx.lineTo(bx, h); ctx.stroke();
    }
    // 夕日の照り返し
    var rf = ctx.createLinearGradient(0, fy, 0, h);
    rf.addColorStop(0, 'rgba(255,170,90,0.45)'); rf.addColorStop(1, 'rgba(255,170,90,0)');
    ctx.fillStyle = rf; ctx.fillRect(0, fy, w, h - fy);
    ctx.fillStyle = '#2a1712'; ctx.fillRect(0, fy - 3, w, 6);
  }

  function bgYoru(ctx, w, h) {
    var fy = h * FLOOR_Y;
    ctx.fillStyle = '#1d2140'; ctx.fillRect(0, 0, w, fy);
    // 丸窓と月
    var mx = w * 0.5, my = fy * 0.42, mr = w * 0.3;
    var sg = ctx.createLinearGradient(0, my - mr, 0, my + mr);
    sg.addColorStop(0, '#16204a'); sg.addColorStop(1, '#3a4a8a');
    ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.clip();
    var moon = ctx.createRadialGradient(mx + mr * 0.25, my - mr * 0.25, 0, mx + mr * 0.25, my - mr * 0.25, mr * 0.9);
    moon.addColorStop(0, 'rgba(255,250,220,0.9)'); moon.addColorStop(0.3, 'rgba(255,240,180,0.25)'); moon.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = moon; ctx.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
    ctx.fillStyle = '#fff6d0'; ctx.beginPath(); ctx.arc(mx + mr * 0.25, my - mr * 0.25, mr * 0.28, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(220,200,140,0.5)';
    ctx.beginPath(); ctx.arc(mx + mr * 0.18, my - mr * 0.3, mr * 0.06, 0, TAU); ctx.arc(mx + mr * 0.33, my - mr * 0.16, mr * 0.04, 0, TAU); ctx.fill();
    // すすき
    ctx.strokeStyle = '#0d1230'; ctx.lineWidth = 2;
    for (var i = 0; i < 9; i++) {
      var bx = mx - mr * 0.7 + i * mr * 0.12;
      ctx.beginPath(); ctx.moveTo(bx, my + mr); ctx.quadraticCurveTo(bx + 10, my + mr * 0.3, bx + 22 + i * 2, my + mr * (0.05 + (i % 3) * 0.08)); ctx.stroke();
    }
    ctx.restore();
    ctx.lineWidth = 8; ctx.strokeStyle = '#3a2618'; ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.stroke();
    // 障子(左右)
    [[0, w * 0.16], [w * 0.84, w]].forEach(function (p) {
      var g = ctx.createLinearGradient(0, 0, 0, fy);
      g.addColorStop(0, '#3c4470'); g.addColorStop(1, '#565f92');
      ctx.fillStyle = g; ctx.fillRect(p[0], h * 0.1, p[1] - p[0], fy - h * 0.1);
      ctx.strokeStyle = '#2a1a12'; ctx.lineWidth = 2;
      for (var x = p[0]; x <= p[1]; x += (p[1] - p[0]) / 2) { ctx.beginPath(); ctx.moveTo(x, h * 0.1); ctx.lineTo(x, fy); ctx.stroke(); }
      for (var y = h * 0.1; y <= fy; y += (fy - h * 0.1) / 6) { ctx.beginPath(); ctx.moveTo(p[0], y); ctx.lineTo(p[1], y); ctx.stroke(); }
    });
    ctx.fillStyle = '#2a1a12'; ctx.fillRect(0, h * 0.09, w, 8);
    tatami(ctx, w, h, fy, ['#5b6040', '#3a3d28']);
    ctx.fillStyle = '#20140c'; ctx.fillRect(0, fy - 4, w, 6);
  }

  function drawBackground(ctx, w, h, t, theme) {
    t = t || 0;
    if (theme !== 'yuyake' && theme !== 'yoru') theme = 'washitsu';
    var sc = getScale(ctx), key = theme + '|' + w + '|' + h + '|' + sc;
    var c = bgCache[key];
    if (!c) {
      c = makeCanvas(Math.ceil(w * sc), Math.ceil(h * sc));
      var cx = c.getContext('2d');
      cx.setTransform(sc, 0, 0, sc, 0, 0);
      if (theme === 'yuyake') bgYuyake(cx, w, h); else if (theme === 'yoru') bgYoru(cx, w, h); else bgWashitsu(cx, w, h);
      bgCache = {}; bgCache[key] = c;
    }
    ctx.drawImage(c, 0, 0, w, h);
    var fy = h * FLOOR_Y, i;
    // 動く部分
    ctx.save();
    if (theme === 'washitsu') {
      // 障子ごしの光がゆらぐ
      ctx.fillStyle = 'rgba(255,240,200,' + (0.05 + 0.03 * Math.sin(t * 0.7)) + ')';
      ctx.fillRect(0, 0, w, h);
    } else if (theme === 'yuyake') {
      // 赤とんぼ
      for (i = 0; i < 3; i++) {
        var a = t * (0.35 + i * 0.1) + i * 2.1;
        var x = fract(a * 0.12 + i * 0.33) * (w + 60) - 30, y = fy * (0.25 + i * 0.12) + Math.sin(a * 3) * 12;
        ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(a * 2) * 0.2);
        ctx.fillStyle = '#d8402a';
        ctx.fillRect(-9, -1.5, 14, 3);
        var fl = Math.sin(t * 40 + i) * 0.4;
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath(); ctx.ellipse(1, -4, 2.5, 6, 0.4 + fl, 0, TAU); ctx.ellipse(1, 4, 2.5, 6, -0.4 - fl, 0, TAU); ctx.fill();
        ctx.restore();
      }
      // 風鈴
      var fx = w * 0.18, fyy = h * 0.09, sw = Math.sin(t * 1.8) * 0.18;
      ctx.translate(fx, fyy); ctx.rotate(sw); ctx.scale(1.7, 1.7);
      ctx.strokeStyle = '#2a1712'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 18); ctx.stroke();
      ctx.fillStyle = 'rgba(200,235,255,0.85)'; ctx.strokeStyle = '#2a4a6a'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 30, 12, PI, 0); ctx.lineTo(12, 32); ctx.lineTo(-12, 32); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e04a4a'; ctx.beginPath(); ctx.arc(-4, 24, 2.5, 0, TAU); ctx.arc(4, 26, 2.5, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#2a1712'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, 32); ctx.lineTo(0, 46); ctx.stroke();
      ctx.rotate(Math.sin(t * 2.6) * 0.3);
      ctx.fillStyle = '#fff6e0'; ctx.strokeStyle = '#2a1712';
      ctx.fillRect(-5, 46, 10, 20); ctx.strokeRect(-5, 46, 10, 20);
    } else {
      // あんどんの光のゆらぎ
      var ax = w * 0.12, ay = fy - 4;
      var fl2 = 0.85 + 0.15 * Math.sin(t * 9) * Math.sin(t * 3.7);
      var lg = ctx.createRadialGradient(ax, ay - 40, 0, ax, ay - 40, w * 0.6 * fl2);
      lg.addColorStop(0, 'rgba(255,190,90,0.35)'); lg.addColorStop(1, 'rgba(255,190,90,0)');
      ctx.fillStyle = lg; ctx.fillRect(0, 0, w, h);
      // あんどん本体
      ctx.fillStyle = '#2a1a10'; ctx.fillRect(ax - 20, ay - 70, 40, 4); ctx.fillRect(ax - 20, ay - 4, 40, 6);
      ctx.fillStyle = 'rgba(255,' + (210 + 20 * fl2 | 0) + ',140,0.95)'; ctx.fillRect(ax - 17, ay - 66, 34, 62);
      ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 2; ctx.strokeRect(ax - 17, ay - 66, 34, 62);
      ctx.beginPath(); ctx.moveTo(ax, ay - 66); ctx.lineTo(ax, ay - 4); ctx.stroke();
      // ほたる
      for (i = 0; i < 4; i++) {
        var px = w * (0.3 + 0.4 * fract(i * 0.37 + t * 0.03)) + Math.sin(t * 0.8 + i) * 20;
        var py = fy * (0.25 + 0.2 * Math.sin(t * 0.5 + i * 1.3));
        var gl = 0.5 + 0.5 * Math.sin(t * 3 + i * 2);
        var hg = ctx.createRadialGradient(px, py, 0, px, py, 8);
        hg.addColorStop(0, 'rgba(220,255,140,' + gl + ')'); hg.addColorStop(1, 'rgba(220,255,140,0)');
        ctx.fillStyle = hg; ctx.fillRect(px - 8, py - 8, 16, 16);
      }
    }
    ctx.restore();
  }

  window.DARUMA_ART = {
    drawHead: drawHead,
    drawBlock: drawBlock,
    drawHammer: drawHammer,
    drawBackground: drawBackground,
    drawItem: drawItem,
    drawGoldenBalloon: drawGoldenBalloon, // ゴールデンだるま(風船のように ふくらむ)
    drawGoldenPop: drawGoldenPop, // ゴールデンだるまが くす玉のように弾ける
    drawFace: drawFace,           // 表情 id で前向きのだるま
    drawFaceLocked: drawFaceLocked, // まだ見ていない顔(?の影絵)
    faceThumb: faceThumb,         // 表情の小さな絵(ためておく canvas)
    FACES: FACES,                 // 表情 100 こ {id, name, group, recipe}
    FACE_GROUPS: FACE_GROUPS,     // グループの日本語名
    MOODS: MOODS,                 // 表情の名前の一覧
    MOOD_LABELS: MOOD_LABELS,     // 表情の日本語名
    BLOCK_KINDS: BLOCK_KINDS,     // 段の種類の一覧
    BLOCK_LABELS: (function () { var o = {}; BLOCK_KINDS.forEach(function (k) { o[k] = KIND[k].label; }); return o; })(),
    BLOCK_COLORS: (function () { var o = {}; BLOCK_KINDS.forEach(function (k) { o[k] = KIND[k].c; }); return o; })(),
    HEAD_BOTTOM: BOTTOM / 2,      // 頭の中心から底までの距離 = size * HEAD_BOTTOM
    FLOOR_Y: FLOOR_Y,
    BACKGROUNDS: ['washitsu', 'yuyake', 'yoru'],
    ITEMS: ['perfect', 'blindfold', 'feather', 'prank', 'joke']
  };
})();
