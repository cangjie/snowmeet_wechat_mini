// 养护「维修」留证：有维修任务的装备，维修前、维修后各要上传至少 1 张照片或视频，并且分开。
//   存法：care_image.title = '维修前' / '维修后'（不加表不加列）；开始维修前要有维修前的，结束维修前要有维修后的。
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { loadPage, tap } = require('./reception_harness.js')
const media = require('../utils/care_repair_media.js')
const rows = require('../utils/care_order_rows.js')

const HOST = 'https://img.example'
const img = (id, title, file, thumb, extra) => Object.assign({
  id, care_id: 7, image_id: id + 100, title, valid: true,
  image: { id: id + 100, file_path_name: file, thumb: thumb || null, thumbUrl: thumb || file }
}, extra || {})

// ---------------- 公共函数 ----------------
test('阶段：只有「维修前」「维修后」算留证（前后空格不影响），空的和别的标题都是普通装备照片', () => {
  assert.equal(media.isRepairStage('维修前'), true)
  assert.equal(media.isRepairStage(' 维修后 '), true)
  for (const t of [null, undefined, '', '安全检查', '维修', '维修前后']) assert.equal(media.isRepairStage(t), false, String(t))
})

test('是不是视频：按文件扩展名（大小写不管、带查询串也行）', () => {
  for (const p of ['/upload/20261114/a.mp4', '/upload/x/B.MOV', 'https://img.example/u/c.m4v?x=1', '/u/d.webm']) assert.equal(media.isVideoPath(p), true, p)
  for (const p of ['/upload/a.jpg', '/upload/a.png', '/upload/a', '', null]) assert.equal(media.isVideoPath(p), false, String(p))
})

test('展示项：图片用缩略图（没有就原图）；视频用封面图，没有封面就不放图（页面显示灰底 + 播放标）', () => {
  const photo = media.toMediaItem(img(1, '维修前', '/upload/a.jpg', '/upload/a_t.jpg'), HOST)
  assert.deepEqual([photo.isVideo, photo.url, photo.poster, photo.stage], [false, HOST + '/upload/a.jpg', HOST + '/upload/a_t.jpg', '维修前'])
  const photoNoThumb = media.toMediaItem(img(2, '维修后', '/upload/b.jpg'), HOST)
  assert.equal(photoNoThumb.poster, HOST + '/upload/b.jpg')
  const video = media.toMediaItem(img(3, '维修前', '/upload/c.mp4', '/upload/c_cover.jpg'), HOST)
  assert.deepEqual([video.isVideo, video.url, video.poster], [true, HOST + '/upload/c.mp4', HOST + '/upload/c_cover.jpg'])
  const noCover = media.toMediaItem(img(4, '维修前', '/upload/d.mp4'), HOST)
  assert.deepEqual([noCover.isVideo, noCover.poster], [true, ''])
  const coverIsVideo = media.toMediaItem(img(5, '维修前', '/upload/e.mp4', '/upload/e.mov'), HOST)   // 封面地址其实是视频：不能当图用
  assert.equal(coverIsVideo.poster, '')
})

test('分堆：普通装备照片 / 维修前 / 维修后；作废的行不算；顺序保持', () => {
  const g = media.groupCareImages([
    img(1, null, '/upload/e1.jpg'), img(2, '维修前', '/upload/b1.jpg'), img(3, '维修后', '/upload/a1.mp4'),
    img(4, '维修前', '/upload/b2.jpg'), img(5, '', '/upload/e2.jpg'), img(6, '维修后', '/upload/a2.jpg', null, { valid: false }),
    null
  ], HOST)
  assert.deepEqual(g.equipment.map(i => i.id), [1, 5])
  assert.deepEqual(g.before.map(i => i.id), [2, 4])
  assert.deepEqual(g.after.map(i => i.id), [3])
})

test('有没有维修任务：只认有效的「维修」任务', () => {
  assert.equal(media.hasRepairTask([{ task_name: '修刃' }, { task_name: '维修', valid: 1 }]), true)
  assert.equal(media.hasRepairTask([{ task_name: '维修' }]), true)
  assert.equal(media.hasRepairTask([{ task_name: '维修', valid: 0 }]), false)
  assert.equal(media.hasRepairTask([{ task_name: '修刃' }]), false)
  assert.equal(media.hasRepairTask(null), false)
})

