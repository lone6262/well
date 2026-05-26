// 腾讯地图API功能测试脚本
// 此文件用于验证地图API集成的完整性

const MAP_CONFIG = require('./miniprogram/utils/mapConfig.js')

console.log('=== 腾讯地图API功能测试开始 ===\n')

// 测试1：验证API密钥配置
console.log('🔍 测试1：验证API密钥配置')
console.log('API密钥:', MAP_CONFIG.key)
if (MAP_CONFIG.key === 'YOUR_TENCENT_MAP_KEY') {
  console.log('❌ API密钥未配置')
} else if (MAP_CONFIG.key.startsWith('FVZBZ-') || MAP_CONFIG.key.startsWith('OB4BZ-')) {
  console.log('✅ API密钥已正确配置')
} else {
  console.log('⚠️ API密钥格式可能不正确')
}

console.log('\n默认中心坐标:', MAP_CONFIG.defaultCenter)
console.log('搜索配置:', MAP_CONFIG.searchOptions)

// 测试2：验证地图服务模块
console.log('\n🔍 测试2：验证地图服务模块')
try {
  const mapService = require('./miniprogram/utils/mapService.js')
  console.log('✅ 地图服务模块加载成功')
  console.log('服务类方法:', Object.getOwnPropertyNames(Object.getPrototypeOf(mapService)))
} catch (error) {
  console.log('❌ 地图服务模块加载失败:', error.message)
}

// 测试3：验证页面集成
console.log('\n🔍 测试3：验证页面集成')
const fs = require('fs')

// 检查急救页面
try {
  const emergencyPage = fs.readFileSync('./miniprogram/pages/emergency/index.js', 'utf8')
  if (emergencyPage.includes("require('../../utils/mapService.js')")) {
    console.log('✅ 急救页面已集成地图服务')
  } else {
    console.log('❌ 急救页面未正确集成地图服务')
  }

  if (emergencyPage.includes('createMapMarkers')) {
    console.log('✅ 急救页面支持地图标记功能')
  } else {
    console.log('❌ 急救页面缺少地图标记功能')
  }
} catch (error) {
  console.log('❌ 急救页面检查失败:', error.message)
}

// 检查医院列表页面
try {
  const hospitalPage = fs.readFileSync('./miniprogram/pages/hospital/list.js', 'utf8')
  if (hospitalPage.includes("require('../../utils/mapService.js')")) {
    console.log('✅ 医院列表页面已集成地图服务')
  } else {
    console.log('❌ 医院列表页面未正确集成地图服务')
  }
} catch (error) {
  console.log('❌ 医院列表页面检查失败:', error.message)
}

// 测试4：验证地图组件配置
console.log('\n🔍 测试4：验证地图组件配置')
try {
  const emergencyWxml = fs.readFileSync('./miniprogram/pages/emergency/index.wxml', 'utf8')
  if (emergencyWxml.includes('<map')) {
    console.log('✅ 急救页面包含地图组件')
  } else {
    console.log('❌ 急救页面缺少地图组件')
  }

  if (emergencyWxml.includes('markers')) {
    console.log('✅ 地图组件配置了标记点')
  } else {
    console.log('❌ 地图组件缺少标记点配置')
  }
} catch (error) {
  console.log('❌ 地图组件检查失败:', error.message)
}

// 测试5：验证权限配置
console.log('\n🔍 测试5：验证小程序权限配置')
try {
  const appJson = JSON.parse(fs.readFileSync('./miniprogram/app.json', 'utf8'))
  if (appJson.permission && appJson.permission.scope.userLocation) {
    console.log('✅ 小程序已配置位置权限')
  } else {
    console.log('❌ 小程序未配置位置权限')
  }

  if (appJson.requiredPrivateInfos && appJson.requiredPrivateInfos.includes('getLocation')) {
    console.log('✅ 小程序已配置位置隐私协议')
  } else {
    console.log('❌ 小程序未配置位置隐私协议')
  }
} catch (error) {
  console.log('❌ 权限配置检查失败:', error.message)
}

console.log('\n=== 腾讯地图API功能测试完成 ===')
console.log('\n📋 测试总结：')
console.log('- 如果所有测试显示✅，说明地图API集成完整')
console.log('- 如果有❌显示，请检查对应的功能模块')
console.log('- 配置完成后，请在微信开发者工具中重新编译项目')

module.exports = {
  testResults: '测试完成，请查看控制台输出'
}