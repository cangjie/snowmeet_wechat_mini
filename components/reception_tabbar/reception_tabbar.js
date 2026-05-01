// components/reception_tabbar/reception_tabbar.js
// 接待流程底部导航
// 使用方式：
//   <reception-tabbar active="open" bind:tabchange="onTabChange" />
// 传入的 active 取值：dashboard / open / search / me

const TABS = [
  { key: 'dashboard', label: '工作台',  icon: 'apps-o',     iconActive: 'apps' },
  { key: 'open',      label: '开单',    icon: 'add-o',      iconActive: 'add'  },
  { key: 'search',    label: '查询',    icon: 'search',     iconActive: 'search' },
  { key: 'me',        label: '我的',    icon: 'manager-o',  iconActive: 'manager' },
];

// 各 tab 默认要跳到的页面（如果父页面不监听 tabchange，则使用默认跳转）
const DEFAULT_ROUTES = {
  dashboard: '/pages/admin/admin',                    // 暂用旧后台首页
  open:      '/pages/admin/reception/recept_entry',   // 业务开单入口
  search:    '',                                      // 待迁移
  me:        '/pages/mine/mine',
};

Component({
  options: {
    multipleSlots: false,
    addGlobalClass: true,
  },

  properties: {
    active: { type: String, value: 'open' },
  },

  data: {
    tabs: TABS,
  },

  methods: {
    onTap(e) {
      const key = e.currentTarget.dataset.key;
      // 触发自定义事件，父页面可拦截
      this.triggerEvent('tabchange', { key });

      // 如果点的是当前页，不跳
      if (key === this.data.active) return;

      // 默认跳转
      const url = DEFAULT_ROUTES[key];
      if (!url) {
        wx.showToast({ title: '该模块待上线', icon: 'none' });
        return;
      }
      // 开单入口可能需要重置回根；其他用 navigateTo 即可
      if (key === 'open') {
        wx.reLaunch({ url });
      } else {
        wx.switchTab && false; // 占位以提示意图：本页不是 tabBar
        wx.navigateTo({
          url,
          fail: () => wx.redirectTo({ url }),
        });
      }
    },
  },
});
