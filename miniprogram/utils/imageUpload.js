/**
 * 图片上传工具模块 - 安全验证和尺寸限制
 * 提供安全的图片上传功能，防止恶意文件注入
 */

const logger = require('./logger.js')
const log = logger.child('ImageUpload')

const IMAGE_CONFIG = {
  // 允许的图片格式
  ALLOWED_TYPES: ['jpg', 'jpeg', 'png', 'webp'],
  // 最大文件大小 (5MB)
  MAX_SIZE: 5 * 1024 * 1024,
  // 最小文件大小 (1KB，防止空文件)
  MIN_SIZE: 1024,
  // 最大尺寸
  MAX_DIMENSIONS: {
    width: 4096,
    height: 4096
  },
  // 最小尺寸 (防止过小图片)
  MIN_DIMENSIONS: {
    width: 100,
    height: 100
  },
  // 压缩质量
  COMPRESS_QUALITY: 80,
  // 云存储路径前缀
  CLOUD_PATH_PREFIX: 'pet-avatars/'
}

/**
 * 图片上传服务类
 */
class ImageUploadService {
  /**
   * 验证图片文件
   * @param {string} filePath - 本地文件路径
   * @returns {Promise<Object>} 验证结果
   */
  validateImage(filePath) {
    return new Promise((resolve, reject) => {
      // 获取文件信息
      wx.getImageInfo({
        src: filePath,
        success: (res) => {
          log.info('[INFO] 图片信息获取成功:', res)

          // 验证尺寸
          if (res.width < IMAGE_CONFIG.MIN_DIMENSIONS.width ||
              res.height < IMAGE_CONFIG.MIN_DIMENSIONS.height) {
            reject({
              code: 'INVALID_DIMENSIONS',
              message: `图片尺寸过小，最小要求 ${IMAGE_CONFIG.MIN_DIMENSIONS.width}x${IMAGE_CONFIG.MIN_DIMENSIONS.height}`
            })
            return
          }

          if (res.width > IMAGE_CONFIG.MAX_DIMENSIONS.width ||
              res.height > IMAGE_CONFIG.MAX_DIMENSIONS.height) {
            reject({
              code: 'INVALID_DIMENSIONS',
              message: `图片尺寸过大，最大支持 ${IMAGE_CONFIG.MAX_DIMENSIONS.width}x${IMAGE_CONFIG.MAX_DIMENSIONS.height}`
            })
            return
          }

          // 验证格式
          const format = res.type || res.path.split('.').pop().toLowerCase()
          if (!IMAGE_CONFIG.ALLOWED_TYPES.includes(format)) {
            reject({
              code: 'INVALID_FORMAT',
              message: `不支持的图片格式，仅支持: ${IMAGE_CONFIG.ALLOWED_TYPES.join(', ')}`
            })
            return
          }

          // 获取文件大小
          wx.getFileInfo({
            filePath: filePath,
            success: (fileInfo) => {
              log.info('[INFO] 文件大小:', fileInfo.size, 'bytes')

              // 验证文件大小
              if (fileInfo.size < IMAGE_CONFIG.MIN_SIZE) {
                reject({
                  code: 'FILE_TOO_SMALL',
                  message: `文件过小，最小 ${IMAGE_CONFIG.MIN_SIZE} bytes`
                })
                return
              }

              if (fileInfo.size > IMAGE_CONFIG.MAX_SIZE) {
                reject({
                  code: 'FILE_TOO_LARGE',
                  message: `文件过大，最大 ${IMAGE_CONFIG.MAX_SIZE / (1024 * 1024)}MB`
                })
                return
              }

              // 所有验证通过
              resolve({
                valid: true,
                width: res.width,
                height: res.height,
                format: format,
                size: fileInfo.size,
                path: res.path
              })
            },
            fail: (err) => {
              log.error('[FAIL] 获取文件信息失败:', err)
              reject({
                code: 'FILE_INFO_ERROR',
                message: '无法获取文件信息'
              })
            }
          })
        },
        fail: (err) => {
          log.error('[FAIL] 获取图片信息失败:', err)
          reject({
            code: 'IMAGE_INFO_ERROR',
            message: '无法读取图片信息'
          })
        }
      })
    })
  }

  /**
   * 压缩图片
   * @param {string} filePath - 原图片路径
   * @param {number} quality - 压缩质量 (0-100)
   * @returns {Promise<string>} 压缩后的图片路径
   */
  compressImage(filePath, quality = IMAGE_CONFIG.COMPRESS_QUALITY) {
    return new Promise((resolve, reject) => {
      wx.compressImage({
        src: filePath,
        quality: quality,
        success: (res) => {
          log.info('[OK] 图片压缩成功:', res)
          resolve(res.tempFilePath)
        },
        fail: (err) => {
          log.error('[FAIL] 图片压缩失败:', err)
          // 压缩失败，返回原图
          resolve(filePath)
        }
      })
    })
  }

