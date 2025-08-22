// components/rent/rent_charge.js
Component({
  
  /**
   * Component properties
   */
  properties: {
    //rentItem: Object
    rentItem: Object,
    observers:{
      '*': function(rentItem){
        console.log('observer item', rentItem)
      }
    },
  },

  /**
   * Component initial data
   */
  data: {
    activeNames: ['1']
  },
  pageLifetimes:{
    
    show(){
      var that = this
      console.log('item', that.properties.rentItem)
    }
  },
  lifetimes:{
    ready(){
      var that = this
      console.log('item', that.properties.rentItem)
    }
  },
  /**
   * Component methods
   */
  methods: {
    
    switchSeg(e){
      var that = this
      var segIndex = e.detail.index
      that.setData({segIndex})
    },
    onChange(event) {
      this.setData({
        activeNames: event.detail,
      });
    },
  },
  
})