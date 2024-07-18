// components/price_matrix/price_matrix.js
Component({

  /**
   * Component properties
   */
  properties: {
    fieldsRow:{
      type: Array,
      value:['门市', '预约', '会员']
    },
    fieldsCol:{
      type: Array,
      value: ['平日', '周末', '节假日']
    },
    
    priceMatrix:{
      type: Array,
      value:[]
    },
    disabled: {
      type: Boolean,
      value: false
    }
  },

  /**
   * Component initial data
   */
  data: {
    shops:[],
    currentShopIndex: 0
  },
  lifetimes:{
    ready(){
      var that = this
      var matrix = that.properties.priceMatrix
      var shops = []

      for(var i = 0; i < matrix.length; i++){
        shops.push({title: matrix[i].shop, title2: '', img: '', desc: ''})
      }
      that.setData({shops: shops, fieldsX: that.properties.fieldsCol, fieldsY: that.properties.fieldsRow, priceMatrix: that.properties.priceMatrix})
      this.triggerEvent('TabChange', {index: 0})
    }
  },

  /**
   * Component methods
   */
  methods: {
    onTabChange(e){
      var that = this
      that.setData({currentShopIndex: e.detail.index})
      this.triggerEvent('TabChange', {index: e.detail.index})
    },
    setNumber(e){
      var that = this
      var currentShopIndex = that.data.currentShopIndex
      var id = e.currentTarget.id
      var x = parseInt(id.split('_')[1])
      var y = parseInt(id.split('_')[2])
      var matrix = that.data.priceMatrix
      matrix[currentShopIndex].matrix[x][y] = e.detail.value
      that.setData({priceMatrix: matrix})
      this.triggerEvent('mod', {currentShopIndex: currentShopIndex, row: x, col: y, value: e.detail.value})
    }
  }
})