// 零售开单 / 零售订单详情共用的规则。
// 订单类型选项沿用旧版零售开单（2026-08-12 随旧接待页删除的 components/retail/retail_recept）：
//   - 旧版「二手装备」那一项 value 写成了「租赁卡类」（复制粘贴错），这里改成与零售订单列表筛选、
//     后端 AdminAssistantDomains.RetailTypes 一致的「二手零售」。
//   - 两种卡类暂时置灰不可选（2026-10-21 用户决定）：次卡/季卡现在走商品目录购买才会真正发卡，
//     这里选卡类只记一笔钱、不发卡，容易误用。
const RETAIL_TYPES = [
  { value: '零售', label: '零售' },
  { value: '期货预定', label: '期货预定' },
  { value: '养护卡类', label: '养护卡类', disabled: true },
  { value: '租赁卡类', label: '租赁卡类', disabled: true },
  { value: '二手零售', label: '二手零售' },
  { value: '雪鞋定型', label: '雪鞋定型' },
]

const DISABLED_TYPE_TIP = '卡类暂不支持在这里开单'

// 七色米单号统一去空格、转大写后再校验和保存（单号本身就是 XSD + 数字 + 可选 I/A）
function normalizeMi7Code(code) {
  return String(code || '').trim().toUpperCase()
}

// 与后端 Util.IsValidMi7Code 同口径：XSD 开头，15 位且以 I/A 结尾，或 14 位且不以 I/A 结尾
function isValidMi7Code(code) {
  var c = normalizeMi7Code(code)
  if (c.indexOf('XSD') !== 0) return false
  var tail = c.charAt(c.length - 1)
  var endsIA = tail === 'I' || tail === 'A'
  return (c.length === 15 && endsIA) || (c.length === 14 && !endsIA)
}

// 订单类型按钮的渲染数据（选中态预置成布尔：WXML 不支持方法调用，见 CLAUDE.md 已知遗留）
function retailTypeOptions(current) {
  return RETAIL_TYPES.map(function (t) {
    return { value: t.value, label: t.label, disabled: !!t.disabled, on: t.value === current }
  })
}

function isDisabledRetailType(value) {
  return RETAIL_TYPES.some(function (t) { return t.value === value && t.disabled })
}

module.exports = {
  RETAIL_TYPES: RETAIL_TYPES,
  DISABLED_TYPE_TIP: DISABLED_TYPE_TIP,
  normalizeMi7Code: normalizeMi7Code,
  isValidMi7Code: isValidMi7Code,
  retailTypeOptions: retailTypeOptions,
  isDisabledRetailType: isDisabledRetailType,
}
