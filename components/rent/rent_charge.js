// components/rent/rent_charge.js
Component({

  /**
   * Component properties
   */
  properties: {

  },

  /**
   * Component initial data
   */
  data: {
    itemSegs: ['押金', '计划及租金', '租金减免'],
    segIndex: 0
  },

  /**
   * Component methods
   */
  methods: {
    switchSeg(e){
      var that = this
      var segIndex = e.detail.index
      that.setData({segIndex})
    }
  }
})