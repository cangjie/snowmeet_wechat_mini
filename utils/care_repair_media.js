// 养护「维修」留证：有维修任务的装备，维修前、维修后各要上传至少 1 张照片或视频，并且要分清是维修前的还是维修后的。
//
// 存法：不加表、不加列，沿用装备照片表 care_image，用它原来没人用的 title 列（varchar(100)，历史数据全是空）记阶段：
//   title = '维修前' / '维修后'；title 为空的就是普通装备照片。视频和照片都存在 mini_upload（file_path_name 是 /upload/日期/随机串.扩展名，
//   thumb 是视频封面图），是不是视频按文件扩展名判断（mini_upload.file_type 目前后端不记）。
// 所有读 careImages 当「装备照片」用的地方都要先过 isRepairStage 把这两类滤掉，不然维修视频会混进装备照片里。

const STAGE_BEFORE = '维修前'
const STAGE_AFTER = '维修后'

// 视频文件扩展名（微信 chooseMedia 拍 / 选的视频一般是 mp4 / mov）
const VIDEO_EXT = /\.(mp4|mov|m4v|avi|3gp|webm|mpeg|mpg)$/i

// 拍视频的最长时长（秒）：微信 chooseMedia 允许的最大值。文件大小不在小程序里限制——
// 服务器前面的 nginx 对 mini.snowmeet.top 设的是 client_max_body_size 1000M，后端上传接口也不设应用层上限，文件直接写进 S3 私有桶，
// 和其它小程序上传走同一条路；app.json 里把上传超时放宽到 5 分钟，大视频在手机网络上才传得完
const MAX_VIDEO_SECONDS = 60
// 每个阶段最多放几个
const MAX_PER_STAGE = 9

function isRepairStage(title) {
  const t = String(title == null ? '' : title).trim()
  return t === STAGE_BEFORE || t === STAGE_AFTER
}

function isVideoPath(path) {
  return VIDEO_EXT.test(String(path || '').split('?')[0])
}

function fullUrl(host, p) {
  if (!p) return ''
  return String(p).indexOf('http') === 0 ? p : String(host || '') + p
}

// care_image 行 → 展示用的一项：{ id, image_id, stage, isVideo, url, poster }
//   url    原文件地址（预览用，图片是原图、视频是视频文件）
//   poster 方块里显示的图：图片用缩略图 / 原图；视频用封面图，没有封面就是空（页面显示灰底 + 播放标）
function toMediaItem(careImage, host) {
  const image = (careImage && careImage.image) || {}
  const file = image.file_path_name || ''
  const video = isVideoPath(file)
  const thumb = image.thumb || ''
  const poster = video
    ? (thumb && !isVideoPath(thumb) ? fullUrl(host, thumb) : '')
    : fullUrl(host, thumb || file)
  return {
    id: careImage.id,
    image_id: careImage.image_id || image.id || 0,
    stage: String(careImage.title || '').trim(),
    isVideo: video,
    url: fullUrl(host, file),
    poster
  }
}

function validRows(careImages) {
  return (careImages || []).filter(im => im && im.valid !== false && im.valid !== 0)
}

// 一件装备的全部 care_image 行分三堆：普通装备照片 / 维修前 / 维修后（后两堆已转成展示项）
function groupCareImages(careImages, host) {
  const equipment = []
  const before = []
  const after = []
  validRows(careImages).forEach(im => {
    const title = String(im.title == null ? '' : im.title).trim()
    if (title === STAGE_BEFORE) before.push(toMediaItem(im, host))
    else if (title === STAGE_AFTER) after.push(toMediaItem(im, host))
    else equipment.push(im)
  })
  return { equipment, before, after }
}

// 这件装备是不是有「维修」任务（有就要留证）
function hasRepairTask(tasks) {
  return (tasks || []).some(t => t && t.task_name === '维修' && t.valid !== 0 && t.valid !== false)
}

// 点「开始维修 / 结束维修」前的检查，返回要提示的话；空串 = 可以继续
//   开始：必须已有「维修前」的照片或视频；结束：必须已有「维修后」的照片或视频（强行中止他人的任务不查）
function repairGate(careImages, action) {
  const g = groupCareImages(careImages, '')
  if (action === 'start' && g.before.length === 0) return '请先上传维修前的照片或视频'
  if (action === 'end' && g.after.length === 0) return '请先上传维修后的照片或视频'
  return ''
}

// 在 careImages 末尾加一行新的留证记录（id=0 插入），其余行原样保留（后端按 id 对比，漏掉的会被删）
function withNewMediaRow(careImages, careId, imageId, stage) {
  const keep = (careImages || []).map(im => {
    const copy = Object.assign({}, im)
    delete copy.image
    delete copy.care
    copy.care_id = careId
    copy.image_id = copy.image_id || (im.image && im.image.id) || 0
    return copy
  })
  keep.push({ id: 0, care_id: careId, image_id: imageId, title: stage, valid: true })
  return keep
}

// 去掉一行（按 care_image.id）；其余原样保留
function withoutMediaRow(careImages, careId, rowId) {
  return (careImages || []).filter(im => im.id !== rowId).map(im => {
    const copy = Object.assign({}, im)
    delete copy.image
    delete copy.care
    copy.care_id = careId
    copy.image_id = copy.image_id || (im.image && im.image.id) || 0
    return copy
  })
}

// 选文件之后的检查：返回要提示的话；空串 = 可以上传（只看有没有选到文件，不限制大小）
function checkPickedFile(file) {
  if (!file || !file.tempFilePath) return '没有选到文件'
  return ''
}

module.exports = {
  STAGE_BEFORE, STAGE_AFTER, MAX_VIDEO_SECONDS, MAX_PER_STAGE,
  isRepairStage, isVideoPath, toMediaItem, groupCareImages, hasRepairTask, repairGate,
  withNewMediaRow, withoutMediaRow, checkPickedFile
}
