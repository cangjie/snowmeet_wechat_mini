// components/refresh_test/test1.js
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
      var that = this
      wx.request({
        url: 'https://mini.snowmeet.top/core/BltDevice/Test',
        method: 'GET',
        success:(res)=>{
          if (res.statusCode != 200){
            return
          }
          that.setData({word: res.data})
        }
      })
    },
  },

  /**
   * Component methods
   */
  methods: {
    
  }
})
