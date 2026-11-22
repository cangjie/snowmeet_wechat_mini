const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { loadPage, settle } = require('./reception_harness.js')

function setup(t, file) {
  const previous = { getApp: global.getApp, wx: global.wx }
  const app = { loginPromiseNew: Promise.resolve({ authenticated: true }), globalData: { sessionKey: 'session', staff: { valid: 1, title_level: 100 }, member: { id: 2, cell: '13800000000' }, requestPrefix: 'https://test.invalid/api/', env: 'trial' } }
  const calls = { created: [], claimed: [], batch: [], deleted: [], modals: [], covers: [], logo: [], logoUrls: [] }
  global.getApp = () => app
  let latestTitle = ''
  global.wx = {
    showToast() {}, stopPullDownRefresh() {}, showModal(options) { calls.modals.push(options) },
    getImageInfo(options) { calls.logoUrls.push(options.src); setImmediate(() => options.success({ path: 'wxfile://server-logo.png' })) },
    createSelectorQuery() {
      const texts = []
      const context = { drawImage() {}, fillRect() {}, measureText(s) { return { width: Array.from(s).length * 20 } },
        fillText(s) { texts.push(s); latestTitle = texts.slice(1, -1).join('') } }
      const canvas = { getContext() { return context }, createImage() { return { set src(p) { calls.logo.push(p); setImmediate(() => this.onload()) } } } }
      const query = { in() { return query }, select() { return query }, fields() { return query }, exec(cb) { setImmediate(() => cb([{ node: canvas }])) } }
      return query
    },
    canvasToTempFilePath(o) { calls.covers.push(latestTitle); setImmediate(() => o.success({ tempFilePath: 'wxfile://' + latestTitle })) }
  }
  const api = {
    staffCouponTemplatesPromise() { return Promise.resolve({ templates: [{ id: 12, name: '测试券' }] }) },
    staffCouponBatchesPromise(id) { calls.batch.push(id); return Promise.resolve({ batches: [] }) },
    createStaffCouponBatchPromise(form) { calls.created.push(form); return Promise.resolve({ batchId: 3 }) },
    deleteStaffCouponBatchPromise(id, key) { calls.deleted.push([id, key]); return Promise.resolve({ batchId: id }) },
    getMiniShareBatchPromise() { return Promise.resolve({ batchId: 3, templateName: '测试券', shareType: 'staff_batch', claimQuantity: 5 }) },
    claimStaffCouponBatchPromise(id, key) { calls.claimed.push([id, key]); return Promise.resolve({ code: '001', count: 5 }) }
  }
  const page = loadPage(file, api)
  t.after(() => { global.getApp = previous.getApp; global.wx = previous.wx })
  return { page, calls }
}

test('普通店员可以创建单人多张批次，并分享同一个批次', async t => {
  const { page, calls } = setup(t, 'pages/admin/ticket/staff_coupon_batches/staff_coupon_batches.js')
  await page.onLoad()
  page.onReady()
  await page.selectTemplate({ currentTarget: { dataset: { id: 12 } } })
  await page._couponCoverState.queue
  page.newBatch()
  page.setMode({ currentTarget: { dataset: { mode: 'single' } } })
  page.setCount({ detail: { value: '5' } })
  await page.create()
  assert.equal(calls.created[0].mode, 'single')
  assert.equal(calls.created[0].total, 5)
  assert.equal(calls.created[0].templateId, 12)
  assert.equal(calls.batch.length, 2)
  const shared = page.onShareAppMessage({ target: { dataset: { path: '/claim?batch=3', cover: page.data.coverPath } } })
  assert.equal(shared.path, '/claim?batch=3')
  assert.equal(shared.imageUrl, 'wxfile://测试券')
  assert.match(shared.title, /测试券/)
  assert.deepEqual(calls.logoUrls, ['https://mini.snowmeet.top/images/logo.png'])
  assert.deepEqual(calls.logo, ['wxfile://server-logo.png'])
})

test('店员批次领取走独立接口并显示本次张数', async t => {
  const { page, calls } = setup(t, 'pages/mine/ticket/ticket_claim_mini/ticket_claim_mini.js')
  page.onLoad({ batch: '3' }); await settle()
  await page.onClaim()
  assert.deepEqual(calls.claimed, [[3, 'session']])
  assert.equal(page.data.doneCount, 5)
})

test('已撤回无人领取的批次确认后删除并刷新，其他批次不能调用删除', async t => {
  const { page, calls } = setup(t, 'pages/admin/ticket/staff_coupon_batches/staff_coupon_batches.js')
  page.setData({ selected: { id: 12, name: '测试券' }, batches: [{ batchId: 3, canDelete: true }, { batchId: 4, canDelete: false }] })
  page.deleteBatch({ currentTarget: { dataset: { id: 4 } } })
  assert.equal(calls.modals.length, 0)
  page.deleteBatch({ currentTarget: { dataset: { id: 3 } } })
  assert.equal(calls.modals.length, 1)
  calls.modals[0].success({ confirm: false })
  assert.equal(calls.deleted.length, 0)
  calls.modals[0].success({ confirm: true })
  await settle()
  assert.deepEqual(calls.deleted, [[3, 'session']])
  assert.deepEqual(calls.batch, [12])
  assert.equal(page.data.deletingBatchId, 0)
})

