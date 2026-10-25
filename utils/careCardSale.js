const util = require('./util.js');

function request(action, body, orderId) {
  const app = getApp();
  let url = app.globalData.requestPrefix + 'CareCardSale/' + action
    + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey || '');
  if (orderId) url += '&orderId=' + encodeURIComponent(orderId);
  return util.performWebRequest(url, body == null ? null : body);
}

function serviceMode(card) {
  if (!card) return '';
  if (card.total == null && (card.name || '').includes('机打蜡')) return 'machine';
  if (card.requiresBinding) return 'wax';
  return card.projectCount === 2 || (card.projectCount == null && (card.name || '').includes('双项')) ? 'dual' : 'single';
}

function selections(products) {
  return (products || []).filter(p => p.quantity > 0)
    .map(p => ({ productId: p.id, quantity: p.quantity }));
}

function displayPreview(preview, cares) {
  if (!preview) return null;
  const projects = (preview.projects || []).map(p => {
    const index = (cares || []).findIndex(c => c.id === p.careId);
    const care = (cares || [])[index] || {};
    const labels = [];
    if (p.need_edge === 1) labels.push('修刃');
    if (p.need_wax === 1) labels.push('热蜡');
    else if (p.need_unwax === 1) labels.push('刮蜡');
    if (p.free_wax === 1) labels.push('机打蜡');
    if (care.need_repair === 1 || p.repair_charge > 0) labels.push('维修');
    return Object.assign({}, p, {
      equipmentLabel: index < 0 ? '装备 #' + p.careId : '第' + (index + 1) + '件 ' + (care.equipment || '装备'),
      projectsLabel: labels.join('＋') || '养护项目',
      serviceAmountLabel: util.showAmount(p.serviceAmount || 0),
      cardCoveredAmountLabel: util.showAmount(p.cardCoveredAmount || 0),
      commonChargeLabel: util.showAmount(p.common_charge || 0),
      repairChargeLabel: util.showAmount(p.repair_charge || 0),
      discountLabel: util.showAmount(p.discount || 0),
      amountLabel: util.showAmount(p.amount || 0),
      hasServiceDifference: p.common_charge > 0 && p.serviceAmount > 0 && p.cardCoveredAmount > 0
    });
  });
  const single = projects.length === 1 && projects[0].hasServiceDifference ? projects[0] : null;
  return Object.assign({}, preview, {
    projects,
    singleServiceDifference: single ? single.serviceAmountLabel + ' − ' + single.cardCoveredAmountLabel + ' ＝ ' + single.commonChargeLabel : '',
    amountLabel: util.showAmount(preview.amount),
    cardAmountLabel: util.showAmount(preview.cardAmount == null ? (preview.items || []).reduce((sum, i) => sum + Number(i.price || 0), 0) : preview.cardAmount),
    careAmountLabel: util.showAmount(preview.careAmount || 0),
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
  return JSON.stringify({ amount: preview.amount, careAmount: preview.careAmount || 0,
    projects: (preview.projects || []).map(p => ({ careId: p.careId, need_edge: p.need_edge, need_wax: p.need_wax,
      need_unwax: p.need_unwax, free_wax: p.free_wax, common_charge: p.common_charge || 0,
      repair_charge: p.repair_charge || 0, discount: p.discount || 0, amount: p.amount || 0 })), items: (preview.items || []).map(i => ({
    productId: i.productId, name: i.name, price: i.price, total: i.total, projectCount: i.projectCount,
    serviceLabel: i.serviceLabel,
    requiresBinding: i.requiresBinding, careIds: (i.careIds || []).slice().sort((a, b) => a - b)
  })) });
}

module.exports = { serviceMode, request, selections, displayPreview, signature };
