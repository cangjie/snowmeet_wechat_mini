// 雪票详情页的价格月历：只有有价格的日期能点，没价格的日期灰掉。
// 为什么不用 van-calendar：它是弹层式、带「确定」按钮的选日期控件，这里要把价格写在每个格子里、
// 直接铺在页面里，窄屏（320px）上格子宽度和字号要自己控制。

const { fmtPrice } = require('./skipass_group.js')

const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六']

function pad(n) {
  return n < 10 ? '0' + n : String(n)
}

// prices: [{ date: 'YYYY-MM-DD', price }]，按日期升序；selectedDate: 'YYYY-MM-DD'
// 返回从第一个有价月份到最后一个有价月份的每个月（中间没价格的月份整月灰掉）
function buildMonths(prices, selectedDate) {
  if (!Array.isArray(prices) || !prices.length) return []
  const priceByDate = {}
  prices.forEach(p => { priceByDate[p.date] = p.price })
  const first = prices[0].date
  const last = prices[prices.length - 1].date
  let y = parseInt(first.slice(0, 4), 10)
  let m = parseInt(first.slice(5, 7), 10)
  const endY = parseInt(last.slice(0, 4), 10)
  const endM = parseInt(last.slice(5, 7), 10)
  const months = []
  while (y < endY || (y === endY && m <= endM)) {
    const days = new Date(y, m, 0).getDate()
    const lead = new Date(y, m - 1, 1).getDay()
    const cells = []
    let idx = 0
    for (let i = 0; i < lead; i++) cells.push({ idx: idx++, empty: true })
    for (let day = 1; day <= days; day++) {
      const date = y + '-' + pad(m) + '-' + pad(day)
      const price = priceByDate[date]
      const enabled = price !== undefined
      cells.push({
        idx: idx++,
        empty: false,
        day,
        date,
        enabled,
        selected: enabled && date === selectedDate,
        priceStr: enabled ? fmtPrice(price) : ''
      })
    }
    months.push({ key: y + '-' + pad(m), title: y + '年' + m + '月', cells })
    m++
    if (m > 12) { m = 1; y++ }
  }
  return months
}

module.exports = { buildMonths, WEEK_LABELS }
