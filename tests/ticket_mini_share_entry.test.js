const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { loadPage } = require('./reception_harness.js')

function setup(t, file) {
  const previous = { wx: global.wx, getApp: global.getApp }
  const calls = { transfer: [], batch: [], fixed: [], poster: [], subscribe: [] }
  global.getApp = () => ({ globalData: { sessionKey: 'sk', domainName: 'test.invalid', env: 'trial' } })
  global.wx = { showToast() {}, showShareImageMenu() {}, getSystemInfoSync() { return {windowWidth:375} }, getImageInfo() {}, requestSubscribeMessage(options) {
    calls.subscribe.push(options.tmplIds)
    options.success({ [options.tmplIds[0]]: 'accept' })
  } }
  const fake = {
    getTicketTemplateDetailPromise() { return Promise.resolve({name:'免费打蜡券', sharable:1, coverUploadId:10, coverUrl:'https://test.invalid/cover.png', rules:[]}) },
    setTicketToMiniSharePromise(...args) { calls.transfer.push(args); return Promise.resolve({}) },
    shareMiniTicketTemplatePromise(...args) { calls.batch.push(args); return Promise.resolve({ batchId: 8, templateName: '券', sharePath: '/pages/mine/ticket/ticket_claim_mini/ticket_claim_mini?batch=8' }) },
    createMiniQrCodeBatchPromise(...args) { calls.fixed.push(args); return Promise.resolve({ batchId: 9 }) },
    generateMiniTicketPosterPromise(...args) { calls.poster.push(args); return Promise.resolve({ url: 'https://test.invalid/poster.png' }) },
    setTicketToSharePromise() { return Promise.reject('legacy transfer unexpectedly used') },
    shareTicketTemplatePromise() { return Promise.reject('legacy batch unexpectedly used') },
    createQrCodeBatchPromise() { return Promise.reject('legacy fixed code unexpectedly used') }
  }
  const page = loadPage(file, fake)
  t.after(() => {
    if (previous.wx === undefined) delete global.wx; else global.wx = previous.wx
    if (previous.getApp === undefined) delete global.getApp; else global.getApp = previous.getApp
  })
  return { page, calls }
}

test('券包新发起转赠使用新接口和新接收页', async t => {
  const { page, calls } = setup(t, 'pages/mine/ticket/ticket_list.js')
  page.setData({ ticketArr: [{ code: 'T1', name: '券' }] })
  const result = await page.onShareAppMessage({ target: { dataset: { code: 'T1' } } })
  assert.deepEqual(calls.transfer, [['T1', 'sk']])
  assert.equal(result.path, '/pages/mine/ticket/ticket_share_mini?code=T1')
})

test('券详情新发起转赠使用新接口和新接收页', async t => {
  const { page, calls } = setup(t, 'pages/mine/ticket/ticket_detail.js')
  page.setData({ ticket: { code: 'T1', name: '券', canTransfer: true } })
  const result = await page.onShareAppMessage()
  assert.deepEqual(calls.transfer, [['T1', 'sk']])
  assert.equal(result.path, '/pages/mine/ticket/ticket_share_mini?code=T1')
})

test('员工新分享卡片建新批次并生成对应环境的小程序码海报', async t => {
  const { page, calls } = setup(t, 'pages/admin/ticket/template_edit/template_edit.js')
  page.setData({ id: 12, sharable: 1, shareMode: 'personal' })
  page.loadShareBatches = () => {}
  const result = await page.onShareAppMessage()
  assert.deepEqual(calls.batch, [[12, 'personal', 'sk']])
  assert.deepEqual(calls.poster, [[8, 'sk', 'trial']])
  assert.match(result.path, /ticket_claim_mini/)
})

test('员工新生成固定海报不复用旧公众号批次或海报接口', async t => {
  const { page, calls } = setup(t, 'pages/admin/ticket/template_edit/template_edit.js')
  page.setData({ id: 12, sharable: 1, coverUploadId: 5, groupQrMode: 'static' })
  page._downloadPoster = () => Promise.resolve('/tmp/local-poster.png')
  page.loadShareBatches = () => {}
  await page.onShareGroupTap()
  // Existing event handler is promise-based; allow its queued chain to finish.
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(calls.fixed, [[12, '群分享', 'sk']])
  assert.deepEqual(calls.poster, [[9, 'sk', 'trial']])
})

function loadApi() {
  const calls = []
  const module = { exports: {} }
  const app = { globalData: { requestPrefix: 'https://test.invalid/api/' } }
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../utils/data.js'), 'utf8'), {
    module,
    getApp: () => app,
    require(name) {
      if (name === './util.js') return { performWebRequest(url, body) { calls.push({ url, body }); return Promise.resolve({}) } }
      return {}
    }
  })
  return { api: module.exports, calls }
}

