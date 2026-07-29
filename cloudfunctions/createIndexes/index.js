/**
 * createIndexes — V1.5.5 集合初始化
 *
 * ⚠️ 微信云开发 Node SDK（wx-server-sdk）不支持 db.collection().createIndex，
 *    索引无法在云函数内创建。索引请用以下任一方式（部署时已执行）：
 *    - tcb db nosql execute --command '{ "createIndexes": "pet_moments", ... }'
 *    - 云开发控制台 → 数据库 → 索引管理
 *
 * 所需索引（见 docs/V1.5.5_实施方案_修订版.md §3.1）：
 *   pet_moments:       {user_id:1, date:-1} 查询；{user_id:1, date:1} unique
 *   knowledge_articles: {featured_date:-1}
 *
 * 本函数仅负责确保集合存在。
 */
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

async function ensureCollection(name) {
  try {
    await db.createCollection(name);
    return 'created';
  } catch (e) {
    return 'exists';
  }
}

exports.main = async (event, context) => {
  const log = [];
  log.push('pet_moments: ' + (await ensureCollection('pet_moments')));
  log.push('注意：索引需用 tcb db createIndexes 或控制台创建（云函数 SDK 不支持 createIndex）');
  return { code: 0, data: { log: log } };
};
