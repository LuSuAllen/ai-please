import test from 'node:test';
import assert from 'node:assert/strict';
import { DAY_IDS } from '../src/data/levels.ts';
import {
  MAX_ABS_SCORE,
  MIN_CLIENT_VERSION,
  NICKNAME_MAX_CHARS,
  RETRY_DELAYS,
  asRankApi,
  boardOfDay,
  callWithRetry,
  hasRankApi,
  isScoreSubmittable,
  isVersionSupported,
  mapError,
  normalizeNickname,
  normalizeRows,
  parseMyRank,
  pickNickname,
  readClientVersion,
  readMyRank,
  submitRunScore,
} from '../src/game/leaderboard.ts';
import type { RankApi, RankRow, Sleep, XhsLike } from '../src/game/leaderboard.ts';

/**
 * 排行榜适配层单测。契约来自小工具在线文档 §3.17（内测），
 * 任何一条断言失败都意味着平台口径变了，而不是「测试太严」。
 */

interface Spy {
  submit: number;
  list: number;
  rank: number;
}

function spyApi(handlers: Partial<RankApi> = {}): { api: RankApi; spy: Spy } {
  const spy: Spy = { submit: 0, list: 0, rank: 0 };
  const api: RankApi = {
    submitScore: async (options) => {
      spy.submit += 1;
      return handlers.submitScore ? handlers.submitScore(options) : { score: options.score };
    },
    getRankList: async (options) => {
      spy.list += 1;
      return handlers.getRankList ? handlers.getRankList(options) : { data: [] };
    },
    getMyRank: async (options) => {
      spy.rank += 1;
      return handlers.getMyRank ? handlers.getMyRank(options) : { status: 'NO_SCORE', rank: null, score: null };
    },
  };
  return { api, spy };
}

function recordingSleep(): { sleep: Sleep; waits: number[] } {
  const waits: number[] = [];
  return {
    waits,
    sleep: async (ms: number) => {
      waits.push(ms);
    },
  };
}

test('boardOfDay：四个关卡一一对应，未知关卡不猜榜位', () => {
  assert.equal(boardOfDay('D01'), 1);
  assert.equal(boardOfDay('D02'), 2);
  assert.equal(boardOfDay('D03'), 3);
  assert.equal(boardOfDay('D04'), 4);
  assert.equal(boardOfDay('D05'), null);
  assert.equal(boardOfDay(''), null);
  assert.equal(boardOfDay(null), null);
});

test('boardOfDay：DAY_IDS 里已上线的关卡必须全部登记，新增关卡忘了登记会在这里失败', () => {
  for (const day of DAY_IDS) {
    assert.notEqual(boardOfDay(day), null, `${day} 缺少榜位映射`);
  }
});

test('isScoreSubmittable：±1,000,000 边界按文档闭区间', () => {
  assert.equal(isScoreSubmittable(0), true);
  assert.equal(isScoreSubmittable(-1200), true);
  assert.equal(isScoreSubmittable(1600), true);
  assert.equal(isScoreSubmittable(MAX_ABS_SCORE), true);
  assert.equal(isScoreSubmittable(-MAX_ABS_SCORE), true);
  assert.equal(isScoreSubmittable(MAX_ABS_SCORE + 1), false);
  assert.equal(isScoreSubmittable(-MAX_ABS_SCORE - 1), false);
  assert.equal(isScoreSubmittable(Number.NaN), false);
  assert.equal(isScoreSubmittable(Number.POSITIVE_INFINITY), false);
});

test('normalizeNickname：去控制字符、折空白、截断，空值一律 null', () => {
  assert.equal(normalizeNickname('  阿岚  '), '阿岚');
  assert.equal(normalizeNickname('阿\u0000岚\n'), '阿岚');
  assert.equal(normalizeNickname('a   b'), 'a b');
  assert.equal(normalizeNickname(''), null);
  assert.equal(normalizeNickname('   '), null);
  assert.equal(normalizeNickname(null), null);
  assert.equal(normalizeNickname(42), null);

  const long = '一二三四五六七八九十十一十二十三';
  const clipped = normalizeNickname(long);
  assert.equal(clipped, `${long.slice(0, NICKNAME_MAX_CHARS)}…`);
  assert.equal(Array.from(clipped ?? '').length, NICKNAME_MAX_CHARS + 1);
});

