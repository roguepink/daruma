#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
こっち見ないで!だるま落とし — 振り向きと気分のシミュレーション

確かめること
  1. 気分ごとの「向こう向き(安全)」「予兆」「こっち向き」の長さの分布
  2. 反応の速さ 0.25〜0.45 秒の「人」(初心者・ふつう・上手い)が、
     アウトになるまでの時間・落とした段数・点数の分布
  3. 理不尽な場面(予兆が出てからアウトになるまでが、人の反応より短い)が 0 回であること
     - すべての「本物の予兆」で (予兆の長さ + 猶予) >= 反応の最大 0.45 + 指を止める 0.10 + 画面とタッチの遅れ 0.08
     - 「理想の人」(反応 0.45 秒・うっかりなし・欲ばりなし)を長く遊ばせて、1回もアウトにならないこと

使い方: python3 docs/sim.py            (結果を表で出す。乱数の種は固定なので毎回同じ結果)
        python3 docs/sim.py --games 3000
ここの数字は design.md の CONFIG / MOODS / BLOCKS と同じ。片方を変えたら、もう片方も変える。
"""
import math
import random
import statistics
import sys
from collections import Counter, defaultdict, deque

# ------------------------------------------------------------------ 設定(design.md の CONFIG と同じ)
CONFIG = dict(
    TELL_MIN=0.60,          # 予兆(「ころんだ」の4文字)の最短。どの気分・どの段階でもこれより短くしない
    GRACE=0.12,             # 振り向く動き(首が回る 0.12 秒)の間は、叩いてもセーフ
    RETURN_DUR=0.20,        # 向こうへ戻る動き。始まった瞬間から安全
    DROP_COOLDOWN=0.12,     # 段が落ちて塔が下がる間。この間のタップは段に効かない(見られていればアウト)
    RT_MAX=0.45, MOTOR=0.10, LATENCY=0.08,   # フェアさの基準(反応・指を止める・画面とタッチの遅れ)
    STAGE_DROPS=[0, 20, 45, 80, 125, 180, 250, 330, 430, 550],
    STAGE_SPEED=[1.00, 0.95, 0.90, 0.85, 0.80, 0.76, 0.72, 0.69, 0.66, 0.64],
    STAGE_TIME=45,          # 段数が少なくても 45 秒ごとに最低1段階は上がる
    WARMUP_SEC=30, WARMUP_LETTER_MUL=1.25, WARMUP_TELL_ADD=0.40,
    FEINT_LETTERS_DUR=(0.35, 0.55),   # フェイントで「ころ…」まで言う長さ
    DOUBLE_GAP=0.35, DOUBLE_FACING=(0.6, 1.0),  # 二度見: 戻ってから 0.35 秒あけ、最短の予兆でまた振り向く
    BIKKURI_FACING=(1.2, 1.8),
    LATE_DOUBLE_ADD=0.05,   # 段階7から、段階が1つ上がるごとに 二度見が +5%(本気モード)
    RING_PERIOD=1.0, SLIDE_PERIOD=1.2,
    BLINDFOLD_SEC=5.0, PERFECT_SEC=5.0, PERFECT_DROP_RATE=8.0, TIMESTOP_SEC=4.0,
    DOUBLE_SCORE_SEC=15.0, GOLD_MALLET_HITS=10,
    COMBO_STEP=0.2, COMBO_MAX=3.0, SQUEEZE_MUL=1.5,
    TAMA_MAX=3, TAMA_EVERY=20, TAMA_START=1, TEASE_COOLDOWN=15.0,
    ITEM_SLOTS=2, RAINBOW_PITY=30, BORED_SEC=20.0, BORED_FAIL=0.5, FIRST_RAINBOW_AT=12, BOMB_GAP=5,
    HAGAO_SUCCESS=0.65, HAGAO_CUT=0.30,
)

# 気分(design.md の MOODS と同じ)。時間は秒。letter は「だるまさんが」1文字ぶん
MOODS = {
    'futsu':   dict(name='ふつう',   letter=(0.26, 0.40), jitter=0.15, pauseP=0.10, pause=(0.4, 0.8), restartP=0.00,
                    tell=(0.85, 1.00), feintP=0.05, doubleP=0.00, facing=(1.0, 1.6), cycles=(3, 5), mult=1.0),
    'gokigen': dict(name='ごきげん', letter=(0.36, 0.50), jitter=0.15, pauseP=0.30, pause=(0.5, 1.0), restartP=0.00,
                    tell=(1.00, 1.20), feintP=0.00, doubleP=0.00, facing=(0.7, 1.1), cycles=(2, 2), mult=1.0),
    'okori':   dict(name='おこり',   letter=(0.10, 0.30), jitter=None, pauseP=0.00, pause=(0, 0), restartP=0.00,
                    tell=(0.60, 0.70), feintP=0.10, doubleP=0.10, facing=(1.6, 2.4), cycles=(4, 4), mult=2.0),
    'ijiwaru': dict(name='いじわる', letter=(0.18, 0.40), jitter=0.25, pauseP=0.15, pause=(0.3, 0.9), restartP=0.00,
                    tell=(0.65, 0.80), feintP=0.40, doubleP=0.25, facing=(1.0, 1.5), cycles=(4, 4), mult=1.5),
    'nemui':   dict(name='ねむい',   letter=(0.50, 0.75), jitter=0.15, pauseP=0.40, pause=(0.8, 1.6), restartP=0.00,
                    tell=(1.20, 1.50), feintP=0.00, doubleP=0.00, facing=(0.8, 1.2), cycles=(3, 3), mult=1.0),
    'nakisou': dict(name='なきそう', letter=(0.25, 0.60), jitter=None, pauseP=0.20, pause=(0.5, 1.0), restartP=0.30,
                    tell=(0.80, 1.00), feintP=0.00, doubleP=0.00, facing=(2.0, 3.0), cycles=(3, 3), mult=1.2),
    'tere':    dict(name='てれ',     letter=(0.32, 0.46), jitter=0.15, pauseP=0.25, pause=(0.4, 0.8), restartP=0.00,
                    tell=(0.90, 1.10), feintP=0.00, doubleP=0.00, facing=(0.4, 0.7), cycles=(3, 3), mult=1.0),
    'bikkuri': dict(name='びっくり', letter=(0, 0), jitter=None, pauseP=0.00, pause=(0, 0), restartP=0.00,
                    tell=(0.60, 0.60), feintP=0.00, doubleP=0.00, facing=(1.2, 1.8), cycles=(1, 1), mult=1.0),
}
# 自然に気分が変わるときの行き先(段階ごとの重み)
MOOD_DRIFT = [
    dict(futsu=60, gokigen=30, nemui=10),
    dict(futsu=45, gokigen=20, nemui=10, ijiwaru=15, tere=10),
    dict(futsu=35, gokigen=15, nemui=10, ijiwaru=20, okori=10, tere=5, nakisou=5),
    dict(futsu=30, gokigen=10, nemui=8, ijiwaru=22, okori=18, tere=6, nakisou=6),
    dict(futsu=25, gokigen=8, nemui=7, ijiwaru=25, okori=23, tere=6, nakisou=6),
]
WARMUP_DRIFT = dict(futsu=70, gokigen=30)

# 段(design.md の BLOCKS と同じ)。hp=必要なタップ数
BLOCKS = {
    'aka':    dict(name='赤(ふつう)',     pts=10,  kind='tap'),
    'ao':     dict(name='青(かたい)',     pts=20,  kind='mash'),
    'midori': dict(name='緑(リング)',     pts=30,  kind='ring'),
    'kiiro':  dict(name='黄(すべる)',     pts=30,  kind='slide'),
    'hibi':   dict(name='灰(ヒビ)',       pts=15,  kind='hibi'),
    'murasaki': dict(name='紫(2段まとめ)', pts=50, kind='double'),
    'mochi':  dict(name='白(おもち)',     pts=40,  kind='mochi'),
    'kin':    dict(name='金',             pts=100, kind='mash'),
    'niji':   dict(name='虹',             pts=50,  kind='tap'),
    'bakudan': dict(name='黒(ばくだん)',  pts=80,  kind='tap'),
    'hoshi':  dict(name='水色(ほし)',     pts=10,  kind='tap'),
}
BLOCK_WEIGHTS = [
    dict(aka=60, ao=20, midori=12, hibi=8),
    dict(aka=40, ao=20, midori=14, kiiro=8, hibi=8, hoshi=5, niji=3),
    dict(aka=30, ao=18, midori=14, kiiro=10, hibi=8, murasaki=5, hoshi=5, niji=3, bakudan=3, kin=2),
    dict(aka=22, ao=18, midori=14, kiiro=12, hibi=7, murasaki=6, mochi=6, hoshi=4, niji=3, bakudan=4, kin=2),
    dict(aka=16, ao=18, midori=14, kiiro=13, hibi=6, murasaki=7, mochi=9, hoshi=4, niji=3, bakudan=5, kin=3),
]
ITEM_POOL = dict(mekakushi=20, ocha=12, odateru=8, komoriuta=8, shield=6, kizuchi=12, bai=12, tokei=8, perfect=10)

# 遊ぶ人のモデル
SKILLS = {
    #          反応の平均  タップ/秒  リングを外す  うっかり(予兆1回あたり) 欲ばり   先走り(こっち向き1回あたり)
    'beginner': dict(name='初心者', guess_sd=0.15, squeeze=(0.8, 1.1), rt=0.42, rate=5.5, miss=0.35, lapse=0.050, greed=0.10, antic=0.03, smart_bomb=False, tease=0.0, use_hagao=0.3),
    'normal':   dict(name='ふつう', guess_sd=0.10, squeeze=(0.8, 1.1), rt=0.34, rate=7.0, miss=0.20, lapse=0.030, greed=0.25, antic=0.04, smart_bomb=True,  tease=0.3, use_hagao=0.5),
    'skilled':  dict(name='上手い', guess_sd=0.06, squeeze=(0.75, 1.05), rt=0.27, rate=8.5, miss=0.10, lapse=0.012, greed=0.35, antic=0.02, smart_bomb=True,  tease=0.6, use_hagao=0.6),
    'ideal':    dict(name='理想(反応0.45・ミスなし)', guess_sd=0.0, squeeze=(0, 0), rt=0.45, rate=8.0, miss=0.20, lapse=0.0, greed=0.0, antic=0.0, smart_bomb=False, tease=0.5, use_hagao=0.5),
}

INF = float('inf')


def wpick(rng, weights):
    tot = sum(weights.values())
    r = rng.random() * tot
    for k, w in weights.items():
        r -= w
        if r <= 0:
            return k
    return k


def stage_of(dropped, t):
    s = 0
    for i, th in enumerate(CONFIG['STAGE_DROPS']):
        if dropped >= th:
            s = i
    s = max(s, min(int(t // CONFIG['STAGE_TIME']), len(CONFIG['STAGE_DROPS']) - 1))
    return s


# ------------------------------------------------------------------ だるまさんの1回ぶん(純粋関数 makeCycle と同じ考え方)
def make_cycle(mood, stage, warm, rng):
    """1回の振り向きを、区間 (種類, 長さ) の並びで返す。
    種類: SAFE(向こう向き) FEINT(フェイントの予兆) WARN(本物の予兆) GRACE(首が回る猶予) WATCH(こっち向き) RETURN(戻る)"""
    m = MOODS[mood]
    spd = CONFIG['STAGE_SPEED'][stage]
    lmul = spd * (CONFIG['WARMUP_LETTER_MUL'] if warm else 1.0)
    out = []
    if mood == 'bikkuri':
        out.append(('WARN', CONFIG['TELL_MIN']))
    else:
        base = rng.uniform(*m['letter'])

        def letters(n):
            tot = 0.0
            for _ in range(n):
                if m['jitter'] is None:
                    tot += rng.uniform(*m['letter'])
                else:
                    tot += base * rng.uniform(1 - m['jitter'], 1 + m['jitter'])
            return tot * lmul
        safe = letters(6)
        if rng.random() < m['pauseP']:
            safe += rng.uniform(*m['pause']) * lmul      # 途中で止まる(「だるまさん……が」)
        if rng.random() < m['restartP']:
            safe += letters(rng.randint(2, 4))           # 言い直す(「だ…だる…だるまさんが」)
        out.append(('SAFE', safe))
        if not warm and rng.random() < m['feintP']:      # フェイント「ころ…なんちゃって」→「さんが」から言い直し
            out.append(('FEINT', rng.uniform(*CONFIG['FEINT_LETTERS_DUR'])))
            out.append(('SAFE', letters(3)))
        tell = rng.uniform(*m['tell']) * (0.4 + 0.6 * spd) + (CONFIG['WARMUP_TELL_ADD'] if warm else 0.0)
        out.append(('WARN', max(CONFIG['TELL_MIN'], tell)))
    out.append(('GRACE', CONFIG['GRACE']))
    out.append(('WATCH', rng.uniform(*m['facing']) * (0.5 + 0.5 * spd)))
    out.append(('RETURN', CONFIG['RETURN_DUR']))
    if not warm and rng.random() < m['doubleP'] + CONFIG['LATE_DOUBLE_ADD'] * max(0, stage - 6):         # 二度見(戻ったと思ったら、すぐまた振り向く)
        out.append(('SAFE', CONFIG['DOUBLE_GAP']))
        out.append(('WARN', CONFIG['TELL_MIN']))
        out.append(('GRACE', CONFIG['GRACE']))
        out.append(('WATCH', rng.uniform(*CONFIG['DOUBLE_FACING'])))
        out.append(('RETURN', CONFIG['RETURN_DUR']))
    return out


# ------------------------------------------------------------------ 1プレイ
class Game:
    def __init__(self, skill, rng, cap=900.0, items=True):
        self.sk = SKILLS[skill]
        self.rng = rng
        self.cap = cap
        self.items_on = items
        self.t = 0.0
        self.dropped = 0
        self.score = 0.0
        self.mood = 'futsu'
        self.mood_left = 4
        self.prev_mood = 'futsu'
        self.phases = deque()
        self.tower = deque()
        self.since_rainbow = 0
        self.since_bomb = 99
        self.first_rainbow_done = False
        self.tama = CONFIG['TAMA_START']
        self.tama_counter = 0
        self.tease_ready_at = 0.0
        self.last_used = {}
        self.slots = []
        self.shield = 0
        self.blind_until = -1.0
        self.blind_pending_end = False
        self.mallet = 0
        self.double_until = -1.0
        self.combo = 0
        self.best_combo = 0
        self.window_drops = 0
        self.window_list = []
        self.resume_at = 0.0
        self.stop_at = INF
        self.last_tap = -1.0
        self.pend = None
        self.block_ready = 0.0
        self.flag = None             # 'lapse' / 'greedy' / 'antic' / None(ふつうに反応している)
        self.last_return_end = 0.0
        self.out = None
        self.warn_windows = []       # 本物の予兆ごとの (予兆+猶予) の長さ
        self.mood_time = Counter()
        self.shield_saves = 0
        self.perfects = 0
        self.cur_phase = None

    # ---- 段
    def warm(self):
        return self.t < CONFIG['WARMUP_SEC']

    def stage(self):
        return stage_of(self.dropped, self.t)

    def new_block(self):
        st = min(self.stage(), len(BLOCK_WEIGHTS) - 1)
        if self.warm():
            st = 0
        n_total = self.dropped + len(self.tower)
        if not self.first_rainbow_done and n_total >= CONFIG['FIRST_RAINBOW_AT']:
            t = 'niji'
            self.first_rainbow_done = True
        elif self.since_rainbow >= CONFIG['RAINBOW_PITY']:
            t = 'niji'
        else:
            w = dict(BLOCK_WEIGHTS[st])
            if self.since_bomb < CONFIG['BOMB_GAP'] or self.warm():
                w.pop('bakudan', None)
            t = wpick(self.rng, w)
        self.since_rainbow = 0 if t == 'niji' else self.since_rainbow + 1
        self.since_bomb = 0 if t == 'bakudan' else self.since_bomb + 1
        k = BLOCKS[t]['kind']
        hp = {'tap': 1, 'mash': 3 + min(self.stage(), 6) // 2, 'ring': 1, 'slide': 1, 'hibi': 2,
              'double': 2, 'mochi': 5}[k]
        if t == 'kin':
            hp = 8
        return dict(t=t, kind=k, hp=hp, maxhp=hp, phase=self.rng.random(), last=-9.0)

    def bottom(self):
        while len(self.tower) < 7:
            self.tower.append(self.new_block())
        return self.tower[0]

    # ---- 点数
    def add_points(self, b, squeeze, perfect=False):
        base = BLOCKS[b['t']]['pts']
        if perfect:
            mult = 1.0
        else:
            self.combo += 1
            self.best_combo = max(self.best_combo, self.combo)
            mult = min(1 + CONFIG['COMBO_STEP'] * (self.combo - 1), CONFIG['COMBO_MAX'])
            mult *= MOODS[self.mood]['mult']
            if squeeze:
                mult *= CONFIG['SQUEEZE_MUL']
        if self.t < self.double_until:
            mult *= 2
        self.score += base * mult
        self.dropped += 2 if b['kind'] == 'double' else 1
        if not perfect:
            self.window_drops += 1
        self.tama_counter += 1
        if self.tama_counter >= CONFIG['TAMA_EVERY']:
            self.tama_counter = 0
            self.tama = min(CONFIG['TAMA_MAX'], self.tama + 1)
        if b['t'] == 'hoshi':
            self.tama = min(CONFIG['TAMA_MAX'], self.tama + 1)
        if b['t'] == 'niji' and self.items_on:
            it = wpick(self.rng, ITEM_POOL)
            if it == 'shield' and (self.shield > 0 or 'shield' in self.slots):
                self.score += 100
            elif len(self.slots) < CONFIG['ITEM_SLOTS']:
                self.slots.append(it)
            else:
                self.score += 100

    # ---- 気分
    def set_mood(self, mood, cycles):
        if mood != 'bikkuri':
            self.prev_mood = mood
        self.mood = mood
        self.mood_left = cycles

    def next_cycle(self):
        rng = self.rng
        self.mood_left -= 1
        if self.mood_left <= 0:
            if self.mood == 'bikkuri':
                if rng.random() < 0.5:
                    self.set_mood('okori', 2)
                else:
                    self.set_mood(self.prev_mood, 2)
            elif self.mood == 'nemui' and rng.random() < 0.3:
                self.set_mood('bikkuri', 1)          # 「はっ! ねてない!」
            else:
                drift = WARMUP_DRIFT if self.warm() else MOOD_DRIFT[min(self.stage(), len(MOOD_DRIFT) - 1)]
                nm = wpick(rng, drift)
                self.set_mood(nm, rng.randint(*MOODS[nm]['cycles']))
        self.player_choices_at_cycle_start()
        self.phases.extend(make_cycle(self.mood, self.stage(), self.warm(), rng))

    def player_choices_at_cycle_start(self):
        """遊ぶ人の、ちょっかい・アイテムの使い方(簡単なきまり)。効き目は次の1回から(本番は残りの文字から)"""
        if not self.items_on:
            return
        rng, sk = self.rng, self.sk
        bad = self.mood in ('okori', 'ijiwaru', 'nakisou')
        # アイテム
        for it in list(self.slots):
            use = False
            if it == 'perfect':
                use = True
            elif it in ('ocha', 'odateru', 'komoriuta', 'mekakushi'):
                use = bad or len(self.slots) >= CONFIG['ITEM_SLOTS']
            else:
                use = True
            if not use:
                continue
            self.slots.remove(it)
            if it == 'perfect':
                self.perfects += 1
                self.phases.append(('PERFECT', CONFIG['PERFECT_SEC']))
            elif it == 'mekakushi':
                self.blind_until = self.t + CONFIG['BLINDFOLD_SEC']
            elif it == 'ocha':
                self.set_mood('futsu' if bad else 'gokigen', 3)
            elif it == 'odateru':
                self.set_mood('gokigen' if self.mood == 'nakisou' else 'tere', 3)
            elif it == 'komoriuta':
                if self.mood != 'okori':
                    self.set_mood('nemui', 3)
                self.phases.append(('SAFE', 1.5))     # 歌っている間は数えない
            elif it == 'shield':
                self.shield += 1
            elif it == 'kizuchi':
                self.mallet = CONFIG['GOLD_MALLET_HITS']
            elif it == 'bai':
                self.double_until = self.t + CONFIG['DOUBLE_SCORE_SEC']
            elif it == 'tokei':
                self.phases.append(('SAFE', CONFIG['TIMESTOP_SEC']))
        # ちょっかい(同じものを 20 秒以内にまた使うと「あきた」で半分は効かない → いじわるに)
        def bored(name):
            b = self.t - self.last_used.get(name, -99) < CONFIG['BORED_SEC'] and rng.random() < CONFIG['BORED_FAIL']
            self.last_used[name] = self.t
            if b:
                self.set_mood('ijiwaru', 2)
            return b
        if bad and self.tama >= 1:
            self.tama -= 1
            if not bored('kusuguru'):
                self.set_mood('gokigen', 2)          # くすぐる
        elif self.mood == 'futsu' and self.tama >= 2:
            self.tama -= 1                           # ダジャレ
            if bored('dajare'):
                pass
            elif rng.random() < 0.60:
                self.set_mood('gokigen', 2)
                self.phases.append(('SAFE', 1.5))
            else:
                self.set_mood('okori', 2)
        elif self.mood in ('futsu', 'gokigen') and self.t >= self.tease_ready_at and rng.random() < sk['tease'] * 0.3:
            self.tease_ready_at = self.t + CONFIG['TEASE_COOLDOWN']
            self.set_mood('okori', 4)                # いじわる(点数2倍のかわりに危ない)

    # ---- 遊ぶ人の反応
    def react_rt(self):
        sk = self.sk
        return min(CONFIG['RT_MAX'], max(0.25, self.rng.gauss(sk['rt'], 0.03)))

    def on_phase_start(self, kind, start, dur):
        rng, sk = self.rng, self.sk
        blind = start < self.blind_until
        if kind in ('WARN', 'FEINT'):
            if kind == 'WARN':
                self.warn_windows.append(dur + CONFIG['GRACE'])
            if blind and kind == 'WARN':
                return                                # 目かくし中は気にせず叩きつづける
            rt = self.react_rt()
            stop = rt + CONFIG['MOTOR']
            self.flag = None
            if rng.random() < sk['lapse'] * (1 + 0.08 * self.stage()) * (1 + start / 300.0):   # 速いほど・長く遊ぶほど つかれる
                stop = rt * rng.uniform(1.8, 3.5) + CONFIG['MOTOR']
                self.flag = 'lapse'
            elif kind == 'WARN' and rng.random() < sk['greed'] * min(1.0, start / 60.0):
                spd = CONFIG['STAGE_SPEED'][self.stage()]
                perceived = statistics.mean(MOODS[self.mood]['tell']) * (0.4 + 0.6 * spd) * rng.gauss(1.0, sk['guess_sd'])
                squeeze = perceived * rng.uniform(*sk['squeeze'])
                if squeeze > stop:
                    stop = squeeze
                    self.flag = 'greedy'
            self.stop_at = min(self.stop_at, start + stop) if self.stop_at > start else self.stop_at
        elif kind == 'SAFE' and self.cur_prev == 'FEINT':
            self.resume_at = start + self.react_rt()    # 「なんちゃって」を見てから また叩く
            self.stop_at = INF
            self.flag = None
        elif kind == 'WATCH':
            if not blind and rng.random() < sk['antic'] * min(1.0, start / 60.0):
                m = MOODS[self.mood]
                spd = CONFIG['STAGE_SPEED'][self.stage()]
                guess = statistics.mean(m['facing']) * (0.5 + 0.5 * spd) * rng.uniform(0.75, 1.10)
                self.resume_at = start + guess
                self.stop_at = INF
                self.flag = 'antic'
        elif kind == 'RETURN':
            self.resume_at = min(self.resume_at, start + self.react_rt()) if self.flag == 'antic' else start + self.react_rt()
            self.stop_at = INF
            self.flag = None

    # ---- タップの時刻
    def next_tap_time(self, b, phase_start):
        sk = self.sk
        if self.pend is None:                     # 次のタップまでの間(1回だけ決める。区間をまたいでも変えない)
            self.pend = (1.0 / sk['rate']) * self.rng.uniform(0.8, 1.2)
        tt = max(self.last_tap + self.pend, self.resume_at, self.block_ready, phase_start)
        if b['kind'] in ('ring', 'slide') and self.mallet <= 0:
            per = CONFIG['RING_PERIOD'] if b['kind'] == 'ring' else CONFIG['SLIDE_PERIOD']
            k = math.ceil((tt - b['phase'] * per) / per)
            tt = b['phase'] * per + k * per
        return tt

    def tap(self, b, tt, kind):
        """1回のタップ。段が落ちたら True"""
        rng = self.rng
        power = 3 if self.mallet > 0 else 1
        if self.mallet > 0:
            self.mallet -= 1
        if b['kind'] in ('ring', 'slide'):
            if power == 1 and rng.random() < self.sk['miss']:
                self.combo = 0
                return False
            return True
        if b['kind'] == 'mochi':
            back = int((tt - b['last']) / 0.3) if b['last'] > 0 else 0
            b['hp'] = min(b['maxhp'], b['hp'] + back)
        if b['kind'] == 'double' and b['last'] > 0 and tt - b['last'] > 0.35:
            b['hp'] = b['maxhp']
        b['last'] = tt
        b['hp'] -= power
        return b['hp'] <= 0

    # ---- メインの流れ
    def run(self):
        self.cur_prev = None
        while self.t < self.cap and self.out is None:
            if not self.phases:
                self.next_cycle()
            kind, dur = self.phases.popleft()
            start, end = self.t, self.t + dur
            self.mood_time[self.mood] += dur
            if kind == 'WATCH':
                # 変顔: こっち向きの時だけ使える(叩くボタンとは別)
                if self.items_on and self.rng.random() < self.sk['use_hagao'] * 0.5:
                    if self.rng.random() < CONFIG['HAGAO_SUCCESS'] * (0.5 if self.mood in ('okori', 'bikkuri') else 1.0):
                        dur = dur * CONFIG['HAGAO_CUT']
                        end = start + dur
                    else:
                        dur = dur + 0.5
                        end = start + dur
            # 目かくしは「こっち向き」の途中では外れない(戻り終わるまでのびる)
            if kind in ('WARN', 'GRACE', 'WATCH') and start < self.blind_until and not self.blind_pending_end:
                self.blind_orig = self.blind_until
                self.blind_until = INF
                self.blind_pending_end = True
            if kind == 'RETURN' and self.blind_pending_end:
                self.blind_until = max(self.blind_orig, end)
                self.blind_pending_end = False
            self.on_phase_start(kind, start, dur)
            self.cur_prev = kind
            self.cur_phase = kind
            if kind == 'PERFECT':
                n = int(dur * CONFIG['PERFECT_DROP_RATE'])
                for _ in range(n):
                    b = self.bottom()
                    self.tower.popleft()
                    self.add_points(b, False, perfect=True)
                self.t = end
                self.phases.clear()               # 終わったら「だ」から言い直し(全部の長さが安全)
                self.resume_at = end
                self.stop_at = INF
                continue
            cut = False
            while True:
                b = self.bottom()
                tt = self.next_tap_time(b, start)
                if b['t'] == 'bakudan' and self.sk['smart_bomb']:
                    # ふつう・上手い人は「戻った直後」にだけ爆弾を落とす(それ以外は待つ)
                    if not (kind == 'SAFE' and tt - self.last_return_end < 1.2):
                        break
                if tt >= self.stop_at or tt >= end:
                    break
                reg = tt + self.rng.uniform(0.03, CONFIG['LATENCY'])   # 画面とタッチの遅れ
                # アウトの判定: 登録された時刻が「こっち向き」の中
                if self.in_watch(kind, start, end, reg) and not (reg < self.blind_until):
                    if self.shield > 0:
                        self.shield -= 1
                        self.shield_saves += 1
                        end = reg                     # 「あれ?気のせいかな」とすぐ戻る
                        self.set_mood('ijiwaru', 2)
                        self.last_tap = tt
                        self.pend = None
                        break
                    self.out = dict(t=reg, reason=self.flag or 'unfair', mood=self.mood, phase=kind)
                    self.t = reg
                    return self
                self.last_tap = tt
                self.pend = None
                if tt < self.block_ready:
                    continue
                if self.tap(b, tt, kind):
                    self.tower.popleft()
                    self.block_ready = tt + CONFIG['DROP_COOLDOWN']
                    self.add_points(b, squeeze=(kind == 'WARN'))
                    if b['t'] == 'bakudan' and not (tt < self.blind_until) and kind in ('SAFE', 'FEINT'):
                        # びっくり: 今から最短の予兆で振り向く
                        self.phases.clear()
                        self.set_mood('bikkuri', 1)
                        self.mood_left = 1
                        self.phases.extend(make_cycle('bikkuri', self.stage(), False, self.rng))
                        end = tt
                        cut = True
                        break
            if kind == 'RETURN':
                self.last_return_end = end
                self.window_list.append(self.window_drops)
                self.window_drops = 0
                self.combo = 0                       # コンボは「向こう向き1回」ごと
            self.t = end
        return self

    def in_watch(self, kind, start, end, reg):
        # 登録の遅れで次の区間にはみ出した場合も考える(ここでは今の区間とその次だけ見る)
        if kind == 'WATCH':
            return reg < end or (self.phases and self.phases[0][0] == 'WATCH')
        if kind == 'GRACE':
            return reg >= end and self.phases and self.phases[0][0] == 'WATCH'
        return False


# ------------------------------------------------------------------ 集計
def pct(xs, p):
    xs = sorted(xs)
    if not xs:
        return 0
    i = min(len(xs) - 1, max(0, int(round(p / 100 * (len(xs) - 1)))))
    return xs[i]


def mood_table(rng, n=20000):
    rows = []
    for key, m in MOODS.items():
        for stage in (0, 9):
            safe, tell, face, feint, dbl, cyc, minwin = [], [], [], 0, 0, [], INF
            for _ in range(n):
                ph = make_cycle(key, stage, False, rng)
                s = 0
                first_warn = None
                for i, (k, d) in enumerate(ph):
                    if k in ('WARN',) and first_warn is None:
                        first_warn = d
                        tell.append(d)
                    if k == 'WARN':
                        minwin = min(minwin, d + CONFIG['GRACE'])
                    if k == 'SAFE' and first_warn is None:
                        s += d
                    if k == 'FEINT' and first_warn is None:
                        s += d
                    if k == 'WATCH' and len(face) < len(tell):
                        face.append(d)
                safe.append(s)
                feint += any(k == 'FEINT' for k, _ in ph)
                dbl += sum(1 for k, _ in ph if k == 'WARN') > 1
                cyc.append(sum(d for _, d in ph))
            rows.append((m['name'], stage, safe, tell, face, feint / n, dbl / n, cyc, minwin))
    return rows


def run_skill(skill, games, seed, cap=900.0):
    rng = random.Random(seed)
    res = [Game(skill, rng, cap=cap).run() for _ in range(games)]
    return res


def fmt(x, nd=1):
    return f'{x:.{nd}f}'


def main():
    games = 2000
    if '--games' in sys.argv:
        games = int(sys.argv[sys.argv.index('--games') + 1])
    print('# こっち見ないで!だるま落とし シミュレーション結果')
    print(f'(乱数の種は固定。1種類あたり {games} プレイ。上限 15 分)\n')

    # 1. 気分ごとの時間
    print('## 1. 気分ごとの時間(秒。1万回×2 の振り向きから。段階0 = はじめ / 段階9 = 550段以上(いちばん速い))\n')
    print('| 気分 | 段階 | 向こう向き 中央(10%〜90%) | 予兆 中央(最短) | こっち向き 中央 | フェイント率 | 二度見率 | 1回の長さ 平均 | 予兆+猶予 の最短 |')
    print('|---|---|---|---|---|---|---|---|---|')
    rng = random.Random(1)
    for name, stage, safe, tell, face, fr, dr, cyc, minwin in mood_table(rng, 10000):
        print(f'| {name} | {stage} | {fmt(pct(safe,50),2)} ({fmt(pct(safe,10),2)}〜{fmt(pct(safe,90),2)}) | '
              f'{fmt(pct(tell,50),2)} ({fmt(min(tell),2)}) | {fmt(pct(face,50),2)} | {fr*100:.0f}% | {dr*100:.0f}% | '
              f'{fmt(statistics.mean(cyc),2)} | {fmt(minwin,2)} |')
    need = CONFIG['RT_MAX'] + CONFIG['MOTOR'] + CONFIG['LATENCY']
    print(f'\nフェアさの基準: 予兆+猶予 >= 反応 {CONFIG["RT_MAX"]} + 指を止める {CONFIG["MOTOR"]} + 遅れ {CONFIG["LATENCY"]} = {need:.2f} 秒\n')

    # 2. 人ごとの結果
    print('## 2. 遊ぶ人ごとの結果\n')
    print('| 人 | 生きた時間 中央 (25%〜75%) | 30秒前にアウト | 1分前 | 5分以上 | 落とした段 中央 (25%〜75%) | 点数 中央 (25%〜75%) | 1回の向こう向きで落とす段 平均 | 最大コンボ 中央 |')
    print('|---|---|---|---|---|---|---|---|---|')
    all_res = {}
    for i, skill in enumerate(['beginner', 'normal', 'skilled']):
        res = run_skill(skill, games, 100 + i)
        all_res[skill] = res
        ts = [g.t for g in res]
        ds = [g.dropped for g in res]
        sc = [g.score for g in res]
        wins = [w for g in res for w in g.window_list]
        bc = [g.best_combo for g in res]
        print(f'| {SKILLS[skill]["name"]} | {fmt(pct(ts,50),0)}秒 ({fmt(pct(ts,25),0)}〜{fmt(pct(ts,75),0)}) | '
              f'{sum(t < 30 for t in ts)/len(ts)*100:.1f}% | {sum(t < 60 for t in ts)/len(ts)*100:.1f}% | '
              f'{sum(t >= 300 for t in ts)/len(ts)*100:.1f}% | {pct(ds,50)} ({pct(ds,25)}〜{pct(ds,75)}) | '
              f'{fmt(pct(sc,50),0)} ({fmt(pct(sc,25),0)}〜{fmt(pct(sc,75),0)}) | {fmt(statistics.mean(wins),1)} | {pct(bc,50)} |')

    print('\n### アウトの理由(何が原因で見つかったか)\n')
    print('| 人 | うっかり(気づくのが遅れた) | 欲ばり(すべりこみ失敗) | 先走り(戻る前に叩いた) | 理不尽(ちゃんと反応したのにアウト) | 上限まで生きた |')
    print('|---|---|---|---|---|---|')
    unfair_total = 0
    for skill, res in all_res.items():
        c = Counter(g.out['reason'] if g.out else 'alive' for g in res)
        unfair_total += c['unfair']
        n = len(res)
        print(f'| {SKILLS[skill]["name"]} | {c["lapse"]/n*100:.1f}% | {c["greedy"]/n*100:.1f}% | {c["antic"]/n*100:.1f}% | '
              f'{c["unfair"]} 回 | {c["alive"]/n*100:.1f}% |')

    print('\n### アウトになった時の気分\n')
    print('| 人 | ' + ' | '.join(m['name'] for m in MOODS.values()) + ' |')
    print('|---|' + '---|' * len(MOODS))
    for skill, res in all_res.items():
        c = Counter(g.out['mood'] for g in res if g.out)
        n = max(1, sum(c.values()))
        print(f'| {SKILLS[skill]["name"]} | ' + ' | '.join(f'{c[k]/n*100:.0f}%' for k in MOODS) + ' |')

    # 3. フェアさ
    print('\n## 3. フェアさの確認\n')
    wins = [w for res in all_res.values() for g in res for w in g.warn_windows]
    bad = sum(1 for w in wins if w < need - 1e-9)
    print(f'- 本物の予兆の数: {len(wins):,} 回。予兆+猶予の最短 = {min(wins):.2f} 秒(基準 {need:.2f} 秒)')
    print(f'- 基準より短い予兆: **{bad} 回**')
    print(f'- 「理不尽」に分類されたアウト(うっかり・欲ばり・先走りなしでアウト): **{unfair_total} 回**')
    ideal = run_skill('ideal', 300, 999, cap=900.0)
    ideal_out = sum(1 for g in ideal if g.out)
    it = [g.t for g in ideal]
    print(f'- 理想の人(反応はいちばん遅い 0.45 秒・うっかりなし・欲ばりなし・爆弾もすぐ落とす)を 300 回 × 最長15分: '
          f'アウト **{ideal_out} 回**(平均 {statistics.mean(it)/60:.1f} 分 遊んで、全員 上限まで生存)' if ideal_out == 0 else
          f'- 理想の人: アウト {ideal_out} 回 ← 直す必要あり')
    print(f'- 参考: シールドで助かった回数(ふつうの人) 平均 {statistics.mean(g.shield_saves for g in all_res["normal"]):.2f} 回 / '
          f'パーフェクトを使った回数 平均 {statistics.mean(g.perfects for g in all_res["normal"]):.2f} 回')

    # 気分の割合
    print('\n### 遊んでいる時間のうち、それぞれの気分だった割合(ふつうの人)\n')
    tot = Counter()
    for g in all_res['normal']:
        tot.update(g.mood_time)
    s = sum(tot.values())
    print('| ' + ' | '.join(MOODS[k]['name'] for k in MOODS) + ' |')
    print('|' + '---|' * len(MOODS))
    print('| ' + ' | '.join(f'{tot[k]/s*100:.0f}%' for k in MOODS) + ' |')
    return 0 if (bad == 0 and unfair_total == 0 and ideal_out == 0) else 1


if __name__ == '__main__':
    sys.exit(main())
