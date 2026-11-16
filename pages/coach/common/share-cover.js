// 动态生成会籍卡分享封面。每个页面串行复用一个 canvas，按卡名缓存临时图片。
const FALLBACK = '/pages/coach/assets/membership-share-cover.jpg'
const BACKGROUND = '/pages/coach/assets/membership-share-background.jpg'
const CANVAS_ID = 'membershipShareCover'
const WIDTH = 500, HEIGHT = 400, TEXT_WIDTH = 330, TEXT_HEIGHT = 72

function normalizedName(name) { return String(name || '学员卡').replace(/\s+/g, ' ').trim() || '学员卡' }

function stateFor(page) {
  if (!page._membershipCoverState) page._membershipCoverState = { items: Object.create(null), queue: Promise.resolve() }
  return page._membershipCoverState
}

function wrap(ctx, text) {
  const lines = []
  let line = ''
  for (const ch of Array.from(text)) {
    const next = line + ch
    if (line && ctx.measureText(next).width > TEXT_WIDTH) { lines.push(line); line = ch } else line = next
  }
  if (line) lines.push(line)
  return lines
}

function layout(ctx, name) {
  const text = normalizedName(name)
  let lines = [text], fontSize = 64
  for (; fontSize > 6; fontSize -= 2) {
    ctx.setFontSize(fontSize)
    lines = wrap(ctx, text)
    if (lines.length <= 2 && lines.length * fontSize * 1.08 <= TEXT_HEIGHT) break
  }
  return { lines, fontSize }
}

function render(page, name) {
  return new Promise((resolve, reject) => {
    try {
      const ctx = wx.createCanvasContext(CANVAS_ID, page)
      ctx.drawImage(BACKGROUND, 0, 0, WIDTH, HEIGHT)
      ctx.setTextAlign('center')
      ctx.setTextBaseline('middle')
      ctx.setFillStyle('#ffffff')
      const text = layout(ctx, name)
      ctx.setFontSize(text.fontSize)
      const step = text.fontSize * 1.08
      text.lines.forEach((line, i) => ctx.fillText(line, WIDTH / 2, 175 + (i - (text.lines.length - 1) / 2) * step))
      ctx.draw(false, () => {
        try {
          wx.canvasToTempFilePath({
            canvasId: CANVAS_ID, x: 0, y: 0, width: WIDTH, height: HEIGHT, destWidth: 1000, destHeight: 800,
            fileType: 'jpg', quality: 0.9,
            success: r => r && r.tempFilePath ? resolve(r.tempFilePath) : reject(new Error('没有生成封面')),
            fail: reject
          }, page)
        } catch (err) { reject(err) }
      })
    } catch (err) { reject(err) }
  })
}

function prepare(page, name) {
  const key = normalizedName(name), state = stateFor(page)
  if (state.items[key]) return state.items[key].promise
  const item = { status: 'loading', path: '', promise: null }
  const job = state.queue.then(() => render(page, key)).then(path => {
    item.status = 'ready'; item.path = path; return path
  }, err => { item.status = 'error'; throw err })
  item.promise = job
  state.items[key] = item
  state.queue = job.catch(() => {})
  return job
}

function decorate(page, rows, defaultName) {
  const items = stateFor(page).items
  return (rows || []).map(row => {
    const state = items[normalizedName(row.name || defaultName)]
    return Object.assign({}, row, { coverPath: state && state.status === 'ready' ? state.path : '', coverError: !!state && state.status === 'error' })
  })
}

function prepareList(page, field, defaultName) {
  if (!page._membershipCanvasReady || page._membershipCanvasClosed) return
  const rows = page.data[field] || []
  const names = [...new Set(rows.map(row => normalizedName(row.name || defaultName)))]
  const update = () => {
    if (!page._membershipCanvasClosed) page.setData({ [field]: decorate(page, page.data[field], defaultName) })
  }
  names.forEach(name => prepare(page, name).then(update, update))
}

function retry(page, field, name, defaultName) {
  const key = normalizedName(name || defaultName), state = stateFor(page)
  if (state.items[key] && state.items[key].status === 'error') delete state.items[key]
  page.setData({ [field]: decorate(page, page.data[field], defaultName) })
  prepareList(page, field, defaultName)
}

module.exports = { FALLBACK, BACKGROUND, CANVAS_ID, layout, prepare, decorate, prepareList, retry }
