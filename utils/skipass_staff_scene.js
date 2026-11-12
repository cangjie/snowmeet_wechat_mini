// 接收员工小程序码，或公众平台规则匹配后的正式订票链接。
function validId(value) {
  const match = /^([1-9]\d{0,9})$/.exec(value || '')
  return match && Number(match[1]) <= 2147483647 ? match[1] : ''
}
function decode(value) {
  if (typeof value !== 'string') return ''
  try { return decodeURIComponent(value) } catch (_) { return '' }
}
function staffId(scene) {
  const match = /^s=([1-9]\d{0,9})$/.exec(decode(scene))
  return match ? validId(match[1]) : ''
}
function fromOptions(options) {
  options = options || {}
  const fromScene = staffId(options.scene)
  if (fromScene) return fromScene
  const match = /^https:\/\/mini\.snowmeet\.top\/mapp\/skipass_book\?staffId=([1-9]\d{0,9})$/.exec(decode(options.q))
  return match ? validId(match[1]) : ''
}
module.exports = { staffId, fromOptions }
