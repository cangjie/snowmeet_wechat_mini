// components/card_selector/card_selector.js
const app = getApp()
Component({
  /**
   * Component properties
   */
  properties: {
    ticket_code_arr:{
      type: String,
      value: ''
    },
    selected_card_no:{
      type: String,
      value:''
    },
    open_id: {
      type: String,
      value: ''
    }
  },

  /**
   * Component initial data
   */
  data: {
    current_selected_index: -1
  },

  lifetimes:{
    ready: function(){
      var that = this
      if (that.properties.ticket_code_arr == ''){
          if (that.properties.open_id == ''){
            return
          }
          else{
            var getTicketUrl = 'https://' + app.globalData.domainName + '/core/Ticket/GetTicketsByUser/0?openId=' + encodeURIComponent(that.properties.open_id) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
            wx.request({
              url: getTicketUrl,
              method: 'GET',
              success:(res)=>{
                var ticketList = res.data
                for(var i = 0; i < ticketList.length; i++){
                  ticketList[i].usage = ticketList[i].memo.toString().replace(/;/g,'\r\n')
                }
                that.setData({ticket_list: ticketList})

              }
            })
          }
      }
      else {

      
        that.data.selected_card_no = that.properties.selected_card_no
        var url = 'https://' + app.globalData.domainName + '/core/Ticket/GetUnusedTicketsByCode?ticketCodeArr=' + encodeURIComponent(that.properties.ticket_code_arr)
        wx.request({
          url: url,
          method: 'GET',
          success: (res)=>{
            var ticketList = res.data
            
            for(var i = 0; i < ticketList.length; i++){
              //ticketList[i].usage = ticketList[i].memo.split(';')
              ticketList[i].usage = ticketList[i].memo.toString().replace(/;/g,'\r\n')
            }
            
            
            that.setData({ticket_list: ticketList})
          }
        })
      }
    }
  },

  /**
   * Component methods
   */
  methods: {
    cancel(e){
      var that = this
      that.setData({current_selected_index: -1})
      that.triggerEvent('TicketSelected', {code: ''})
    },
    select(e){
      console.log('select ticket', e)
      var that = this
      that.setData({current_selected_index: e.currentTarget.id})
      that.triggerEvent('TicketSelected', {code: that.data.ticket_list[that.data.current_selected_index].code})
    }
  }
})
