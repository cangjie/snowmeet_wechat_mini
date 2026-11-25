// 2026-11-25：主包又超过 2MB（估算 2282 KB），把「租赁」后台的 15 个页面（pages/admin/rent，约 340 KB）声明成独立分包 rentadmin。
// 分包根目录直接用现有目录，页面路径一个字都不变，所有 navigateTo / 扫码 / 分享链接照旧。
// 微信的规则：主包的页面、组件、脚本不能引用分包里的文件（分包只能引用主包和自己），所以这里除了登记，
// 还要钉住「主包里没有任何文件引用 pages/admin/rent」，否则以后谁在主包组件里引了租赁页的组件，真机上会报找不到。
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')
const SUB_ROOT = 'pages/admin/rent'
const PAGES = [
  'new_rent_list',
  'punchcard_products/punchcard_product_detail/punchcard_product_detail',
  'punchcard_products/punchcard_products',
  'punchcard_sales/punchcard_sales',
  'rent_append',
  'rent_order_detail/rent_order_detail',
  'rent_report',
  'search_fuzzy',
  'settings/category_tree',
  'settings/rent_package',
  'settings/rent_package_list',
  'settings/rent_product',
  'settings/rent_product_add',
  'settings/rent_product_list',
  'unreturned',
]

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/^﻿/, ''))
}
const app = readJson('app.json')

test('app.json：租赁后台页面登记在 rentadmin 分包里，15 页一个不少，且没有同时留在主包', () => {
  const sub = app.subPackages.find(s => s.root === SUB_ROOT)
  assert.ok(sub, '缺少 ' + SUB_ROOT + ' 分包')
  assert.equal(sub.name, 'rentadmin')
  assert.deepEqual(sub.pages.slice().sort(), PAGES)
  assert.deepEqual(app.pages.filter(p => p.indexOf(SUB_ROOT + '/') === 0), [], '这些页面不能同时出现在主包')
})

test('分包里每个页面的 js / json / wxml / wxss 都在，json 合法', () => {
  for (const page of PAGES) {
    for (const ext of ['js', 'json', 'wxml', 'wxss']) {
      assert.ok(fs.existsSync(path.join(ROOT, SUB_ROOT, page + '.' + ext)), page + '.' + ext + ' 不存在')
    }
    readJson(SUB_ROOT + '/' + page + '.json')
  }
})

test('分包根目录不嵌套在别的分包里，也不和别的分包重叠', () => {
  const roots = app.subPackages.map(s => s.root.replace(/\/+$/, ''))
  for (const a of roots) {
    for (const b of roots) {
      if (a !== b) assert.ok(b.indexOf(a + '/') !== 0, b + ' 嵌套在 ' + a + ' 里')
    }
  }
  assert.equal(new Set(app.subPackages.map(s => s.name)).size, app.subPackages.length, '分包 name 重复')
})

// ---- 主包不能引用分包里的文件 ----
const SKIP_DIRS = new Set(['.git', 'node_modules', 'tests', 'legacy', '.claude', 'miniprogram_npm'])
function walk(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const full = path.join(dir, name)
    const stat = fs.statSync(full)
    if (stat.isDirectory()) walk(full, out)
    else out.push(path.relative(ROOT, full).split(path.sep).join('/'))
  }
  return out
}

function specsOf(rel, text) {
  const specs = []
  if (rel.endsWith('.js') || rel.endsWith('.wxs')) {
    for (const m of text.matchAll(/require(?:\.async)?\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) specs.push(m[1])
    for (const m of text.matchAll(/(?:^|[;\s])import\s+(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g)) specs.push(m[1])
  } else if (rel.endsWith('.json')) {
    let json = {}
    try { json = JSON.parse(text.replace(/^﻿/, '')) } catch (e) { return specs }
    for (const v of Object.values(json.usingComponents || {})) specs.push(v)
    for (const v of Object.values(json.componentPlaceholder || {})) specs.push(v)
  } else if (rel.endsWith('.wxml')) {
    for (const m of text.matchAll(/<(?:import|include|wxs)\b[^>]*\bsrc\s*=\s*['"]([^'"{}]+)['"]/g)) specs.push(m[1])
  } else if (rel.endsWith('.wxss')) {
    for (const m of text.matchAll(/@import\s+['"]([^'"]+)['"]/g)) specs.push(m[1])
  }
  return specs
}

function resolveSpec(fromRel, spec) {
  spec = spec.split('?')[0].split('#')[0]
  if (!spec || /^(plugin|https?):/.test(spec)) return null
  if (spec.startsWith('/')) return spec.slice(1)
  if (spec.startsWith('.')) return path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), spec))
  return null // npm 包（@vant/...、weui-miniprogram/...）不在这个目录里
}

test('主包里没有任何页面、组件、脚本引用 pages/admin/rent 里的文件（主包不能用分包里的东西）', () => {
  const bad = []
  for (const rel of walk(ROOT, [])) {
    if (rel.indexOf(SUB_ROOT + '/') === 0) continue
    if (!/\.(js|json|wxml|wxss|wxs)$/.test(rel)) continue
    const text = fs.readFileSync(path.join(ROOT, rel), 'utf8')
    for (const spec of specsOf(rel, text)) {
      const target = resolveSpec(rel, spec)
      if (target && (target === SUB_ROOT || target.indexOf(SUB_ROOT + '/') === 0)) bad.push(rel + ' -> ' + spec)
    }
  }
  assert.deepEqual(bad, [], '这些主包文件引用了分包里的文件，真机上会找不到')
})

test('进入后台菜单页时预下载租赁分包，店员第一次点租赁页不用等', () => {
  const rule = (app.preloadRule || {})['pages/admin/admin']
  assert.ok(rule, 'preloadRule 里缺少 pages/admin/admin')
  assert.ok(rule.packages.includes('rentadmin'))
  const names = new Set(app.subPackages.map(s => s.name))
  for (const [page, r] of Object.entries(app.preloadRule || {})) {
    assert.ok(app.pages.includes(page), 'preloadRule 的触发页面没有登记：' + page)
    for (const pkg of r.packages) assert.ok(names.has(pkg) || app.subPackages.some(s => s.root === pkg), '不存在的分包：' + pkg)
  }
})
