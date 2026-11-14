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
    ctx.scale(P.dir * p[2] * P.R, P.R);
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

  // 表情ごとの決まり
  // brow: 眉(左の眉の 内はし iu,iv / 外はし ou,ov / そり arch / 太さ w)。右は左右反転。
  // eye : type open/arcUp/arcDown/squeeze/spiral/blank/none, lid=上まぶた 0〜1, lidAng=つり具合(+で内側が下がる=怒り),
  //       low=下まぶた, pr=黒目の大きさ, look=[x,y] 黒目の向き, size=目の大きさ, wet=うるうる
  var MOOD_LABELS = {
    normal: 'ふつう', happy: 'にこにこ', laugh: '大笑い', angry: 'おこり', mean: 'いじわる', sleepy: 'ねむい',
    sad: 'なきそう', shy: 'てれ', surprised: 'びっくり', blind: '目かくし', dizzy: 'めがまわる', smug: 'ドヤ',
    suspicious: 'うたがい', oneeye: '片目(伝統)'
  };
  var MOODS = Object.keys(MOOD_LABELS);

  function B(iu, iv, ou, ov, arch, w) { return { iu: iu * 1.05, iv: iv - 0.02, ou: ou * 1.08, ov: ov - 0.02, arch: arch, w: (w || 0.11) * 1.12 }; }
  function E(o) {
    var e = { type: 'open', lid: 0, lidAng: 0, low: 0, pr: 0.56, look: [0, 0.12], size: 1, wet: false };
    for (var k in o) e[k] = o[k];
    return e;
  }
  function moodSpec(mood, t) {
    var S = { browL: B(0.07, -0.47, 0.43, -0.49, 0.07), browR: null, eyeL: E({}), eyeR: null,
      mouth: 'smile', cheek: 0.45, tint: null, mustache: true };
    switch (mood) {
      case 'happy':
        S.browL = B(0.07, -0.52, 0.43, -0.52, 0.1);
        S.eyeL = E({ type: 'arcUp' }); S.mouth = 'open'; S.cheek = 0.7; break;
      case 'laugh':
        S.browL = B(0.07, -0.55, 0.43, -0.5, 0.12);
        S.eyeL = E({ type: 'squeeze' }); S.mouth = 'big'; S.cheek = 0.85; break;
      case 'angry':
        S.browL = B(0.05, -0.34, 0.44, -0.55, -0.02, 0.15);
        S.eyeL = E({ pr: 0.38, lid: 0.36, lidAng: 0.55, look: [0, 0.05] });
        S.mouth = 'grit'; S.cheek = 0; S.tint = 'angry'; break;
      case 'mean':
        S.browL = B(0.06, -0.38, 0.43, -0.47, 0.0, 0.13);     // 見て左の眉: 下げる
        S.browR = B(0.07, -0.52, 0.42, -0.63, 0.13, 0.11);    // 見て右の眉: つり上げる
        S.eyeL = E({ lid: 0.5, lidAng: 0.38, low: 0.2, pr: 0.5, look: [0.75, 0.1] });
        S.eyeR = E({ lid: 0.42, lidAng: 0.3, low: 0.18, pr: 0.5, look: [0.75, 0.1] });
        S.mouth = 'smirk'; S.cheek = 0.15; S.tint = 'mean'; break;
      case 'sleepy':
        S.browL = B(0.07, -0.46, 0.43, -0.41, 0.05, 0.1);
        S.eyeL = E({ lid: 0.6 + 0.14 * Math.sin(t * 1.3), lidAng: -0.12, pr: 0.5, look: [0, 0.45] });
        S.mouth = 'yawn'; S.cheek = 0.35; break;
      case 'sad':
        S.browL = B(0.06, -0.6, 0.42, -0.42, -0.05, 0.12);
        S.eyeL = E({ pr: 0.64, look: [0, 0.2], wet: true });
        S.mouth = 'sad'; S.cheek = 0.25; S.tint = 'sad'; break;
      case 'shy':
        S.browL = B(0.07, -0.52, 0.43, -0.45, 0.04, 0.1);
        S.eyeL = E({ pr: 0.6, look: [-0.8, 0.55], wet: true });
        S.mouth = 'wavy'; S.cheek = 1.2; break;
      case 'surprised':
        S.browL = B(0.07, -0.62, 0.43, -0.62, 0.12, 0.09);
        S.eyeL = E({ size: 1.12, pr: 0.26, look: [0, 0] });
        S.mouth = 'O'; S.cheek = 0.15; break;
      case 'blind':
        S.browL = B(0.07, -0.53, 0.43, -0.55, 0.09, 0.1);
        S.eyeL = E({ type: 'none' }); S.mouth = 'open'; S.cheek = 0.55; break;
      case 'dizzy':
        S.browL = B(0.07, -0.53, 0.43, -0.44, -0.02, 0.1);
        S.eyeL = E({ type: 'spiral' }); S.mouth = 'wavy'; S.cheek = 0.3; break;
      case 'smug':
        S.browL = B(0.07, -0.5, 0.43, -0.58, 0.1, 0.11);
        S.eyeL = E({ lid: 0.5, lidAng: -0.3, low: 0.12, pr: 0.55, look: [0, 0.1] });
        S.mouth = 'smug'; S.cheek = 0.5; break;
      case 'suspicious':
        S.browL = B(0.06, -0.41, 0.43, -0.43, 0.0, 0.12);
        S.eyeL = E({ lid: 0.52, low: 0.24, pr: 0.55, look: [-0.85, 0] });
        S.mouth = 'flat'; S.cheek = 0.15; break;
      case 'oneeye':
        S.eyeL = E({}); S.eyeR = E({ type: 'blank' }); break;
    }
    if (!S.browR) S.browR = S.browL;
    if (!S.eyeR) S.eyeR = S.eyeL;
    return S;
  }

  // ---- 部品: 眉(s=-1 見て左, +1 見て右) ----
  function drawBrow(ctx, P, b, s, faceAng) {
    var mu = s * (b.iu + b.ou) / 2, mv = (b.iv + b.ov) / 2;
    feat(ctx, P, mu, mv, function () {
      var p0 = [s * b.iu - mu, b.iv - mv], p3 = [s * b.ou - mu, b.ov - mv];
      var dx = p3[0] - p0[0], dy = p3[1] - p0[1];
      var p1 = [p0[0] + dx * 0.33, p0[1] + dy * 0.33 - b.arch];
      var p2 = [p0[0] + dx * 0.7, p0[1] + dy * 0.7 - b.arch * 0.9];
      ctx.fillStyle = INK;
      brush(ctx, p0, p1, p2, p3, b.w, b.w * 0.18, b.w * 0.35);
      // 筆の毛のはね(だるまらしい ふさふさ眉)
      ctx.fillStyle = INK;
      var tip = bez(p0, p1, p2, p3, 0.86);
      brush(ctx, tip, [tip[0] + s * 0.03, tip[1] - 0.01], [tip[0] + s * 0.06, tip[1] - 0.03], [tip[0] + s * 0.07, tip[1] - 0.07], 0.035, 0.005, 0);
    }, 0, 0.08);
  }

  // ---- 部品: 目 ----
  function drawEye(ctx, P, e, s, t, blink, faceColor, lookAdd, opts) {
    if (e.type === 'none') return;
    feat(ctx, P, s * EYE.u, EYE.v, function (c) {
      var r = EYE.r * e.size;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (e.type === 'arcUp') {           // にこっ(^ ^)
        ctx.strokeStyle = INK; ctx.lineWidth = 0.065;
        ctx.beginPath(); ctx.moveTo(-r * 0.95, r * 0.35); ctx.quadraticCurveTo(0, -r * 1.05, r * 0.95, r * 0.35); ctx.stroke();
        return;
      }
      if (e.type === 'arcDown') {
        ctx.strokeStyle = INK; ctx.lineWidth = 0.06;
        ctx.beginPath(); ctx.moveTo(-r, 0); ctx.quadraticCurveTo(0, r * 0.8, r, 0); ctx.stroke();
        return;
      }
      if (e.type === 'squeeze') {         // > <
        ctx.strokeStyle = INK; ctx.lineWidth = 0.07;
        var tx = -s * r * 0.75;
        ctx.beginPath(); ctx.moveTo(s * r * 0.8, -r * 0.75); ctx.lineTo(tx, 0); ctx.lineTo(s * r * 0.8, r * 0.75); ctx.stroke();
        return;
      }
      // 白目
      ctx.beginPath(); ctx.ellipse(0, 0, r, r * 1.04, 0, 0, TAU);
      ctx.fillStyle = '#ffffff'; ctx.fill();
      if (e.type === 'blank') {           // 伝統の「まだ黒目を入れていない」目
        ctx.lineWidth = 0.035; ctx.strokeStyle = INK; ctx.stroke();
        return;
      }
      if (e.type === 'spiral') {          // ぐるぐる目
        ctx.save();
        ctx.clip();
        ctx.rotate(t * 7 * s);
        ctx.strokeStyle = INK; ctx.lineWidth = 0.032;
        ctx.beginPath();
        for (var i = 0; i <= 60; i++) {
          var a = i / 60 * TAU * 2.6, rr = r * 0.92 * i / 60;
          if (i) ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else ctx.moveTo(0, 0);
        }
        ctx.stroke();
        ctx.restore();
        ctx.beginPath(); ctx.ellipse(0, 0, r, r * 1.04, 0, 0, TAU);
        ctx.lineWidth = 0.035; ctx.strokeStyle = INK; ctx.stroke();
        return;
      }
      var lid = Math.max(e.lid, 1 - blink);
      if (lid > 0.9) {                    // 閉じた目(まばたき)
        ctx.fillStyle = faceColor;
        ctx.beginPath(); ctx.ellipse(0, 0, r * 1.06, r * 1.1, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = INK; ctx.lineWidth = 0.05;
        ctx.beginPath(); ctx.moveTo(-r, r * 0.05); ctx.quadraticCurveTo(0, r * 0.6, r, r * 0.05); ctx.stroke();
        return;
      }
      ctx.save();
      ctx.beginPath(); ctx.ellipse(0, 0, r, r * 1.04, 0, 0, TAU); ctx.clip();
      // うるうる(下に水)
      if (e.wet) {
        ctx.fillStyle = 'rgba(120,190,255,0.45)';
        ctx.beginPath(); ctx.ellipse(0, r * 0.95, r * 1.1, r * 0.45, 0, 0, TAU); ctx.fill();
      }
      // 黒目
      var lx = clamp(e.look[0] + lookAdd[0], -1, 1), ly = clamp(e.look[1] + lookAdd[1], -1, 1);
      var pr = r * e.pr, px = lx * (r - pr) * 0.9, py = ly * (r - pr) * 0.9;
      ctx.fillStyle = INK;
      ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU); ctx.fill();
      // 黒目の中の茶色(やわらかく)
      ctx.fillStyle = '#4a2a1a';
      ctx.beginPath(); ctx.arc(px, py + pr * 0.25, pr * 0.62, 0, TAU); ctx.fill();
      ctx.fillStyle = INK;
      ctx.beginPath(); ctx.arc(px, py, pr * 0.42, 0, TAU); ctx.fill();
      // 光
      ctx.fillStyle = '#ffffff';
      var hl = e.wet ? 1.35 : 1;
      ctx.beginPath(); ctx.arc(px - pr * 0.36, py - pr * 0.4, pr * 0.34 * hl, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(px + pr * 0.38, py + pr * 0.34, pr * 0.15 * hl, 0, TAU); ctx.fill();
      if (e.wet) { ctx.beginPath(); ctx.arc(px + pr * 0.1, py - pr * 0.62, pr * 0.1, 0, TAU); ctx.fill(); }
      // 上まぶた
      if (lid > 0.01) {
        var k = -s * Math.tan(e.lidAng), y0 = -r * 1.04 + 2 * r * 1.04 * lid;
        ctx.fillStyle = faceColor;
        ctx.beginPath();
        ctx.moveTo(-r * 1.2, y0 - k * r * 1.2); ctx.lineTo(r * 1.2, y0 + k * r * 1.2);
        ctx.lineTo(r * 1.2, -r * 1.4); ctx.lineTo(-r * 1.2, -r * 1.4); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = INK; ctx.lineWidth = 0.05;
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
      ctx.lineWidth = 0.04; ctx.strokeStyle = INK; ctx.stroke();
      // まつげ(外がわに2本・かわいさ)
      if (lid < 0.4 && !e.wet) {
        ctx.lineWidth = 0.03;
        ctx.beginPath();
        ctx.moveTo(s * r * 0.82, -r * 0.62); ctx.lineTo(s * r * 1.08, -r * 0.86);
        ctx.moveTo(s * r * 0.98, -r * 0.3); ctx.lineTo(s * r * 1.26, -r * 0.4);
        ctx.stroke();
      }
    }, 0, 0.06);
  }

  // ---- 部品: 口 ----
  function drawMouth(ctx, P, type, t) {
    feat(ctx, P, 0, MOUTH_V, function () {
      ctx.scale(MS, MS);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = INK; ctx.lineWidth = 0.038;
      var inside = '#9b2228', tongue = '#ff8a92';
      function dMouth(w, d) {
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
        // 上の歯
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-w, -0.04, w * 2, 0.045);
        ctx.restore();
        pth(); ctx.stroke();
      }
      switch (type) {
        case 'open': dMouth(0.11, 0.14); break;
        case 'big': {
          var o = 0.2 + 0.03 * Math.sin(t * 24);
          dMouth(0.16, o);
          break;
        }
        case 'grit': {
          ctx.beginPath();
          ctx.moveTo(-0.15, 0.06);
          ctx.bezierCurveTo(-0.1, -0.06, 0.1, -0.06, 0.15, 0.06);
          ctx.bezierCurveTo(0.07, 0.1, -0.07, 0.1, -0.15, 0.06);
          ctx.closePath();
          ctx.fillStyle = '#ffffff'; ctx.fill();
          ctx.save(); ctx.clip();
          ctx.lineWidth = 0.022;
          ctx.beginPath();
          ctx.moveTo(-0.16, 0.035); ctx.quadraticCurveTo(0, 0.0, 0.16, 0.035);
          for (var i = -2; i <= 2; i++) { ctx.moveTo(i * 0.055, -0.06); ctx.lineTo(i * 0.055, 0.12); }
          ctx.stroke();
          ctx.restore();
          ctx.lineWidth = 0.038;
          ctx.beginPath();
          ctx.moveTo(-0.15, 0.06);
          ctx.bezierCurveTo(-0.1, -0.06, 0.1, -0.06, 0.15, 0.06);
          ctx.bezierCurveTo(0.07, 0.1, -0.07, 0.1, -0.15, 0.06);
          ctx.closePath(); ctx.stroke();
          break;
        }
        case 'smirk': { // にやり(片方だけ上がった、歯の見える笑い)
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
          for (var ti = -2; ti <= 3; ti++) { ctx.beginPath(); ctx.moveTo(ti * 0.045, -0.1); ctx.lineTo(ti * 0.045 + 0.01, 0.08); ctx.stroke(); }
          ctx.restore();
          ctx.lineWidth = 0.035; sm(); ctx.stroke();
          // えくぼ
          ctx.lineWidth = 0.025;
          ctx.beginPath(); ctx.moveTo(0.14, -0.12); ctx.quadraticCurveTo(0.2, -0.08, 0.17, -0.03); ctx.stroke();
          break;
        }
        case 'yawn': {
          var ph = fract(t / 4.2), op = ph < 0.35 ? Math.sin(ph / 0.35 * PI) : 0;
          var rx = 0.05 + 0.04 * op, ry = 0.045 + 0.08 * op;
          ctx.beginPath(); ctx.ellipse(0, 0.02 + ry * 0.3, rx, ry, 0, 0, TAU);
          ctx.fillStyle = inside; ctx.fill(); ctx.stroke();
          break;
        }
        case 'O':
          ctx.beginPath(); ctx.ellipse(0, 0.045, 0.08, 0.105, 0, 0, TAU);
          ctx.fillStyle = inside; ctx.fill();
          ctx.save(); ctx.clip(); ctx.fillStyle = tongue;
          ctx.beginPath(); ctx.ellipse(0, 0.13, 0.06, 0.04, 0, 0, TAU); ctx.fill(); ctx.restore();
          ctx.beginPath(); ctx.ellipse(0, 0.045, 0.08, 0.105, 0, 0, TAU);
          ctx.stroke();
          break;
        case 'sad': { // への字に開いた、泣き出しそうな口
          var tr = Math.sin(t * 30) * 0.006;
          var sp = function () {
            ctx.beginPath(); ctx.moveTo(-0.11, 0.08);
            ctx.bezierCurveTo(-0.08, -0.04 + tr, 0.08, -0.04 - tr, 0.11, 0.08);
            ctx.quadraticCurveTo(0, 0.05, -0.11, 0.08); ctx.closePath();
          };
          sp(); ctx.fillStyle = inside; ctx.fill(); ctx.stroke();
          break;
        }
        case 'wavy': {
          ctx.beginPath(); ctx.moveTo(-0.11, 0.01);
          for (var j = 1; j <= 4; j++) {
            ctx.quadraticCurveTo(-0.11 + (j - 0.5) * 0.055, (j % 2 ? -0.035 : 0.055), -0.11 + j * 0.055, 0.01);
          }
          ctx.stroke();
          break;
        }
        case 'smug': { // ドヤ: 口角が きゅっと上がった 大きめの笑み
          ctx.beginPath(); ctx.moveTo(-0.15, -0.05);
          ctx.quadraticCurveTo(-0.12, 0.02, -0.06, 0.03);
          ctx.quadraticCurveTo(0, 0.045, 0.06, 0.03);
          ctx.quadraticCurveTo(0.12, 0.02, 0.15, -0.05);
          ctx.stroke();
          ctx.lineWidth = 0.025;
          ctx.beginPath(); ctx.moveTo(-0.17, -0.08); ctx.lineTo(-0.13, -0.03); ctx.moveTo(0.17, -0.08); ctx.lineTo(0.13, -0.03); ctx.stroke();
          break;
        }
        case 'omega':
          ctx.beginPath(); ctx.moveTo(-0.13, -0.03);
          ctx.quadraticCurveTo(-0.07, 0.08, 0, 0.0);
          ctx.quadraticCurveTo(0.07, 0.08, 0.13, -0.03);
          ctx.stroke();
          break;
        case 'flat':
          ctx.beginPath(); ctx.moveTo(-0.08, 0.02); ctx.lineTo(0.08, 0.02); ctx.stroke();
          break;
        default: // smile
          ctx.beginPath(); ctx.moveTo(-0.1, -0.015); ctx.quadraticCurveTo(0, 0.08, 0.1, -0.015); ctx.stroke();
      }
    }, 0, 0.1);
  }

  // ---- 部品: ひげ(鼻の下の口ひげ と あごひげ) ----
  function drawMustache(ctx, P, s, mood, t) {
    var lift = (mood === 'angry') ? -0.02 : (mood === 'laugh' || mood === 'happy') ? -0.025 : (mood === 'sad') ? 0.02 : 0;
    var wig = (mood === 'laugh') ? Math.sin(t * 24) * 0.012 : 0;
    feat(ctx, P, s * 0.19, 0.115, function () {
      ctx.fillStyle = INK;
      var o = -s * 0.19;
      brush(ctx, [o + s * 0.035, -0.015], [o + s * 0.12, -0.06], [o + s * 0.27, 0.08 + lift],
        [o + s * 0.37, -0.04 + lift + wig], 0.085, 0.014, 0.012);
    }, 0, 0.08);
  }
  function drawBeard(ctx, P, mood) {
    if (mood !== 'smile' && mood !== 'wavy' && mood !== 'flat' && mood !== 'omega') return;
    var low = (mood === 'O') ? 0.04 : (mood === 'open') ? 0.03 : 0;
    feat(ctx, P, 0, 0.455 + low, function () {
      ctx.fillStyle = INK;
      brush(ctx, [0, -0.035], [0.012, -0.0], [-0.012, 0.03], [0.006, 0.06], 0.05, 0.01, 0);
      brush(ctx, [-0.06, -0.04], [-0.07, -0.005], [-0.1, 0.02], [-0.13, 0.035], 0.045, 0.008, 0);
      brush(ctx, [0.06, -0.04], [0.07, -0.005], [0.1, 0.02], [0.13, 0.035], 0.045, 0.008, 0);
    }, 0, 0.12);
  }

  // ---- 背中の飾り ----
  function drawBack(ctx, P, opts) {
    var txt = opts.backText || '福';
    // 金の丸
    feat(ctx, P, 0, -0.08, function () {
      ctx.lineWidth = 0.05; ctx.strokeStyle = '#f2c53d';
      ctx.beginPath(); ctx.arc(0, 0, 0.5, 0, TAU); ctx.stroke();
      ctx.lineWidth = 0.018; ctx.strokeStyle = '#a8700c';
      ctx.beginPath(); ctx.arc(0, 0, 0.44, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 0.56, 0, TAU); ctx.stroke();
      if (P.dir < 0) ctx.scale(-1, 1); // 左から回るときも字が裏返らないように
      ctx.font = 'bold ' + (txt.length > 1 ? 0.36 : 0.58) + 'px "Hiragino Mincho ProN","Yu Mincho","Noto Serif JP","Noto Serif CJK JP",serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      var g = ctx.createLinearGradient(0, -0.35, 0, 0.35);
      g.addColorStop(0, '#fff3b0'); g.addColorStop(0.5, '#f5c542'); g.addColorStop(1, '#c48a12');
      ctx.lineJoin = 'round';
      for (var i = 0; i < txt.length; i++) {
        var yy = txt.length > 1 ? (i - (txt.length - 1) / 2) * 0.37 : 0.02;
        ctx.lineWidth = 0.05; ctx.strokeStyle = '#6b1010'; ctx.strokeText(txt[i], 0, yy);
        ctx.fillStyle = g; ctx.fillText(txt[i], 0, yy);
      }
    }, PI, 0.05);
  }
  // 横の金のうず巻き(回るときの目印)
  function drawSideSwirls(ctx, P) {
    [-1, 1].forEach(function (s) {
      feat(ctx, P, 0, -0.05, function () {
        ctx.strokeStyle = '#f2c53d'; ctx.lineWidth = 0.04; ctx.lineCap = 'round';
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
  // 下の金の帯と梅の花
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
    ring(0.57, R * 0.035, '#f2c53d');
    ring(0.83, R * 0.035, '#f2c53d');
    for (var k = 0; k < 10; k++) {
      feat(ctx, P, 0, 0.70, function () {
        ctx.fillStyle = '#f5c842';
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
  // 目かくしの布(豆しぼり)。頭をぐるっと一周する
  function drawBlindfold(ctx, P, t) {
    var R = P.R, v0 = EYE.v - 0.15, v1 = EYE.v + 0.13;
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
    g.addColorStop(0, '#3b4fa8'); g.addColorStop(0.5, '#2a3b8f'); g.addColorStop(1, '#1d2a6b');
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = R * 0.03; ctx.strokeStyle = INK; ctx.stroke();
    // 白い水玉(回る目印)
    for (var k = 0; k < 14; k++) {
      feat(ctx, P, 0, (v0 + v1) / 2 + (k % 2 ? 0.05 : -0.05), function () {
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.beginPath(); ctx.arc(0, 0, 0.035, 0, TAU); ctx.fill();
      }, k / 14 * TAU, 0.05);
    }
    // 結び目(背中がわ)
    feat(ctx, P, 0, (v0 + v1) / 2 + 0.02, function () {
      ctx.fillStyle = '#2a3b8f'; ctx.strokeStyle = INK; ctx.lineWidth = 0.03;
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

  // ---- 顔まわりの動くもの(湯気・Zzz・音符…) 頭の中心が原点、単位は px ----
  function drawExtras(ctx, R, mood, t, faceC) {
    var i, p, x, y;
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (mood === 'angry') {
      // 湯気
      for (i = 0; i < 4; i++) {
        var s = i % 2 ? 1 : -1;
        p = fract(t * 0.9 + i * 0.25);
        x = s * (R * 0.42 + p * R * 0.3); y = -R * 0.88 - p * R * 0.65;
        var pr = R * (0.09 + p * 0.1);
        ctx.globalAlpha = (1 - p) * 0.9;
        ctx.fillStyle = '#ffffff'; ctx.strokeStyle = 'rgba(120,120,140,0.6)'; ctx.lineWidth = R * 0.02;
        ctx.beginPath();
        ctx.arc(x, y, pr, 0, TAU); ctx.arc(x + pr * 0.8, y + pr * 0.2, pr * 0.7, 0, TAU); ctx.arc(x - pr * 0.75, y + pr * 0.25, pr * 0.65, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      // 怒りマーク
      var sc = R * (0.24 + 0.03 * Math.sin(t * 12));
      ctx.save(); ctx.translate(R * 0.58, -R * 0.72);
      for (var q = 0; q < 2; q++) {
        ctx.lineWidth = q ? sc * 0.17 : sc * 0.36;
        ctx.strokeStyle = q ? '#e01b24' : '#ffffff';
        for (i = 0; i < 4; i++) {
          ctx.save(); ctx.rotate(i * PI / 2);
          ctx.beginPath(); ctx.moveTo(sc * 0.12, -sc * 0.55); ctx.quadraticCurveTo(sc * 0.14, -sc * 0.14, sc * 0.55, -sc * 0.12); ctx.stroke();
          ctx.restore();
        }
      }
      ctx.restore();
    }
    if (mood === 'sleepy') {
      for (i = 0; i < 3; i++) {
        p = fract(t * 0.35 + i / 3);
        ctx.globalAlpha = p < 0.15 ? p / 0.15 : (1 - p);
        outlinedText(ctx, 'Z', R * (0.55 + p * 0.45), -R * (0.75 + p * 0.6), Math.round(R * (0.18 + p * 0.18)), '#cfe3ff', '#2b3a66');
      }
      ctx.globalAlpha = 1;
    }
    if (mood === 'happy' || mood === 'laugh') {
      for (i = 0; i < 2; i++) {
        p = fract(t * 0.5 + i * 0.5);
        x = (i ? -1 : 1) * R * (0.8 + Math.sin(p * 6) * 0.06); y = -R * (0.45 + p * 0.65);
        ctx.globalAlpha = Math.min(1, (1 - p) * 2);
        ctx.fillStyle = i ? '#ff7ab0' : '#ffd23f'; ctx.strokeStyle = INK; ctx.lineWidth = R * 0.02;
        var ns = R * 0.11;
        ctx.save(); ctx.translate(x, y); ctx.rotate(-0.25);
        ctx.beginPath(); ctx.ellipse(0, 0, ns * 0.75, ns * 0.55, -0.4, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ns * 0.6, -ns * 0.1); ctx.lineTo(ns * 0.6, -ns * 1.9); ctx.quadraticCurveTo(ns * 1.3, -ns * 1.5, ns * 1.2, -ns * 0.9); ctx.stroke();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
    if (mood === 'dizzy') {
      for (i = 0; i < 3; i++) {
        var a = t * 3 + i * TAU / 3;
        x = Math.cos(a) * R * 0.62; y = -R * 1.02 + Math.sin(a) * R * 0.14;
        ctx.fillStyle = '#ffd93b'; ctx.strokeStyle = INK; ctx.lineWidth = R * 0.022;
        star(ctx, x, y, R * (0.1 + 0.02 * Math.sin(a)), 5, 0.48, a * 0.5); ctx.fill(); ctx.stroke();
      }
    }
    if (mood === 'smug') {
      var tw = [0, 1.7, 3.1];
      for (i = 0; i < 3; i++) {
        var k = 0.5 + 0.5 * Math.sin(t * 4 + tw[i]);
        var pos = [[0.86, -0.72], [-0.92, -0.5], [0.95, 0.05]][i];
        sparkle(ctx, pos[0] * R, pos[1] * R, R * (0.06 + 0.09 * k), '#fff3a0');
      }
    }
    if (mood === 'shy') {
      for (i = 0; i < 2; i++) {
        p = fract(t * 0.45 + i * 0.5);
        ctx.globalAlpha = Math.min(1, (1 - p) * 1.6);
        ctx.fillStyle = '#ff6fa3'; ctx.strokeStyle = INK; ctx.lineWidth = R * 0.02;
        heart(ctx, (i ? -0.85 : 0.9) * R + Math.sin(p * 7) * R * 0.05, -R * (0.4 + p * 0.7), R * 0.13);
        ctx.fill(); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    if (mood === 'surprised') {
      var j = Math.abs(Math.sin(t * 9)) * R * 0.05;
      outlinedText(ctx, '!', R * 0.8, -R * 0.92 - j, Math.round(R * 0.5), '#ffe14d', INK);
      ctx.strokeStyle = INK; ctx.lineWidth = R * 0.035;
      for (i = -1; i <= 1; i++) {
        var aa = -PI / 2 + i * 0.45 - 0.75;
        ctx.beginPath(); ctx.moveTo(Math.cos(aa) * R * 1.08, Math.sin(aa) * R * 1.08); ctx.lineTo(Math.cos(aa) * R * 1.3, Math.sin(aa) * R * 1.3); ctx.stroke();
      }
    }
    if (mood === 'blind') {
      var bob = Math.sin(t * 2.5) * R * 0.05;
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 2.5);
      outlinedText(ctx, '?', R * 0.82, -R * 0.85 + bob, Math.round(R * 0.38), '#ffffff', INK);
      outlinedText(ctx, '?', -R * 0.86, -R * 0.62 - bob, Math.round(R * 0.26), '#ffffff', INK);
      ctx.globalAlpha = 1;
    }
    if (mood === 'suspicious') {
      for (i = 0; i < 3; i++) {
        var on = fract(t * 0.8) * 4 > i;
        if (!on) continue;
        ctx.fillStyle = INK;
        ctx.beginPath(); ctx.arc(R * (0.62 + i * 0.16), -R * 0.92, R * 0.04, 0, TAU); ctx.fill();
      }
    }
    if ((mood === 'shy' || mood === 'mean' || mood === 'surprised' || mood === 'suspicious') && faceC > 0.3) {
      // 汗
      p = fract(t * 0.6);
      ctx.globalAlpha = p < 0.8 ? 1 : (1 - p) * 5;
      ctx.fillStyle = '#8fd3ff'; ctx.strokeStyle = '#2a6aa8'; ctx.lineWidth = R * 0.02;
      x = (mood === 'mean' ? -1 : -1) * R * 0.78; y = -R * 0.45 + p * R * 0.18;
      drop(ctx, x, y, R * 0.1); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(x - R * 0.02, y + R * 0.02, R * 0.018, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  // なみだ(顔に付いて動く)
  function drawTears(ctx, P, mood, t, s) {
    if (mood === 'sad') {
      feat(ctx, P, s * (EYE.u + 0.06), EYE.v + 0.14, function () {
        ctx.fillStyle = 'rgba(140,205,255,0.9)'; ctx.strokeStyle = '#2f78c4'; ctx.lineWidth = 0.02;
        // 流れる筋
        ctx.beginPath(); ctx.moveTo(-0.03, 0); ctx.quadraticCurveTo(-0.035, 0.18, -0.02, 0.32);
        ctx.lineTo(0.02, 0.32); ctx.quadraticCurveTo(0.035, 0.18, 0.03, 0); ctx.closePath();
        ctx.fillStyle = 'rgba(150,210,255,0.75)'; ctx.fill();
        var p = fract(t * 0.9 + (s > 0 ? 0.5 : 0));
        ctx.fillStyle = 'rgba(140,205,255,0.95)';
        drop(ctx, 0, 0.05 + p * 0.38, 0.055); ctx.fill(); ctx.stroke();
      }, 0, 0.15);
    }
    if (mood === 'laugh') {
      feat(ctx, P, s * (EYE.u + 0.12), EYE.v, function () {
        for (var i = 0; i < 2; i++) {
          var p = fract(t * 1.6 + i * 0.5);
          var x = s * (0.04 + p * 0.3), y = -0.05 - Math.sin(p * PI) * 0.18 + p * 0.1;
          ctx.globalAlpha = 1 - p;
          ctx.fillStyle = 'rgba(150,210,255,0.95)'; ctx.strokeStyle = '#2f78c4'; ctx.lineWidth = 0.015;
          drop(ctx, x, y, 0.045); ctx.fill(); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }, 0, 0.1);
    }
  }

  // ===== 頭を描く =====
  function drawHead(ctx, cx, cy, size, opts) {
    opts = opts || {};
    var R = size / 2;
    var t = opts.t || 0;
    var mood = MOOD_LABELS[opts.mood] ? opts.mood : 'normal';
    var turn = clamp(opts.turn == null ? 1 : opts.turn, 0, 1);
    var dir = opts.dir === -1 ? -1 : 1;
    var shake = clamp(opts.shake || 0, 0, 1);
    // 0.5(横)で顔がちゃんと見えるように、回る角度を少しゆがめる
    var yaw = PI * Math.pow(1 - turn, 1.7);
    var P = { R: R, yaw: yaw, dir: dir };
    var faceC = Math.cos(yaw);
    var S = moodSpec(mood, t);
    if (opts.oneEye) S.eyeR = E({ type: 'blank' });

    // 体の動き(起き上がりこぼしのように、底を中心にゆれる)
    var rot = 0, ox = 0, oy = 0;
    if (mood === 'laugh') { oy = -Math.abs(Math.sin(t * 12)) * R * 0.05; rot = Math.sin(t * 12) * 0.05; }
    if (mood === 'dizzy') rot = Math.sin(t * 2.6) * 0.12;
    if (mood === 'angry') ox = Math.sin(t * 70) * R * 0.01;
    if (mood === 'sad') ox = Math.sin(t * 45) * R * 0.005;
    if (mood === 'smug') rot = -0.07 * dir;
    if (mood === 'shy') rot = 0.05 * dir + Math.sin(t * 1.6) * 0.03;
    if (mood === 'sleepy') rot = Math.sin(t * 0.9) * 0.05;
    if (mood === 'happy') rot = Math.sin(t * 3) * 0.035;
    if (shake) { ox += Math.sin(t * 48) * shake * R * 0.05; rot += Math.sin(t * 37) * shake * 0.06; }
    var breathe = 1 + 0.012 * Math.sin(t * 2.2);

    ctx.save();
    ctx.translate(cx, cy);
    // 足もとの影
    if (opts.shadow !== false) {
      var sg = ctx.createRadialGradient(0, R * BOTTOM, 0, 0, R * BOTTOM, R * 0.75);
      sg.addColorStop(0, 'rgba(0,0,0,0.32)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sg;
      ctx.beginPath(); ctx.ellipse(0, R * BOTTOM, R * 0.75, R * 0.14, 0, 0, TAU); ctx.fill();
    }
    ctx.translate(ox, oy + R * BOTTOM);
    ctx.rotate(rot);
    ctx.scale(2 - breathe, breathe);
    ctx.translate(0, -R * BOTTOM);

    // 体(赤)
    bodyPath(ctx, R);
    var base = ctx.createLinearGradient(0, -R, 0, R);
    if (mood === 'angry') { base.addColorStop(0, '#ff3b2f'); base.addColorStop(1, '#b3121c'); }
    else { base.addColorStop(0, '#ef3a37'); base.addColorStop(1, '#bf1d25'); }
    ctx.fillStyle = base; ctx.fill();

    ctx.save();
    bodyPath(ctx, R); ctx.clip();

    drawBelly(ctx, P);
    drawSideSwirls(ctx, P);
    if (Math.cos(yaw - PI) > 0.02) drawBack(ctx, P, opts);

    // 顔
    var fc = mood === 'angry' ? '#ffe9de' : '#fffaf0';
    if (faceC > -0.6) {
      facePath(ctx, P);
      var fg = ctx.createRadialGradient(-R * 0.12, -R * 0.3, R * 0.05, 0, -R * 0.1, R * 0.75);
      fg.addColorStop(0, '#ffffff'); fg.addColorStop(0.7, fc); fg.addColorStop(1, '#f1dfc4');
      ctx.fillStyle = fg; ctx.fill();
      // 怒り・いじわる・かなしみ の色
      if (S.tint) {
        ctx.save(); facePath(ctx, P); ctx.clip();
        var tg;
        if (S.tint === 'angry') {
          tg = ctx.createLinearGradient(0, -R * 0.6, 0, R * 0.2);
          tg.addColorStop(0, 'rgba(255,40,30,' + (0.35 + 0.12 * Math.sin(t * 8)) + ')'); tg.addColorStop(1, 'rgba(255,60,40,0.08)');
        } else if (S.tint === 'mean') {
          tg = ctx.createLinearGradient(0, -R * 0.68, 0, -R * 0.3);
          tg.addColorStop(0, 'rgba(90,30,140,0.38)'); tg.addColorStop(1, 'rgba(90,30,140,0)');
        } else {
          tg = ctx.createLinearGradient(0, -R * 0.65, 0, -R * 0.2);
          tg.addColorStop(0, 'rgba(60,90,200,0.3)'); tg.addColorStop(1, 'rgba(60,90,200,0)');
        }
        ctx.fillStyle = tg; ctx.fillRect(-R, -R, R * 2, R * 1.4);
        // かなしみの縦線
        if (S.tint === 'sad') {
          ctx.strokeStyle = 'rgba(50,70,160,0.55)'; ctx.lineWidth = R * 0.018;
          for (var i = -3; i <= 3; i++) {
            var pp = proj(P, i * 0.07, -0.58);
            ctx.beginPath(); ctx.moveTo(pp[0], pp[1]); ctx.lineTo(pp[0], pp[1] + R * (i % 2 ? 0.12 : 0.17)); ctx.stroke();
          }
        }
        ctx.restore();
      }
      // 金のふち
      facePath(ctx, P);
      ctx.lineJoin = 'round';
      ctx.lineWidth = R * 0.085; ctx.strokeStyle = '#a8700c'; ctx.stroke();
      ctx.lineWidth = R * 0.055; ctx.strokeStyle = '#f4c63e'; ctx.stroke();
      ctx.lineWidth = R * 0.015; ctx.strokeStyle = '#fff1a8';
      facePath(ctx, P, 0.012); ctx.stroke();

      // ほっぺ
      if (S.cheek > 0) {
        [-1, 1].forEach(function (s) {
          feat(ctx, P, s * 0.45, 0.1, function () {
            var a = Math.min(1, S.cheek);
            var cg = ctx.createRadialGradient(0, 0, 0, 0, 0, 0.11 * (S.cheek > 1 ? 1.3 : 1));
            cg.addColorStop(0, 'rgba(255,95,120,' + (0.75 * a) + ')'); cg.addColorStop(1, 'rgba(255,95,120,0)');
            ctx.fillStyle = cg;
            ctx.beginPath(); ctx.ellipse(0, 0, 0.14 * (S.cheek > 1 ? 1.3 : 1), 0.09 * (S.cheek > 1 ? 1.3 : 1), 0, 0, TAU); ctx.fill();
            if (S.cheek > 1) { // てれの斜線
              ctx.strokeStyle = 'rgba(220,40,80,0.8)'; ctx.lineWidth = 0.018; ctx.lineCap = 'round';
              ctx.beginPath();
              for (var k = -1; k <= 1; k++) { ctx.moveTo(k * 0.055 - 0.02, 0.035); ctx.lineTo(k * 0.055 + 0.025, -0.035); }
              ctx.stroke();
            }
          }, 0, 0.1);
        });
      }
      // 眉
      drawBrow(ctx, P, S.browL, -1);
      drawBrow(ctx, P, S.browR, 1);
      // 目(振り向き中は、こっちを見る)
      var bl = blinkOpen(t, 0);
      var lookAdd = [0, 0];
      if (opts.look) { S.eyeL.look = opts.look; S.eyeR.look = opts.look; }
      else if (turn < 1 && faceC > 0) lookAdd = [-dir * Math.sin(yaw) * 0.8, 0];
      drawEye(ctx, P, S.eyeL, -1, t, bl, fc, lookAdd, opts);
      drawEye(ctx, P, S.eyeR, 1, t, bl, fc, lookAdd, opts);
      // 鼻
      feat(ctx, P, 0, 0.04, function () {
        ctx.fillStyle = '#f5a48e'; ctx.strokeStyle = INK; ctx.lineWidth = 0.022;
        ctx.beginPath(); ctx.ellipse(0, 0, 0.05, 0.04, 0, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath(); ctx.arc(-0.012, -0.01, 0.01, 0, TAU); ctx.fill();
      }, 0, 0.1);
      // ねむい: 鼻ちょうちん
      if (mood === 'sleepy') {
        feat(ctx, P, 0.04, 0.07, function () {
          var ph = fract(t / 2.6), br = 0.03 + 0.13 * Math.sin(ph * PI * 0.5);
          if (ph > 0.94) return;
          ctx.fillStyle = 'rgba(190,230,255,0.55)'; ctx.strokeStyle = 'rgba(70,130,200,0.9)'; ctx.lineWidth = 0.015;
          ctx.beginPath(); ctx.arc(br * 0.8, br * 0.6, br, 0, TAU); ctx.fill(); ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.beginPath(); ctx.arc(br * 0.5, br * 0.25, br * 0.22, 0, TAU); ctx.fill();
        }, 0, 0.2);
      }
      // ひげ
      drawMustache(ctx, P, -1, mood, t);
      drawMustache(ctx, P, 1, mood, t);
      drawMouth(ctx, P, S.mouth, t);
      drawBeard(ctx, P, S.mouth);
      drawTears(ctx, P, mood, t, -1);
      drawTears(ctx, P, mood, t, 1);
    }
    if (mood === 'blind') drawBlindfold(ctx, P, t);

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

    // ふちどり
    bodyPath(ctx, R);
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2.5, R * 0.05); ctx.strokeStyle = INK; ctx.stroke();

    drawExtras(ctx, R, mood, t, faceC);
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
    mystery: { c: '#5b3fa8', label: 'なぞ' }
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
