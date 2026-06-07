// 搜索附近宠物医院云函数
// 将腾讯地图API调用从前端移至服务端，避免API密钥暴露
const cloud = require('wx-server-sdk');
const { RESPONSE_CODE, SERVER_CONFIG, warmupConfig } = require('./common/constants');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

/**
 * 获取腾讯地图 API Key（运行时读取，支持数据库刷新）
 */
function getMapKey() {
  return process.env.TENCENT_MAP_KEY || SERVER_CONFIG.TENCENT_MAP_KEY;
}

const SEARCH_KEYWORDS = [
  '24小时宠物医院',
  '宠物医院急诊',
  '宠物医院'
];

const SEARCH_RADIUS = 5000;   // 默认搜索半径5公里
const SEARCH_TIMEOUT = 8000;  // 单次搜索超时8秒
const PAGE_SIZE = 20;

/**
 * 计算两点间距离（Haversine公式）
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // 地球半径（米）
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * 检查是否为24小时医院
 */
function check24Hours(title, address) {
  const keywords = ['24小时', '急诊', '24h', '全天', '昼夜', '日夜'];
  return keywords.some(kw => (title || '').includes(kw) || (address || '').includes(kw));
}

/**
 * 格式化电话号码（只取第一个）
 */
function formatPhoneNumber(tel) {
  if (!tel) return '暂无电话';

  let telStr = tel.toString();

  // 多个号码可能用分号、逗号、斜杠、顿号等分隔，只取第一个
  let separators = /[;；,，/\\、\n\r|]/;
  let parts = telStr.split(separators);
  let first = (parts[0] || '').trim();

  // 清理：只保留数字、+、-、空格
  let cleaned = first.replace(/[^0-9+\-\s]/g, '').trim();

  return (cleaned && cleaned.length >= 7) ? cleaned : '请电话确认';
}

/**
 * 使用关键词搜索腾讯地图地点
 */
async function searchByKeyword(latitude, longitude, radius, keyword) {
  const https = require('https');
  const querystring = require('querystring');

  return new Promise((resolve) => {
    const params = querystring.stringify({
      key: getMapKey(),
      keyword: keyword,
      boundary: `nearby(${latitude},${longitude},${radius})`,
      page_size: PAGE_SIZE,
      page_index: 1
    });

    const url = `https://apis.map.qq.com/ws/place/v1/search?${params}`;

    const req = https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.status === 0 && result.data) {
            resolve(result.data.map(item => ({
              hospitalId: item.id || ('unknown_' + Date.now()),
              name: item.title || '未命名医院',
              address: item.address || '地址暂无',
              distance: item.distance || calculateDistance(
                latitude, longitude,
                item.location ? item.location.lat : 0,
                item.location ? item.location.lng : 0
              ),
              latitude: (item.location && item.location.lat) || 0,
              longitude: (item.location && item.location.lng) || 0,
              phone: formatPhoneNumber(item.tel),
              is24h: check24Hours(item.title, item.address),
              rating: 4.5
            })));
          }
          resolve([]);
        } catch (e) {
          resolve([]);
        }
      });
    });

    req.on('error', () => { resolve([]); });
    req.setTimeout(SEARCH_TIMEOUT, () => { req.abort(); resolve([]); });
  });
}

/**
 * 云函数入口
 */
exports.main = async (event) => {
  await warmupConfig(db);

  const { latitude, longitude, radius = SEARCH_RADIUS } = event;

  if (!latitude || !longitude) {
    return {
      code: RESPONSE_CODE.ERROR,
      msg: '缺少经纬度参数',
      data: { hospitals: [] }
    };
  }

  const TENCENT_MAP_KEY = getMapKey();
  if (!TENCENT_MAP_KEY || TENCENT_MAP_KEY === 'YOUR_TENCENT_MAP_KEY_HERE') {
    return {
      code: RESPONSE_CODE.ERROR,
      msg: 'TENCENT_MAP_KEY 未配置',
      data: { hospitals: [] }
    };
  }

  try {
    console.log(`搜索附近医院: (${latitude}, ${longitude}), 半径: ${radius}m`);

    // 并行搜索多个关键词
    const searchPromises = SEARCH_KEYWORDS.map((keyword, index) =>
      searchByKeyword(latitude, longitude, radius, keyword)
        .then(results => results.map(r => ({ ...r, searchPriority: index, searchKeyword: keyword })))
    );

    const allResults = await Promise.all(searchPromises);
    const rawResults = allResults.flat();

    if (rawResults.length === 0) {
      return {
        code: RESPONSE_CODE.SUCCESS,
        msg: '未找到附近医院',
        data: { hospitals: [] }
      };
    }

    // 去重：按hospitalId去重，保留优先级最高的
    const uniqueMap = new Map();
    rawResults.forEach(result => {
      const existing = uniqueMap.get(result.hospitalId);
      if (!existing || result.searchPriority < existing.searchPriority) {
        uniqueMap.set(result.hospitalId, result);
      }
    });

    // 排序：24小时优先 → 距离近优先 → 搜索优先级
    const sortedResults = Array.from(uniqueMap.values()).sort((a, b) => {
      if (a.is24h !== b.is24h) return a.is24h ? -1 : 1;
      if (a.distance !== b.distance) return a.distance - b.distance;
      return a.searchPriority - b.searchPriority;
    });

    console.log(`返回 ${sortedResults.length} 个医院，其中24小时: ${sortedResults.filter(h => h.is24h).length}个`);

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '搜索成功',
      data: { hospitals: sortedResults }
    };

  } catch (error) {
    console.error('搜索医院失败:', error);
    return {
      code: RESPONSE_CODE.SERVER_ERROR,
      msg: '搜索失败，请稍后重试',
      data: { hospitals: [] }
    };
  }
};
