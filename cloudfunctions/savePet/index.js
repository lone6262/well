// 云函数入口文件
const cloud = require('wx-server-sdk');
const { PET_TYPES, COLLECTIONS, RESPONSE_CODE } = require('./constants');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

/**
 * 保存宠物信息（添加或编辑）
 */
exports.main = async (event, context) => {
  const {
    openid,
    petId,
    name,
    type,
    breed,
    age,
    weight,
    gender = 'male',
    vaccineDate = '',
    dewormDate = '',
    avatar = ''
  } = event;

  try {
    // 1. 参数校验
    if (!openid) {
      return {
        code: RESPONSE_CODE.UNAUTHORIZED,
        msg: '用户未登录',
        data: {}
      };
    }

    if (!name) {
      return {
        code: RESPONSE_CODE.ERROR,
        msg: '请填写宠物昵称',
        data: {}
      };
    }

    if (!type || !Object.values(PET_TYPES).includes(type)) {
      return {
        code: RESPONSE_CODE.ERROR,
        msg: '请选择宠物类型',
        data: {}
      };
    }

    if (!age || age <= 0) {
      return {
        code: RESPONSE_CODE.ERROR,
        msg: '请填写正确的年龄',
        data: {}
      };
    }

    const petData = {
      name: name.trim(),
      type: type,
      breed: breed ? breed.trim() : '未知',
      age: parseInt(age),
      weight: weight ? parseFloat(weight) : null,
      gender: gender || 'male',
      vaccine_date: vaccineDate || null,
      deworm_date: dewormDate || null,
      avatar: avatar || '', // 新增头像字段
      updated_at: new Date()
    };

    if (petId) {
      // 2. 编辑宠物信息（统一使用_id查询）
      const petResult = await db.collection(COLLECTIONS.PETS).doc(petId).get();
      if (!petResult.data) {
        return {
          code: RESPONSE_CODE.NOT_FOUND,
          msg: '宠物信息不存在',
          data: {}
        };
      }

      // 验证宠物是否属于当前用户
      if (petResult.data.user_id !== openid) {
        return {
          code: RESPONSE_CODE.UNAUTHORIZED,
          msg: '无权操作此宠物信息',
          data: {}
        };
      }

      // 更新宠物信息
      await db.collection(COLLECTIONS.PETS).doc(petId).update({
        data: petData
      });

      return {
        code: RESPONSE_CODE.SUCCESS,
        msg: '宠物信息更新成功',
        data: {
          _id: petId,
          ...petData
        }
      };

    } else {
      // 3. 添加新宠物
      // 生成宠物编号：CAT-001, DOG-001 ...
      const typePrefix = type === 'cat' ? 'CAT' : 'DOG';
      const maxResult = await db.collection(COLLECTIONS.PETS)
        .where({
          petCode: db.RegExp({
            regexp: '^' + typePrefix + '-\\d{3}$',
            options: ''
          })
        })
        .orderBy('petCode', 'desc')
        .limit(1)
        .get();
      
      let nextNum = 1;
      if (maxResult.data.length > 0) {
        const lastCode = maxResult.data[0].petCode;
        const lastNum = parseInt(lastCode.split('-')[1]);
        nextNum = lastNum + 1;
      }
      const petCode = typePrefix + '-' + String(nextNum).padStart(3, '0');
      
      const newPetData = {
        user_id: openid,
        created_at: new Date(),
        petCode: petCode,
        ...petData
      };

      const insertResult = await db.collection(COLLECTIONS.PETS).add({
        data: newPetData
      });

      return {
        code: RESPONSE_CODE.SUCCESS,
        msg: '宠物添加成功',
        data: {
          _id: insertResult._id,
          ...newPetData
        }
      };
    }

  } catch (error) {
    console.error('保存宠物信息失败:', error);
    return {
      code: RESPONSE_CODE.SERVER_ERROR,
      msg: '服务器错误，请稍后重试',
      data: {
        error: error.message
      }
    };
  }
};