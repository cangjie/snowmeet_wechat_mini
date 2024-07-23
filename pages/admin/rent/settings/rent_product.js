// pages/admin/rent/settings/rent_product.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    infoTabs:[
      {title: '分类', title2: '', img: '', desc: ''},
      {title: '简介', title2: '', img: '', desc: ''},
      {title: '参数', title2: '', img: '', desc: ''},
      {title: '图片', title2: '', img: '', desc: ''}
    ],
    priceArr:[
      {
        shop: '万龙',
        matrix:[['','',''],['','',''],['','','']]
      },
      {
        shop: '旗舰',
        matrix:[['','',''],['','',''],['','','']]
      },
      {
        shop: '南山',
        matrix:[['','',''],['','',''],['','','']]
      }
    ]
  },

  getCategories(){
    var that = this
    var url = 'https://' + app.globalData.domainName + '/core/RentSetting/GetAllCategories'
    wx.request({
      url: url,
      method:'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          that.setData({dataTree: [], selectedName: '', selectedCode: ''})
          return
        }
        var dataTree = this.convertCategoryTree(res.data)
        that.setData({dataTree: dataTree})
      }
    })
    
  },

  convertCategoryTree(data){
    var that = this
    var dataArr = []
    for(var i = 0; i < data.length; i++){
      var leaf = {id: data[i].id, code: data[i].code, name: data[i].name}
      if (data[i].children != undefined && data[i].children != null){
        leaf.children = that.convertCategoryTree(data[i].children)
      }
      dataArr.push(leaf)
    }
    return dataArr
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    that.getCategories()
  },

  /**
   * Lifecycle function--Called when page is initially rendered
   */
  onReady() {

  },

  /**
   * Lifecycle function--Called when page show
   */
  onShow() {

  },

  /**
   * Lifecycle function--Called when page hide
   */
  onHide() {

  },

  /**
   * Lifecycle function--Called when page unload
   */
  onUnload() {

  },

  /**
   * Page event handler function--Called when user drop down
   */
  onPullDownRefresh() {

  },

  /**
   * Called when page reach bottom
   */
  onReachBottom() {

  },

  /**
   * Called when user click on the top right corner to share
   */
  onShareAppMessage() {

  }
})