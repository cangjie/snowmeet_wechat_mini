// 使用订单详情页已整理的每日租金行，避免把纯超时费或赔偿金混进租金列表。
const { showAmount } = require('./util.js')

// 按界面显示的每行小计精确累加到分，已免除的明细不计入。
function totalRows(rows) {
  const cents = rows.reduce((sum, row) => row.waived ? sum : sum + Math.round((Number(row.subtotal) || 0) * 100), 0)
  return showAmount(cents / 100)
}
function buildRentalDailyGroups(rentals) {
  const products = []
  const dates = {}
  ;(rentals || []).forEach((rental, index) => {
    if (!rental) return
    const name = rental.name || '未命名租赁商品'
    const rows = (rental.feeRows || []).map((row, feeIndex) => {
      if (!row || row.rentDetailId == null) return null
      return {
        key: index + '_' + row.dateStr,
        rentalIndex: index,
        feeIndex,
        date: row.dateStr,
        name,
        rentStr: row.rentStr,
        overtimeStr: row.overtimeStr,
        discountStr: row.discountStr,
        subtotalStr: row.subtotalStr,
        subtotal: row.subtotal,
        sceneStr: row.sceneStr,
        sceneClass: row.sceneClass,
        waived: !!row.waived,
        entertain: !!rental.entertain,
      }
    }).filter(Boolean).sort((a, b) => a.date.localeCompare(b.date))
    products.push({ key: 'rental_' + index, name, rows, totalStr: totalRows(rows) })
    rows.forEach(row => {
      if (!dates[row.date]) dates[row.date] = []
      dates[row.date].push(row)
    })
  })
  return {
    products,
    dates: Object.keys(dates).sort().map(date => ({ key: date, date, rows: dates[date], totalStr: totalRows(dates[date]) })),
  }
}

module.exports = { buildRentalDailyGroups }
