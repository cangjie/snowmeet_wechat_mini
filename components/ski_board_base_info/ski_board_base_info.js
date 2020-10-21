// components/ski_board_base_info/ski_board_base_info.js
const app = getApp()
Component({
  /**
   * Component properties
   */
  properties: {
    type: {
      type: String,
      value: '双板'
    },
    brand: {
      type: String,
      value: '请选择...'
    },
    serial: {
      type: String,
      value: '请选择...'
    },
    year: {
      type: String,
      value: '请选择...'
    },
    scale: {
      type: String,
      value: '请选择...'
    }
  },

  lifetimes: {
    attached: function() {
      var url = 'https://' + app.globalData.domainName + '/api/select_table.aspx?sessionkey=' + encodeURIComponent(app.globalData.sessionKey) + '&sql=' + encodeURIComponent('select * from ski_board_scale_list order by [type], brand, [serial], scale, [year]')
      wx.request({
        url: url,
        success: (res) => {
          this.setData({allSkiBoardScales: res.data.rows})
        }
      })
    }
  },
  /**
   * Component initial data
   */
  data: {
    years: ['请选择', '20-21', '19-20', '18-19', '17-18', '16-17', '15-16', '14-15', '13-14', '12-13', '11-12', '10-11', '09-10'],
    yearIndex: 0,
    dialogButtons: [{text: '取消'}, {text: '确定'}],
    dialogShow: false,
    userFilledInfo:{},
    confirmedFilledInfo: {
      type: '双板',
      brand: '',
      serial: '',
      scale: '',
      year: '19-20'
    },
    brandList:[],
    serialList:[],
    scaleList:[],
    yearList:[],
    allSkiBoardScales:[],
    txtBrandDisable: true,
    txtSerialDisable: true,
    txtScaleDisable: true,
    yearDisable: true
  },

  /**
   * Component methods
   */
  methods: {
    selectSkiBoardInfo: function(source) {
      var s = source
    },
    yearPickerChange: function(e) {
      this.setData({yearIndex: e.detail.value})
    },
    showPickerDialog: function(source) {
      var type = "双板"
      if (source.target.id=='radio_2') {
        type = "单板"
      }
      var confirmedFilledInfo = this.data.confirmedFilledInfo
      confirmedFilledInfo.type = type
      confirmedFilledInfo.brand = ''
      confirmedFilledInfo.serial = ''
      confirmedFilledInfo.scale = ''
      confirmedFilledInfo.year = ''
      var userFilledInfo = this.data.userFilledInfo
      userFilledInfo.type = type
      userFilledInfo.brand = ''
      userFilledInfo.serial = ''
      userFilledInfo.scale = ''
      userFilledInfo.year = ''
      this.setData({dialogShow: true, userFilledInfo: userFilledInfo, confirmedFilledInfo: confirmedFilledInfo})
      this.fillPickView()
    },
    fillPickView: function() {
      var allSkiBoardScales = this.data.allSkiBoardScales
      var userFilledInfo = this.data.userFilledInfo
      var brandList = []
      var serialList = []
      var scaleList = []
      var yearList = []
      var lastBrand = ''
      var lastSerial = ''
      var lastScale = ''
      var lastYear = ''
      for(var i = 0; i < allSkiBoardScales.length; i++) {
        if (allSkiBoardScales[i].type==userFilledInfo.type) {   // && lastBrand != allSkiBoardScales[i].brand) {
          if (lastBrand != allSkiBoardScales[i].brand) {
            brandList.push(allSkiBoardScales[i].brand)
            lastBrand = allSkiBoardScales[i].brand
          }
          if (userFilledInfo.brand == ''){
            userFilledInfo.brand = allSkiBoardScales[i].brand
          }
          if (userFilledInfo.brand == allSkiBoardScales[i].brand) {
            if (lastSerial != allSkiBoardScales[i].serial) {
              serialList.push(allSkiBoardScales[i].serial)
              lastSerial = allSkiBoardScales[i].serial
            }
            
            if (userFilledInfo.serial == '') {
              userFilledInfo.serial = allSkiBoardScales[i].serial
            }
            if (userFilledInfo.serial == allSkiBoardScales[i].serial) {
              if (lastScale != allSkiBoardScales[i].scale) {
                scaleList.push(allSkiBoardScales[i].scale)
                lastScale = allSkiBoardScales[i].scale
              }
              if (userFilledInfo.scale == '') {
                userFilledInfo.scale = allSkiBoardScales[i].scale
              }
              if (userFilledInfo.scale == allSkiBoardScales[i].scale) {
                if (lastYear != allSkiBoardScales[i].year) {
                  yearList.push(allSkiBoardScales[i].year)
                  lastYear = allSkiBoardScales[i].year
                }
              }
            }
          }
        }
      }
      brandList.push('自填')
      serialList.push('自填')
      scaleList.push('自填')
      yearList.push('自填')
      this.setData({brandList: brandList, serialList: serialList, scaleList: scaleList, yearList: yearList})
    },
    pickerViewChange: function(e) {
      var userFilledInfo = this.data.userFilledInfo
      if (userFilledInfo.brand != this.data.brandList[e.detail.value[0]]) {
        userFilledInfo.brand = this.data.brandList[e.detail.value[0]]
        userFilledInfo.serial = ''
        userFilledInfo.scale = ''
        userFilledInfo.year = ''
      }
      else {
        if (userFilledInfo.serial != this.data.serialList[e.detail.value[1]]) {
          userFilledInfo.serial = this.data.serialList[e.detail.value[1]]
          userFilledInfo.scale = ''
          userFilledInfo.year = ''
        }
        else {
          if (userFilledInfo.scale != this.data.scaleList[e.detail.value[2]]) {
            userFilledInfo.scale = this.data.scaleList[e.detail.value[2]]
            userFilledInfo.year = ''
          }
          else {
            if (userFilledInfo.year != this.data.yearList[e.detail.value[3]]) {
              userFilledInfo.year = this.data.yearList[e.detail.value[3]]
            }
          }
        }
      }
      this.fillPickView()
    },
    tapDialogButton: function (e) {
      var userFilledInfo = this.data.userFilledInfo
      var confirmedFilledInfo = this.data.confirmedFilledInfo
      var txtBrandDisable = true
      var txtSerialDisable = true
      var txtScaleDisable = true
      var yearDisable = true
      if (e.detail.index == 1) {
        if (userFilledInfo.brand != '自填' && userFilledInfo.brand != '') {
          confirmedFilledInfo.brand = userFilledInfo.brand
          
        }
        else {
          confirmedFilledInfo.brand = ''
          txtBrandDisable = false
        }
        if (userFilledInfo.serial != '自填' && userFilledInfo.serial != '') {
          confirmedFilledInfo.serial = userFilledInfo.serial
          
        }
        else {
          confirmedFilledInfo.serial = ''
          txtSerialDisable = false
        }
        if (userFilledInfo.scale != '自填'  && userFilledInfo.scale != '') {
          confirmedFilledInfo.scale = userFilledInfo.scale
          
        }
        else {
          confirmedFilledInfo.scale = ''
          txtScaleDisable = false
        }
        if (confirmedFilledInfo.year != '自填' && confirmedFilledInfo.year != '') {
          confirmedFilledInfo.year = userFilledInfo.year
          
        }
        else {
          confirmedFilledInfo.year = ''
          yearDisable = false
        }
        
      }
      this.setData({dialogShow: false, txtBrandDisable: txtBrandDisable, txtSerialDisable: txtSerialDisable,
        txtScaleDisable: txtScaleDisable, yearDisable: yearDisable, confirmedFilledInfo: confirmedFilledInfo})
    }
  },
  
})
