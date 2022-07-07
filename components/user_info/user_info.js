// components/user_info/user_info.js
const app = getApp()
Component({
  /**
   * Component properties
   */
  properties: {
    open_id:{
      type: String,
      value:''
    }
  },

  /**
   * Component initial data
   */
  data: {
    role:'',
    cell:'',
    points: 0,
    nick: ''
  },

  lifetimes:{
    ready: function(){
      var that = this
      app.loginPromiseNew.then(function(resolve){
        that.setData({role: app.globalData.role, nick: that.properties.open_id})
      })
    }
  },
  /**
   * Component methods
   */
  methods: {
    

  }

})
