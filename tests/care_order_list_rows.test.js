// 养护订单列表：每件装备一块（品牌 / 长度 / 项目 / 照片 / 养护进度），订单信息排成两列并显示开单店铺
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { loadPage, tap } = require('./reception_harness.js')
const rows = require('../utils/care_order_rows.js')

const task = (name, status, sort, extra) => Object.assign({ id: sort + 1, task_name: name, status, sort, valid: 1 }, extra)

function care(extra) {
  return Object.assign({ id: 1, equipment: '双板', brand: 'ATOMIC', scale: '170', careImages: [], tasks: [] }, extra)
}

test('标题：品牌 · 长度；品牌取斜杠前的中文/英文名，缺的项直接省略；双板 / 单板的类型字样去掉（由图标表示）', () => {
  assert.equal(rows.equipmentTitle(care()), 'ATOMIC · 170cm')
  assert.equal(rows.equipmentTitle(care({ brand: 'ATOMIC/阿托米克' })), 'ATOMIC · 170cm')
  assert.equal(rows.equipmentTitle(care({ equipment: '单板', brand: null, scale: '155' })), '155cm')
  assert.equal(rows.equipmentTitle(care({ scale: '170cm' })), 'ATOMIC · 170cm')
  assert.equal(rows.equipmentTitle(care({ equipment: ' 双板 ', brand: 'APO', scale: '' })), 'APO')
})

test('标题：不是双板 / 单板的装备仍带类型字样；双板 / 单板连品牌长度都没填时退回显示类型，免得标题是空的', () => {
  assert.equal(rows.equipmentTitle(care({ equipment: '头盔', brand: 'POC', scale: '' })), '头盔 · POC')
  assert.equal(rows.equipmentTitle(care({ equipment: '双板', brand: '', scale: '' })), '双板')
  assert.equal(rows.equipmentTitle(care({ equipment: '单板', brand: null, scale: null })), '单板')
  assert.equal(rows.equipmentTitle({ id: 2 }), '装备')
})

test('装备类型图标：双板 / 单板各有一个，别的装备没有；图标文件真实存在', () => {
  const fs = require('node:fs')
  const path = require('node:path')
  assert.deepEqual([rows.equipmentKind(care()), rows.equipmentKind(care({ equipment: '单板' })), rows.equipmentKind(care({ equipment: '头盔' })), rows.equipmentKind({ id: 3 })], ['双板', '单板', '', ''])
  const [d, s, o] = rows.buildCareRows([care({ id: 1 }), care({ id: 2, equipment: '单板' }), care({ id: 3, equipment: '头盔' })], '')
  assert.notEqual(d.iconSrc, s.iconSrc)
  assert.equal(o.iconSrc, '')
  for (const src of [d.iconSrc, s.iconSrc]) {
    assert.match(src, /^\/images\/care\/[\w-]+\.svg$/)
    const file = path.join(__dirname, '..', src)
    assert.ok(fs.existsSync(file), src + ' 不存在')
    const svg = fs.readFileSync(file, 'utf8')
    assert.match(svg, /^<svg[^>]*viewBox=/)
    assert.match(svg, /<\/svg>\s*$/)
  }
})

test('项目标签：叫法与详情页一致（热蜡、机打蜡、养板、封板、立等），修刃带角度', () => {
  const texts = c => rows.serviceChips(c).map(s => s.text)
  assert.deepEqual(texts(care({ need_edge: 1, edge_degree: '89', need_wax: 1, need_unwax: 1 })), ['修刃89°', '热蜡', '刮蜡'])
  assert.deepEqual(texts(care({ need_edge: 1, maintain_board: 1, need_unwax: 1 })), ['修刃', '养板', '刮蜡'])
  assert.deepEqual(texts(care({ free_wax: 1, need_unwax: 1 })), ['机打蜡', '刮蜡'])
  assert.deepEqual(texts(care({ need_wax: 1, seal_board: 1, urgent: 1 })), ['热蜡', '封板', '立等'])
  assert.deepEqual(texts(care({ repair_memo: '补板底' })), ['维修:补板底'])
  assert.deepEqual(texts(care()), [])
})

