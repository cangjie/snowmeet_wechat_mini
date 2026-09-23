// 批次照片：复用旧食材模块的上传接口（FnbMaterial/UploadPhoto，用途「食材批次」），发 change {photos, uploading}
const data = require('../../../../utils/data.js')
const IMG_HOST = 'https://snowmeet.wanlonghuaxue.com'

Component({
  properties: {
    photos: { type: Array, value: [] },
    max: { type: Number, value: 6 }
  },
  data: { uploading: 0 },
  methods: {
    notify(photos) {
      this.triggerEvent('change', { photos, uploading: this.data.uploading })
    },
    onRead(e) {
      const files = [].concat(e.detail.file || [])
      const sessionKey = getApp().globalData.sessionKey
      let photos = this.properties.photos.slice()
      files.forEach(file => {
        const key = 'up' + Date.now() + Math.random()
        photos.push({ key, url: file.url || file.tempFilePath, status: 'uploading', message: '上传中' })
        this.setData({ uploading: this.data.uploading + 1 })
        data.uploadMatExpirePhotoPromise(file.url || file.tempFilePath, sessionKey).then(res => {
          photos = this.properties.photos.map(p => p.key === key ? { key, id: res.id, url: IMG_HOST + res.file_path_name, status: 'done' } : p)
        }).catch(() => {
          photos = this.properties.photos.filter(p => p.key !== key)
          wx.showToast({ title: '照片上传失败', icon: 'none' })
        }).then(() => {
          this.setData({ uploading: this.data.uploading - 1 })
          this.notify(photos)
        })
      })
      this.notify(photos)
    },
    onDelete(e) {
      const photos = this.properties.photos.slice()
      photos.splice(e.detail.index, 1)
      this.notify(photos)
    }
  }
})
