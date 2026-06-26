// components/list-pager/index.js
// 通用列表翻页组件：首页/上一页/下一页/末页 + 页码跳转 + 自定义每页条数。
// 各类列表页（不限租赁订单）可复用；建议放在查询结果的首尾两端。
//
// 用法：
//   <list-pager page="{{page}}" total-pages="{{totalPages}}" page-size="{{pageSize}}"
//               disabled="{{querying}}" bind:change="onPagerChange" />
//   onPagerChange(e) { var d = e.detail  // { page, pageSize }
//     this.setData({ querying: true }); this.getData(d.page, d.pageSize) }
//
// 说明：
//   - 翻页/跳转：emit { page, pageSize:当前 }
//   - 改每页条数：emit { page:1, pageSize:新值 }（回到第 1 页）
//   - disabled=true（查询进行中）时所有按钮/输入框禁用，杜绝查询期间翻页
Component({
  properties: {
    page: { type: Number, value: 1 },
    totalPages: { type: Number, value: 1 },
    pageSize: { type: Number, value: 50 },
    disabled: { type: Boolean, value: false },
    maxPageSize: { type: Number, value: 500 }
  },

  data: {
    pageInput: '',
    pageSizeInput: '50'
  },

  observers: {
    'pageSize': function (v) {
      // 父级 pageSize 变化时同步输入框显示（如非法输入被回退）
      if (String(v) !== this.data.pageSizeInput) {
        this.setData({ pageSizeInput: String(v) })
      }
    }
  },

  lifetimes: {
    attached() {
      this.setData({ pageSizeInput: String(this.data.pageSize) })
    }
  },

  methods: {
    _emit(page, pageSize) {
      this.triggerEvent('change', { page: page, pageSize: pageSize })
    },

    onFirst() {
      if (this.data.disabled || this.data.page <= 1) return
      this._emit(1, this.data.pageSize)
    },

    onPrev() {
      if (this.data.disabled || this.data.page <= 1) return
      this._emit(this.data.page - 1, this.data.pageSize)
    },

    onNext() {
      if (this.data.disabled || this.data.page >= this.data.totalPages) return
      this._emit(this.data.page + 1, this.data.pageSize)
    },

    onLast() {
      if (this.data.disabled || this.data.page >= this.data.totalPages) return
      this._emit(this.data.totalPages, this.data.pageSize)
    },

    onPageInput(e) {
      this.setData({ pageInput: e.detail.value })
    },

    onJump() {
      if (this.data.disabled) return
      var page = parseInt(this.data.pageInput, 10)
      if (isNaN(page) || page < 1) {
        wx.showToast({ title: '请输入有效页码', icon: 'none' })
        return
      }
      if (page > this.data.totalPages) page = this.data.totalPages
      this.setData({ pageInput: '' })
      this._emit(page, this.data.pageSize)
    },

    onPageSizeInput(e) {
      this.setData({ pageSizeInput: e.detail.value })
    },

    // 失焦/回车时生效：改每页条数 → 回到第 1 页
    onPageSizeChange() {
      if (this.data.disabled) return
      var size = parseInt(this.data.pageSizeInput, 10)
      if (isNaN(size) || size < 1) {
        this.setData({ pageSizeInput: String(this.data.pageSize) })
        return
      }
      if (size > this.data.maxPageSize) size = this.data.maxPageSize
      if (size === this.data.pageSize) {
        this.setData({ pageSizeInput: String(size) })
        return
      }
      this.setData({ pageSizeInput: String(size) })
      this._emit(1, size)
    }
  }
})