test('立等、非雪季用醒目样式，其余默认', () => {
  const list = rows.serviceChips(care({ need_wax: 1, urgent: 1, biz_type: '非雪季养护', summer: 'now' }))
  assert.deepEqual(list.map(s => [s.text, s.cls]), [
    ['非雪季·立等现修', 'svc--summer'], ['热蜡', ''], ['立等', 'svc--urgent']
  ])
  assert.equal(rows.serviceChips(care({ biz_type: '非雪季养护', summer: 'later' }))[0].text, '非雪季·寄存后修')
  assert.equal(rows.serviceChips(care({ biz_type: '非雪季养护' }))[0].text, '非雪季')
})

test('进度：没有任务链（没付款还没生成）显示未开始，不带数字', () => {
  const p = rows.careProgress(care())
  assert.deepEqual([p.label, p.cls, p.current], ['未开始', 'idle', ''])
})

test('进度：任务都没动过是未开始；动过一个就是进行中 已完成数/总数，并指出当前任务', () => {
  const fresh = rows.careProgress(care({ tasks: [task('安全检查', '未开始', 1), task('修刃', '未开始', 10), task('发板', '未开始', 90)] }))
  assert.deepEqual([fresh.label, fresh.cls], ['未开始', 'idle'])
  const running = rows.careProgress(care({
    tasks: [task('安全检查', '已完成', 1), task('修刃', '已完成', 10), task('热蜡', '已开始', 20), task('刮蜡', '未开始', 30), task('发板', '未开始', 90)]
  }))
  assert.deepEqual([running.label, running.cls, running.current], ['进行中 2/5', 'run', '热蜡'])
})

test('进度：当前任务按任务顺序取第一个没完成的，安全检查永远排最前；强行中止算已处理', () => {
  const p = rows.careProgress(care({
    tasks: [task('发板', '未开始', 90), task('刮蜡', '未开始', 30), task('修刃', '强行中止', 10), task('安全检查', '已完成', 50)]
  }))
  assert.deepEqual([p.label, p.current], ['进行中 2/4', '刮蜡'])
})

test('进度：发板完成才算已完成；只剩发板没做时当前是发板', () => {
  const done = rows.careProgress(care({ tasks: [task('修刃', '已完成', 10), task('发板', '已完成', 90)] }))
  assert.deepEqual([done.label, done.cls, done.current], ['已完成', 'done', ''])
  const last = rows.careProgress(care({ tasks: [task('修刃', '已完成', 10), task('发板', '未开始', 90)] }))
  assert.deepEqual([last.label, last.current], ['进行中 1/2', '发板'])
})

test('进度：取消的装备显示已取消（取消是靠发板任务落库的，不能显示成已完成）', () => {
  const p = rows.careProgress(care({ is_cancel: true, tasks: [task('修刃', '已完成', 10), task('发板', '已完成', 90)] }))
  assert.deepEqual([p.label, p.cls, p.current], ['已取消', 'cancel', ''])
})

test('进度：作废的任务不算', () => {
  const p = rows.careProgress(care({ tasks: [task('修刃', '已完成', 10), task('热蜡', '未开始', 20, { valid: 0 }), task('发板', '未开始', 90)] }))
  assert.equal(p.label, '进行中 1/2')
})

test('照片取第一张的缩略图，补图片域名；已是完整地址的原样用；没有就为空', () => {
  const img = u => ({ image: { thumbUrl: u } })
  assert.equal(rows.buildCareRows([care({ careImages: [img('/upload/a.jpg'), img('/upload/b.jpg')] })], 'https://img.example')[0].thumb, 'https://img.example/upload/a.jpg')
  assert.equal(rows.buildCareRows([care({ careImages: [img('https://x.test/a.jpg')] })], 'https://img.example')[0].thumb, 'https://x.test/a.jpg')
  assert.equal(rows.buildCareRows([care({ careImages: [{ image: null }, img('/upload/b.jpg')] })], 'https://img.example')[0].thumb, 'https://img.example/upload/b.jpg')
  assert.equal(rows.buildCareRows([care()], 'https://img.example')[0].thumb, '')
})

