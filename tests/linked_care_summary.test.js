const test = require('node:test');
const assert = require('node:assert/strict');
const { loadComponent } = require('./reception_harness');

function setup(t, fetch) {
  const previousApp = global.getApp;
  const previousWx = global.wx;
  const photos = [];
  global.getApp = () => ({ globalData: { sessionKey: 'staff-session' }, loginPromiseNew: Promise.resolve() });
  global.wx = { previewImage: value => photos.push(value) };
  t.after(() => { global.getApp = previousApp; global.wx = previousWx; });
  const component = loadComponent('components/linked-care-summary/index.js', {
    IMAGE_HOST: 'https://images.invalid/', getOrderByStaffPromise: fetch
  }, { orderId: 20 });
  return { component, photos };
}

test('逐件展示关联养护的装备和真实项目，保留取消标记与照片', async t => {
  const { component, photos } = setup(t, async (id, sessionKey) => {
    assert.equal(id, 20); assert.equal(sessionKey, 'staff-session');
    return { cares: [
      { id: 31, equipment: '双板', brand: 'Fischer/费舍尔', scale: '170', need_edge: 1,
        need_wax: 1, need_unwax: 1, careImages: [{ image: { file_path_name: 'ski.jpg', thumbUrl: 'ski-thumb.jpg' } }] },
      { id: 32, equipment: '单板', brand: 'Burton', scale: '156', free_wax: 1, is_cancel: true },
      { id: 33, equipment: '双板', need_wax: 1, edge_degree: '89' }
    ] };
  });
  await component.loadOrder();
  assert.equal(component.data.rows.length, 3);
  assert.equal(component.data.rows[0].title, '第1件 · 双板');
  assert.equal(component.data.rows[0].equipment, 'Fischer · 170cm');
  assert.equal(component.data.rows[0].projects, '修刃、热蜡、刮蜡');
  assert.equal(component.data.rows[1].projects, '机打蜡');
  assert.equal(component.data.rows[1].cancelled, true);
  assert.equal(component.data.rows[2].projects, '热蜡'); // 旧角度残值不能把单项显示成双项。
  component.onPhotoTap({ currentTarget: { dataset: { row: 0, index: 0 } } });
  assert.deepEqual(photos[0], { current: 'https://images.invalid/ski.jpg', urls: ['https://images.invalid/ski.jpg'] });
});

test('切换关联订单时清掉旧装备，迟到响应不串单', async t => {
  const pending = [];
  const { component } = setup(t, id => new Promise(resolve => pending.push({ id, resolve })));
  component.data.rows = [{ id: 1 }];
  const first = component.loadOrder();
  assert.deepEqual(component.data.rows, []);
  component.properties.orderId = 21;
  const second = component.loadOrder();
  pending[1].resolve({ cares: [{ id: 41, equipment: '单板', need_edge: 1 }] });
  await second;
  pending[0].resolve({ cares: [{ id: 31, equipment: '双板', need_wax: 1 }] });
  await first;
  assert.equal(component.data.rows[0].id, 41);
  assert.equal(component.data.loading, false);
});

test('加载失败显示重试，重试后恢复关联装备', async t => {
  let attempts = 0;
  const { component } = setup(t, async () => {
    if (++attempts === 1) throw new Error('网络异常');
    return { cares: [{ id: 31, equipment: '双板', need_edge: 1 }] };
  });
  await component.loadOrder();
  assert.match(component.data.error, /重试/);
  assert.equal(component.data.loading, false);
  await component.loadOrder();
  assert.equal(component.data.error, '');
  assert.equal(component.data.rows[0].projects, '修刃');
});