test('parseMyRank：只认平台列出的四种状态，其余一律作废', () => {
  assert.deepEqual(parseMyRank({ status: 'EXACT', rank: 37, score: 420 }), {
    status: 'EXACT',
    rank: 37,
    score: 420,
  });
  assert.deepEqual(parseMyRank({ status: 'OVER_LIMIT', rank: 412, score: 120 }), {
    status: 'OVER_LIMIT',
    rank: 412,
    score: 120,
  });
  assert.deepEqual(parseMyRank({ status: 'NO_SCORE' }), { status: 'NO_SCORE', rank: null, score: null });
  assert.equal(parseMyRank({ status: 'WHATEVER', rank: 1 }), null);
  assert.equal(parseMyRank({ rank: 1 }), null);
  assert.equal(parseMyRank(null), null);
});

test('normalizeRows：过滤脏行，昵称走同一套归一化', () => {
  const rows = normalizeRows([
    { rank: 1, score: 980, nickname: ' 甲 ' },
    { rank: '2', score: 900, nickname: '乙' },
    { rank: 3, score: 0, nickname: null },
    null,
    { rank: 4, score: Number.NaN, nickname: '丙' },
  ]);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], { rank: 1, score: 980, nickname: '甲' });
  assert.deepEqual(rows[1], { rank: 3, score: 0, nickname: null });
});

test('pickNickname：只有 EXACT 才可能匹配到行', () => {
  const rows: RankRow[] = [
    { rank: 37, score: 420, nickname: '阿岚' },
    { rank: 38, score: 410, nickname: null },
  ];
  assert.equal(pickNickname(rows, { status: 'EXACT', rank: 37, score: 420 }), '阿岚');
  assert.equal(pickNickname(rows, { status: 'EXACT', rank: 99, score: 420 }), null);
  assert.equal(pickNickname(rows, { status: 'OVER_LIMIT', rank: 37, score: 420 }), null);
});

test('readClientVersion / isVersionSupported：9.51 是硬门槛', () => {
  assert.equal(MIN_CLIENT_VERSION, 9510);
  assert.equal(readClientVersion({ launchOptions: { miniToolEnv: { buildVersion: 9510004 } } }), 9510);
  assert.equal(isVersionSupported(readClientVersion({ launchOptions: { miniToolEnv: { buildVersion: 9510004 } } })), true);
  assert.equal(isVersionSupported(readClientVersion({ launchOptions: { miniToolEnv: { buildVersion: 9500004 } } })), false);
  assert.equal(readClientVersion(null), 0);
  assert.equal(isVersionSupported(0), false);
});

test('hasRankApi：三个接口缺一不可', () => {
  const full: XhsLike = {
    miniTool: {
      submitScore: async () => ({ score: 0 }),
      getRankList: async () => ({ data: [] }),
      getMyRank: async () => ({ status: 'NO_SCORE', rank: null, score: null }),
    },
  };
  assert.equal(hasRankApi(full), true);
  assert.notEqual(asRankApi(full), null);
  assert.equal(hasRankApi({ miniTool: { submitScore: async () => ({ score: 0 }) } }), false);
  assert.equal(hasRankApi({}), false);
  assert.equal(hasRankApi(null), false);
});

test('mapError：错误码归档，1005/10003 不得被当成「重试一下就好」', () => {
  assert.deepEqual(mapError({ errCode: 1005 }), { kind: 'unauthorized', code: 1005 });
  assert.deepEqual(mapError({ errCode: 1006 }), { kind: 'unauthorized', code: 1006 });
  assert.deepEqual(mapError({ errCode: 10003 }), { kind: 'whitelist', code: 10003 });
  assert.deepEqual(mapError({ errCode: 2002 }), { kind: 'not-ready', code: 2002 });
  assert.deepEqual(mapError({ errCode: 2009 }), { kind: 'rate', code: 2009 });
  assert.deepEqual(mapError({ errCode: 1004 }), { kind: 'score', code: 1004 });
  assert.deepEqual(mapError({ errCode: 1001 }), { kind: 'param', code: 1001 });
  assert.deepEqual(mapError({ errCode: 10001 }), { kind: 'param', code: 10001 });
  assert.deepEqual(mapError({ errCode: 2001 }), { kind: 'unknown', code: 2001 });
  assert.deepEqual(mapError(new Error('gateway')), { kind: 'network', code: null });
  assert.deepEqual(mapError(null), { kind: 'network', code: null });
});

