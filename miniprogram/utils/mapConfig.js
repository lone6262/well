// 腾讯地图配置
// 请在这里填写你的腾讯地图API密钥
const MAP_CONFIG = {
  // 腾讯地图API密钥（需要在腾讯地图控制台申请小程序key）
  key: 'FVZBZ-P2K3I-VXJGC-UUWOF-RSTAQ-BSFKQ', // 请替换为你的真实API密钥

  // 地图默认配置
  defaultCenter: {
    latitude: 39.90469,  // 北京天安门
    longitude: 116.40717
  },

  // 搜索配置
  searchOptions: {
    keyword: '宠物医院',
    page_size: 20,
    page_index: 1,
    radius: 5000  // 搜索半径5公里
  }
}

module.exports = MAP_CONFIG