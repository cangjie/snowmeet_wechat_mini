// components/price_matrix/price_matrix.js
Component({

  /**
   * Component properties
   */
  properties: {
    fieldsX:{
      type: Array,
      value:['门市', '预约', '会员']
    },
    fieldsY:{
      type: Array,
      value: ['平日', '周末', '节假日']
    },
    
    priceMatrix:{
      type: Array,
      value:[]
    }
  },

  /**
   * Component initial data
   */
  data: {
    shops:[]
  },
  lifetimes:{
    ready(){
      var that = this
      var matrix = that.properties.priceMatrix
      var shops = []
      if (matrix.length == 0){
        shops = [
          {
            title: '万龙',
            title2: '',
            img: '',
            desc: '',
            shop: '万龙体验中心'
          },
          {
            title: '旗舰',
            title2: '',
            img: '',
            desc: '',
            shop: '崇礼旗舰店'
          },
          {
            title: '南山',
            title2: '',
            img: '',
            desc: '',
            shop: '南山'
          }
        ]
      }
      that.setData({shops: shops, fieldsX: that.properties.fieldsX})
    }
  },

  /**
   * Component methods
   */
  methods: {

  }
})