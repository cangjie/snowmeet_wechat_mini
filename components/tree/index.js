// pages/common/comTree/index.js
const util = require('../../utils/util')
/**
 value = [
   {
     id: 1,
     name: '一级名称',
     children: []
   }
 ]

  */
 Component({
  /**
   * 组件的属性列表
   */
  properties: {
    dataTree: {
      type: Array,
      value: []
    },
    selectKey: { // 选中的节点id
      type: String,
      value: ''
    },
    isSelectLastNode: { //是否必须选中最后一节点
      type: Boolean,
      value: false
    },
    isOpenAll: { //是否展开全部节点
      type: Boolean,
      value: false
    },
    checkBox:{
      type: Boolean,
      value: true
    }
  },
  observers: {
    'dataTree': function(params) {
      params.forEach(v => {
        var code = v.id
        v.displayedCode = util.getDisplayedCode(code)
        
        if (this.properties.isOpenAll){
          v.open = this.properties.isOpenAll // 是否展开
        }
      })
      this.setData({
        tree: params
      })
    }
  },
  /**
   * 组件的初始数据
   */
  data: {
    tree: []
  },
  lifetimes:{
    ready(){
      var that = this
      that.setData({checkBox: that.properties.checkBox})
    }
  },

  /**
   * 组件的方法列表
   */
  methods: {
    checkChange(e){
      console.log(e)
      var that = this
      var id = e.currentTarget.id
      var checked = true
      if (e.detail.value.length == 0){
        checked = false
      }
      that.triggerEvent('check', {id: id, checked: checked}, { bubbles: true, composed: true })
    },
    isOpen(e) {
      const open = 'tree[' + e.currentTarget.dataset.index + '].open'
      this.setData({
        [open]: !this.data.tree[e.currentTarget.dataset.index].open
      })
    },
    select(e) {
      const item = e.currentTarget.dataset.item
      if(this.properties.isSelectLastNode) {
        console.log(item)
        this.triggerEvent('select', { item: item }, { bubbles: true, composed: true })
        /*
        if (!item.children || item.children.length == 0) {
          this.triggerEvent('select', { item: item }, { bubbles: true, composed: true })
        } else {
          this.triggerEvent('select', { tips: '必须选择最后一个节点' }, { bubbles: true, composed: true })
        }
        */
      } else {
        this.triggerEvent('select', { item: item }, { bubbles: true, composed: true })
      }
    }
  }
})
