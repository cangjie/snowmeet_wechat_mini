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
    currentItemValid: false,
    displayUploader: true
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

    addItem(){
      var that = this
      var item = {
        confirmed_equip_type : '双板',
        confirmed_images : ''
      }
      var recept = that.data.recept
      recept.maintainOrder.items.push(item)
      var currentItemIndex = recept.maintainOrder.items.length - 1
      that.setData({recept: recept, currentItemIndex: currentItemIndex, item: item})
      that.fixItems()
    },

    changed(e){
      console.log('select changed', e)
      var that = this
      var targetIdArr = e.currentTarget.id.split('_')
      var targetType = targetIdArr[0]
      var targetId = parseInt(targetIdArr[1])
      //var selectedEquipArr = that.data.selectedEquipArr
      //var currentEquip = selectedEquipArr[targetId]
      var currentEquip = that.data.item
      var value = e.detail.value
      switch(targetType){
        
        case 'scale':
          currentEquip.confirmed_scale = value
          break
        case 'front':
          currentEquip.confirmed_front = value
          break
        case 'footLength':
          currentEquip.confirmed_foot_length = value
          break
        case 'height':
          currentEquip.confirmed_height = value
          break
        case 'weight':
          currentEquip.confirmed_weight = value
          break
        case 'binderGap':
          currentEquip.confirmed_binder_gap = value
          break
        
        case 'dinFront':
          currentEquip.confirmed_front_din = value
          break
        case 'dinRear':
          currentEquip.confirmed_rear_din = value
          break
        case 'relation':
          var relation = that.data.relationItems[parseInt(value)]
          currentEquip.confirmed_relation = relation
          break
        case 'item':
          var edge = 0
          var candle = 0
          for(var i = 0; i < value.length; i++){
            switch(value[i].trim()){
              case '打蜡':
                candle = 1
                break
              case '修刃':
                edge = 1
                break
              default:
                break
            }
          }
          currentEquip.confirmed_candle = candle
          currentEquip.confirmed_edge = edge
          if (edge && (currentEquip.confirmed_degree == undefined || currentEquip.confirmed_degree == '')){
            currentEquip.confirmed_degree = '89'
          }
          break;
        case 'degree':
          currentEquip.confirmed_degree = value
          break
        case 'others':
          var v = ''
          for(var i = 0; i < value.length; i++){
            v = v + (v==''?'':',') + value[i].trim()
          }
          currentEquip.confirmed_more = v
          currentEquip = that.setOthersValue(currentEquip)
          break
        case 'memo':
          currentEquip.confirmed_memo = value
          break
        case 'othersCharge':
          currentEquip.confirmed_additional_fee = value
          break
        case 'urgent':
          currentEquip.confirmed_urgent = value.length.toString()
          break
        case 'binderAngleLeft':
          currentEquip.confirmed_left_angle = value
          break
        case 'binderAngleRight':
          currentEquip.confirmed_right_angle = value
          break
        case 'uploader':
          var images = ''
          var fileArr = e.detail.files
          for(var i = 0; i < fileArr.length; i++){
            images += ((i!=0)?',':'' + fileArr[i].url)
          }
          currentEquip.confirmed_images = images;
          break
        default:
          break
      }
      that.setData({item: currentEquip})
      
      that.checkCurrentItem()
      that.fixItems()
    },

    setOthersValue(item){
      var others = item.confirmed_more
      if (others.indexOf('补板底') >= 0){
        item.bu_ban_di = true
      }
      else {
        item.bu_ban_di = false
      }
      if (others.indexOf('修底刃') >= 0){
        item.xiu_di_ren = true
      }
      else {
        item.xiu_di_ren = false
      }
      if (others.indexOf('粘板面') >= 0){
        item.zhan_ban_mian = true
      }
      else {
        item.zhan_ban_mian = false
      }
      if (others.indexOf('雪杖等附件寄存') >= 0){
        item.fu_jian_ji_cun = true
      }
      else {
        item.fu_jian_ji_cun = false
      }
      if (others.indexOf('其它') >= 0){
        item.qi_ta = true
      }
      else {
        item.qi_ta = false
      }
      return item
    },

    selectItem(e){
      var that = this
      var index = parseInt(e.currentTarget.id)
      var item = that.data.recept.maintainOrder.items[index]
      //item.confirmed_images = ''
      that.setData({displayUploader: false})
      that.setData({currentItemIndex: index, item: item})
      that.setData({displayUploader: true})
    },

    fixItems(){
      var that = this
      var recept = that.data.recept
      var items = recept.maintainOrder.items
      for(var i = 0; i < items.length; i++){
        var serviceDesc = ''
        var item = items[i]
        if (item.confirmed_edge == 1){
          serviceDesc += ' 修刃'
        }
        if (item.confirmed_candle == 1){
          serviceDesc += ' 打蜡'
        }
        
        item.serviceDesc = serviceDesc + ' ' + (item.confirmed_more == undefined? '' : item.confirmed_more)
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
      that.setData({currentItemValid: valid})
    },

    save(){
      var that = this

      var itemIndex = that.data.currentItemIndex
      var item = that.data.item
      if (itemIndex > -1){
        var recept = that.data.recept
        var maintainOrder = recept.maintainOrder
        maintainOrder.items[itemIndex] = item
        that.setData({recept: recept})
        that.fixItems()
      }

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
          that.fixItems()
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
        that.fixItems()
      }
    
    }

  
})
