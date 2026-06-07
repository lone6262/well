// 腾讯地图配置
// API密钥建议配置在云函数侧，通过 searchHospitals 云函数调用，避免前端暴露
const { MAP_CONFIG: MAP_CONSTANTS } = require('./constants.js')

const MAP_CONFIG = {
  // 腾讯地图API密钥（请在腾讯地图控制台申请小程序key，并绑定小程序APPID白名单）
  key: 'YOUR_TENCENT_MAP_KEY',

  // 地图默认配置
  defaultCenter: {
    latitude: 22.543099,  // 深圳市民中心
    longitude: 114.057868
  },

  // 搜索配置
  searchOptions: {
    keyword: '宠物医院',
    page_size: 20,
    page_index: 1,
    radius: MAP_CONSTANTS.SEARCH_RADIUS  // 搜索半径5公里
  }
}

module.exports = MAP_CONFIG
