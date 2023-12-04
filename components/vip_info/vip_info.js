// components/vip_info/vip_info.js
const app = getApp()
Component({

  /**
   * Component properties
   */
  properties: {
    cell: {
      type: String,
      value: ''
    }
  },

  /**
   * Component initial data
   */
  data: {
    id: 0,
    cell: '',
    name: '',
    memo: ''
  },
  pageLifetimes:{
    show(){
      var that = this
      that.data.cell = that.properties.cell.trim()
      app.loginPromiseNew.then(function(resolve){
        that.getData()
      })
    }
  },

  /**
   * Component methods
   */
  methods: {
    getData(){
      var that = this
      var cell = that.data.cell
      if (cell.length == 11){
        var getUrl = 'https://' + app.globalData.domainName + '/core/Vip/GetVipInfo/' 
          + cell + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
        wx.request({
          url: getUrl,
          method: 'GET',
          success:(res)=>{
            if (res.statusCode != 200){
              return
            }
            var cell = res.data.cell
            var name = res.data.name
            var memo = res.data.memo
            that.setData({cell: cell, name: name, memo: memo})
            that.triggerEvent('VipInfo', res.data)
          }
        })
      }
    },
    inputCell(e){
      var that = this
      var value = e.detail.value
      if (value.length != 11){
        return
      }
      that.setData({cell: value})
      that.getData()
      
    },
    input(e){
      var that = this
      var id = e.currentTarget.id
      var value = e.detail.value
      var cell = that.data.cell
      var name = that.data.name
      var memo = that.data.memo
      switch(id){
        case 'cell':
          cell = value
          break
        case 'name':
          name = value
          break
        case 'memo':
          memo = value
          break
        default:
          break
      }
      if (cell.length == 11){
        var vipInfo = {
          id: 0,
          cell: cell,
          name: name,
          memo: memo
        }
        var postUrl = 'https://' + app.globalData.domainName + '/core/Vip/UpdateVipInfo?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
        wx.request({
          url: postUrl,
          method: 'POST',
          data: vipInfo,
          success:(res)=>{
            if (res.statusCode != 200){
              return
            }
            cell = res.data.cell
            name = res.data.name
            memo = res.data.memo
            that.setData({cell: cell, name: name, memo: memo})
            that.triggerEvent('VipInfo', res.data)
          }
        })
      }
    }
  }
})