const app = getApp()
const util = require('../../utils/util.js')
const data = require('../../utils/data.js')
// components/retail/retail_recept.js
Component({

  /**
   * Component properties
   */
  properties: {
    memberId: Number,
    order: Object
  },

  /**
   * Component initial data
   */
  data: {
    images: []
  },
  lifetimes: {
    ready() {
      var that = this
      var retail = {
        id: 0,
        order_id: 0,
        mi7_code: '',
        urgent: 0,
        giveup_score: 0,
        entertain: 0,
        sale_price: null,
        deal_price: null,
        memo: ''
      }
      if (that.properties.order) {
        that.setData({ memberId: order.member_id, order: that.properties.order })
      }
      else if (that.properties.memberId && !isNaN(that.properties.memberId)) {
        var order = {
          member_id: that.properties.memberId,
          type: '零售',
          retails: []
        }
        order.retails.push(retail)
        that.setData({ memberId: that.properties.memberId, order })
      }
      else {
        var order = {
          member_id: null,
          type: '零售',
          retails: []
        }
        order.retails.push(retail)
        that.setData({ memberId: null, order })
      }
      app.loginPromiseNew.then(function (resovle) {
        if (that.data.memberId) {
          data.getMemberPromise(that.properties.memberId, app.globalData.sessionKey).then(function (member) {
            var retail = that.data.order.retails[0]
            var isMember = 0
            if (member && member.following_wechat == 1) {
              isMember = 1
            }
            else {
              isMember = 0
              retail.giveup_score = 1
            }
            that.setData({ member, order, isMember })
          })
        }
        else {
          var retail = that.data.order.retails[0]
          retail.giveup_score = 1
          that.setData({ isMember: 0, order })
        }
      })

    }
  },
  /**
   * Component methods
   */
  methods: {
    setInput(e) {
      var that = this
      var value = e.detail.value
      var order = that.data.order
      var retail = order.retails[0]
      var id = e.currentTarget.id
      switch (id) {
        case 'deal_price':
          if (!isNaN(value)) {
            retail.deal_price = parseFloat(value)
          }
          break
        case 'mi7_code':
          retail.mi7_code = value
          break
        case 'memo':
          retail.memo = value
          break
        default:
          break
      }
      that.triggerEvent('SyncRetailOrder', order)
    },
    checkChanged(e) {
      var that = this
      var id = e.currentTarget.id
      var value = e.detail.value.length
      var order = that.data.order
      var retail = order.retails[0]
      switch (id) {
        case 'giveup':
          retail.giveup_score = value
          break
        case 'entertain':
          retail.entertain = value
          break
        case 'urgent':
          retail.urgent = value
          break
        case 'entertain':
          retail.order_type = value == 1 ? '招待' : '普通'
          break
        case 'is_test':
          retail.is_test = value
          break
        default:
          break
      }
      that.setData({ order })
      that.triggerEvent('SyncRetailOrder', order)
    },
    radioChanged(e) {
      var that = this
      //var id = e.currentTarget.id
      var value = e.detail.value
      var order = that.data.order
      var retail = order.retails[0]
      retail.retail_type = value
      that.triggerEvent('SyncRetailOrder', order)
    },
    afterRead(e) {
      var that = this
      var uploadFile = e.detail.file
      var images = that.data.images
      var image = {
        id: 0,
        image_id: 0,
        order_id: 0,
        status: 'uploading',
        message: '上传中',
        url: uploadFile.tempFilePath,
        thumb: uploadFile.tempFilePath
      }
      images.push(image)
      that.setData({images})
      data.uploadFilePromise(null, uploadFile.tempFilePath, '零售开单',
        uploadFile.type, app.globalData.sessionKey).then(function (uploadedFile) {
          image.id = uploadedFile.id
          image.url = 'https://snowmeet.wanlonghuaxue.com' + uploadedFile.file_path_name
          image.thumb = 'https://snowmeet.wanlonghuaxue.com' + uploadedFile.file_path_name
          image.type = uploadedFile.file_type
          that.setData({images})
          data.uploadFilePromise(uploadedFile.id, uploadFile.thumb, null, null, app.globalData.sessionKey).then(function (uploadThumbFile) {
            image.id = uploadThumbFile.id
            image.thumb = 'https://snowmeet.wanlonghuaxue.com' + uploadThumbFile.thumbUrl
            image.status = 'success'
            image.message = ''
            //image.image = uploadThumbFile
            that.setData({images})
          })
        })
    },
    delImage(e) {
      console.log('del image', e)
      var that = this
      var index = e.detail.index
      var images = that.data.images
      var newImages = []
      for (var i = 0; i < images.length; i++) {
        if (i != index) {
          newImages.push(images[i])
        }
      }
      that.setData({ images: newImages })
    },
  },
})