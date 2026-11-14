// components/user_info/auth_cell.js
const app = getApp()
const util = require('../../utils/util.js')
const data = require('../../utils/data.js')
const profileAuth = require('../../utils/profile_auth.js')
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
        // 手机号验证成功：先请顾客完善头像昵称（可跳过），处理完再把结果交给页面
        // 只有验证通过（result 为真）才弹；没通过照旧把结果交给页面
        return (result ? profileAuth.ensureOn(that) : Promise.resolve()).then(function () { that.triggerEvent('Verified', result) })
      }).catch(function (reject){
        that.triggerEvent('Verified', false)
      })

    }
  }
})