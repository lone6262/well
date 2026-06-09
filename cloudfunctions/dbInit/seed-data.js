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