test('每件装备一行：id、标题、项目、进度、照片都带上；没有装备返回空数组', () => {
  const [r] = rows.buildCareRows([care({ id: 7, need_edge: 1, tasks: [task('修刃', '已开始', 10), task('发板', '未开始', 90)] })], '')
  assert.equal(r.id, 7)
  assert.equal(r.title, 'ATOMIC · 170cm')
  assert.equal(r.kind, '双板')
  assert.deepEqual(r.services.map(s => s.text), ['修刃'])
  assert.deepEqual([r.statusLabel, r.statusClass, r.current], ['进行中 0/2', 'run', '修刃'])
  assert.deepEqual(rows.buildCareRows(null, ''), [])
  assert.deepEqual(rows.buildCareRows([], ''), [])
})

// ---- 每件装备的金额 / 减免 ----
const amounts = c => { const [r] = rows.buildCareRows([care(c)], ''); return [r.chargeStr, r.discountStr] }

test('金额 / 减免：后端没给展示值时（老后端）按库里的值算——金额 = 项目收费 + 附加费，减免 = 手动减免 + 券减免', () => {
  assert.deepEqual(amounts({ common_charge: 168, repair_charge: 20, discount: 30, ticket_discount: 20 }), ['¥188.00', '¥50.00'])
  assert.deepEqual(amounts({}), ['¥0.00', '¥0.00'])
  assert.deepEqual(amounts({ common_charge: null, repair_charge: undefined, discount: null }), ['¥0.00', '¥0.00'])
  assert.deepEqual(amounts({ common_charge: 0.1, repair_charge: 0.2, discount: 0.1, ticket_discount: 0.2 }), ['¥0.30', '¥0.30'])
})

test('金额 / 减免：后端给了展示值就用它（招待 / 质保装备库里是 0，后端按所做项目算出标准价、减免到 0 元）', () => {
  assert.deepEqual(amounts({ entertain: true, displayCharge: 168, displayDiscount: 168 }), ['¥168.00', '¥168.00'])
  assert.deepEqual(amounts({ warranty: true, repair_charge: 50, displayCharge: 170, displayDiscount: 170 }), ['¥170.00', '¥170.00'])
  assert.deepEqual(amounts({ common_charge: 100, displayCharge: 0, displayDiscount: 0 }), ['¥0.00', '¥0.00'])   // 展示值是 0 也是展示值
})

test('金额 / 减免：展示值不成对时不信，退回库里的值', () => {
  assert.deepEqual(amounts({ common_charge: 120, discount: 20, displayCharge: 168 }), ['¥120.00', '¥20.00'])
  assert.deepEqual(amounts({ common_charge: 120, discount: 20, displayCharge: null, displayDiscount: null }), ['¥120.00', '¥20.00'])
})

test('金额 / 减免：数字也带上，方便以后汇总', () => {
  const [r] = rows.buildCareRows([care({ entertain: true, displayCharge: 168, displayDiscount: 168 })], '')
  assert.deepEqual([r.charge, r.discount], [168, 168])
})

// ---- 页面：renderOrders 与折叠 ----
function orderWith(n) {
  const cares = []
  for (let i = 1; i <= n; i++) cares.push(care({ id: i, need_wax: 1 }))
  return {
    id: 1, code: 'WF_YH_261110_00002', biz_date: '2026-11-10T14:32:00', shop: '万龙服务中心',
    orderStatus: '支付成功', careProperties: { orderStatus: '正常订单', services: ' 热蜡' },
    cares, availablePayments: [], paidAmount: 300, refundAmount: 0, totalEarnAmount: 300
  }
}

function loadList() {
  global.getApp = () => ({ globalData: {} })
  global.wx = {}
  const page = loadPage('pages/admin/care/care_order_list.js', { IMAGE_HOST: 'https://img.example' })
  delete global.getApp
  delete global.wx
  return page
}

test('列表渲染：装备行、装备数量；每一单的装备明细默认都是收起的（不管几件）', () => {
  const page = loadList()
  page.renderOrders([orderWith(2), orderWith(5)], 2, 1, 50)
  const [two, five] = page.data.orders
  assert.equal(two.careCount, 2)
  assert.equal(two.careRows.length, 2)
  assert.equal(two.careExpanded, false)
  assert.equal(five.careCount, 5)
  assert.equal(five.careRows.length, 5)
  assert.equal(five.careExpanded, false)
})

