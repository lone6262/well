// 全局桥接 — 将 ES Module 函数暴露到 window 以兼容未迁移的旧模块
// 当所有模块迁移完成后，可移除此文件

import {
  TCB_CONFIG, CLOUD_FUNCTIONS, TOAST_DISPLAY_DURATION,
  PAGINATION, STATUS_MAP, CATEGORY_MAP, ORDER_TYPE_MAP,
  REFUND_STATUS_MAP, COUPON_SCENE_MAP, MEMBER_TYPE_MAP
} from './config.js';

import { initCloud, getAdminToken, setAdminToken } from './auth.js';
import {
  callCloudFunction, showLoading, hideLoading,
  showToast, handleApiError, confirmAction
} from './api.js';
import {
  formatDate, formatDateTime, formatNumber,
  escapeHtml, escapeAttr, renderPagination
} from './utils.js';
import {
  validateForm, validateAndShow, clearFieldErrors, showFieldErrors
} from './validator.js';
import {
  createCrudLoader, extractData, bindFilterEvents, confirmedAction
} from './crud-base.js';
import { openModal, closeModal, getFocusableElements, trapModalFocus } from './modal.js';

// 配置常量
window.TCB_CONFIG = TCB_CONFIG;
window.CLOUD_FUNCTIONS = CLOUD_FUNCTIONS;
window.TOAST_DISPLAY_DURATION = TOAST_DISPLAY_DURATION;
window.PAGINATION = PAGINATION;
window.STATUS_MAP = STATUS_MAP;
window.CATEGORY_MAP = CATEGORY_MAP;
window.ORDER_TYPE_MAP = ORDER_TYPE_MAP;
window.REFUND_STATUS_MAP = REFUND_STATUS_MAP;
window.COUPON_SCENE_MAP = COUPON_SCENE_MAP;
window.MEMBER_TYPE_MAP = MEMBER_TYPE_MAP;

// 认证
window.initCloud = initCloud;
window.getAdminToken = getAdminToken;
window.setAdminToken = setAdminToken;

// API
window.callCloudFunction = callCloudFunction;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.showToast = showToast;
window.handleApiError = handleApiError;
window.confirmAction = confirmAction;

// 工具
window.formatDate = formatDate;
window.formatDateTime = formatDateTime;
window.formatNumber = formatNumber;
window.escapeHtml = escapeHtml;
window.escapeAttr = escapeAttr;
window.renderPagination = renderPagination;

// 验证
window.validateForm = validateForm;
window.validateAndShow = validateAndShow;
window.clearFieldErrors = clearFieldErrors;
window.showFieldErrors = showFieldErrors;

// CRUD
window.createCrudLoader = createCrudLoader;
window.extractData = extractData;
window.bindFilterEvents = bindFilterEvents;
window.confirmedAction = confirmedAction;

// 弹窗
window.openModal = openModal;
window.closeModal = closeModal;
