const util = require("../../utils/util")
const data = require('../../utils/data.js')
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
    },
    currentContactNum: String
  },
  /**
   * Component initial data
   */
  data: {
    member: undefined,
    memberId: undefined,
    inputContactNum: false
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
    }
  },
  methods: {
    getMemberInfo: function(){
      var that = this
      data.getMemberPromise(that.properties.memberId, app.globalData.sessionKey).then(function (resolve){
        console.log('get member info', resolve)
        var member = resolve
        member.totalDepositStr = util.showAmount(member.totalDeposit)
        member.availableDepositStr = util.showAmount(member.availableDeposit)
        member.contactNums.push({id: 0, num:'新增'})
        that.setData({member})
        that.triggerEvent('GetMemberInfo', member)
      }).catch(function (resolve){

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
        case 'contact_num':
          member.contact_num = value
          if (member.contact_num.length == 11){
            updated = true
            member.currentContactNum = member.contact_num
          }
          break
        default:
          break
      }
      that.setData({member})
      if (updated){
        that.triggerEvent('UpdateMemberInfo', member)
      }
    },
    selectNum(e){
      console.log('contact num', e)
      var that = this
      var index = parseInt(e.detail.value)
      var member = that.data.member
      var nums = that.data.member.contactNums
      if (index == nums.length - 1){
        that.setData({inputContactNum: true})
      }
      else{
        member.currentContactNum = member.contactNums[index].num
        that.setData({member, contactNum: member.currentContactNum})
        that.triggerEvent('UpdateMemberInfo', member)
      }
    },
    setContactNum(e){
      var that = this
      var value = e.detail.value
      var member = that.data.member
      if (value.length == 11){
        member.currentContackNum = value
        that.triggerEvent('UpdateMemberInfo', member)
      }
      that.setData({member})
    },
    backToPick(){
      var that = this
      that.setData({inputContactNum: false})
    }
  },
  
})