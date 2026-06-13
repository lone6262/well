/**
 * content-card — 内容卡片组件
 * 白底 + 左侧品牌色强调线 + 圆角边框
 * 用于医院、文章、记录等列表项
 */
Component({
  properties: {
    accent: {
      type: String,
      value: 'brand'
    },
    hover: {
      type: Boolean,
      value: true
    }
  }
})
