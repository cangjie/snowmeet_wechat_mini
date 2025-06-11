const util = require("../../utils/util")
const app = getApp()
// components/user_info/member_info.js
Component({
  /**
   * Component properties
   */
  properties: {
    member:{
      type: Object,
      value: undefined
    },
    memberId:{
      type: Number,
      value: undefined
    }
  },
  /**
   * Component initial data
   */
  data: {
    member: undefined,
    memberId: undefined
  },
  /**
   * Component methods
   */
  lifetimes:{
    ready(){
      var that = this
      app.loginPromiseNew.then(function(resolve){
        if (that.properties.memberId){
          that.getMemberInfo()
        }
        else if (that.properties.member){
          that.setData({member: that.properties.member})
        }
      })
    },
  },
  methods: {
    getMemberInfo: function(){
      var that = this
      var getUrl = app.globalData.requestPrefix + 'Member/GetMember/' + that.properties.memberId.toString() + '?sessionKey=' + app.globalData.sessionKey
      util.performWebRequest(getUrl, undefined).then(function(resolve){
        console.log('get member info', resolve)
        var member = resolve
        member.totalDepositStr = util.showAmount(member.totalDeposit)
        member.avaliableDepositStr = util.showAmount(member.avaliableDeposit)
        that.setData({member})
        that.triggerEvent('GetMemberInfo', member)
      }).catch(function (reject){

      })
    },
    userInfoChanged(e){
      var that = this
      var id = e.currentTarget.id
      var value = e.detail.value
      var member = that.data.member? that.data.member: {}
      var updated = false
      switch(id){
        case 'gender':
          member.gender = value
          updated = true
          break
        case 'real_name':
          member.real_name = value
          updated = true
          break
        case 'cell':
          member.cell = value
          if (member.cell.length == 11){
            updated = true
          }
          break
        default:
          break
      }
      that.setData({member})
      if (updated){
        that.triggerEvent('UpdateMemberInfo', member)
      }
    }
  }
})