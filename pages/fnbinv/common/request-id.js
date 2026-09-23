// 过账请求号：同一动作失败重试沿用同一个号（服务端据此去重），成功后再换新号
function newRequestId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

function createKeeper() {
  const ids = {}
  return {
    get(key) { if (!ids[key]) ids[key] = newRequestId(); return ids[key] },
    done(key) { delete ids[key] }
  }
}

module.exports = { newRequestId, createKeeper }
