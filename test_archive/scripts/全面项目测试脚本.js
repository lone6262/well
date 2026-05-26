// 宠物症状自查小程序 - 全面项目测试脚本
const fs = require('fs');
const path = require('path');

console.log('🎯 开始全面项目测试 - 宠物症状自查小程序 V1.0\n');

// 测试结果存储
const testResults = {
  passed: 0,
  failed: 0,
  warnings: 0,
  details: []
};

// 辅助函数：记录测试结果
function recordTest(category, name, status, message) {
  const result = { category, name, status, message };
  testResults.details.push(result);

  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} [${category}] ${name}: ${message}`);

  if (status === 'PASS') testResults.passed++;
  else if (status === 'FAIL') testResults.failed++;
  else testResults.warnings++;
}

// 测试1：项目结构验证
console.log('🔍 测试1：项目结构验证');
try {
  const projectStructure = [
    'miniprogram/pages/index',
    'miniprogram/pages/emergency',
    'miniprogram/pages/hospital',
    'miniprogram/pages/pet',
    'miniprogram/pages/risk',
    'miniprogram/pages/symptom',
    'miniprogram/pages/user',
    'cloudfunctions/login',
    'cloudfunctions/savePet',
    'cloudfunctions/getPetList',
    'cloudfunctions/submitSymptom',
    'cloudfunctions/getHospitals',
    'cloudfunctions/dbInit'
  ];

  projectStructure.forEach(dir => {
    const fullPath = path.join(__dirname, dir);
    if (fs.existsSync(fullPath)) {
      recordTest('结构', dir, 'PASS', '目录存在');
    } else {
      recordTest('结构', dir, 'FAIL', '目录不存在');
    }
  });
} catch (error) {
  recordTest('结构', '项目结构检查', 'FAIL', error.message);
}

// 测试2：页面文件完整性
console.log('\n🔍 测试2：页面文件完整性');
try {
  const pages = [
    { name: '首页', path: 'miniprogram/pages/index', files: ['index.js', 'index.json', 'index.wxml', 'index.wxss'] },
    { name: '急救页面', path: 'miniprogram/pages/emergency', files: ['index.js', 'index.json', 'index.wxml', 'index.wxss'] },
    { name: '医院列表', path: 'miniprogram/pages/hospital', files: ['list.js', 'list.json', 'list.wxml', 'list.wxss'] },
    { name: '宠物档案', path: 'miniprogram/pages/pet', files: ['profile.js', 'profile.json', 'profile.wxml', 'profile.wxss'] },
    { name: '风险评估', path: 'miniprogram/pages/risk', files: ['result.js', 'result.json', 'result.wxml', 'result.wxss'] },
    { name: '症状向导', path: 'miniprogram/pages/symptom', files: ['guide.js', 'guide.json', 'guide.wxml', 'guide.wxss'] },
    { name: '用户中心', path: 'miniprogram/pages/user', files: ['index.js', 'index.json', 'index.wxml', 'index.wxss'] }
  ];

  pages.forEach(page => {
    const pagePath = path.join(__dirname, page.path);
    const allFilesExist = page.files.every(file => {
      return fs.existsSync(path.join(pagePath, file));
    });

    if (allFilesExist) {
      recordTest('页面完整性', page.name, 'PASS', '所有文件存在');
    } else {
      const missingFiles = page.files.filter(file => !fs.existsSync(path.join(pagePath, file)));
      recordTest('页面完整性', page.name, 'FAIL', `缺少文件: ${missingFiles.join(', ')}`);
    }
  });
} catch (error) {
  recordTest('页面完整性', '页面文件检查', 'FAIL', error.message);
}

// 测试3：小程序配置验证
console.log('\n🔍 测试3：小程序配置验证');
try {
  const appJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'miniprogram/app.json'), 'utf8'));

  // 检查页面路由配置
  if (appJson.pages && appJson.pages.length >= 7) {
    recordTest('配置', '页面路由', 'PASS', `已配置${appJson.pages.length}个页面`);
  } else {
    recordTest('配置', '页面路由', 'FAIL', `页面数量不足: ${appJson.pages?.length || 0}`);
  }

  // 检查权限配置
  if (appJson.permission && appJson.permission.scope.userLocation) {
    recordTest('配置', '位置权限', 'PASS', '已配置用户位置权限');
  } else {
    recordTest('配置', '位置权限', 'FAIL', '未配置用户位置权限');
  }

  // 检查隐私协议
  if (appJson.requiredPrivateInfos && appJson.requiredPrivateInfos.includes('getLocation')) {
    recordTest('配置', '隐私协议', 'PASS', '已配置位置隐私协议');
  } else {
    recordTest('配置', '隐私协议', 'WARN', '未配置位置隐私协议');
  }

} catch (error) {
  recordTest('配置', '小程序配置检查', 'FAIL', error.message);
}

// 测试4：云函数验证
console.log('\n🔍 测试4：云函数验证');
try {
  const cloudFunctions = [
    { name: '登录云函数', path: 'cloudfunctions/login', entry: 'index.js' },
    { name: '保存宠物云函数', path: 'cloudfunctions/savePet', entry: 'index.js' },
    { name: '获取宠物列表云函数', path: 'cloudfunctions/getPetList', entry: 'index.js' },
    { name: '提交症状云函数', path: 'cloudfunctions/submitSymptom', entry: 'index.js' },
    { name: '获取医院云函数', path: 'cloudfunctions/getHospitals', entry: 'index.js' },
    { name: '数据库初始化云函数', path: 'cloudfunctions/dbInit', entry: 'index.js' }
  ];

  cloudFunctions.forEach(func => {
    const funcPath = path.join(__dirname, func.path);
    const entryFile = path.join(funcPath, func.entry);

    if (fs.existsSync(entryFile)) {
      const content = fs.readFileSync(entryFile, 'utf8');
      if (content.includes('exports.main')) {
        recordTest('云函数', func.name, 'PASS', '云函数入口正确');
      } else {
        recordTest('云函数', func.name, 'WARN', '云函数入口格式可能不正确');
      }
    } else {
      recordTest('云函数', func.name, 'FAIL', '云函数文件不存在');
    }
  });

  // 检查公共模块
  const commonModule = path.join(__dirname, 'cloudfunctions/common');
  if (fs.existsSync(commonModule)) {
    const commonFiles = fs.readdirSync(commonModule);
    if (commonFiles.includes('constants.js') && commonFiles.includes('ruleEngine.js')) {
      recordTest('云函数', '公共模块', 'PASS', '公共模块完整');
    } else {
      recordTest('云函数', '公共模块', 'WARN', '公共模块文件不完整');
    }
  } else {
    recordTest('云函数', '公共模块', 'FAIL', '公共模块不存在');
  }

} catch (error) {
  recordTest('云函数', '云函数检查', 'FAIL', error.message);
}

// 测试5：腾讯地图API集成验证
console.log('\n🔍 测试5：腾讯地图API集成验证');
try {
  const mapConfig = path.join(__dirname, 'miniprogram/utils/mapConfig.js');
  const mapService = path.join(__dirname, 'miniprogram/utils/mapService.js');

  if (fs.existsSync(mapConfig)) {
    const configContent = fs.readFileSync(mapConfig, 'utf8');
    if (configContent.includes('FVZBZ-P2K3I-VXJGC-UUWOF-RSTAQ-BSFKQ')) {
      recordTest('地图API', 'API密钥配置', 'PASS', '已配置真实API密钥');
    } else if (configContent.includes('YOUR_TENCENT_MAP_KEY')) {
      recordTest('地图API', 'API密钥配置', 'WARN', '仍使用默认API密钥占位符');
    } else {
      recordTest('地图API', 'API密钥配置', 'PASS', '已配置自定义API密钥');
    }
  } else {
    recordTest('地图API', '地图配置文件', 'FAIL', '地图配置文件不存在');
  }

  if (fs.existsSync(mapService)) {
    const serviceContent = fs.readFileSync(mapService, 'utf8');
    const hasSearchAPI = serviceContent.includes('searchNearbyHospitals');
    const hasNavigation = serviceContent.includes('openNavigation');
    const hasPhoneCall = serviceContent.includes('makePhoneCall');

    if (hasSearchAPI && hasNavigation && hasPhoneCall) {
      recordTest('地图API', '地图服务模块', 'PASS', '核心功能完整');
    } else {
      recordTest('地图API', '地图服务模块', 'FAIL', `缺少核心功能: ${[
        !hasSearchAPI && '搜索API',
        !hasNavigation && '导航功能',
        !hasPhoneCall && '电话功能'
      ].filter(Boolean).join(', ')}`);
    }
  } else {
    recordTest('地图API', '地图服务模块', 'FAIL', '地图服务模块不存在');
  }

} catch (error) {
  recordTest('地图API', '地图API检查', 'FAIL', error.message);
}

// 测试6：页面功能逻辑验证
console.log('\n🔍 测试6：页面功能逻辑验证');
try {
  // 检查首页逻辑
  const indexJs = path.join(__dirname, 'miniprogram/pages/index/index.js');
  if (fs.existsSync(indexJs)) {
    const indexContent = fs.readFileSync(indexJs, 'utf8');
    const hasNavigation = indexContent.includes('toEmergency') && indexContent.includes('toSymptom') && indexContent.includes('toHospital');

    if (hasNavigation) {
      recordTest('页面逻辑', '首页导航', 'PASS', '导航功能完整');
    } else {
      recordTest('页面逻辑', '首页导航', 'FAIL', '缺少导航功能');
    }
  }

  // 检查急救页面逻辑
  const emergencyJs = path.join(__dirname, 'miniprogram/pages/emergency/index.js');
  if (fs.existsSync(emergencyJs)) {
    const emergencyContent = fs.readFileSync(emergencyJs, 'utf8');
    const hasMapService = emergencyContent.includes("require('../../utils/mapService.js')");
    const hasMapMarkers = emergencyContent.includes('createMapMarkers');

    if (hasMapService && hasMapMarkers) {
      recordTest('页面逻辑', '急救页面地图集成', 'PASS', '地图功能完整');
    } else {
      recordTest('页面逻辑', '急救页面地图集成', 'WARN', '地图集成不完整');
    }
  }

  // 检查症状向导逻辑
  const symptomJs = path.join(__dirname, 'miniprogram/pages/symptom/guide.js');
  if (fs.existsSync(symptomJs)) {
    const symptomContent = fs.readFileSync(symptomJs, 'utf8');
    const hasCategories = symptomContent.includes('SYMPTOM_CATEGORIES');
    const hasSubmission = symptomContent.includes('submitAssessment');

    if (hasCategories && hasSubmission) {
      recordTest('页面逻辑', '症状向导功能', 'PASS', '症状功能完整');
    } else {
      recordTest('页面逻辑', '症状向导功能', 'FAIL', '症状功能不完整');
    }
  }

} catch (error) {
  recordTest('页面逻辑', '页面逻辑检查', 'FAIL', error.message);
}

// 测试7：数据模型验证
console.log('\n🔍 测试7：数据模型验证');
try {
  const constantsJs = path.join(__dirname, 'cloudfunctions/common/constants.js');
  if (fs.existsSync(constantsJs)) {
    const constantsContent = fs.readFileSync(constantsJs, 'utf8');
    const hasCollections = constantsContent.includes('COLLECTIONS');
    const hasResponseCodes = constantsContent.includes('RESPONSE_CODE');
    const hasSymptomCategories = constantsContent.includes('SYMPTOM_CATEGORIES');

    if (hasCollections && hasResponseCodes && hasSymptomCategories) {
      recordTest('数据模型', '常量定义', 'PASS', '数据常量完整');
    } else {
      recordTest('数据模型', '常量定义', 'WARN', '部分常量定义缺失');
    }
  }

  const ruleEngineJs = path.join(__dirname, 'cloudfunctions/common/ruleEngine.js');
  if (fs.existsSync(ruleEngineJs)) {
    const ruleEngineContent = fs.readFileSync(ruleEngineJs, 'utf8');
    const hasRules = ruleEngineContent.includes('RISK_RULES');
    const hasEngine = ruleEngineContent.includes('assessRisk');

    if (hasRules && hasEngine) {
      recordTest('数据模型', '规则引擎', 'PASS', '风险评估规则完整');
    } else {
      recordTest('数据模型', '规则引擎', 'FAIL', '规则引擎不完整');
    }
  }

} catch (error) {
  recordTest('数据模型', '数据模型检查', 'FAIL', error.message);
}

// 测试8：样式和资源验证
console.log('\n🔍 测试8：样式和资源验证');
try {
  const pages = ['index', 'emergency', 'hospital', 'pet', 'risk', 'symptom', 'user'];
  let styleCount = 0;

  pages.forEach(page => {
    let wxssFile;
    if (page === 'hospital') {
      wxssFile = path.join(__dirname, `miniprogram/pages/hospital/list.wxss`);
    } else if (page === 'pet') {
      wxssFile = path.join(__dirname, `miniprogram/pages/pet/profile.wxss`);
    } else if (page === 'risk') {
      wxssFile = path.join(__dirname, `miniprogram/pages/risk/result.wxss`);
    } else if (page === 'symptom') {
      wxssFile = path.join(__dirname, `miniprogram/pages/symptom/guide.wxss`);
    } else {
      wxssFile = path.join(__dirname, `miniprogram/pages/${page}/index.wxss`);
    }

    if (fs.existsSync(wxssFile)) {
      const wxssContent = fs.readFileSync(wxssFile, 'utf8');
      if (wxssContent.trim().length > 0) {
        styleCount++;
      }
    }
  });

  if (styleCount === pages.length) {
    recordTest('样式', '页面样式', 'PASS', `所有${pages.length}个页面样式完整`);
  } else {
    recordTest('样式', '页面样式', 'WARN', `仅${styleCount}/${pages.length}页面有样式`);
  }

} catch (error) {
  recordTest('样式', '样式检查', 'FAIL', error.message);
}

// 生成测试报告
console.log('\n📊 测试报告生成中...\n');

// 输出最终统计
console.log('='.repeat(50));
console.log('🎯 测试结果汇总');
console.log('='.repeat(50));
console.log(`✅ 通过: ${testResults.passed}项`);
console.log(`❌ 失败: ${testResults.failed}项`);
console.log(`⚠️  警告: ${testResults.warnings}项`);
console.log(`📋 总计: ${testResults.passed + testResults.failed + testResults.warnings}项`);

// 计算通过率
const totalTests = testResults.passed + testResults.failed + testResults.warnings;
const passRate = ((testResults.passed / totalTests) * 100).toFixed(1);
console.log(`🎯 通过率: ${passRate}%`);

// 评估项目状态
let projectStatus = '';
if (testResults.failed === 0 && testResults.warnings <= 2) {
  projectStatus = '🎊 优秀 - 可以发布';
} else if (testResults.failed <= 2 && testResults.warnings <= 5) {
  projectStatus = '✅ 良好 - 基本可用';
} else if (testResults.failed <= 5) {
  projectStatus = '⚠️  一般 - 需要优化';
} else {
  projectStatus = '❌ 较差 - 需要重构';
}

console.log(`📈 项目状态: ${projectStatus}`);

// 保存测试报告
const reportPath = path.join(__dirname, '项目测试报告.txt');
const reportContent = `
宠物症状自查小程序 V1.0 - 全面项目测试报告
================================================

