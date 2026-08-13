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
// "已分享"列表里点进详情页看到的操作权限跟列表页一致：shared==0 但 tab=='shared'
// 意味着这张券已经被对方接受、不再是我的了，不能再转赠/撤回分享，也不显示核销二维码。
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
  ticket.actionable = true   // 是否还允许任何操作（转赠/撤回分享/核销二维码等）
  if (ticket.used == 1){
    ticket.statusText = '已使用'
    ticket.statusClass = 'status-used'
  }
  else if (ticket.shared == 1){
    ticket.statusText = '分享中'
    ticket.statusClass = 'status-shared'
  }
  else if (tab == 'shared'){
    ticket.statusText = '对方已接受'
    ticket.statusClass = 'status-accepted'
    ticket.canTransfer = false
    ticket.actionable = false
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
