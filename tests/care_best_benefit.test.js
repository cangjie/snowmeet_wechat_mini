const test = require('node:test');
const assert = require('node:assert/strict');
const { assign } = require('../utils/care_best_benefit');

const resources = [
  { key: 's', id: 1, type: 'season', capacity: 1 },
  { key: 'late', id: 'late', type: 'ticket', expire: '2027-02-01', capacity: 1 },
  { key: 'early', id: 'early', type: 'ticket', expire: '2026-12-01', capacity: 1 },
  { key: 'coach', id: 2, type: 'coach', capacity: 9 },
  { key: 'p', id: 3, type: 'punch', capacity: 2 },
];
const opt = (key, amount) => ({ key, amount });

test('先比实付，再按季卡、临期券、学员卡、次卡排序', () => {
  assert.deepEqual(assign([{ baseline: 200, options: [opt('p', 0), opt('late', 0), opt('s', 0)] }], resources), ['s']);
  assert.deepEqual(assign([{ baseline: 200, options: [opt('p', 20), opt('s', 30), opt('early', 20), opt('late', 20)] }], resources), ['early']);
  assert.deepEqual(assign([{ baseline: 200, options: [opt('p', 10), opt('s', 20)] }], resources), ['p']);
});

test('全单分配有限权益，以总应付最低为准，不逐件贪心', () => {
  const result = assign([
    { baseline: 100, options: [opt('s', 0), opt('early', 10)] },
    { baseline: 100, options: [opt('s', 0), opt('early', 90)] },
  ], resources);
  assert.deepEqual(result, ['early', 's']);
});

test('不消耗没有优惠的权益；机打蜡则必须分配可用权益', () => {
  assert.deepEqual(assign([{ baseline: 100, options: [opt('s', 100)] }], resources), [null]);
  assert.deepEqual(assign([{ baseline: null, requiresBenefit: true, options: [opt('s', 0), opt('early', 0)] }], resources), ['s']);
  assert.throws(() => assign([{ baseline: null, requiresBenefit: true, options: [] }], resources), /没有可用/);
});

test('券和季卡不能重复，次卡最多使用剩余次数', () => {
  const r = [resources[0], { ...resources[4], capacity: 2 }];
  const result = assign(Array.from({ length: 4 }, () => ({ baseline: 100, options: [opt('s', 0), opt('p', 0)] })), r);
  assert.equal(result.filter(x => x === 's').length, 1);
  assert.equal(result.filter(x => x === 'p').length, 2);
  assert.equal(result.filter(x => x === null).length, 1);
});

test('多件装备和有限权益的最低金额与穷举结果一致', () => {
  let seed = 731;
  const random = max => { seed = (seed * 48271) % 2147483647; return seed % max; };
  for (let sample = 0; sample < 100; sample++) {
    const rs = resources.slice(0, 3).map(r => ({ ...r, capacity: 1 }));
    const cs = Array.from({ length: 3 }, () => ({ baseline: 100,
      options: rs.map(r => opt(r.key, random(11) * 10)).filter(() => random(3) !== 0) }));
    let best = Infinity;
    function visit(i, used, amount) {
      if (i === cs.length) { best = Math.min(best, amount); return; }
      visit(i + 1, used, amount + cs[i].baseline);
      for (const option of cs[i].options) if (!used.has(option.key) && option.amount < cs[i].baseline) {
        const next = new Set(used); next.add(option.key); visit(i + 1, next, amount + option.amount);
      }
    }
    visit(0, new Set(), 0);
    const actual = assign(cs, rs).reduce((sum, key, i) => sum + (key == null ? cs[i].baseline : cs[i].options.find(o => o.key === key).amount), 0);
    assert.equal(actual, best, 'sample ' + sample);
  }
});
