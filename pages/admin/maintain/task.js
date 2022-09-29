// pages/admin/maintain/task.js
const util = require('../../../utils/util.js')
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    yearList: ['未知', '2012','2013','2014','2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023'],
    yearListSelectedIndex: 0,
    idDiff: false,
    showGallery: false,
    galleryIndex: -1,
    edgeMemo: '',
    waxMemo:'',
    moreMemo: ''
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    app.loginPromiseNew.then(function(resolve){
      var getInfoUrl = 'https://' + app.globalData.domainName + '/core/MaintainLive/GetTask/' + options.id + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
      wx.request({
        url: getInfoUrl,
        method: 'GET',
        success:(res)=>{
          console.log('task info', res)
          var task = res.data
          task.images = []
          var idDiff = that.data.idDiff
          if (task.confirmed_images != ''){
            task.images = task.confirmed_images.split(',')
          }
          if (task.confirmed_id != ''){
            if (task.confirmed_id.indexOf('~')>=0){
              idDiff = true
              var id = task.confirmed_id
              var idLeft = id.split('~')[0]
              var idRight = id.split('~')[1]
              task.id_left = idLeft
              task.id_right = idRight
              
            }
            else{

            }
          }
          var yearIndex = 0
          for(var i = 0; i < that.data.yearList.length; i++){
            if (that.data.yearList[i].trim() == task.confirmed_year){
              yearIndex = i
              break
            }
          }
          var getSerialUrl = 'https://' + app.globalData.domainName + '/core/MaintainLive/GetSerials?brand=' + encodeURIComponent(task.confirmed_brand) + '&type=' + encodeURIComponent(task.confirmed_equip_type)
          wx.request({
            url: getSerialUrl,
            method: 'GET',
            success:(res)=>{
              var serialList = []
              for(var i = 0; i < res.data.length; i++){
                serialList.push(res.data[i].serial_name)
              }
              serialList.push('未知')
              var serialSelectedIndex = serialList.length - 1
              for(var i = 0; i < serialList.length; i++){
                if (task.confirmed_serial == serialList[i]){
                  serialSelectedIndex = i
                }
              }
              var getStepsUrl = 'https://' + app.globalData.domainName + '/core/MaintainLogs/GetStepsByStaff/' + task.id + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
              wx.request({
                url: getStepsUrl,
                method: 'GET',
                success:(res)=>{
                  console.log('steps', res)
                  var stepSafe = undefined
                  var stepEdge = undefined
                  var stepWax = undefined
                  var stepMore = undefined
                  for(var i = 0; i < res.data.length; i++){
                    switch(res.data[i].step_name){
                      case '安全检查':
                        stepSafe = res.data[i]
                        break
                      case '修刃':
                        stepEdge = res.data[i]
                        var start = new Date(stepEdge.start_time)
                        var end = new Date(stepEdge.end_time)
                        if (start!=undefined){
                          stepEdge.start_time_str = util.formatDate(start) + ' ' + util.formatTimeStr(start)
                        }
                        else{
                          stepEdge.start_time_str = ''
                        }
                        if (end!=undefined && end.getFullYear() > 1970){
                          stepEdge.end_time_str = util.formatDate(end) + ' ' + util.formatTimeStr(end)
                        }
                        else{
                          stepEdge.end_time_str = ''
                        }
                        break
                      case '打蜡':
                        stepWax = res.data[i]
                        break
                      default:
                        stepMore = res.data[i]
                        break
                    }
                  }
                  that.setData({stepSafe: stepSafe, stepEdge: stepEdge, stepWax: stepWax, stepMore: stepMore})
                }
              })
              that.setData({task: task, serialList: serialList, serialSelectedIndex: serialSelectedIndex, yearListSelectedIndex: yearIndex, idDiff: idDiff})
            }
          })
          
        }
      })
    })
  },
  showGallery(e){
    var id = e.currentTarget.id
    var that = this
    that.setData({showGallery: true, galleryIndex: parseInt(id)})
  },
  setIdDiff(e){
    var that = this
    if (e.detail.value == 'id_diff'){
      that.setData({idDiff: true})
    }
    else{
      that.setData({idDiff: false})
    }
  },

  mod(e){
    console.log('mod', e)
    var that = this
    var value = e.detail.value
    var task = that.data.task
    switch(e.currentTarget.id){
      case 'serial_picker':
        var serial = that.data.serialList[value]
        task.confirmed_serial = serial
        that.setData({serialSelectedIndex: value})
        break
      case 'serial_input':
        task.confirmed_serial = value
        that.setData({serialSelectedIndex: that.data.serialList.length - 1})
        break
      case 'year_picker':
        task.confirmed_year = that.data.yearList[value]
        that.setData({yearListSelectedIndex: value})
        break
      case 'id_left':
        task.id_left = value
        task.confirmed_id = task.id_left + '~' + task.id_right
        that.setData({task: task})
        break
      case 'id_right' :
        task.id_right = value
        task.confirmed_id = task.id_left + '~' + task.id_right
        that.setData({task: task})
        break
      case 'id_no':
        task.confirmed_id = value
        that.setData({task: task})
        break
      case 'safe_memo':
        that.setData({safeMemo: value})
        break
      case 'edge_memo':
        that.setData({edgeMemo: value})
        break
      default:
        break
    }
  },

  updateTask(){
    var that = this
    var updateUrl = 'https://' + app.globalData.domainName + '/core/MaintainLive/UpdateTask?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: updateUrl,
      method: 'POST',
      data: that.data.task,
      success:(res)=>{
        console.log('task updated', res)
        wx.showToast({
          title: '保存成功',
          icon: 'none'
        })
      }
    })
  },
  safeCheck(){
    var that = this
    var startSafeCheck = 'https://' + app.globalData.domainName + '/core/MaintainLogs/StartStep/' + that.data.task.id + '?stepName=' + encodeURIComponent('安全检查') + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: startSafeCheck,
      method:'GET',
      success:(res)=>{
        var stepSafe = res.data
        if (stepSafe.id > 0){
          var endSafeCheck = 'https://' + app.globalData.domainName + '/core/MaintainLogs/EndStep/' + stepSafe.id + '?memo=' + encodeURIComponent(that.data.safeMemo) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
          wx.request({
            url: endSafeCheck,
            method: 'GET',
            success:(res)=>{
              stepSafe = res.data
              that.setData({stepSafe: stepSafe})
              wx.showToast({
                title: '安全检查完成',
                icon: 'none',
                
              })
            }
          })
        }
      }
    })
  },
  startStep(e){
    var that = this
    var task = that.data.task
    var stepName = ''
    switch(e.currentTarget.id){
      case 'edge':
        stepName = '修刃'
        break
      case 'wax':
        stepName = '打蜡'
        break
      default:
        stepName = '维修'
        break
    }
    var startStepUrl = 'https://' + app.globalData.domainName + '/core/MaintainLogs/StartStep/' + task.id + '?stepName=' + encodeURIComponent(stepName) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: startStepUrl,
      method: 'GET',
      success:(res)=>{
        var ret = res.data
        var start = new Date(ret.start_time)
        var end = new Date(ret.end_time)
        if (start!=undefined){
          ret.start_time_str = util.formatDate(start) + ' ' + util.formatTimeStr(start)
        }
        else{
          ret.start_time_str = ''
        }
        if (end!=undefined && end.getFullYear() > 1970){
          ret.end_time_str = util.formatDate(end) + ' ' + util.formatTimeStr(end)
        }
        else{
          ret.end_time_str = ''
        }
        switch(stepName){
          case '修刃':
            that.setData({stepEdge: ret})
            break
          case '打蜡':
            that.setData({stepWax: ret})
            break
          default:
            that.setData({stepMore: ret})
            break
        }
        //that.setData({stepEdge: res.data})

      }
    })
  },
  endStep(e){
    var that = this
    var id = e.currentTarget.id.split('_')[0]
    var type = e.currentTarget.id.split('_')[1]
    var memo = ''
    switch(type){
      case 'edge':
        memo = that.data.edgeMemo
        break
      case 'wax':
        memo = that.data.waxMemo
        break
      default:
        memo = that.data.moreMemo
        break
    }
    var endStepUrl = 'https://' + app.globalData.domainName + '/core/MaintainLogs/endStep/' + id + '?memo=' + encodeURIComponent(memo) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: endStepUrl,
      method: 'GET',
      success:(res)=>{
        var ret = res.data
        var start = new Date(ret.start_time)
        var end = new Date(ret.end_time)
        if (start!=undefined){
          ret.start_time_str = util.formatDate(start) + ' ' + util.formatTimeStr(start)
        }
        else{
          ret.start_time_str = ''
        }
        if (end!=undefined && end.getFullYear() > 1970){
          ret.end_time_str = util.formatDate(end) + ' ' + util.formatTimeStr(end)
        }
        else{
          ret.end_time_str = ''
        }
        var stepName = ret.step_name
        switch(stepName){
          case '修刃':
            that.setData({stepEdge: ret})
            break
          case '打蜡':
            that.setData({stepWax: ret})
            break
          default:
            that.setData({stepMore: ret})
            break
        }
      }
    })

  },
  /**
   * Lifecycle function--Called when page is initially rendered
   */
  onReady() {

  },

  /**
   * Lifecycle function--Called when page show
   */
  onShow() {

  },

  /**
   * Lifecycle function--Called when page hide
   */
  onHide() {

  },

  /**
   * Lifecycle function--Called when page unload
   */
  onUnload() {

  },

  /**
   * Page event handler function--Called when user drop down
   */
  onPullDownRefresh() {

  },

  /**
   * Called when page reach bottom
   */
  onReachBottom() {

  },

  /**
   * Called when user click on the top right corner to share
   */
  onShareAppMessage() {

  }
})