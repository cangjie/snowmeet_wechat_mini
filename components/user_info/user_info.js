// components/user_info/user_info.js
const app = getApp()
Component({
  /**
   * Component properties
   */
  properties: {
    open_id:{
      type: String,
      value:''
    },
    cell: {
      type: String,
      value: ''
    },
    code:{
      type: String,
      value:''
    }
  },

  /**
   * Component initial data
   */
  data: {
    role:'',
    cell:'',
    points: 0,
    nick: '',
    userFind: false
  },

  lifetimes:{
    ready: function(){
      var that = this
      app.loginPromiseNew.then(function(resolve){
        that.setData({role: app.globalData.role})
        var getInfoUrl = 'https://' + app.globalData.domainName + '/core/MiniAppUser/'
        if (that.properties.open_id.trim() != ''){
          getInfoUrl = getInfoUrl + 'GetMiniAppUser?openId=' + that.properties.open_id
          + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
        }
        else if (that.properties.cell.trim() != ''){
          getInfoUrl = getInfoUrl + 'GetUserByCell/' + that.properties.cell 
          + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
        }
        else if (that.properties.code.trim() != ''){
          getInfoUrl = getInfoUrl + 'GetMiniUserByTicket/' + that.properties.code 
          + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
        }
        else {
          getInfoUrl = ''
        }
        if (getInfoUrl.trim()!=''){
          wx.request({
            url: getInfoUrl,
            success:(res)=>{
              that.triggerEvent('UserFound', {user_found: true, user_info: res.data})
              that.setData({userFind: true, userInfo: res.data, role: app.globalData.role})
            },
            fail:(res)=>{
              that.triggerEvent('UserFound', {user_found: false, user_info: res.data})
              that.setData({userFind: false, userInfo: null, role: app.globalData.role})
            }
            
          })
        }
        else{
          that.triggerEvent('UserFound', {user_found: false, user_info: null})
          that.setData({userFind: false, userInfo: null, role: app.globalData.role})
        }
      })
    }
  },
  /**
   * Component methods
   */
  methods: {
    

  }

})