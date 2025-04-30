const util = require("../../utils/util")

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
    earnedPoints:0,
    userInfo:{
      cell: '',
      real_name: '',
      gender: ''
    }
  },

  lifetimes:{
    ready: function(){
      var that = this
      app.loginPromiseNew.then(function(resolve){
        that.setData({role: app.globalData.role})
        var getInfoUrl = ''
        if (that.properties.open_id.trim() != ''){
          var getInfoUrl = app.globalData.requestPrefix +  'member/GetMemberByNum?sessionKey=' + app.globalData.sessionKey
          getInfoUrl += '&num=' + that.properties.open_id + '&type=wechat_mini_openid'
        }
        /*
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
        */
        if (getInfoUrl.trim()!=''){

          util.performWebRequest(getInfoUrl, undefined).then((resolve)=>{
            var member = resolve
            if (member != null){
              var userInfo = that.data.userInfo
              userInfo.member = member
              if (userInfo.cell == ''){
                userInfo.cell = member.cell
              }
              if (userInfo.real_name == ''){
                userInfo.real_name = member.real_name
              }
              if (userInfo.gender == ''){
                userInfo.gender = member.gender
              }
              that.setData({userFind: true, user_info: userInfo})
              //that.getScore()
              that.triggerEvent('UserFound', {user_found: true, user_info: userInfo})
            }
          })

          /*
          wx.request({
            url: getInfoUrl,
            success:(res)=>{
              console.log('user info:', res.data)
              //that.triggerEvent('UserFound', {user_found: true, user_info: res.data})
              //that.setData({user_info: res.data, user_found: true})
              if (res.statusCode == 200){
                that.setData({userFind: true, userInfo: res.data, role: app.globalData.role})
                that.getScore()
                that.triggerEvent('UserFound', {user_found: true, user_info: res.data})
              }
              else{
                if (that.properties.cell != undefined && that.properties.cell != '')
                var userInfo = {}
                userInfo.cell_number = that.properties.cell
                that.setData({userInfo: userInfo})
              }

              
            },
            fail:(res)=>{
              that.triggerEvent('UserFound', {user_found: false, user_info: res.data})
              that.setData({userFind: false, userInfo: null, role: app.globalData.role})
            }
            
          })
          */

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
      
      var value = e.detail.value
      switch(e.currentTarget.id){
        case 'real_name':
          userInfo.real_name = value
          break
        case 'wechatId':
          userInfo.wechat_id = value
          break
        case 'cell':
          userInfo.cell = value
          if (value.length == 11){
            var getUserInfoUrl = app.globalData.requestPrefix + 'Member/GetMemberByNum?num=' + value + '&type=cell&sessionKey=' + encodeURIComponent
            (app.globalData.sessionKey)
            util.performWebRequest(getUserInfoUrl, undefined).then((resolve) => {
              var member = resolve
              var userInfo = that.data.userInfo
              userInfo.member = member
              if (member != null){
                userInfo.real_name = member.real_name
                userInfo.gender = member.gender
              }
              that.setData({userInfo: userInfo})
              that.triggerEvent('UserInfoUpdate', {user_info: userInfo})
              //that.setData({userInfo, userFind: true})
            })
            /*
            wx.request({
              url: getUserInfoUrl,
              method: 'GET',
              success:(res)=>{
                console.log('user info found', res)
                //that.triggerEvent('UserFound', {user_info: res.data})
                if (res.statusCode == 200){
                  var member = res.data
                  var userInfo = member.miniAppUser
                  userInfo.gender = member.gender
                  that.setData({userInfo, userFind: true})
                  that.getScore()
                }
                else{
                  that.setData({userFind: false})
                }
              }
            })
            */
          }
          
          break
        case 'gender':
          userInfo.gender = value
          break
        default:
          break
      }
      that.setData({userInfo: userInfo})
      that.triggerEvent('UserInfoUpdate', {user_info: userInfo})
      
    },
    call(){
      wx.makePhoneCall({
        phoneNumber: this.data.cell
      })
    }

  }

})
