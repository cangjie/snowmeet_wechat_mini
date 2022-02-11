// components/ski_board_brand_selector/ski_board_brand_selector.js
const app = getApp()
Component({
  /**
   * Component properties
   */
  properties: {
    equipType:{
      type: String,
      value: '双板'
    },
    brand:{
      type: String,
      value: ''
    },
    readOnly:{
      type: Boolean,
      value: false
    }
  },

  /**
   * Component initial data
   */
  data: {
    equipType: '双板',
    brand:'',
    readOnly: false,
    selectedIndex: 0,
    skiList: ['请选择...'],
    boardList: ['请选择...'],

  }, 
  pageLifetimes:{
    show: function(e) {
      var that = this
      that.data.equipType = that.properties.equipType
      that.data.brand = that.properties.brand
      that.data.readOnly = that.properties.readOnly
      var skiList = that.data.skiList
      var boardList = that.data.boardList
      var brandListUrl = 'https://' + app.globalData.domainName + '/api/brand_list_get.aspx'
      wx.request({
        url: brandListUrl,
        method:'GET',
        success:(res)=>{
          var listArray = res.data.brand_list
          for(var i = 0; i < listArray.length; i++){
            var brandName = listArray[i].brand_name+ (listArray[i].chinese_name.trim() != ''?'/':'')+listArray[i].chinese_name
            if (listArray[i].brand_type == '双板'){
              skiList.push(brandName)
            }
            if (listArray[i].brand_type == '单板'){
              boardList.push(brandName)
            }
          }
          skiList.push('未知')
          boardList.push('未知')
          that.setData({displayedBrandList: skiList, selectedIndex: 0, skiList: skiList, boardList: boardList})
        }
      })

    }
  },
  /**
   * Component methods
   */
  methods: {
    selectType: function(e) {
      var that = this
      var equipType = e.detail.value
      var displayedBrandList = that.data.displayedBrandList
      if (equipType=='单板'){
        displayedBrandList = that.data.boardList
      }
      else {
        displayedBrandList = that.data.skiList
      }
      that.setData({selectedIndex: 0, displayedBrandList: displayedBrandList})
    },
    selectBrand: function(e){
      var that = this
      var selectedIndex = e.detail.value
      that.setData({selectedIndex: selectedIndex, brand: that.data.displayedBrandList[selectedIndex]})
      that.triggerEvent('BrandSelected', {equipType: that.data.equipType, brand: that.data.brand})
    },
    inputBrand: function(e){
      var that = this
      that.triggerEvent('BrandSelected', {equipType: that.data.equipType, brand: e.detail.value})
    }
  }
})
