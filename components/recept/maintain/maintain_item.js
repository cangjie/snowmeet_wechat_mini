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
    relationItems:['本人', '配偶', '朋友', '长辈']
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
              if (items.length > 0){
                  currentItem = items[0]
                  if (currentItem.confirmed_equip_type != '双板' && currentItem.confirmed_equip_type != '单板'){
                    currentItem.confirmed_equip_type = '双板'
                  }
              }
              else{
                  currentItem = {confirmed_equip_type:'双板'}
              }
              that.getBoardBrands()
              that.getSkiBrands()
              that.setData({recept: res.data, item: currentItem})
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
