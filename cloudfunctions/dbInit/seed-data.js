/**
 * 数据库初始化种子数据
 * dbInit 云函数的子模块 — 包含医院、知识文章、报告模板的初始数据
 */

const SAMPLE_PETS = [
  {
    user_id: 'sample_user_1',
    petCode: 'PET001',
    name: '小白',
    type: 'cat',
    breed: '英国短毛猫',
    age: 2,
    weight: 4.5,
    gender: 'male',
    vaccine_date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    deworm_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date()
  },
  {
    user_id: 'sample_user_1',
    petCode: 'PET002',
    name: '大黄',
    type: 'dog',
    breed: '金毛寻回犬',
    age: 3,
    weight: 28.0,
    gender: 'male',
    vaccine_date: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
    deworm_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date()
  }
];

const INITIAL_HOSPITALS = [
  {
    name: '爱心宠物医院',
    address: '北京市朝阳区望京街道阜通东大街6号',
    phone: '010-64781234',
    location: { latitude: 39.996259, longitude: 116.480936 },
    is_24h: true,
    services: ['急诊', '疫苗接种', '体检', '手术'],
    rating: 4.8,
    created_at: new Date()
  },
  {
    name: '宠物中心医院',
    address: '北京市海淀区中关村大街27号',
    phone: '010-62567890',
    location: { latitude: 39.982259, longitude: 116.317896 },
    is_24h: true,
    services: ['急诊', '住院', '手术', '实验室检查'],
    rating: 4.9,
    created_at: new Date()
  },
  {
    name: '萌宠宠物诊所',
    address: '北京市丰台区方庄芳古园一区8号',
    phone: '010-67681234',
    location: { latitude: 39.872259, longitude: 116.437896 },
    is_24h: false,
    services: ['疫苗接种', '体检', '洗澡美容'],
    rating: 4.6,
    created_at: new Date()
  },
  {
    name: '北京宠物医院',
    address: '北京市东城区建国门内大街8号',
    phone: '010-65281234',
    location: { latitude: 39.912259, longitude: 116.417896 },
    is_24h: true,
    services: ['急诊', '手术', '住院', '专家门诊'],
    rating: 4.7,
    created_at: new Date()
  },
  {
    name: '和谐宠物医院',
    address: '北京市西城区西单北大街120号',
    phone: '010-66081234',
    location: { latitude: 39.912259, longitude: 116.377896 },
    is_24h: false,
    services: ['疫苗接种', '体检', '营养咨询'],
    rating: 4.5,
    created_at: new Date()
  }
];

