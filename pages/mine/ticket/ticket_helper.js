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
  var memo = ticket.memo || ''
  if (memo.indexOf('>') >= 0 && memo.indexOf('<') >= 0){
    ticket.rich = true
    ticket.usage = []
  }
  else{
    ticket.rich = false
    // 过滤掉空条目：模板 16「老顾客优惠券」的 memo 是空串，直接 split 会得到 ['']，
    // 渲染出一个孤零零的「· 」。库里 86% 的券都是这种，必须挡掉。
    ticket.usage = memo.split(';').filter(function (s){ return (s || '').trim() !== '' })
  }
  // 有说明才显示「使用说明」那一行折叠入口
  ticket.hasUsage = ticket.rich || ticket.usage.length > 0
  ticket.usageCount = ticket.rich ? 0 : ticket.usage.length

  ticket.codeDisplay = formatTicketCode(ticket.code)

  // 有效期行：临期标红。expireText / expireUrgent 都由后端算好，前端不解析日期
  ticket.metaLine = ticket.expireUrgent
    ? ('即将到期 · ' + (ticket.expireText || ''))
    : ('有效期至 ' + (ticket.expireText || ''))

  // 券码 · 时间。displayTimeLabel 形如「领取时间」，这里去掉「时间」二字更紧凑
  var timeTag = (ticket.displayTimeLabel || '').replace('时间', '')
  ticket.codeTimeLine = ticket.codeDisplay
    + (ticket.displayTimeText ? (' · ' + ticket.displayTimeText + ' ' + timeTag) : '')
  // 失效态：banner 降灰 + 文字降色。设计明确要求不用整卡 opacity——
  // 那样会把券码、时间这些小字压到读不清
  // 顾客端「未使用」tab 后端已经滤掉过期券、「已使用」tab 全是 used==1，
  // 所以这里只需判这两种；不引用后端并不下发的 expired 字段
  ticket.muted = ticket.used == 1 || !!ticket.transferredOut
  // 教练券（管理员批量发给教练的，服务端标 coachGranted）不受「仅模板 12、16 可转赠」限制，教练可转发给学员
  ticket.canTransfer = (TRANSFERABLE_TEMPLATE_IDS.indexOf(ticket.template_id) >= 0 || !!ticket.coachGranted) && ticket.used != 1
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

// 把后端下发的 expireText（yyyy.M.d，不补零）转成可字典序比较的键；「长期有效」等不是日期的用 '9999' 排到最后
function expireKey(t){
  var s = (t && t.expireText) || ''
  var m = /^(\d{4})\.(\d{1,2})\.(\d{1,2})$/.exec(s)
  if (!m){ return '9999' }
  return m[1] + ('0' + m[2]).slice(-2) + ('0' + m[3]).slice(-2)
}

// 「我的优惠券」按券种分组（2026-11-19 用户要求：同一种券合并成「免费打蜡券 × N」）。
// 组的顺序：按各券种里「最后得到的那张」的时间倒序（2026-11-19 用户要求）——不论是系统赠送、订单赠送还是别人转赠，
// 只要这个券种刚得到新券，它就排到最前。时间用后端下发的 displayTimeText（yyyy-MM-dd HH:mm，可以直接比大小；
// 未使用 tab 里转赠来的是领取时间、自己获得的是获得时间）；没有时间的排最后，时间一样的保持传进来的先后。
// 组内每一张保持传进来的顺序（页面按「有效期 / 获得时间」排好再传进来）。
// 券种 = 券名（顾客看到的就是券名）；没有券名的按模板 id 分，免得全混成一组。
// 同一券种有 2 张以上才成「组」（single=false），只有一张的照旧直接显示那张券。
// openKeys：哪些组是展开的 { 券种键: true }。tab：pending / used / shared，决定汇总文字，只有未使用的写到期日。
function groupTickets(tickets, openKeys, tab){
  openKeys = openKeys || {}
  var groups = []
  var index = {}
  ;(tickets || []).forEach(function (t){
    var name = ((t && t.name) || '').trim()
    var key = name || ('模板' + t.template_id)
    var g = index[key]
    if (!g){
      g = { key: key, name: name || '优惠券', bannerLabel: t.bannerLabel, bannerCls: t.bannerCls, tickets: [] }
      index[key] = g
      groups.push(g)
    }
    g.tickets.push(t)
  })
  var word = tab == 'used' ? '已使用' : (tab == 'shared' ? '已分享' : '可用')
  groups.forEach(function (g, i){
    g.order = i    // 同一时间的组保持第一次出现的先后
    g.latestTime = g.tickets.reduce(function (latest, t){
      var time = (t && t.displayTimeText) || ''
      return time > latest ? time : latest
    }, '')
    g.count = g.tickets.length
    g.single = g.count === 1
    g.countText = '× ' + g.count
    g.open = !!openKeys[g.key]
    // 整组都失效（已使用、对方已接受）才降灰；有一张还有效就不降灰
    g.muted = g.tickets.every(function (t){ return !!t.muted })
    g.summaryText = g.count + ' 张' + word
    g.expireLine = ''
    g.urgentCount = 0
    g.urgentLine = ''
    if (tab != 'used' && tab != 'shared'){
      var best = null
      g.tickets.forEach(function (t){ if (!best || expireKey(t) < expireKey(best)){ best = t } })
      g.expireLine = expireKey(best) === '9999' ? (best.expireText || '长期有效') : ('最近到期 ' + best.expireText)
      g.urgentCount = g.tickets.filter(function (t){ return !!t.expireUrgent }).length
      g.urgentLine = g.urgentCount > 0 ? ('其中 ' + g.urgentCount + ' 张 30 天内到期') : ''
    }
  })
  groups.sort(function (a, b){
    if (a.latestTime !== b.latestTime){ return a.latestTime > b.latestTime ? -1 : 1 }
    return a.order - b.order
  })
  return groups
}

// 分组 → 页面上一行一行显示的列表（WXML 只遍历这个）：
// 只有一张的券种：一行券；多张的：先一行组头，展开了再跟着每一张。
// 券行带着券自己的全部字段（模板里照旧写 item.xxx），组头行不带 tickets（不把整批券在 setData 里再传一遍）。
function buildRows(groups){
  var rows = []
  groups.forEach(function (g){
    if (g.single){
      rows.push(Object.assign({}, g.tickets[0], { rowType: 'card', rowKey: g.tickets[0].code, inGroup: false }))
      return
    }
    var head = Object.assign({}, g, { rowType: 'group', rowKey: 'g:' + g.key })
    delete head.tickets
    rows.push(head)
    if (g.open){
      g.tickets.forEach(function (t){
        rows.push(Object.assign({}, t, { rowType: 'card', rowKey: t.code, inGroup: true }))
      })
    }
  })
  return rows
}

module.exports = {
  formatTicketCode,
  annotateTicket,
  expireKey,
  groupTickets,
  buildRows,
  requestTransferSubscribe,
  openSubscribeSetting,
  isSubscribePermanentlyBlocked,
  SUBSCRIBE_TEMPLATE_ID
}
