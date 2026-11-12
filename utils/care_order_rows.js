// 养护订单列表：把订单里的每件装备整理成「一件一块」的展示行（品牌 / 长度 / 项目 / 进度 / 缩略图）。
// 纯函数、不依赖 wx / app，方便单测。
// 叫法对齐详情页（care_order_detail 的 chips）：热蜡、机打蜡、养板、封板、立等；
// 进度（一件装备所处的阶段，一个色块）：发板（或强行索回）已完成 → 已完成；除安全检查、发板外的任务全做完、只差发板 → 待发板；
// 这些任务里有动过（做完 / 正在做）、还没全做完 → 进行中；其余（没任务、只做了安全检查、安全检查都没做）→ 未开始；
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

const SAFETY_TASK = '安全检查'

// 进度阶段：{ label, cls }，cls 是 idle 未开始 / run 进行中 / ready 待发板 / done 已完成 / cancel 已取消
function careProgress(care) {
  if (care.is_cancel) return { label: '已取消', cls: 'cancel' }
  const tasks = sortedTasks(care)
  const isDone = t => DONE_STATUSES.indexOf(trim(t.status)) >= 0
  const isFinish = t => FINISH_TASKS.indexOf(trim(t.task_name)) >= 0
  const finish = tasks.find(isFinish)
  if (finish && isDone(finish)) return { label: '已完成', cls: 'done' }
  // 除安全检查、发板外的任务：养护 / 维修的具体工序
  const service = tasks.filter(t => trim(t.task_name) !== SAFETY_TASK && !isFinish(t))
  if (service.length === 0) return { label: '未开始', cls: 'idle' }
  if (service.every(isDone)) return finish ? { label: '待发板', cls: 'ready' } : { label: '进行中', cls: 'run' }
  if (service.some(t => trim(t.status) !== '' && trim(t.status) !== '未开始')) return { label: '进行中', cls: 'run' }
  return { label: '未开始', cls: 'idle' }
}

