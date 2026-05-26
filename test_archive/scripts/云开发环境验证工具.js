/**
 * 云开发环境验证工具
 * 使用方法：将此文件复制到微信开发者工具控制台运行
 */

// 云开发环境验证器
const CloudEnvValidator = {
  // 验证环境ID
  async validateEnvId(envId) {
    console.log(`🔍 开始验证云环境: ${envId}`)

    if (!envId || envId.trim() === '') {
      return {
        success: false,
        error: '环境ID为空，请配置有效的环境ID'
      }
    }

    // 检查环境ID格式
    const envIdPattern = /^[a-zA-Z0-9\-]+$/
    if (!envIdPattern.test(envId)) {
      return {
        success: false,
        error: '环境ID格式无效，应只包含字母、数字和连字符'
      }
    }

    try {
      // 尝试初始化云开发
      const result = await this.testCloudInit(envId)
      return result
    } catch (error) {
      return {
        success: false,
        error: `验证过程异常: ${error.message}`
      }
    }
  },

  // 测试云开发初始化
  testCloudInit(envId) {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({
          success: false,
          error: '连接超时（10秒），请检查网络或环境ID'
        })
      }, 10000)

      try {
        wx.cloud.init({
          env: envId,
          traceUser: true,
          success: () => {
            clearTimeout(timeout)
            console.log('✅ 云开发初始化成功')

            // 进一步测试数据库连接
            this.testDatabase(envId)
              .then(dbResult => {
                resolve({
                  success: true,
                  message: '云开发环境正常',
                  details: {
                    envId: envId,
                    database: dbResult.success ? '正常' : '异常',
                    details: dbResult
                  }
                })
              })
              .catch(dbError => {
                resolve({
                  success: true,
                  message: '云开发基础功能正常，但数据库测试失败',
                  details: {
                    envId: envId,
                    database: '异常',
                    error: dbError.message
                  }
                })
              })
          },
          fail: (err) => {
            clearTimeout(timeout)
            const errorMsg = this.parseErrorMessage(err)
            console.error('❌ 云开发初始化失败:', errorMsg)

            resolve({
              success: false,
              error: errorMsg,
              suggestion: this.getSuggestion(err)
            })
          }
        })
      } catch (error) {
        clearTimeout(timeout)
        resolve({
          success: false,
          error: `初始化异常: ${error.message}`
        })
      }
    })
  },

  // 测试数据库连接
  async testDatabase(envId) {
    return new Promise((resolve) => {
      const db = wx.cloud.database({
        env: envId
      })

      // 尝试查询集合列表
      db.listCollections({
        success: (res) => {
          console.log('✅ 数据库连接正常，集合列表:', res.collections)
          resolve({
            success: true,
            collections: res.collections
          })
        },
        fail: (err) => {
          console.warn('⚠️ 数据库查询失败:', err)
          // 数据库查询失败不影响云开发基础功能
          resolve({
            success: false,
            error: err.errMsg || '数据库连接失败'
          })
        }
      })
    })
  },

  // 解析错误信息
  parseErrorMessage(err) {
    const errMsg = err.errMsg || JSON.stringify(err)

    if (errMsg.includes('env:not exist') || errMsg.includes('环境不存在')) {
      return '云环境ID不存在，请检查环境ID是否正确'
    } else if (errMsg.includes('permission') || errMsg.includes('权限')) {
      return '权限不足，请确认AppID是否匹配'
    } else if (errMsg.includes('network') || errMsg.includes('网络')) {
      return '网络连接失败，请检查网络设置'
    } else {
      return `连接失败: ${errMsg}`
    }
  },

  // 获取建议
  getSuggestion(err) {
    const errMsg = err.errMsg || ''

    if (errMsg.includes('env:not exist')) {
      return '建议：1. 检查环境ID拼写 2. 在云开发控制台确认环境存在'
    } else if (errMsg.includes('permission')) {
      return '建议：1. 确认项目AppID 2. 检查云开发权限设置'
    } else {
      return '建议：检查网络连接，稍后重试'
    }
  }
}

// ==================== 使用方法 ====================

// 方法1：验证当前项目配置
async function validateCurrentConfig() {
  const app = getApp()
  const currentEnvId = app.globalData?.env

  console.log('📋 当前配置的环境ID:', currentEnvId)

  const result = await CloudEnvValidator.validateEnvId(currentEnvId)

  if (result.success) {
    console.log('🎉 验证通过!')
    console.log('详细信息:', result.details)
  } else {
    console.error('❌ 验证失败:', result.error)
    if (result.suggestion) {
      console.log('💡 建议:', result.suggestion)
    }
  }

  return result
}

// 方法2：验证指定的环境ID
async function validateCustomEnvId(envId) {
  console.log('📋 测试环境ID:', envId)

  const result = await CloudEnvValidator.validateEnvId(envId)

  if (result.success) {
    console.log('🎉 环境ID有效!')
    console.log('详细信息:', result.details)
  } else {
    console.error('❌ 环境ID无效:', result.error)
    if (result.suggestion) {
      console.log('💡 建议:', result.suggestion)
    }
  }

  return result
}

// 方法3：快速测试
function quickTest() {
  const app = getApp()
  const envId = app.globalData?.env || "cloud1-d8gdi44zqfec250b"

  console.log('🚀 快速测试云环境:', envId)
  validateCustomEnvId(envId)
}

// ==================== 执行验证 ====================

// 自动执行当前配置验证
console.log('🌤️ 云开发环境验证工具启动')
console.log('📖 使用方法：')
console.log('  - validateCurrentConfig()  验证当前项目配置')
console.log('  - validateCustomEnvId("环境ID")  验证指定环境ID')
console.log('  - quickTest()  快速测试')
console.log('')

// 自动运行当前配置验证
setTimeout(() => {
  console.log('🔄 自动验证当前配置...')
  validateCurrentConfig()
}, 1000)