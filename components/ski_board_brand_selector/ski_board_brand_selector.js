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
  lifetimes:{
    attached: function(e) {
      var that = this
      that.data.equipType = (that.properties.equipType!=undefined)?that.properties.equipType:''
      that.data.brand = (that.properties.brand!=undefined)?that.properties.brand:''
      that.data.readOnly = (that.properties.readOnly!=undefined)?that.properties.readOnly:false
      var skiList = that.data.skiList
      var boardList = that.data.boardList
      var brandListUrl = 'https://' + app.globalData.domainName + '/api/brand_list_get.aspx'
      wx.request({
        url: brandListUrl,
        method:'GET',
        success:(res)=>{
          var listArray = res.data.brand_list
          var selectedIndex = 0
          var skiIndex = 0
          var boardIndex = 0
          for(var i = 0; i < listArray.length; i++){
            var brandName = listArray[i].brand_name+ (listArray[i].chinese_name.trim() != ''?'/':'')+listArray[i].chinese_name
            
            if (listArray[i].brand_type == '双板'){
              skiList.push(brandName)
              skiIndex++
            }
            if (listArray[i].brand_type == '单板'){
              boardList.push(brandName)
              boardIndex++
            }
            if (selectedIndex == 0 && (listArray[i].brand_name == that.data.brand 
              || (listArray[i].chinese_name == that.data.brand && listArray[i].chinese_name!='')
              || brandName == that.data.brand)){
              selectedIndex = (that.data.equipType == '' ||  that.data.equipType == '双板')?skiIndex:boardIndex 
            }
          }
          
          

          skiList.push('未知')
          boardList.push('未知')
          var displayedBrandList = (that.data.equipType == '' ||  that.data.equipType == '双板')?skiList:boardList

          if (that.data.brand !='' && selectedIndex == 0){
            selectedIndex = displayedBrandList.length - 1
          }

          that.setData({displayedBrandList: displayedBrandList, selectedIndex: selectedIndex, skiList: skiList, boardList: boardList})
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
      that.setData({selectedIndex: 0, displayedBrandList: displayedBrandList, equipType: equipType})
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
