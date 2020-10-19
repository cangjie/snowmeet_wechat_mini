// components/ski_board_base_info/ski_board_base_info.js
Component({
  /**
   * Component properties
   */
  properties: {
    type: {
      type: String,
      value: '双板'
    },
    brand: {
      type: String,
      value: '请选择...'
    },
    serial: {
      type: String,
      value: '请选择...'
    },
    year: {
      type: String,
      value: '请选择...'
    },
    scale: {
      type: String,
      value: '请选择...'
    }
  },

  /**
   * Component initial data
   */
  data: {
    years: ['请选择', '20-21', '19-20', '18-19', '17-18', '16-17', '15-16', '14-15', '13-14', '12-13', '11-12', '10-11', '09-10'],
    yearIndex: 0
  },

  /**
   * Component methods
   */
  methods: {
    selectSkiBoardInfo: function(source) {
      var s = source
    }
  },
  bindPickerChange: function(source) {
    var s = source
  }
})
