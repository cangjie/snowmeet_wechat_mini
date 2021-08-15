// components/maintain_task_description/maintain_task_description.js
const app = getApp()
Component({
  /**
   * Component properties
   */
  properties: {
    taskid:{
      type: String,
      value: '0'
    }
  },

  /**
   * Component initial data
   */
  data: {

  },

  /**
   * Component methods
   */
  methods: {
  
  },
  lifetimes: {
    attached: function() {
      var a = 0
    }
  },
  pageLifetimes: {
    show: function(e) {
      //this.setData({currentTaskId: (parseInt(this.properties.taskid) + 1).toString()})
      var url = 'https://' + app.globalData.domainName + '/api/maintain_task_get_by_id.aspx?taskid=' + this.data.taskid+'&sessionkey='+encodeURIComponent(app.globalData.sessionKey.trim())
      wx.request({
        url: url,
        success: (res) => {
          if (res.data.status == 0) {
            var maintainTask = res.data.maintain_task
            var realCardNo = maintainTask.card_no
            maintainTask.card_no = maintainTask.card_no.substring(0, 3) + '-' + maintainTask.card_no.substring(3, 6) + '-' + maintainTask.card_no.substring(6, 9)
            var strCreateDate = maintainTask.create_date
            var createDate = new Date(strCreateDate)
            var orderDate = createDate.getFullYear().toString() + '-' + (createDate.getMonth()+1).toString() + '-' + createDate.getDate().toString()
            var orderTime = createDate.getHours().toString()+':'+createDate.getMinutes().toString()
            this.setData({maintainTask: maintainTask, userFilledInfo: res.data.user_filled_info, orderDate: orderDate, orderTime: orderTime})
            var urlUserInfo = 'https://' + app.globalData.domainName + '/api/get_official_account_user_info.aspx?sessionkey=' + encodeURIComponent(app.globalData.sessionKey) + '&openid=' + encodeURIComponent(this.data.maintainTask.open_id)
            wx.request({
              url: urlUserInfo,
              success: (res) => {
                this.setData({userInfo: res.data})
              }
            })
            var urlSelectTable = 'https://' + app.globalData.domainName + '/api/select_table.aspx?sessionkey=' + encodeURIComponent(app.globalData.sessionKey) + '&sql=' + encodeURIComponent('select * from maintain_task left join card on  card.card_no = maintain_task.card_no left join product on card.product_id = product.[id] where maintain_task.[id] = ' + maintainTask.id)
            wx.request({
              url: urlSelectTable,
              success: (res) => {
                var price = 0
                if (res.data.count > 0) {
                  price = res.data.rows[0].sale_price
                }
                this.setData({price: price})
              }
            })
            urlSelectTable = 'https://' + app.globalData.domainName + '/api/select_table.aspx?sessionkey=' + encodeURIComponent(app.globalData.sessionKey) + '&sql=' + encodeURIComponent('select * from maintain_task_detail where task_id = ' + maintainTask.id + ' order by sort, [id] ')
            wx.request({
              url: urlSelectTable,
              success: (res) => {
                if (res.data.count > 0) {
                  var maintain_task_detail_arr = res.data.rows
                  
                  this.setData({maintain_task_detail: res.data.rows})
                }
              }
            })
          }
        }
      })
    }
  }
})
