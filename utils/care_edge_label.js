// 养护：修刃角度与标签存根（用户 2026-11-25 要求）。
//   · 修刃开始之前，角度都可以改；
//   · 改了角度，标签存根上印的「修刃 89」就错了，必须重新打印标签，不重新打印不能点「开始修刃」。
//
// 状态记在服务器 care.label_edge_degree（标签上印的角度，NULL = 没有待重打的改动）：
//   · 第一次改角度时服务器把「改之前的角度」记进去，连改几次不变；重新打印成功后清回 NULL；
//   · 待重打 = 它不是空，且和当前角度（edge_degree，空按 89，和打印标签的组件一致）不一致，
//     所以把角度又改回标签上的值，也就不用重打了；
//   · 后端 SetTaskStatus 也拦「开始修刃」，这里只是让店员提前看到原因。
// 规则和后端 Helpers/CareEdgeLabelRules.cs 同口径，改一处要同步改另一处。

const DEFAULT_DEGREE = '89'
const EDGE_TASK_NAME = '修刃'
const ANGLE_RANGE_ERROR = '修刃角度要在 0～90 之间，最多一位小数'

// 标签上印出来的角度（edge_degree 为空按 89）
function printedDegree(edgeDegree) {
  return edgeDegree == null ? DEFAULT_DEGREE : String(edgeDegree).trim()
}

// 这件装备有没有「角度改过、标签还没重新打」的状态；旧后端没有 label_edge_degree 字段时一律是 false
function isPending(care) {
  if (!care || care.label_edge_degree == null) return false
  return String(care.label_edge_degree).trim() !== printedDegree(care.edge_degree)
}

// 解析店员输入的新角度：1～2 位整数，可带 1 位小数，范围 (0, 90]；写法规范化（89.0 → 89）
function parseAngle(input) {
  const text = input == null ? '' : String(input).trim()
  if (text === '') return { ok: false, error: '请输入修刃角度' }
  if (!/^\d{1,2}(\.\d)?$/.test(text)) return { ok: false, error: ANGLE_RANGE_ERROR }
  const value = Number(text)
  if (!(value > 0 && value <= 90)) return { ok: false, error: ANGLE_RANGE_ERROR }
  return { ok: true, value: String(value) }
}

// 能不能改角度：装备有效、没取消、要修刃，且修刃任务存在、还没开始。能改返回 null，不能改返回原因
function whyCannotEdit(care, edgeTask) {
  if (!care || care.valid === 0) return '未找到养护装备'
  if (care.is_cancel) return '这件养护已取消，不能修改角度'
  if (care.need_edge !== 1 || !edgeTask) return '这件装备没有修刃任务，不能修改角度'
  if (edgeTask.status !== '未开始') return '修刃已经开始，不能再修改角度'
  return null
}

// 开始修刃前的拦截提示；不用拦返回 null
function startBlockedMessage(care) {
  if (!isPending(care)) return null
  return '修刃角度已改为 ' + printedDegree(care.edge_degree) + '°（标签上还是 '
    + String(care.label_edge_degree).trim() + '°），请先重新打印标签存根，再开始修刃'
}

// 「角度记录」弹窗里的一行（后端 Care/GetEdgeHistory 的一项）：
//   · angle = 改角度，显示「89° → 88°」；
//   · print = 重新打印标签存根，显示这次打在标签上的角度。
// 角度缺失按 89（标签上印的就是 89）；不认识的类型返回 null（后端以后加了新类型，旧小程序不显示乱行）
function historyRow(item) {
  if (!item) return null
  if (item.kind === 'angle') {
    return { kind: 'angle', title: '改角度', detail: historyDegree(item.from) + '° → ' + historyDegree(item.to) + '°' }
  }
  if (item.kind === 'print') {
    return { kind: 'print', title: '重新打印标签存根', detail: '标签上是 ' + historyDegree(item.to) + '°' }
  }
  return null
}

// 记录里的角度：空、空白、字符串 "null" 都按 89
function historyDegree(value) {
  const text = value == null ? '' : String(value).trim()
  return text === '' || text === 'null' ? DEFAULT_DEGREE : text
}

// 一整份记录转成显示用的行，保持服务器给的顺序（新的在前）；不是数组按空处理
function historyRows(list) {
  if (!Array.isArray(list)) return []
  const rows = []
  list.forEach((item) => {
    const row = historyRow(item)
    if (row) rows.push(Object.assign(row, { source: item }))
  })
  return rows
}

module.exports = {
  EDGE_TASK_NAME,
  printedDegree,
  isPending,
  parseAngle,
  whyCannotEdit,
  startBlockedMessage,
  historyRow,
  historyRows
}
