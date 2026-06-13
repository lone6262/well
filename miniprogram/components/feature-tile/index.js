/**
 * feature-tile — 功能磁贴组件
 * 白底 + 顶部色条 + 图标在淡色圆容器中
 * 用于首页 6 宫格等功能入口
 */
Component({
  properties: {
    color: {
      type: String,
      value: 'primary'
    },
    icon: {
      type: String,
      value: ''
    },
    title: {
      type: String,
      value: ''
    },
    hover: {
      type: Boolean,
      value: true
    }
  }
})
