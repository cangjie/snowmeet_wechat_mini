// components/date_selector/date_selector.js
const util = require('../../utils/util.js')
Component({

  /**
   * Component properties
   */
  properties: {
    minDate: {
      type: Date,
      value: null
    },
    maxDate:{
      type: Date,
      value: null
    }
  },

  /**
   * Component initial data
   */
  data: {
    showCalendar: false,
    dayType: '今天'
  },
  lifetimes:{
    ready(){
      var that = this
      var minDate = that.properties.minDate == null? new Date('2020-1-1') : new Date(that.properties.minDate)
      var maxDate = that.properties.maxDate == null? new Date() : new Date(that.properties.maxDate)
      var defaultDate = (new Date()).getTime()
      var startDate = util.formatDate(new Date())
      var endDate = util.formatDate(new Date())
      that.setData({minDate: minDate.getTime(), maxDate: maxDate.getTime(), 
      defaultDate: [defaultDate, defaultDate], startDate, endDate})
      that.triggerEvent('DateSelected', {startDate: startDate, endDate: endDate})
    }
  },

  /**
   * Component methods
   */
  methods: {
    showCalendar(e){
      var that = this
      that.setData({showCalendar: true})
    },
    onCalendarClose(e){
      var that = this
      that.setData({showCalendar: false})
    },
    onCalendarConfirm(e){
      var that = this
      console.log('confirm calendar', e)
      var startDate = util.formatDate(new Date(e.detail[0]))
      var endDate = util.formatDate(new Date(e.detail[1]))
      that.setData({showCalendar: false, startDate, endDate, dayType: null})
      that.triggerEvent('DateSelected', {startDate: startDate, endDate: endDate})
    },
    setDay(e){
      var that = this
      var id = e.currentTarget.id
      var startDate = null
      var endDate = null
      var dayType = that.data.dayType
      switch(id){
        case 'today':
          startDate = util.formatDate(new Date())
          endDate = util.formatDate(new Date())
          dayType = '今天'
          break
        case 'yesterday':
          var date = new Date()
          date.setDate(date.getDate() - 1)
          startDate = util.formatDate(date)
          endDate = util.formatDate(date)
          dayType = '昨天'
          break
        case 'week':
          startDate = new Date()
          var dayOfWeek = startDate.getDay()
          startDate.setDate(startDate.getDate() - dayOfWeek)
          endDate = new Date(startDate)
          endDate.setDate(endDate.getDate() + 6)
          dayType = '本周'
          startDate = util.formatDate(startDate)
          endDate = util.formatDate(endDate)
          break
        case 'lastweek':
          startDate = new Date()
          startDate.setDate(startDate.getDate() - 7)
          var dayOfWeek = startDate.getDay()
          startDate.setDate(startDate.getDate() - dayOfWeek)
          endDate = new Date(startDate)
          endDate.setDate(endDate.getDate() + 6)
          dayType = '上周'
          startDate = util.formatDate(startDate)
          endDate = util.formatDate(endDate)
          break
        default:
          break
      }
      that.setData({dayType, startDate, endDate})
      that.triggerEvent('DateSelected', {startDate: startDate, endDate: endDate})
    }
  }
})