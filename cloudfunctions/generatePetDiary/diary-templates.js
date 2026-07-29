/**
 * 宠物日记模板库
 *
 * 模板 key：
 *   welcome — 首次日记（冷启动）
 *   care    — 昨日有症状自查记录
 *   learn   — 昨日浏览过科普文章
 *   daily   — 无以上行为（通用萌系）
 *
 * daily 按 性格标签 细分语气（needy 粘人 / foodie 贪吃 / generic 其余）。
 * 占位符：{pet_name} {pet_type} {symptoms} {days}
 */
var TEMPLATES = {
  welcome: {
    cat: [
      '喵~ 我是{pet_name}！今天是我来到这里的第{days}天，以后请多关照啦。',
      '初来乍到，我叫{pet_name}。虽然有点害羞，但已经准备好在新家开始生活了。'
    ],
    dog: [
      '汪！我是{pet_name}！今天是我来这里的第{days}天，我已经爱上这个家了！',
      '你好呀，我叫{pet_name}。今天主人带我熟悉了新环境，尾巴都摇酸了。'
    ]
  },
  care: {
    cat: [
      '今天铲屎官特别关心{pet_name}，一直陪着我，我就没那么紧张了。',
      '{pet_name}今天不太舒服，不过主人很上心，守了一整天，感觉好多了。'
    ],
    dog: [
      '今天主人很担心我，带我去做了检查。有他在身边，我什么都不怕。',
      '{pet_name}今天有点没精神，但主人一直抱着我，我觉得很安心。'
    ]
  },
  learn: {
    cat: [
      '今天主人学了一些养猫知识，我觉得很安心，跟着他一定能过好日子。',
      '喵~ 今天主人在研究怎么照顾我，看在他这么用心的份上，多让他摸一下吧。'
    ],
    dog: [
      '今天主人看了好多照顾我的知识，{pet_name}觉得好幸福呀。',
      '主人今天认真学养狗技巧，{pet_name}感觉被重视着，尾巴摇个不停。'
    ]
  },
  daily: {
    cat_generic: [
      '今天又是平静的一天，{pet_name}在家舒舒服服地睡了个好觉。',
      '阳光真好，{pet_name}找了个最舒服的位置晒太阳，打了一下午盹。'
    ],
    cat_needy: [
      '今天{pet_name}一直跟着主人走来走去，其实只是想多待一会儿嘛。',
      '主人今天出门好久了，{pet_name}数着时间等你回来呢。'
    ],
    cat_foodie: [
      '今天的罐头好像比昨天少了那么一点点...{pet_name}表示抗议。',
      '{pet_name}今天闻到了好吃的味道，在厨房门口蹲了好久。'
    ],
    dog_generic: [
      '今天{pet_name}在家巡视了一圈领地，确认安全后才安心睡下。',
      '阳光不错，{pet_name}趴在窗边看了好久的风景，好想出去玩。'
    ],
    dog_needy: [
      '{pet_name}今天一直在门口等主人，尾巴听到脚步声就摇起来了。',
      '主人今天回来的时候，{pet_name}激动得转了三个圈。'
    ],
    dog_foodie: [
      '{pet_name}今天的饭吃得干干净净，碗都舔得反光了。',
      '今天主人给了我一块小零食，{pet_name}已经记住了那个放零食的柜子。'
    ]
  }
};

// 性格标签 → daily 语气分组（未列出或无专属模板的落 generic）
var TAG_MOOD = {
  粘人: 'needy',
  贪吃: 'foodie',
  活泼: 'generic',
  高冷: 'generic',
  胆小: 'generic',
  温顺: 'generic',
  调皮: 'generic',
  慵懒: 'generic'
};

function pick(templateKey, petType, tags) {
  var group = TEMPLATES[templateKey];
  var key = group ? templateKey : 'daily';
  if (!group) group = TEMPLATES.daily;

  if (key === 'daily') {
    var mood = 'generic';
    if (tags && tags.length > 0 && TAG_MOOD[tags[0]]) {
      mood = TAG_MOOD[tags[0]];
    }
    var subKey = petType + '_' + mood;
    var sub = group[subKey] || group[petType + '_generic'] || group.cat_generic;
    return sub[Math.floor(Math.random() * sub.length)];
  }

  var list = group[petType] || group.cat;
  return list[Math.floor(Math.random() * list.length)];
}

module.exports = { pick: pick, TEMPLATES: TEMPLATES };
