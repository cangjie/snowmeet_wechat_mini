// 在整单范围内分配券卡：先最小化实付，再依次偏好季卡、临期券、学员卡、次卡。
// 每个资源有容量（单券/季卡为 1、次卡为剩余次数）；每件装备的 baseline 不占权益。
// 利用残量网络允许后面的装备把稀缺权益换给更需要它的装备，避免逐件贪心造成整单多付。
function assign(cares, resources) {
  if (!cares.length) return [];
  const sorted = resources.slice().sort((a, b) => {
    const rank = { season: 0, ticket: 1, coach: 2, punch: 3 };
    return (rank[a.type] - rank[b.type]) || String(a.expire || '9999').localeCompare(String(b.expire || '9999'))
      || String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
  });
  const index = new Map(sorted.map((r, i) => [r.key, i]));
  const n = cares.length, count = sorted.length;
  const src = 0, firstCare = 1, firstRes = firstCare + n, sink = firstRes + count;
  const graph = Array.from({ length: sink + 1 }, () => []);
  const zero = [0, 0, 0, 0, 0];
  const add = (a, b) => a.map((v, i) => v + b[i]);
  const less = (a, b) => {
    if (!b) return true;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
    return false;
  };
  function edge(a, b, cap, cost, choice) {
    const f = { to: b, rev: graph[b].length, cap, cost, choice };
    const r = { to: a, rev: graph[a].length, cap: 0, cost: cost.map(v => -v) };
    graph[a].push(f); graph[b].push(r);
  }
  // 按元组逐项比较，不用缩放金额，避免权益多时数字超出安全整数范围。
  const cents = amount => Math.round(Math.max(0, Number(amount) || 0) * 100);
  cares.forEach((care, i) => {
    edge(src, firstCare + i, 1, zero);
    if (care.baseline != null) edge(firstCare + i, sink, 1, [cents(care.baseline), 1, 1, 1, count], null);
    (care.options || []).forEach(opt => {
      const j = index.get(opt.key);
      if (j === undefined || !(sorted[j].capacity > 0)) return;
      // 没有实际优惠的权益不消耗；机打蜡属于必须具备相应权益的服务。
      if (!care.requiresBenefit && cents(opt.amount) >= cents(care.baseline)) return;
      const type = sorted[j].type;
      edge(firstCare + i, firstRes + j, 1, [cents(opt.amount), type === 'season' ? 0 : 1,
        type === 'season' || type === 'ticket' ? 0 : 1,
        type === 'punch' ? 1 : 0, j], opt.key);
    });
  });
  sorted.forEach((r, i) => edge(firstRes + i, sink, Math.min(n, r.capacity), zero));
  for (let sent = 0; sent < n; sent++) {
    const dist = Array(graph.length).fill(null), prev = Array(graph.length);
    dist[src] = zero;
    for (let pass = 0; pass < graph.length - 1; pass++) {
      let changed = false;
      graph.forEach((edges, from) => {
        if (!dist[from]) return;
        edges.forEach((e, k) => {
          const candidate = add(dist[from], e.cost);
          if (e.cap > 0 && less(candidate, dist[e.to])) {
            dist[e.to] = candidate; prev[e.to] = [from, k]; changed = true;
          }
        });
      });
      if (!changed) break;
    }
    if (!prev[sink]) throw new Error('没有可用的养护权益，请重新选择');
    for (let v = sink; v !== src;) {
      const [u, k] = prev[v], e = graph[u][k]; e.cap--; graph[v][e.rev].cap++; v = u;
    }
  }
  return cares.map((_, i) => {
    const picked = graph[firstCare + i].find(e => e.choice && e.cap === 0);
    return picked ? picked.choice : null;
  });
}

module.exports = { assign };
