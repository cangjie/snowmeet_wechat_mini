const util = require('./util.js');

function request(action, body, orderId) {
  const app = getApp();
  let url = app.globalData.requestPrefix + 'CareCardSale/' + action
    + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey || '');
  if (orderId) url += '&orderId=' + encodeURIComponent(orderId);
  return util.performWebRequest(url, body == null ? null : body);
}

function selections(products) {
  return (products || []).filter(p => p.quantity > 0)
    .map(p => ({ productId: p.id, quantity: p.quantity }));
}

function displayPreview(preview, cares) {
  if (!preview) return null;
  return Object.assign({}, preview, {
    amountLabel: util.showAmount(preview.amount),
    items: (preview.items || []).map(i => Object.assign({}, i, {
      priceLabel: util.showAmount(i.price),
      usageLabel: i.total == null ? ('本次使用' + i.punches + '次 · 不限总次数')
        : ('本次扣' + i.punches + '次 · 使用后剩余' + i.remaining + '次'),
      equipmentLabel: (i.careIds || []).map(id => {
        const index = (cares || []).findIndex(c => c.id === id);
        const care = (cares || [])[index];
        return care ? ('第' + (index + 1) + '件 ' + [care.equipment, (care.brand || '').split('/')[0], care.scale ? care.scale + 'cm' : ''].filter(Boolean).join(' ')) : ('装备 #' + id);
      }).join('；') || '本次不使用，购买后留存'
    }))
  });
}

function signature(preview) {
  return JSON.stringify({ amount: preview.amount, items: (preview.items || []).map(i => ({
    productId: i.productId, name: i.name, price: i.price, total: i.total, projectCount: i.projectCount,
    serviceLabel: i.serviceLabel,
    requiresBinding: i.requiresBinding, careIds: (i.careIds || []).slice().sort((a, b) => a - b)
  })) });
}

module.exports = { request, selections, displayPreview, signature };
