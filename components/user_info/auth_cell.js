// components/user_info/auth_cell.js
const app = getApp()
const util = require('../../utils/util.js')
const data = require('../../utils/data.js')
Component({

  /**
   * Component properties
   */
  properties: {
  },

  /**
   * Component initial data
   */
  data: {

  },
  lifetimes:{
    ready(){
      app.loginPromiseNew.then(function(resolve){

      })
    }
  },
  /**
   * Component methods
   */
  methods: {
    getCell(e){
      var that = this
      data.verifyMemberCellPromise(app.globalData.sessionKey, encodeURIComponent(e.detail.encryptedData), encodeURIComponent(e.detail.iv)).then(function(result){
        that.triggerEvent('Verified', result)
      }).catch(function (reject){
        that.triggerEvent('Verified', false)
      })

    }
  }
})