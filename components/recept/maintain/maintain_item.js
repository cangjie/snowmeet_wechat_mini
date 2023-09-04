// components/recept/maintain/maintain_item.js
const app = getApp()
Component({
  /**
   * Component properties
   */
  properties: {
    receptId: Number
  },

  /**
   * Component initial data
   */
  data: {
    relationItems:['本人', '配偶', '朋友', '长辈'],
    currentItemIndex: -1,
    currentItemValid: false
  },
  ready(){
    var that = this
    app.loginPromiseNew.then(function(resovle){
        that.getData()
    })

  },

  /**
   * Component methods
   */
  methods: {

    fixItems(){
      var that = this
      var items = that.data.recept.maintainOrder.items
      for(var i = 0; i < items.length; i++){
        var serviceDesc = ''
        var item = items[i]
        if (item.confirmed_edge == 1){
          serviceDesc += ' 修刃'
        }
        if (item.confirmed_candle == 1){
          serviceDesc += ' 打蜡'
        }
        item.serviceDesc = serviceDesc
        if (item.confirmed_relation == ''){
          item.confirmed_relation = '本人'
        }
        var images = item.confirmed_images
        if (images != '' && images != undefined && images != null){
          item.headImage = images.split(',')[0]
        }
        else{
          item.headImage = ''
        }
      }
      that.setData({recept: recept})
    },


    checkCurrentItem(){
      var valid = true
      var that = this
      var item = that.data.item
      if (item.confirmed_equip_type == ''){
        valid = false
      }
      else if (item.confirmed_brand == ''){
        valid = false
      }
      else if (item.confirmed_scale == ''){
        valid = false
      }
      else if (item.confirmed_images == '' || item.confirmed_images == undefined || item.confirmed_images == null){
        valid = false
      }
      else if (item.confirmed_edge != 1 && item.confirmed_candle != 1 
        && ( item.confirmed_more == '' || item.confirmed_more == undefined || item.confirmed_more == null) ){
        valid = false    
      }

    },

    save(){
      var that = this
      var item = that.data.item
      var recept = that.data.recept
      var maintainOrder = recept.maintainOrder
      var items = maintainOrder.items
      items.push(item)
      item = {confirmed_equip_type: '双板'}
      that.setData({currentItem: item, currentItemIndex: -1, recept: recept})
    },
    
    getData(){
        var that = this
        var getUrl = 'https://' + app.globalData.domainName + '/core/Recept/GetRecept/' + that.data.receptId + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
        wx.request({
          url: getUrl,
          method: 'GET',
          success:(res)=>{
              if (res.statusCode != 200){
                  return
              }
              var recept = res.data
              var maintainOrder = recept.maintainOrder
              var items = maintainOrder.items
              var currentItem = {}
              var currentItemIndex = -1
              if (items.length > 0){
                  currentItem = items[0]
                  if (currentItem.confirmed_equip_type != '双板' && currentItem.confirmed_equip_type != '单板'){
                    currentItem.confirmed_equip_type = '双板'
                  }
                  currentItemIndex = 0
              }
              else{
                  currentItem = {confirmed_equip_type:'双板'}
              }
              that.getBoardBrands()
              that.getSkiBrands()
              that.setData({recept: res.data, item: currentItem, currentItemIndex: currentItemIndex})
              that.fixItems()
              //that.getBrands(currentItem.confirmed_equip_type)
              //that.getMaintainLog()
          }
        })
    },



    getBoardBrands(){
        var that = this
        var getBrandUrl = 'https://' + app.globalData.domainName + '/core/MaintainLive/GetBrand?type=' + encodeURIComponent('单板')
        wx.request({
          url: getBrandUrl,
          method: 'GET',
          success:(res)=>{
            var boardBrands = []
            for(var i = 0; i < res.data.length; i++){
              var brand = res.data[i].brand_name.trim()
              if (res.data[i].chinese_name.trim()!=''){
                brand = brand + '/' + res.data[i].chinese_name.trim()
              }
              boardBrands.push(brand)
            }
            that.setData({boardBrands: boardBrands})
          }
        })
      },
      getSkiBrands(){
        var that = this
        var getBrandUrl = 'https://' + app.globalData.domainName + '/core/MaintainLive/GetBrand?type=' + encodeURIComponent('双板')
        wx.request({
          url: getBrandUrl,
          method: 'GET',
          success:(res)=>{
            var boardBrands = []
            for(var i = 0; i < res.data.length; i++){
              var brand = res.data[i].brand_name.trim()
              if (res.data[i].chinese_name.trim()!=''){
                brand = brand + '/' + res.data[i].chinese_name.trim()
              }
              boardBrands.push(brand)
            }
            that.setData({skiBrands: boardBrands})
          }
        })
      },
      itemTypeChanged(e){
          console.log('type change', e)
          var that = this
          var item = that.data.item
          item.confirmed_equip_type = e.detail.value
          that.setData({item: item})
      },
      itemBrandChanged(e){
        var that = this
        var brandList = that.data.skiBrands
        var item = that.data.item
        if (item.confirmed_equip_type  == '单板'){
          brandList = that.data.boardBrands
        }
        
        item.confirmed_brand  = brandList[parseInt(e.detail.value)]
        that.setData({item: item})
      }
    
    }

  
})
