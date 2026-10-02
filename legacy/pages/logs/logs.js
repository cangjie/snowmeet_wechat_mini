var __L = require('../../legacy_app.js') // legacy-demo：旧版演示的独立 App
//logs.js
const util = require('../../utils/util.js')

__L.Page({
  data: {
    logs: []
  },
  onLoad: function () {
    this.setData({
      logs: (wx.getStorageSync('logs') || []).map(log => {
        return util.formatTime(new Date(log))
      })
    })
  }
})
