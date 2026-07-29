/**
 * generateDiaryShare — 生成日记分享海报（SVG → base64）
 * 复用 generateSharePoster 的 escapeHtml / base64 流程，新写 buildDiaryCardSvg。
 * SVG 为云函数生成的图片，不读 WXSS 变量，直接用品牌色值（#B35D3A 等）。
 */
const cloud = require('wx-server-sdk');
const { COLLECTIONS, RESPONSE_CODE, warmupConfig } = require('./common/constants');
const { createLogger } = require('./common/logger');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const logger = createLogger('generateDiaryShare');

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 日记文字按固定字数折行（SVG 无自动换行）
function wrapText(text, perLine, maxLines) {
  const cleaned = escapeHtml(text || '');
  const lines = [];
  for (let i = 0; i < cleaned.length; i += perLine) {
    lines.push(cleaned.substring(i, i + perLine));
  }
  return lines.slice(0, maxLines);
}

function buildDiaryCardSvg(params) {
  const petName = escapeHtml(params.petName || '毛孩子');
  const date = escapeHtml(params.dateText || '');
  const lines = wrapText(params.content, 13, 8);
  const tspans = lines
    .map(function (line, i) {
      return '<tspan x="60" dy="' + (i === 0 ? 0 : 48) + '">' + line + '</tspan>';
    })
    .join('');

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800">',
    '<rect width="600" height="800" fill="#FDFAF7"/>',
    '<rect x="0" y="0" width="600" height="12" fill="#B35D3A"/>',
    '<text x="60" y="110" fill="#B35D3A" font-size="36" font-weight="bold" font-family="sans-serif">' +
      petName +
      '的一天</text>',
    '<text x="60" y="150" fill="#8B8580" font-size="22" font-family="sans-serif">' + date + '</text>',
    '<text x="60" y="260" fill="#2D2A26" font-size="26" font-family="sans-serif">' + tspans + '</text>',
    '<line x1="60" y1="700" x2="540" y2="700" stroke="#E8E0D8" stroke-width="1"/>',
    '<text x="300" y="740" text-anchor="middle" fill="#B35D3A" font-size="20" font-family="sans-serif">Mewora · 毛孩子的每日日记</text>',
    '</svg>'
  ].join('\n');
}

exports.main = async (event, context) => {
  await warmupConfig(db);
  const { OPENID } = cloud.getWXContext();
  const { diary_id } = event;

  if (!OPENID) {
    return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '用户未登录', data: {} };
  }
  if (!diary_id) {
    return { code: RESPONSE_CODE.ERROR, msg: '缺少日记ID', data: {} };
  }

  try {
    const res = await db.collection(COLLECTIONS.PET_MOMENTS).doc(diary_id).get();
    const diary = res && res.data;
    if (!diary) {
      return { code: RESPONSE_CODE.NOT_FOUND, msg: '日记不存在', data: {} };
    }

    // 关联宠物名
    let petName = '毛孩子';
    if (diary.pet_id) {
      try {
        const petRes = await db.collection(COLLECTIONS.PETS).doc(diary.pet_id).get();
        if (petRes.data && petRes.data.name) petName = petRes.data.name;
      } catch (e) {
        /* 用默认名 */
      }
    }

    // 日期格式化（YYYY-MM-DD → X月X日）
    let dateText = '';
    if (diary.date) {
      const parts = String(diary.date).split('-');
      if (parts.length === 3) {
        dateText = parseInt(parts[1], 10) + '月' + parseInt(parts[2], 10) + '日';
      }
    }

    const svgContent = buildDiaryCardSvg({
      petName: petName,
      dateText: dateText,
      content: diary.content
    });
    const posterBase64 =
      'data:image/svg+xml;base64,' + Buffer.from(svgContent, 'utf-8').toString('base64');

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '海报生成成功',
      data: { posterBase64: posterBase64 }
    };
  } catch (err) {
    logger.error('generateDiaryShare 失败: ' + err.message);
    return { code: RESPONSE_CODE.SERVER_ERROR, msg: '海报生成失败', data: {} };
  }
};
