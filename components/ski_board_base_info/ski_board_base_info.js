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
  ready: function() {
    var confirmedFilledInfo = this.data.confirmedFilledInfo
    confirmedFilledInfo.type = this.properties.type
    confirmedFilledInfo.brand = this.properties.brand
    confirmedFilledInfo.serial = this.properties.serial
    confirmedFilledInfo.scale = this.properties.scale
    confirmedFilledInfo.year = this.properties.year
    var typeSki = true
    var yearIndex = 0
    if (this.properties.type == '单板') {
      typeSki = false
    }
    for(var i = 0;  i < this.data.years.length; i++) {
      if (this.properties.year == this.data.years[i].toString()) {
        yearIndex = i
        break
      }
    }
    this.setData({confirmedFilledInfo: confirmedFilledInfo, typeSki: typeSki, yearIndex: yearIndex})
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
    yearDisable: true,
    pickViewValue:[0,0,0,0],
    dialogTitle:'',
    typeSki: true
  },

  /**
   * Component methods
   */
  methods: {
    selectSkiBoardInfo: function(source) {
      var showDialog = false
      switch(source.currentTarget.id) {
        case "txtBrand":
          if (this.data.txtBrandDisable) {
            showDialog = true
          }
          break;
        case "txtSerial" :
          if (this.data.txtSerialDisable) {
            showDialog = true
          }
          break
        case "txtScale":
          if (this.data.txtScaleDisable) {
            showDialog = true
          }
          break
        case "year":
          if (this.data.yearDisable) {
            showDialog = true
          }
          break
        case "radioType":
          var confirmedFilledInfo = this.data.confirmedFilledInfo
          if (source.detail.value.trim() != confirmedFilledInfo.type) {
            confirmedFilledInfo.type = source.detail.value.trim()
            confirmedFilledInfo.brand = ""
            confirmedFilledInfo.scale = ""
            confirmedFilledInfo.serial = ""
            confirmedFilledInfo.year = ""
            showDialog = true
          }
          this.setData({confirmedFilledInfo: confirmedFilledInfo})
          break
        default:
          break
      }
      if (showDialog) {
        this.showPickerDialog(source)
      }
    },
    yearPickerChange: function(e) {
      var confirmedFilledInfo = this.data.confirmedFilledInfo
      confirmedFilledInfo.year = this.data.years[e.detail.value]
      this.setData({yearIndex: e.detail.value, confirmedFilledInfo: confirmedFilledInfo})
      this.triggerEvent('infoChange', {confirmedFilledInfo: confirmedFilledInfo}, 100)
    },
    textChange: function(e) {
      var confirmedFilledInfo = this.data.confirmedFilledInfo
      switch(e.currentTarget.id) {
        case 'txtBrand':
          confirmedFilledInfo.brand = e.detail.value
          break
        case 'txtSerial':
          confirmedFilledInfo.serial = e.detail.value
          break
        case 'txtScale':
          confirmedFilledInfo.scale = e.detail.value
          break
        default:
          break
      }
      this.setData({confirmedFilledInfo: confirmedFilledInfo})
      this.triggerEvent('infoChange', {confirmedFilledInfo: confirmedFilledInfo}, 100)
    },
    showPickerDialog: function(source) {
      this.setData({dialogShow: true})
      this.fillPickView()
    },
    fillPickView: function() {
      var allSkiBoardScales = this.data.allSkiBoardScales
      var pickViewValue = this.data.pickViewValue
      var brandList = []
      var serialList = []
      var scaleList = []
      var yearList = []
      var lastBrand = ''
      var lastSerial = ''
      var lastScale = ''
      var lastYear = ''
      var brandIndex = 0
      var serialIndex = 0
      var scaleIndex = 0
      var yearIndex = 0
      var currentBrand = ''
      var currentSerial = ''
      var currentScale = ''
      var currentYear = ''
      var info = this.data.confirmedFilledInfo
      for(var i = 0; i < allSkiBoardScales.length; i++) {
        if (allSkiBoardScales[i].type==info.type) {
          if (lastBrand != allSkiBoardScales[i].brand) {
            brandList.push(allSkiBoardScales[i].brand)
            lastBrand = allSkiBoardScales[i].brand
            if (brandIndex == pickViewValue[0]) {
              currentBrand = allSkiBoardScales[i].brand
            }
            brandIndex++
          }
          if (currentBrand == allSkiBoardScales[i].brand) {
            if (lastSerial != allSkiBoardScales[i].serial){
              serialList.push(allSkiBoardScales[i].serial)
              lastSerial = allSkiBoardScales[i].serial
              if (serialIndex == pickViewValue[1]) {
                currentSerial = allSkiBoardScales[i].serial
              }
              serialIndex++
            }
          }
          if (currentBrand == allSkiBoardScales[i].brand && currentSerial == allSkiBoardScales[i].serial) {
            if (lastScale != allSkiBoardScales[i].scale) {
              scaleList.push(allSkiBoardScales[i].scale)
              lastScale = allSkiBoardScales[i].scale
              if (scaleIndex == pickViewValue[2]) {
                currentScale = allSkiBoardScales[i].scale
              }
              scaleIndex++
            }
          }
          if (currentBrand == allSkiBoardScales[i].brand && currentSerial == allSkiBoardScales[i].serial && currentScale == allSkiBoardScales[i].scale) {
            yearList.push(allSkiBoardScales[i].year)
          }
        }
      }
      brandList.push('自填')
      serialList.push('自填')
      scaleList.push('自填')
      yearList.push('自填')
      var dialogTitle = brandList[pickViewValue[0]] + ' ' + serialList[pickViewValue[1]] + ' ' + scaleList[pickViewValue[2]] + ' ' + yearList[pickViewValue[3]]

      this.setData({brandList: brandList, serialList: serialList, scaleList: scaleList, yearList: yearList, dialogTitle: dialogTitle, pickViewValue: pickViewValue})
    },
    pickerViewChange: function(e) {
      
      this.setData({pickViewValue: e.detail.value})
      this.fillPickView()
    },
    tapDialogButton: function (e) {
      var pickViewValue = this.data.pickViewValue
      var confirmedFilledInfo = this.data.confirmedFilledInfo
      var txtBrandDisable = true
      var txtSerialDisable = true
      var txtScaleDisable = true
      var yearDisable = true
      var brandList = this.data.brandList
      var serialList = this.data.serialList
      var scaleList = this.data.scaleList
      var yearList = this.data.yearList
      var years = this.data.years
      if (e.detail.index == 1) {
        if (pickViewValue[0] < brandList.length - 1) {
          confirmedFilledInfo.brand = brandList[pickViewValue[0]]
        }
        else {
          confirmedFilledInfo.brand = ''
          txtBrandDisable = false
        }
        if (pickViewValue[1] < serialList.length - 1) {
          confirmedFilledInfo.serial = serialList[pickViewValue[1]]
        }
        else {
          confirmedFilledInfo.serial = ''
          txtSerialDisable = false
        }
        if (pickViewValue[2] < scaleList.length - 1) {
          confirmedFilledInfo.scale = scaleList[pickViewValue[2]]
        }
        else {
          confirmedFilledInfo.scale = ''
          txtScaleDisable = false
        }
        if (pickViewValue[3] < yearList.length - 1) {
          confirmedFilledInfo.year = yearList[pickViewValue[3]]
          var yearIndex = 0
          for(var i = 0; i < years.length; i++){
            if (confirmedFilledInfo.year == years[i]) {
              yearIndex = i
              this.setData({yearIndex: yearIndex})
              break
            }
          }
        }
        else {
          confirmedFilledInfo.year = ''
          yearDisable = false
        }
        this.triggerEvent('infoChange', {confirmedFilledInfo: confirmedFilledInfo}, 100)
      }
      this.setData({dialogShow: false, txtBrandDisable: txtBrandDisable, txtSerialDisable: txtSerialDisable,
        txtScaleDisable: txtScaleDisable, yearDisable: yearDisable, confirmedFilledInfo: confirmedFilledInfo})
      this.fillPickView()
    }
  },
})
