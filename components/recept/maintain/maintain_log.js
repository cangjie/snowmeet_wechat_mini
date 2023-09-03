// components/recept/maintain/maintain_log.js
const app = getApp()
const util = require('../../../utils/util.js')
Component({
  /**
   * Component properties
   */
  properties: {
    receptId: Number
  },

  /**
   * Component initial data
   */
  data: {

  },

  ready(){
    var that = this
    that.setData({receptId: that.properties.receptId})
    app.loginPromiseNew.then(function(resolve){
        that.getData()
        
    })
  },

  /**
   * Component methods
   */
  methods: {
    checkEquip(e){
      console.log('select equip', e)
      var that = this
      var recept = that.data.recept
      var maintain = recept.maintainOrder
      var items = []
      var vArr = e.detail.value
      var equipArr = that.data.equipArr
      for(var i = 0; i < vArr.length; i++){
        var equip = equipArr[parseInt(vArr[i])]
        var item = {
          confirmed_equip_type: equip.type,
          confirmed_brand: equip.brand,
          confirmed_serial: equip.serial,
          confirmed_scale: equip.scale,
          confirmed_year: equip.year

        }
        items.push(item)
      }
      maintain.items = items
      that.setData({recept: recept})
      that.triggerEvent('CheckValid', {Goon: true, recept: recept})
    },

    getData(){
        var that = this
        var getUrl = 'https://' + app.globalData.domainName + '/core/Recept/GetRecept/' + that.data.receptId + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
        wx.request({
          url: getUrl,
          method: 'GET',
          success:(res)=>{
              if (res.statusCode != 200){
                  return
              }
              that.setData({recept: res.data})
              that.getMaintainLog()
          }
        })
      },
    
      getEquipArr(){
        var that = this
        var getEquipUrl = 'https://' + app.globalData.domainName + '/core/MaintainLive/GetEquip?openId=' + encodeURIComponent(that.data.recept.open_id) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
        wx.request({
          url: getEquipUrl,
          method:'GET',
          success:(res)=>{
              console.log('get equip arr', res)
              if (res.statusCode != 200){
                  return
              }
              that.triggerEvent('CheckValid', {Goon: true, recept: that.data.recept})
              that.setData({equipArr: res.data})
          }
        })
        
      },
    
      getMaintainLog(){
        var that = this
        var getLogArr = 'https://' + app.globalData.domainName + '/core/MaintainLive/GetMaintainLog?openId=' + encodeURIComponent(that.data.recept.open_id) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
        wx.request({
          url: getLogArr,
          method: 'GET',
          success:(res)=>{
              console.log('get maintain log', res)
              if (res.statusCode != 200){
                  return
              }
              var maintainLogArr = res.data
              for(var i = 0; i < maintainLogArr.length; i++){
                var desc = maintainLogArr[i].confirmed_equip_type + ' ' + maintainLogArr[i].confirmed_brand + ' ' + maintainLogArr[i].confirmed_scale + ' ' + ((maintainLogArr[i].confirmed_edge == 1)?('修刃' + maintainLogArr[i].confirmed_degree): ' ') + (maintainLogArr[i].confirmed_candle == 1? '打蜡' : ' ') + maintainLogArr[i].confirmed_more
                maintainLogArr[i].date = util.formatDate(new Date(maintainLogArr[i].create_date))
                maintainLogArr[i].desc = desc
              }
              that.setData({maintainLogArr: maintainLogArr})
              that.getEquipArr()
          }
        })
      }

  }
})
