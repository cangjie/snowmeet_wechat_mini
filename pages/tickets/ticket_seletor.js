Page({
  onShareAppMessage() {
    return {
      title: 'tabs',
      path: 'page/weui/example/tabs/tabs'
    }
  },
  data: {
    tabs: [],
    activeTab: 0,
  },

  onLoad() {
    const tabs = [
      {
        title: '南山',
        title2: '',
        img: '',
        desc: '本视频系列课程，由腾讯课堂NEXT学院与微信团队联合出品，通过实战案例，深入浅出地进行讲解。',
      },
      {
        title: '万龙',
        title2: '',
        img: '',
        desc: '微信小程序直播系列课程持续更新中，帮助大家更好地理解、应用微信小程序直播功能。',
      }
    ]
    this.setData({ tabs })
  },
  onTabClick(e) {
    const index = e.detail.index
    this.setData({ 
      activeTab: index 
    })
  },

  onChange(e) {
    const index = e.detail.index
    this.setData({ 
      activeTab: index 
    })
  },
  handleClick(e) {
    wx.navigateTo({
      url: './webview',
    })
  }
})