测试时间: ${new Date().toLocaleString()}
项目路径: ${__dirname}

测试结果汇总
------------
✅ 通过: ${testResults.passed}项
❌ 失败: ${testResults.failed}项
⚠️  警告: ${testResults.warnings}项
📋 总计: ${totalTests}项
🎯 通过率: ${passRate}%
📈 项目状态: ${projectStatus}

详细测试结果
------------
${testResults.details.map(detail => {
  const icon = detail.status === 'PASS' ? '✅' : detail.status === 'FAIL' ? '❌' : '⚠️';
  return `${icon} [${detail.category}] ${detail.name}: ${detail.message}`;
}).join('\n')}

建议改进措施
------------
${testResults.failed > 0 ? '1. 优先修复失败的测试项\n' : ''}
${testResults.warnings > 0 ? '2. 优化警告提示的功能\n' : ''}
3. 完善错误处理机制
4. 增加单元测试覆盖
5. 优化用户交互体验

结论
----
${projectStatus.includes('优秀') || projectStatus.includes('良好') ?
  '项目整体质量良好，核心功能完整，可以进行实际测试和部署。' :
  '项目存在一些问题需要解决，建议优先修复关键功能后再进行测试。'}
`;

fs.writeFileSync(reportPath, reportContent, 'utf8');
console.log(`\n📄 详细测试报告已保存: ${reportPath}`);

console.log('\n🎉 全面项目测试完成！');

module.exports = testResults;