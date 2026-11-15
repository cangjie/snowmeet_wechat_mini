// components/myinfo/myinfo.js
const app = getApp()
Component({
  /**
   * Component properties
   */
  properties: {
    // 顾客授权过的头像（完整网址）和昵称；没有时显示微信自带的（open-data 现在只会给灰头像和「微信用户」）
    avatarUrl: { type: String, value: '' },
    nickName: { type: String, value: '' }
  },

  /**
   * Component initial data
   */
  data: {

  },
  ready: function() {
    
  },
  /**
   * Component methods
   */
  methods: {

  }
})
