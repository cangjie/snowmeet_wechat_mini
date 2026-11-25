// Display only: the server remains authoritative for eligibility and amounts.
const NO_BENEFIT = '暂无可用优惠'

// 自动匹配实际用上的优惠名称；整单券是一个名字，其余按行统计季卡 / 次卡 / 会籍卡。没用上任何东西返回空数组。
function matchedNames(result) {
  if (!result || !result.quote) return []
  const quote = result.quote
  if (quote.couponCode) return ['整单优惠券']
  const lines = quote.lines || []
  const names = []
  if (lines.some(l => l.usesSeason)) names.push('季卡')
  if (lines.some(l => l.usesPunch)) names.push('次卡')
  if (lines.some(l => {
    const unit = (result.units || []).find(u => u.id === l.id)
    return unit && unit.coachCardId && !l.usesPunch && !l.usesSeason && Number(l.payable) < Number(unit.gross)
  })) names.push('会籍卡')
  return names
}

function describe(result) {
  if (!result || !result.quote) return ''
  const names = matchedNames(result)
  return names.length ? names.join(' + ') : NO_BENEFIT
}

// 2026-11-25 用户定：自动匹配没有匹配上任何券或卡，就应该关闭自动匹配。
// 只在「确实算过了」时才关：自动模式、可修改、有租金明细（units 非空，否则还是「等待租金明细」）、报价里什么都没匹配上。
function shouldCloseAuto(result) {
  return !!result && result.mode === 'auto' && !!result.canChange && !!result.quote
    && (result.units || []).length > 0 && matchedNames(result).length === 0
}

module.exports = { describe, shouldCloseAuto }
