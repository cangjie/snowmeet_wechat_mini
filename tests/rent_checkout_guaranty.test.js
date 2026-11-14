// 租赁开单页「去结算」后再改动页面保存报 500（2026-11-12 生产实录，SaveRentRecept；11-14 杨天帅再现）：
// 去结算把本地订单脱钩成 id=0 的新单，却保留了 PlaceRentOrder 刚生成并随响应带回的保证金记录
// （订单级 order.guarantys 和每个 rental.guaranties 两处都有），
// 再保存时后端按已有 id 插入保证金记录 → 500。保证金记录只由去结算生成，开单页不能再回传它。
const test = require('node:test');
const assert = require('node:assert/strict');
const util = require('../utils/util.js');
const { loadPage, settle } = require('./reception_harness');

function setup(t) {
  const oldApp = global.getApp, oldWx = global.wx, oldRequest = util.performWebRequest;
  const posts = [];
  global.getApp = () => ({ globalData: { sessionKey: 'test', requestPrefix: 'https://t/api/' }, loginPromiseNew: Promise.resolve() });
  global.wx = { showLoading() {}, hideLoading() {}, navigateTo() {}, showToast() {} };
  t.after(() => { global.getApp = oldApp; global.wx = oldWx; util.performWebRequest = oldRequest; });
  return posts;
}

const placedGuaranty = () => ({ id: 16118, order_id: 72702, biz_type: '租赁', biz_id: 54901, amount: 3000, valid: 1 });
const localOrder = () => ({ id: 0, shop: '万龙服务中心', type: '租赁', guarantys: [placedGuaranty()], rentals: [
  { id: 0, name: '中级双板套餐', guaranty: 3000, guaranties: [placedGuaranty()], rentItems: [{ id: 0, name: '全能' }] }] });

test('去结算后脱钩的本地订单不再带着刚生成的保证金记录', async t => {
  const posts = setup(t);
  util.performWebRequest = async (url, body) => {
    posts.push({ url, body });
    if (url.includes('SaveRentRecept')) {
      return { ...body, id: 72702, rentals: body.rentals.map(r => ({ ...r, id: 54901, rentItems: [{ id: 9, rental_id: 54901 }] })) };
    }
    // PlaceRentOrder：后端刚给这单生成保证金记录，随响应带回
    return { id: 72702, code: 'WF_ZL_261112_00004', valid: 1, shop: '万龙服务中心', type: '租赁', guarantys: [placedGuaranty()], rentals: [
      { id: 54901, order_id: 72702, name: '中级双板套餐', guaranties: [placedGuaranty()], rentItems: [{ id: 9, rental_id: 54901 }] }] };
  };
  const page = loadPage('pages/admin/reception/recept_new.js', {});
  page.setData({ bizType: 'rent', order: { ...localOrder(), id: 72702 } });
  page.onCheckout({ detail: {} }); await settle(); await settle();
  assert.equal(page.data.order.id, 0);
  assert.equal(page.data.order.rentals[0].id, 0);
  assert.deepEqual(page.data.order.rentals[0].guaranties, []);
  // 同一条保证金记录还挂在订单级 guarantys 上（11-14 杨天帅又 500：上次只清了 rental 级）
  assert.deepEqual(page.data.order.guarantys, []);
  assert.equal(page.data.order.rentals[0].rentItems[0].id, 0);
});

test('开单页保存草稿时不回传保证金记录', async t => {
  const posts = setup(t);
  util.performWebRequest = async (url, body) => { posts.push({ url, body }); return { ...body, id: 72714 }; };
  const page = loadPage('pages/admin/reception/recept_new.js', {});
  page.setData({ bizType: 'rent', order: localOrder() });
  await page.saveRentReceptOrder();
  assert.equal(posts.length, 1);
  assert.ok(posts[0].url.includes('Rent/SaveRentRecept'));
  assert.deepEqual(posts[0].body.rentals[0].guaranties, []);
  assert.deepEqual(posts[0].body.guarantys, []);
  // 本地数据不被改写：页面自己的购物车对象保持原样
  assert.equal(posts[0].body.rentals[0].name, '中级双板套餐');
});