function getInitialKnowledgeArticles() {
  const now = new Date();
  return [
    {
      title: '猫呕吐怎么办',
      category: 'digestive',
      target_pet: 'cat',
      summary: '猫咪呕吐是常见症状，了解原因和应对方法很重要。本文帮助您判断何时需要就医。',
      content: '## 猫咪呕吐的常见原因\n\n### 1. 饮食问题\n- 吃得太快或太多\n- 食物突然更换\n- 食物过敏或不耐受\n\n### 2. 毛球症\n- 猫咪日常梳理会吞入毛发\n- 毛发在胃中积聚形成毛球\n\n### 3. 疾病因素\n- 肠胃炎\n- 肝肾疾病\n- 甲状腺功能亢进\n\n## 应对措施\n\n### 轻微呕吐（1-2次/天，精神正常）\n1. 禁食4-6小时，少量多次给水\n2. 恢复喂食时先给少量易消化食物\n3. 观察呕吐物内容和频率\n\n### 何时就医\n- 一天内呕吐超过3次\n- 呕吐物带血或呈黄绿色\n- 伴有腹泻、精神萎靡\n- 超过24小时不愿进食\n\n### 预防建议\n- 定期梳毛减少毛球\n- 使用慢食碗控制进食速度\n- 换粮时逐步过渡（7天）',
      cover_image: '',
      related_symptoms: ['呕吐', '食欲不振'],
      member_only: true,
      view_count: 0, sort_order: 1, status: 'published',
      published_at: now, created_at: now, updated_at: now
    },
    {
      title: '狗拉稀怎么办',
      category: 'digestive',
      target_pet: 'dog',
      summary: '狗狗腹泻的原因多样，从饮食不当到疾病感染都有可能。学会判断严重程度和正确应对。',
      content: '## 狗狗腹泻的常见原因\n\n### 1. 饮食相关\n- 突然换粮\n- 误食变质食物或异物\n- 食物过敏\n\n### 2. 感染因素\n- 细小病毒（幼犬高危）\n- 寄生虫感染\n- 细菌性肠炎\n\n### 3. 应激因素\n- 环境变化\n- 精神紧张\n\n## 应对措施\n\n### 轻微腹泻（精神正常，无其他症状）\n1. 禁食12-24小时，保证饮水\n2. 恢复喂食从少量白粥开始\n3. 添加益生菌调理肠胃\n\n### 何时就医\n- 腹泻超过48小时未好转\n- 便中带血或呈黑色\n- 伴有呕吐、发烧\n- 幼犬出现腹泻（脱水风险高）\n\n### 预防建议\n- 定期驱虫\n- 不要喂人食\n- 换粮循序渐进',
      cover_image: '',
      related_symptoms: ['腹泻', '食欲不振'],
      view_count: 0, sort_order: 2, status: 'published',
      published_at: now, created_at: now, updated_at: now
    },
    {
      title: '猫咪不吃饭',
      category: 'behavior',
      target_pet: 'cat',
      summary: '猫咪食欲下降可能是多种原因，了解如何判断和处理猫咪厌食问题。',
      content: '## 猫咪不吃饭的原因\n\n### 1. 环境因素\n- 新环境适应期\n- 食盆位置不当\n- 噪音干扰\n\n### 2. 食物问题\n- 食物不新鲜\n- 口味厌倦\n- 食物温度不适\n\n### 3. 健康问题\n- 口腔疾病（牙龈炎、口炎）\n- 消化系统疾病\n- 上呼吸道感染影响嗅觉\n\n## 应对措施\n\n### 短期不吃饭（1-2天）\n1. 更换新鲜食物或不同口味\n2. 适当加热食物增加香味\n3. 添加猫条或罐头引诱\n4. 保持安静进食环境\n\n### 何时就医\n- 超过24小时完全不进食（猫易发脂肪肝）\n- 伴有呕吐、腹泻\n- 体重明显下降\n- 精神萎靡\n\n### 注意事项\n- 猫比狗更容易因不吃饭导致肝脂质沉积症\n- 不要强迫喂食',
      cover_image: '',
      related_symptoms: ['食欲不振', '精神萎靡'],
      view_count: 0, sort_order: 3, status: 'published',
      published_at: now, created_at: now, updated_at: now
    },
    {
      title: '狗狗咳嗽',
      category: 'respiratory',
      target_pet: 'dog',
      summary: '狗狗咳嗽可能由多种原因引起，从轻微的刺激到严重的呼吸道感染。',
      content: '## 狗狗咳嗽的常见原因\n\n### 1. 上呼吸道感染\n- 犬窝咳（传染性气管支气管炎）\n- 犬流感\n- 支原体感染\n\n### 2. 过敏或刺激\n- 灰尘、花粉过敏\n- 二手烟刺激\n- 香水或清洁剂\n\n### 3. 其他疾病\n- 心脏病（老年犬常见）\n- 气管塌陷（小型犬多见）\n- 肺炎\n\n## 应对措施\n\n### 轻微咳嗽\n1. 保持环境清洁通风\n2. 使用加湿器增加湿度\n3. 避免刺激物\n4. 减少剧烈运动\n\n### 何时就医\n- 咳嗽持续超过1周\n- 咳出带血或脓性分泌物\n- 伴有呼吸困难、发烧\n- 夜间咳嗽加重\n\n### 预防建议\n- 按时接种疫苗（犬窝咳疫苗）\n- 避免接触病犬\n- 保持室内空气清新',
      cover_image: '',
      related_symptoms: ['咳嗽', '呼吸困难'],
      member_only: true,
      view_count: 0, sort_order: 4, status: 'published',
      published_at: now, created_at: now, updated_at: now
    },
    {
      title: '疫苗科普指南',
      category: 'prevention',
      target_pet: 'all',
      summary: '了解宠物疫苗接种的基本知识，包括接种时间、疫苗种类和注意事项。',
      content: '## 宠物疫苗接种指南\n\n### 狗狗疫苗\n\n#### 核心疫苗（必须接种）\n- 犬瘟热\n- 犬细小病毒\n- 犬腺病毒（传染性肝炎）\n- 狂犬疫苗\n\n#### 非核心疫苗（根据风险评估）\n- 犬窝咳\n- 钩端螺旋体\n- 犬流感\n\n### 猫咪疫苗\n\n#### 核心疫苗\n- 猫瘟（猫泛白细胞减少症）\n- 猫疱疹病毒\n- 猫杯状病毒\n- 狂犬疫苗\n\n#### 非核心疫苗\n- 猫白血病病毒\n\n### 接种时间表\n\n#### 幼年首次免疫\n- 6-8周龄：第一针\n- 间隔3-4周加强一次\n- 共需2-3针完成基础免疫\n- 16周龄以上接种狂犬疫苗\n\n#### 成年后\n- 每年加强一次核心疫苗\n- 或根据抗体滴度决定是否加强\n\n### 注意事项\n- 接种前确保宠物健康\n- 接种后观察30分钟\n- 一周内避免洗澡和剧烈运动',
      cover_image: '',
      related_symptoms: [],
      member_only: true,
      view_count: 0, sort_order: 5, status: 'published',
      published_at: now, created_at: now, updated_at: now
    },
    {
      title: '驱虫科普指南',
      category: 'prevention',
      target_pet: 'all',
      summary: '定期驱虫是宠物健康管理的重要环节，了解体内体外驱虫的方法和频率。',
      content: '## 宠物驱虫指南\n\n### 为什么要驱虫\n- 预防寄生虫感染\n- 保护宠物和家庭成员健康\n- 某些寄生虫可人畜共患\n\n### 体内寄生虫\n\n#### 常见种类\n- 蛔虫、绦虫、钩虫\n- 心丝虫（犬）\n- 球虫、贾第鞭毛虫\n\n#### 驱虫频率\n- 幼宠：2周龄开始，每2周一次至12周龄\n- 成年后：每3个月一次\n- 心丝虫：每月一次（流行区域）\n\n### 体外寄生虫\n\n#### 常见种类\n- 跳蚤、蜱虫\n- 螨虫（耳螨、疥螨）\n- 虱子\n\n#### 驱虫频率\n- 每月一次（春夏季节）\n- 每2-3月一次（秋冬季节）\n- 高风险区域每月一次\n\n### 驱虫注意事项\n- 按体重选择合适的驱虫药\n- 体内体外同时进行\n- 驱虫前后不需要禁食\n- 孕期宠物需咨询兽医\n\n### 常见驱虫产品\n- 拜耳（体内）\n- 大宠爱（体内外同驱）\n- 福来恩（体外）\n- 尼可信（体外咀嚼）',
      cover_image: '',
      related_symptoms: [],
      view_count: 0, sort_order: 6, status: 'published',
      published_at: now, created_at: now, updated_at: now
    },
    {
      title: '幼宠护理指南',
      category: 'care',
      target_pet: 'all',
      summary: '新手养宠必读：幼年宠物的喂养、健康检查和日常护理要点。',
      content: '## 幼宠护理全攻略\n\n### 接宠准备\n\n#### 必备物品\n- 食盆、水盆\n- 适合年龄的粮食\n- 窝/笼子\n- 尿垫/猫砂\n- 体温计\n\n### 喂养指南\n\n#### 幼犬\n- 2-3月龄：每日4餐\n- 3-6月龄：每日3餐\n- 6月龄以上：每日2餐\n- 选择幼犬专用粮\n\n#### 幼猫\n- 2-3月龄：每日4-5餐\n- 3-6月龄：每日3-4餐\n- 6月龄以上：每日2-3餐\n- 可适当补充羊奶粉\n\n### 健康检查\n\n#### 首次体检\n- 接回家后1周内\n- 全面体检\n- 粪便检查\n- 制定免疫计划\n\n#### 日常观察\n- 精神状态\n- 食欲和饮水量\n- 排泄情况\n- 体温（犬38-39°C，猫38-39.5°C）\n\n### 社会化训练\n- 3-14周是社会化关键期\n- 逐步接触不同的人、动物和环境\n- 正向激励，避免恐吓',
      cover_image: '',
      related_symptoms: [],
      member_only: true,
      view_count: 0, sort_order: 7, status: 'published',
      published_at: now, created_at: now, updated_at: now
    },
    {
      title: '老年宠护理指南',
      category: 'care',
      target_pet: 'all',
      summary: '照顾老年宠物需要特别关注饮食、运动和定期体检，让它们安享晚年。',
      content: '## 老年宠护理指南\n\n### 什么是老年宠\n- 猫：10岁以上\n- 小型犬：10岁以上\n- 大型犬：7岁以上\n\n### 常见老年疾病\n\n#### 关节问题\n- 骨关节炎\n- 椎间盘疾病\n- 症状：行动迟缓、不愿上下楼梯\n\n#### 内分泌疾病\n- 甲状腺功能亢进（猫）\n- 甲状腺功能减退（犬）\n- 糖尿病\n- 肾脏疾病\n\n#### 肿瘤\n- 定期检查肿块\n- 早期发现预后更好\n\n### 护理要点\n\n#### 饮食调整\n- 选择老年宠物专用粮\n- 适当补充关节保健品（软骨素、鱼油）\n- 控制体重，减轻关节负担\n- 少量多餐\n\n#### 运动管理\n- 保持适度运动\n- 避免剧烈运动\n- 散步时间缩短但频率增加\n\n#### 定期体检\n- 每半年一次全面体检\n- 血液检查（肝肾功、甲状腺）\n- 尿液检查\n- 血压监测\n\n#### 生活环境\n- 提供柔软的睡垫\n- 使用宠物台阶减少跳跃\n- 保持环境温暖',
      cover_image: '',
      related_symptoms: [],
      member_only: true,
      view_count: 0, sort_order: 8, status: 'published',
      published_at: now, created_at: now, updated_at: now
    },
    {
      title: '宠物便秘怎么办',
      category: 'digestive',
      target_pet: 'all',
      summary: '宠物排便困难、粪便干硬是常见问题，多数与饮食和饮水有关，但也可能提示疾病。',
      content: '## 宠物便秘的常见原因\n\n### 1. 饮食因素\n- 饮水不足\n- 纤维摄入过少或过多\n- 误食毛发、骨头等异物\n\n### 2. 生活习惯\n- 运动量不足\n- 肛门腺发炎\n- 排便环境不洁或应激\n\n### 3. 疾病因素\n- 巨结肠（猫多见）\n- 骨盆骨折后的狭窄\n- 神经性疾病\n\n## 应对措施\n\n### 轻微便秘\n- 增加饮水，提供流动水\n- 适量喂食南瓜泥（无添加）增加纤维\n- 增加运动与梳理减少吞毛\n\n### 何时就医\n- 超过两天完全无排便\n- 反复用力却排不出\n- 粪便带血或带黏液\n- 伴有呕吐、食欲下降、腹胀\n\n> 长期便秘可能发展为巨结肠，切勿长期依赖泻药，需兽医评估病因。',
      cover_image: '',
      related_symptoms: ['便秘', '食欲不振'],
      member_only: true,
      view_count: 0, sort_order: 9, status: 'published',
      published_at: now, created_at: now, updated_at: now
    },
    {
      title: '猫咪腹泻与脱水识别',
      category: 'digestive',
      target_pet: 'cat',
      summary: '猫咪腹泻比狗更易脱水，学会在家判断脱水程度并及时补液非常关键。',
      content: '## 为什么猫腹泻要格外重视\n\n猫体型小、天生饮水量少，腹泻时脱水速度远快于狗，幼猫和老猫尤其危险。\n\n### 脱水的家庭判断\n- **皮肤回弹测试**：轻提颈背皮肤，松手后若超过2秒未恢复说明脱水\n- 牙龈：健康为粉红湿润；脱水时发黏、发干\n- 眼窝凹陷、精神萎靡\n\n## 应对措施\n\n### 轻微腹泻（精神正常）\n- 少量多次供水或电解质水\n- 暂停喂食4-6小时后给易消化食物\n- 观察粪便形态与频率\n\n### 何时立即就医\n- 腹泻伴随呕吐\n- 粪便带血或呈黑色\n- 出现脱水体征\n- 幼猫腹泻超过12小时\n\n> 猫禁食时间不宜过长，超过24-48小时不进食可能引发肝脂质沉积症。',
      cover_image: '',
      related_symptoms: ['腹泻', '脱水'],
      view_count: 0, sort_order: 10, status: 'published',
      published_at: now, created_at: now, updated_at: now
    },
    {
      title: '宠物胃肠炎',
      category: 'digestive',
      target_pet: 'all',
      summary: '胃肠炎是呕吐腹泻的常见原因，多由饮食不当或感染引起，严重时需输液治疗。',
      content: '## 胃肠炎的常见诱因\n\n### 1. 饮食相关\n- 突然换粮\n- 误食变质、油腻食物\n- 食物过敏\n\n### 2. 感染因素\n- 病毒性（细小、猫瘟等）\n- 细菌性（沙门氏菌、大肠杆菌）\n- 寄生虫\n\n### 3. 其他\n- 误食异物或毒物\n- 应激\n\n## 典型表现\n- 呕吐与腹泻同时出现\n- 食欲下降、精神萎靡\n- 可能发热、腹痛\n\n## 应对措施\n\n### 轻症\n- 短暂禁食（犬12-24h，猫不超过12h）\n- 少量多次补水防脱水\n- 恢复喂食从清淡易消化食物开始\n\n### 何时就医\n- 频繁呕吐无法进水\n- 出血性腹泻\n- 幼宠、老年宠或精神极差\n- 超过24小时无好转\n\n> 病毒性胃肠炎进展极快，幼宠出现呕吐腹泻请尽早就医，不要在家观察过久。',
      cover_image: '',
      related_symptoms: ['呕吐', '腹泻'],
      member_only: true,
      view_count: 0, sort_order: 11, status: 'published',
      published_at: now, created_at: now, updated_at: now
    },
    {
      title: '认识宠物胰腺炎',
      category: 'digestive',
      target_pet: 'all',
      summary: '胰腺炎常与高脂饮食有关，表现为剧烈呕吐和腹痛，是一种需及时就医的急症。',
      content: '## 什么是胰腺炎\n\n胰腺分泌消化酶，当酶在胰腺内被异常激活，就会"消化"胰腺自身，引起炎症。\n\n### 常见诱因\n- 高脂饮食（如一次吃大量肥肉、骨头汤）\n- 肥胖\n- 某些药物或创伤\n- 特发性（找不到明确原因）\n\n## 典型表现\n- **突发剧烈呕吐**，进食后立即吐\n- 腹痛：祈祷姿势（前腿趴下、后腿站立）\n- 精神萎靡、食欲废绝\n- 腹泻，可能带血\n\n## 应对措施\n\n### 这是需要尽早就医的疾病\n- 不要强行喂食喂水\n- 避免自行给止痛药（许多人用药对宠物有毒）\n- 尽快送医，治疗常需禁食、输液、止吐\n\n### 预防\n- 控制体重，避免肥胖\n- 不喂高脂人食（肥肉、肉汤、炸物）\n- 饮食规律，避免暴饮暴食\n\n> 胰腺炎可能反复发作，慢性病例需长期低脂饮食管理。',
      cover_image: '',
      related_symptoms: ['呕吐', '腹痛'],
      member_only: true,
      view_count: 0, sort_order: 12, status: 'published',
      published_at: now, created_at: now, updated_at: now
    },
    {
      title: '宠物误食异物怎么办',
      category: 'digestive',
      target_pet: 'all',
      summary: '猫狗好奇心强，误食异物时有发生。掌握正确处理方式能争取宝贵抢救时间。',
      content: '## 常见误食异物\n\n### 猫咪\n- 线绳、毛线（极度危险！）\n- 发圈、塑料袋\n- 玩具小零件\n\n### 狗狗\n- 袜子、内裤\n- 果核、玉米芯\n- 玩具、骨头碎片\n- 硬币、针\n\n## 典型表现\n- 反复呕吐（尤其进食后）\n- 食欲下降、精神差\n- 腹痛、弓背\n- 可见异物从肛门口露出（**切勿外拉线绳！**）\n\n## 应对措施\n\n### 紧急处理\n- **不要盲目催吐**：尖锐物、线绳、腐蚀性物质催吐可能造成更大伤害\n- 立即联系兽医，告知误食时间和物品\n- 有条件保留同类物品或包装供判断\n\n### 就医检查\n- X光或超声定位\n- 可能需要内镜取出或手术\n\n### 预防\n- 收好线绳、发圈、小零件\n- 玩具选择合适尺寸，损坏及时丢弃\n- 散步时阻止捡食\n\n> 线状异物对猫尤其致命，发现猫玩线绳要立即没收。',
      cover_image: '',
      related_symptoms: ['呕吐', '食欲不振'],
      view_count: 0, sort_order: 13, status: 'published',
      published_at: now, created_at: now, updated_at: now
    },
    {
      title: '宠物打喷嚏',
      category: 'respiratory',
      target_pet: 'all',
      summary: '偶尔打喷嚏通常无害，但频繁或伴有其他症状可能提示呼吸道问题。',
      content: '## 打喷嚏的常见原因\n\n### 1. 环境刺激\n- 灰尘、粉尘、香水\n- 花粉等过敏原\n- 刺激性清洁剂、二手烟\n\n### 2. 上呼吸道感染\n- 猫疱疹病毒、杯状病毒\n- 犬窝咳\n- 支原体、衣原体\n\n### 3. 其他\n- 鼻腔异物（如草籽）\n- 鼻腔肿瘤（老年、单侧流涕）\n- 牙齿感染波及鼻腔\n\n## 应对措施\n\n### 偶尔打喷嚏（精神食欲正常）\n- 保持环境清洁、通风\n- 避免刺激性气味\n- 观察频率和伴随症状\n\n### 何时就医\n- 频繁连续打喷嚏\n- 伴有眼鼻分泌物、咳嗽\n- 分泌物变黄绿色或带血\n- 食欲下降、精神差\n\n> 猫的上呼吸道感染传染性强，多猫家庭需隔离病猫。',
      cover_image: '',
      related_symptoms: ['打喷嚏', '流鼻涕'],
      view_count: 0, sort_order: 14, status: 'published',
      published_at: now, created_at: now, updated_at: now
    },
    {
      title: '宠物呼吸急促识别',
      category: 'respiratory',
      target_pet: 'all',
      summary: '呼吸频率异常升高可能是严重疾病的信号，学会判断正常与异常非常重要。',
      content: '## 正常呼吸频率\n\n- 犬猫静息时约 **15-30次/分钟**\n- 睡眠时计数最准确\n- 天热、运动后、紧张时短暂加快属正常\n\n## 异常信号\n- 静息状态持续超过 **40次/分钟**\n- 张口呼吸（**猫张口呼吸是急症！**）\n- 用力呼吸：腹部明显起伏、肘部外展\n- 牙龈发紫或苍白\n- 喘息无法平复\n\n## 可能原因\n- 心脏病（老年犬猫常见，尤其二尖瓣退变）\n- 肺水肿、胸腔积液\n- 哮喘（猫）\n- 肺炎、气管塌陷\n- 疼痛、应激、中暑\n\n## 应对措施\n\n### 立即就医的情况\n- 猫张口呼吸\n- 牙龈发紫\n- 明显呼吸困难\n\n### 日常监测\n- 学会数静息呼吸频率并记录\n- 老年宠物定期心脏检查\n\n> 心脏病早期常表现为夜间咳嗽和静息呼吸频率升高，规律监测有助于早发现。',
      cover_image: '',
      related_symptoms: ['呼吸困难', '咳嗽'],
      member_only: true,
      view_count: 0, sort_order: 15, status: 'published',
      published_at: now, created_at: now, updated_at: now
    },
    {
      title: '猫鼻支（猫疱疹病毒感染）',
      category: 'respiratory',
      target_pet: 'cat',
      summary: '猫鼻支是猫咪常见的上呼吸道传染病，表现为打喷嚏、流涕、眼部分泌物。',
      content: '## 什么是猫鼻支\n\n由猫疱疹病毒（FHV-1）引起的上呼吸道感染，幼猫和未免疫猫高发，传染性强。\n\n## 典型表现\n- 频繁打喷嚏\n- 眼鼻分泌物（先清水后脓性）\n- 结膜炎、眼睛红肿\n- 食欲下降、发热\n- 严重时口腔溃疡、肺炎\n\n## 传播途径\n- 直接接触病猫分泌物\n- 飞沫传播\n- 污染的食具、环境\n\n## 应对措施\n\n### 家庭护理（轻症）\n- 经常清理眼鼻分泌物（用温湿棉球）\n- 保证进食饮水（鼻塞会影响嗅觉和食欲）\n- 保暖、减少应激\n- 加热食物增强香气\n\n### 何时就医\n- 完全不进食超过24小时\n- 呼吸困难\n- 幼猫或未免疫猫\n- 症状持续加重\n\n### 预防\n- 按时接种核心疫苗\n- 新猫入家先隔离\n- 减少应激，赖氨酸等需遵医嘱\n\n> 感染后病毒终身携带，应激时可复发。',
      cover_image: '',
      related_symptoms: ['打喷嚏', '流鼻涕'],
      member_only: true,
      view_count: 0, sort_order: 16, status: 'published',
      published_at: now, created_at: now, updated_at: now
    },
    {
      title: '犬窝咳（传染性气管支气管炎）',
      category: 'respiratory',
      target_pet: 'dog',
      summary: '犬窝咳是狗狗高传染性呼吸道疾病，典型表现为"鹅鸣样"咳嗽。',
      content: '## 什么是犬窝咳\n\n由多种病毒和细菌（如博德氏菌）混合引起的传染性气管支气管炎，在犬只密集场所（寄养、犬舍、医院）易暴发。\n\n## 典型表现\n- **鹅鸣样干咳**，像喉咙卡了东西\n- 兴奋或牵拉项圈时加重\n- 可能咳出白色泡沫\n- 轻症犬精神食欲通常正常\n- 严重时发展为肺炎（发热、脓痰、精神差）\n\n## 应对措施\n\n### 轻症（精神食欲正常）\n- 减少刺激，使用胸背带代替项圈\n- 保持环境温暖湿润\n- 避免剧烈运动和吠叫\n- 保证休息和营养\n\n### 何时就医\n- 咳嗽持续超过一周或加重\n- 出现发热、脓性痰\n- 精神食欲下降\n- 幼犬或未免疫犬\n\n### 预防\n- 接种含犬窝咳成分的疫苗\n- 寄养前提前免疫\n- 避免接触咳嗽的犬只\n\n> 多数轻症犬窝咳2-3周自愈，但幼犬可能进展为肺炎，需密切观察。',
      cover_image: '',
      related_symptoms: ['咳嗽'],
      view_count: 0, sort_order: 17, status: 'published',
      published_at: now, created_at: now, updated_at: now
    },
    {
      title: '猫咪哮喘',
      category: 'respiratory',
      target_pet: 'cat',
      summary: '猫哮喘表现为阵发性咳嗽和呼吸困难，常见诱因包括过敏原和应激。',
      content: '## 什么是猫哮喘\n\n猫哮喘是气道对刺激物的过敏反应，导致气道痉挛、狭窄和炎症。\n\n## 常见诱因\n- 尘螨、花粉、霉菌\n- 猫砂粉尘\n- 香水、空气清新剂、清洁剂\n- 香烟烟雾\n- 应激\n\n## 典型表现\n- 阵发性咳嗽（常被误认为是吐毛球）\n- 呼吸急促、用力呼吸\n- 呼吸时有哮鸣音\n- 严重时张口呼吸（急症）\n- 蹲伏、颈部前伸\n\n## 应对措施\n\n### 减少诱因\n- 换用低尘猫砂\n- 避免刺激性气味和二手烟\n- 定期清洁减少尘螨\n- 使用空气净化器\n\n### 何时就医\n- 怀疑哮喘发作\n- 出现呼吸困难或张口呼吸（立即就医）\n\n### 长期管理\n- 确诊后遵医嘱使用吸入药物\n- 记录发作诱因并避免\n\n> 猫哮喘需与心脏病、肺水肿鉴别，确诊需要拍片等检查，请勿自行用药。',
      cover_image: '',
      related_symptoms: ['咳嗽', '呼吸困难'],
      member_only: true,
      view_count: 0, sort_order: 18, status: 'published',
      published_at: now, created_at: now, updated_at: now
    },
    {
      title: '狗狗分离焦虑',
      category: 'behavior',
      target_pet: 'dog',
      summary: '分离焦虑是狗狗独自留家时的常见问题，表现为破坏行为和异常吠叫。',
      content: '## 分离焦虑的表现\n\n### 行为表现\n- 主人离家时过度吠叫、哀鸣\n- 破坏家具、抓门、拆家\n- 过度舔舐自己\n- 在室内排泄（平时已学会定点）\n- 主人回家时过度兴奋\n\n### 常见原因\n- 缺乏独立性的训练\n- 生活变动（搬家、主人日程变化）\n- 缺乏运动和脑力消耗\n- 曾经被遗弃的经历\n\n## 应对措施\n\n### 训练与适应\n- **出门回家保持低调**，避免强化焦虑\n- 从短暂离开开始，逐步延长时间\n- 离开时提供漏食玩具、啃咬玩具\n- 增加运动量，出门前充分消耗精力\n- 建立安全区（航空箱训练）\n\n### 环境管理\n- 收好易被破坏的物品\n- 留有主人气味的衣物\n- 播放轻柔音乐或留电视声音\n\n### 何时寻求专业帮助\n- 严重自伤或破坏行为\n- 邻居投诉持续吠叫\n- 训练无改善\n\n> 严重病例需要兽医行为学评估，可能配合药物治疗，切勿惩罚。',
      cover_image: '',
      related_symptoms: [],
      view_count: 0, sort_order: 19, status: 'published',
      published_at: now, created_at: now, updated_at: now
    },
    {
      title: '猫咪乱尿问题',
      category: 'behavior',
      target_pet: 'cat',
      summary: '猫咪不在猫砂盆排尿原因复杂，需先排查疾病再纠正行为问题。',
      content: '## 先排除疾病（最重要）\n\n任何排尿异常都可能提示疾病，**尤其是公猫**：\n- 尿路感染、膀胱炎\n- 尿结石、尿道梗阻（**公猫急症！**）\n- 猫自发性膀胱炎（应激相关）\n\n### 危险信号（立即就医）\n- 频繁进出猫砂盆但无尿\n- 排尿时哀叫、尿血\n- 反复舔舐生殖器\n- 精神萎靡、呕吐\n\n## 行为与环境原因\n- 猫砂盆脏、位置不佳\n- 不喜欢新换的猫砂\n- 多猫家庭砂盆不够（建议N+1）\n- 家中应激（新成员、装修、噪音）\n- 领地标记（未绝育公猫多见）\n\n## 应对措施\n\n### 环境调整\n- 每日清理猫砂盆，定期彻底更换\n- 放置足够数量的砂盆\n- 保持砂盆安静、易到达\n- 减少家中应激源\n\n### 清洁\n- 用生物酶清洁剂彻底分解尿味\n- 避免含氨清洁剂（会加重气味）\n\n> 标记行为与排尿异常不同，未绝育猫建议尽早绝育。',
      cover_image: '',
      related_symptoms: ['乱尿'],
      member_only: true,
      view_count: 0, sort_order: 20, status: 'published',
      published_at: now, created_at: now, updated_at: now
    },
    {
      title: '宠物攻击性行为',
      category: 'behavior',
      target_pet: 'all',
      summary: '攻击行为背后常有恐惧、疼痛或资源守护，理解原因比惩罚更有效。',
      content: '## 攻击行为的常见类型\n\n### 1. 恐惧性攻击\n- 最常见，面对威胁时防卫\n- 身体语言：缩起、耳朵后贴、尾巴夹紧\n\n### 2. 资源守护\n- 守护食物、玩具、休息位置\n- 靠近时低吼、呲牙\n\n### 3. 疼痛相关\n- 因疾病或受伤变得易怒\n- 触碰某部位时突然攻击\n\n### 4. 领地/ redirected 攻击\n- 突然被激惹后转向攻击\n\n## 应对措施\n\n### 安全第一\n- 出现攻击先保持距离，避免正面冲突\n- 必要时用物品隔开\n- 儿童和访客需远离\n\n### 识别身体语言\n- 学习安抚信号和警告信号\n- 在低吼阶段就停止刺激\n\n### 寻找原因\n- **突然出现的攻击优先排查疼痛**（口腔、关节、内脏）\n- 回顾是否近期有环境变化\n\n### 训练原则\n- **不要惩罚**：惩罚会加重恐惧和攻击\n- 正向强化 desired 行为\n- 严重问题寻求专业训练师或兽医行为学帮助\n\n> 突然性格改变（原本温顺变攻击）很可能是疾病信号，建议先做体检。',
      cover_image: '',
      related_symptoms: [],
      member_only: true,
      view_count: 0, sort_order: 21, status: 'published',
      published_at: now, created_at: now, updated_at: now
    },
    {
      title: '识别宠物刻板行为',
      category: 'behavior',
      target_pet: 'all',
      summary: '反复、无意义的固定动作（如过度舔毛）可能是压力或疾病的信号。',
      content: '## 什么是刻板行为\n\n动物在压力、无聊或疾病下反复执行的固定动作，常见于圈养环境。\n\n### 常见类型\n- **过度舔毛**：舔到脱毛、皮肤破损\n- 追尾巴、转圈\n- 来回踱步\n- 吸吮织物（猫的吮 wool 行为）\n- 自残（啃咬尾巴、爪子）\n\n## 可能原因\n### 心理性\n- 长期无聊、缺乏刺激\n- 应激（环境变化、缺乏安全感）\n- 分离焦虑\n\n### 生理性\n- 皮肤病、寄生虫、过敏\n- 疼痛（关节、神经）\n- 内分泌疾病\n\n## 应对措施\n\n### 先排查疾病\n- 皮肤检查、寄生虫筛查\n- 排除疼痛和过敏\n\n### 丰富环境\n- 增加互动游戏和运动\n- 提供益智玩具、漏食球\n- 猫咪提供垂直空间、抓板、窗台观景\n- 规律的陪伴时间\n\n### 减少应激\n- 保持稳定的生活作息\n- 提供安全的躲藏空间\n\n> 轻度刻板行为通过丰富环境多可改善，严重或自残情况需兽医评估，可能需要行为药物辅助。',
      cover_image: '',
      related_symptoms: ['过度舔毛'],
      view_count: 0, sort_order: 22, status: 'published',
      published_at: now, created_at: now, updated_at: now
    },
    {
      title: '狗狗为什么爱拆家',
      category: 'behavior',
      target_pet: 'dog',
      summary: '拆家背后通常是精力过剩、无聊或焦虑，对症解决才能根治。',
      content: '## 拆家的常见原因\n\n### 1. 精力过剩\n- 运动量不足，尤其工作犬、大型犬\n- 每日运动量不达标\n\n### 2. 无聊\n- 独自在家缺乏刺激\n- 缺乏益智玩具\n\n### 3. 分离焦虑\n- 独处时紧张，通过破坏释放压力\n- 详见《狗狗分离焦虑》\n\n### 4. 换牙期\n- 幼犬3-6月龄换牙，需要啃咬缓解不适\n\n### 5. 探索世界\n- 幼犬用嘴巴认识环境\n\n## 应对措施\n\n### 消耗精力\n- 增加每日运动量（散步、跑步）\n- 加入脑力训练（嗅闻游戏、指令训练）\n- 出门前充分消耗\n\n### 环境管理\n- 外出时收好贵重和危险物品\n- 提供合法啃咬物（啃咬玩具、鹿角）\n- 使用漏食玩具消磨时间\n- 航空箱训练，独处时安全舒适\n\n### 训练\n- 教"放下"和"不可以"\n- 现场抓现行才有意义，事后惩罚无效\n- 换牙期幼犬提供冷冻啃咬玩具\n\n> 拆家是症状不是疾病，找到原因（精力？焦虑？换牙？）才能对症解决。',
      cover_image: '',
      related_symptoms: [],
      view_count: 0, sort_order: 23, status: 'published',
      published_at: now, created_at: now, updated_at: now
    },
    {
      title: '宠物绝育科普',
      category: 'prevention',
      target_pet: 'all',
      summary: '绝育不仅避免意外繁殖，还能降低多种疾病风险。了解最佳时机和注意事项。',
      content: '## 绝育的好处\n\n### 健康方面\n- 母犬猫：大幅降低子宫蓄脓、乳腺肿瘤风险\n- 公犬猫：减少前列腺疾病、睾丸问题\n- 降低逃逸、打架、标记行为\n\n### 行为方面\n- 减少领地标记（喷尿）\n- 减少逃逸寻找异性\n- 部分攻击行为有所缓解\n\n### 社会责任\n- 减少流浪动物数量\n\n## 最佳绝育时机\n- **猫**：常建议6月龄左右，部分情况更早\n- **母犬**：考虑品种和体型，常在第一次发情前\n- **公犬**：根据品种和发育，遵医嘱\n- 大型犬骨骼发育未完成时需个体化评估\n\n## 注意事项\n\n### 术前\n- 禁食禁水（遵医嘱，通常术前8小时）\n- 术前体检和血液检查\n- 确保疫苗和驱虫到位\n\n### 术后护理\n- 戴伊丽莎白圈防止舔伤口\n- 限制活动7-10天\n- 观察伤口有无红肿渗液\n- 按时复诊拆线（如需）\n\n### 常见误区\n- "发情一次再绝育更好"——无依据，反而增加乳腺肿瘤风险\n- "绝育后会变懒变胖"——体重管理靠饮食和运动\n\n> 具体时机请与兽医根据个体情况讨论，不同品种建议可能不同。',
      cover_image: '',
      related_symptoms: [],
      member_only: true,
      view_count: 0, sort_order: 24, status: 'published',
      published_at: now, created_at: now, updated_at: now
    },
    {
      title: '宠物口腔护理',
      category: 'prevention',
      target_pet: 'all',
      summary: '牙结石和牙周病是宠物最常被忽视的健康问题，定期口腔护理非常重要。',
      content: '## 为什么口腔护理重要\n\n三岁以上的犬猫多数已有不同程度的牙周病，口腔问题不仅影响进食，细菌还可能影响心肾。\n\n## 常见口腔问题\n- **牙结石和牙龈炎**：口臭、牙龈红肿\n- **牙周病**：牙齿松动、流涎、进食困难\n- **猫口炎**：口腔剧烈疼痛、流口水\n- **牙折断**：啃硬物（骨头、鹿角）造成\n- **乳齿滞留**：幼犬猫双排牙\n\n## 预防措施\n\n### 日常刷牙（最有效）\n- 使用宠物专用牙膏（**人用含氟牙膏有毒！**）\n- 从小适应，循序渐进\n- 每周数次，理想每日\n\n### 其他辅助\n- 洁齿零食、漱口水添加剂（VOHC认证产品）\n- 适合的干粮和啃咬玩具\n- 避免过硬的啃咬物（减少牙折断风险）\n\n## 何时就医\n- 持续口臭\n- 牙龈红肿出血\n- 进食困难、流涎\n- 牙齿松动或变色\n\n### 专业清洁\n- 需全麻下洁牙（无麻醉洁牙无法处理牙龈下）\n- 包括拍片评估牙根\n- 严重牙齿可能需要拔除\n\n> 小型犬和短头品种（如巴哥、波斯猫）口腔问题更常见，需更频繁护理。',
      cover_image: '',
      related_symptoms: ['口臭'],
      view_count: 0, sort_order: 25, status: 'published',
      published_at: now, created_at: now, updated_at: now
    },
    {
      title: '宠物定期体检指南',
      category: 'prevention',
      target_pet: 'all',
      summary: '定期体检能在症状出现前发现疾病，不同生命阶段频率不同。',
      content: '## 不同阶段体检频率\n\n### 幼年期（0-1岁）\n- 完成3-4次疫苗前后体检\n- 驱虫、粪便检查\n- 基础发育评估\n\n### 成年期（1-7岁，大型犬1-5岁）\n- 每年一次全面体检\n- 疫苗抗体评估\n- 体重和口腔评估\n\n### 老年期（7岁以上，大型犬5岁以上）\n- 每半年一次\n- 血液检查（肝肾、血糖、甲状腺）\n- 尿液分析\n- 血压、心脏检查\n- 影像学（必要时）\n\n## 常规体检项目\n- **体格检查**：体重、体温、淋巴结、口腔、皮肤\n- **血液常规和生化**：评估器官功能\n- **尿液检查**：肾脏和泌尿系统\n- **粪便检查**：寄生虫\n- **影像学**：X光、超声（按需）\n- **特殊检查**：心脏听诊、血压、眼压\n\n## 体检的价值\n- 早期发现慢性病（肾病、心脏病、肿瘤）\n- 建立基线数据便于对比\n- 个性化健康建议\n- 降低治疗成本（早治比晚治便宜）\n\n## 日常监测\n- 记录体重变化\n- 观察食欲、饮水、排尿排便\n- 关注精神状态和活动量\n\n> 老年宠物肝肾疾病常无明显早期症状，定期血液检查是早发现的关键。',
      cover_image: '',
      related_symptoms: [],
      member_only: true,
      view_count: 0, sort_order: 26, status: 'published',
      published_at: now, created_at: now, updated_at: now
    },
    {
      title: '宠物体重管理',
      category: 'prevention',
      target_pet: 'all',
      summary: '肥胖是宠物最普遍的营养问题，会增加多种疾病风险，科学减重很关键。',
      content: '## 如何判断体重是否健康\n\n### 体态评分（BCS）\n- **理想（4-5/9）**：侧面可见腰线，肋骨易摸到但不可见\n- **偏瘦**：肋骨明显可见\n- **超重/肥胖**：摸不到肋骨、无明显腰线、腹部圆鼓\n\n## 肥胖的健康风险\n- 关节负担加重，加速骨关节炎\n- 心脏病、呼吸困难\n- 糖尿病（猫尤甚）\n- 麻醉和手术风险增加\n- 缩短寿命\n\n## 肥胖原因\n- 喂食过量、零食过多\n- 运动不足\n- 绝育后代谢降低\n- 高龄、内分泌疾病\n\n## 科学减重\n\n### 饮食\n- 改用减重处方粮或低脂粮\n- **精确称量**每日喂食量\n- 减少零食，零食不超过日粮10%\n- 全家统一喂食规则（很重要！）\n- 定时定量，避免自由采食\n\n### 运动\n- 犬：逐步增加散步时长和频率\n- 猫：每天15-30分钟互动游戏\n- 利用漏食玩具增加活动\n\n### 监测\n- 每2-4周称重一次\n- 记录体重曲线\n- 目标减重：每周体重1-2%\n\n> 减重过快对猫有肝脂质沉积症风险，需循序渐进。严重肥胖建议在兽医指导下减重。',
      cover_image: '',
      related_symptoms: ['肥胖'],
      member_only: true,
      view_count: 0, sort_order: 27, status: 'published',
      published_at: now, created_at: now, updated_at: now
    },
    {
      title: '孕产期宠物护理',
      category: 'care',
      target_pet: 'all',
      summary: '怀孕和哺乳期的母宠需要特别的营养和照护，了解产前产后要点。',
      content: '## 孕期护理\n\n### 怀孕判断\n- 配种后3-4周可B超确认\n- 5周后腹部逐渐膨大\n- 后期乳房发育、筑巢行为\n- 犬孕期约63天，猫约65天\n\n### 孕期营养\n- 孕中后期逐步换为幼宠粮或孕产粮\n- 增加喂食量和频次\n- 保证充足饮水\n- 补钙需遵医嘱，避免不当补充\n\n### 孕期注意\n- 避免剧烈运动，但保持适度活动\n- 避免用药和疫苗（除医嘱）\n- 提供安静、温暖的产房\n- 预产期前准备好产箱\n\n## 生产征象\n- 体温下降（犬）\n- 烦躁不安、筑巢\n- 食欲下降\n- 腹部阵缩、用力\n\n## 何时紧急就医\n- 强烈阵缩超过30-60分钟无胎儿产出\n- 胎儿卡住\n- 大量出血\n- 分娩间隔过长（犬超过2小时）\n- 母体极度虚弱\n\n## 产后护理\n- 提供高营养、易消化食物，自由采食\n- 保证饮水充足（哺乳需大量水）\n- 保持环境安静清洁\n- 观察幼崽吃奶情况和母体体温\n- 恶露异常或发热需就医\n\n> 难产在某些品种（如法斗、波斯猫）更常见，建议提前与兽医讨论分娩方案。',
      cover_image: '',
      related_symptoms: [],
      member_only: true,
      view_count: 0, sort_order: 28, status: 'published',
      published_at: now, created_at: now, updated_at: now
    },
    {
      title: '宠物术后护理指南',
      category: 'care',
      target_pet: 'all',
      summary: '手术后的正确护理直接影响恢复效果，了解术后各阶段注意事项。',
      content: '## 术后当天\n\n### 麻醉恢复\n- 保持安静温暖\n- 麻醉完全清醒后才可少量给水\n- 数小时后尝试少量易消化食物\n- 可能出现嗜睡、轻微发抖（通常正常）\n\n### 异常信号（立即联系兽医）\n- 长时间无法清醒\n- 持续呕吐\n- 体温过高或过低\n- 牙龈苍白或发紫\n\n## 伤口护理\n\n### 核心：防止舔咬\n- **全程佩戴伊丽莎白圈**，直到拆线/愈合\n- 舔咬会导致感染、裂开，前功尽弃\n- 必要时穿术后服\n\n### 观察\n- 每日检查伤口：红肿、渗液、异味、开线\n- 保持伤口干燥清洁\n- 不要涂抹任何人用药物\n\n## 活动与饮食\n\n### 活动限制\n- 术后7-14天限制剧烈活动\n- 避免跳跃、奔跑、上下楼梯\n- 散步用牵引绳，按医嘱逐步恢复\n\n### 饮食\n- 术后初期少量多餐\n- 营养均衡，必要时用术后恢复粮\n- 保证饮水\n\n## 用药与复诊\n- 严格按医嘱使用止痛药、抗生素\n- **不要自行停药**\n- 按时复诊、拆线\n\n> 术后宠物可能因疼痛表现得安静或躲藏，这是正常的。但若精神持续极差需联系兽医。',
      cover_image: '',
      related_symptoms: [],
      member_only: true,
      view_count: 0, sort_order: 29, status: 'published',
      published_at: now, created_at: now, updated_at: now
    },
    {
      title: '夏季防暑降温指南',
      category: 'care',
      target_pet: 'all',
      summary: '宠物散热能力弱，夏季极易中暑甚至危及生命，做好预防至关重要。',
      content: '## 为什么宠物怕热\n\n- 犬猫主要靠吐舌喘气和脚垫散热，几乎不出汗\n- **短头品种**（巴哥、法斗、波斯猫、加菲猫）散热更差，风险极高\n- 老年、肥胖、心脏病宠物更危险\n\n## 中暑的表现\n- **过度喘息**、流大量口水\n- 体温升高（正常38-39°C，中暑可达41°C以上）\n- 舌头牙龈鲜红或发紫\n- 虚弱、走路摇晃\n- 呕吐、腹泻（可能带血）\n- 抽搐、昏迷\n\n## 中暑急救\n\n### 立即降温\n- 转移到阴凉通风处\n- 用常温水（**不要冰水！**）淋湿身体，尤其腹部、脚垫、腋下\n- 用风扇吹、湿毛巾覆盖\n- **同时立即送医**——中暑是致命急症\n\n### 注意\n- 不要用冰水（会引起血管收缩反而不利散热）\n- 不要强行灌水\n- 降温到39°C即可停止过度降温\n\n## 预防措施\n\n### 环境\n- 提供阴凉避暑处\n- 室内开空调或风扇\n- 保证充足饮水，多处放水碗\n\n### 外出\n- **永远不要把宠物单独留在车内**——即使几分钟、开窗也不行\n- 避开正午高温时段遛狗，选清晨傍晚\n- 避免在炎热路面行走（手背试温，烫手就不行）\n- 高温日减少运动量\n\n> 中暑是可预防的致命急症，短头犬猫主人尤其要警惕。',
      cover_image: '',
      related_symptoms: ['中暑', '呼吸困难'],
      member_only: true,
      view_count: 0, sort_order: 30, status: 'published',
      published_at: now, created_at: now, updated_at: now
    }
  ];
}