test('新增分享 API 使用独立路由并编码会话、券码和运营场景', async () => {
  const { api, calls } = loadApi()
  await api.setTicketToMiniSharePromise('T/1', 'a+b')
  await api.acceptMiniTicketPromise('T/1', '分享获得', 'a+b')
  await api.shareMiniTicketTemplatePromise(12, 'personal', 'a+b')
  await api.createMiniQrCodeBatchPromise(12, '外卖 群', 'a+b')
  await api.getMiniShareBatchPromise(7, 'a+b')
  await api.claimMiniSharedTicketPromise(7, 'a+b')
  await api.claimMiniQrCodeTicketPromise(7, 'a+b')
  await api.generateMiniTicketPosterPromise(7, 'a+b', 'trial')
  const expected = ['Ticket/SetTicketToMiniShare/T%2F1', 'Ticket/AcceptMiniTicket/T%2F1',
    'TicketTemplateAdmin/ShareMiniTicketTemplateByStaff', 'TicketTemplateAdmin/CreateMiniQrCodeBatchByStaff',
    'TicketShare/GetMiniShareBatch', 'TicketShare/ClaimMiniSharedTicket',
    'TicketShare/ClaimMiniQrCodeTicket', 'TicketPoster/GenerateMini']
  assert.equal(calls.length, expected.length)
  calls.forEach((call, index) => {
    assert.ok(call.url.startsWith('https://test.invalid/api/' + expected[index] + '?'))
    assert.match(call.url, /sessionKey=a%2Bb/)
  })
  assert.match(calls[3].url, /channel=%E5%A4%96%E5%8D%96%20%E7%BE%A4/)
  assert.match(calls[7].url, /envVersion=trial/)
})

test('旧接口 wrapper 继续指向原端点，已有链接注册保留', async () => {
  const { api, calls } = loadApi()
  await api.setTicketToSharePromise('T1', 'sk')
  await api.acceptTicketPromise('T1', '分享获得', 'sk')
  await api.getShareBatchPromise(7, 'sk')
  await api.claimSharedTicketPromise(7, 'sk')
  assert.match(calls[0].url, /Ticket\/SetTicketToShare\//)
  assert.match(calls[1].url, /Ticket\/AcceptTicket\//)
  assert.match(calls[2].url, /TicketShare\/GetShareBatch\?/)
  assert.match(calls[3].url, /TicketShare\/ClaimSharedTicket\?/)
  const app = JSON.parse(fs.readFileSync(path.join(__dirname, '../app.json'), 'utf8'))
  assert.ok(app.pages.includes('pages/mine/ticket/ticket_share'))
  assert.ok(app.pages.includes('pages/mine/ticket/ticket_claim/ticket_claim'))
  assert.ok(app.pages.includes('pages/mine/ticket/ticket_share_mini'))
  assert.ok(app.pages.includes('pages/mine/ticket/ticket_claim_mini/ticket_claim_mini'))
})

for (const file of ['pages/mine/ticket/ticket_list.js', 'pages/mine/ticket/ticket_detail.js']) {
  for (const templateId of [12, 16]) {
    test(`${file}: 模板 ${templateId} 只有老顾客券请求回赠提醒`, t => {
      const { page, calls } = setup(t, file)
      const ticket = { code: 'T1', template_id: templateId, canTransfer: true }
      page.setData({ ticketArr: [ticket], ticket })
      page.onTransferTap({ currentTarget: { dataset: { code: 'T1' } } })
      assert.equal(page.data.transferShow, true)
      assert.equal(page.data.transferRewardEligible, templateId === 16)
      assert.equal(calls.subscribe.length, templateId === 16 ? 1 : 0)
    })
  }
}

test('打开模板不自动生成朋友圈分享批次，主动准备时才创建', async t => {
  const { page, calls } = setup(t, 'pages/admin/ticket/template_edit/template_edit.js')
  const setData = page.setData
  page.setData = (patch, callback) => { setData.call(page, patch); if (callback) callback() }
  page.setData({ id: 12 })
  page.getData()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(calls.batch.length, 0)
  assert.equal(calls.poster.length, 0)
  await page.onPrepareTimelineTap()
  assert.deepEqual(calls.batch, [[12, 'group', 'sk']])
  assert.deepEqual(calls.poster, [[8, 'sk', 'trial']])
  assert.ok(page.data.timelinePosterUrl)
})
