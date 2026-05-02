// components/reception/rent_recept_form/rent_recept_form.js
// 租赁接待开单表单（第一步）
// 父页面契约：见 wxml 顶部注释
//
// 设计原则（参考 components/rent/rent_recept）：
//   - 组件不直接调接口，所有数据变更通过事件回传父页
//   - 父页面收到 syncRent 后，按需调 Rent/SaveRentRecept 同步后端
//   - 添加商品的具体面板（套餐选择 / 单品搜索 / 扫码 / 无码物品）由父页弹窗控制，
//     本组件只负责发出 addAction 事件请求弹窗

Component({
  options: {
    addGlobalClass: true,
    multipleSlots: false,
  },

  properties: {
    shop: { type: String, value: '' },
    memberId: { type: Number, value: 0 },
    rentals: {
      type: Array,
      value: [],
      observer(newVal) {
        // 父页主动 setData(rentals) 时，本组件重新渲染并刷新汇总
        this.setData({ rentals: newVal || [] }, () => this.refreshSummary());
      },
    },
  },

  data: {
    sort: 'time',                     // 'time' | 'category'
    rentals: [],
    summary: {
      deposit: 0,
      depositReduce: 0,
      rent: 0,
      depositLabel: '0',
      depositReduceLabel: '0',
      rentLabel: '0.00',
    },
  },

  lifetimes: {
    attached() {
      this.refreshSummary();
    },
  },

  methods: {
    /* ---------- 计算汇总 ---------- */
    refreshSummary() {
      const list = this.data.rentals || [];
      let deposit = 0;
      let rent = 0;
      let depositReduce = 0;
      list.forEach((r) => {
        deposit += Number(r.realGuaranty) || Number(r.guaranty) || 0;
        rent += Number(r.dailyRate) || Number(r.price) || 0;
        depositReduce += Number(r.guaranty_discount) || 0;
      });
      this.setData({
        summary: {
          deposit,
          depositReduce,
          rent,
          depositLabel: deposit.toLocaleString('en-US'),
          depositReduceLabel: depositReduce.toLocaleString('en-US'),
          rentLabel: rent.toFixed(2),
        },
      });
    },

    /* ---------- 用户操作 ---------- */
    onSortChange(e) {
      const sort = e.currentTarget.dataset.value;
      if (sort === this.data.sort) return;
      // 排序由父页统一处理（涉及业务规则），组件只通报选择变化
      this.setData({ sort });
      this.triggerEvent('sortChange', { sort });
    },

    /**
     * 4 个添加入口：套餐 / 扫码 / 搜索 / 无码物品
     * 触发 addAction 事件，父页负责弹窗 / 跳转 / 调接口
     */
    onAddAction(e) {
      const action = e.currentTarget.dataset.action;
      this.triggerEvent('addAction', { action });
    },

    /**
     * 卡片点击：打开详情编辑（押金 / 租金 / 起租 / 租赁形式 / 租赁物录入）
     * 由父页弹窗承载，下一步迭代时填充
     */
    onTapRental(e) {
      const idx = e.currentTarget.dataset.idx;
      const rental = (this.data.rentals || [])[idx];
      this.triggerEvent('editRental', { index: idx, rental });
    },

    onDeleteRental(e) {
      const idx = Number(e.currentTarget.dataset.idx);
      if (Number.isNaN(idx)) return;
      wx.showModal({
        title: '删除',
        content: '确认删除此项？',
        confirmColor: '#ba1a1a',
        success: (res) => {
          if (res.confirm) this.removeRental(idx);
        },
      });
    },

    /**
     * 去结算
     * 父页负责后续：组装订单 → Rent/SaveRentRecept 落库 → 跳支付页
     */
    onCheckout() {
      if (!this.data.rentals || this.data.rentals.length === 0) {
        wx.showToast({ title: '请先添加租赁商品', icon: 'none' });
        return;
      }
      this.triggerEvent('checkout', { rentals: this.data.rentals });
    },

    /* ---------- 由父页调用的对外方法 ---------- */
    /**
     * 父页在用户从弹窗选完套餐 / 单品 / 无码物品后，组装出新的 rental 并通过此方法
     * 追加到购物车，组件内部再 triggerEvent('syncRent') 让父页拿到最新清单去调接口
     */
    addRental(rental) {
      const rentals = (this.data.rentals || []).slice();
      rental.timeStamp = rental.timeStamp || Date.now();
      rentals.push(rental);
      this.setData({ rentals }, () => {
        this.refreshSummary();
        this.triggerEvent('syncRent', { rentals, needUpdate: true });
      });
    },

    removeRental(index) {
      const rentals = (this.data.rentals || []).slice();
      rentals.splice(index, 1);
      this.setData({ rentals }, () => {
        this.refreshSummary();
        this.triggerEvent('syncRent', { rentals, needUpdate: true });
      });
    },
  },
});
