// components/recept/rent/confirm_item.js
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
      
    }
  },

  ready(){
    var that = this
    var nowDate = new Date()
    var days = 1
    nowDate.setDate(nowDate.getDate() + days)
    that.setData({dueEndDate: nowDate, rentDays: days})
    app.loginPromiseNew.then(function (resolve){
      var getClassUrl = 'https://' + app.globalData.domainName + '/core/Rent/GetClassList'
      wx.request({
        url: getClassUrl,
        method: 'GET',
        success:(res)=>{
          if (res.statusCode != 200){
            return
          }
          var classList = ['请选择...']
          for(var i = 0; i < res.data.length; i++){
            classList.push(res.data[i])
          }
          that.setData({classList: classList})
          var getUrl = 'https://' + app.globalData.domainName + '/core/Recept/GetRecept/' + that.properties.receptId + '?sessionKey=' + app.globalData.sessionKey
          wx.request({
            url: getUrl,
            success:(res)=>{
              if (res.statusCode != 200){
                return
              }
              var recept = res.data
              var rentItemList = []
              if (recept != null && recept.rentOrder != null && recept.rentOrder.details != null){
                for(var i = 0; i < recept.rentOrder.details.length; i++){
                  var detail = recept.rentOrder.details[i]
                  var classIndex = 0
                  var classList = that.data.classList
                  for(var j = 0; j < classList.length; j++){
                    if (classList[j] == detail.rent_item_class){
                      classIndex = j
                      break
                    }
                  }
                  var startDate = util.formatDate(new Date(detail.start_date))
                  var item = {index: i, code: detail.rent_item_code, isNoCode: (detail.rent_item_code == ''), class: detail.rent_item_class, classSelectedIndex: classIndex, name: detail.rent_item_name, rental: detail.unit_rental, deposit: detail.deposit, depositType: detail.deposit_type, startDate: startDate, memo: detail.memo, rentalStr: util.showAmount(detail.unit_rental), depositStr: util.showAmount(detail.deposit)}
                  rentItemList.push(item)
                }
              }
              that.setData({recept: recept, rentItemList: rentItemList})
              console.log('confirm_item', recept)
              that.checkValid()
            }
          })
        }
      })
    })
    that.checkValid()
  },
  
  /**
   * Component methods
   */
  methods: {
    selectClass(e){
      var that = this
      var currentRentItem = that.data.currentRentItem
      var currentClass = that.data.classList[e.detail.value]
      currentRentItem.class = currentClass
      currentRentItem.classSelectedIndex = e.detail.value
      that.setData({currentRentItem: currentRentItem})
    },
    checkValid(){
      var that = this
      var isValid = true
      var recept = that.data.recept
      if (recept == undefined || recept.rentOrder == undefined ){
        isValid = false
        return
      }
      var rentItemList = that.data.rentItemList
      var rentDetails = []
      for(var i = 0; i < rentItemList.length; i++){
        var memo = rentItemList[i].memo
        if (memo == undefined || memo == ''){
          memo = ''
        }
        var images = rentItemList[i].images
        if (images == undefined || images == ''){
          images = ''
        }
       
        var startDate = util.formatDate(new Date())
        if (rentItemList[i].startDate == null){
          startDate = null
        }
        else{
          startDate = util.formatDate(new Date(rentItemList[i].startDate))
        }
  
  
  
        var item = {id: 0, rent_list_id: 0, rent_item_name: rentItemList[i].name, rent_item_class: rentItemList[i].class, 
          rent_item_code: rentItemList[i].code, deposit: rentItemList[i].deposit, deposit_type: rentItemList[i].depositType,
          unit_rental: rentItemList[i].rental, memo: memo, images: images, start_date: startDate}
          rentDetails.push(item)

          var rentItem = rentItemList[i]
          if ( (  rentItem.depositType != '预付押金' && (  rentItem.name == '' || (!rentItem.isNoCode  && rentItem.code == '') || rentItem.class == '' ))
          || rentItem.rental == 0 || rentItem.deposit == 0){
            isValid = false
          }


      }
      recept.rentOrder.details = rentDetails
      recept.submit_data = ''

      if (rentItemList.length == 0){
        isValid = false
        
        
      }
      that.triggerEvent('CheckValid', {Goon: isValid, recept: recept})
      

      
    },
    inputCode(e){
      var code = e.detail.value
      var that = this
      var currentRentItem = that.data.currentRentItem
      currentRentItem.code = code
      that.getItemInfo(code)
    },
    scan(){
      var that = this
      wx.scanCode({
        onlyFromCamera: false,
        success:(res)=>{
          console.log('scan result', res)
          var code = res.result
          var currentRentItem = that.data.currentRentItem
          currentRentItem.code = code
          that.getItemInfo(code)
        }
      })
    },
    changeNoCode(e){
      var that = this
      var value = e.detail.value
      var currentRentItem = that.data.currentRentItem
      currentRentItem.isNoCode = e.detail.value
      if (currentRentItem.isNoCode){
        currentRentItem.code = ''
      }
      that.setData({currentRentItem: currentRentItem})
    },
    getItemInfo(code){
      var that = this
      var currentRentItem = that.data.currentRentItem
      var classList = that.data.classList
      var getItemUrl = 'https://' + app.globalData.domainName + '/core/Rent/GetRentItem/' + code + '?shop=' + encodeURIComponent('万龙')
      wx.request({
        url: getItemUrl,
        success:(res)=>{
          if (res.statusCode == 200){
            currentRentItem.name = res.data.name
            currentRentItem.class = res.data.class
            currentRentItem.classSelectIndex = 0
            for(var i = 0; i < classList.length; i++){
              if (classList[i] == currentRentItem.class){
                currentRentItem.classSelectedIndex = i
                break
              }
            }
            currentRentItem.rental = res.data.rental
            currentRentItem.deposit = res.data.deposit
            that.setData({currentRentItem: currentRentItem})
            /*
            rentItem.code = code
            rentItem.name = res.data.name
            rentItem.deposit = res.data.deposit
            rentItem.rental = res.data.rental
            rentItem.noCode = false
            rentItemList[index] = rentItem
            that.setData({rentItemList: rentItemList})
            that.checkValid()
            */
          }
        }
      })
    },
    save(){
      var that = this
      var rentItemList = that.data.rentItemList
      var currentRentItem = that.data.currentRentItem
      var valid = true
      var message = ''
      if (currentRentItem.isNoCode && currentRentItem.code != ''){
        message = '无码物品无编码'
        valid = false
      }
      else if(!currentRentItem.isNoCode && currentRentItem.code == ''){
        message = '请填写编码'
        valid = false
      }
      else if (currentRentItem.name == ''){
        message = '请填写名称'
        valid = false
      }
      else if (currentRentItem.class == '' || currentRentItem.classSelectedIndex == 0){
        message = '请选择分类'
        valid = false
      }
      else if (currentRentItem.depositType == ''){
        message = '请选择押金类型'
        valid = false
      }
      else{
        message = ''
        valid = true
      }
      if (currentRentItem.depositType == '预付押金'){
        var deposit = parseFloat(currentRentItem.deposit)
        if (isNaN(deposit) || deposit <= 0){
          message = '预付押金不为0'
          valid = false
        }
        else if (currentRentItem.class == '' || currentRentItem.classSelectedIndex == 0){
          message = '请选择分类'
          valid = false
        }
    
        else {
          message = ''
          valid = true
          
        }
  
  
        
      }
      if (!valid){
        wx.showToast({
          title: message,
          icon: 'error'
        })
        return
      }
      
  
  
  
  
      currentRentItem.depositStr = util.showAmount(parseFloat(currentRentItem.deposit))
      currentRentItem.rentalStr = util.showAmount(parseFloat(currentRentItem.rental))
      if (currentRentItem.index == -1){
        currentRentItem.index = rentItemList.length
        rentItemList.push(currentRentItem)
      }
      else{
        for(var i = 0; i < rentItemList.length; i++){
          if (rentItemList[i].index == currentRentItem.index){
            rentItemList[i] = currentRentItem
            break;
          }
        }
      }
      
      currentRentItem = {
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
        memo: ''
      }
      that.setData({rentItemList: rentItemList, currentRentItem: currentRentItem, isToday: true})
      that.checkValid()
    },
    selectItem(e){
      var that = this
      var id = e.currentTarget.id
      var rentItemList = that.data.rentItemList
      var currentRentItem = rentItemList[parseInt(id)]
      var isToday = false
      var now = new Date()
      var startDate = new Date(currentRentItem.startDate)
      if (now.getFullYear() == startDate.getFullYear() && now.getMonth() == startDate.getMonth() && startDate.getDate() == now.getDate()){
        isToday = true
      }
      that.setData({currentRentItem: currentRentItem, isToday: isToday})
    },
    del(){
      var that = this
      var currentRentItem = that.data.currentRentItem
      var rentItemList = that.data.rentItemList
      var rentItemListNew = []
      var j = 0
      for(var i = 0; i < rentItemList.length; i++){
        if (currentRentItem.index != rentItemList[i].index){
          rentItemList[i].index = j
          j++
          rentItemListNew.push(rentItemList[i])
        }
      }
      currentRentItem = {
        index: -1,
        code:'',
        isNoCode: false,
        class:'',
        classSelectedIndex: 0,
        name: '',
        rental: 0,
        deposit: 0,
        depositType:'立即租赁',
        startDate: util.formatDate(new Date()),
        memo: ''
      }
      that.setData({currentRentItem: currentRentItem, rentItemList: rentItemListNew})
      that.checkValid()
    },
    setDepositType(e){
      var that = this
      var currentRentItem = that.data.currentRentItem
      currentRentItem.depositType = e.detail.value
      if (currentRentItem.depositType == '预付押金'){
        currentRentItem.name = ''
        currentRentItem.code = ''
        currentRentItem.rental = 0
        currentRentItem.isNoCode = false
        currentRentItem.startDate = null
      }
      else if (currentRentItem.depositType == '预约租赁'){
        currentRentItem.startDate = null
      }
      
      that.setData({currentRentItem: currentRentItem})
    },
    setNumber(e){
      var that = this
      var fieldName = ''
      switch(e.currentTarget.id){
        case 'rental':
          fieldName = '租金'
          break
        case 'deposit':
          fieldName = '押金'
          break
        default:
          break
      }
      var message = ''
      if (fieldName!=''){
        var amount = parseFloat(e.detail.value)
        var currentRentItem = that.data.currentRentItem
        if (!isNaN(amount)){
          var displayedValue = amount
          if (amount.toString() != e.detail.value){
            displayedValue = e.detail.value
          }
          switch(fieldName){
            case '租金':
              currentRentItem.rental = displayedValue
              break
            case '押金':
              currentRentItem.deposit = displayedValue
              break
            default:
              break
          }
          that.setData({currentRentItem: currentRentItem})
        }
        else{
          message = '请填正确' + fieldName
          wx.showToast({
            title: message,
            icon: 'error',
            success:(res)=>{
              switch(fieldName){
                case '租金':
                  currentRentItem.rental = e.detail.value
                  break
                case '押金':
                  currentRentItem.deposit = e.detail.value
                  break
                default:
                  break
              }
              that.setData({currentRentItem: currentRentItem})
            }
          })
        }
      }
    },
    setMemo(e){
      var that = this
      var currentRentItem = that.data.currentRentItem
      currentRentItem.memo = e.detail.value
      that.setData({currentRentItem: currentRentItem})
    },
    setName(e){
      var that = this
      var currentRentItem = that.data.currentRentItem
      currentRentItem.name = e.detail.value
      that.setData({currentRentItem: currentRentItem})
    },
  }
})