test('开始 / 结束维修的检查：开始要有维修前，结束要有维修后；普通装备照片不算', () => {
  const equipmentOnly = [img(1, null, '/upload/e.jpg')]
  const before = equipmentOnly.concat([img(2, '维修前', '/upload/b.jpg')])
  const both = before.concat([img(3, '维修后', '/upload/a.mp4')])
  assert.match(media.repairGate(equipmentOnly, 'start'), /维修前/)
  assert.equal(media.repairGate(before, 'start'), '')
  assert.match(media.repairGate(before, 'end'), /维修后/)
  assert.equal(media.repairGate(both, 'end'), '')
  assert.match(media.repairGate([img(2, '维修前', '/upload/b.jpg', null, { valid: false })], 'start'), /维修前/)   // 作废的不算
  assert.match(media.repairGate(null, 'start'), /维修前/)
})

test('追加一行：其余行原样保留（去掉导航对象），新行 id=0、带阶段；不改原数组', () => {
  const original = [img(1, null, '/upload/e.jpg'), img(2, '维修前', '/upload/b.jpg')]
  const out = media.withNewMediaRow(original, 7, 555, '维修后')
  assert.equal(out.length, 3)
  assert.deepEqual(out[0], { id: 1, care_id: 7, image_id: 101, title: null, valid: true })
  assert.deepEqual(out[1], { id: 2, care_id: 7, image_id: 102, title: '维修前', valid: true })
  assert.deepEqual(out[2], { id: 0, care_id: 7, image_id: 555, title: '维修后', valid: true })
  assert.ok(original[0].image, '原数组没被改')
})

test('删掉一行：只去掉指定的行，其余原样保留', () => {
  const out = media.withoutMediaRow([img(1, null, '/upload/e.jpg'), img(2, '维修前', '/upload/b.jpg'), img(3, '维修后', '/upload/a.jpg')], 7, 2)
  assert.deepEqual(out.map(i => i.id), [1, 3])
  assert.ok(out.every(i => !('image' in i) && !('care' in i)))
})

test('选到的文件：没路径不行；其余都放行——不限制文件大小（nginx 1000M、后端不设上限、文件直接进 S3）', () => {
  assert.ok(media.checkPickedFile(null))
  assert.ok(media.checkPickedFile({}))
  assert.equal(media.checkPickedFile({ tempFilePath: 'a.jpg', size: 1000, fileType: 'image' }), '')
  assert.equal(media.checkPickedFile({ tempFilePath: 'a.mp4', size: 300 * 1024 * 1024, fileType: 'video' }), '')
  assert.equal(media.MAX_MEDIA_BYTES, undefined, '小程序里不再有大小上限')
  assert.equal(media.MAX_VIDEO_SECONDS, 60, '视频时长放到微信允许的最长 60 秒')
})

// ---------------- 别处读装备照片的地方都要把留证滤掉 ----------------
test('订单列表里装备的缩略图和预览原图：不含维修前 / 维修后', () => {
  const care = { id: 7, equipment: '双板', careImages: [
    img(2, '维修前', '/upload/b.jpg', '/upload/b_t.jpg'), img(1, null, '/upload/e.jpg', '/upload/e_t.jpg'), img(3, '维修后', '/upload/a.mp4')
  ], tasks: [] }
  const [r] = rows.buildCareRows([care], HOST)
  assert.equal(r.thumb, HOST + '/upload/e_t.jpg')
  assert.deepEqual(r.photos, [HOST + '/upload/e.jpg'])
  const [onlyRepair] = rows.buildCareRows([{ id: 8, equipment: '双板', careImages: [img(2, '维修前', '/upload/b.jpg')], tasks: [] }], HOST)
  assert.equal(onlyRepair.thumb, '')
  assert.deepEqual(onlyRepair.photos, [])
})

