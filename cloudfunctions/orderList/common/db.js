/**
 * 统一数据库初始化模块
 * 替代每个云函数中重复的 cloud.init() + cloud.database() 代码
 *
 * 使用方式：
 *   const { db, _, cloud } = require('../common/db');
 */

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

module.exports = { cloud, db, _ };
