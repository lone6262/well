// 邀请排行榜云函数
// 内存中聚合邀请数据，返回 Top N（由 RANKING_CONFIG.TOP_N 配置）
// 带5分钟内存缓存，减少重复聚合开销
const cloud = require('wx-server-sdk');
const {
  COLLECTIONS,
  RESPONSE_CODE,
  INVITE_STATUS,
  TIME,
  RANKING_CONFIG,
  warmupConfig
} = require('./common/constants');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 内存缓存
let _rankingCache = null;
let _rankingCacheTime = 0;
const RANKING_CACHE_TTL = TIME.CACHE_5MIN; // 5分钟缓存

/**
 * 获取邀请排行榜
 *
 * @returns {object} { list: [{rank, nickname, avatarUrl, inviteCount}], myRank, myCount }
 */
exports.main = async (event, context) => {
  await warmupConfig(db);
  const { OPENID } = cloud.getWXContext();
  const openid = OPENID;

  if (!openid) {
    return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '用户未登录', data: {} };
  }

  try {
    const now = Date.now();
    let countMap;

    // 1. 检查缓存是否有效
    if (_rankingCache && (now - _rankingCacheTime) < RANKING_CACHE_TTL) {
      countMap = _rankingCache;
    } else {
      // 2. 缓存过期或无缓存，重新聚合
      // 分页查询所有已奖励记录（云数据库单次最多100条）
      countMap = {};
      let batchSize = RANKING_CONFIG.BATCH_SIZE;
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        let batch = await db.collection(COLLECTIONS.INVITE_RECORDS)
          .where({ status: INVITE_STATUS.REWARDED })
          .skip(offset)
          .limit(batchSize)
          .get();

        let records = batch.data || [];
        for (let i = 0; i < records.length; i++) {
          let inviterId = records[i].inviter_id;
          countMap[inviterId] = (countMap[inviterId] || 0) + 1;
        }

        if (records.length < batchSize) {
          hasMore = false;
        } else {
          offset += batchSize;
        }
      }

      // 更新缓存
      _rankingCache = countMap;
      _rankingCacheTime = now;
    }

    // 3. 排序取 Top 20
    let sorted = [];
    for (let userId in countMap) {
      sorted.push({ userId: userId, count: countMap[userId] });
    }
    sorted.sort(function(a, b) { return b.count - a.count; });
    const top20 = sorted.slice(0, RANKING_CONFIG.TOP_N);

    // 4. 批量查询用户信息
    let rankList = [];
    if (top20.length > 0) {
      const topIds = top20.map(function(item) { return item.userId; });
      const usersResult = await db.collection(COLLECTIONS.USERS)
        .where({ user_id: db.command.in(topIds) })
        .limit(RANKING_CONFIG.MAX_QUERY_LIMIT)
        .get();

      const userMap = {};
      const users = usersResult.data || [];
      for (let i = 0; i < users.length; i++) {
        userMap[users[i].user_id] = users[i];
      }

      // 5. 组装排行榜数据
      for (let i = 0; i < top20.length; i++) {
        const userInfo = userMap[top20[i].userId] || {};
        rankList.push({
          rank: i + 1,
          nickname: userInfo.nickName || userInfo.nickname || '宠物爱好者',
          avatarUrl: userInfo.avatarUrl || userInfo.avatar || '/images/avatar.png',
          inviteCount: top20[i].count
        });
      }
    }

    // 6. 当前用户排名
    const myCount = countMap[openid] || 0;
    let myRank = 0;
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].userId === openid) {
        myRank = i + 1;
        break;
      }
    }

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '获取成功',
      data: {
        list: rankList,
        myRank: myRank,
        myCount: myCount
      }
    };

  } catch (error) {
    console.error('查询排行榜失败:', error.message);
    return { code: RESPONSE_CODE.SERVER_ERROR, msg: '查询失败', data: {} };
  }
};
