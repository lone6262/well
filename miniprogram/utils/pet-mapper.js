/**
 * 宠物数据映射工具
 * 统一处理云数据库返回的宠物数据到前端展示格式的映射
 */

/**
 * 映射单个宠物数据
 * @param {Object} pet - 云数据库返回的宠物对象
 * @returns {Object} 映射后的宠物对象
 */
function mapPetFromCloud(pet) {
  if (!pet || typeof pet !== 'object') {
    return null
  }

  // 标准化ID字段
  const id = pet._id || pet.petId || 'unknown'
  const petId = pet.petId || pet._id || id

  // 生成宠物编号（如果缺失）
  let petCode = pet.petCode
  if (!petCode) {
    const prefix = pet.type === 'cat' ? 'CAT' : 'DOG'
    petCode = `${prefix}-NEW`
  }

  // 生成显示用ID（截取前8位）
  const petIdDisplay = (petId || id).substring(0, 8)

  // 映射所有字段，提供默认值
  return {
    _id: id,
    petId: petId,
    petCode: petCode,
    petIdDisplay: petIdDisplay,
    name: pet.name || '未命名',
    type: pet.type || 'cat',
    breed: pet.breed || '',
    age: pet.age || '',
    weight: pet.weight || '',
    gender: pet.gender || 'male',
    vaccineDate: pet.vaccineDate || '',
    dewormDate: pet.dewormDate || '',
    avatar: pet.avatar || '',
    personalityTags: pet.personality_tags || pet.personalityTags || [],
    createdAt: pet.createdAt || '',
    updatedAt: pet.updatedAt || ''
  }
}

/**
 * 映射宠物列表数据
 * @param {Array} petList - 云数据库返回的宠物列表
 * @returns {Array} 映射后的宠物列表
 */
function mapPetListFromCloud(petList) {
  if (!Array.isArray(petList)) {
    return []
  }

  return petList
    .map(function(pet) {
      return mapPetFromCloud(pet)
    })
    .filter(function(pet) {
      return pet !== null
    })
}

module.exports = {
  mapPetFromCloud: mapPetFromCloud,
  mapPetListFromCloud: mapPetListFromCloud
}
