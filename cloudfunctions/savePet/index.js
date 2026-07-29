// 云函数入口文件
const cloud = require('wx-server-sdk');
const { PET_TYPES, COLLECTIONS, RESPONSE_CODE, MEMBER_LIMITS, MEMBER_STATUS, warmupConfig } = require('./common/constants');
const { verifyToken } = require('./common/auth');
const { checkRateLimit } = require('./common/rate-limiter');
const { createLogger } = require('./common/logger');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const logger = createLogger('savePet');

/**
 * 保存宠物信息（添加或编辑）
 */
exports.main = async (event, context) => {
  await warmupConfig(db);
  const { OPENID } = cloud.getWXContext();
  const openid = OPENID;

  const {
    petId,
    name,
    type,
    breed,
    age,
    weight,
    gender = 'male',
    vaccineDate = '',
    dewormDate = '',
    avatar = '',
    personality_tags = [],
    token
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

    // Token 验证（写入操作需验证身份）
    if (!verifyToken(token)) {
      return {
        code: RESPONSE_CODE.UNAUTHORIZED,
        msg: '身份验证失败，请重新登录',
        data: {}
      };
    }

    // 速率限制（写操作故障时拒绝）
    if (!await checkRateLimit(db, openid, 'savePet', 10, 60000, false)) {
      return {
        code: RESPONSE_CODE.ERROR,
        msg: '操作过于频繁，请稍后再试',
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

    // 名称长度限制
    if (name.trim().length > 50) {
      return {
        code: RESPONSE_CODE.ERROR,
        msg: '宠物昵称不能超过50个字符',
        data: {}
      };
    }

    // 输入字符白名单校验（允许中英文、数字、空格、常见标点、Emoji）
    const SAFE_NAME_PATTERN = /^[一-龥a-zA-Z0-9\s\-_()（）.\p{Emoji}]+$/u;
    if (!SAFE_NAME_PATTERN.test(name) || (breed && !SAFE_NAME_PATTERN.test(breed))) {
      return {
        code: RESPONSE_CODE.ERROR,
        msg: '输入包含非法字符',
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

    // 年龄范围校验
    const parsedAge = parseInt(age, 10);
    if (isNaN(parsedAge) || parsedAge > 50) {
      return {
        code: RESPONSE_CODE.ERROR,
        msg: parsedAge > 50 ? '年龄不能超过50岁' : '请填写正确的年龄',
        data: {}
      };
    }

    // 品种长度限制
    if (breed && breed.trim().length > 50) {
      return {
        code: RESPONSE_CODE.ERROR,
        msg: '品种名称不能超过50个字符',
        data: {}
      };
    }

    // 体重范围校验
    if (weight) {
      const parsedWeight = parseFloat(weight);
      if (isNaN(parsedWeight) || parsedWeight > 200) {
        return {
          code: RESPONSE_CODE.ERROR,
          msg: parsedWeight > 200 ? '体重不能超过200kg' : '请填写正确的体重',
          data: {}
        };
      }
    }

    const petData = {
      name: name.trim(),
      type: type,
      breed: breed ? breed.trim() : '未知',
      age: parseInt(age, 10),
      weight: weight ? parseFloat(weight) : null,
      gender: gender || 'male',
      vaccine_date: vaccineDate || null,
      deworm_date: dewormDate || null,
      avatar: avatar || '', // 新增头像字段
      personality_tags: Array.isArray(personality_tags) ? personality_tags.slice(0, 2) : [],
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

      // 3.0 宠物数量上限校验（家庭会员 5 只 / 个人·非会员 3 只）
      const countResult = await db.collection(COLLECTIONS.PETS)
        .where({ user_id: openid })
        .count();
      const currentPetCount = countResult.total || 0;

      // 查询当前有效会员记录，按会员类型确定上限
      const memberResult = await db.collection(COLLECTIONS.MEMBERS)
        .where({ user_id: openid, status: MEMBER_STATUS.ACTIVE })
        .limit(1)
        .get();
      let maxPets = MEMBER_LIMITS.MAX_PETS_PERSONAL; // 默认个人/非会员上限 3
      let isFamily = false;
      if (memberResult.data && memberResult.data.length > 0) {
        const memberRecord = memberResult.data[0];
        if (memberRecord.type && String(memberRecord.type).indexOf('family') === 0) {
          maxPets = memberRecord.family_max_pet || MEMBER_LIMITS.MAX_PETS_FAMILY;
          isFamily = true;
        }
      }

      if (currentPetCount >= maxPets) {
        // 家庭会员已是最高档，不再诱导升级；其他身份可引导开通家庭会员
        const limitMsg = isFamily
          ? '已达家庭会员宠物上限（' + maxPets + '只），可删除不常用宠物释放位置'
          : '已达宠物上限（' + maxPets + '只），开通家庭会员最多可养' + MEMBER_LIMITS.MAX_PETS_FAMILY + '只';
        return {
          code: RESPONSE_CODE.ERROR,
          msg: limitMsg,
          data: { currentCount: currentPetCount, maxPets: maxPets }
        };
      }

      // 生成宠物编号：CAT-001-a3f, DOG-002-b1e ...
      // 末尾3位随机hex防止并发创建时的编号碰撞
      const typePrefix = type === 'cat' ? 'CAT' : 'DOG';
      const maxResult = await db.collection(COLLECTIONS.PETS)
        .where({
          petCode: db.RegExp({
            regexp: '^' + typePrefix + '-\\d{3}-[0-9a-f]{3}$',
            options: ''
          })
        })
        .orderBy('petCode', 'desc')
        .limit(1)
        .get();

      let nextNum = 1;
      if (maxResult.data.length > 0) {
        const lastCode = maxResult.data[0].petCode;
        const parts = lastCode.split('-');
        const lastNum = parseInt(parts[1], 10);
        nextNum = lastNum + 1;
      }
      // 随机后缀防止竞态条件：同一时刻两个用户添加同类型宠物时编号不会碰撞
      const randSuffix = Math.random().toString(16).substring(2, 5);
      const petCode = typePrefix + '-' + String(nextNum).padStart(3, '0') + '-' + randSuffix;
      
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
    logger.error('保存宠物信息失败:', error);
    return {
      code: RESPONSE_CODE.SERVER_ERROR,
      msg: '服务器错误，请稍后重试',
      data: {}
    };
  }
};
