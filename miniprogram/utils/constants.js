/**
 * 小程序前端常量配置
 */

// === Toast 提示时长（毫秒）===
const TOAST_DURATION = {
  SHORT: 1000,
  NORMAL: 2000,
  LONG: 3000,
  EXTRA_LONG: 5000
};

// === 缓存时长（毫秒）===
const CACHE_DURATION = {
  LOCATION: 5 * 60 * 1000,      // 位置缓存 5 分钟
  USER_INFO: 7 * 24 * 60 * 60 * 1000  // 用户信息缓存 7 天
};

// === 地图配置 ===
const MAP_CONFIG = {
  SEARCH_RADIUS: 5000,           // 搜索半径 5 米
  API_TIMEOUT: 10000             // API 超时 10 秒
};

// === 单位换算 ===
const UNIT_CONVERSION = {
  METERS_TO_KM: 1000,            // 米到千米换算
  COUNT_TO_WAN: 10000            // 数量到"万"换算
};

// === 其他配置 ===
const OTHER_CONFIG = {
  MIN_DISPLAY_DISTANCE: 1000     // 最小显示距离（米），超过则显示 km
};

module.exports = {
  TOAST_DURATION,
  CACHE_DURATION,
  MAP_CONFIG,
  UNIT_CONVERSION,
  OTHER_CONFIG
};
