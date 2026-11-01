// 顾客端底部菜单：预定改名「雪票」、次卡暂时隐藏、每项带图标。
// 2026-11-01：用户要求底部菜单「预订」改成「雪票」，「次卡」暂时隐藏，「雪票」和「我的」加上图标。
// 次卡隐藏靠 utils/tabbar.js 的一个开关；各页面的高亮下标都从这里算，不能再写死数字（以前往中间插一项就错位）。
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const tabbar = require('../utils/tabbar.js')

const ROOT = path.join(__dirname, '..')
const SKIPASS = '/pages/ski_pass/ski_pass_selector'
const PUNCHCARD = '/pages/punchcard/punchcard_shop'
const MINE = '/pages/mine/mine'

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8')
}

function pngSize(rel) {
  const buf = fs.readFileSync(path.join(ROOT, rel))
  assert.equal(buf.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', rel + ' 不是 PNG')
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), bytes: buf.length }
}

test('次卡隐藏期间菜单是「雪票」「我的」，不再有「预定」', () => {
  assert.equal(tabbar.SHOW_PUNCHCARD_TAB, false, '次卡暂时隐藏：开关保持关闭')
  const items = tabbar.tabBarItems()
  assert.deepEqual(items.map(i => i.text), ['雪票', '我的'])
  assert.deepEqual(items.map(i => i.pagePath), [SKIPASS, MINE])
  assert.ok(!JSON.stringify(items).includes('预定'))
})

test('开关打开后次卡回到雪票和我的中间', () => {
  const items = tabbar.tabBarItems(true)
  assert.deepEqual(items.map(i => i.text), ['雪票', '次卡', '我的'])
  assert.deepEqual(items.map(i => i.pagePath), [SKIPASS, PUNCHCARD, MINE])
})

test('每个菜单项都有未选中和选中两张图标，文件存在、是 PNG、够小', () => {
  for (const item of tabbar.tabBarItems(true)) {
    for (const icon of [item.iconPath, item.selectedIconPath]) {
      assert.match(icon, /^\/images\/tabbar\/[\w-]+\.png$/, item.text + ' 的图标路径')
      const size = pngSize(icon.replace(/^\//, ''))
      assert.equal(size.width, size.height, icon + ' 要是正方形')
      assert.ok(size.width >= 81, icon + ' 至少 81px，3 倍屏才清晰')
      assert.ok(size.bytes < 40 * 1024, icon + ' 超过 40KB')
    }
    assert.notEqual(item.iconPath, item.selectedIconPath, item.text + ' 选中和未选中要是两张图')
  }
})

test('菜单项是副本：页面 setData 或改动不会污染定义', () => {
  const first = tabbar.tabBarItems()
  first[0].text = '被改了'
  first.pop()
  assert.deepEqual(tabbar.tabBarItems().map(i => i.text), ['雪票', '我的'])
})

test('各页面的高亮下标按菜单实际顺序算，次卡不在菜单里时是 -1（不高亮）', () => {
  assert.equal(tabbar.tabIndexOf(SKIPASS), 0)
  assert.equal(tabbar.tabIndexOf(MINE), 1)
  assert.equal(tabbar.tabIndexOf(PUNCHCARD), -1)
  assert.equal(tabbar.tabIndexOf('pages/mine/mine'), 1, '路径不带开头的斜杠也认')

  assert.equal(tabbar.tabIndexOf(SKIPASS, true), 0)
  assert.equal(tabbar.tabIndexOf(PUNCHCARD, true), 1)
  assert.equal(tabbar.tabIndexOf(MINE, true), 2, '次卡显示时「我的」往后挪一位')

  for (const show of [false, true]) {
    const items = tabbar.tabBarItems(show)
    items.forEach((item, i) => assert.equal(tabbar.tabIndexOf(item.pagePath, show), i))
  }
})

test('顾客进小程序的默认落点：次卡隐藏时是雪票页，次卡显示时回到次卡商城', () => {
  assert.equal(tabbar.customerLandingUrl(), SKIPASS)
  assert.equal(tabbar.customerLandingUrl(false), SKIPASS)
  assert.equal(tabbar.customerLandingUrl(true), PUNCHCARD)
})

test('用了底部菜单的页面不再写死下标', () => {
  for (const rel of ['pages/mine/mine.js', 'pages/ski_pass/ski_pass_selector.js', 'pages/punchcard/punchcard_shop.js']) {
    const src = read(rel)
    assert.match(src, /require\('\.\.\/\.\.\/utils\/tabbar\.js'\)/, rel + ' 要用 utils/tabbar.js')
    assert.match(src, /tabbar\.tabIndexOf\(tabbar\.\w+_URL\)/, rel + ' 的下标要从 tabIndexOf 取')
    assert.doesNotMatch(src.replace(/\/\/.*$/gm, ''), /tabIndex:\s*\d/, rel + ' 里还有写死的 tabIndex 数字')
  }
  const app = read('app.js')
  assert.match(app, /userTabBarItem:\s*tabbar\.tabBarItems\(\)/)
  assert.doesNotMatch(app, /"text":\s*"预定"/)
})

test('四个用了 mp-tabbar 的页面都从全局菜单取列表', () => {
  for (const rel of ['pages/index/index.js', 'pages/mine/mine.js', 'pages/ski_pass/ski_pass_selector.js', 'pages/punchcard/punchcard_shop.js']) {
    assert.match(read(rel), /tabbarItemList:\s*app\.globalData\.userTabBarItem/, rel)
  }
})
