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

  },
  lifetimes:{
    ready(){
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
      if (that.properties.order){
        that.setData({memberId: order.member_id, order: that.properties.order})
      }
      else if (that.properties.memberId && !isNaN(that.properties.memberId)){
        var order = {
          member_id: that.properties.memberId,
          type: '零售',
          retail: retail
        }
        that.setData({memberId: that.properties.memberId, order})
      }
      else{
        var order = {
          member_id: null,
          type: '零售',
          retail: retail
        }
        that.setData({memberId: null, order})
      }
      app.loginPromiseNew.then(function (resovle){
        if (that.data.memberId){
          data.getMemberPromise(that.properties.memberId, app.globalData.sessionKey).then(function (member){
            var retail = that.data.order.retail
            var isMember = 0
            if (member && member.following_wechat == 1){
              isMember = 1
            }
            else{
              isMember = 0
              retail.giveup_score = 1
            }
            that.setData({member, order, isMember})
          })
        }
        else{
          var retail = that.data.order.retail
          retail.giveup_score = 1
          that.setData({isMember: 0, order})
        }
      })
      
    }
  },
  /**
   * Component methods
   */
  methods: {
    setInput(e){
      var that = this
      var value = e.detail.value
      var order = that.data.order
      var retail = order.retail
      var id = e.currentTarget.id
      switch(id){
        case 'deal_price':
          if (!isNaN(value)){
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
    checkChanged(e){
      var that = this
      var id = e.currentTarget.id
      var value = e.detail.value.length
      var order = that.data.order
      var retail = order.retail
      switch(id){
        case 'giveup':
          retail.giveup_score = value
          break
        case 'entertain':
          retail.entertain = value
          break
        case 'urgent':
          retail.urgent = value
          break
        default:
          break
      }
      that.setData({order})
      that.triggerEvent('SyncRetailOrder', order)
    }
  },
  
})