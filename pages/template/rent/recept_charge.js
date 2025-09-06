// pages/template/rent/recept_charge.js
Page({

  /**
   * Page initial data
   */
  data: {
    mokRetals: [
      {
        id: 0,
        name: '测试',
        order_id: null,
        package_id: 1,
        realDeposit: 10000,
        realDeposit: '¥10000',
        rentItems: [
          {
            categoruName: '试滑双板(有用勿删)',
            category_id: 23,
            code: '01060002',
            id: 0,
            itemIndex: 1,
            name: '【租赁双板-002】Head e-SL RD 158CM',
            noCode: false,
            rent_product_id: null,
            rental_id: 0,
            textColor: 'black'
          },
          {
            categoryName: '【全碳】雪杖',
            category_id: 27,
            code: null,
            id: 0,
            itemIndex: 2,
            name: null,
            noCode: true,
            rent_product_id: null,
            rental_id: 0,
            textColor: "black"
          }
        ],
        textColor: 'black'

      },
      {
        backgroundColor: '#F0F0F0',
        id: 0,
        name: '【租赁双板-011】Head 中国限定款 170CM',
        order_id: null,
        package_id: null,
        realDeposit: 1000,
        realDepositStr: '¥1000.00',
        rentItems: [
          {
            categoryName: '试滑双板(有用勿删)',
            category_id: 23,
            code: '01060011',
            id: 0,
            itemIndex: 3,
            name: '【租赁双板-011】Head 中国限定款 170CM',
            noCode: false,
            rent_product_id: 11,
            rental_id: 0,
            textColor: '#000000'
          }
        ]
      }
    ]
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    that.setData({rentals: that.data.mokRetals})
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