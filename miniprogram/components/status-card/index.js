/**
 * status-card — 状态卡片组件
 * 带色彩背景（非白底）、圆角、大内边距
 * 用于风险结果、健康状态等
 */
Component({
  properties: {
    type: {
      type: String,
      value: 'info'
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
    }
  }
})
