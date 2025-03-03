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
    rentItemList: [],
    currentRentItem: {
      index: -1,
      code: '',
      isNoCode: false,
      class: '',
      classSelectedIndex: 0,
      name: '',
      rental: 0,
      deposit: 0,
      rental_discount: 0,
      overtime_charge: 0,
      depositType: '立即租赁',
      startDate: util.formatDate(new Date()),
      memo: ''
    },
    nowDate: util.formatDate(new Date())
  },



  ready() {
    var that = this
    var nowDate = new Date()
    var days = 1
    nowDate.setDate(nowDate.getDate() + days)
    that.setData({ dueEndDate: nowDate, rentDays: days })
    app.loginPromiseNew.then(function (resolve) {
      var getClassUrl = 'https://' + app.globalData.domainName + '/core/Rent/GetClassList'
      wx.request({
        url: getClassUrl,
        method: 'GET',
        success: (res) => {
          if (res.statusCode != 200) {
            return
          }
          var classList = ['请选择...']
          for (var i = 0; i < res.data.length; i++) {
            classList.push(res.data[i])
          }
          that.setData({ classList: classList })
          var getUrl = 'https://' + app.globalData.domainName + '/core/Recept/GetRecept/' + that.properties.receptId + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
          wx.request({
            url: getUrl,
            success: (res) => {
              if (res.statusCode != 200) {
                return
              }
              var recept = res.data
              that.getUser(recept.open_id)
              var rentItemList = []
              if (recept != null && recept.rentOrder != null && recept.rentOrder.details != null) {
                for (var i = 0; i < recept.rentOrder.details.length; i++) {
                  var detail = recept.rentOrder.details[i]
                  console.log('detail', detail)
                  var classIndex = 0
                  var classList = that.data.classList
                  for (var j = 0; j < classList.length; j++) {
                    if (classList[j] == detail.rent_item_class) {
                      classIndex = j
                      break
                    }
                  }
                  var startDate = util.formatDate(new Date(detail.start_date))
                  var item = { index: i, code: detail.rent_item_code, isNoCode: (detail.rent_item_code == ''), class: detail.rent_item_class, classSelectedIndex: classIndex, name: detail.rent_item_name, rental: detail.unit_rental, deposit: detail.deposit, depositType: detail.deposit_type, startDate: startDate, memo: detail.memo, rentalStr: util.showAmount(detail.unit_rental), depositStr: util.showAmount(detail.deposit) }
                  rentItemList.push(item)
                }
              }
              that.setData({ recept: recept, rentItemList: rentItemList })
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
    getUser(openId) {
      var that = this
      var getUserUrl = 'https://' + app.globalData.domainName + '/core/MiniAppUser/GetMiniAppUser?openId=' + encodeURIComponent(openId)
        + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
      wx.request({
        url: getUserUrl,
        method: 'GET',
        success: (res) => {
          if (res.statusCode != 200) {
            return
          }
          that.setData({ customUser: res.data })
        }
      })
    },
    selectClass(e) {
      var that = this
      var currentRentItem = that.data.currentRentItem
      var currentClass = that.data.classList[e.detail.value]
      currentRentItem.class = currentClass
      currentRentItem.classSelectedIndex = e.detail.value
      var subItem = []
      switch (that.data.classList[currentRentItem.classSelectedIndex]) {
        case '双板':

          subItem.push({
            classSelectedIndex: 1,
            class: '双板',
            name: '',
            code: '',
            isNoCode: false,
            need: true,
            startDate: util.formatDate(new Date()),
            startDateType: '今天',
            depositType: '立即租赁',
            index: currentRentItem.index
          })
          subItem.push({
            classSelectedIndex: 2,
            class: '双板鞋',
            name: '',
            code: '',
            isNoCode: false,
            need: true,
            startDate: util.formatDate(new Date()),
            startDateType: '今天',
            depositType: '立即租赁',
            index: currentRentItem.index
          })
          subItem.push({
            classSelectedIndex: 3,
            class: '雪杖',
            name: '',
            code: '',
            isNoCode: true,
            need: true,
            startDate: util.formatDate(new Date()),
            startDateType: '今天',
            depositType: '立即租赁',
            index: currentRentItem.index
          })
          break
        case '单板':
          subItem.push({
            classSelectedIndex: 4,
            class: '单板',
            name: '',
            code: '',
            isNoCode: false,
            need: true,
            startDate: util.formatDate(new Date()),
            startDateType: '今天',
            depositType: '立即租赁',
            index: currentRentItem.index
          })
          subItem.push({
            classSelectedIndex: 5,
            class: '单板鞋',
            name: '',
            code: '',
            isNoCode: false,
            need: true,
            startDate: util.formatDate(new Date()),
            startDateType: '今天',
            depositType: '立即租赁',
            index: currentRentItem.index
          })
          break
        default:
          subItem = undefined
          break
      }
      currentRentItem.subItem = subItem
      that.setData({ currentRentItem: currentRentItem })
    },
    checkValid() {
      var that = this
      var isValid = true
      var recept = that.data.recept
      if (recept == undefined || recept.rentOrder == undefined) {
        isValid = false
        return
      }
      var rentItemList = that.data.rentItemList
      var rentDetails = []
      for (var i = 0; i < rentItemList.length; i++) {
        var memo = rentItemList[i].memo
        if (memo == undefined || memo == '') {
          memo = ''
        }
        var images = rentItemList[i].images
        if (images == undefined || images == '') {
          images = ''
        }
        var startDate = util.formatDate(new Date())
        if (rentItemList[i].startDate != null) {
          startDate = util.formatDate(new Date(rentItemList[i].startDate))
        }
        var item = {
          id: 0, rent_list_id: 0, rent_item_name: rentItemList[i].name, rent_item_class: rentItemList[i].class,
          rent_item_code: rentItemList[i].code, deposit: rentItemList[i].deposit, deposit_type: rentItemList[i].depositType,
          unit_rental: rentItemList[i].rental, memo: memo, images: images, start_date: startDate, overtime_charge: rentItemList[i].overtime_charge, rental_discount: rentItemList[i].rental_discount, package_code: rentItemList[i].packageCode
        }
        rentDetails.push(item)

        var rentItem = rentItemList[i]
        if ((rentItem.depositType != '预付押金' && rentItem.depositType != '预约租赁' && rentItem.depositType != '先租后取' 
          && (rentItem.name == '' || (!rentItem.isNoCode && rentItem.code == '') || rentItem.class == ''))
          || isNaN(rentItem.rental) || isNaN(rentItem.deposit)) {
          isValid = false
        }


      }
      recept.rentOrder.details = rentDetails
      recept.submit_data = ''

      if (rentItemList.length == 0) {
        isValid = false
      }
      that.triggerEvent('CheckValid', { Goon: isValid, recept: recept })
    },

    inputCode(e) {
      var code = e.detail.value
      var that = this
      var currentRentItem = that.data.currentRentItem
      currentRentItem.code = code
      that.getItemInfo(code)
    },
    scan(e) {
      console.log('scan', e)
      var that = this
      wx.scanCode({
        onlyFromCamera: false,
        success: (res) => {
          console.log('scan result', res)
          var code = res.result
          var currentRentItem = that.data.currentRentItem
          currentRentItem.code = code
          that.getItemInfo(code)
        }
      })
    },
    setStartDate(e) {
      console.log('selet start date', e)
      var that = this
      var user = that.data.customUser
      var currentRentItem = that.data.currentRentItem
      var startDate = new Date(e.detail.value)
      var nowDate = new Date()

      currentRentItem.startDate = util.formatDate(startDate)

      if (util.formatDate(nowDate) == currentRentItem.startDate) {
        currentRentItem.startDateType = '今天'
      }
      else if (util.formatDate(new Date(nowDate.setDate(nowDate.getDate() + 1))) == currentRentItem.startDate) {
        currentRentItem.startDateType = '明天'
      }
      else if (util.formatDate(new Date(nowDate.setDate(nowDate.getDate() + 1))) == currentRentItem.startDate) {
        currentRentItem.startDateType = '后天'
      }
      else if (util.formatDate(new Date(nowDate.setDate(nowDate.getDate() + 1))) == currentRentItem.startDate) {
        currentRentItem.startDateType = '大后天'
      }
      else {
        currentRentItem.startDateType = ''
      }

      that.setData({ currentRentItem: currentRentItem })
      that.checkValid()

    },
    changeNoCode(e) {
      var that = this
      var value = e.detail.value
      var currentRentItem = that.data.currentRentItem
      currentRentItem.isNoCode = e.detail.value
      if (currentRentItem.isNoCode) {
        currentRentItem.code = ''
      }
      that.setData({ currentRentItem: currentRentItem })
    },
    getItemInfo(code) {
      var that = this
      var currentRentItem = that.data.currentRentItem
      var classList = that.data.classList
      var customUser = that.data.customUser
      var getItemUrl = 'https://' + app.globalData.domainName + '/core/Rent/GetRentItem/' + code + '?shop=' + encodeURIComponent('万龙')
      wx.request({
        url: getItemUrl,
        success: (res) => {
          if (res.statusCode == 200) {
            var startDate = new Date()
            if (currentRentItem.start_date != undefined) {
              startDate = new Date(currentRentItem.start_date)
              if (util.formatDate(startDate) == util.formatDate(new Date())) {
                currentRentItem.depositType = '立即租赁'
              }
              else {
                currentRentItem.depositType = '预约租赁'
              }
            }
            else {
              currentRentItem.depositType = '立即租赁'
              currentRentItem.start_date = startDate
            }

            currentRentItem.name = res.data.name
            currentRentItem.class = res.data.class
            currentRentItem.classSelectIndex = 0
            for (var i = 0; i < classList.length; i++) {
              if (classList[i] == currentRentItem.class) {
                currentRentItem.classSelectedIndex = i
                break
              }
            }
            currentRentItem.rental = res.data.rental
            if (customUser.isMember != undefined && customUser.isMember != null && customUser.isMember) {
              currentRentItem.rental = res.data.rental_member
            }

            if (currentRentItem.depositType == '预约租赁') {
              currentRentItem.rental = res.data.rental_reserve
            }

            currentRentItem.rentalOrigin = res.data.rental
            currentRentItem.rentalMember = res.data.rental_member
            currentRentItem.rentalReserve = res.data.rental_reserve


            currentRentItem.deposit = res.data.deposit
            that.setData({ currentRentItem: currentRentItem })
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
    saveSub(){
      var that = this
      var rentItemList = that.data.rentItemList
      var currentRentItem = that.data.currentRentItem
      var subItem = currentRentItem.subItem
      var packageCode = subItem[0].code
      
      for(var i = 0; i < subItem.length; i++){
        var item = subItem[i]
        var valid = true
        var message = ''
        if ((item.class == '单板' || item.class == '单板鞋'
        || item.class == '双板' || item.class == '双板鞋')
        && (item.isNoCode || item.code == '') 
        && (item.depositType == '立即租赁' || item.depositType == '延时租赁')) {
          message = '板鞋类物品必须填码。'
          valid = false
        }
        else if (item.name == ''){
          message = '必须填写名称'
          valid = false
        }
        if (!valid && !item.noNeed){
          wx.showToast({
            title: message,
          })
          return
        }
        if (i == 0){
          item.deposit = currentRentItem.deposit
          item.rental = currentRentItem.rental
          item.depositStr = util.showAmount(parseFloat(item.deposit))
          item.rentalStr = util.showAmount(parseFloat(item.rental))
        }
        else{
          item.deposit = 0
          item.rental = 0
          item.depositStr = util.showAmount(parseFloat(item.deposit))
          item.rentalStr = util.showAmount(parseFloat(item.rental))
        }
        item.packageCode = packageCode
        if (item.index == -1){
          if (!item.noNeed){
            item.index = currentRentItem.index == -1? i : (currentRentItem.index + i)
            rentItemList.push(item)
          }
        }
        else{
          if (!item.noNeed){
            rentItemList[item.index] = item
          }
          else {
            var newRentItemList = []
            for(var i = 0; i < rentItemList.length; i++){
              if (i != item.index){
                newRentItemList.push(rentItemList[i])
              }
            }
            rentItemList = newRentItemList
          }
        }
      } 
      currentRentItem = {
        index: -1,
        code: '',
        isNoCode: false,
        class: '',
        classSelectedIndex: 0,
        name: '',
        rental: 0,
        deposit: 0,
        overtime_charge: 0,
        rental_discount: 0,
        depositType: '',
        startDate: util.formatDate(new Date()),
        memo: ''
      }
      that.setData({ rentItemList: rentItemList,currentRentItem})
      that.checkValid()
    },
    save() {
      var that = this
      var rentItemList = that.data.rentItemList
      var currentRentItem = that.data.currentRentItem
      if (currentRentItem.subItem && currentRentItem.index == -1){
        that.saveSub()
        return
      }
      var valid = true
      var message = ''
      if (currentRentItem.isNoCode && currentRentItem.code != '') {
        message = '无码物品无编码'
        valid = false
      }
      else if (!currentRentItem.isNoCode && currentRentItem.code == '') {
        message = '请填写编码'
        valid = false
      }
      else if (currentRentItem.name == '') {
        message = '请填写名称'
        valid = false
      }
      else if (currentRentItem.class == '' || currentRentItem.classSelectedIndex == 0) {
        message = '请选择分类'
        valid = false
      }
      else if (currentRentItem.depositType == '') {
        message = '请选择押金类型'
        valid = false
      }
      else if ((currentRentItem.class == '单板' || currentRentItem.class == '单板鞋'
        || currentRentItem.class == '双板' || currentRentItem.class == '双板鞋')
        && (currentRentItem.isNoCode || currentRentItem.code == '')) {
        message = '板鞋类物品必须填码。'
        valid = false
      }
      else {
        message = ''
        valid = true
      }
      if (currentRentItem.depositType == '预付押金') {
        var deposit = parseFloat(currentRentItem.deposit)
        if (isNaN(deposit) || deposit <= 0) {
          message = '预付押金不为0'
          valid = false
        }
        else if (currentRentItem.class == '' || currentRentItem.classSelectedIndex == 0) {
          message = '请选择分类'
          valid = false
        }

        else {
          message = ''
          valid = true

        }
      }
      if (!valid) {
        wx.showToast({
          title: message,
          icon: 'error'
        })
        return
      }
      currentRentItem.depositStr = util.showAmount(parseFloat(currentRentItem.deposit))
      currentRentItem.rentalStr = util.showAmount(parseFloat(currentRentItem.rental))
      currentRentItem.overtime_chargeStr = util.showAmount(parseFloat(currentRentItem.overtime_charge))
      if (currentRentItem.index == -1) {
        currentRentItem.index = rentItemList.length
        rentItemList.push(currentRentItem)
      }
      else {
        for (var i = 0; i < rentItemList.length; i++) {
          if (rentItemList[i].index == currentRentItem.index) {
            rentItemList[i] = currentRentItem
            break;
          }
        }
      }

      currentRentItem = {
        index: -1,
        code: '',
        isNoCode: false,
        class: '',
        classSelectedIndex: 0,
        name: '',
        rental: 0,
        deposit: 0,
        overtime_charge: 0,
        rental_discount: 0,
        depositType: '',
        startDate: util.formatDate(new Date()),
        memo: ''
      }
      that.setData({ rentItemList: rentItemList, currentRentItem: currentRentItem, isToday: true })
      that.checkValid()
    },
    selectItem(e) {
      var that = this
      var id = e.currentTarget.id
      var rentItemList = that.data.rentItemList
      var currentRentItem = rentItemList[parseInt(id)]
      var isToday = false
      var now = new Date()
      var startDate = new Date(currentRentItem.startDate)
      if (now.getFullYear() == startDate.getFullYear() && now.getMonth() == startDate.getMonth() && startDate.getDate() == now.getDate()) {
        isToday = true
      }
      that.setData({ currentRentItem: currentRentItem, isToday: isToday })
    },
    del() {
      var that = this
      var currentRentItem = that.data.currentRentItem
      var rentItemList = that.data.rentItemList
      var rentItemListNew = []
      var j = 0
      for (var i = 0; i < rentItemList.length; i++) {
        if (currentRentItem.index != rentItemList[i].index) {
          rentItemList[i].index = j
          j++
          rentItemListNew.push(rentItemList[i])
        }
      }
      currentRentItem = {
        index: -1,
        code: '',
        isNoCode: false,
        class: '',
        classSelectedIndex: 0,
        name: '',
        rental: 0,
        deposit: 0,
        rental_discount: 0,
        depositType: '立即租赁',
        startDate: util.formatDate(new Date()),
        memo: ''
      }
      that.setData({ currentRentItem: currentRentItem, rentItemList: rentItemListNew })
      that.checkValid()
    },
    setDepositType(e) {
      var that = this
      var currentRentItem = that.data.currentRentItem
      currentRentItem.depositType = e.detail.value
      if (currentRentItem.depositType == '预付押金') {
        currentRentItem.name = ''
        currentRentItem.code = ''
        currentRentItem.rental = 0
        currentRentItem.isNoCode = false
        currentRentItem.startDate = null
      }
      else {
        console.log('current item', currentRentItem)
        if (currentRentItem.depositType == '立即租赁' || currentRentItem.depositType == '先租后取') {
          currentRentItem.startDate = util.formatDate(new Date())
          currentRentItem.startDateType = '今天'
        }
        if (currentRentItem.depositType == '预约租赁' || currentRentItem.depositType == '延时租赁') {
          var nowDate = new Date()
          nowDate.setDate(nowDate.getDate() + 1)
          currentRentItem.startDate = util.formatDate(nowDate)
          currentRentItem.startDateType = '明天'
        }
      }
      that.setData({ currentRentItem: currentRentItem })
    },
    setNumber(e) {
      var that = this
      var fieldName = ''
      switch (e.currentTarget.id) {
        case 'rental':
          fieldName = '租金'
          break
        case 'deposit':
          fieldName = '押金'
          break
        case 'overtime_charge':
          fieldName = '超时费'
          break
        case 'discount':
          fieldName = '租金减免'
          break
        default:
          break
      }
      var message = ''
      if (fieldName != '') {
        var amount = parseFloat(e.detail.value)
        var currentRentItem = that.data.currentRentItem
        if (!isNaN(amount)) {
          var displayedValue = amount
          if (amount.toString() != e.detail.value) {
            displayedValue = e.detail.value
          }
          switch (fieldName) {
            case '租金':
              currentRentItem.rental = displayedValue
              break
            case '押金':
              currentRentItem.deposit = displayedValue
              break
            case '超时费':
              currentRentItem.overtime_charge = displayedValue
              break
            case '租金减免':
              currentRentItem.rental_discount = displayedValue
              break
            default:
              break
          }
          that.setData({ currentRentItem: currentRentItem })
        }
        else {
          message = '请填正确' + fieldName
          wx.showToast({
            title: message,
            icon: 'error',
            success: (res) => {
              switch (fieldName) {
                case '租金':
                  currentRentItem.rental = e.detail.value
                  break
                case '押金':
                  currentRentItem.deposit = e.detail.value
                  break
                case '超时费':
                  currentRentItem.overtime_charge = e.detail.value
                  break
                case '租金减免':
                  currentRentItem.rental_discount = e.detail.value
                  break
                default:
                  break
              }
              that.setData({ currentRentItem: currentRentItem })
            }
          })
        }
      }
    },
    setMemo(e) {
      var that = this
      var currentRentItem = that.data.currentRentItem
      currentRentItem.memo = e.detail.value
      that.setData({ currentRentItem: currentRentItem })
    },
    setName(e) {
      var that = this
      var currentRentItem = that.data.currentRentItem
      currentRentItem.name = e.detail.value
      that.setData({ currentRentItem: currentRentItem })
    },
    inputSub(e) {
      var idArr = e.currentTarget.id.split('_')
      var id = idArr[0]
      var index = parseInt(idArr[1])
      var value = e.detail.value
      var that = this
      var currentRentItem = that.data.currentRentItem
      var item = currentRentItem.subItem[index]
      switch (id) {
        case 'name':
          item.name = value
          break
        case 'code':
          item.code = value
          break
        default:
          break
      }
      that.setData({ currentRentItem: currentRentItem })
    },
    changeNeed(e) {
      var that = this
      var id = parseInt(e.currentTarget.id)
      var currentRentItem = that.data.currentRentItem
      var item = currentRentItem.subItem[id]
      item.need = e.detail.value.length > 0 ? true : false
      that.setData({ currentRentItem: currentRentItem })
    },
    setSubDepositType(e) {
      var that = this
      var id = parseInt(e.currentTarget.id)
      var item = that.data.currentRentItem
      var currentRentItem = item.subItem[id]
      currentRentItem.depositType = e.detail.value
      if (currentRentItem.depositType == '预付押金') {
        currentRentItem.name = ''
        currentRentItem.code = ''
        currentRentItem.rental = 0
        currentRentItem.isNoCode = false
        currentRentItem.startDate = null
      }
      else {
        console.log('current item', currentRentItem)
        if (currentRentItem.depositType == '立即租赁' || currentRentItem.depositType == '先租后取') {
          currentRentItem.startDate = util.formatDate(new Date())
          currentRentItem.startDateType = '今天'
        }
        if (currentRentItem.depositType == '预约租赁' || currentRentItem.depositType == '延时租赁') {
          var nowDate = new Date()
          nowDate.setDate(nowDate.getDate() + 1)
          currentRentItem.startDate = util.formatDate(nowDate)
          currentRentItem.startDateType = '明天'
        }
      }
      that.setData({ currentRentItem: item })

    },
    setSubStartDate(e) {
      var id = parseInt(e.currentTarget.id)
      var that = this
      var startDate = new Date(e.detail.value)
      var nowDate = new Date()
      var item = that.data.currentRentItem
      var currentRentItem = item.subItem[id]
      currentRentItem.startDate = util.formatDate(startDate)

      if (util.formatDate(nowDate) == currentRentItem.startDate) {
        currentRentItem.startDateType = '今天'
      }
      else if (util.formatDate(new Date(nowDate.setDate(nowDate.getDate() + 1))) == currentRentItem.startDate) {
        currentRentItem.startDateType = '明天'
      }
      else if (util.formatDate(new Date(nowDate.setDate(nowDate.getDate() + 1))) == currentRentItem.startDate) {
        currentRentItem.startDateType = '后天'
      }
      else if (util.formatDate(new Date(nowDate.setDate(nowDate.getDate() + 1))) == currentRentItem.startDate) {
        currentRentItem.startDateType = '大后天'
      }
      else {
        currentRentItem.startDateType = ''
      }
      that.setData({ currentRentItem: item })
    },
    changeNeed(e){
      var that = this
      var id = parseInt(e.currentTarget.id)
      var currentRentItem = that.data.currentRentItem
      var item = currentRentItem.subItem[id]
      if (e.detail.value.length > 0){
        item.noNeed = true
      }
      else{
        item.noNeed = false
      }
      that.setData({currentRentItem})
    },
    changeSubNoCode(e){
      var that = this
      var id = parseInt(e.currentTarget.id)
      var currentRentItem = that.data.currentRentItem
      var item = currentRentItem.subItem[id]
      item.isNoCode = e.detail.value
      if(item.isNoCode){
        item.code = ''
      }
      that.setData({currentRentItem})
    }
  }
})
