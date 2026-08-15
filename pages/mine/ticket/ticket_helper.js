// pages/mine/ticket/ticket_helper.js
// 硬编码：允许转赠的优惠券模板（12=免费打蜡券，16=老顾客优惠券），需与后端 TicketController.TransferableTemplateIds 保持一致
const TRANSFERABLE_TEMPLATE_IDS = [12, 16]

// 优惠券编码 3 位一节、用横线连接，纯展示用（不影响传给后端的原始 code）
function formatTicketCode(code){
  var s = (code || '').toString()
  var parts = []
  for (var i = 0; i < s.length; i += 3){
    parts.push(s.substr(i, 3))
  }
  return parts.join('-')
}

// 给单张券补齐展示用字段。list 页（tab=='shared'）和 detail 页共用这份逻辑，保证
// "已分享"列表里点进详情页看到的操作权限跟列表页一致：这张券已经被对方接受、不再是
// 我的了，就不能再转赠/撤回分享，也不显示核销二维码。
//
// 判定顺序里 transferredOut 必须排在 shared 前面：shared 只说明券自身处于"分享中"，
// 不说明它还在我名下。券被对方接受后又被对方转赠出去（他那次分享会把 shared 置回 1），
// 或者 2019~2023 旧转赠流程留下的没复位 shared 的历史数据，都会出现"券不是我的、
// shared 却是 1"。这种券如果显示成"分享中"并给出撤回按钮，点了必然被后端
// CancelShare 的归属校验拒掉，提示"优惠券不存在"（2026-08-14 踩坑修复）。
//
// transferredOut 由后端 GetMySharedTickets 下发；detail 页没有这个接口，
// 由 list 页跳转时通过 URL 参数把结论带过去（深链直接进 detail 的场景拿不到，
// 退回 tab 兜底，与修复前行为一致）。
function annotateTicket(ticket, tab){
  var memo = ticket.memo
  if (memo.indexOf('>') >= 0 && memo.indexOf('<') >= 0){
    ticket.rich = true
  }
  else{
    ticket.rich = false
    ticket.usage = memo.split(';')
  }
  ticket.codeDisplay = formatTicketCode(ticket.code)
  ticket.canTransfer = TRANSFERABLE_TEMPLATE_IDS.indexOf(ticket.template_id) >= 0 && ticket.used != 1
  ticket.actionable = true       // 是否还允许任何操作（转赠/撤回分享/核销二维码等）
  ticket.canCancelShare = false  // 是否显示"撤回分享"按钮。wxml 一律用这个，不要直接判 shared
  if (ticket.used == 1){
    ticket.statusText = '已使用'
    ticket.statusClass = 'status-used'
  }
  else if (ticket.transferredOut || tab == 'shared' && ticket.shared != 1){
    ticket.statusText = '对方已接受'
    ticket.statusClass = 'status-accepted'
    ticket.canTransfer = false
    ticket.actionable = false
  }
  else if (ticket.shared == 1){
    ticket.statusText = '分享中'
    ticket.statusClass = 'status-shared'
    ticket.canCancelShare = true
  }
  else{
    ticket.statusText = '待使用'
    ticket.statusClass = 'status-pending'
  }
  return ticket
}

module.exports = {
  formatTicketCode,
  annotateTicket
}
