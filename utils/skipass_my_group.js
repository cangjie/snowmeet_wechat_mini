// 「我的雪票」：后台每张票一条记录，页面上票种、日期、手机号相同的合并成一条显示「× n」，
// 点开按票分标签，每张票有自己的二维码、状态和退票按钮。

// 后台 status 文案 → 退票/退款相关的显示。取消先提交给供应商，确认可能要几分钟，确认后系统自动按这张票的票款原路退款。
const CANCEL_STATUS = {
  '取消中': { text: '退票中', kind: 'cancelling', usable: false, hint: '退票处理中，通常几分钟内确认，确认后自动原路退款' },
  '申请取消': { text: '退票中', kind: 'cancelling', usable: false, hint: '退票处理中，通常几分钟内确认，确认后自动原路退款' },
  '已取消': { text: '退票中', kind: 'cancelling', usable: false, hint: '退票已确认，退款正在提交' },
  // 退款已经提交给微信，钱按原路退回；以「已申请退款」为准显示已退票，不等「退款成功」
  '已申请退款': { text: '已退票', kind: 'refunded', usable: false, hint: '退款已原路退回，到账时间以支付渠道为准' },
  '退款成功': { text: '已退票', kind: 'refunded', usable: false, hint: '' },
  '已退票': { text: '已退票', kind: 'refunded', usable: false, hint: '' },
  '出票失败': { text: '出票失败', kind: 'failed', usable: false, hint: '这张票没有出成，票款会自动退回' },
  '取消失败': { text: '退票未成功', kind: 'cancelFailed', usable: true, hint: '退票没有成功，请联系店员处理' }
}

const USED_STATUS = ['已取卡', '已退押金']

function parseTicket(raw) {
  const status = raw.status || ''
  const cancelInfo = CANCEL_STATUS[status]
  const used = USED_STATUS.indexOf(status) >= 0
  const hasCode = !!(raw.qr_code_url || raw.card_no)
  let kind, text, hint = ''
  if (cancelInfo) {
    kind = cancelInfo.kind; text = cancelInfo.text; hint = cancelInfo.hint
  } else if (used) {
    kind = 'used'; text = '已使用'
  } else if (status === '已付款' && !hasCode && !raw.reserve_no) {
    kind = 'issuing'; text = '出票中'; hint = '正在向供应商出票，通常一两分钟，请稍后下拉刷新'
  } else {
    kind = 'ready'; text = status === '已确认' || status === '已出票' ? '可使用' : (status || '可使用')
  }
  const usable = !used && (!cancelInfo || cancelInfo.usable)
  // 已出票（有供应商订单号）、还没取卡、没有在退票流程里的才能退；出票中的先别退
  const canCancel = !used && !!raw.reserve_no && (kind === 'ready' || kind === 'cancelFailed')
  return {
    id: raw.id,
    serial: raw.reserve_no || '',
    cardNo: raw.card_no || '',
    pickupCode: raw.qr_code_url || '',
    status, kind, stateText: text, stateHint: hint, usable, canCancel,
    amountNum: Number(raw.deal_price) || 0
  }
}

function dateOf(value) {
  return String(value || '').slice(0, 10)
}

const SUMMARY_ORDER = [['ready', '可使用'], ['issuing', '出票中'], ['used', '已使用'], ['cancelling', '退票中'], ['refunded', '已退票'], ['failed', '出票失败'], ['cancelFailed', '退票未成功']]

function summarize(tickets) {
  if (tickets.length === 1) return tickets[0].stateText
  const parts = []
  SUMMARY_ORDER.forEach(([kind, label]) => {
    const n = tickets.filter(t => t.kind === kind).length
    if (n) parts.push(n + ' 张' + label)
  })
  return parts.join(' · ')
}

// list: GetMySkipass 的返回（每张票一条，新单在前）。返回按首次出现顺序的分组。
function buildMyGroups(list) {
  const groups = []
  const byKey = {}
  ;(Array.isArray(list) ? list : []).forEach(raw => {
    const key = [raw.product_id, dateOf(raw.reserve_date), String(raw.contact_cell || '').trim()].join('|')
    let g = byKey[key]
    if (!g) {
      g = byKey[key] = {
        key, productId: raw.product_id, title: raw.product_name, validDate: dateOf(raw.reserve_date),
        cell: String(raw.contact_cell || '').trim(), tickets: []
      }
      groups.push(g)
    }
    g.tickets.push(parseTicket(raw))
  })
  groups.forEach(g => {
    g.tickets.sort((a, b) => a.id - b.id)
    g.count = g.tickets.length
    g.amountNum = Math.round(g.tickets.reduce((s, t) => s + t.amountNum, 0) * 100) / 100
    g.usableCount = g.tickets.filter(t => t.usable).length
    g.statusText = summarize(g.tickets)
    g.statusHint = g.count === 1 ? g.tickets[0].stateHint : ''
    g.serial = g.count === 1 ? g.tickets[0].serial : ''
    // 还有能用的票放「未使用」，全都用完或退完放「已使用」
    g.tab = g.usableCount > 0 ? 'unused' : 'used'
    if (g.tab === 'used') {
      const allRefund = g.tickets.every(t => ['cancelling', 'refunded', 'failed'].indexOf(t.kind) >= 0)
      const allUsed = g.tickets.every(t => t.kind === 'used')
      g.stampText = allRefund ? '已退票' : (allUsed ? '已使用' : '已完成')
    } else {
      g.stampText = ''
    }
  })
  return groups
}

module.exports = { CANCEL_STATUS, parseTicket, buildMyGroups }
