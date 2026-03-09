// components/ticket_selector/ticket_list.js
const app = getApp()
const util = require('../../utils/util.js')
const data = require('../../utils/data.js')
Component({
  /**
   * Component properties
   */
  properties: {
    disabledCodes:{
      type: Array,
      value:[]
    },
    ticketType:{
      type: String,
      value: null
    },
    memberId:{
      type: Number,
      value: 0
    },
    selectedCode:{
      type: String,
      value: null
    }

  },


  /**
   * Component initial data
   */
  data: {

  },
  lifetimes:{
    ready(){
      var that = this
      data.getMemberTicketsPromise(that.properties.memberId, that.properties.ticketType, true, app.globalData.sessionKey)
        .then(function (tickets){
          for(var i = 0; tickets && i < tickets.length; i++){
            for(var j = 0; that.properties.disabledCodes && j < that.properties.disabledCodes.length; j++){
              if (tickets[i].code == that.properties.disabledCodes[j]){
                tickets[i].disabled = true
              }
              else{
                tickets[i].disabled = false
              }
            }
            if (tickets[i].code == that.properties.selectedCode){
              tickets[i].selected = true
            }
            tickets[i].expire_dateStr = ((tickets[i].expire_date == null) ? '--' : util.formatDate(new Date(tickets[i].expire_date)))
            if (tickets[i].expire_dateStr == '9999-12-31'){
              tickets[i].expire_dateStr = '--'
            }
          }
          var cancelTicket = {
            code : null,
            name: '不使用优惠券',
            expire_dateStr: '--'
          }
          tickets.push(cancelTicket)
          that.setData({tickets})
        })
    }
  },
  pageLifetimes: {
    show(){
      console.log('ticket show')
    }
  },
  /**
   * Component methods
   */
  methods: {
    cancel(e){
      var that = this
      that.triggerEvent('Event', {action: 'cancel'})
    },
    confirm(e){
      var that = this
      if (that.data.selectedCode==null || that.data.selectedCode == undefined){
        that.cancel(e)
      }
      else{
        var tickets = that.data.tickets
        var ticket = null
        for(var i = 0; ticket == null && i < tickets.length; i++){
          if (tickets[i].code == that.data.selectedCode){
            ticket = tickets[i]
          }
        }
        that.triggerEvent('Event', {action: 'confirm', selectedTicket: ticket})
      }
    },
    selectCode(e){
      var that = this
      that.data.selectedCode = e.detail.value
      console.log('select code', e)
    }
  }
})