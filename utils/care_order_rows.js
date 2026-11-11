// 养护订单列表：把订单里的每件装备整理成「一件一块」的展示行（品牌 / 长度 / 项目 / 进度 / 缩略图）。
// 纯函数、不依赖 wx / app，方便单测。
// 叫法对齐详情页（care_order_detail 的 chips）：热蜡、机打蜡、养板、封板、立等；
// 进度口径对齐后端 Care.status 和详情页：发板（或强行索回）已完成 → 已完成；有任务动过 → 进行中；否则未开始；
// 取消的装备是靠发板任务落库的，所以先看 is_cancel，显示已取消。

const DONE_STATUSES = ['已完成', '强行中止']
const FINISH_TASKS = ['发板', '强行索回']

function trim(s) {
  return s == null ? '' : String(s).trim()
}

function fullUrl(host, value) {
  if (!value) return ''
  return /^(https?:|wxfile:)/.test(value) ? value : (host || '') + value
}

// 双板 / 单板在列表里用图标表示（放在订单标签那一列），不再写字；别的装备没有图标
const KIND_ICONS = {
  '双板': '/images/care/icon-ski-double.svg',
  '单板': '/images/care/icon-snowboard.svg'
}

// 装备类型：'双板' / '单板'，其它（头盔等）和没填的返回 ''
function equipmentKind(care) {
  const type = trim(care.equipment)
  return KIND_ICONS[type] ? type : ''
}

// 「ATOMIC · 170cm」：品牌取斜杠前那段（和详情页一样），缺的项省略；
// 有图标的双板 / 单板不再带类型字样，其它装备仍带（「头盔 · POC」）；
// 双板 / 单板连品牌长度都没填时退回显示类型，免得标题是空的
function equipmentTitle(care) {
  const parts = []
  if (!equipmentKind(care)) parts.push(trim(care.equipment) || '装备')
  const brand = trim(care.brand).split('/')[0].trim()
  if (brand) parts.push(brand)
  const scale = trim(care.scale)
  if (scale) parts.push(/cm$/i.test(scale) ? scale : scale + 'cm')
  if (parts.length === 0) parts.push(trim(care.equipment))
  return parts.join(' · ')
}

// 这件装备做的项目：[{ text, cls }]，cls 为空表示默认样式
function serviceChips(care) {
  const chips = []
  const add = (text, cls) => chips.push({ text, cls: cls || '' })
  if (care.biz_type === '非雪季养护') {
    add(care.summer === 'now' ? '非雪季·立等现修' : (care.summer === 'later' ? '非雪季·寄存后修' : '非雪季'), 'svc--summer')
  }
  if (care.need_edge === 1) add('修刃' + (care.edge_degree ? care.edge_degree + '°' : ''))
  if (care.need_wax === 1) add('热蜡')
  if (care.maintain_board === 1) add('养板')
  if (care.free_wax === 1) add('机打蜡')
  if (care.need_unwax === 1) add('刮蜡')
  if (care.seal_board === 1) add('封板')
  if (care.urgent === 1) add('立等', 'svc--urgent')
  if (trim(care.repair_memo)) add('维修:' + trim(care.repair_memo))
  return chips
}

function taskOrderValue(task) {
  if (task.task_name === '安全检查') return -1000
  return task.sort === undefined || task.sort === null ? 999999 : Number(task.sort)
}

function sortedTasks(care) {
  return (care.tasks || [])
    .filter(t => t && (t.valid === undefined || t.valid === null || Number(t.valid) === 1))
    .slice()
    .sort((a, b) => (taskOrderValue(a) - taskOrderValue(b)) || ((a.id || 0) - (b.id || 0)))
}

// 进度：{ label, cls, current }，cls 是 idle / run / done / cancel
function careProgress(care) {
  if (care.is_cancel) return { label: '已取消', cls: 'cancel', current: '' }
  const tasks = sortedTasks(care)
  if (tasks.length === 0) return { label: '未开始', cls: 'idle', current: '' }
  const finish = tasks.find(t => FINISH_TASKS.indexOf(trim(t.task_name)) >= 0)
  if (finish && trim(finish.status) === '已完成') return { label: '已完成', cls: 'done', current: '' }
  const isDone = t => DONE_STATUSES.indexOf(trim(t.status)) >= 0
  if (tasks.some(t => trim(t.status) !== '未开始')) {
    const next = tasks.find(t => !isDone(t))
    return {
      label: '进行中 ' + tasks.filter(isDone).length + '/' + tasks.length,
      cls: 'run',
      current: next ? trim(next.task_name) : ''
    }
  }
  return { label: '未开始', cls: 'idle', current: '' }
}

// 第一张有图的缩略图（列表里只放一张）
function firstThumb(care, host) {
  const list = care.careImages || []
  for (let i = 0; i < list.length; i++) {
    const image = list[i] && list[i].image
    const url = image && (image.thumbUrl || image.file_path_name)
    if (url) return fullUrl(host, url)
  }
  return ''
}

// 这件装备全部照片的原图地址（点缩略图看大图用）；没有原图地址的退回缩略图地址
function photoUrls(care, host) {
  const urls = []
  ;(care.careImages || []).forEach(item => {
    const image = item && item.image
    const url = image && (image.file_path_name || image.thumbUrl)
    if (url) urls.push(fullUrl(host, url))
  })
  return urls
}

// 这件装备的金额 / 减免（展示用）。后端 GetOrdersByStaffPaged 会给 displayCharge / displayDiscount：
// 普通装备就是库里的值，招待 / 质保装备库里是 0，后端按所做项目算标准价、减免到 0 元，所以要优先用它；
// 两个值缺一个就当后端没给（老后端、或价目读取失败），退回库里的值——金额 = 项目收费 + 附加费，减免 = 手动减免 + 券减免
function careAmounts(care) {
  const num = v => (typeof v === 'number' && isFinite(v) ? v : 0)
  if (typeof care.displayCharge === 'number' && typeof care.displayDiscount === 'number') {
    return { charge: care.displayCharge, discount: care.displayDiscount }
  }
  return {
    charge: num(care.common_charge) + num(care.repair_charge),
    discount: num(care.discount) + num(care.ticket_discount)
  }
}

function money(n) {
  return '¥' + (Math.round(n * 100) / 100).toFixed(2)
}

function buildCareRows(cares, imageHost) {
  return (cares || []).map(care => {
    const progress = careProgress(care)
    const amount = careAmounts(care)
    return {
      id: care.id,
      title: equipmentTitle(care),
      kind: equipmentKind(care),
      iconSrc: KIND_ICONS[equipmentKind(care)] || '',
      charge: amount.charge,
      discount: amount.discount,
      chargeStr: money(amount.charge),
      discountStr: money(amount.discount),
      services: serviceChips(care),
      statusLabel: progress.label,
      statusClass: progress.cls,
      current: progress.current,
      thumb: firstThumb(care, imageHost),
      photos: photoUrls(care, imageHost)
    }
  })
}

module.exports = { buildCareRows, equipmentTitle, equipmentKind, serviceChips, careProgress }
