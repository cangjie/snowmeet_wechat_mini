// 食材管理底部 tab：8 个模块互相 redirectTo，库存 tab 显示临期角标
const TABS = [
  { key: 'stock', label: '库存' }, { key: 'inbound', label: '入库' }, { key: 'cats', label: '分类' }, { key: 'prep', label: '制作' },
  { key: 'recipe', label: '配方' }, { key: 'serve', label: '出餐' }, { key: 'count', label: '盘点' }, { key: 'dash', label: '看板' }
]

Component({
  properties: {
    active: { type: String, value: 'stock' },
    badge: { type: Number, value: -1 }
  },
  data: { tabs: TABS, alert: 0 },
  lifetimes: {
    attached() {
      const g = getApp().globalData
      this.setData({ alert: this.properties.badge >= 0 ? this.properties.badge : (g.fnbAlertCount || 0) })
    }
  },
  observers: {
    badge(value) { if (value >= 0) this.setData({ alert: value }) }
  },
  methods: {
    onTap(e) {
      const key = e.currentTarget.dataset.key
      if (key === this.properties.active) return
      const url = '/pages/fnbinv/' + key + '/' + key
      wx.redirectTo({ url, fail() { wx.navigateTo({ url }) } })
    }
  }
})
