// 顾客端底部菜单（weui mp-tabbar）：菜单项、显示开关、各页面的高亮下标，全部从这里取。
// 用了 mp-tabbar 的页面：index / ski_pass_selector / punchcard_shop / mine。
// 页面不要再写死 tabIndex，用 tabIndexOf(本页路径)，增删菜单项时下标才不会错位。
// 图标是 images/tabbar 下的线条图标，选中是绿色（#07C160，和 weui 选中文字同色），生成脚本在文档仓 tools/tabbar_icons。
const SKIPASS_URL = '/pages/ski_pass/ski_pass_selector'
const PUNCHCARD_URL = '/pages/punchcard/punchcard_shop'
const MINE_URL = '/pages/mine/mine'

// 次卡暂时不对外：菜单里隐藏「次卡」，顾客进小程序的默认落点也从次卡商城改成雪票页（2026-11-01）。
// 要重新上线只改这一个开关；次卡的页面、图标、下单流程都还在，别的入口（如「我的」里的次卡）不受影响。
const SHOW_PUNCHCARD_TAB = false

const ALL_TABS = [
  { key: 'skipass', pagePath: SKIPASS_URL, text: '雪票',
    iconPath: '/images/tabbar/skipass.png', selectedIconPath: '/images/tabbar/skipass-on.png' },
  { key: 'punchcard', pagePath: PUNCHCARD_URL, text: '次卡',
    iconPath: '/images/tabbar/punchcard.png', selectedIconPath: '/images/tabbar/punchcard-on.png' },
  { key: 'mine', pagePath: MINE_URL, text: '我的',
    iconPath: '/images/tabbar/mine.png', selectedIconPath: '/images/tabbar/mine-on.png' }
]

function visibleKeys(showPunchcard) {
  return ALL_TABS.map(t => t.key).filter(key => key !== 'punchcard' || showPunchcard)
}

// 当前要显示的菜单项（每次返回新的副本，页面 setData 后不会改到这里的定义）
function tabBarItems(showPunchcard = SHOW_PUNCHCARD_TAB) {
  const keys = visibleKeys(showPunchcard)
  return ALL_TABS.filter(t => keys.indexOf(t.key) >= 0).map(t => Object.assign({}, t))
}

// 某个页面在菜单里的下标；不在菜单里（比如隐藏后的次卡商城）返回 -1，mp-tabbar 就不高亮任何一项
function tabIndexOf(pagePath, showPunchcard = SHOW_PUNCHCARD_TAB) {
  const normalized = ('/' + ('' + pagePath).replace(/^\//, ''))
  return tabBarItems(showPunchcard).findIndex(t => t.pagePath === normalized)
}

// 普通顾客进小程序（首页跳板、主动回首页）的落点
function customerLandingUrl(showPunchcard = SHOW_PUNCHCARD_TAB) {
  return showPunchcard ? PUNCHCARD_URL : SKIPASS_URL
}

module.exports = {
  SKIPASS_URL, PUNCHCARD_URL, MINE_URL, SHOW_PUNCHCARD_TAB,
  tabBarItems, tabIndexOf, customerLandingUrl
}
