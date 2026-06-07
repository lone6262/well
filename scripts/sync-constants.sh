#!/bin/bash
# 同步脚本已废弃
# 所有云函数现在直接从 ../common/ 导入共享模块（auth.js、constants.js、report-engine.js）
# 无需执行文件复制同步操作
# 废弃日期: 2026-06-03

echo "=============================================="
echo " sync-constants.sh 已废弃"
echo "=============================================="
echo ""
echo " 云函数现在通过 require('../common/xxx') 导入共享模块，"
echo " 无需将文件复制到各个云函数目录。"
echo ""
echo " 如发现任何云函数使用了 ./constants 或 ./auth，"
echo " 请修改为 require('../common/constants') 或 require('../common/auth')。"
echo ""
echo " 当前共享模块位于 cloudfunctions/common/："
echo "   - auth.js         认证工具（generateToken, verifyToken, authenticate）"
echo "   - constants.js    全局常量（集合名、状态码、价格等）"
echo "   - report-engine.js 报告模板引擎"
echo "=============================================="
exit 0