test('批次页按钮使用圆角样式并去掉原生边框，删除按钮由服务端控制', () => {
  const root = path.join(__dirname, '../pages/admin/ticket/staff_coupon_batches')
  const styles = fs.readFileSync(path.join(root, 'staff_coupon_batches.wxss'), 'utf8')
  const markup = fs.readFileSync(path.join(root, 'staff_coupon_batches.wxml'), 'utf8')
  assert.match(styles, /\.action-btn\s*\{[^}]*height:\s*68rpx;\s*line-height:\s*68rpx/)
  assert.match(styles, /\.action-btn::after\s*\{[^}]*border:\s*0/)
  assert.match(markup, /wx:if="\{\{item\.canDelete\}\}"/)
  assert.match(markup, /bindtap="deleteBatch"/)
})

test('快速切换模板时分享封面只显示当前券名，旧封面不能复用', async t => {
  const { page, calls } = setup(t, 'pages/admin/ticket/staff_coupon_batches/staff_coupon_batches.js')
  page.setData({ templates: [{ id: 12, name: '免费券' }, { id: 19, name: '养护双项券' }] })
  page.onReady()
  page.selectTemplate({ currentTarget: { dataset: { id: 12 } } })
  page.selectTemplate({ currentTarget: { dataset: { id: 19 } } })
  await page._couponCoverState.queue
  await settle()
  assert.deepEqual(calls.covers, ['免费券', '养护双项券'])
  assert.equal(page.data.coverPath, 'wxfile://养护双项券')
  assert.equal(page.onShareAppMessage({ target: { dataset: { path: '/claim?batch=2', cover: 'wxfile://免费券' } } }).path, '/pages/index/index')
  assert.equal(page.onShareAppMessage({ target: { dataset: { path: '/claim?batch=2', cover: page.data.coverPath } } }).imageUrl, 'wxfile://养护双项券')
})

test('券名较长时自动换行缩小，名称完整保留', () => {
  const cover = require('../pages/admin/ticket/staff_coupon_batches/share_cover.js')
  const ctx = { size: 12, set font(value) { this.size = parseInt(value, 10) }, measureText(s) { return { width: Array.from(s).length * this.size } } }
  const name = '易龙雪聚滑雪体验养护专享优惠券'
  const result = cover.layout(ctx, name)
  assert.equal(result.lines.join(''), name)
  assert.ok(result.lines.length <= 2)
  assert.ok(result.lines.every(line => ctx.measureText(line).width <= 420))
})

test('画布无响应时可以重试，后续封面不会被旧任务阻塞', async t => {
  const { page } = setup(t, 'pages/admin/ticket/staff_coupon_batches/staff_coupon_batches.js')
  const cover = require('../pages/admin/ticket/staff_coupon_batches/share_cover.js')
  const original = global.wx.canvasToTempFilePath
  let first = true
  global.wx.canvasToTempFilePath = options => {
    if (first) first = false
    else original(options)
  }
  await assert.rejects(cover.prepare(page, '优惠券', false, 20), /超时/)
  assert.equal(await cover.prepare(page, '优惠券', true, 200), 'wxfile://优惠券')
})

test('封面生成失败不能分享，重试成功后带正确名称封面', async t => {
  const { page } = setup(t, 'pages/admin/ticket/staff_coupon_batches/staff_coupon_batches.js')
  const success = global.wx.canvasToTempFilePath
  let first = true
  global.wx.canvasToTempFilePath = options => {
    if (first) { first = false; options.fail(new Error('canvas failed')) } else success(options)
  }
  page.setData({ templates: [{ id: 12, name: '体验优惠券' }] })
  page.onReady()
  await page.selectTemplate({ currentTarget: { dataset: { id: 12 } } })
  await page._couponCoverState.queue
  await settle()
  assert.equal(page.data.coverPath, '')
  assert.equal(page.data.coverError, true)
  assert.equal(page.onShareAppMessage({ target: { dataset: { path: '/claim?batch=3' } } }).path, '/pages/index/index')
  await page.retryCover()
  assert.equal(page.data.coverPath, 'wxfile://体验优惠券')
  assert.equal(page.data.coverError, false)
})

test('服务器 Logo 下载失败后可以重试', async t => {
  const { page } = setup(t, 'pages/admin/ticket/staff_coupon_batches/staff_coupon_batches.js')
  const success = global.wx.getImageInfo
  let first = true
  global.wx.getImageInfo = options => {
    if (first) { first = false; options.fail(new Error('network failed')) } else success(options)
  }
  page.setData({ templates: [{ id: 12, name: '体验优惠券' }] })
  page.onReady()
  await page.selectTemplate({ currentTarget: { dataset: { id: 12 } } })
  await page._couponCoverState.queue
  await settle()
  assert.equal(page.data.coverError, true)
  await page.retryCover()
  assert.equal(page.data.coverPath, 'wxfile://体验优惠券')
})
