// pages/template/stitch/_5/index.js
// 支付结算
// 对应 PRD：
//   1.4.5 第三步：店员生成支付二维码 → 顾客扫码 → 系统按 openid/payerid 进行会员匹配
//   2.4.1 末段：支付押金 → 支付成功后订单 已生成 → 租赁中
const app = getApp();

// 生成 64 位的演示二维码网格（仅视觉占位）
function buildQrCells() {
  const cells = [];
  for (let i = 0; i < 64; i++) {
    // 用一个简单的伪随机模式（与 i 相关）保证渲染稳定
    const on = ((i * 37 + 13) % 7) % 2 === 0 || i % 9 === 0;
    cells.push(on ? 1 : 0);
  }
  // 角落留白让 corner 占位更清晰
  [0, 1, 2, 8, 9, 10, 16, 17, 18,
   5, 6, 7, 13, 14, 15, 21, 22, 23,
   40, 41, 42, 48, 49, 50, 56, 57, 58]
    .forEach((idx) => { cells[idx] = 0; });
  return cells;
}

Page({
  data: {
    orderExpanded: true,
    order: {
      packageName: '中级单板9件套',
      items: ['FIS 专业级单板 x1', '高级滑雪鞋 x1', '雪杖 x2'],
      startAt: '2026-04-30 09:00',
      deposit: '1,500.00',
      rent: '500.00',
    },
    payMethod: 'wechat',
    paymentStatus: 'pending',  // pending | paid
    qrCells: buildQrCells(),
  },

  onLoad() {
    this.hydrate();
  },

  hydrate() {
    const pending = wx.getStorageSync('rent_pending_order');
    if (pending && pending.summary) {
      const first = (pending.packages || [])[0] || {};
      this.setData({
        order: {
          packageName: first.name || '租赁订单',
          items: (pending.packages || []).map((p) => p.name + ' x' + (p.qty || 1)),
          startAt: (first.startDate || '') + ' ' + (first.startTime || ''),
          deposit: pending.summary.deposit || '0',
          rent: pending.summary.rent || '0.00',
        },
      });
    }
  },

  onToggleOrder() {
    this.setData({ orderExpanded: !this.data.orderExpanded });
  },
  onMethodTap(e) {
    this.setData({ payMethod: e.currentTarget.dataset.method });
  },

  onConfirmPaid() {
    // PRD：支付成功 → 订单状态 已生成 → 租赁中；清空购物车草稿
    wx.showLoading({ title: '正在确认收款…' });
    setTimeout(() => {
      wx.hideLoading();
      this.setData({ paymentStatus: 'paid' });
      wx.removeStorageSync('rent_cart');
      wx.removeStorageSync('rent_pending_order');
      wx.showModal({
        title: '收款成功',
        content: '订单已生成，状态：租赁中。\n是否回到工作台？',
        confirmText: '回到首页',
        cancelText: '继续开单',
        success: (res) => {
          if (res.confirm) {
            wx.navigateBack({ delta: 4 });   // 回到 _1
          } else {
            wx.navigateBack({ delta: 2 });   // 回到 _2 / _4
          }
        },
      });
    }, 700);
  },
  onBack() { wx.navigateBack({ delta: 1 }); },
});