test('点「装备 N 件」标题展开、再点收起；只影响点的那一单', () => {
  const page = loadList()
  page.renderOrders([orderWith(2), orderWith(5)], 2, 1, 50)
  page.onToggleCares(tap({ idx: '1' }))
  assert.equal(page.data.orders[0].careExpanded, false)
  assert.equal(page.data.orders[1].careExpanded, true)
  page.onToggleCares(tap({ idx: '1' }))
  assert.equal(page.data.orders[1].careExpanded, false)
})

test('从详情返回重新加载列表后，已展开的订单保持展开，其余仍收起', () => {
  const page = loadList()
  const first = orderWith(2), second = Object.assign(orderWith(2), { id: 2, code: 'WF_YH_261110_00003' })
  page.renderOrders([first, second], 2, 1, 50)
  page.onToggleCares(tap({ idx: '1' }))               // 展开第二单
  const reloaded = [Object.assign(orderWith(2), { id: 3, code: 'WF_YH_261110_00004' }), orderWith(2), Object.assign(orderWith(2), { id: 2, code: 'WF_YH_261110_00003' })]
  page.renderOrders(reloaded, 3, 1, 50)               // onShow 重查：顺序变了，还来了新订单
  assert.deepEqual(page.data.orders.map(o => [o.id, o.careExpanded]), [[3, false], [1, false], [2, true]])
})

test('收起后再重新加载，不会又变成展开', () => {
  const page = loadList()
  page.renderOrders([orderWith(2)], 1, 1, 50)
  page.onToggleCares(tap({ idx: '0' }))
  page.onToggleCares(tap({ idx: '0' }))
  page.renderOrders([orderWith(2)], 1, 1, 50)
  assert.equal(page.data.orders[0].careExpanded, false)
})

test('没有装备的临时订单没有装备行，不报错', () => {
  const page = loadList()
  page.renderOrders([Object.assign(orderWith(0), { careProperties: { orderStatus: '临时订单' } })], 1, 1, 50)
  assert.deepEqual(page.data.orders[0].careRows, [])
  assert.equal(page.data.orders[0].careCount, 0)
})

// ---- 版式：信息两列、显示开单店铺、左侧标签列保留、去掉被取代的行 ----
const wxml = fs.readFileSync(path.join(__dirname, '..', 'pages/admin/care/care_order_list.wxml'), 'utf8')
const cardBlock = wxml.slice(wxml.indexOf('<!-- 订单列表 -->'), wxml.indexOf('<!-- 列表底部分页 -->'))

