// components/recept/rent/confirm_deposit.js
const app = getApp()
const util = require('../../../utils/util.js')
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
    rentItemList:[],
    currentRentItem:{
      index: -1,
      code:'',
      isNoCode: false,
      class:'',
      classSelectedIndex: 0,
      name: '',
      rental: 0,
      deposit: 0,
      depositType:'',
      startDate: util.formatDate(new Date()),
      memo: '',
      
    },
    totalDepositStr: '¥0.00',
    totalRentalStr: '¥0.00',
    creditImages: '',
    totalPayStr: '¥0.00'
  },
  lifetimes:{
    ready(){
      var that = this
      app.loginPromiseNew.then(function (resolve){
        var getUrl = 'https://' + app.globalData.domainName + '/core/Recept/GetRecept/' + that.properties.receptId + '?sessionKey=' + app.globalData.sessionKey
        wx.request({
          url: getUrl,
          success:(res)=>{
            if (res.statusCode != 200){
              return
            }
            var recept = res.data
            var rentItemList = []
            var totalDeposit = 0
            var totalRental = 0
            var totalPay = 0
            if (recept != null && recept.rentOrder != null && recept.rentOrder.details != null){
              totalPay = recept.rentOrder.deposit_real - recept.rentOrder.deposit_reduce
              for(var i = 0; i < recept.rentOrder.details.length; i++){
                var detail = recept.rentOrder.details[i]
                
                var startDate = util.formatDate(new Date(detail.start_date))
                var item = {index: i, code: detail.rent_item_code, isNoCode: (detail.rent_item_code == ''), class: detail.rent_item_class, name: detail.rent_item_name, rental: detail.unit_rental, deposit: detail.deposit, depositType: detail.deposit_type, startDate: startDate, memo: detail.memo, rentalStr: util.showAmount(detail.unit_rental), depositStr: util.showAmount(detail.deposit)}
                totalDeposit += detail.deposit
                totalRental += detail.unit_rental
                rentItemList.push(item)
              }
            }
            
            that.setData({recept: recept, rentItemList: rentItemList, 
              totalDepositStr: util.showAmount(totalDeposit), totalRentalStr: util.showAmount(totalRental), totalPayStr: util.showAmount(totalPay)})
            that.checkValid()
            console.log('confirm_item', recept)
          }
        })
      })
    }
  },

  /**
   * Component methods
   */
  methods: {
    setCredit(e){
      var that = this
      var haveCredit = false
      if (e.detail.value == '0'){
        haveCredit = false
      }
      else if (e.detail.value == '1'){
        haveCredit = true
      }
      that.setData({haveCredit: haveCredit})
    },
    uploadCreditImages(e){
      var that = this
      var images = ''
      var imagesArr = e.detail.files
      for(var i = 0; i < imagesArr.length; i++){
        images = images + (images == '' ? '' : ',') + imagesArr[i].url
      }
      that.setData({creditImages: images})
    },
    setTotalDepositReal(e){
      var that = this
      var value = parseFloat(e.detail.value)
      if (!isNaN(value)){
        var recept = that.data.recept
        var rentOrder = recept.rentOrder
        rentOrder.deposit_real = value
        that.setData({recept: recept})
        that.checkValid()
      }
    },
    setDepositReduce(e){
      var that = this
      var value = parseFloat(e.detail.value)
      if (!isNaN(value)){
        
        var recept = that.data.recept
        var rentOrder = recept.rentOrder
        rentOrder.deposit_reduce = value
        that.setData({recept: recept})
        that.checkValid()
        
      }
    },
    checkValid(){
      var that = this
      var recept = that.data.recept
      var rentOrder = recept.rentOrder
      if (rentOrder.deposit_real != 0){
        var totalPay = rentOrder.deposit_real - rentOrder.deposit_reduce
        rentOrder.deposit_final = totalPay
        that.setData({totalPayStr: util.showAmount(totalPay)})
        that.triggerEvent('CheckValid', {Goon: true, recept: recept})

      }
    }
  }
})
