const test = require('node:test')
const assert = require('node:assert/strict')
const cover = require('../pages/coach/common/share-cover.js')

function canvasWx(t) {
  const previous = global.wx
  let visible = '', failures = 0, renders = []
  global.wx = {
    createCanvasContext(id) {
      assert.equal(id, cover.CANVAS_ID)
      const ctx = { size: 12, text: [], drawImage(path) { assert.equal(path, cover.BACKGROUND) },
        setTextAlign() {}, setTextBaseline() {}, setFillStyle() {}, setFontSize(n) { this.size = n },
        measureText(text) { return { width: Array.from(text).length * this.size } },
        fillText(text) { this.text.push(text) },
        draw(_, done) { const value = this.text.join(''); renders.push(value); setTimeout(() => { visible = value; done() }, 2) }
      }
      return ctx
    },
    canvasToTempFilePath(options) {
      setTimeout(() => {
        if (failures) { failures--; options.fail(new Error('failed')); return }
        options.success({ tempFilePath: 'wxfile://' + visible })
      }, 2)
    }
  }
  t.after(() => { global.wx = previous })
  return { renders, failNext() { failures++ } }
}
function page(rows) {
  return { _membershipCanvasReady: true, data: { templates: rows }, setData(patch) { Object.assign(this.data, patch) } }
}

test('同一页面并发准备多个卡种，封面名称与卡种一一对应，重复名称复用图片', async t => {
  const fake = canvasWx(t)
  const p = page([{ id: 1, name: '学员卡' }, { id: 2, name: '教练卡' }, { id: 3, name: '学员卡' }])
  cover.prepareList(p, 'templates', '学员卡')
  cover.prepareList(p, 'templates', '学员卡')
  await p._membershipCoverState.queue
  await Promise.resolve()
  assert.deepEqual(fake.renders, ['学员卡', '教练卡'])
  assert.deepEqual(p.data.templates.map(x => x.coverPath), ['wxfile://学员卡', 'wxfile://教练卡', 'wxfile://学员卡'])
  assert.ok(p.data.templates.every(x => !x.coverError))
})

test('封面生成失败时不复用其他卡的图片，重试成功后可分享', async t => {
  const fake = canvasWx(t)
  fake.failNext()
  const p = page([{ id: 1, name: '教练卡' }])
  cover.prepareList(p, 'templates', '学员卡')
  await p._membershipCoverState.queue
  await Promise.resolve()
  assert.equal(p.data.templates[0].coverPath, '')
  assert.equal(p.data.templates[0].coverError, true)
  cover.retry(p, 'templates', '教练卡', '学员卡')
  await p._membershipCoverState.queue
  await Promise.resolve()
  assert.equal(p.data.templates[0].coverPath, 'wxfile://教练卡')
  assert.equal(p.data.templates[0].coverError, false)
})

test('较长名称自动缩小并换行，保留完整名称', () => {
  const ctx = { size: 12, setFontSize(n) { this.size = n }, measureText(text) { return { width: Array.from(text).length * this.size } } }
  const name = '雪山训练营会员资格专属卡'.repeat(3)
  const result = cover.layout(ctx, name)
  assert.equal(result.lines.join(''), name)
  assert.ok(result.lines.length <= 2)
  assert.ok(result.lines.every(x => ctx.measureText(x).width <= 330))
  assert.ok(result.fontSize < 64)
})