test('callWithRetry：只有 not-ready 退避重试，退避序列与文档一致', async () => {
  const { sleep, waits } = recordingSleep();
  let attempts = 0;
  const outcome = await callWithRetry(async () => {
    attempts += 1;
    if (attempts < 3) throw { errCode: 2002 };
    return 'ok';
  }, sleep);
  assert.deepEqual(outcome, { ok: true, value: 'ok' });
  assert.equal(attempts, 3);
  assert.deepEqual(waits, [RETRY_DELAYS[1], RETRY_DELAYS[2]]);
});

test('callWithRetry：未授权立刻停手，不浪费 150 QPS 配额', async () => {
  const { sleep, waits } = recordingSleep();
  let attempts = 0;
  const outcome = await callWithRetry(async () => {
    attempts += 1;
    throw { errCode: 1005 };
  }, sleep);
  assert.equal(attempts, 1);
  assert.deepEqual(waits, []);
  assert.deepEqual(outcome, { ok: false, error: { kind: 'unauthorized', code: 1005 } });
});

test('callWithRetry：重试用尽后返回最后一次失败原因', async () => {
  const { sleep, waits } = recordingSleep();
  let attempts = 0;
  const outcome = await callWithRetry(async () => {
    attempts += 1;
    throw { errCode: 2002 };
  }, sleep);
  assert.equal(attempts, RETRY_DELAYS.length);
  assert.deepEqual(waits, [500, 1000, 2000]);
  assert.deepEqual(outcome, { ok: false, error: { kind: 'not-ready', code: 2002 } });
});

test('submitRunScore：越界分数本地拦下，不打平台', async () => {
  const { api, spy } = spyApi();
  const outcome = await submitRunScore(api, 4, MAX_ABS_SCORE + 1);
  assert.equal(spy.submit, 0);
  assert.deepEqual(outcome, { ok: false, error: { kind: 'score', code: 1004 } });
});

test('submitRunScore：上传本局分数，返回总榜最高分', async () => {
  const { api, spy } = spyApi({ submitScore: async () => ({ score: 1234 }) });
  const outcome = await submitRunScore(api, 4, 1600);
  assert.equal(spy.submit, 1);
  assert.deepEqual(outcome, { ok: true, value: { score: 1234 } });
});

test('readMyRank：前 100 名才补一次列表拿昵称', async () => {
  const { api, spy } = spyApi({
    getMyRank: async () => ({ status: 'EXACT', rank: 37, score: 420 }),
    getRankList: async () => ({ data: [{ rank: 37, score: 420, nickname: '阿岚' }] }),
  });
  const outcome = await readMyRank(api, 4, 'week');
  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;
  assert.equal(outcome.value.nickname, '阿岚');
  assert.deepEqual(outcome.value.my, { status: 'EXACT', rank: 37, score: 420 });
  assert.equal(spy.rank, 1);
  assert.equal(spy.list, 1);
});

test('readMyRank：101–500 名不白打列表接口', async () => {
  const { api, spy } = spyApi({
    getMyRank: async () => ({ status: 'EXACT', rank: 412, score: 120 }),
  });
  const outcome = await readMyRank(api, 4, 'week');
  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;
  assert.equal(outcome.value.nickname, null);
  assert.equal(outcome.value.my.rank, 412);
  assert.equal(spy.list, 0);
});

test('readMyRank：OVER_LIMIT 与 NO_SCORE 都不查列表', async () => {
  for (const status of ['OVER_LIMIT', 'NO_SCORE', 'NOT_PARTICIPATING'] as const) {
    const { api, spy } = spyApi({ getMyRank: async () => ({ status, rank: null, score: null }) });
    const outcome = await readMyRank(api, 1, 'week');
    assert.equal(outcome.ok, true);
    if (!outcome.ok) continue;
    assert.equal(outcome.value.my.status, status);
    assert.equal(outcome.value.nickname, null);
    assert.equal(spy.list, 0);
  }
});

test('readMyRank：平台返回未知状态时失败关闭，不显示半个榜单', async () => {
  const { api } = spyApi({ getMyRank: async () => ({ status: 'WAT' as never, rank: 1, score: 1 }) });
  const outcome = await readMyRank(api, 1, 'week');
  assert.equal(outcome.ok, false);
});
