#!/bin/bash
# sync-common.sh — 将 cloudfunctions/common/ 同步到每个云函数的 common/ 子目录
# 用法: bash scripts/sync-common.sh
#
# 修改 common/ 下的文件后，运行此脚本，再部署云函数

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMMON_DIR="$PROJECT_ROOT/cloudfunctions/common"
CF_ROOT="$PROJECT_ROOT/cloudfunctions"

# common 目录中需要同步的文件（排除 package.json、secrets.example.js）
SYNC_FILES=$(ls "$COMMON_DIR"/*.js 2>/dev/null | grep -v 'secrets.example')

echo "=== 同步 common 模块到各云函数目录 ==="
echo ""

COPIED=0
SKIPPED=0

for func_dir in "$CF_ROOT"/*/; do
  func_name=$(basename "$func_dir")

  # 跳过 common 自身
  [ "$func_name" = "common" ] && continue

  # 跳过没有 index.js 的目录（不是云函数）
  [ ! -f "$func_dir/index.js" ] && continue

  # 检查该函数是否引用了 ../common/ 或 ./common/
  if grep -q "require.*common/" "$func_dir/index.js" 2>/dev/null; then
    target_dir="$func_dir/common"
    mkdir -p "$target_dir"

    for file in $SYNC_FILES; do
      cp "$file" "$target_dir/"
    done

    # V1.6: 清理旧版 secrets.js（密钥已迁移到数据库 system_config）
    [ -f "$target_dir/secrets.js" ] && rm "$target_dir/secrets.js"

    echo "  ✅ $func_name"
    COPIED=$((COPIED + 1))
  else
    SKIPPED=$((SKIPPED + 1))
  fi
done

echo ""
echo "=== 完成: $COPIED 个函数已同步, $SKIPPED 个函数无需同步 ==="
