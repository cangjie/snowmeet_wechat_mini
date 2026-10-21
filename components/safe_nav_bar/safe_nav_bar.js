// components/safe_nav_bar/safe_nav_bar.js
// 自定义导航栏（页面 json 设了 "navigationStyle": "custom" 时必须用它，tests/custom_nav_safe_area.test.js 会检查）。
// 先让出手机状态栏高度，再按右上角胶囊按钮的位置排版：返回键和胶囊在同一行，标题居中且不压胶囊。
// 用法：
//   <safe-nav-bar title="养护开单" />                         点返回 = navigateBack（页面栈只有一页时回 homeUrl）
//   <safe-nav-bar title="选择套餐" autoBack="{{false}}" bind:back="onClose" />   返回由页面自己处理
//   <safe-nav-bar title="业务开单" showBack="{{false}}" />     不显示返回键
// 顶栏是 fixed 的，组件默认在原位放一个同高占位块，页面内容自然排在它下面；
// 页面自己算偏移时（如整页 scroll-view）设 placeholder="{{false}}"，高度用 utils/navbar.js 的 getNavMetrics()。
const { getNavMetrics } = require('../../utils/navbar.js');

Component({
  properties: {
    title: { type: String, value: '' },
    showBack: { type: Boolean, value: true },
    autoBack: { type: Boolean, value: true },
    homeUrl: { type: String, value: '/pages/index/index' },
    placeholder: { type: Boolean, value: true },
    background: { type: String, value: '#ffffff' },
    color: { type: String, value: '#006495' },
    border: { type: Boolean, value: true },
  },
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    totalHeight: 64,
    sideWidth: 95,
  },
  lifetimes: {
    attached() {
      this.setData(getNavMetrics());
    },
  },
  methods: {
    onBackTap() {
      this.triggerEvent('back');
      if (!this.properties.autoBack) return;
      const pages = getCurrentPages();
      if (pages.length > 1) {
        wx.navigateBack({ delta: 1 });
      } else {
        // 分享卡片 / 扫码直接打开时没有上一页，navigateBack 会静默失败
        wx.reLaunch({ url: this.properties.homeUrl });
      }
    },
  },
});
