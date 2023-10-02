// components/recept/rent/rent_detail.js
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
    //showGallery: false
  },

  lifetimes:{

    ready(){
      var that = this
      that.getData()
    }


  },

  /**
   * Component methods
   */
  methods: {
    getData(){
      var that = this
      var getUrl = 'https://' + app.globalData.domainName + '/core/Recept/GetRecept/' + that.properties.receptId
        + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
      wx.request({
        url: getUrl,
        success:(res)=>{
          if (res.statusCode != 200){
            return
          }
          console.log('rent detail recept', res.data)
          var recept = res.data
          for(var i = 0; !util.isBlank(recept) && !util.isBlank(recept.rentOrder) 
            && !util.isBlank(recept.rentOrder.details) && i < recept.rentOrder.details.length; i++){
              recept.rentOrder.details[i].item.showImage = 'https://mini.snowmeet.top/core/MediaHelper/ShowImageRotate/90?imgUrl=' 
                + encodeURIComponent(recept.rentOrder.details[i].item.image)
              recept.rentOrder.details[i].depositStr = util.showAmount(recept.rentOrder.details[i].deposit)
            }
          that.setData({recept: recept})
        }
      })
    },
    showGallery(){
      this.setData({showGallery: true})
    }

  }
})
