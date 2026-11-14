// 养护订单列表：每件装备一块（品牌 / 长度 / 项目 / 照片 / 养护进度），订单信息排成两列并显示开单门店
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

const stageOf = c => { const p = rows.careProgress(care(c)); return [p.label, p.cls] }

test('进度阶段 ①：没有任务、只做了安全检查、安全检查都没做 → 未开始（灰）', () => {
  assert.deepEqual(stageOf(), ['未开始', 'idle'])                                  // 没有任务链（没付款还没生成）
  assert.deepEqual(stageOf({ tasks: [task('安全检查', '未开始', 1), task('修刃', '未开始', 10), task('发板', '未开始', 90)] }), ['未开始', 'idle'])   // 安全检查都没做
  assert.deepEqual(stageOf({ tasks: [task('安全检查', '已完成', 1), task('修刃', '未开始', 10), task('热蜡', '未开始', 20), task('发板', '未开始', 90)] }), ['未开始', 'idle'])   // 只做了安全检查
  assert.deepEqual(stageOf({ tasks: [task('安全检查', '已完成', 1), task('发板', '未开始', 90)] }), ['未开始', 'idle'])   // 没有别的工序，只有安全检查和发板
})

test('进度阶段 ②：安全检查、发板之外的任务有做了的、有没做的（含正在做）→ 进行中（琥珀）', () => {
  assert.deepEqual(stageOf({ tasks: [task('安全检查', '已完成', 1), task('修刃', '已完成', 10), task('热蜡', '未开始', 20), task('刮蜡', '未开始', 30), task('发板', '未开始', 90)] }), ['进行中', 'run'])
  assert.deepEqual(stageOf({ tasks: [task('安全检查', '已完成', 1), task('修刃', '已完成', 10), task('热蜡', '已开始', 20), task('发板', '未开始', 90)] }), ['进行中', 'run'])
  assert.deepEqual(stageOf({ tasks: [task('安全检查', '已完成', 1), task('维修', '已开始', 30), task('发板', '未开始', 90)] }), ['进行中', 'run'])   // 只有一个工序且正在做
  assert.deepEqual(stageOf({ tasks: [task('安全检查', '未开始', 1), task('修刃', '已开始', 10), task('发板', '未开始', 90)] }), ['进行中', 'run'])   // 安全检查没做、工序已经动了，以工序为准
  assert.deepEqual(stageOf({ tasks: [task('安全检查', '已完成', 1), task('修刃', '强行中止', 10), task('热蜡', '未开始', 20), task('发板', '未开始', 90)] }), ['进行中', 'run'])   // 强行中止算做完
})

test('进度阶段 ③：除发板外的任务都做完了，只差发板 → 待发板（紫）', () => {
  assert.deepEqual(stageOf({ tasks: [task('安全检查', '已完成', 1), task('修刃', '已完成', 10), task('热蜡', '已完成', 20), task('刮蜡', '已完成', 30), task('发板', '未开始', 90)] }), ['待发板', 'ready'])
  assert.deepEqual(stageOf({ tasks: [task('安全检查', '已完成', 1), task('修刃', '强行中止', 10), task('热蜡', '已完成', 20), task('发板', '未开始', 90)] }), ['待发板', 'ready'])
  assert.deepEqual(stageOf({ tasks: [task('安全检查', '已完成', 1), task('修刃', '已完成', 10), task('发板', '已开始', 90)] }), ['待发板', 'ready'])   // 发板正在办也还没完成
})

test('进度阶段 ④：发板完成 → 已完成（绿）；强行索回完成同样算', () => {
  assert.deepEqual(stageOf({ tasks: [task('安全检查', '已完成', 1), task('修刃', '已完成', 10), task('发板', '已完成', 90)] }), ['已完成', 'done'])
  assert.deepEqual(stageOf({ tasks: [task('修刃', '已完成', 10), task('发板', '已完成', 90)] }), ['已完成', 'done'])
  assert.deepEqual(stageOf({ tasks: [task('安全检查', '已完成', 1), task('修刃', '未开始', 10), task('强行索回', '已完成', 90)] }), ['已完成', 'done'])   // 工序没做完但被强行索回
})

test('进度阶段：任务顺序不影响（按名字判断，不按位置）；作废的任务不算', () => {
  assert.deepEqual(stageOf({ tasks: [task('发板', '未开始', 90), task('修刃', '已完成', 10), task('安全检查', '已完成', 50)] }), ['待发板', 'ready'])
  assert.deepEqual(stageOf({ tasks: [task('安全检查', '已完成', 1), task('修刃', '已完成', 10), task('热蜡', '未开始', 20, { valid: 0 }), task('发板', '未开始', 90)] }), ['待发板', 'ready'])
  assert.deepEqual(stageOf({ tasks: [task('安全检查', '已完成', 1), task('修刃', '未开始', 10, { valid: 0 }), task('发板', '已完成', 90, { valid: 0 })] }), ['未开始', 'idle'])
})

