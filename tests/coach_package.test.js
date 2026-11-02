// 教练分包的结构检查：app.json 注册、四个文件齐全、JSON 合法、WXML 标签配对、wxml 里的事件处理函数都在页面里定义、wxss 引用存在。
// （没有微信开发者工具时，这些是能自动发现手误的最低一层检查）
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { loadPage } = require('./reception_harness.js')

const root = path.join(__dirname, '..')
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'))
const sub = app.subPackages.find(s => s.root === 'pages/coach')

test('app.json 注册了教练分包，页面一个不少，且没有同时出现在主包（主包体积紧张）', () => {
  assert.ok(sub, '缺少 pages/coach 分包')
  assert.equal(sub.name, 'coach')
  assert.deepEqual(sub.pages.slice().sort(), ['admin/add/add', 'admin/detail/detail', 'admin/issue/issue', 'admin/list/list', 'card/card', 'claim/claim', 'home/home', 'student/student'])
  assert.ok(!app.pages.some(p => p.indexOf('pages/coach/') === 0))
})

// 简易 WXML 配对检查：忽略注释，自闭合不入栈
function checkBalanced(src, name) {
  const text = src.replace(/<!--[\s\S]*?-->/g, '')
  const stack = []
  const re = /<(\/?)([a-zA-Z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g
  let m
  while ((m = re.exec(text))) {
    const [, close, tag, , selfClose] = m
    if (selfClose) continue
    if (!close) { stack.push(tag); continue }
    const top = stack.pop()
    assert.equal(top, tag, `${name}: 标签不配对，期望 </${top}>，实际 </${tag}>`)
  }
  assert.deepEqual(stack, [], `${name}: 有未闭合标签 ${stack.join(',')}`)
}

for (const page of sub.pages) {
  test(`pages/coach/${page}: 文件齐全、JSON 合法、WXML 配对、事件处理函数都已定义、wxss 引用存在`, () => {
    const base = path.join(root, 'pages/coach', page)
    for (const ext of ['js', 'json', 'wxml', 'wxss']) assert.ok(fs.existsSync(`${base}.${ext}`), `${page}.${ext} 不存在`)
    JSON.parse(fs.readFileSync(`${base}.json`, 'utf8'))
    const wxml = fs.readFileSync(`${base}.wxml`, 'utf8')
    checkBalanced(wxml, page)
    // 事件：bindtap / catchtap / bindinput / bindchange / bindgetphonenumber 等
    const handlers = new Set()
    for (const m of wxml.matchAll(/\b(?:bind|catch):?[a-z]+="([A-Za-z_]\w*)"/g)) handlers.add(m[1])
    assert.ok(handlers.size > 0 || page === 'student/student' || page === 'card/card')
    const previous = global.getApp
    global.getApp = () => ({ globalData: {}, loginPromiseNew: Promise.resolve() })   // claim.js 在文件顶层取 getApp()
    let def
    try { def = loadPage(`pages/coach/${page}.js`, { bindWechatCellPromise() {} }) } finally { if (previous === undefined) delete global.getApp; else global.getApp = previous }
    for (const h of handlers) assert.equal(typeof def[h], 'function', `${page}.wxml 用了 ${h}，但页面里没有这个函数`)
    // wxss 的 @import 指向存在的文件
    const wxss = fs.readFileSync(`${base}.wxss`, 'utf8')
    for (const m of wxss.matchAll(/@import\s+"([^"]+)"/g)) assert.ok(fs.existsSync(path.join(path.dirname(`${base}.wxss`), m[1])), `${page}.wxss 引用了不存在的 ${m[1]}`)
  })
}

test('修改过的现有组件：WXML 仍然配对，新增的事件处理函数存在', () => {
  for (const f of ['components/reception/ticket_card_selector/ticket_card_selector.wxml', 'components/reception/care_recept_form/care_recept_form.wxml',
    'components/reception/rent_recept_form/rent_recept_form.wxml', 'pages/mine/mine.wxml', 'pages/admin/admin.wxml']) {
    checkBalanced(fs.readFileSync(path.join(root, f), 'utf8'), f)
  }
  const rentJson = JSON.parse(fs.readFileSync(path.join(root, 'components/reception/rent_recept_form/rent_recept_form.json'), 'utf8'))
  assert.equal(rentJson.usingComponents['ticket-card-selector'], '../ticket_card_selector/ticket_card_selector')
})

test('入口：管理员菜单有「教练管理」，「我的」页有教练和学员卡入口，登录会话保存 coach', () => {
  const adminWxml = fs.readFileSync(path.join(root, 'pages/admin/admin.wxml'), 'utf8')
  assert.match(adminWxml, /id="coach_admin"[^>]*wx:if="\{\{isAdmin\}\}"/)
  assert.match(fs.readFileSync(path.join(root, 'pages/admin/admin.js'), 'utf8'), /case 'coach_admin':\s*path = '\/pages\/coach\/admin\/list\/list'/)
  const mine = fs.readFileSync(path.join(root, 'pages/mine/mine.wxml'), 'utf8')
  assert.match(mine, /wx:if="\{\{coach\}\}" value="我是教练"/)
  assert.match(mine, /wx:if="\{\{hasCoachCard\}\}" value="我的学员卡"/)
  assert.match(fs.readFileSync(path.join(root, 'app.js'), 'utf8'), /app\.globalData\.coach = session\.coach \|\| null/)
})
