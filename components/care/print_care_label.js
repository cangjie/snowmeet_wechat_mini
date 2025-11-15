// components/care/print_care_label.js
Component({

  /**
   * Component properties
   */
  properties: {
    care: Object
    
  },

  /**
   * Component initial data
   */
  data: {
    printType: '顾客小票'
  },

  /**
   * Component methods
   */
  methods: {
    setPrintType(e){
      var that = this
      that.data.printType = e.detail.value
    }
  }
})