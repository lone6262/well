#!/bin/bash
# 部署前验证脚本
# 用法: bash scripts/pre-deploy-check.sh
# 在部署云函数之前运行，确保关键安全问题已修复

PASS=0
FAIL=0

check() {
  local label="$1"
  local result="$2"
  if [ "$result" = "pass" ]; then
    echo "  ✅ $label"
    PASS=$((PASS + 1))
  else
    echo "  ❌ $label"
    FAIL=$((FAIL + 1))
  fi
}

echo "=============================================="
echo " 部署前检查 — 宠物症状自查小程序"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "=============================================="
echo ""

# 1. 密钥配置检查
echo "--- 安全检查 ---"
# 检查 secrets.js 是否存在且密钥已替换
[ -f cloudfunctions/common/secrets.js ] && check "secrets.js 存在" pass || check "secrets.js 存在（请复制 secrets.example.js 并重命名）" fail

if [ -f cloudfunctions/common/secrets.js ]; then
  DEFAULT_MAP_KEY=$(grep -c "YOUR_TENCENT_MAP_KEY_HERE" cloudfunctions/common/secrets.js 2>/dev/null)
  check "腾讯地图 Key 已替换（非默认值）" "$([ "$DEFAULT_MAP_KEY" -eq 0 ] && echo pass || echo fail)"

  DEFAULT_TOKEN=$(grep -c "well_pet_health_token_secret_2025" cloudfunctions/common/secrets.js 2>/dev/null)
  check "TOKEN_SECRET 已替换（非默认值）" "$([ "$DEFAULT_TOKEN" -eq 0 ] && echo pass || echo fail)"
fi

# 检查 secrets.js 未被意外提交到 Git
SECRETS_TRACKED=$(git ls-files cloudfunctions/common/secrets.js 2>/dev/null | wc -l)
check "secrets.js 未被 Git 追踪" "$([ "$SECRETS_TRACKED" -eq 0 ] && echo pass || echo fail)"

# 2. 本地 auth.js 检查
LOCAL_AUTH=$(find cloudfunctions -path "*/auth.js" ! -path "*/common/auth.js" ! -path "*/node_modules/*" | wc -l)
check "无本地 auth.js 副本 (仅 common/auth.js)" "$([ "$LOCAL_AUTH" -eq 0 ] && echo pass || echo fail)"

# 3. 本地 constants.js 检查
LOCAL_CONST=$(find cloudfunctions -name "constants.js" ! -path "*/common/constants.js" ! -path "*/node_modules/*" | wc -l)
check "无本地 constants.js 副本 (仅 common/constants.js)" "$([ "$LOCAL_CONST" -eq 0 ] && echo pass || echo fail)"

# 4. MOCK_PAY 检查
MOCK_PAY=$(grep -r "MOCK_PAY = true" cloudfunctions/ --include="*.js" 2>/dev/null | grep -v node_modules | wc -l)
check "MOCK_PAY 未硬编码为 true" "$([ "$MOCK_PAY" -eq 0 ] && echo pass || echo fail)"

# 5. var 声明检查
echo ""
echo "--- 代码规范 ---"
VAR_COUNT=$(grep -rn '\bvar\b' cloudfunctions/ miniprogram/ --include="*.js" 2>/dev/null | grep -v node_modules | wc -l)
check "无 var 声明 (应使用 const/let)" "$([ "$VAR_COUNT" -eq 0 ] && echo pass || echo fail)"

# 6. require 路径检查
echo ""
echo "--- 导入路径 ---"
BAD_CONSTANTS=$(grep -rn "require('./constants')" cloudfunctions/ --include="*.js" 2>/dev/null | grep -v node_modules | grep -v "common/" | wc -l)
check "无本地 ./constants 引用 (应使用 ../common/constants)" "$([ "$BAD_CONSTANTS" -eq 0 ] && echo pass || echo fail)"

BAD_AUTH=$(grep -rn "require('./auth')" cloudfunctions/ --include="*.js" 2>/dev/null | grep -v node_modules | wc -l)
check "无本地 ./auth 引用 (应使用 ../common/auth)" "$([ "$BAD_AUTH" -eq 0 ] && echo pass || echo fail)"

# 7. 共享模块存在性
echo ""
echo "--- 共享模块 ---"
[ -f cloudfunctions/common/auth.js ] && check "common/auth.js 存在" pass || check "common/auth.js 存在" fail
[ -f cloudfunctions/common/constants.js ] && check "common/constants.js 存在" pass || check "common/constants.js 存在" fail
[ -f cloudfunctions/common/report-engine.js ] && check "common/report-engine.js 存在" pass || check "common/report-engine.js 存在" fail
[ -f cloudfunctions/common/db.js ] && check "common/db.js 存在" pass || check "common/db.js 存在" fail
[ -f cloudfunctions/common/error-handler.js ] && check "common/error-handler.js 存在" pass || check "common/error-handler.js 存在" fail
[ -f cloudfunctions/common/logger.js ] && check "common/logger.js 存在" pass || check "common/logger.js 存在" fail
[ -f cloudfunctions/common/rate-limiter.js ] && check "common/rate-limiter.js 存在" pass || check "common/rate-limiter.js 存在" fail

echo ""
echo "=============================================="
echo " 结果: $PASS 通过, $FAIL 失败"
echo "=============================================="

if [ "$FAIL" -gt 0 ]; then
  echo "⚠️  存在 $FAIL 个问题，请在部署前修复"
  exit 1
else
  echo "✅ 全部检查通过，可以部署"
  exit 0
fi