// 这件装备的全部任务，按做的先后排好：[{ key, name, cls, flag }]。每个任务着色：
//   已完成 / 强行中止 → done（绿）；正在做 → run（红）；还没轮到的 → idle（灰）。
// 「正在做」：任务状态是已开始的就是；但已开始只在员工点着「开始」到「结束」那一小会儿存在（库里近 60 天 1180 多个任务里只有 8 个），
// 平时一件装备处在「上一道做完、下一道还没点开始」的间隙，所以这件装备已经动工（进行中 / 待发板）、又没有任务是已开始时，
// 把按顺序第一个没做完的任务当作正在做（红），和进度色块一致：进行中 → 轮到的那道工序，待发板 → 发板。
// 还没动工（未开始）、已完成、已取消的装备没有红色。
// 强行中止算「做完了」（和进度口径一致），但在名字后面标一个「中止」，免得被当成正常做完。
// 没有任务（订单还没生效）返回空数组。
function taskItems(care, stageCls) {
  const items = sortedTasks(care).map((t, i) => {
    const status = trim(t.status)
    const done = DONE_STATUSES.indexOf(status) >= 0
    return {
      key: t.id !== undefined && t.id !== null ? t.id : 'i' + i,
      name: trim(t.task_name),
      cls: done ? 'done' : (status === '' || status === '未开始' ? 'idle' : 'run'),
      flag: status === '强行中止' ? '中止' : ''
    }
  })
  if ((stageCls === 'run' || stageCls === 'ready') && !items.some(t => t.cls === 'run')) {
    const current = items.find(t => t.cls === 'idle')
    if (current) current.cls = 'run'
  }
  return items
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

// 用次卡的装备显示「用的哪张卡、还剩几次」：后端给 cardDisplayName / cardRemaining / cardUnlimited（现在这一刻的余量），
// 老后端没给时退回装备上记的 card_name。没用次卡不显示；没绑上卡（购卡处理中）或读卡失败只有卡名 / 什么都没有，但仍标出用了次卡。
// 剩余 0 次要显示出来（0 不是没有）；季卡不限次数。金额 / 减免不受影响，次卡抵掉的装备库里就是 0。
// 卡名、卡号和剩余次数分开给：卡名太长时页面只省略卡名，卡号和剩余次数始终显示。
// 剩余次数是这件装备「用完之后」卡里还剩几次（同一张卡上先后用的两件装备，先用的比后用的多 1），后端算好给 cardRemaining。
// 卡号 = 卡 id（装备自带的 card_id），还没绑上卡（购卡处理中）时没有。
function cardInfo(care) {
  if (!care.use_card) return { usesCard: false, cardName: '', cardNo: '', cardRemain: '' }
  const name = String(care.cardDisplayName || care.card_name || '').trim()
  const cardId = Number(care.card_id)
  const cardNo = Number.isInteger(cardId) && cardId > 0 ? '卡号 ' + cardId : ''
  let remain = ''
  if (care.cardUnlimited === true) remain = '不限次数'
  else if (typeof care.cardRemaining === 'number' && isFinite(care.cardRemaining)) remain = '剩余 ' + care.cardRemaining + ' 次'
  return { usesCard: true, cardName: name, cardNo, cardRemain: remain }
}

// 装备用的券 / 学员卡 / 质保 / 招待，和次卡一起列在装备块里（不管订单里有几件、每件用了什么，都各列各的）：
//   · 券：选了券（ticket_code）就列出来，券名取后端给的 ticketDisplayName，读不到显示「优惠券」，券号 = ticket_code；
//   · 学员卡：选了学员卡（coach_card_id）就列出来，名字取后端给的 coachCardDisplayName（「某某教练的学员卡」），读不到显示「学员卡」，卡号 = 学员卡 id；
//   · 质保 / 招待：装备自带的标记（warranty / entertain），各出一个标签。
function benefitInfo(care) {
  const ticketCode = String(care.ticket_code || '').trim()
  const coachId = Number(care.coach_card_id)
  const hasCoach = Number.isInteger(coachId) && coachId > 0
  const isWarranty = care.warranty === true || care.warranty === 1
  const isEntertain = care.entertain === true || care.entertain === 1
  return {
    usesTicket: ticketCode !== '',
    ticketName: ticketCode !== '' ? (String(care.ticketDisplayName || '').trim() || '优惠券') : '',
    ticketNo: ticketCode !== '' ? '券号 ' + ticketCode : '',
    usesCoachCard: hasCoach,
    coachName: hasCoach ? (String(care.coachCardDisplayName || '').trim() || '学员卡') : '',
    coachNo: hasCoach ? '卡号 ' + coachId : '',
    isWarranty,
    isEntertain,
    hasFlag: isWarranty || isEntertain
  }
}

function money(n) {
  return '¥' + (Math.round(n * 100) / 100).toFixed(2)
}

function buildCareRows(cares, imageHost) {
  return (cares || []).map(care => {
    const progress = careProgress(care)
    const amount = careAmounts(care)
    const card = cardInfo(care)
    const benefit = benefitInfo(care)
    const tasks = taskItems(care, progress.cls)
    return {
      id: care.id,
      title: equipmentTitle(care),
      kind: equipmentKind(care),
      iconSrc: KIND_ICONS[equipmentKind(care)] || '',
      charge: amount.charge,
      discount: amount.discount,
      chargeStr: money(amount.charge),
      discountStr: money(amount.discount),
      usesCard: card.usesCard,
      cardName: card.cardName,
      cardNo: card.cardNo,
      cardRemain: card.cardRemain,
      usesTicket: benefit.usesTicket,
      ticketName: benefit.ticketName,
      ticketNo: benefit.ticketNo,
      usesCoachCard: benefit.usesCoachCard,
      coachName: benefit.coachName,
      coachNo: benefit.coachNo,
      isWarranty: benefit.isWarranty,
      isEntertain: benefit.isEntertain,
      hasFlag: benefit.hasFlag,
      // 有没有权益行（质保 / 招待、次卡、券、学员卡任一）；一行都没有的装备，版面上补一行看不见的占位，高度和有一行权益的装备一样
      hasBenefit: benefit.hasFlag || card.usesCard || benefit.usesTicket || benefit.usesCoachCard,
      services: serviceChips(care),
      // 这件装备自己的备注（care.memo；整单备注是订单的 memo，另外显示）
      memo: trim(care.memo),
      statusLabel: progress.label,
      statusClass: progress.cls,
      tasks,
      thumb: firstThumb(care, imageHost),
      photos: photoUrls(care, imageHost)
    }
  })
}

// 整单的装备是不是都已经发板了（列表里整张订单卡片据此换底色）：
// 已取消的装备不算（取消的不用发板）；至少要有一件没取消的装备，并且这些装备的进度都是已完成。
// 参数是 buildCareRows 的结果。
function allCaresDone(rows) {
  const live = (rows || []).filter(row => row.statusClass !== 'cancel')
  return live.length > 0 && live.every(row => row.statusClass === 'done')
}

module.exports = { buildCareRows, equipmentTitle, equipmentKind, serviceChips, careProgress, allCaresDone }
