// 小程序分享封面：服务器上的品牌 logo 加当前优惠券模板名称。
const CANVAS_ID = 'staffCouponShareCover'
const LOGO = 'https://mini.snowmeet.top/images/logo.png'
const WIDTH = 500, HEIGHT = 400, TEXT_WIDTH = 420, TEXT_HEIGHT = 130
const TIMEOUT_MS = 8000

function normalize(name) { return String(name || '优惠券').replace(/\s+/g, ' ').trim() || '优惠券' }

function wrap(ctx, text) {
  const lines = []
  let line = ''
  for (const char of Array.from(text)) {
    const next = line + char
    if (line && ctx.measureText(next).width > TEXT_WIDTH) { lines.push(line); line = char } else line = next
  }
  if (line) lines.push(line)
  return lines
}

function layout(ctx, name) {
  const text = normalize(name)
  let lines = [], size = 44
  for (; size > 4; size -= 2) {
    ctx.font = size + 'px sans-serif'
    lines = wrap(ctx, text)
    if (lines.length <= 2 && lines.length * size * 1.25 <= TEXT_HEIGHT) break
  }
  return { lines, size }
}

function render(page, name, timeoutMs) {
  return new Promise((resolve, reject) => {
    let finished = false
    const timer = setTimeout(() => finish(new Error('生成分享封面超时')), timeoutMs || TIMEOUT_MS)
    function finish(err, path) {
      if (finished) return
      finished = true
      clearTimeout(timer)
      if (err) reject(err); else resolve(path)
    }
    try {
      wx.createSelectorQuery().in(page).select('#' + CANVAS_ID).fields({ node: true, size: true }).exec(result => {
        if (finished) return
        try {
          const canvas = result && result[0] && result[0].node
          if (!canvas) return finish(new Error('无法创建分享封面画布'))
          canvas.width = WIDTH; canvas.height = HEIGHT
          const ctx = canvas.getContext('2d')
          const image = canvas.createImage()
          image.onerror = () => finish(new Error('无法加载品牌图片'))
          image.onload = () => {
            if (finished) return
            try {
              ctx.fillStyle = '#eaf6fb'; ctx.fillRect(0, 0, WIDTH, HEIGHT)
              ctx.fillStyle = '#ffffff'; ctx.fillRect(20, 20, 460, 360)
              ctx.drawImage(image, 60, 40, 380, 83)
              ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
              ctx.fillStyle = '#2ea6d0'; ctx.font = '21px sans-serif'; ctx.fillText('优惠券', WIDTH / 2, 155)
              const title = layout(ctx, name)
              ctx.fillStyle = '#182c3d'; ctx.font = title.size + 'px sans-serif'
              const step = title.size * 1.25
              title.lines.forEach((line, i) => ctx.fillText(line, WIDTH / 2, 232 + (i - (title.lines.length - 1) / 2) * step))
              ctx.fillStyle = '#7995a4'; ctx.font = '18px sans-serif'; ctx.fillText('易龙雪聚 · 专属礼遇', WIDTH / 2, 342)
              wx.canvasToTempFilePath({ canvas, x: 0, y: 0, width: WIDTH, height: HEIGHT,
                destWidth: 1000, destHeight: 800, fileType: 'png',
                success: r => r && r.tempFilePath ? finish(null, r.tempFilePath) : finish(new Error('没有生成封面')),
                fail: err => finish(err || new Error('无法导出封面')) }, page)
            } catch (err) { finish(err) }
          }
          wx.getImageInfo({
            src: LOGO,
            success: info => {
              if (finished) return
              if (!info || !info.path) return finish(new Error('无法获取品牌图片'))
              try { image.src = info.path } catch (err) { finish(err) }
            },
            fail: () => finish(new Error('无法下载品牌图片'))
          })
        } catch (err) { finish(err) }
      })
    } catch (err) { finish(err) }
  })
}

// 同一画布串行使用，超时的操作不会阻塞后续重试。
function prepare(page, name, retry, timeoutMs) {
  const key = normalize(name)
  const state = page._couponCoverState || (page._couponCoverState = { items: Object.create(null), queue: Promise.resolve() })
  if (retry && state.items[key] && state.items[key].failed) delete state.items[key]
  if (state.items[key]) return state.items[key].promise
  const item = { failed: false, promise: null }
  item.promise = state.queue.then(() => render(page, key, timeoutMs)).catch(err => { item.failed = true; throw err })
  state.items[key] = item
  state.queue = item.promise.catch(() => {})
  return item.promise
}

module.exports = { CANVAS_ID, LOGO, layout, prepare }
