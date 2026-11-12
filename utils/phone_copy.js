// 手机号旁的「复制」按钮：只有显示出来的是完整号码时才出按钮。
// 脱敏号（138****1234）、尾号、「未绑定」「—」这类占位文字复制出去没有用，不出按钮。
// 多个号码用「、」或逗号连在一起显示时（会员的联系手机号），整串原样复制。
const MIN_DIGITS = 7

function copyablePhone(value) {
  if (value === null || value === undefined) return ''
  const text = ('' + value).trim()
  if (!text) return ''
  if (!/^\+?[\d\s\-、,，]+$/.test(text)) return ''
  const digits = text.replace(/\D/g, '')
  return digits.length >= MIN_DIGITS ? text : ''
}

// 复制到剪贴板。微信自己会弹「内容已复制」，成功后不再重复提示；失败才提示。
function copyPhone(value, wxApi) {
  const text = copyablePhone(value)
  if (!text) return false
  const api = wxApi || wx
  api.setClipboardData({
    data: text,
    fail: function () {
      api.showToast({ title: '复制失败，请重试', icon: 'none' })
    },
  })
  return true
}

module.exports = { copyablePhone, copyPhone }
