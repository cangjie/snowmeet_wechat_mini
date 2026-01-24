// components/rent/package_selector.js
const app = getApp()
const util = require('../../utils/util.js')
const data = require('../../utils/data')
Component({

  /**
   * Component properties
   */
  properties: {
    shop:String
  },

  /**
   * Component initial data
   */
  data: {

  },
  lifetimes:{
    ready(){
      var that = this
      data.getPackageListPromise(that.properties.shop).then(function(packages){
        console.log('get packages', packages)
        that.setData({packages: packages})
        that.triggerEvent('GetPackages', packages)
      })
    }
  },

  /**
   * Component methods
   */
  methods: {
    confirm(){
      var that = this
      if (!that.data.selectedPackage){
        wx.showToast({
          title: '请选择套餐',
          icon: 'error'
        })
      }
      that.triggerEvent('Confirm', that.data.selectedPackage)
    },
    close(){
      var that = this
      that.triggerEvent('Cancel', {})
    },
    selectPackage(e){
      var that = this
      var value = parseInt(e.detail.value)
      data.getPackagePromise(value).then(function(resolve){
        that.data.selectedPackage = resolve
      })
    }
  }
})