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
    totalPayStr: '¥0.00',
    rentDays: 1
  },
  pageLifetimes:{
    show(){
      var that = this
      this.lifetimes.ready()
    }
  },
  lifetimes:{
    ready(){
      var that = this
      app.loginPromiseNew.then(function (resolve){
        var getUrl = 'https://' + app.globalData.domainName + '/core/Recept/GetRecept/' + that.properties.receptId + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
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
                var orderStartDate = new Date(recept.rentOrder.start_date)
                if (orderStartDate.getFullYear()==1){
                  recept.rentOrder.start_date = startDate
                  recept.rentOrder.due_end_date = startDate
                }
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
    setDepositReduceTicket(e){
      var that = this
      var value = parseFloat(e.detail.value)
      if (!isNaN(value)){
        
        var recept = that.data.recept
        var rentOrder = recept.rentOrder
        rentOrder.deposit_reduce_ticket= value
        that.setData({recept: recept})
        that.checkValid()
        
      }
    },
    setPayOption(e){
      var that = this
      var recept = that.data.recept
      recept.rentOrder.pay_option = e.detail.value
      that.setData({recept: recept})
      if (that.data.recept != undefined && that.data.recept != null
        && that.data.recept.rentOrder != undefined && that.data.recept.rentOrder != null){
          that.checkValid()
      }
    },

    setMemo(e){
      var that = this
      var recept = that.data.recept
      recept.rentOrder.memo = e.detail.value
      that.setData({recept: recept})
    },

    setDueEndTime(e){
      
      var days = parseInt(e.detail.value)
      var that = this
      var recept = that.data.recept
      var rentOrder = recept.rentOrder
      var startDate = new Date(rentOrder.start_date)
      var endDate = new Date(rentOrder.due_end_date)
      if (startDate.getFullYear() < 2000){
        startDate = new Date()
        endDate = new Date()
       
      }
      else{
        startDate = new Date(rentOrder.start_date)
        endDate = new Date(rentOrder.due_end_date)

      }
      endDate.setDate(endDate.getDate() + days - 1)
      rentOrder.start_date = util.formatDate(startDate)
      rentOrder.due_end_date = util.formatDate(endDate)
      that.setData({rentDays: days, recept: recept})
      that.checkValid()
    },
    checkValid(){
      var that = this
      var recept = that.data.recept
      var rentOrder = recept.rentOrder
      var totalPay = rentOrder.deposit - rentOrder.deposit_reduce - rentOrder.deposit_reduce_ticket
      rentOrder.deposit_final = totalPay
      that.setData({totalPayStr: util.showAmount(totalPay)})
      var goon = true
      if (recept.rentOrder.pay_option == undefined 
        || recept.rentOrder.pay_option == null 
        || recept.rentOrder.pay_option == ''){
          goon = false
        }
      that.triggerEvent('CheckValid', {Goon: goon, recept: recept})
    }
  }
})
