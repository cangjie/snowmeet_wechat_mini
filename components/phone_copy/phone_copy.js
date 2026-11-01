// components/phone_copy/phone_copy.js
// 手机号后面的小「复制」按钮，点一下把显示的手机号复制到剪贴板。已在 app.json 注册为全局组件 phone-copy。
// 用法：<text>{{item.cell}}</text><phone-copy phone="{{item.cell}}" />
// 传进来的不是完整号码（空、占位文字、脱敏号、尾号）时什么都不显示，所以不用在页面里再判断。
// 按钮用 catchtap，点复制不会触发外层的点击（比如点手机号拨号）。
const { copyablePhone, copyPhone } = require('../../utils/phone_copy.js')

Component({
  properties: {
    phone: { type: String, optionalTypes: [Number], value: '', observer: 'refresh' },
  },
  data: {
    text: '',
  },
  lifetimes: {
    attached() { this.refresh(this.data.phone) },
  },
  methods: {
    refresh(phone) {
      const text = copyablePhone(phone)
      if (text !== this.data.text) this.setData({ text })
    },
    onCopy() {
      copyPhone(this.data.text)
    },
  },
})
