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
          }
        })
    }
  },
  pageLifetimes: {
    show(){
      console.log('ticket show')
    }
  },
  methods: {
    cancel(e){
      var that = this
      that.triggerEvent('Event', {action: 'cancel'})
    }
  }
})