test('订单卡片显示开单店铺，并且是订单信息里最上面的一行（在日期之前）', () => {
  assert.match(cardBlock, /开单店铺/)
  assert.match(cardBlock, /\{\{item\.shop/)
  assert.ok(cardBlock.indexOf('开单店铺') < cardBlock.indexOf('>日期<'), '开单店铺应排在日期之前')
  assert.ok(cardBlock.indexOf('开单店铺') > cardBlock.indexOf('class="info-grid"'), '开单店铺应在订单信息区内')
  assert.match(cardBlock, /info-cell--full/)
})

test('订单卡片仍保留最左侧标签列和手机号复制按钮', () => {
  assert.match(cardBlock, /class="tag-col"/)
  assert.match(cardBlock, /<phone-copy phone="\{\{item\.customerCell\}\}"/)
})

test('订单信息两列：原来的装备数量、项目两行由每件装备取代，日期和时间合并', () => {
  assert.doesNotMatch(cardBlock, /装备数量/)
  assert.doesNotMatch(cardBlock, />项目</)
  assert.doesNotMatch(cardBlock, />时间</)
  assert.match(cardBlock, /info-cell/)
  assert.match(cardBlock, /装备 \{\{item\.careCount\}\} 件/)
})

test('折叠按钮不触发进详情（catchtap）', () => {
  assert.match(cardBlock, /catchtap="onToggleCares"/)
})

test('「装备 N 件」那一行就是折叠开关：带订单下标、显示展开 / 收起', () => {
  const title = cardBlock.match(/<view class="care-section-title"[^>]*>[\s\S]*?<\/view>/)[0]
  assert.match(title, /catchtap="onToggleCares"/)
  assert.match(title, /data-idx="\{\{index\}\}"/)
  assert.match(title, /装备 \{\{item\.careCount\}\} 件/)
  assert.match(title, /item\.careExpanded \? '收起' : '展开'/)
})

test('装备明细只在展开时渲染；原来「还有 N 件装备」的局部折叠已被整体折叠取代', () => {
  assert.match(cardBlock, /<view wx:if="\{\{item\.careExpanded\}\}" class="care-line">/)
  assert.doesNotMatch(cardBlock, /careHiddenCount|care-more|cr\.folded/)
})

// ---- 点图看大图 ----
test('装备行带上这件装备所有照片的原图地址（缩略图只用来显示）', () => {
  const img = (full, thumb) => ({ image: { file_path_name: full, thumbUrl: thumb } })
  const [r] = rows.buildCareRows([care({ careImages: [img('/upload/a.jpg', '/upload/a_t.jpg'), { image: null }, img('https://x.test/b.jpg', 'https://x.test/b_t.jpg')] })], 'https://img.example')
  assert.equal(r.thumb, 'https://img.example/upload/a_t.jpg')
  assert.deepEqual(r.photos, ['https://img.example/upload/a.jpg', 'https://x.test/b.jpg'])
  assert.deepEqual(rows.buildCareRows([care({ careImages: [{ image: { thumbUrl: '/upload/c_t.jpg' } }] })], 'https://img.example')[0].photos, ['https://img.example/upload/c_t.jpg'])
  assert.deepEqual(rows.buildCareRows([care()], 'https://img.example')[0].photos, [])
})

function withPhotos(n) {
  const order = orderWith(2)
  order.cares[1].careImages = [
    { image: { file_path_name: '/upload/big1.jpg', thumbUrl: '/upload/t1.jpg' } },
    { image: { file_path_name: '/upload/big2.jpg', thumbUrl: '/upload/t2.jpg' } }
  ]
  return order
}

test('点装备照片用原图预览这件装备的全部照片，从第一张开始', () => {
  const page = loadList()
  page.renderOrders([orderWith(1), withPhotos()], 2, 1, 50)
  const calls = []
  global.wx = { previewImage: arg => calls.push(arg) }
  try {
    page.onCarePhotoTap(tap({ idx: '1', cid: '2' }))
  } finally {
    delete global.wx
  }
  assert.deepEqual(calls, [{ current: 'https://img.example/upload/big1.jpg', urls: ['https://img.example/upload/big1.jpg', 'https://img.example/upload/big2.jpg'] }])
})

test('点照片找不到装备或这件没有照片时什么也不做', () => {
  const page = loadList()
  page.renderOrders([withPhotos()], 1, 1, 50)
  const calls = []
  global.wx = { previewImage: arg => calls.push(arg) }
  try {
    page.onCarePhotoTap(tap({ idx: '0', cid: '999' }))
    page.onCarePhotoTap(tap({ idx: '0', cid: '1' }))
    page.onCarePhotoTap(tap({ idx: '5', cid: '1' }))
  } finally {
    delete global.wx
  }
  assert.deepEqual(calls, [])
})

test('照片点击不进详情（catchtap），且内层循环自己命名下标，不盖掉订单下标', () => {
  assert.match(cardBlock, /<image[^>]*catchtap="onCarePhotoTap"/)
  assert.match(cardBlock, /<image[^>]*data-idx="\{\{index\}\}"/)
  assert.match(cardBlock, /<image[^>]*data-cid="\{\{cr\.id\}\}"/)
  assert.match(cardBlock, /wx:for="\{\{item\.careRows\}\}"[^>]*wx:for-index="ci"/)
})


// ---- 版式：装备图标放在订单标签那一列 ----
// 数 <view> 嵌套深度：target 标记出现的位置，是否还在 container 起始标记所开的 view 里面
function insideView(block, containerMarker, targetMarker) {
  const start = block.indexOf(containerMarker)
  const target = block.indexOf(targetMarker)
  assert.ok(start >= 0 && target >= 0, '找不到标记 ' + containerMarker + ' / ' + targetMarker)
  let depth = 0
  const tokens = /<view\b|<\/view>/g
  tokens.lastIndex = start
  let m
  while ((m = tokens.exec(block)) && m.index < target) depth += m[0] === '</view>' ? -1 : 1
  return depth > 0
}

test('装备区在右侧详情列（order-rows）外面，才能让图标落到订单标签那一列', () => {
  assert.equal(insideView(cardBlock, 'class="order-body"', 'class="care-section"'), false)
  assert.equal(insideView(cardBlock, 'class="order-rows"', 'class="care-section"'), false)
  assert.ok(cardBlock.indexOf('class="care-section"') > cardBlock.indexOf('class="order-body"'), '装备区应在订单信息之后')
})

test('每件装备前面有一格图标列：双板 / 单板才显示图标，图标在内容之前、不是文字', () => {
  const line = cardBlock.match(/<view wx:if="\{\{item\.careExpanded\}\}" class="care-line">[\s\S]*?<view class="care-main">/)[0]
  assert.match(line, /<view class="care-icon-col">/)
  assert.match(line, /<image wx:if="\{\{cr\.iconSrc\}\}" class="care-kind" src="\{\{cr\.iconSrc\}\}"/)
  assert.match(line, /mode="aspectFit"/)
  assert.ok(line.indexOf('care-icon-col') < line.length, '图标列在装备内容之前')
})

const wxss = fs.readFileSync(path.join(__dirname, '..', 'pages/admin/care/care_order_list.wxss'), 'utf8')
function rule(selector) {
  const m = wxss.match(new RegExp('(?:^|\\n)' + selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}'))
  assert.ok(m, 'wxss 里没有 ' + selector)
  return m[1]
}
const num = (css, prop) => Number((css.match(new RegExp(prop + ':\\s*(\\d+)rpx')) || [])[1])

test('图标列和订单标签列一样宽、一样的右间距，图标才和订单图标上下对齐成一列', () => {
  const tagCol = rule('.tag-col'), iconCol = rule('.care-icon-col')
  assert.equal(num(iconCol, 'width'), num(tagCol, 'width'))
  assert.equal(num(iconCol, 'margin-right'), num(tagCol, 'margin-right'))
  assert.ok(num(iconCol, 'width') > 0)
})

test('「装备 N 件」标题的内容从右侧详情列的左边缘开始（左边让出标签列的位置）', () => {
  const tagCol = rule('.tag-col'), title = rule('.care-section-title')
  assert.equal(num(title, 'padding-left'), num(tagCol, 'width') + num(tagCol, 'margin-right'))
})

test('没付款的灰色订单：装备图标同样置灰', () => {
  assert.match(wxss, /\.order-card--unpaid \.care-kind\s*\{[^}]*(opacity|grayscale)/)
})


// ---- 版式：每件装备显示金额和减免（招待 / 质保也显示） ----
test('每件装备都有「金额」「减免」一行（在装备内容里面），没有按招待 / 质保 / 金额是否为 0 隐藏的条件', () => {
  assert.equal(insideView(cardBlock, 'class="care-main"', 'class="care-amount"'), true)
  const amountRow = cardBlock.match(/<view class="care-amount"[^>]*>[\s\S]*?<\/view>/)[0]
  assert.match(amountRow, />金额<[\s\S]*\{\{cr\.chargeStr\}\}/)
  assert.match(amountRow, />减免<[\s\S]*\{\{cr\.discountStr\}\}/)
  assert.doesNotMatch(amountRow, /wx:if/)
})

test('没付款的灰色订单：金额 / 减免也置灰', () => {
  assert.match(wxss, /\.order-card--unpaid \.care-amount[^{]*\{[^}]*#b0b0b0/)
})

// ---- 次卡：用次卡的装备显示「用的哪张卡、还剩几次」（金额 / 减免照常显示库里的 0） ----
// 卡名和剩余次数分开给：卡名太长时只让卡名省略，剩余次数始终显示
test('次卡装备：显示卡名和剩余次数；后端给的 cardDisplayName / cardRemaining 优先', () => {
  const row = rows.buildCareRows([care({ use_card: true, card_name: '装备上记的卡名', cardDisplayName: '孙伟博学员专用', cardRemaining: 5 })], '')[0]
  assert.equal(row.usesCard, true)
  assert.equal(row.cardName, '孙伟博学员专用')
  assert.equal(row.cardRemain, '剩余 5 次')
})

test('次卡装备：没有 cardDisplayName 时退回装备上记的 card_name', () => {
  const row = rows.buildCareRows([care({ use_card: true, card_name: '装备上记的卡名', cardRemaining: 3 })], '')[0]
  assert.equal(row.cardName, '装备上记的卡名')
  assert.equal(row.cardRemain, '剩余 3 次')
})

test('次卡装备：剩余 0 次也要显示（0 不是没有）；季卡不限次数', () => {
  const zero = rows.buildCareRows([care({ use_card: true, cardDisplayName: '次卡A', cardRemaining: 0 })], '')[0]
  assert.equal(zero.cardRemain, '剩余 0 次')
  const season = rows.buildCareRows([care({ use_card: true, cardDisplayName: '机打蜡季卡', cardUnlimited: true })], '')[0]
  assert.equal(season.cardName, '机打蜡季卡')
  assert.equal(season.cardRemain, '不限次数')
})

test('次卡装备：没有卡名只有次数、或者两样都没有（购卡处理中 / 读卡失败）时也标出用了次卡，不报错', () => {
  const onlyRemaining = rows.buildCareRows([care({ use_card: true, cardRemaining: 2 })], '')[0]
  assert.equal(onlyRemaining.usesCard, true)
  assert.equal(onlyRemaining.cardName, '')
  assert.equal(onlyRemaining.cardRemain, '剩余 2 次')
  const neither = rows.buildCareRows([care({ use_card: true })], '')[0]
  assert.equal(neither.usesCard, true)
  assert.equal(neither.cardName, '')
  assert.equal(neither.cardRemain, '')
})

test('没用次卡的装备：不显示次卡信息，即使数据里带着卡名', () => {
  const row = rows.buildCareRows([care({ use_card: false, card_name: '不该显示', cardRemaining: 4 })], '')[0]
  assert.equal(row.usesCard, false)
  assert.equal(row.cardName, '')
  assert.equal(row.cardRemain, '')
})

test('次卡装备的金额 / 减免仍是库里的值：0 就显示 ¥0.00，不补价', () => {
  const row = rows.buildCareRows([care({ use_card: true, common_charge: 0, repair_charge: 0, discount: 0, ticket_discount: 0, displayCharge: 0, displayDiscount: 0 })], '')[0]
  assert.equal(row.chargeStr, '¥0.00')
  assert.equal(row.discountStr, '¥0.00')
})

test('版式：次卡一行在金额 / 减免下面、装备内容里面，只在用了次卡时才渲染；卡名和剩余次数分开两段', () => {
  assert.equal(insideView(cardBlock, 'class="care-main"', 'class="care-card"'), true)
  const cardRow = cardBlock.match(/<view[^>]*class="care-card"[^>]*>[\s\S]*?<\/view>/)[0]
  assert.match(cardRow, /wx:if="\{\{cr\.usesCard\}\}"/)
  assert.match(cardRow, /次卡/)
  assert.match(cardRow, /class="care-card-name"[^>]*>\{\{cr\.cardName\}\}/)
  assert.match(cardRow, /class="care-card-remain"[^>]*>\{\{cr\.cardRemain\}\}/)
  assert.ok(cardBlock.indexOf('class="care-amount"') < cardBlock.indexOf('class="care-card"'), '次卡一行在金额 / 减免之后')
})

test('版式：卡名太长只省略卡名，剩余次数不收缩；没付款的灰色订单里同样置灰', () => {
  assert.match(wxss, /\.care-card\s*\{/)
  assert.match(rule('.care-card-name'), /text-overflow:\s*ellipsis/)
  assert.match(rule('.care-card-remain'), /flex:\s*none/)
  assert.match(wxss, /\.order-card--unpaid \.care-card[^{]*\{[^}]*#b0b0b0/)
})