test('进度阶段：取消的装备显示已取消（取消是靠发板任务落库的，不能显示成已完成）', () => {
  assert.deepEqual(stageOf({ is_cancel: true, tasks: [task('修刃', '已完成', 10), task('发板', '已完成', 90)] }), ['已取消', 'cancel'])
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
  assert.deepEqual([r.statusLabel, r.statusClass], ['进行中', 'run'])
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

// ---- 版式：信息两列、显示开单门店、左侧标签列保留、去掉被取代的行 ----
const wxml = fs.readFileSync(path.join(__dirname, '..', 'pages/admin/care/care_order_list.wxml'), 'utf8')
const cardBlock = wxml.slice(wxml.indexOf('<!-- 订单列表 -->'), wxml.indexOf('<!-- 列表底部分页 -->'))

test('订单卡片显示开单门店，并且是订单信息里最上面的一行（在日期之前）', () => {
  assert.match(cardBlock, /开单门店/)
  assert.match(cardBlock, /\{\{item\.shop/)
  assert.ok(cardBlock.indexOf('开单门店') < cardBlock.indexOf('>日期<'), '开单门店应排在日期之前')
  assert.ok(cardBlock.indexOf('开单门店') > cardBlock.indexOf('class="info-grid"'), '开单门店应在订单信息区内')
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
  assert.match(cardBlock, /<view wx:if="\{\{item\.careExpanded\}\}" class="care-line care-line--\{\{cr\.statusClass\}\}"[^>]*>/)
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
  const line = cardBlock.match(/<view wx:if="\{\{item\.careExpanded\}\}" class="care-line care-line--\{\{cr\.statusClass\}\}"[^>]*>[\s\S]*?<view class="care-main">/)[0]
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
  assert.match(wxss, /\.order-card--unpaid \.care-kind,\s*\.order-card--unpaid \.care-extra\s*\{[^}]*(opacity|grayscale)/)   // 含包 / 含杖的小图标一起置灰
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

test('版式：次卡一行在金额 / 减免上面、装备内容里面，只在用了次卡时才渲染；卡名和剩余次数分开两段', () => {
  assert.equal(insideView(cardBlock, 'class="care-main"', 'class="care-card"'), true)
  const cardRow = cardBlock.match(/<view[^>]*class="care-card"[^>]*>[\s\S]*?<\/view>/)[0]
  assert.match(cardRow, /wx:if="\{\{cr\.usesCard\}\}"/)
  assert.match(cardRow, /次卡/)
  assert.match(cardRow, /class="care-card-name"[^>]*>\{\{cr\.cardName\}\}/)
  assert.match(cardRow, /class="care-card-remain"[^>]*>\{\{cr\.cardRemain\}\}/)
  assert.ok(cardBlock.indexOf('class="care-card"') < cardBlock.indexOf('class="care-amount"'), '次卡一行在金额 / 减免之前（卡在上，金额在下）')
})

test('版式：卡名太长只省略卡名，剩余次数不收缩；没付款的灰色订单里同样置灰', () => {
  assert.match(wxss, /\.care-card\s*\{/)
  assert.match(rule('.care-card-name'), /text-overflow:\s*ellipsis/)
  assert.match(rule('.care-card-remain'), /flex:\s*none/)
  assert.match(wxss, /\.order-card--unpaid \.care-card[^{]*\{[^}]*#b0b0b0/)
})

test('次卡装备：显示卡号（卡 id，装备自带的 card_id）；卡号和卡名、剩余次数各自独立', () => {
  const row = rows.buildCareRows([care({ use_card: true, card_id: 62, cardDisplayName: '孙伟博学员专用', cardRemaining: 6 })], '')[0]
  assert.equal(row.cardNo, '卡号 62')
  assert.equal(row.cardName, '孙伟博学员专用')
  assert.equal(row.cardRemain, '剩余 6 次')
  // 同一张卡上先后用的两件装备：后端给的 cardRemaining 各不相同（6 / 5），行里原样显示，卡号相同
  const two = rows.buildCareRows([
    care({ id: 1, use_card: true, card_id: 62, cardDisplayName: '孙伟博学员专用', cardRemaining: 6 }),
    care({ id: 2, use_card: true, card_id: 62, cardDisplayName: '孙伟博学员专用', cardRemaining: 5 })
  ], '')
  assert.deepEqual(two.map(r => [r.cardNo, r.cardRemain]), [['卡号 62', '剩余 6 次'], ['卡号 62', '剩余 5 次']])
})

test('卡号：没绑上卡（card_id 空 / 0 / 不是数）不显示；没用次卡的装备不显示；字符串数字也认', () => {
  assert.equal(rows.buildCareRows([care({ use_card: true, card_id: null })], '')[0].cardNo, '')
  assert.equal(rows.buildCareRows([care({ use_card: true, card_id: 0 })], '')[0].cardNo, '')
  assert.equal(rows.buildCareRows([care({ use_card: true, card_id: 'abc' })], '')[0].cardNo, '')
  assert.equal(rows.buildCareRows([care({ use_card: true })], '')[0].cardNo, '')
  assert.equal(rows.buildCareRows([care({ use_card: false, card_id: 62 })], '')[0].cardNo, '')
  assert.equal(rows.buildCareRows([care({ use_card: true, card_id: '62' })], '')[0].cardNo, '卡号 62')
})

test('版式：卡号在卡名和剩余次数之间，有卡号才渲染', () => {
  const cardRow = cardBlock.match(/<view[^>]*class="care-card"[^>]*>[\s\S]*?<\/view>/)[0]
  assert.match(cardRow, /<text wx:if="\{\{cr\.cardNo\}\}" class="care-card-no">\{\{cr\.cardNo\}\}<\/text>/)
  assert.ok(cardRow.indexOf('care-card-name') < cardRow.indexOf('care-card-no') && cardRow.indexOf('care-card-no') < cardRow.indexOf('care-card-remain'))
  assert.match(rule('.care-card-no'), /flex:\s*none/)                                   // 卡名再长也不挤掉卡号
  assert.match(wxss, /\.order-card--unpaid \.care-card-no[^{]*\{[^}]*#b0b0b0/)          // 没付款的灰色订单里同样置灰
})

test('版式：照片盒子跟整块装备的高度走（次卡多一行时照片也跟着变高），照片铺满盒子，点击预览不变', () => {
  const imgBlock = cardBlock.match(/<view[^>]*class="care-thumb-box"[^>]*>[\s\S]*?<\/view>/)[0]
  assert.match(imgBlock, /wx:if="\{\{cr\.thumb\}\}"/)
  assert.match(imgBlock, /<image class="care-thumb"[^>]*mode="aspectFill"[^>]*catchtap="onCarePhotoTap"/)
  assert.equal(insideView(cardBlock, 'class="care-body"', 'class="care-thumb-box"'), true)
  const box = rule('.care-thumb-box')
  assert.match(box, /align-self:\s*stretch/)                  // 高度跟 .care-body 里最高的内容走，不写死
  assert.doesNotMatch(box, /(^|[;\s])height:/)
  assert.ok(num(box, 'min-height') >= 132, '没有多出内容时至少还是原来的 132rpx')
  assert.match(box, /position:\s*relative/)
  const img = rule('.care-thumb')
  assert.match(img, /position:\s*absolute/)
  assert.match(img, /width:\s*100%/)
  assert.match(img, /height:\s*100%/)
  assert.match(rule('.care-body'), /align-items:\s*stretch/)
})

// ───────────── 装备用的券 / 学员卡 / 质保 / 招待 ─────────────

test('用了券的装备：列出券名和券号；后端给 ticketDisplayName，没给显示「优惠券」', () => {
  const row = rows.buildCareRows([care({ ticket_code: '997053438', ticketDisplayName: '老顾客优惠券', discount: 230, common_charge: 230 })], '')[0]
  assert.equal(row.usesTicket, true)
  assert.equal(row.ticketName, '老顾客优惠券')
  assert.equal(row.ticketNo, '券号 997053438')
  assert.equal(row.chargeStr, '¥230.00')       // 金额 / 减免照常
  assert.equal(row.discountStr, '¥230.00')
  const noName = rows.buildCareRows([care({ ticket_code: 'T-GONE' })], '')[0]
  assert.equal(noName.ticketName, '优惠券')
  assert.equal(noName.ticketNo, '券号 T-GONE')
  const blank = rows.buildCareRows([care({ ticket_code: ' ' }), care({ ticket_code: null }), care()], '')
  assert.deepEqual(blank.map(r => [r.usesTicket, r.ticketName, r.ticketNo]), [[false, '', ''], [false, '', ''], [false, '', '']])
})

test('用了学员卡的装备：列出「某某教练的学员卡」和卡号；没给名字显示「学员卡」', () => {
  const row = rows.buildCareRows([care({ coach_card_id: 21, coachCardDisplayName: '张教练的学员卡' })], '')[0]
  assert.equal(row.usesCoachCard, true)
  assert.equal(row.coachName, '张教练的学员卡')
  assert.equal(row.coachNo, '卡号 21')
  const noName = rows.buildCareRows([care({ coach_card_id: 21 })], '')[0]
  assert.equal(noName.coachName, '学员卡')
  const none = rows.buildCareRows([care({ coach_card_id: null }), care({ coach_card_id: 0 }), care()], '')
  assert.deepEqual(none.map(r => [r.usesCoachCard, r.coachName, r.coachNo]), [[false, '', ''], [false, '', ''], [false, '', '']])
})

test('质保 / 招待：装备自带的标记各出一个标签，都没有就没有', () => {
  const [w, e, both, none] = rows.buildCareRows([care({ warranty: true }), care({ entertain: true }), care({ warranty: true, entertain: true }), care()], '')
  assert.deepEqual([w.isWarranty, w.isEntertain, w.hasFlag], [true, false, true])
  assert.deepEqual([e.isWarranty, e.isEntertain, e.hasFlag], [false, true, true])
  assert.deepEqual([both.isWarranty, both.isEntertain, both.hasFlag], [true, true, true])
  assert.deepEqual([none.isWarranty, none.isEntertain, none.hasFlag], [false, false, false])
  assert.equal(rows.buildCareRows([care({ warranty: 1 })], '')[0].isWarranty, true)   // 老接口给 0 / 1
})

test('不管订单里有几件装备、各用什么：每件各列各的，互不串', () => {
  const list = rows.buildCareRows([
    care({ id: 1, use_card: true, card_id: 62, cardDisplayName: '孙伟博学员专用', cardRemaining: 6 }),
    care({ id: 2, ticket_code: '997053438', ticketDisplayName: '老顾客优惠券' }),
    care({ id: 3, coach_card_id: 21, coachCardDisplayName: '张教练的学员卡' }),
    care({ id: 4, warranty: true }),
    care({ id: 5, entertain: true, ticket_code: 'X1' }),
    care({ id: 6 })
  ], '')
  assert.deepEqual(list.map(r => [r.usesCard, r.usesTicket, r.usesCoachCard, r.hasFlag]), [
    [true, false, false, false], [false, true, false, false], [false, false, true, false],
    [false, false, false, true], [false, true, false, true], [false, false, false, false]
  ])
})

test('版式：权益都在金额 / 减免上面；质保 / 招待、次卡、券、学员卡各一行，各自只在有时才渲染，券和学员卡不依赖次卡', () => {
  const amountAt = cardBlock.indexOf('class="care-amount"')
  const flags = cardBlock.match(/<view[^>]*class="care-card care-flags"[^>]*>[\s\S]*?<\/view>/)[0]
  assert.match(flags, /wx:if="\{\{cr\.hasFlag\}\}"/)
  assert.match(flags, /<text wx:if="\{\{cr\.isWarranty\}\}" class="care-card-tag care-card-tag--warranty">质保<\/text>/)
  assert.match(flags, /<text wx:if="\{\{cr\.isEntertain\}\}" class="care-card-tag care-card-tag--entertain">招待<\/text>/)
  const ticket = cardBlock.match(/<view[^>]*class="care-card care-ticket"[^>]*>[\s\S]*?<\/view>/)[0]
  assert.match(ticket, /wx:if="\{\{cr\.usesTicket\}\}"/)
  assert.match(ticket, /care-card-tag--ticket">券<\/text>/)
  assert.match(ticket, /class="care-card-name">\{\{cr\.ticketName\}\}/)
  assert.match(ticket, /class="care-card-no">\{\{cr\.ticketNo\}\}/)
  const coach = cardBlock.match(/<view[^>]*class="care-card care-coach"[^>]*>[\s\S]*?<\/view>/)[0]
  assert.match(coach, /wx:if="\{\{cr\.usesCoachCard\}\}"/)
  assert.match(coach, /care-card-tag--coach">学员卡<\/text>/)
  assert.match(coach, /class="care-card-name">\{\{cr\.coachName\}\}/)
  assert.match(coach, /class="care-card-no">\{\{cr\.coachNo\}\}/)
  for (const m of ['class="care-card care-flags"', 'class="care-card"', 'class="care-card care-ticket"', 'class="care-card care-coach"']) {
    assert.ok(cardBlock.indexOf(m) > cardBlock.indexOf('class="care-progress"') && cardBlock.indexOf(m) < amountAt, m + ' 在进度之后、金额之前')
    assert.equal(insideView(cardBlock, 'class="care-main"', m), true)
  }
  assert.equal(cardBlock.match(/class="care-card"/g).length, 1, '次卡行只有一行；券 / 学员卡 / 标签行各有自己的类')
})

test('版式：标签配色和订单左侧标签一致（次卡蓝 / 券橙 / 质保青 / 招待琥珀），没付款的灰色订单里标签也置灰', () => {
  assert.match(rule('.care-card-tag'), /#dbeafe/)
  assert.match(wxss, /\.care-card-tag--ticket\s*\{[^}]*#ffedd5[^}]*#c2410c/)
  assert.match(wxss, /\.care-card-tag--warranty\s*\{[^}]*#cffafe[^}]*#0e7490/)
  assert.match(wxss, /\.care-card-tag--entertain\s*\{[^}]*#fef3c7[^}]*#92400e/)
  assert.match(wxss, /\.care-card-tag--coach\s*\{/)
  assert.match(wxss, /\.order-card--unpaid \.care-card-tag\s*\{[^}]*background:\s*#f3f4f6/)
})

// ───────────── 任务进度：列出全部任务，做完绿 / 正在做红 / 没开始灰 ─────────────

const mkTask = (id, name, status, sort, extra) => Object.assign({ id, task_name: name, status, sort, valid: 1 }, extra || {})

test('任务进度：全部任务按先后列出，各自按状态着色（实录：安全检查已完成 / 维修已开始 / 发板未开始）', () => {
  const row = rows.buildCareRows([care({ tasks: [mkTask(59302, '发板', '未开始', 60), mkTask(59301, '维修', '已开始', 30), mkTask(59300, '安全检查', '已完成', 10)] })], '')[0]
  assert.deepEqual(row.tasks.map(t => [t.name, t.cls, t.flag]), [['安全检查', 'done', ''], ['维修', 'run', ''], ['发板', 'idle', '']])
  assert.deepEqual([row.statusLabel, row.statusClass], ['进行中', 'run'])   // 阶段色块：安全检查做完、维修在做 → 进行中
})

test('任务进度：安全检查永远排第一；作废的任务不列；没有状态按未开始，不认识的状态按正在做', () => {
  const row = rows.buildCareRows([care({ tasks: [
    mkTask(3, '热蜡', '未开始', 40),
    mkTask(2, '修刃', '', 20),
    mkTask(1, '安全检查', '已完成', 90),                       // sort 再大也排第一
    mkTask(4, '刮蜡', '已开始', 50, { valid: 0 }),             // 作废的不列
    mkTask(5, '机打蜡', '进行中', 45),                          // 不认识的非「未开始」状态按正在做
    mkTask(6, '发板', '未开始', 60)
  ] })], '')[0]
  assert.deepEqual(row.tasks.map(t => [t.name, t.cls]), [['安全检查', 'done'], ['修刃', 'idle'], ['热蜡', 'idle'], ['机打蜡', 'run'], ['发板', 'idle']])
})

test('任务进度：强行中止算做完（绿），名字后标「中止」；已完成的不标', () => {
  const row = rows.buildCareRows([care({ tasks: [mkTask(1, '安全检查', '已完成', 10), mkTask(2, '刮蜡', '强行中止', 50), mkTask(3, '发板', '已完成', 60)] })], '')[0]
  assert.deepEqual(row.tasks.map(t => [t.name, t.cls, t.flag]), [['安全检查', 'done', ''], ['刮蜡', 'done', '中止'], ['发板', 'done', '']])
})

test('任务进度：没有任务（还没生效）只有「未开始」色块；已取消是「已取消」色块，任务照常列出', () => {
  const none = rows.buildCareRows([care({ tasks: [] }), care()], '')
  assert.deepEqual(none.map(r => [r.tasks.length, r.statusLabel, r.statusClass]), [[0, '未开始', 'idle'], [0, '未开始', 'idle']])
  const cancelled = rows.buildCareRows([care({ is_cancel: true, tasks: [mkTask(1, '安全检查', '已完成', 10), mkTask(2, '发板', '已完成', 60)] })], '')[0]
  assert.deepEqual([cancelled.statusLabel, cancelled.statusClass, cancelled.tasks.length], ['已取消', 'cancel', 2])
})

test('任务进度：任务没有 id 也有稳定的 key（wx:key 不重复）', () => {
  const row = rows.buildCareRows([care({ tasks: [{ task_name: '修刃', status: '已完成', sort: 20 }, { task_name: '发板', status: '未开始', sort: 60 }] })], '')[0]
  assert.equal(new Set(row.tasks.map(t => t.key)).size, 2)
})

test('版式：进度行左边是阶段色块、后面用 wx:for 列出全部任务，不再有「当前：」', () => {
  const block = cardBlock.match(/<view class="care-progress">[\s\S]*?<\/view>/)[0]
  assert.match(block, /^<view class="care-progress">\s*<text class="progress-chip progress-chip--\{\{cr\.statusClass\}\}">\{\{cr\.statusLabel\}\}<\/text>/)   // 色块一直显示，在任务前面
  assert.doesNotMatch(block, /showStatusChip/)
  assert.match(block, /wx:for="\{\{cr\.tasks\}\}"[^>]*wx:key="key"/)
  assert.match(block, /class="care-task care-task--\{\{tk\.cls\}\}">\{\{tk\.name\}\}/)
  assert.match(block, /<text wx:if="\{\{tk\.flag\}\}" class="care-task-flag">\{\{tk\.flag\}\}<\/text>/)
  assert.match(block, /<text wx:if="\{\{ti > 0\}\}" class="care-task-sep">/)
  assert.doesNotMatch(block, /当前/)
  assert.ok(cardBlock.indexOf('class="care-progress"') < cardBlock.indexOf('class="care-card care-flags"'), '任务进度在权益行上面')
})

test('版式：做完绿字、正在做红字、没开始灰字；可换行；没付款的灰色订单里同样置灰', () => {
  assert.match(rule('.care-task--done'), /#16a34a/)
  assert.match(rule('.care-task--run'), /#dc2626/)
  assert.match(rule('.care-task--idle'), /#9ca3af/)
  assert.match(rule('.care-progress'), /flex-wrap:\s*wrap/)
  assert.match(wxss, /\.order-card--unpaid \.care-task\b[^{]*\{[^}]*#b0b0b0/)
})

test('版式：进度文字标签是白底药丸，文字颜色跟阶段走（未开始灰 / 进行中琥珀 / 待发板紫 / 已完成绿 / 已取消红）；没付款的订单里置灰', () => {
  assert.match(rule('.progress-chip'), /background:\s*#fff\b/)
  const color = sel => (rule(sel).match(/color:\s*(#[0-9a-f]{6})/) || [])[1]
  const base = color('.progress-chip')
  assert.equal(base, '#6b7280')
  assert.equal(color('.progress-chip--run'), '#b45309')
  assert.equal(color('.progress-chip--ready'), '#6d28d9')
  assert.equal(color('.progress-chip--done'), '#15803d')
  assert.equal(color('.progress-chip--cancel'), '#b91c1c')
  assert.equal(new Set([base, color('.progress-chip--run'), color('.progress-chip--ready'), color('.progress-chip--done')]).size, 4)
  assert.match(wxss, /\.order-card--unpaid \.progress-chip\s*\{[^}]*#b0b0b0/)
})

// ───────────── 装备整块的背景色块（按进度分四种） ─────────────

test('背景色块：整块装备（图标列 + 内容 + 照片）的外层 .care-line 带阶段 class，图标列、内容、照片都在它里面', () => {
  const open = '<view wx:if="{{item.careExpanded}}" class="care-line care-line--{{cr.statusClass}}"'
  assert.ok(cardBlock.includes(open))
  assert.equal(insideView(cardBlock, 'class="care-line care-line--{{cr.statusClass}}"', 'class="care-icon-col"'), true)
  assert.equal(insideView(cardBlock, 'class="care-line care-line--{{cr.statusClass}}"', 'class="care-body"'), true)
  assert.equal(insideView(cardBlock, 'class="care-line care-line--{{cr.statusClass}}"', 'class="care-thumb-box"'), true)
})

test('背景色块：四种阶段底色各不相同（未开始灰蓝 / 进行中琥珀 / 待发板紫 / 已完成绿），已取消红；块有圆角和间距', () => {
  const bg = sel => (rule(sel).match(/background:\s*(#[0-9a-f]{6})/) || [])[1]
  const idle = bg('.care-line--idle')
  const run = bg('.care-line--run')
  const ready = bg('.care-line--ready')
  const done = bg('.care-line--done')
  const cancel = bg('.care-line--cancel')
  for (const c of [idle, run, ready, done, cancel]) assert.match(c, /^#[0-9a-f]{6}$/)
  assert.equal(new Set([idle, run, ready, done]).size, 4)
  assert.notEqual(cancel, idle)
  assert.equal(bg('.care-line'), idle)                           // 没有阶段 class 时也是未开始的底色
  assert.match(rule('.care-line'), /border-radius:\s*\d+rpx/)
  assert.match(rule('.care-line'), /margin:\s*8rpx -10rpx 0/)     // 块之间留空；色块左右各伸出 10rpx，内容仍和订单信息对齐
  assert.match(rule('.care-line'), /padding:\s*0 10rpx/)
  assert.doesNotMatch(rule('.care-body'), /border-top/)          // 块之间不再画虚线
})

test('背景色块：没付款的订单里不分阶段、统一浅灰', () => {
  for (const cls of ['', '--idle', '--run', '--ready', '--done', '--cancel']) {
    assert.match(wxss, new RegExp('\\.order-card--unpaid \\.care-line' + cls + '[,\\s{]'))
  }
  assert.match(wxss, /\.order-card--unpaid \.care-line--cancel\s*\{\s*background:\s*#f7f7f7;/)
})

test('背景色块：statusClass 与四种阶段一一对应（只做了安全检查 / 没任务 → idle；做了一部分 → run；只差发板 → ready；发板完成 → done）', () => {
  const cls = tasks => rows.buildCareRows([care({ tasks })], '')[0].statusClass
  assert.equal(cls([]), 'idle')
  assert.equal(cls([mkTask(1, '安全检查', '未开始', 10), mkTask(2, '修刃', '未开始', 20), mkTask(3, '发板', '未开始', 60)]), 'idle')
  assert.equal(cls([mkTask(1, '安全检查', '已完成', 10), mkTask(2, '修刃', '未开始', 20), mkTask(3, '发板', '未开始', 60)]), 'idle')
  assert.equal(cls([mkTask(1, '安全检查', '已完成', 10), mkTask(2, '修刃', '已完成', 20), mkTask(3, '热蜡', '未开始', 40), mkTask(4, '发板', '未开始', 60)]), 'run')
  assert.equal(cls([mkTask(1, '安全检查', '已完成', 10), mkTask(2, '修刃', '已完成', 20), mkTask(3, '热蜡', '已完成', 40), mkTask(4, '发板', '未开始', 60)]), 'ready')
  assert.equal(cls([mkTask(1, '安全检查', '已完成', 10), mkTask(2, '修刃', '已完成', 20), mkTask(3, '发板', '已完成', 60)]), 'done')
})

// ───────────── 没有权益行的装备补占位行，和用了卡 / 券的装备一样高 ─────────────

test('等高：hasBenefit —— 质保 / 招待、次卡、券、学员卡任一个都算有权益行，一个都没有才是 false', () => {
  const has = c => rows.buildCareRows([care(c)], '')[0].hasBenefit
  assert.equal(has({}), false)
  assert.equal(has({ warranty: true }), true)
  assert.equal(has({ entertain: true }), true)
  assert.equal(has({ use_card: true, cardDisplayName: '孙伟博学员专用', card_id: 62 }), true)
  assert.equal(has({ ticket_code: '598420371' }), true)
  assert.equal(has({ coach_card_id: 5 }), true)
})

test('等高：没有权益行的装备补一行看不见的占位，结构和真实的权益行一样、放在金额上面', () => {
  const ghost = cardBlock.match(/<view wx:if="\{\{!cr\.hasBenefit\}\}" class="care-card care-card--ghost">[\s\S]*?<\/view>/)[0]
  assert.match(ghost, /<text class="care-card-tag">/)                // 和真实权益行同样的标签结构 → 高度一样
  assert.match(rule('.care-card--ghost'), /visibility:\s*hidden/)    // 占位但看不见
  assert.ok(cardBlock.indexOf('care-card--ghost') > cardBlock.indexOf('class="care-card care-coach"'), '占位行在所有权益行之后')
  assert.ok(cardBlock.indexOf('care-card--ghost') < cardBlock.indexOf('class="care-amount"'), '占位行在金额 / 减免上面')
})

// ───────────── 「正在做」的红色：已开始只存在一小会儿，平时红色标在轮到的这一道 ─────────────

const clsOf = c => rows.buildCareRows([care(c)], '')[0].tasks.map(t => [t.name, t.cls])

test('红色：装备已动工、没有任务是已开始时，红色标在按顺序第一个没做完的任务（实录：热蜡做完、刮蜡还没点开始）', () => {
  assert.deepEqual(clsOf({ tasks: [mkTask(1, '安全检查', '已完成', 10), mkTask(2, '修刃', '已完成', 20), mkTask(3, '热蜡', '已完成', 40), mkTask(4, '刮蜡', '未开始', 50), mkTask(5, '发板', '未开始', 60)] }),
    [['安全检查', 'done'], ['修刃', 'done'], ['热蜡', 'done'], ['刮蜡', 'run'], ['发板', 'idle']])
})

test('红色：待发板的装备，红色标在发板（实录：修刃 / 热蜡 / 刮蜡都做完，只差发板）', () => {
  assert.deepEqual(clsOf({ tasks: [mkTask(1, '安全检查', '已完成', 10), mkTask(2, '修刃', '已完成', 20), mkTask(3, '热蜡', '已完成', 40), mkTask(4, '刮蜡', '已完成', 50), mkTask(5, '发板', '未开始', 60)] }),
    [['安全检查', 'done'], ['修刃', 'done'], ['热蜡', 'done'], ['刮蜡', 'done'], ['发板', 'run']])
})

test('红色：有任务是已开始的，红色只标已开始的，不再多标第一个没做完的', () => {
  assert.deepEqual(clsOf({ tasks: [mkTask(1, '安全检查', '已完成', 10), mkTask(2, '修刃', '未开始', 20), mkTask(3, '热蜡', '已开始', 40), mkTask(4, '发板', '未开始', 60)] }),
    [['安全检查', 'done'], ['修刃', 'idle'], ['热蜡', 'run'], ['发板', 'idle']])
})

test('红色：顺序按任务顺序，强行中止算做完被跳过，轮到的后面的任务仍是灰', () => {
  assert.deepEqual(clsOf({ tasks: [mkTask(5, '发板', '未开始', 90), mkTask(4, '刮蜡', '未开始', 30), mkTask(2, '修刃', '强行中止', 10), mkTask(1, '安全检查', '已完成', 50), mkTask(3, '热蜡', '未开始', 20)] }),
    [['安全检查', 'done'], ['修刃', 'done'], ['热蜡', 'run'], ['刮蜡', 'idle'], ['发板', 'idle']])
})

test('红色：还没动工（未开始）、已完成、已取消的装备没有红色', () => {
  const noRun = c => clsOf(c).every(([, cls]) => cls !== 'run')
  assert.equal(noRun({ tasks: [mkTask(1, '安全检查', '已完成', 10), mkTask(2, '修刃', '未开始', 20), mkTask(3, '发板', '未开始', 60)] }), true)     // 只做了安全检查
  assert.equal(noRun({ tasks: [mkTask(1, '安全检查', '未开始', 10), mkTask(2, '修刃', '未开始', 20), mkTask(3, '发板', '未开始', 60)] }), true)   // 安全检查都没做
  assert.equal(noRun({ tasks: [mkTask(1, '安全检查', '已完成', 10), mkTask(2, '修刃', '已完成', 20), mkTask(3, '发板', '已完成', 60)] }), true)     // 已完成
  assert.equal(noRun({ is_cancel: true, tasks: [mkTask(1, '安全检查', '已完成', 10), mkTask(2, '修刃', '未开始', 20), mkTask(3, '发板', '未开始', 60)] }), true)   // 已取消
  assert.equal(noRun({ tasks: [] }), true)
})

// ---- 备注：整单备注（订单的 memo）和单项备注（每件装备的 memo） ----
test('单项备注：取装备自己的 memo，去掉首尾空白；没写、空白、null 都是空，不会冒出 undefined', () => {
  const memoOf = extra => rows.buildCareRows([care(extra)], '')[0].memo
  assert.equal(memoOf({ memo: '  左脚固定器松，已紧固  ' }), '左脚固定器松，已紧固')
  assert.equal(memoOf({ memo: '' }), '')
  assert.equal(memoOf({ memo: '   ' }), '')
  assert.equal(memoOf({ memo: null }), '')
  assert.equal(memoOf({}), '')
})

test('单项备注只跟着自己那件装备走，不和整单备注混在一起', () => {
  const page = loadList()
  const order = Object.assign(orderWith(2), { memo: '客人下午三点取' })
  order.cares[0].memo = '板底有划痕，别磨太狠'
  page.renderOrders([order], 1, 1, 50)
  const [o] = page.data.orders
  assert.equal(o.memo, '客人下午三点取')
  assert.deepEqual(o.careRows.map(r => r.memo), ['板底有划痕，别磨太狠', ''])
})

test('模板：整单备注在订单信息下面、装备明细上面；单项备注在装备块里、金额 / 减免下面；都没写就不显示', () => {
  const orderMemo = cardBlock.match(/<view wx:if="\{\{item\.memo\}\}"[^>]*>[\s\S]*?<\/view>/)[0]
  assert.match(orderMemo, /备注：/)
  assert.doesNotMatch(orderMemo, /整单备注/, '订单信息区里的备注，标签直接写「备注：」，位置已经说明是整单的')
  assert.match(orderMemo, /\{\{item\.memo\}\}/)
  assert.ok(cardBlock.indexOf('class="info-grid"') < cardBlock.indexOf(orderMemo), '整单备注应在订单信息区下面')
  assert.ok(cardBlock.indexOf(orderMemo) < cardBlock.indexOf('class="care-section"'), '整单备注应在装备明细上面')
  const careMemo = cardBlock.match(/<view wx:if="\{\{cr\.memo\}\}"[^>]*>[\s\S]*?<\/view>/)[0]
  assert.match(careMemo, /备注：/)
  assert.doesNotMatch(careMemo, /单项备注/, '装备块里的备注，标签直接写「备注：」，位置已经说明是这件装备的')
  assert.match(careMemo, /\{\{cr\.memo\}\}/)
  const amount = cardBlock.indexOf('class="care-amount"')
  assert.ok(amount > 0 && cardBlock.indexOf(careMemo) > amount, '单项备注应在金额 / 减免下面')
  assert.ok(cardBlock.indexOf(careMemo) < cardBlock.indexOf('class="care-thumb-box"'), '单项备注应在这件装备的文字区里，不在照片盒里')
})

test('样式：两种备注都能折行（长内容不被截断），没付款的订单也跟着变灰', () => {
  assert.match(wxss, /\.care-memo-text\s*\{[^}]*word-break:\s*break-all/)
  assert.match(wxss, /\.order-memo \.row-value\s*\{[^}]*word-break:\s*break-all/)
  assert.match(wxss, /\.order-card--unpaid \.care-memo-label/)
})

// ---- 整单底色：所有装备都已发板 ----
test('整单都发板：每件没取消的装备都已完成才算；取消的装备不算，全取消、没装备都不算', () => {
  const done = () => care({ tasks: [task('安全检查', '已完成', 10), task('发板', '已完成', 60)] })
  const running = () => care({ tasks: [task('安全检查', '已完成', 10), task('热蜡', '未开始', 20), task('发板', '未开始', 60)] })
  const cancelled = () => care({ is_cancel: true, tasks: [task('发板', '已完成', 60, { status: '已完成' })] })
  const allDone = list => rows.allCaresDone(rows.buildCareRows(list, ''))
  assert.equal(allDone([done(), done()]), true)
  assert.equal(allDone([done(), running()]), false)       // 还有一件没发板
  assert.equal(allDone([running()]), false)
  assert.equal(allDone([done(), care({ is_cancel: true, tasks: [] })]), true)   // 取消的装备不用发板
  assert.equal(allDone([care({ is_cancel: true, tasks: [] })]), false)          // 全取消了，不算都发板
  assert.equal(allDone([]), false)
  assert.equal(allDone(null), false)
  assert.equal(allDone([care({ tasks: [] })]), false)    // 还没有任务（没生效）
  assert.equal(allDone([care({ tasks: [task('安全检查', '已完成', 10), task('强行索回', '已完成', 60)] })]), true)   // 强行索回也算完成
  assert.equal(allDone([cancelled()]), false)
})

test('列表渲染：订单带 allCaresDone，所有装备发板的订单卡片套浅绿底，没付款的订单不套', () => {
  const page = loadList()
  const finished = () => care({ id: 9, tasks: [task('安全检查', '已完成', 10), task('发板', '已完成', 60)] })
  const doneOrder = Object.assign(orderWith(0), { id: 1, cares: [finished(), finished()] })
  const partial = Object.assign(orderWith(0), { id: 2, cares: [finished(), care({ id: 10, tasks: [task('热蜡', '未开始', 20)] })] })
  page.renderOrders([doneOrder, partial], 2, 1, 50)
  assert.deepEqual(page.data.orders.map(o => o.allCaresDone), [true, false])
  const cardClass = cardBlock.match(/<view class="order-card ([^"]*)"/)[1]
  assert.match(cardClass, /item\.allCaresDone && !item\.unpaid \? 'order-card--done'/)
  assert.match(wxss, /\.order-card--done\s*\{\s*background:\s*#f0faf4/)
})

// ---- 点装备进详情并定位到这一件 ----
function careLineTag() {
  return cardBlock.match(/<view wx:if="\{\{item\.careExpanded\}\}" class="care-line[^>]*>/)[0]
}

test('点某一件装备：进订单详情并带上这件装备的 careId', () => {
  const page = loadList()
  page.renderOrders([orderWith(1), orderWith(3)], 2, 1, 50)
  page.data.orders[1].id = 77
  const calls = []
  global.wx = { navigateTo: arg => calls.push(arg) }
  try {
    page.onCareTap(tap({ idx: '1', cid: '2' }))
    page.onCareTap(tap({ idx: '0', cid: '1' }))
  } finally {
    delete global.wx
  }
  assert.deepEqual(calls, [
    { url: 'care_order_detail/care_order_detail?orderId=77&careId=2' },
    { url: 'care_order_detail/care_order_detail?orderId=' + page.data.orders[0].id + '&careId=1' }
  ])
})

test('点订单公共部分仍然只带 orderId，不带 careId（详情页走原来的默认展开）', () => {
  const page = loadList()
  page.renderOrders([orderWith(2)], 1, 1, 50)
  const calls = []
  global.wx = { navigateTo: arg => calls.push(arg) }
  try {
    page.gotoDetail({ currentTarget: { id: '0' } })
  } finally {
    delete global.wx
  }
  assert.deepEqual(calls, [{ url: 'care_order_detail/care_order_detail?orderId=' + page.data.orders[0].id }])
})

test('点装备：临时订单、找不到订单或装备时不跳转', () => {
  const page = loadList()
  page.renderOrders([Object.assign(orderWith(2), { careProperties: { orderStatus: '临时订单' } }), orderWith(2)], 2, 1, 50)
  const calls = []
  global.wx = { navigateTo: arg => calls.push(arg) }
  try {
    page.onCareTap(tap({ idx: '0', cid: '1' }))   // 临时订单
    page.onCareTap(tap({ idx: '9', cid: '1' }))   // 没有这一单
    page.onCareTap(tap({ idx: '1', cid: '' }))    // 没有装备
  } finally {
    delete global.wx
  }
  assert.deepEqual(calls, [])
})

test('装备块自己接管点击（catchtap），不会冒泡成整单点击；带订单下标和装备 id', () => {
  const tag = careLineTag()
  assert.match(tag, /catchtap="onCareTap"/)
  assert.match(tag, /data-idx="\{\{index\}\}"/)
  assert.match(tag, /data-cid="\{\{cr\.id\}\}"/)
  // 整张卡片的点击还是进详情（订单公共部分）
  assert.match(cardBlock, /class="order-card[^"]*"[^>]*bindtap="gotoDetail"/)
})

// 详情页：收到 careId 后只展开这一件、收起其它、并滚动到这一件
function loadDetail() {
  global.getApp = () => ({ globalData: {} })
  global.wx = {}
  const util = require('../utils/util.js')
  const page = loadPage('pages/admin/care/care_order_detail/care_order_detail.js', { IMAGE_HOST: 'https://img.example' })
  void util
  delete global.getApp
  delete global.wx
  return page
}

test('详情页收到 careId：目标装备展开、其它全部收起，并滚动到目标装备', async () => {
  const page = loadDetail()
  page._uiState = { expanded: {}, veriType: {}, safeCheck: {}, cancelReason: {} }
  page._targetCareId = 12
  page.data.cares = [
    { id: 11, _expanded: true },
    { id: 12, _expanded: false },
    { id: 13, _expanded: true }
  ]
  const scrolls = []
  global.wx = { pageScrollTo: arg => scrolls.push(arg) }
  try {
    page._applyTargetCare()
    assert.deepEqual(page.data.cares.map(c => [c.id, c._expanded]), [[11, false], [12, true], [13, false]])
    assert.deepEqual(page._uiState.expanded, { 11: false, 12: true, 13: false })
    await new Promise(r => setTimeout(r, 400))
  } finally {
    delete global.wx
  }
  assert.equal(scrolls.length, 1)
  assert.equal(scrolls[0].selector, '#care-12')
})

test('详情页：订单页上每件装备卡的 id 是 care-装备id，滚动选择器对得上', () => {
  const detailWxml = fs.readFileSync(path.join(__dirname, '..', 'pages/admin/care/care_order_detail/care_order_detail.wxml'), 'utf8')
  assert.match(detailWxml, /<view class="card" id="care-\{\{care\.id\}\}">/)
})

// ---- 筛选「招待」那一行的第四个选项：质保 ----
const entertainRow = wxml.slice(wxml.indexOf('<!-- 招待 -->'), wxml.indexOf('<!-- 减免 -->'))

test('招待那一行：正常 / 招待 / 质保 / 全部，质保排在招待和全部之间，和其它选项一样在手机 / 备注搜索时禁用', () => {
  const labels = [...entertainRow.matchAll(/<label class="radio-item"><radio ([^>]*)\/>([^<]+)<\/label>/g)].map(m => [m[2], (m[1].match(/value="([^"]*)"/) || [])[1]])
  assert.deepEqual(labels, [['正常', 'false'], ['招待', 'true'], ['质保', 'warranty'], ['全部', 'null']])
  const warranty = entertainRow.match(/<radio value="warranty"[^>]*\/>/)[0]
  assert.match(warranty, /disabled="\{\{\(cell != null && cell != ''\) \|\| \(keyword != null && keyword != ''\) \|\| querying\}\}"/)
})

function queryWith(page, value) {
  page.setQueryOptionValue('isEntertain', value)
  return page._buildQueryParams()
}

test('选「质保」：只按质保查（haveWarranty=true），招待不限；其它三项仍是原来的意思', () => {
  const page = loadList()
  const w = queryWith(page, 'warranty')
  assert.equal(w.haveWarranty, true)
  assert.equal(w.isEntertain, null)
  const normal = queryWith(page, 'false')
  assert.deepEqual([normal.isEntertain, normal.haveWarranty], [false, null])
  const entertain = queryWith(page, 'true')
  assert.deepEqual([entertain.isEntertain, entertain.haveWarranty], [true, null])
  const all = queryWith(page, 'null')
  assert.deepEqual([all.isEntertain, all.haveWarranty], [null, null])
})

test('选了质保再改回别的，不会残留质保条件；其它筛选项不受影响', () => {
  const page = loadList()
  page.setQueryOptionValue('haveDiscount', 'true')
  page.setQueryOptionValue('useCard', 'false')
  const w = queryWith(page, 'warranty')
  assert.deepEqual([w.haveDiscount, w.useCard, w.isTest], [true, false, false])
  assert.equal(queryWith(page, 'false').haveWarranty, null)
})

test('输了手机号或备注关键词：和旧版一样放宽所有筛选，质保条件也放开', () => {
  const page = loadList()
  page.setQueryOptionValue('isEntertain', 'warranty')
  page.setData({ cell: '7897' })
  const p = page._buildQueryParams()
  assert.deepEqual([p.isEntertain, p.haveWarranty], [null, null])
})

test('查询时 haveWarranty 传给列表接口的对应位置，其它位置不错位', () => {
  const calls = []
  global.getApp = () => ({ globalData: { sessionKey: 'sk' } })
  global.wx = {}
  const page = loadPage('pages/admin/care/care_order_list.js', {
    IMAGE_HOST: 'https://img.example',
    getRentOrdersByStaffPagedPromise: (...args) => { calls.push(args); return new Promise(() => {}) }
  })
  delete global.getApp
  delete global.wx
  page.setData({ startDate: '2026-11-14', endDate: '2026-11-14', shop: '万龙服务中心' })
  page.setQueryOptionValue('isEntertain', 'warranty')
  page.getData(1, 50)
  assert.equal(calls.length, 1)
  const a = calls[0]
  // 参数顺序见 utils/data.js getRentOrdersByStaffPagedPromise：4=type 8=isTest 9=isEntertain 16=haveWarranty 17=retailType
  assert.equal(a[4], '养护')
  assert.equal(a[9], null)
  assert.equal(a[16], true)
  assert.equal(a[17], null)
  assert.equal(a[14], 'sk')
})

test('data.js 把 haveWarranty=true 带进 Order/GetOrdersByStaffPaged 的地址', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'utils/data.js'), 'utf8')
  const fn = src.slice(src.indexOf('const getRentOrdersByStaffPagedPromise'), src.indexOf('const getOrderByStaffPromise'))
  assert.match(fn, /Order\/GetOrdersByStaffPaged/)
  assert.match(fn, /haveWarranty != null\) \{ qUrl \+= '&haveWarranty=' \+ haveWarranty \}/)
  // 参数位置：…, sessionKey, cell, haveWarranty, retailType, …
  assert.match(fn, /sessionKey, cell, haveWarranty, retailType, keyword/)
})

// ---- 「招待」列表只显示已生效的订单（客户端过滤，服务端不动） ----
test('已生效 = dealed 为 1；没生效、字段缺失、空订单都不算', () => {
  assert.equal(rows.isEffectiveOrder({ dealed: 1 }), true)
  assert.equal(rows.isEffectiveOrder({ dealed: '1' }), true)
  assert.equal(rows.isEffectiveOrder({ dealed: 0 }), false)
  assert.equal(rows.isEffectiveOrder({}), false)
  assert.equal(rows.isEffectiveOrder({ dealed: null }), false)
  assert.equal(rows.isEffectiveOrder(null), false)
  assert.equal(rows.isEffectiveOrder(undefined), false)
  assert.deepEqual(rows.effectiveOrders([{ id: 1, dealed: 1 }, { id: 2, dealed: 0 }, { id: 3, dealed: 1 }, null]).map(o => o.id), [1, 3])
  assert.deepEqual(rows.effectiveOrders(null), [])
})

// 用假的列表接口走页面真实的查询路径：看最后显示的订单和总数
function listWith(items, total) {
  global.getApp = () => ({ globalData: { sessionKey: 'sk' } })
  global.wx = {}
  const page = loadPage('pages/admin/care/care_order_list.js', {
    IMAGE_HOST: 'https://img.example',
    getRentOrdersByStaffPagedPromise: () => Promise.resolve({ items: JSON.parse(JSON.stringify(items)), total, totalEarnAmount: 0 })
  })
  delete global.getApp
  delete global.wx
  page.setData({ startDate: '2026-11-14', endDate: '2026-11-14', shop: '万龙服务中心' })
  return page
}
const settle = () => new Promise(r => setTimeout(r, 20))
const entertainOrder = (id, dealed) => Object.assign(orderWith(1), { id, code: 'WF_YH_261114_0000' + id, dealed, orderStatus: dealed === 1 ? '已下单' : '待生成' })

test('选了「招待」：没生效的订单（待生成那种）不显示，已生效的照常显示；共几单跟着减', async () => {
  const page = listWith([entertainOrder(2, 1), entertainOrder(1, 0), entertainOrder(5, 1)], 3)
  page.setQueryOptionValue('isEntertain', 'true')
  page.getData(1, 50)
  await settle()
  assert.deepEqual(page.data.orders.map(o => o.id), [2, 5])
  assert.equal(page.data.total, 2)
  assert.equal(page.data.querying, false)
})

test('没选「招待」（正常 / 全部 / 质保）：不过滤，没生效的订单照旧显示，总数不变', async () => {
  for (const value of ['false', 'null', 'warranty']) {
    const page = listWith([entertainOrder(2, 1), entertainOrder(1, 0)], 2)
    page.setQueryOptionValue('isEntertain', value)
    page.getData(1, 50)
    await settle()
    assert.deepEqual(page.data.orders.map(o => o.id), [2, 1], value)
    assert.equal(page.data.total, 2, value)
  }
})

test('选了「招待」又按手机号 / 备注搜索：搜索放宽所有筛选，也不过滤没生效的', async () => {
  const page = listWith([entertainOrder(2, 1), entertainOrder(1, 0)], 2)
  page.setQueryOptionValue('isEntertain', 'true')
  page.setData({ cell: '7897' })
  page.getData(1, 50)
  await settle()
  assert.deepEqual(page.data.orders.map(o => o.id), [2, 1])
})

test('招待列表里一单都没生效：显示空，总数 0，不报错；总数不会减成负数', async () => {
  const none = listWith([entertainOrder(1, 0), entertainOrder(3, 0)], 2)
  none.setQueryOptionValue('isEntertain', 'true')
  none.getData(1, 50)
  await settle()
  assert.deepEqual(none.data.orders, [])
  assert.equal(none.data.total, 0)
  const odd = listWith([entertainOrder(1, 0), entertainOrder(3, 0)], 1)   // 服务端总数比本页条数还小的异常情况
  odd.setQueryOptionValue('isEntertain', 'true')
  odd.getData(1, 50)
  await settle()
  assert.equal(odd.data.total, 0)
})

// ---- 查询结果的应收 / 减免 / 共计收款 ----
const careAmount = (id, charge, discount, extra) => Object.assign({ id, equipment: '双板', displayCharge: charge, displayDiscount: discount, tasks: [] }, extra || {})
const summaryOrder = (id, cares, earn) => Object.assign(orderWith(1), { id, code: 'WF_YH_261114_0000' + id, cares, totalEarnAmount: earn })

test('应收 = 每件装备卡上的「金额」之和，减免 = 「减免」之和；招待 / 质保的标准价和减免也算（与卡上一致）', () => {
  const page = loadList()
  page.renderOrders([
    summaryOrder(1, [careAmount(11, 230, 30), careAmount(12, 100, 0)], 300),
    summaryOrder(2, [careAmount(21, 230, 230, { entertain: true })], 0)
  ], 2, 1, 50, 300)
  assert.equal(page.data.pageChargeStr, '¥560.00')
  assert.equal(page.data.pageDiscountStr, '¥260.00')
  assert.equal(page.data.totalEarnStr, '¥300.00')
})

test('已取消的装备不会再收，不计入应收 / 减免；没有装备的订单、金额缺失的装备按 0', () => {
  const page = loadList()
  page.renderOrders([
    summaryOrder(1, [careAmount(11, 230, 30), careAmount(12, 100, 20, { is_cancel: true })], 200),
    summaryOrder(2, [], 0),
    summaryOrder(3, [{ id: 31, equipment: '双板', tasks: [] }], 0)
  ], 3, 1, 50, 200)
  assert.equal(page.data.pageChargeStr, '¥230.00')
  assert.equal(page.data.pageDiscountStr, '¥30.00')
})

test('没有结果或空页：应收 / 减免是 ¥0.00，不报错；金额按分四舍五入', () => {
  const page = loadList()
  page.renderOrders([], 0, 1, 50, 0)
  assert.equal(page.data.pageChargeStr, '¥0.00')
  assert.equal(page.data.pageDiscountStr, '¥0.00')
  page.renderOrders([summaryOrder(1, [careAmount(11, 0.1, 0), careAmount(12, 0.2, 0)], 0)], 1, 1, 50, 0)
  assert.equal(page.data.pageChargeStr, '¥0.30')   // 0.1 + 0.2 不会变成 0.30000000000000004
})

test('汇总行：只有一页时写「应收 · 减免 · 共计收款」；多页时标明「本页」，共计收款放到下一行', () => {
  const bar = wxml.slice(wxml.indexOf('<!-- 统计行 + 分页 -->'), wxml.indexOf('<!-- 订单列表 -->'))
  const single = bar.match(/<view wx:if="\{\{totalPages <= 1\}\}" class="summary-bar">[\s\S]*?<\/view>/)[0]
  assert.match(single, /应收 \{\{pageChargeStr\}\}/)
  assert.match(single, /减免 \{\{pageDiscountStr\}\}/)
  assert.match(single, /共计收款 \{\{allEarnStr\}\}/)
  assert.doesNotMatch(single, /本页/)
  const multi = bar.match(/<view wx:else class="summary-bar">[\s\S]*?<\/view>/)[0]
  assert.match(multi, /本页 应收 \{\{pageChargeStr\}\}/)
  assert.match(multi, /减免 \{\{pageDiscountStr\}\}/)
  assert.match(multi, /收款 \{\{totalEarnStr\}\}/)
  const count = bar.slice(bar.indexOf('<view class="summary-bar">'), bar.indexOf('<list-pager'))
  assert.match(count, /共 \{\{total\}\} 单，\{\{totalPages\}\} 页/)
  assert.match(count, /wx:if="\{\{totalPages > 1\}\}"[\s\S]*共计收款 \{\{allEarnStr\}\}/)
})

// ---- 含包 / 含杖：双板 / 单板图标下面的小图标 ----
test('含包 / 含杖的装备：行上带对应的小图标（图标文件真实存在）；都没带的没有；单板含包也行', () => {
  const [bag, pole, none, boardBag, nullFlags] = rows.buildCareRows([
    care({ id: 1, with_bag: true }), care({ id: 2, with_pole: true }), care({ id: 3 }),
    care({ id: 4, equipment: '单板', with_bag: true }), care({ id: 5, with_bag: null, with_pole: null })
  ], '')
  assert.deepEqual(bag.extras.map(e => [e.key, e.label]), [['bag', '含包']])
  assert.deepEqual(pole.extras.map(e => [e.key, e.label]), [['pole', '含杖']])
  assert.deepEqual(none.extras, [])
  assert.deepEqual(boardBag.extras.map(e => e.key), ['bag'])
  assert.deepEqual(nullFlags.extras, [])
  for (const e of [...bag.extras, ...pole.extras]) {
    assert.match(e.src, /^\/images\/care\/icon-(bag|pole)\.svg$/)
    const file = path.join(__dirname, '..', e.src)
    assert.ok(fs.existsSync(file), e.src + ' 不存在')
    assert.match(fs.readFileSync(file, 'utf8'), /^<svg[^>]*viewBox=[\s\S]*<\/svg>\s*$/)
  }
})

test('包和杖二选一：数据里万一两个都为真（不该发生），如实两个都显示，不替人选；只有真值才显示（0 / 字符串不算）', () => {
  assert.deepEqual(rows.equipmentExtras({ with_bag: true, with_pole: true }).map(e => e.key), ['bag', 'pole'])
  assert.deepEqual(rows.equipmentExtras({ with_bag: 1, with_pole: 'true' }), [])
  assert.deepEqual(rows.equipmentExtras(null), [])
})

test('列表模板：双板 / 单板图标下面按装备行的 extras 画小图标，在同一个图标列里', () => {
  const col = cardBlock.match(/<view class="care-icon-col">[\s\S]*?<\/view>/)[0]
  assert.match(col, /class="care-kind"/)
  assert.match(col, /wx:for="\{\{cr\.extras\}\}"[^>]*class="care-extra"/)
  assert.ok(col.indexOf('care-kind') < col.indexOf('care-extra'), '小图标在双板 / 单板图标下面')
  assert.match(rule('.care-extra'), /width:\s*36rpx/)
})
