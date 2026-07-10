#!/bin/bash
# sync-common.sh — 将 cloudfunctions/common/ 同步到每个云函数的 common/ 子目录
#
# 背景说明:
#   微信云开发部署时，每个云函数只打包自身目录下的文件，
#   require('../common/xxx') 在云端无法找到模块。
#   因此需要将 cloudfunctions/common/ 的内容复制到各云函数的 common/ 子目录。
#
#   ⚠️  各云函数下的 common/ 已在 .gitignore 中排除，
#   唯一源码在 cloudfunctions/common/，请只修改那里的文件。
#
# 用法:
#   bash scripts/sync-common.sh           # 同步所有云函数
#   bash scripts/sync-common.sh --check    # 仅检查差异，不同步

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMMON_DIR="$PROJECT_ROOT/cloudfunctions/common"
CF_ROOT="$PROJECT_ROOT/cloudfunctions"

CHECK_ONLY=false
[ "${1:-}" = "--check" ] && CHECK_ONLY=true

# common 目录中需要同步的 JS 文件（排除 secrets.example.js）
SYNC_FILES=()
for f in "$COMMON_DIR"/*.js; do
  basename_f=$(basename "$f")
  [ "$basename_f" = "secrets.example.js" ] && continue
  SYNC_FILES+=("$f")
done

if [ ${#SYNC_FILES[@]} -eq 0 ]; then
  echo "❌ cloudfunctions/common/ 下没有找到可同步的 .js 文件"
  exit 1
fi

echo "=== 同步 common 模块到各云函数目录 ==="
echo "  源目录: cloudfunctions/common/ (${#SYNC_FILES[@]} 个文件)"
if $CHECK_ONLY; then
  echo "  模式: 仅检查 (--check)"
else
  echo "  模式: 执行同步"
fi
echo ""

COPIED=0
SKIPPED=0
STALE=0
MISMATCH=0
TOTAL=0

for func_dir in "$CF_ROOT"/*/; do
  func_name=$(basename "$func_dir")

  # 跳过 common 自身
  [ "$func_name" = "common" ] && continue

  # 跳过没有 index.js 的目录（不是云函数）
  [ ! -f "$func_dir/index.js" ] && continue

  TOTAL=$((TOTAL + 1))

  # 检查该函数是否引用了 ./common/
  if grep -q "require.*['\"]\./common/" "$func_dir/index.js" 2>/dev/null; then
    target_dir="$func_dir/common"

    # 检查目标目录中的文件是否与源一致
    need_sync=false
    mismatch_list=""

    for src_file in "${SYNC_FILES[@]}"; do
      filename=$(basename "$src_file")
      target_file="$target_dir/$filename"

      if [ ! -f "$target_file" ]; then
        need_sync=true
        mismatch_list="$mismatch_list  ⚠️  缺失: $filename"
      elif ! diff -q "$src_file" "$target_file" > /dev/null 2>&1; then
        need_sync=true
        mismatch_list="$mismatch_list  🔄 已变更: $filename"
      fi
    done

    # 检查目标目录中是否有多余文件
    for target_file in "$target_dir"/*.js; do
      [ ! -f "$target_file" ] && continue
      filename=$(basename "$target_file")
      found=false
      for src_file in "${SYNC_FILES[@]}"; do
        [ "$(basename "$src_file")" = "$filename" ] && found=true && break
      done
      if ! $found && [ "$filename" != "secrets.js" ]; then
        # 非源文件、非 secrets.js → 已过时
        mismatch_list="$mismatch_list  🗑️  过时: $filename (源目录中已删除)"
        STALE=$((STALE + 1))
      fi
    done

    if $CHECK_ONLY; then
      if $need_sync; then
        echo "  ❌ $func_name — 需要同步"
        echo "$mismatch_list"
        MISMATCH=$((MISMATCH + 1))
      else
        echo "  ✅ $func_name — 已是最新"
      fi
    else
      # 执行同步
      mkdir -p "$target_dir"

      for src_file in "${SYNC_FILES[@]}"; do
        cp "$src_file" "$target_dir/"
      done

      # 清理过时文件（保留 secrets.js）
      for target_file in "$target_dir"/*.js; do
        [ ! -f "$target_file" ] && continue
        filename=$(basename "$target_file")
        [ "$filename" = "secrets.js" ] && continue
        found=false
        for src_file in "${SYNC_FILES[@]}"; do
          [ "$(basename "$src_file")" = "$filename" ] && found=true && break
        done
        if ! $found; then
          rm "$target_file"
          echo "    🗑️  清理过时文件: $filename"
        fi
      done

      if $need_sync; then
        echo "  🔄 $func_name — 已同步 (有变更)"
      else
        echo "  ✅ $func_name — 已同步 (无变更)"
      fi
      COPIED=$((COPIED + 1))
    fi
  else
    SKIPPED=$((SKIPPED + 1))
  fi
done

echo ""
echo "=== 结果 ==="
if $CHECK_ONLY; then
  echo "  ✅ 同步: $((TOTAL - MISMATCH - SKIPPED)) / $TOTAL"
  echo "  ❌ 需同步: $MISMATCH"
  echo "  ⏭️  不使用 common: $SKIPPED"
  if [ "$MISMATCH" -gt 0 ]; then
    echo ""
    echo "  ⚠️  有 $MISMATCH 个云函数需要同步，请运行: bash scripts/sync-common.sh"
    exit 1
  else
    echo ""
    echo "  🎉 所有云函数的 common/ 都是最新版本！"
    exit 0
  fi
else
  echo "  📦 已同步: $COPIED 个云函数"
  echo "  ⏭️  不使用 common: $SKIPPED"
  echo ""
  echo "  💡 提示: 现在可以在微信开发者工具中上传部署云函数了"
  echo "  💡 提示: common/ 副本已在 .gitignore 中排除，不会提交到 Git"
fi
