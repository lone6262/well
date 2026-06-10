// 管理后台测试环境初始化
// 模拟 DOM 环境，加载全局脚本

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { vi } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 模拟全局配置（config.js 依赖）
global.TCB_CONFIG = { env: 'test-env' };
global.TOAST_DISPLAY_DURATION = 3000;
global.PAGINATION = { defaultPageSize: 20 };

// 模拟 admin/js/config.js 中的常量
global.CLOUD_FUNCTIONS = {
  adminGetConfig: 'adminGetConfig',
  adminUpdateConfig: 'adminUpdateConfig',
  adminGetArticles: 'adminGetArticles',
  adminSaveArticle: 'adminSaveArticle',
  adminDeleteArticle: 'adminDeleteArticle',
};

// 状态映射常量（app.js 中定义）
global.STATUS_MAP = {
  article: { published: { text: '已发布', class: 'badge-success' }, draft: { text: '草稿', class: 'badge-warning' }, archived: { text: '已归档', class: 'badge-gray' } },
};
global.CATEGORY_MAP = { digestive: '消化系统', respiratory: '呼吸系统', behavior: '行为异常', prevention: '预防保健', care: '特殊阶段' };
global.COUPON_SCENE_MAP = { new_user: '新用户', invite: '邀请奖励', followup: '回访奖励', renew: '续费召回', return: '流失回归', invite_milestone_5: '邀请5人' };

// 模拟全局 DOM 操作函数（这些在真实页面中由 api.js 和 app.js 提供）
global.showLoading = vi.fn();
global.hideLoading = vi.fn();
global.showToast = vi.fn();
global.handleApiError = vi.fn();
global.renderPagination = vi.fn();
global.confirmAction = vi.fn();
global.getAdminToken = vi.fn(() => 'test-admin-token');
global.callCloudFunction = vi.fn().mockResolvedValue({ code: 0, data: [] });

// window.location
Object.defineProperty(window, 'location', {
  value: { hash: '#dashboard', search: '', pathname: '/' },
  writable: true,
  configurable: true,
});

/**
 * 使用间接 eval 在全局作用域执行脚本，使函数声明成为 window 属性
 * jsdom 中 document.createElement('script') 方式在某些情况下不会执行
 */
function loadScript(filename) {
  const filePath = path.resolve(__dirname, '..', 'js', filename);
  if (!fs.existsSync(filePath)) return;
  const src = fs.readFileSync(filePath, 'utf-8');
  // 间接 eval：在全局作用域执行，顶层 function 声明成为全局变量
  const indirectEval = eval;
  indirectEval(src);
}

// 按顺序加载依赖脚本
loadScript('validator.js');
loadScript('crud-base.js');
