// components/date_selector/date_selector_double.js
const util = require('../../utils/util.js')
Component({
  /**
   * Component properties
   */
  properties: {
    rangeStart: {
      type: String,
      value: '2022-9-1'
    },
    rangeEnd: {
      type: String,
      value: '2024-6-1'
    }
  },

  /**
   * Component initial data
   */
  data: {

  },

  /**
   * Component methods
   */
  lifetimes: {
    ready(){
      var that = this
      var end = new Date()
      var start = new Date()
      start.setDate(start.getDate() - 1)
      var startStr = util.formatDate(start)
      var endStr = util.formatDate(end)
      that.setData({rangeStart: that.properties.rangeStart, rangeEnd: that.properties.rangeEnd, start: startStr, end: endStr})
      that.triggerEvent('DateSelected', {start: startStr, end: endStr})
    }
  },
  methods:{
    startSelected(e){
      var that = this
      that.setData({start: e.detail.value})
      that.triggerEvent('DateSelected', {start: that.data.start, end: that.data.end})
    },
    endSelected(e){
      var that = this
      that.setData({end: e.detail.value})
      that.triggerEvent('DateSelected', {start: that.data.start, end: that.data.end})
    }
  }
})
