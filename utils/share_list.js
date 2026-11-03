// 分账列表（pages/introducer/share/list）用的纯函数：点条目跳哪个详情页、勾选后的汇总、默认日期范围。
// 设计：snowmeet_ai_doc/docs/superpowers/specs/2026-11-03-share-list-manual-batch-design.md

const OLD_DAYS = 30

// 本地日期 yyyy-MM-dd 往前/往后推几天（不用 toISOString，避开 UTC 偏差）
function addDays(dateText, n) {
  const [y, m, d] = dateText.split('-').map(Number)
  const date = new Date(y, m - 1, d + n)
  const pad = v => (v < 10 ? '0' : '') + v
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate())
}

const round2 = n => Math.round(n * 100) / 100

// 租赁 / 养护 / 零售各有订单详情页；雪票详情页要的是雪票 id，订单上没有雪票就没有地方可跳
function detailUrl(item) {
  switch (item.orderType) {
    case '租赁': return '/pages/admin/rent/rent_order_detail/rent_order_detail?id=' + item.orderId
    case '养护': return '/pages/admin/care/care_order_detail/care_order_detail?id=' + item.orderId
    case '零售': return '/pages/admin/retail/retail_order_detail?id=' + item.orderId
    case '雪票': return item.skipassId ? '/pages/admin/ski_pass/common_skipass_detail?id=' + item.skipassId : null
    default: return null
  }
}

// 勾选的条目：笔数、合计（两位小数）、其中 oldDays 天前的条数（listDate 早于今天往前 oldDays 天）
function summarize(items, today, oldDays) {
  const cutoff = addDays(today, -(oldDays === undefined ? OLD_DAYS : oldDays))
  return {
    count: items.length,
    total: round2(items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0)),
    oldCount: items.filter(i => i.listDate < cutoff).length
  }
}

// 默认「近 30 天」：今天往前 30 天到今天
function defaultRange(today) {
  return { startDate: addDays(today, -OLD_DAYS), endDate: today }
}

module.exports = { detailUrl, summarize, defaultRange, addDays }
