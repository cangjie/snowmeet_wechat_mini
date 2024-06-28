// pages/test/tree/tree.js
Page({

  /**
   * Page initial data
   */
  data: {
    dataTree: [
      {
        id: 1,
        name: '一级A',
        children: [
          {
            id: 23,
            name: '二级A-a',
            children: [
              {
                id: 98,
                name: '三级A-a-1'
              }
            ]
          },
          {
            id: 20,
            name: '二级A-b',
          }
        ]
      },
      {
        id: 2,
        name: '一级B',
        children: [
          {
            id: 21,
            name: '二级B-a',
          }
        ]
      }
    ],
    selectKey: '', //选中的节点id
  },
  handleSelect(e) {
    if (e.detail.tips) {
      console.log('必须选择到最后一个节点')
    } else {
      this.setData({
        selectKey: e.detail.item.id
      })
    }
  },
  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {

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