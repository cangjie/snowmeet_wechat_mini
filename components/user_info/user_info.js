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
    userFind: false,
    totalPoints: 0,
    earnedPoints:0
  },

  lifetimes:{
    ready: function(){
      var that = this
      app.loginPromiseNew.then(function(resolve){
        that.setData({role: app.globalData.role})
        var getInfoUrl = 'https://' + app.globalData.domainName + '/core/MiniAppUser/'
        if (that.properties.open_id.trim() != ''){
          getInfoUrl = getInfoUrl + 'GetMiniAppUser?openId=' + that.properties.open_id
          + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
        }
        else if (that.properties.cell.trim() != ''){
          getInfoUrl = getInfoUrl + 'GetUserByCell/' + that.properties.cell 
          + '?staffSessionKey=' + encodeURIComponent(app.globalData.sessionKey)
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
              console.log('user info:', res.data)
              //that.triggerEvent('UserFound', {user_found: true, user_info: res.data})
              //that.setData({user_info: res.data, user_found: true})
              that.setData({userFind: true, userInfo: res.data, role: app.globalData.role})
              that.getScore()
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
    getScore:function(){
      var that = this
      var getTotalPointsUrl = 'https://' + app.globalData.domainName + '/core/Point/GetUserPointsSummary?openId=' + encodeURIComponent(that.data.userInfo.open_id) +  '&openIdType=' + encodeURIComponent('snowmeet_mini')
      wx.request({
        url: getTotalPointsUrl,
        method: 'GET',
        success:(res)=>{
          var totalPoints = parseInt(res.data)
          if (!isNaN(totalPoints)){
            that.setData({totalPoints: totalPoints})
          }
        },
        complete:()=>{
          var getEarnedPointsUrl = 'https://' + app.globalData.domainName + '/core/Point/GetUserPointsTotalEarned?openId=' + encodeURIComponent(that.data.userInfo.open_id) +  '&openIdType=' + encodeURIComponent('snowmeet_mini')
          wx.request({
            url: getEarnedPointsUrl,
            method:'GET',
            success:(res)=>{
              var earnedPoints = parseInt(res.data)
              if (!isNaN(earnedPoints)) {
                that.setData({earnedPoints: earnedPoints})
              }
            },
            complete:()=>{
              that.triggerEvent('UserFound', {user_found: true, user_info: that.data.userInfo})
            }
  
          })
        }
        
      })
      
    },
    userInfoChanged: function(e){
      console.log('user info changed:', e)
      var that = this
      var userInfo = that.data.userInfo
      if (userInfo == null){
        userInfo = {}
      }
      var value = e.detail.value
      switch(e.currentTarget.id){
        case 'real_name':
          userInfo.real_name = value
          break
        case 'cell':
          userInfo.cell_number = value
          if (value.length == 11){
            var getUserInfoUrl = 'https://' + app.globalData.domainName + '/core/MiniAppUser/GetUserByCell/' + value + '?staffSessionKey=' + encodeURIComponent(app.globalData.sessionKey)
            wx.request({
              url: getUserInfoUrl,
              method: 'GET',
              success:(res)=>{
                console.log('user info found', res)
                //that.triggerEvent('UserFound', {user_info: res.data})
                that.setData({userInfo: res.data})
                that.getScore()
              }
            })
          }
          break
        case 'gender':
          userInfo.gender = value
          break
        default:
          break
      }
      that.triggerEvent('UserInfoUpdate', {user_info: userInfo})
      that.setData({userInfo: userInfo})
    },
    call(){
      wx.makePhoneCall({
        phoneNumber: this.data.cell
      })
    }

  }

})