test('未取列表、关联装备摘要也过滤留证（源码里都走 isRepairStage）', () => {
  for (const f of ['pages/admin/care/care_unpicked_list.js', 'components/linked-care-summary/index.js']) {
    const src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8')
    assert.match(src, /care_repair_media\.js/, f)
    assert.match(src, /isRepairStage\(/, f)
  }
})

// ---------------- 详情页 ----------------
const PAGE = 'pages/admin/care/care_order_detail/care_order_detail.js'
const taskOf = (name, status, sort, extra) => Object.assign({ id: sort + 1, care_id: 7, task_name: name, status, sort, valid: 1 }, extra || {})

function detail(options) {
  const opts = options || {}
  const calls = { upload: [], getOrder: 0, update: [], status: [], toasts: [], modals: [], chooseMedia: [], preview: [], loading: [] }
  const globalData = { sessionKey: 'sk', staff: { id: 5, title_level: 100 } }
  global.getApp = () => ({ loginPromiseNew: Promise.resolve(), globalData })
  global.wx = {
    showToast(o) { calls.toasts.push(o.title) },
    showModal(o) { calls.modals.push(o) },
    showLoading(o) { calls.loading.push(o.title) },
    hideLoading() {},
    chooseMedia(o) { calls.chooseMedia.push(o) },
    previewMedia(o) { calls.preview.push(o) },
    pageScrollTo() {}
  }
  const fresh = () => JSON.parse(JSON.stringify(opts.serverCare || { id: 7, order_id: 11, careImages: [], tasks: [] }))
  const fakeData = {
    IMAGE_HOST: HOST,
    uploadFilePromise(mainId, filePath, purpose, type) {
      calls.upload.push({ mainId, filePath, purpose, type })
      if (opts.uploadFails && !mainId) return Promise.reject(new Error('413'))
      const id = mainId || (900 + calls.upload.length)
      return Promise.resolve({ id, file_path_name: '/upload/new' + id + (type === 'video' ? '.mp4' : '.jpg'), thumb: mainId ? '/upload/thumb' + id + '.jpg' : null })
    },
    getOrderByStaffPromise() { calls.getOrder++; return Promise.resolve({ id: 11, cares: [fresh()] }) },
    updateCarePromise(payload, scene) { calls.update.push({ payload, scene }); return Promise.resolve({}) },
    updateCareTaskStatusPromise(id, status) { calls.status.push([id, status]); return Promise.resolve({}) },
    getOrderByStaffPromiseCalls: 0
  }
  const page = loadPage(PAGE, fakeData)
  delete global.getApp
  page._uiState = { expanded: {}, veriType: {}, safeCheck: {}, cancelReason: {} }
  page.setData({ orderId: 11 })
  page.loadOrder = () => { calls.reloaded = (calls.reloaded || 0) + 1 }
  return { page, calls, done() { delete global.wx } }
}

function renderedCare(page, careImages, tasks, extra) {
  const care = Object.assign({ id: 7, order_id: 11, equipment: '双板', brand: 'ATOMIC', scale: '170', careImages, tasks, repair_memo: '补板底' }, extra || {})
  return page._renderCare(care)
}
const standardTasks = (repairStatus, extra) => [
  taskOf('安全检查', '已完成', 10), taskOf('修刃', '已完成', 20), taskOf('维修', repairStatus, 30, extra), taskOf('发板', '未开始', 60)
]

test('详情页渲染：装备照片只放普通照片；维修前 / 维修后单独放；有维修任务才有留证区，没做完才能增删', () => {
  const { page, done } = detail()
  const images = [img(1, null, '/upload/e.jpg', '/upload/e_t.jpg'), img(2, '维修前', '/upload/b.jpg'), img(3, '维修后', '/upload/a.mp4', '/upload/a_c.jpg')]
  const care = renderedCare(page, images, standardTasks('未开始'))
  assert.deepEqual(care._photos.map(p => p.id), [1])
  assert.deepEqual(care._repairBefore.map(m => m.id), [2])
  assert.deepEqual(care._repairAfter.map(m => [m.id, m.isVideo]), [[3, true]])
  assert.equal(care._hasRepairTask, true)
  assert.equal(care._repairEditable, true)
  // 维修做完：只能看
  const finished = renderedCare(page, images, standardTasks('已完成'))
  assert.equal(finished._hasRepairTask, true)
  assert.equal(finished._repairEditable, false)
  const aborted = renderedCare(page, images, standardTasks('强行中止'))
  assert.equal(aborted._repairEditable, false)
  // 取消的装备不能再传
  assert.equal(renderedCare(page, images, standardTasks('未开始'), { is_cancel: true })._repairEditable, false)
  // 没有维修任务：没有留证区
  const noRepair = renderedCare(page, images.slice(0, 1), [taskOf('安全检查', '已完成', 10), taskOf('发板', '未开始', 60)])
  assert.equal(noRepair._hasRepairTask, false)
  assert.equal(noRepair._repairEditable, false)
  done()
})

test('安全检查要的装备照片只看普通照片：只有维修前后的留证不算有装备照片', () => {
  const { page, done } = detail()
  const care = renderedCare(page, [img(2, '维修前', '/upload/b.jpg')], standardTasks('未开始'))
  assert.deepEqual(care._photos, [])
  done()
})

test('维修任务的提示：没传维修前就提醒先传；开始后没传维修后提醒先传', () => {
  const { page, done } = detail()
  const repairHint = care => care._tasks.find(t => t.task_name === '维修')._hint
  assert.match(repairHint(renderedCare(page, [], standardTasks('未开始'))), /先在下面上传维修前/)
  assert.match(repairHint(renderedCare(page, [img(2, '维修前', '/upload/b.jpg')], standardTasks('未开始'))), /实际开始操作时/)
  assert.match(repairHint(renderedCare(page, [img(2, '维修前', '/upload/b.jpg')], standardTasks('已开始', { staff_id: 5, start_time: new Date().toISOString() }))), /先在下面上传维修后/)
  assert.match(repairHint(renderedCare(page, [img(2, '维修前', '/upload/b.jpg'), img(3, '维修后', '/upload/a.jpg')], standardTasks('已开始', { staff_id: 5, start_time: new Date().toISOString() }))), /及时点击结束/)
  done()
})

function withRendered(page, care) {
  page.setData({ cares: [care] })
  return care
}

test('点「开始维修」：没有维修前的照片 / 视频就提示、不开始；有了才弹确认', () => {
  const { page, calls, done } = detail()
  withRendered(page, renderedCare(page, [img(1, null, '/upload/e.jpg')], standardTasks('未开始')))
  page.onTaskStart(tap({ cidx: 0, taskId: 31, taskName: '维修' }))
  assert.deepEqual(calls.toasts, ['请先上传维修前的照片或视频'])
  assert.deepEqual(calls.modals, [])
  assert.deepEqual(calls.status, [])
  withRendered(page, renderedCare(page, [img(1, null, '/upload/e.jpg'), img(2, '维修前', '/upload/b.mp4')], standardTasks('未开始')))
  page.onTaskStart(tap({ cidx: 0, taskId: 31, taskName: '维修' }))
  assert.equal(calls.modals.length, 1)
  assert.equal(calls.modals[0].title, '开始任务')
  done()
})

test('其它任务（修刃、打蜡…）开始不受留证影响', () => {
  const { page, calls, done } = detail()
  withRendered(page, renderedCare(page, [], standardTasks('未开始')))
  page.onTaskStart(tap({ cidx: 0, taskId: 21, taskName: '修刃' }))
  assert.deepEqual(calls.toasts, [])
  assert.equal(calls.modals.length, 1)
  done()
})

test('点「结束维修」：没有维修后的照片 / 视频就提示、不结束；有了才弹确认', () => {
  const { page, calls, done } = detail()
  const running = standardTasks('已开始', { staff_id: 5, start_time: new Date(Date.now() - 600000).toISOString() })
  withRendered(page, renderedCare(page, [img(2, '维修前', '/upload/b.jpg')], running))
  page.onTaskEnd(tap({ cidx: 0, taskId: 31 }))
  assert.deepEqual(calls.toasts, ['请先上传维修后的照片或视频'])
  assert.deepEqual(calls.modals, [])
  withRendered(page, renderedCare(page, [img(2, '维修前', '/upload/b.jpg'), img(3, '维修后', '/upload/a.jpg')], running))
  page.onTaskEnd(tap({ cidx: 0, taskId: 31 }))
  assert.equal(calls.modals.length, 1)
  assert.equal(calls.modals[0].title, '确认任务结束')
  done()
})

test('强行中止别人正在做的维修：不查留证（只是中止，不是完成）', () => {
  const { page, calls, done } = detail()
  const others = standardTasks('已开始', { staff_id: 99, start_time: new Date().toISOString() })
  withRendered(page, renderedCare(page, [], others))
  page.onTaskEnd(tap({ cidx: 0, taskId: 31 }))
  assert.deepEqual(calls.toasts, [])
  assert.equal(calls.modals.length, 1)
  assert.equal(calls.modals[0].title, '确认强行中止任务')
  done()
})

// ---- 选 / 传 / 看 / 删 ----
test('点「+」：用相机 / 相册选照片或视频，视频最长 60 秒；维修前、维修后各自带对应阶段；还能放几个就选几个', () => {
  const { page, calls, done } = detail()
  const images = [img(2, '维修前', '/upload/b1.jpg'), img(3, '维修前', '/upload/b2.jpg')]
  withRendered(page, renderedCare(page, images, standardTasks('未开始')))
  page.onRepairMediaAdd(tap({ cidx: 0, stage: 'before' }))
  page.onRepairMediaAdd(tap({ cidx: 0, stage: 'after' }))
  assert.equal(calls.chooseMedia.length, 2)
  const [b, a] = calls.chooseMedia
  assert.deepEqual(b.mediaType, ['image', 'video'])
  assert.deepEqual(b.sourceType, ['camera', 'album'])
  assert.equal(b.maxDuration, 60)
  assert.equal(b.count, 7)    // 维修前已有 2 个，最多 9 个
  assert.equal(a.count, 9)
  done()
})

test('留证区放满 9 个、维修已做完、取消的装备：点「+」没反应或提示', () => {
  const { page, calls, done } = detail()
  const nine = Array.from({ length: 9 }, (_, i) => img(10 + i, '维修前', '/upload/b' + i + '.jpg'))
  withRendered(page, renderedCare(page, nine, standardTasks('未开始')))
  page.onRepairMediaAdd(tap({ cidx: 0, stage: 'before' }))
  assert.deepEqual(calls.toasts, ['最多放 9 个'])
  withRendered(page, renderedCare(page, [], standardTasks('已完成')))
  page.onRepairMediaAdd(tap({ cidx: 0, stage: 'before' }))
  assert.deepEqual(calls.chooseMedia, [])
  done()
})

test('上传一张照片：传文件 → 读最新装备 → 追加一行「维修前」（其余行原样保留）→ 提交；照片不再单独传缩略图', async () => {
  const server = { id: 7, order_id: 11, careImages: [img(1, null, '/upload/e.jpg'), img(2, '维修前', '/upload/b.jpg')], tasks: standardTasks('未开始') }
  const { page, calls, done } = detail({ serverCare: server })
  await page._uploadRepairMedia(7, '维修前', [{ tempFilePath: 'wxfile://p1.jpg', size: 2000, fileType: 'image' }])
  assert.equal(calls.upload.length, 1)
  assert.deepEqual([calls.upload[0].mainId, calls.upload[0].purpose, calls.upload[0].type], [null, '养护维修前', 'image'])
  assert.equal(calls.getOrder, 1)
  assert.equal(calls.update.length, 1)
  const sent = calls.update[0].payload.careImages
  assert.deepEqual(sent.map(i => [i.id, i.title]), [[1, null], [2, '维修前'], [0, '维修前']])
  assert.equal(sent[2].image_id, 901)
  assert.equal(calls.update[0].scene, '养护维修前上传')
  assert.deepEqual(calls.update[0].payload.tasks, server.tasks)
  assert.equal(calls.reloaded, 1)
  assert.equal(calls.toasts.at(-1), '已上传')
  done()
})

test('上传一个视频：视频本身 + 封面图各传一次，存的是视频那一条；封面传不上也能存', async () => {
  const { page, calls, done } = detail()
  await page._uploadRepairMedia(7, '维修后', [{ tempFilePath: 'wxfile://v1.mp4', thumbTempFilePath: 'wxfile://v1.jpg', size: 5000000, fileType: 'video' }])
  assert.equal(calls.upload.length, 2)
  assert.deepEqual([calls.upload[0].mainId, calls.upload[0].purpose, calls.upload[0].type], [null, '养护维修后', 'video'])
  assert.deepEqual([calls.upload[1].mainId, calls.upload[1].filePath], [901, 'wxfile://v1.jpg'])
  const row = calls.update[0].payload.careImages.at(-1)
  assert.deepEqual([row.id, row.image_id, row.title], [0, 901, '维修后'])
  done()
})

test('一次选了几个：一个一个传，每个都读最新装备再追加；再大的视频也不拦', async () => {
  const { page, calls, done } = detail()
  await page._uploadRepairMedia(7, '维修前', [
    { tempFilePath: 'a.jpg', size: 1000, fileType: 'image' },
    { tempFilePath: 'big.mp4', size: 250 * 1024 * 1024, fileType: 'video' },
    { tempFilePath: 'c.jpg', size: 1000, fileType: 'image' }
  ])
  assert.equal(calls.upload.length, 3)
  assert.equal(calls.getOrder, 3)
  assert.equal(calls.update.length, 3)
  assert.deepEqual(calls.toasts, ['已上传'])
  assert.deepEqual(calls.loading, ['上传中 1/3', '上传中 2/3', '上传中 3/3'])
  done()
})

test('没选到文件（路径是空的）：跳过，不上传', async () => {
  const { page, calls, done } = detail()
  await page._uploadRepairMedia(7, '维修前', [{ size: 1000, fileType: 'image' }, null])
  assert.equal(calls.upload.length, 0)
  assert.equal(calls.update.length, 0)
  assert.match(calls.toasts[0], /没有选到文件/)
  done()
})

test('上传失败：不提交、提示失败数量，仍刷新；失败后还能再传', async () => {
  const { page, calls, done } = detail({ uploadFails: true })
  await page._uploadRepairMedia(7, '维修前', [{ tempFilePath: 'a.jpg', size: 1000, fileType: 'image' }])
  assert.equal(calls.update.length, 0)
  assert.match(calls.toasts.at(-1), /成功 0 个，失败 1 个/)
  assert.equal(page._repairBusy, false)
  assert.equal(calls.reloaded, 1)
  done()
})

test('点缩略图：照片、视频一起预览，从点的那个开始', () => {
  const { page, calls, done } = detail()
  withRendered(page, renderedCare(page, [img(2, '维修前', '/upload/b.jpg', '/upload/b_t.jpg'), img(3, '维修前', '/upload/c.mp4', '/upload/c.jpg')], standardTasks('未开始')))
  page.onRepairMediaTap(tap({ cidx: 0, stage: 'before', idx: 1 }))
  assert.equal(calls.preview.length, 1)
  assert.equal(calls.preview[0].current, 1)
  assert.deepEqual(calls.preview[0].sources, [
    { url: HOST + '/upload/b.jpg', type: 'image' },
    { url: HOST + '/upload/c.mp4', type: 'video', poster: HOST + '/upload/c.jpg' }
  ])
  done()
})

test('删除留证：先确认；确认后只去掉这一行，其余原样保留；普通装备照片不能在这里删', async () => {
  const server = { id: 7, order_id: 11, careImages: [img(1, null, '/upload/e.jpg'), img(2, '维修前', '/upload/b.jpg'), img(3, '维修后', '/upload/a.jpg')], tasks: [] }
  const { page, calls, done } = detail({ serverCare: server })
  withRendered(page, renderedCare(page, server.careImages, standardTasks('未开始')))
  page.onRepairMediaRemove(tap({ cidx: 0, id: 2 }))
  assert.equal(calls.modals.length, 1)
  assert.equal(calls.update.length, 0)
  await page._removeRepairMedia(7, 2)
  assert.deepEqual(calls.update[0].payload.careImages.map(i => i.id), [1, 3])
  await page._removeRepairMedia(7, 1)          // 普通装备照片：拒绝
  assert.equal(calls.update.length, 1)
  assert.equal(calls.toasts.at(-1), '删除失败')
  done()
})

test('维修做完之后不能再删（没有确认弹窗、没有请求）', () => {
  const { page, calls, done } = detail()
  withRendered(page, renderedCare(page, [img(2, '维修前', '/upload/b.jpg')], standardTasks('已完成')))
  page.onRepairMediaRemove(tap({ cidx: 0, id: 2 }))
  assert.deepEqual(calls.modals, [])
  done()
})

test('保存装备信息：编辑面板里只有普通装备照片，维修前后的留证原样带上，不会被后端当成删掉的照片', () => {
  const images = [img(1, null, '/upload/e.jpg'), img(2, '维修前', '/upload/b.jpg'), img(3, '维修后', '/upload/a.mp4')]
  const { page, calls, done } = detail()
  const care = withRendered(page, renderedCare(page, images, standardTasks('未开始')))
  page._rawCares = [JSON.parse(JSON.stringify({ id: 7, order_id: 11, careImages: images, tasks: standardTasks('未开始') }))]
  page.onEditTap(tap({ cidx: 0 }))
  assert.deepEqual(page.data.cares[0]._photoFiles.map(f => f.id), [1], '编辑面板只显示普通装备照片')
  void care
  page.onEditSave(tap({ cidx: 0 }))
  // updateCarePromise 在假数据里被调用一次
  assert.equal(calls.update.length, 1)
  const sent = calls.update[0].payload.careImages
  assert.deepEqual(sent.map(i => [i.id, i.title || null]).sort((x, y) => x[0] - y[0]), [[1, null], [2, '维修前'], [3, '维修后']])
  done()
})

// ---------------- 页面结构 ----------------
const wxml = fs.readFileSync(path.join(__dirname, '..', 'pages/admin/care/care_order_detail/care_order_detail.wxml'), 'utf8')

test('页面：维修任务下面有留证区，维修前、维修后各一排，传的入口和删除只在能编辑时出现', () => {
  const panel = wxml.slice(wxml.indexOf("task.task_name === '维修' && care._hasRepairTask"), wxml.indexOf('<!-- 安全检查录入区 -->'))
  assert.match(panel, /维修前 \*/)
  assert.match(panel, /维修后 \*/)
  assert.equal((panel.match(/catchtap="onRepairMediaAdd"/g) || []).length, 2)
  assert.match(panel, /data-stage="before"[^>]*catchtap="onRepairMediaAdd"/)
  assert.match(panel, /data-stage="after"[^>]*catchtap="onRepairMediaAdd"/)
  assert.equal((panel.match(/care\._repairEditable/g) || []).length >= 4, true)
  assert.match(panel, /bindtap="onRepairMediaTap"/)
  assert.match(panel, /catchtap="onRepairMediaRemove"/)
  assert.match(panel, /repair-tile-play/)
  assert.match(panel, /care\._repairBefore/)
  assert.match(panel, /care\._repairAfter/)
})

test('页面：留证区不在装备信息的「装备照片」里，那里仍只放普通装备照片', () => {
  assert.match(wxml, /care\._photos/)
  assert.doesNotMatch(wxml.slice(wxml.indexOf('<!-- 照片 -->'), wxml.indexOf('<!-- 照片 -->') + 400), /_repair/)
})

test('页面提示：视频最长 60 秒，不再写大小限制', () => {
  assert.match(wxml, /视频最长 60 秒/)
  assert.doesNotMatch(wxml, /20MB/)
})

test('app.json：上传超时放宽到 5 分钟（默认 60 秒，大视频在手机网络上不够）', () => {
  const app = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'app.json'), 'utf8'))
  assert.equal(app.networkTimeout.uploadFile, 300000)
})
