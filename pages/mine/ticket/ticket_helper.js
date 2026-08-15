// pages/mine/ticket/ticket_helper.js
// 硬编码：允许转赠的优惠券模板（12=免费打蜡券，16=老顾客优惠券），需与后端 TicketController.TransferableTemplateIds 保持一致
const TRANSFERABLE_TEMPLATE_IDS = [12, 16]

// 小程序订阅消息模板：优惠券领取成功提醒（模版编号 38451）。对方领取成功后，
// 后端会用这个模板通知分享人"券被领走了、已回赠你一张同款"。
// 需与后端 TicketController.TransferAcceptedTemplateId 保持一致。
//
// 授权必须在用户点击手势的回调里发起（wx.requestSubscribeMessage 的硬约束），
// 而「转赠好友」原本是 open-type="share" 的按钮、点下去立刻拉起转发面板，
// 两个系统弹窗挤在同一次点击里会打架 —— 所以转赠改成了两步：
// 先点按钮弹订阅授权，再在确认弹层里点「选择好友」真正分享。
const SUBSCRIBE_TEMPLATE_ID = 'TsWgivHWG5TT8OVI5hN7n56yCWJ5K8THFBtmmACfek4'

// 从 wx.getSetting({withSubscriptions:true}) 的 subscriptionsSetting 判断这个模板是不是
// 被用户「永久拒绝」了。
// itemSettings 里只会出现用户勾过「总是保持以上选择，不再询问」的模板 —— 所以某个模板
// 没出现在里面 ≠ 被拒绝，只是以后每次还会正常弹窗而已，不要把这两种情况搞混。
// mainSwitch 是小程序订阅消息的总开关，关掉了同样收不到。
function isSubscribePermanentlyBlocked(subscriptionsSetting, tmplId){
  if (!subscriptionsSetting){
    return false
  }
  if (subscriptionsSetting.mainSwitch === false){
    return true
  }
  var items = subscriptionsSetting.itemSettings
  return !!items && items[tmplId] === 'reject'
}

function checkSubscribeBlocked(done){
  if (!wx.getSetting){
    done(false)
    return
  }
  wx.getSetting({
    withSubscriptions: true,
    success: function (res){
      done(isSubscribePermanentlyBlocked(res && res.subscriptionsSetting, SUBSCRIBE_TEMPLATE_ID))
    },
    fail: function (){
      done(false)
    }
  })
}

// 两个页面共用：点「转赠好友」先请求订阅授权，无论用户同意还是拒绝都继续往下走
// （拒绝只是收不到通知，不该挡住转赠本身），最后回调打开确认弹层。
//
// done(blocked)：blocked=true 表示用户之前勾了「总是保持以上选择」并拒绝，微信从此
// 不再弹窗、直接返回 reject。这种情况代码绕不过去，只能在弹层里提示用户去设置页开启，
// 所以要把这个状态回传给调用方。
function requestTransferSubscribe(done){
  if (!wx.requestSubscribeMessage){
    done(false)
    return
  }
  wx.requestSubscribeMessage({
    tmplIds: [SUBSCRIBE_TEMPLATE_ID],
    success: function (res){
      if (res && res[SUBSCRIBE_TEMPLATE_ID] === 'accept'){
        done(false)
        return
      }
      // 这次没同意。可能只是本次点了取消（下次还会弹），也可能是被永久拒绝了，
      // 得查一下订阅设置才能区分——只有后者需要提示用户去设置页。
      checkSubscribeBlocked(done)
    },
    fail: function (){
      checkSubscribeBlocked(done)
    }
  })
}

// 引导用户去小程序设置页重新打开订阅消息。必须由点击手势触发。
function openSubscribeSetting(done){
  if (!wx.openSetting){
    done(true)
    return
  }
  wx.openSetting({
    withSubscriptions: true,
    success: function (res){
      done(isSubscribePermanentlyBlocked(res && res.subscriptionsSetting, SUBSCRIBE_TEMPLATE_ID))
    },
    fail: function (){
      done(true)
    }
  })
}

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
  annotateTicket,
  requestTransferSubscribe,
  openSubscribeSetting,
  isSubscribePermanentlyBlocked,
  SUBSCRIBE_TEMPLATE_ID
}
