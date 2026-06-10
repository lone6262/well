Component({
  properties: {
    type: {
      type: String,
      value: 'empty'
    },
    icon: {
      type: String,
      value: ''
    },
    title: {
      type: String,
      value: ''
    },
    description: {
      type: String,
      value: ''
    },
    actionText: {
      type: String,
      value: ''
    },
    showAction: {
      type: Boolean,
      value: false
    },
    theme: {
      type: String,
      value: 'light'
    },
    card: {
      type: Boolean,
      value: false
    }
  },

  methods: {
    onActionTap: function() {
      this.triggerEvent('action')
    }
  }
})
