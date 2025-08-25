// components/rent/category_selector.js
const coreData = require('../../utils/data.js')
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
    mainActiveIndex: 0,
    activeId: null,
  },
  lifetimes: {
    ready() {
      var that = this
      coreData.getTopCategoriesPromise().then(function (categories) {
        console.log('get categories', categories)
        var items = categories.map(item => { return { text: item.name, id: item.id } })
        if (items.length > 0) {
          coreData.getSubCategoriesPromise(items[0].id).then(function (subCategories) {
            var subItems = subCategories.map(item => { return { text: item.name, id: item.id } })
            items[0].children = subItems
            that.setData({ items })
          })
        }
        that.setData({ items })
      })
    }
  },
  /**
   * Component methods
   */
  methods: {
    onClickNav(e) {
      console.log('nav click', e)
      var that = this
      var index = e.detail.index
      var items = that.data.items
      var item = items[index]
      if (!item.children) {
        coreData.getSubCategoriesPromise(item.id).then(function (categories) {
          console.log('get sub categories', categories)
          item.children = categories.map(item => { return { text: item.name, id: item.id } })
          that.setData({ items, mainActiveIndex: index})
        })
      }
      else{
        that.setData({mainActiveIndex: index})
      }
    },
    onClickItem(e){
      console.log('item click', e)
      var that = this
      var activeId = e.detail.id
      that.setData({activeId})
    }
  }
})