function getInitialReportTemplates() {
  const now = new Date();
  const disclaimer = '本报告由 AI 根据公开医学资料及平台知识库生成，仅供参考，不具备医疗诊断效力。所有治疗决策请咨询执业兽医师。平台不承担因依赖本报告而产生的任何法律责任。';

  const templateBase = {
    symptoms_key: 'general',
    pet_type: 'all',
    age_range: 'adult',
    created_at: now,
    updated_at: now
  };

  const lowRiskVariants = [
    {
      risk_summary: '根据您描述的症状，当前整体风险较低。大多数情况下可以通过家庭护理观察处理，但请保持关注。',
      symptom_analysis: [{ name: '{{symptom_name}}', explanation: '这种症状在宠物中较为常见，通常与饮食、环境变化或轻微感染有关。如果只是偶发且精神状态良好，一般不需要过度担心。' }],
      home_care: ['保证充足的清洁饮水', '提供易消化的食物，少量多餐', '保持休息环境安静舒适', '观察24-48小时，记录症状变化'],
      observation_indicators: ['精神和活动量是否正常', '食欲和饮水量变化', '排泄物的形态和频率', '体温是否在正常范围'],
      escalation_signals: ['症状持续超过48小时未好转', '出现新的症状', '精神明显变差', '完全不愿进食或饮水'],
      vet_recommendation: { needed: false, urgency: 'low', what_to_tell_vet: '如就诊，请告知兽医：症状起始时间、频率、是否喂过药物、饮食变化情况。' },
      common_misconceptions: [{ myth: '宠物不吃东西就是挑食', fact: '食欲下降可能是疾病的早期信号，持续24小时以上应引起重视。' }]
    },
    {
      risk_summary: '您宠物目前的症状表现属于低风险范围，可以先在家观察护理。请按以下建议操作并留意变化。',
      symptom_analysis: [{ name: '{{symptom_name}}', explanation: '该症状可能是身体对轻微刺激的正常反应。在排除外伤、中毒等因素后，通常可以通过休息和护理自行恢复。' }],
      home_care: ['暂时减少活动量，避免剧烈运动', '维持正常饮食节奏', '避免喂食人用药', '记录症状出现的时间和变化'],
      observation_indicators: ['症状是否逐渐减轻', '有无新的不适表现', '睡眠和活动是否规律', '体重是否有变化'],
      escalation_signals: ['症状加重或频繁出现', '伴随呕吐或腹泻', '体温异常升高或降低', '出现呼吸困难'],
      vet_recommendation: { needed: false, urgency: 'low', what_to_tell_vet: '就诊时带上：症状记录、近期饮食清单、用药史（如有）、疫苗记录。' },
      common_misconceptions: [{ myth: '给宠物喂人用药没关系', fact: '许多人用药对宠物有毒（如对乙酰氨基酚），请务必咨询兽医后再用药。' }]
    }
  ];

  const midRiskVariants = [
    {
      risk_summary: '您宠物的症状需要关注，存在中等程度的风险。建议在24小时内咨询兽医，同时做好家庭护理。',
      symptom_analysis: [{ name: '{{symptom_name}}', explanation: '这种症状组合提示可能存在需要医疗介入的问题。延误治疗可能导致病情恶化，建议尽早寻求专业帮助。' }],
      home_care: ['保持宠物安静休息，减少刺激', '少量多次提供温水', '暂时禁食4-6小时后给予易消化食物', '不要自行给宠物服药'],
      observation_indicators: ['症状频率和严重程度变化', '是否出现脱水迹象（皮肤弹性、牙龈颜色）', '体温变化', '精神状态波动'],
      escalation_signals: ['症状在6小时内明显加重', '出现高热（体温>40°C）', '完全拒食拒水', '出现呼吸困难或频繁呕吐'],
      vet_recommendation: { needed: true, urgency: 'medium', what_to_tell_vet: '请告知兽医：症状起始时间和演变过程、饮食和排泄变化、是否接触过其他病宠、疫苗和驱虫状态。' },
      common_misconceptions: [{ myth: '等一等可能就好了', fact: '中风险症状延误治疗可能导致病情加重，24小时内就诊可显著提高治疗效果。' }]
    },
    {
      risk_summary: '根据症状分析，您的宠物需要较密切的观察和及时的医疗评估。请尽快联系宠物医院安排就诊。',
      symptom_analysis: [{ name: '{{symptom_name}}', explanation: '症状表明宠物的身体机能受到了一定程度的影响，需要专业诊断来确定具体原因并制定治疗方案。' }],
      home_care: ['保持环境安静温暖', '准备就诊时需要带的信息（症状记录、用药史）', '如果宠物允许，检查口腔和牙龈颜色', '记录排泄物的状态拍照供兽医参考'],
      observation_indicators: ['每小时检查一次精神状态', '记录饮水量和排尿量', '监测体温变化', '观察呼吸频率和深度'],
      escalation_signals: ['出现任何高风险信号（抽搐、昏迷、呼吸困难）', '体温超过40.5°C', '牙龈发白或发紫', '腹部肿胀或触痛'],
      vet_recommendation: { needed: true, urgency: 'medium', what_to_tell_vet: '带上：详细症状记录（时间线）、近期饮食变化、疫苗本、之前的检查报告。' },
      common_misconceptions: [{ myth: '宠物精神还好就不用急着看病', fact: '动物本能会隐藏不适，中风险症状下即使精神尚可也应尽快检查。' }]
    }
  ];

  const highRiskVariants = [
    {
      risk_summary: '⚠️ 您的宠物出现了高风险症状，需要立即就医！请不要拖延，尽快前往最近的宠物医院。',
      symptom_analysis: [{ name: '{{symptom_name}}', explanation: '这是需要紧急处理的高风险症状，可能涉及严重的健康问题。延迟治疗可能导致严重后果甚至危及生命。' }],
      home_care: ['立即联系最近的宠物医院或24小时急诊', '保持宠物安静，不要强行喂食或喂水', '如怀疑中毒，保留可疑物质样本', '前往医院的路上注意保暖和固定'],
      observation_indicators: ['意识状态是否清醒', '呼吸是否困难', '牙龈颜色（正常粉红，异常白色/蓝色）', '是否有出血'],
      escalation_signals: ['意识模糊或昏迷', '持续抽搐', '严重呼吸困难', '大量出血'],
      vet_recommendation: { needed: true, urgency: 'high', what_to_tell_vet: '紧急告知：症状名称和起始时间、可能的原因（中毒、外伤等）、宠物品种和年龄、当前用药。' },
      common_misconceptions: [{ myth: '等到第二天早上去医院也不迟', fact: '高风险症状需要立即处理，每小时的延误都可能影响预后。请立即前往24小时急诊医院。' }]
    },
    {
      risk_summary: '🚨 紧急情况：您宠物的症状非常危险，请立即前往宠物医院急诊！时间就是生命。',
      symptom_analysis: [{ name: '{{symptom_name}}', explanation: '这种症状属于紧急医疗状况，可能涉及重要器官的功能障碍。必须由兽医进行紧急评估和处理。' }],
      home_care: ['不要犹豫，立即出发去最近的急诊医院', '运输过程中保持宠物平稳，减少晃动', '如有可能，提前电话通知医院准备', '带上宠物的疫苗本和所有药物'],
      observation_indicators: ['呼吸频率（正常犬10-30次/分，猫20-30次/分）', '心率是否异常', '瞳孔反应', '体表温度'],
      escalation_signals: ['呼吸停止', '心脏骤停', '严重出血不止', '体温骤降或骤升'],
      vet_recommendation: { needed: true, urgency: 'high', what_to_tell_vet: '电话告知核心信息：症状、品种年龄、体重，让医院提前准备急救设备和药品。' },
      common_misconceptions: [{ myth: '自己先喂点药看看情况', fact: '高风险情况下自行用药可能加重病情，如用药会干扰兽医诊断和治疗方案的制定。' }]
    }
  ];

  const templates = [];

  lowRiskVariants.forEach(function(v, i) {
    templates.push(Object.assign({}, templateBase, { risk_level: 'low', variant: i + 1, content: Object.assign({}, v, { disclaimer: disclaimer }) }));
  });

  midRiskVariants.forEach(function(v, i) {
    templates.push(Object.assign({}, templateBase, { risk_level: 'mid', variant: i + 1, content: Object.assign({}, v, { disclaimer: disclaimer }) }));
  });

  highRiskVariants.forEach(function(v, i) {
    templates.push(Object.assign({}, templateBase, { risk_level: 'high', variant: i + 1, content: Object.assign({}, v, { disclaimer: disclaimer }) }));
  });

  return templates;
}

