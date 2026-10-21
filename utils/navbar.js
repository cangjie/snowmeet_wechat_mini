// 自定义导航栏的尺寸：页面在 json 里设了 "navigationStyle": "custom" 后，系统导航栏被关掉，
// 页面顶部直接从手机状态栏（时间、信号）开始。自己画的顶栏必须先让出状态栏高度，
// 并和右上角胶囊按钮放在同一行，否则返回键会落在状态栏里——iPhone 状态栏点不动，返回键失效
// （2026-10-21 养护开单页实测）。
// 所有自定义导航栏统一用 components/safe_nav_bar，尺寸都从这里取。
let cached = null;

function getNavMetrics() {
  if (cached) return cached;
  let win = {};
  try {
    win = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
  } catch (e) {
    win = {};
  }
  const statusBarHeight = win.statusBarHeight || 20;
  const windowWidth = win.windowWidth || 375;
  let menu = null;
  try {
    menu = wx.getMenuButtonBoundingClientRect();
  } catch (e) {
    menu = null;
  }
  // 默认值按 iPhone 常见尺寸：导航栏 44，胶囊连同右边距约 95 宽
  let navBarHeight = 44;
  let sideWidth = 95;
  // 个别机型首次取胶囊位置会返回全 0，这时用默认值，不缓存，下次再取
  const menuOk = !!(menu && menu.height > 0 && menu.top >= statusBarHeight && menu.left > 0);
  if (menuOk) {
    navBarHeight = (menu.top - statusBarHeight) * 2 + menu.height;
    sideWidth = windowWidth - menu.left;
  }
  const metrics = {
    statusBarHeight,
    navBarHeight,
    totalHeight: statusBarHeight + navBarHeight,
    // 左右两侧各留出胶囊那么宽：标题在屏幕正中，且不会压到胶囊
    sideWidth,
  };
  if (menuOk) cached = metrics;
  return metrics;
}

module.exports = {
  getNavMetrics,
};