  /**
   * 上传图片到云存储
   * @param {string} filePath - 本地文件路径
   * @param {string} petId - 宠物ID
   * @returns {Promise<string>} 云存储URL
   */
  uploadToCloud(filePath, petId) {
    return new Promise((resolve, reject) => {
      // 生成云存储路径
      const cloudPath = `${IMAGE_CONFIG.CLOUD_PATH_PREFIX}${petId}_${Date.now()}.jpg`

      log.info('[INFO] 开始上传到云存储:', cloudPath)

      wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: filePath,
        success: (res) => {
          log.info('[OK] 云存储上传成功:', res)
          resolve(res.fileID)
        },
        fail: (err) => {
          log.error('[FAIL] 云存储上传失败:', err)
          reject({
            code: 'CLOUD_UPLOAD_ERROR',
            message: '云存储上传失败'
          })
        }
      })
    })
  }

  /**
   * 完整的图片上传流程
   * @param {string} filePath - 本地文件路径
   * @param {string} petId - 宠物ID
   * @returns {Promise<string>} 云存储URL
   */
  async uploadImage(filePath, petId) {
    try {
      // 1. 验证图片
      log.info('[INFO] 开始验证图片...')
      const validationResult = await this.validateImage(filePath)
      log.info('[OK] 图片验证通过:', validationResult)

      // 2. 压缩图片
      log.info('[INFO] 开始压缩图片...')
      const compressedPath = await this.compressImage(filePath, IMAGE_CONFIG.COMPRESS_QUALITY)
      log.info('[OK] 图片压缩完成')

      // 3. 上传到云存储
      log.info('[INFO] 开始上传到云存储...')
      const cloudURL = await this.uploadToCloud(compressedPath, petId)
      log.info('[OK] 图片上传完成:', cloudURL)

      return cloudURL
    } catch (error) {
      log.error('[FAIL] 图片上传失败:', error)
      throw error
    }
  }

  /**
   * 选择图片并上传
   * @param {string} petId - 宠物ID
   * @returns {Promise<string>} 云存储URL
   */
  async selectAndUpload(petId) {
    // 先检查隐私授权状态（微信要求调用敏感接口前必须确认用户已同意隐私协议）
    const privacySetting = await new Promise((resolve) => {
      wx.getPrivacySetting({
        success: (res) => resolve({ needAuthorization: res.needAuthorization, privacyContractName: res.privacyContractName }),
        fail: () => resolve({ needAuthorization: false })
      })
    })

    log.info('[Privacy] 隐私授权状态:', privacySetting)

    if (privacySetting.needAuthorization) {
      // 需要用户同意隐私协议
      const authorized = await new Promise((resolve) => {
        wx.requirePrivacyAuthorize({
          success: () => {
            log.info('[Privacy] 用户同意隐私协议')
            resolve(true)
          },
          fail: (err) => {
            log.warn('[Privacy] 用户拒绝或取消隐私协议:', err)
            resolve(false)
          }
        })
      })

      if (!authorized) {
        return Promise.reject({
          code: 'PRIVACY_DENIED',
          message: '需要同意隐私保护指引才能选择图片'
        })
      }
    }

    return new Promise((resolve, reject) => {
      wx.chooseImage({
        count: 1,
        sizeType: ['compressed'], // 优先选择压缩图
        sourceType: ['album', 'camera'],
        success: async (res) => {
          const filePath = res.tempFilePaths[0]
          log.info('[INFO] 用户选择图片:', filePath)

          try {
            const cloudURL = await this.uploadImage(filePath, petId)
            resolve(cloudURL)
          } catch (error) {
            reject(error)
          }
        },
        fail: (err) => {
          log.error('[FAIL] 选择图片失败:', err)
          reject({
            code: 'CHOOSE_IMAGE_ERROR',
            message: '选择图片失败'
          })
        }
      })
    })
  }

  /**
   * 删除云存储中的图片
   * @param {string} fileID - 云存储文件ID
   * @returns {Promise<void>}
   */
  deleteFromCloud(fileID) {
    return new Promise((resolve, reject) => {
      wx.cloud.deleteFile({
        fileList: [fileID],
        success: (res) => {
          log.info('[OK] 云存储文件删除成功:', res)
          resolve()
        },
        fail: (err) => {
          log.error('[FAIL] 云存储文件删除失败:', err)
          reject(err)
        }
      })
    })
  }
}

// 创建单例
const imageUploadService = new ImageUploadService()

module.exports = imageUploadService