module.exports = { SAMPLE_PETS, INITIAL_HOSPITALS, getInitialKnowledgeArticles, getInitialReportTemplates, getInitialCouponTemplates };

/**
 * V1.5 优惠券种子模板
 * 10 种优惠券覆盖所有 autoIssueCoupon 场景 + 用户手动领取
 */
function getInitialCouponTemplates() {
  const now = new Date();

  return [
    {
      name: '新用户专享券',
      type: 'report',
      discount_type: 'fixed',
      discount_value: 890,         // 减 ¥8.90 → 报告实付 ¥1.00
      min_amount: 990,             // 满 ¥9.90 可用
      validity_days: 7,
      scene: 'new_user',
      total_limit: null,           // 不限
      per_user_limit: 1,
      total_issued: 0,
      is_active: true,
      created_at: now,
    },
    {
      name: '新用户 8 折券',
      type: 'report',
      discount_type: 'percent',
      discount_value: 80,          // 8 折
      min_amount: 0,
      validity_days: 7,
      scene: 'new_user',
      total_limit: null,
      per_user_limit: 1,
      total_issued: 0,
      is_active: true,
      created_at: now,
    },
    {
      name: '邀请奖励券',
      type: 'report',
      discount_type: 'fixed',
      discount_value: 300,         // 减 ¥3.00
      min_amount: 0,               // 无门槛
      validity_days: 30,
      scene: 'invite',
      total_limit: null,
      per_user_limit: 10,
      total_issued: 0,
      is_active: true,
      created_at: now,
    },
    {
      name: '回访奖励券',
      type: 'report',
      discount_type: 'fixed',
      discount_value: 300,         // 减 ¥3.00
      min_amount: 0,
      validity_days: 30,
      scene: 'followup',
      total_limit: null,
      per_user_limit: 5,
      total_issued: 0,
      is_active: true,
      created_at: now,
    },
    {
      name: '回访 8 折券',
      type: 'universal',
      discount_type: 'percent',
      discount_value: 80,          // 8 折
      min_amount: 0,
      validity_days: 30,
      scene: 'followup',
      total_limit: null,
      per_user_limit: 1,
      total_issued: 0,
      is_active: true,
      created_at: now,
    },
    {
      name: '续费 8 折券',
      type: 'member',
      discount_type: 'percent',
      discount_value: 80,          // 8 折
      min_amount: 0,
      validity_days: 15,
      scene: 'renew',
      total_limit: null,
      per_user_limit: 1,
      total_issued: 0,
      is_active: true,
      created_at: now,
    },
    {
      name: '回归券',
      type: 'universal',
      discount_type: 'fixed',
      discount_value: 500,         // 减 ¥5.00
      min_amount: 0,               // 无门槛
      validity_days: 15,
      scene: 'return',
      total_limit: null,
      per_user_limit: 1,
      total_issued: 0,
      is_active: true,
      created_at: now,
    },
    {
      name: '邀请 5 人会员券',
      type: 'member',
      discount_type: 'fixed',
      discount_value: 500,         // 减 ¥5.00
      min_amount: 0,
      validity_days: 30,
      scene: 'invite_milestone_5',
      total_limit: null,
      per_user_limit: 1,
      total_issued: 0,
      is_active: true,
      created_at: now,
    },
    {
      name: '通用减 1 元券',
      type: 'universal',
      discount_type: 'fixed',
      discount_value: 100,         // 减 ¥1.00
      min_amount: 0,
      validity_days: 30,
      scene: 'universal',
      total_limit: 1000,
      per_user_limit: 1,
      total_issued: 0,
      is_active: true,
      created_at: now,
    },
    {
      name: '报告满减券',
      type: 'report',
      discount_type: 'fixed',
      discount_value: 500,         // 减 ¥5.00
      min_amount: 990,             // 满 ¥9.90 可用
      validity_days: 15,
      scene: 'universal',
      total_limit: 500,
      per_user_limit: 1,
      total_issued: 0,
      is_active: true,
      created_at: now,
    },
  ];
}
