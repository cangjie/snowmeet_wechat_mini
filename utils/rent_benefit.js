// Display only: the server remains authoritative for eligibility and amounts.
function describe(result) {
  if (!result || !result.quote) return ''
  const quote = result.quote
  if (quote.couponCode) return '整单优惠券'
  const lines = quote.lines || []
  const names = []
  if (lines.some(l => l.usesSeason)) names.push('季卡')
  if (lines.some(l => l.usesPunch)) names.push('次卡')
  if (lines.some(l => {
    const unit = (result.units || []).find(u => u.id === l.id)
    return unit && unit.coachCardId && !l.usesPunch && !l.usesSeason && Number(l.payable) < Number(unit.gross)
  })) names.push('会籍卡')
  return names.length ? names.join(' + ') : '暂无可用优惠'
}
module.exports = { describe }
