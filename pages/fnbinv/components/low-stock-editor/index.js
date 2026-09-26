// 用量预警设置弹层（库存页、用量预警页共用）：按最近一批的比例或按数量；校验通过后发 submit，由页面提交保存
const lowstock = require('../../common/lowstock.js')

Component({
  options: { addGlobalClass: true },
  properties: {
    show: { type: Boolean, value: false },
    row: { type: Object, value: null },     // ListLowStock 的一行
    units: { type: Array, value: [] },
    saving: { type: Boolean, value: false }
  },
  data: { edit: null },
  observers: {
    'show, row': function (show, row) {
      if (show && row) this.setData({ edit: lowstock.editorState(row, this.properties.units) })
    }
  },
  methods: {
    setMode(e) { this.setData({ 'edit.mode': e.currentTarget.dataset.mode }) },
    setRatio(e) { this.setData({ 'edit.ratioText': e.detail.value }) },
    setQty(e) { this.setData({ 'edit.qtyText': e.detail.value }) },
    onSave() {
      if (this.properties.saving) return
      const built = lowstock.saveBody(this.data.edit, this.properties.units)
      if (built.error) { wx.showToast({ title: built.error, icon: 'none' }); return }
      this.triggerEvent('submit', built.body)
    },
    onClose() { this.triggerEvent('close') }
  }
})
