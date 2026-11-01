// 手机号后面的「复制」按钮。
// 2026-11-01：小程序里所有显示手机号的地方，号码后面都要有一个「复制」按钮，点一下把显示的号码复制到剪贴板。
// 规则：完整号码才出按钮；脱敏号（138****1234）、尾号、「未绑定」「—」这类占位文字不出（复制出去没用）。
// 最后一组测试扫描所有页面和组件的 wxml：以后谁新加了显示手机号的地方却没挂按钮，这里会失败。
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const { copyablePhone, copyPhone } = require('../utils/phone_copy.js')

// ---------- 纯规则 ----------

test('完整手机号可以复制，原样复制显示出来的文字', () => {
  assert.equal(copyablePhone('13501177897'), '13501177897')
  assert.equal(copyablePhone(' 135 0117 7897 '), '135 0117 7897')
  assert.equal(copyablePhone('135-0117-7897'), '135-0117-7897')
  assert.equal(copyablePhone('+8613501177897'), '+8613501177897')
  assert.equal(copyablePhone(13501177897), '13501177897', '后端偶尔把号码当数字返回')
})

test('会员的联系手机号是多个号码用「、」连起来显示的，整串复制', () => {
  assert.equal(copyablePhone('13501177897、13601177898'), '13501177897、13601177898')
})

test('占位文字、脱敏号、尾号、太短的数字都不出按钮', () => {
  const notCopyable = [
    '', '   ', null, undefined, '-', '--', '—', '未绑定', '未绑定手机', '未绑定手机号', '（无手机号）', '未留手机', '无手机号',
    '135****7897', '尾号 7897', '7897', '123456', '手机 13501177897', 'ID 12 · 13501177897',
  ]
  for (const value of notCopyable) {
    assert.equal(copyablePhone(value), '', `${JSON.stringify(value)} 不应该出复制按钮`)
  }
})

test('copyPhone 把号码交给 wx.setClipboardData；不是完整号码就什么都不做', () => {
  const calls = []
  const wxApi = {
    setClipboardData(options) { calls.push(options) },
    showToast() { throw new Error('成功路径不应该再弹提示，微信自己会弹「内容已复制」') },
  }
  assert.equal(copyPhone('13501177897', wxApi), true)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].data, '13501177897')

  assert.equal(copyPhone('135****7897', wxApi), false)
  assert.equal(copyPhone('未绑定', wxApi), false)
  assert.equal(calls.length, 1, '脱敏号、占位文字不能写进剪贴板')
})

test('复制失败要提示，不能静默', () => {
  const toasts = []
  const wxApi = {
    setClipboardData(options) { options.fail({ errMsg: 'setClipboardData:fail' }) },
    showToast(options) { toasts.push(options) },
  }
  copyPhone('13501177897', wxApi)
  assert.equal(toasts.length, 1)
  assert.match(toasts[0].title, /复制失败/)
})

// ---------- 组件 ----------

function loadComponent() {
  const componentPath = require.resolve('../components/phone_copy/phone_copy.js')
  delete require.cache[componentPath]
  let definition = null
  global.Component = value => { definition = value }
  require(componentPath)
  delete global.Component
  delete require.cache[componentPath]
  const instance = {
    data: Object.assign({}, definition.data, { phone: '' }),
    setData(values) { Object.assign(this.data, values) },
  }
  Object.keys(definition.methods).forEach(name => { instance[name] = definition.methods[name].bind(instance) })
  return { definition, instance }
}

test('组件：传完整号码才显示按钮，点一下复制显示的号码', () => {
  const calls = []
  global.wx = { setClipboardData(options) { calls.push(options) }, showToast() {} }
  try {
    const { definition, instance } = loadComponent()
    assert.equal(definition.properties.phone.observer, 'refresh', '号码变了要重新判断')
    assert.ok(definition.lifetimes && typeof definition.lifetimes.attached === 'function')

    instance.data.phone = '13501177897'
    definition.lifetimes.attached.call(instance)
    assert.equal(instance.data.text, '13501177897')
    instance.onCopy()
    assert.deepEqual(calls.map(c => c.data), ['13501177897'])

    // 列表里同一个组件被复用，号码变成占位文字时按钮要消失，点不出东西
    instance.data.phone = '未绑定'
    instance.refresh('未绑定')
    assert.equal(instance.data.text, '')
    instance.onCopy()
    assert.equal(calls.length, 1)

    instance.refresh('13601177898')
    assert.equal(instance.data.text, '13601177898')
    instance.onCopy()
    assert.deepEqual(calls.map(c => c.data), ['13501177897', '13601177898'])
  } finally {
    delete global.wx
  }
})

test('组件模板：没有号码不渲染；用 catchtap，点复制不会触发外层的拨号/跳转', () => {
  const wxml = fs.readFileSync(path.join(ROOT, 'components/phone_copy/phone_copy.wxml'), 'utf8')
  assert.match(wxml, /wx:if="\{\{text\}\}"/)
  assert.match(wxml, /catchtap="onCopy"/)
  assert.doesNotMatch(wxml, /\sbindtap=/, 'bindtap 会冒泡到外层，点复制时会一起拨号')
  const json = JSON.parse(fs.readFileSync(path.join(ROOT, 'components/phone_copy/phone_copy.json'), 'utf8'))
  assert.equal(json.component, true)
})

