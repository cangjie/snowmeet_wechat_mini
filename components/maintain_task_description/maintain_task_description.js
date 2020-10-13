// components/maintain_task_description/maintain_task_description.js
Component({
  /**
   * Component properties
   */
  properties: {
    taskid:{
      type: String,
      value: '0'
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
  methods: {

  },
  pageLifetimes: {
    show: function(e) {
      this.setData({currentTaskId: (parseInt(this.properties.taskid) + 1).toString()})
    }
  }
})
