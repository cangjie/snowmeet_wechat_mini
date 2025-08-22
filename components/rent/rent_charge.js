Component({
  properties: {
    rentItem: Object
  },
  data: {
    activeNames: ['1']
  },
  lifetimes:{
    ready(){
      var that = this
      console.log('item', that.properties.rentItem)
    }
  },
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