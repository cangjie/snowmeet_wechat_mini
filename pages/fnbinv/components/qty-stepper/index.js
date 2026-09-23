// 数量步进器（miniprogram_npm 里没有 van-stepper）：− 输入框 +，失焦或点按钮时发 change
Component({
  properties: {
    value: { type: null, value: 0 },
    step: { type: Number, value: 1 },
    min: { type: Number, value: 0 },
    integer: { type: Boolean, value: false },
    disabled: { type: Boolean, value: false }
  },
  methods: {
    emit(value) {
      const v = Math.max(this.properties.min, Math.round(Number(value) * 1e6) / 1e6)
      this.triggerEvent('change', { value: this.properties.integer ? Math.round(v) : v })
    },
    onDec() { if (!this.properties.disabled) this.emit(Number(this.properties.value || 0) - this.properties.step) },
    onInc() { if (!this.properties.disabled) this.emit(Number(this.properties.value || 0) + this.properties.step) },
    onBlur(e) { const v = Number(e.detail.value); this.emit(isNaN(v) ? this.properties.min : v) }
  }
})
