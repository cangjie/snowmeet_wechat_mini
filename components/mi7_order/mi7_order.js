// components/mi7_order/mi7_order.js
Component({
  /**
   * Component properties
   */
  properties: {
    mi7OrderStr:{
      type: String,
      value: ''
    }
  },

  /**
   * Component initial data
   */
  data: {
    //mi7Orders:[{mi7OrderNo: null, mi7SalePrice: null, mi7ChargePrice: null}],
    totalSalePrice: 0,
    totalChargePrice: 0
  },
  lifetimes:{
    ready(){
      var that = this
      var orderArr = that.properties.mi7OrderStr.split(';')
      var mi7Orders = []
      var totalSalePrice = 0
      var totalChargePrice = 0
      for(var i = 0; i < orderArr.length; i++){
        if (orderArr[i].trim()!=''){
          var fields = orderArr[i].split(',')
          var item = {mi7OrderNo: fields[0], mi7SalePrice: fields[1], mi7ChargePrice: fields[2]}
          var salePrice = parseFloat(fields[1])
          var chargePrice = parseFloat(fields[2])
          if (!isNaN(salePrice)){
            totalSalePrice = totalSalePrice + salePrice
          }
          if (!isNaN(chargePrice)){
            totalChargePrice = totalChargePrice + chargePrice
          }
          item.barCode = fields[3]
          mi7Orders.push(item)
        }
      }
      if (mi7Orders.length == 0){
        mi7Orders.push({mi7OrderNo: null, mi7SalePrice: null, mi7ChargePrice: null})
      }
      that.setData({mi7Orders: mi7Orders, totalSalePrice: totalSalePrice, totalChargePrice: totalChargePrice})
      that.triggerEvent('Mi7OrderChanged',{mi7OrderStr: that.properties.mi7OrderStr, mi7Orders, totalChargePrice,totalSalePrice})
    }

  },

  /**
   * Component methods
   */
  methods: {
    scan(e){
      var that = this
      console.log('scan', e)
      var id = e.currentTarget.id
      wx.scanCode({
        onlyFromCamera: false,
        success:(res)=>{
          console.log('scan result', res)
          var code = res.result
          var mi7Orders = that.data.mi7Orders
          var order = mi7Orders[parseInt(id)]
          order.barCode = code
          that.setData({mi7Orders: mi7Orders})
          that.change()
          /*
          var currentRentItem = that.data.currentRentItem
          currentRentItem.code = code
          that.getItemInfo(code)
          */
        }
      })
    },
    addNew(){
      var that = this
      var mi7Orders = that.data.mi7Orders
      mi7Orders.push({mi7OrderNo: null, mi7SalePrice: null, mi7ChargePrice: null, barCode: null})
      that.setData({mi7Orders: mi7Orders})
    },
    modMi7Order(e){
      console.log('mod mi7 order', e)
      var that = this
      var mi7Orders = that.data.mi7Orders
      var index = -1
      var sourceId = e.currentTarget.id
      var sourceName = ''
      try{
        index = parseInt(sourceId.split('_')[1])
        sourceName = sourceId.split('_')[0]
      }
      catch{
        return;
      }
      switch(sourceName.trim()){
        case 'mi7OrderNo':
          var orderNo = e.detail.value
          if (orderNo.trim() == ''){
            wx.showToast({
              title: '订单号不能为空。',
              icon: 'none'
            })
          }
          mi7Orders[index].mi7OrderNo = orderNo
          break
        case 'mi7OrderSalePrice':
          var salePrice = parseFloat(e.detail.value)
          if (isNaN(salePrice)){
            wx.showToast({
              title: '请填写正确格式的价格。',
              icon: 'none'
            })
            
          }
          
          mi7Orders[index].mi7SalePrice = e.detail.value
          break
        case 'mi7OrderChargePrice':
          var chargePrice = parseFloat(e.detail.value)
          if (isNaN(chargePrice)){
            wx.showToast({
              title: '请填写正确格式的价格。',
              icon:'none'
            })
            //mi7Orders[index].mi7ChargePrice = null
          }
          mi7Orders[index].mi7ChargePrice = e.detail.value
          break
        case 'switch':
          if (e.detail.value){
            mi7Orders[index].mi7OrderNo = '紧急开单'
          }
          else{
            mi7Orders[index].mi7OrderNo = ''
          }
          break
        case 'mi7OrderBarCode':
          mi7Orders[index].barCode = e.detail.value
          break
        default:
          break
      }
      that.setData({mi7Orders: mi7Orders})
      that.change()
    },

    change(){
      var that = this
      var mi7Orders = that.data.mi7Orders
      var totalSalePrice = 0
      var totalChargePrice = 0
      var mi7OrderStr = ''
      for(var i = 0; i < mi7Orders.length; i++){
        var item = ''
        var salePrice = parseFloat(mi7Orders[i].mi7SalePrice)
        if (!isNaN(salePrice)){
          totalSalePrice = totalSalePrice + salePrice
        }
        var chargePrice = parseFloat(mi7Orders[i].mi7ChargePrice)
        if (!isNaN(chargePrice)){
          totalChargePrice = totalChargePrice + chargePrice
          item = mi7Orders[i].mi7OrderNo+',' 
          + (!isNaN(salePrice)? salePrice : chargePrice).toString() + ',' + chargePrice.toString()
        }
        var barCode = mi7Orders[i].barCode
        if (barCode == undefined || barCode == null){
          item = item + ',' 
        }
        else{
          item = item + ',' +  barCode
        }

        if (item != ''){
          mi7OrderStr += ((mi7OrderStr!='')?';':'') + item
        }

        

        
      }
      that.setData({mi7Orders: mi7Orders, totalChargePrice: totalChargePrice, totalSalePrice: totalSalePrice})
      that.triggerEvent('Mi7OrderChanged',{mi7OrderStr,mi7Orders, totalChargePrice,totalSalePrice})
    }

  }
})
