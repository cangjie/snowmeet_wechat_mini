// pages/admin/equip_maintain/order_list/task/task.js
//var wxloginModule = require('../   ../../../../../../utils/wxlogin.js')
var wxloginnModule = require('../../../../../utils/wxlogin.js')
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    taskId: '0',
    uploadedFiles: [],
    inputedContents:[],
    isExecuting: false,
    allFinishAbove: true
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    this.setData({taskid: options.taskid})
    var detailId = options.detailid
    var urlSelectTable = 'https://' + app.globalData.domainName + '/api/select_table.aspx?sessionkey=' + encodeURIComponent(app.globalData.sessionKey) + '&sql=' + encodeURIComponent('select * from maintain_task_detail where [id] = ' + detailId )
    wx.request({
      url: urlSelectTable,
      success: (res) => {
        if (res.data.count>0){
          var color = 'gray'
          var taskId = parseInt(res.data.rows[0].task_id.toString())
          var sort = parseInt(res.data.rows[0].sort)
          var isExecuting = false
          var allFinishAbove = true
          urlSelectTable = 'https://' + app.globalData.domainName + '/api/select_table.aspx?sessionkey=' + encodeURIComponent(app.globalData.sessionKey) + '&sql=' + encodeURIComponent('select * from maintain_task_detail where task_id = ' + taskId.toString() + ' order by [sort],[id] ')
          wx.request({
            url: urlSelectTable,
            success: (res) => {
              for(var i = 0; i < res.data.count > 0; i++) {
                if (res.data.rows[i].status == '已开始') {
                  isExecuting = true
                }
                var currentSort = parseInt(res.data.rows[i].sort.toString())
                if (currentSort < sort && res.data.rows[i].status != '已完成' && res.data.rows[i].status != '强行中止' ) {
                  allFinishAbove = false
                }
              }
              this.setData({isExecuting: isExecuting, allFinishAbove: allFinishAbove})
            }
          })
          switch(res.data.rows[0].status) {
            case '已开始':
              color = 'red'
              break
            case '暂停':
              color = 'yellow'
              break
            case '强行中止':
              color = 'orange'
              break
            case '已完成':
              color = 'green'
              break
            default:
              break
          }
          this.setData({maintainTaskDetail: res.data.rows[0], color: color})
          var miniUserGetUrl = 'https://' + app.globalData.domainName + '/api/mini_user_get.aspx?openid=' + this.data.maintainTaskDetail.oper_open_id + '&sessionkey=' + encodeURIComponent(app.globalData.sessionKey)
          wx.request({
            url: miniUserGetUrl,
            success: (res) => {
              if (res.data.count > 0){
                var operRealName = res.data.mini_users[0].real_name
                if (operRealName == '') {
                  operRealName = '--'
                }
                this.setData({operRealName: operRealName})
              }
            }
          })
        }
      }
    })

    urlSelectTable = 'https://' + app.globalData.domainName + '/api/maintain_task_detail_sub_get.aspx?sessionkey=' + encodeURIComponent(app.globalData.sessionKey) + '&detailid=' +  + detailId
    wx.request({
      url: urlSelectTable,
      success: (res) => {
        var maintainTaskDetailSub = res.data.rows
        for(var i = 0; i < maintainTaskDetailSub.length; i++) {
          maintainTaskDetailSub[i].no = (i+1).toString()
          var content = maintainTaskDetailSub[i].action_content
          if (typeof(content) == 'string') {
            if ((content[0] == '"' && content[content.length - 1] == '"') 
              || (content[0] == "'" && content[content.length - 1] == "'")){
                content = content.substr(1, content.length - 1)
                content = content.substr(0, content.length - 1)
              }
          }
          else {
            switch(maintainTaskDetailSub[i].action_type.trim()) {
              case "拍照":
                var urlStr = ''
                for(var urlItem in content) {
                  urlStr = urlStr + (urlStr == ''? '' : ',') + content[urlItem].url
                }
                maintainTaskDetailSub[i].fileUrls = urlStr.toString()
                break
              default:
                break;
            }
          }
        }
        this.setData({maintainTaskDetailSub: maintainTaskDetailSub})
      }
    })


  },

  /**
   * Lifecycle function--Called when page is initially rendered
   */
  onReady: function () {

  },

  /**
   * Lifecycle function--Called when page show
   */
  onShow: function () {

  },

  /**
   * Lifecycle function--Called when page hide
   */
  onHide: function () {

  },

  /**
   * Lifecycle function--Called when page unload
   */
  onUnload: function () {

  },

  /**
   * Page event handler function--Called when user drop down
   */
  onPullDownRefresh: function () {

  },

  /**
   * Called when page reach bottom
   */
  onReachBottom: function () {

  },

  /**
   * Called when user click on the top right corner to share
   */
  onShareAppMessage: function () {

  },
  uploaded: function(source, option) {
    var detailId = source.currentTarget.id.split('_')[1].trim()
    var inputedContents = this.data.inputedContents
    var done = false
    for(var i = 0; i < inputedContents.length; i++) {
      if (inputedContents[i].id == detailId) {
        inputedContents[i].content = source.detail.files
        done = true
        break
      }
    }
    if (!done) {
      inputedContents.push({id: detailId, content: source.detail.files})

    }
    this.setData(inputedContents, inputedContents)
  },
  inputed: function(source) {
    var detailId = source.currentTarget.id.split('_')[1].trim()
    var word = source.detail.value.trim()
    var done = false
    var inputedContents = this.data.inputedContents
    for(var i = 0; i < inputedContents.length; i++) {
      if (inputedContents[i].id == detailId) {
        inputedContents[i].content = word.trim()
        done = true
        break
      }
    }
    if (!done) {
      inputedContents.push({id: detailId, content: word})
    }
  },
  equipInfoChange: function(source) {
    var detailId = source.currentTarget.id.split('_')[1].trim()
    var equipInfo = source.detail.confirmedFilledInfo
    var valueStr = ''
    for(var item in equipInfo) {
      valueStr = valueStr + (valueStr!=''?', ':'') + item.toString() + ': "' + equipInfo[item].trim() + '" '
    }
    var inputedContents = this.data.inputedContents
    var done = false
    for(var i = 0; i < inputedContents.length; i++) {
      if (inputedContents[i].id == detailId) {
        inputedContents[i].content = valueStr.trim()
        done = true
        break
      }
    }
    if (!done) {
      inputedContents.push({id: detailId, content: equipInfo})
    }
  },
  save: function(e) {
    var inputedContents = this.data.inputedContents
    wx.request({
      url: 'https://' + app.globalData.domainName + '/api/maintain_task_detail_sub_save.aspx?sessionkey=' + encodeURIComponent(app.globalData.sessionKey),
      data: inputedContents,
      success: (res) => {
        console.log(res.data)
      }
    })
    /*
    for(var item in inputedContents) {
      if (typeof(inputedContents[item].content) == 'string') {
        var val = inputedContents[item].content
      }
      else {
        if (inputedContents[item].content.length == undefined) {
          var valSet = inputedContents[item].content
        }
        else{
          var arr = inputedContents[item].content
        }
      }
    }
    */
  }
})