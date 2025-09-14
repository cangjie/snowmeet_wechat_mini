// components/rent/price_matrix.js
const util = require('../../utils/util.js')
const data = require('../../utils/data.js')
const app = getApp()
Component({

  /**
   * Component properties
   */
  properties: {
    shopId: Number,
    priceType: String,
    targetId: Number,
    scene: String,
    mod: false
  },

  /**
   * Component initial data
   */
  data: {

  },
  lifetimes: {
    ready() {
      var that = this
      that.setData({
        shopId: that.properties.shopId,
        priceType: that.properties.priceType,
        targetId: that.properties.targetId,
        scene: that.properties.scene
      })
      console.log('shop id', that.properties.shopId)
      app.loginPromiseNew.then(function (resolve) {
        data.getEnumListPromise('RentType').then(function (rentTypeList) {
          that.setData({ rentTypeList })
          data.getEnumListPromise('GetDayType').then(function (dayTypeList) {
            that.setData({ dayTypeList, colSpan: parseInt(24 / (dayTypeList.length + 1)) })
            that.getData()
          }).catch(function (reject) {

          })
        }).catch(function (reject) {

        })

      })
    }
  },
  /**
   * Component methods
   */
  methods: {
    save() {
      var that = this
      var valid = true
      var matrix = that.data.matrix
      var modList = []
      for (var i = 0; i < matrix.length; i++) {
        for (var j = 0; j < matrix[i].length; j++) {
          var price = matrix[i][j]
          if (price.mod) {
            if (isNaN(price.price) && price.price != '-') {
              valid = false
              break
            }
            else {
              modList.push(price)
            }
          }
        }
      }
      if (valid) {
        wx.showModal({
          title: '确认更新',
          content: '',
          complete: (res) => {
            if (res.cancel) {
              that.setCancel()
            }
            if (res.confirm) {
              data.updateRentPricePromise(modList, that.data.shopId, app.globalData.sessionKey).then(function (list) {
                console.log('update price', list)
                that.setCancel()
              })
            }
          }
        })
      }
      else{
        wx.showToast({
          title: '必须是数字或-',
          icon:'error'
        })
        that.setCancel()
      }
      console.log('mod list', modList)
    },
    setPrice(e) {
      var value = e.detail.value
      if (isNaN(value)) {
        if (value != '-') {
          return
        }
      }
      var that = this
      var idArr = e.currentTarget.id.split('_')
      var x = parseInt(idArr[0])
      var y = parseInt(idArr[1])
      var matrix = that.data.matrix
      var price = matrix[x][y]
      price.mod = true
      if (value == '-') {
        price.price = null
      }
      else {
        price.price = parseFloat(value)
      }
    },
    setCancel(e) {
      var that = this
      that.setData({ mod: false })
      that.getData()
    },
    setMod(e) {
      var that = this
      that.setData({ mod: true })
    },
    getData() {
      var that = this
      data.getRentPriceListPromise(that.data.shopId, that.data.priceType, that.data.targetId, that.data.scene)
        .then(function (list) {
          var rentTypeList = that.data.rentTypeList
          var dayTypeList = that.data.dayTypeList
          var matrix = []
          for (var i = 0; i < rentTypeList.length; i++) {
            var line = []
            for (var j = 0; j < dayTypeList.length; j++) {
              var value = null
              var priceId = 0
              var find = false
              var rentType = rentTypeList[i]
              var dayType = dayTypeList[j]
              for (var k = 0; k < list.length; k++) {
                if (list[k].day_type == dayType && list[k].rent_type == rentType) {
                  find = true
                  value = list[k].price == null ? '-' : list[k].price
                  priceId = list[k].id
                  break
                }
              }
              if (!find) {
                value = ''
              }
              var priceObj = {
                id: priceId, price: value, type: that.data.priceType, shop_id: that.data.shopId,
                scene: that.data.scene, day_type: dayType, rent_type: rentType, mod: false
              }
              if (that.data.priceType == '分类') {
                priceObj.category_id = that.data.targetId
              }
              else if (that.data.priceType == '套餐') {
                priceObj.package_id = that.data.targetId
              }
              line.push(priceObj)
            }
            matrix.push(line)
          }
          that.setData({ matrix })
        })
    }
  }
})