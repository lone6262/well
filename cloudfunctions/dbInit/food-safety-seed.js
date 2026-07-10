// 食物安全种子数据 - 从 Obsidian 知识库提取
// 数据来源：ASPCA毒物列表、Cornell Feline Health Center、兽医临床指南
// 覆盖：猫+狗，安全/谨慎/危险三级

module.exports = [
  // ===== 致命级（猫狗均危险） =====
  {
    name: '巧克力', category: '零食', aliases: ['chocolate', '可可'],
    cat_safety: 'danger', dog_safety: 'danger',
    effect: '含可可碱，导致心律不齐、癫痫、甚至死亡。烘焙巧克力毒性最强。',
    alternative: '宠物专用零食',
    severity: 5, status: 'published'
  },
  {
    name: '葡萄', category: '水果', aliases: ['grape', '葡萄干', 'raisin'],
    cat_safety: 'danger', dog_safety: 'danger',
    effect: '可导致急性肾衰竭，极少量即可致病。葡萄干毒性更集中。',
    alternative: '蓝莓（少量）',
    severity: 5, status: 'published'
  },
  {
    name: '葡萄干', category: '零食', aliases: ['raisin'],
    cat_safety: 'danger', dog_safety: 'danger',
    effect: '葡萄干的毒性比鲜葡萄更集中，极少量即可导致急性肾衰竭。',
    alternative: '冻干肉粒',
    severity: 5, status: 'published'
  },
  {
    name: '洋葱', category: '蔬菜', aliases: ['onion', '洋葱粉'],
    cat_safety: 'danger', dog_safety: 'danger',
    effect: '破坏红细胞，导致溶血性贫血。任何形式（生/熟/粉）均有毒。',
    alternative: '无安全替代',
    severity: 5, status: 'published'
  },
  {
    name: '大蒜', category: '蔬菜', aliases: ['garlic', '蒜粉'],
    cat_safety: 'danger', dog_safety: 'danger',
    effect: '比洋葱毒性更强，破坏红细胞导致溶血性贫血。任何形式均有毒。',
    alternative: '无安全替代',
    severity: 5, status: 'published'
  },
  {
    name: '韭菜', category: '蔬菜', aliases: ['chive', 'leek'],
    cat_safety: 'danger', dog_safety: 'danger',
    effect: '与洋葱大蒜同类，破坏红细胞导致溶血性贫血。',
    alternative: '无安全替代',
    severity: 4, status: 'published'
  },
  {
    name: '木糖醇', category: '添加剂', aliases: ['xylitol', '无糖口香糖', '无糖食品'],
    cat_safety: 'danger', dog_safety: 'danger',
    effect: '引发胰岛素大量释放，导致低血糖、肝衰竭。常见于无糖口香糖、花生酱。',
    alternative: '无安全替代',
    severity: 5, status: 'published'
  },
  {
    name: '酒精', category: '饮料', aliases: ['alcohol', '乙醇', '酒'],
    cat_safety: 'danger', dog_safety: 'danger',
    effect: '抑制中枢神经，导致呼吸困难、低血糖、体温过低。',
    alternative: '无安全替代',
    severity: 5, status: 'published'
  },
  {
    name: '咖啡因', category: '饮料', aliases: ['caffeine', '咖啡', '茶', 'energy drink'],
    cat_safety: 'danger', dog_safety: 'danger',
    effect: '刺激心脏和神经系统，导致心律失常、震颤。',
    alternative: '无安全替代',
    severity: 4, status: 'published'
  },

  // ===== 猫特有危险 =====
  {
    name: '百合', category: '植物', aliases: ['lily', '百合花'],
    cat_safety: 'danger', dog_safety: 'caution',
    effect: '猫特有毒物！所有部位（花/叶/茎/花粉/水）均可致急性肾衰竭。极少量即可致命。狗可能出现肠胃不适。',
    alternative: '猫草（小麦草/燕麦草）',
    severity: 5, status: 'published'
  },

  // ===== 高风险 =====
  {
    name: '牛油果', category: '水果', aliases: ['avocado'],
    cat_safety: 'danger', dog_safety: 'caution',
    effect: '含Persin，引起呕吐腹泻。果核有窒息风险。',
    alternative: '少量煮熟的南瓜',
    severity: 3, status: 'published'
  },
  {
    name: '夏威夷果', category: '坚果', aliases: ['macadamia', '澳洲坚果'],
    cat_safety: 'caution', dog_safety: 'danger',
    effect: '狗食用后引起虚弱、呕吐、体温升高、后腿无力。猫风险较低但仍不建议。',
    alternative: '少量花生酱（无木糖醇）',
    severity: 3, status: 'published'
  },
  {
    name: '煮熟的骨头', category: '其他', aliases: ['bone', '鸡骨', '骨头'],
    cat_safety: 'danger', dog_safety: 'danger',
    effect: '煮熟后碎裂，可导致消化道穿孔、梗阻。特别是禽类骨头最危险。',
    alternative: '宠物专用磨牙骨',
    severity: 4, status: 'published'
  },

  // ===== 中风险 =====
  {
    name: '生鸡蛋', category: '其他', aliases: ['raw egg'],
    cat_safety: 'caution', dog_safety: 'caution',
    effect: '含卵白素影响生物素吸收，且有沙门氏菌风险。必须全熟后喂食。',
    alternative: '熟鸡蛋（全熟去壳）',
    severity: 2, status: 'published'
  },
  {
    name: '生肉', category: '肉类', aliases: ['raw meat', '生鱼肉'],
    cat_safety: 'caution', dog_safety: 'caution',
    effect: '寄生虫和沙门氏菌风险。如喂生骨肉需选用经过冷冻杀菌处理的专业食材。',
    alternative: '煮熟的鸡胸肉（无盐无调味）',
    severity: 2, status: 'published'
  },
  {
    name: '牛奶', category: '饮料', aliases: ['milk', 'cow milk'],
    cat_safety: 'caution', dog_safety: 'caution',
    effect: '多数成年犬猫存在乳糖不耐受，饮用后可能腹泻胀气。',
    alternative: '宠物专用羊奶粉或无糖酸奶（少量）',
    severity: 1, status: 'published'
  },

  // ===== 谨慎级（少量可以） =====
  {
    name: '西瓜', category: '水果', aliases: ['watermelon'],
    cat_safety: 'caution', dog_safety: 'caution',
    effect: '少量去籽果肉可以，籽和皮不能吃。含糖量高，不宜多喂。',
    alternative: '冻干西瓜（少量）',
    severity: 1, status: 'published'
  },
  {
    name: '蓝莓', category: '水果', aliases: ['blueberry'],
    cat_safety: 'safe', dog_safety: 'safe',
    effect: '安全，富含抗氧化物。少量喂食即可，不超过日粮5%。',
    alternative: '可直接喂食（少量）',
    severity: 1, status: 'published'
  },
  {
    name: '胡萝卜', category: '蔬菜', aliases: ['carrot'],
    cat_safety: 'safe', dog_safety: 'safe',
    effect: '安全，富含维生素A。必须蒸熟切碎后喂食，不可生食过量。',
    alternative: '可直接喂食（蒸熟切碎）',
    severity: 1, status: 'published'
  },
  {
    name: '南瓜', category: '蔬菜', aliases: ['pumpkin', '南瓜泥'],
    cat_safety: 'safe', dog_safety: 'safe',
    effect: '安全，有助消化、缓解毛球。需蒸熟，使用纯南瓜泥（无添加）。',
    alternative: '可直接喂食（蒸熟）',
    severity: 1, status: 'published'
  },

  // ===== 安全食物 =====
  {
    name: '水煮鸡胸肉', category: '肉类', aliases: ['chicken', '鸡胸肉', 'chicken breast'],
    cat_safety: 'safe', dog_safety: 'safe',
    effect: '安全，优质蛋白质来源。需无盐无调味煮熟，不超过日粮10%。',
    alternative: '可直接喂食（无盐煮熟）',
    severity: 1, status: 'published'
  },
  {
    name: '水煮鱼肉', category: '肉类', aliases: ['fish', '鱼肉'],
    cat_safety: 'safe', dog_safety: 'safe',
    effect: '安全，需去骨煮熟。避免金枪鱼（重金属累积风险）。不超过日粮10%。',
    alternative: '三文鱼（煮熟去骨）',
    severity: 1, status: 'published'
  },
  {
    name: '熟鸡蛋', category: '其他', aliases: ['egg', '鸡蛋', 'boiled egg'],
    cat_safety: 'safe', dog_safety: 'safe',
    effect: '安全，优质蛋白质来源。必须全熟去壳，不建议生食。',
    alternative: '可直接喂食（全熟）',
    severity: 1, status: 'published'
  },
  {
    name: '猫草', category: '植物', aliases: ['cat grass', '小麦草', '燕麦草'],
    cat_safety: 'safe', dog_safety: 'safe',
    effect: '安全，促进排毛球，提供纤维。猫尤其受益。',
    alternative: '可直接种植喂食',
    severity: 1, status: 'published'
  },
  {
    name: '樱桃', category: '水果', aliases: ['cherry', '车厘子'],
    cat_safety: 'caution', dog_safety: 'danger',
    effect: '果肉少量无毒，但果核、茎、叶含氰苷，狗食用后可致氰化物中毒、呼吸困难。猫风险较低但仍需去核。',
    alternative: '少量去核果肉',
    severity: 3, status: 'published'
  }
];