test('app.json 把 phone-copy 注册成全局组件，页面和组件里都能直接用', () => {
  const app = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'))
  assert.equal(app.usingComponents['phone-copy'], '/components/phone_copy/phone_copy')
  for (const ext of ['js', 'json', 'wxml', 'wxss']) {
    assert.ok(fs.existsSync(path.join(ROOT, 'components/phone_copy/phone_copy.' + ext)), '缺少 phone_copy.' + ext)
  }
})

// ---------- 所有显示手机号的地方都挂了按钮 ----------

function walk(dir, out) {
  for (const name of fs.readdirSync(path.join(ROOT, dir))) {
    const rel = dir + '/' + name
    const stat = fs.statSync(path.join(ROOT, rel))
    if (stat.isDirectory()) walk(rel, out)
    else if (name.endsWith('.wxml')) out.push(rel)
  }
  return out
}

// 去掉标签属性里的值（value="{{cell}}"、wx:if="{{phone}}" 这些不是显示出来的文字）
function stripAttributes(line) {
  return line.replace(/\s[\w:\-.]+\s*=\s*("[^"]*"|'[^']*')/g, ' ')
}

const PHONE_BINDING = /\{\{[^}]*(cell|Cell|phone|Phone|mobile|Mobile|contact_num)[^}]*\}\}/g
// 显示出来的不是完整号码，或者变量名里的 cell 是别的意思：不需要复制按钮
const NOT_A_FULL_NUMBER = /[Mm]asked|[Tt]ail|phoneLabel|\bcell\.(day|empty|enabled|priceStr)|job_phone/

function uncoveredPhoneLines(rel) {
  const lines = fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/<!--[\s\S]*?-->/g, m => m.replace(/[^\n]/g, '')).split('\n')
  const problems = []
  lines.forEach((line, i) => {
    const stripped = stripAttributes(line)
    const bindings = stripped.match(PHONE_BINDING) || []
    const shown = bindings.filter(b => !NOT_A_FULL_NUMBER.test(b))
    if (shown.length === 0) return
    // 号码和按钮可能分在相邻的两行（图标、点击拨号的 text 各占一行）
    const nearby = lines.slice(i, i + 3).join('\n')
    if (!nearby.includes('<phone-copy')) problems.push(`${rel}:${i + 1}: ${line.trim().slice(0, 120)}`)
  })
  return problems
}

test('每个显示完整手机号的页面和组件，号码后面都有 <phone-copy>', () => {
  const files = [...walk('pages', []), ...walk('components', [])]
  assert.ok(files.length > 120, '没扫到页面文件，只扫到 ' + files.length)
  const problems = files.flatMap(uncoveredPhoneLines)
  assert.deepEqual(problems, [], '这些地方显示了手机号，但没挂复制按钮（脱敏号/尾号不用挂）')
})

test('扫描规则自检：已知的地方确实被识别为「显示手机号」，脱敏号不算', () => {
  const rentDetail = fs.readFileSync(path.join(ROOT, 'pages/admin/rent/rent_order_detail/rent_order_detail.wxml'), 'utf8')
  assert.match(rentDetail, /<phone-copy phone="\{\{order\.customerCell\}\}"/, '租赁订单明细的手机号后面要有复制按钮')

  const sample = '<text>{{item.customerCell}}</text><text>{{item._proxyCellMasked}}</text><input value="{{cell}}" />'
  const stripped = stripAttributes(sample)
  const bindings = stripped.match(PHONE_BINDING) || []
  assert.deepEqual(bindings, ['{{item.customerCell}}', '{{item._proxyCellMasked}}'], '输入框的 value 不算显示')
  assert.deepEqual(bindings.filter(b => !NOT_A_FULL_NUMBER.test(b)), ['{{item.customerCell}}'])
})

test('挂了按钮的 wxml 标签是配平的（包一层 view 时容易漏闭合）', () => {
  const files = [...walk('pages', []), ...walk('components', [])].filter(rel =>
    fs.readFileSync(path.join(ROOT, rel), 'utf8').includes('<phone-copy'))
  assert.ok(files.length >= 30, '应该有三十多个文件挂了按钮，实际 ' + files.length)
  for (const rel of files) {
    const text = fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/<!--[\s\S]*?-->/g, '')
    for (const tag of ['view', 'text']) {
      const opens = (text.match(new RegExp('<' + tag + '(\\s[^>]*)?>', 'g')) || []).filter(t => !/\/>$/.test(t)).length
      const closes = (text.match(new RegExp('</' + tag + '>', 'g')) || []).length
      assert.equal(opens, closes, `${rel} 的 <${tag}> 开了 ${opens} 个、闭了 ${closes} 个`)
    }
  }
})
