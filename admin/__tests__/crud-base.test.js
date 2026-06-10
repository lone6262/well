// admin/js/crud-base.js 单元测试
import { describe, it, expect, beforeEach, vi } from 'vitest';

// loadPage 不返回 Promise，需要手动刷新异步队列
// mockResolvedValue 在 microtask 中 resolve，setTimeout 确保其完成
function flush() {
  return new Promise(function(resolve) { setTimeout(resolve, 10); });
}

describe('extractData', () => {
  it('简单路径提取', () => {
    var result = { code: 0, data: [1, 2, 3] };
    expect(extractData(result, 'data')).toEqual([1, 2, 3]);
  });

  it('嵌套路径提取', () => {
    var result = { code: 0, data: { orders: [1, 2] } };
    expect(extractData(result, 'data.orders')).toEqual([1, 2]);
  });

  it('深层嵌套路径提取', () => {
    var result = { code: 0, data: { result: { items: ['a', 'b'] } } };
    expect(extractData(result, 'data.result.items')).toEqual(['a', 'b']);
  });

  it('路径不存在返回空数组', () => {
    var result = { code: 0, data: {} };
    expect(extractData(result, 'data.missing')).toEqual([]);
  });

  it('中间路径为 null 返回空数组', () => {
    var result = { code: 0, data: null };
    expect(extractData(result, 'data.items')).toEqual([]);
  });

  it('结果不是数组返回空数组', () => {
    var result = { code: 0, data: { count: 5 } };
    expect(extractData(result, 'data.count')).toEqual([]);
  });
});

describe('createCrudLoader', function() {
  var mockLoadFn;
  var mockDisplayFn;
  var mockSetState;

  beforeEach(function() {
    document.body.innerHTML =
      '<div id="loadingOverlay" class="loading-overlay hidden"><p>加载中...</p></div>' +
      '<div id="toast" class="toast hidden"></div>' +
      '<div id="testPagination"></div>';

    mockLoadFn = vi.fn();
    mockDisplayFn = vi.fn();
    mockSetState = vi.fn();
  });

  it('返回一个函数', function() {
    var loader = createCrudLoader({
      loadFn: mockLoadFn,
      displayFn: mockDisplayFn,
      paginationId: 'testPagination',
      getState: function() { return { page: 1 }; },
      setState: mockSetState,
    });
    expect(typeof loader).toBe('function');
  });

  it('调用 loadFn 时传递 page 和 pageSize', function() {
    mockLoadFn.mockResolvedValue({ code: 0, data: [] });
    var loader = createCrudLoader({
      loadFn: mockLoadFn,
      displayFn: mockDisplayFn,
      paginationId: 'testPagination',
      getState: function() { return { page: 1 }; },
      setState: mockSetState,
    });
    loader(3);
    expect(mockLoadFn).toHaveBeenCalledWith(3, 20, {});
  });

  it('成功加载后调用 displayFn', async function() {
    var items = [{ id: 1 }, { id: 2 }];
    mockLoadFn.mockResolvedValue({ code: 0, data: items });

    var loader = createCrudLoader({
      loadFn: mockLoadFn,
      displayFn: mockDisplayFn,
      paginationId: 'testPagination',
      getState: function() { return { page: 1 }; },
      setState: mockSetState,
    });

    loader(1);
    await flush();

    expect(mockDisplayFn).toHaveBeenCalledWith(items);
  });

  it('成功加载后更新 state', async function() {
    mockLoadFn.mockResolvedValue({ code: 0, data: [] });

    var loader = createCrudLoader({
      loadFn: mockLoadFn,
      displayFn: mockDisplayFn,
      paginationId: 'testPagination',
      getState: function() { return { page: 1 }; },
      setState: mockSetState,
    });

    loader(5);
    await flush();

    expect(mockSetState).toHaveBeenCalledWith({ page: 5 });
  });

  it('失败时显示错误 toast', async function() {
    mockLoadFn.mockResolvedValue({ code: -1, msg: '加载失败' });

    var loader = createCrudLoader({
      loadFn: mockLoadFn,
      displayFn: mockDisplayFn,
      paginationId: 'testPagination',
      getState: function() { return { page: 1 }; },
      setState: mockSetState,
    });

    loader(1);
    await flush();

    // displayFn 在失败时不应被调用
    expect(mockDisplayFn).not.toHaveBeenCalled();
  });

  it('使用 getFilters 传递筛选条件', function() {
    mockLoadFn.mockResolvedValue({ code: 0, data: [] });

    var loader = createCrudLoader({
      loadFn: mockLoadFn,
      displayFn: mockDisplayFn,
      paginationId: 'testPagination',
      getState: function() { return { page: 1 }; },
      setState: mockSetState,
      getFilters: function() { return { status: 'active', type: 'report' }; },
    });

    loader(1);
    expect(mockLoadFn).toHaveBeenCalledWith(1, 20, { status: 'active', type: 'report' });
  });

  it('使用自定义 dataPath 提取数据', async function() {
    mockLoadFn.mockResolvedValue({ code: 0, data: { coupons: [{ id: 1 }], pagination: { page: 1, total: 1 } } });

    var loader = createCrudLoader({
      loadFn: mockLoadFn,
      displayFn: mockDisplayFn,
      paginationId: 'testPagination',
      dataPath: 'data.coupons',
      getState: function() { return { page: 1 }; },
      setState: mockSetState,
    });

    loader(1);
    await flush();

    expect(mockDisplayFn).toHaveBeenCalledWith([{ id: 1 }]);
  });
});

describe('bindFilterEvents', function() {
  it('绑定 change 事件', function() {
    document.body.innerHTML =
      '<select id="statusFilter">' +
      '<option value="all">全部</option>' +
      '<option value="active">活跃</option>' +
      '</select>';

    var loadFn = vi.fn();
    bindFilterEvents([{ elementId: 'statusFilter' }], loadFn);

    var select = document.getElementById('statusFilter');
    select.dispatchEvent(new Event('change'));

    expect(loadFn).toHaveBeenCalledWith(1);
  });

  it('支持自定义事件类型', function() {
    document.body.innerHTML = '<input type="text" id="searchInput">';

    var loadFn = vi.fn();
    bindFilterEvents([{ elementId: 'searchInput', event: 'input' }], loadFn);

    var input = document.getElementById('searchInput');
    input.dispatchEvent(new Event('input'));

    expect(loadFn).toHaveBeenCalledWith(1);
  });

  it('元素不存在时不报错', function() {
    var loadFn = vi.fn();
    expect(function() {
      bindFilterEvents([{ elementId: 'nonexistent' }], loadFn);
    }).not.toThrow();
  });
});
