#!/usr/bin/env node
/**
 * 统一测试运行器（自研框架专用）
 * 逐个执行 __tests__/ 下所有 *.test.js，汇总通过/失败计数与退出码。
 *
 * 用法： node scripts/run-tests.js [--unit|--integration|--all]
 *   --unit          仅单元测试
 *   --integration   仅集成测试
 *   --all (默认)    单元 + 集成（不含 manual/）
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TESTS_DIR = path.join(ROOT, '__tests__');

function discover(group) {
  const dir = path.join(TESTS_DIR, group);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.test.js'))
    .map((f) => path.join(dir, f));
}

const arg = process.argv[2] || '--all';
let files = [];
if (arg === '--unit') files = discover('unit');
else if (arg === '--integration') files = discover('integration');
else files = [...discover('unit'), ...discover('integration')];

if (files.length === 0) {
  console.log('未找到测试文件');
  process.exit(0);
}

console.log(`\n🧪 运行 ${files.length} 个测试文件（${arg}）\n${'='.repeat(60)}`);

let totalPassed = 0;
let totalFailed = 0;
const failedFiles = [];

files.forEach((file) => {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  const res = spawnSync('node', [file], { cwd: ROOT, encoding: 'utf8' });
  // 解析最后一行 summary（形如 "xxx.test.js: 73/73 通过, 0 失败"）
  const lines = (res.stdout || '').split('\n').filter(Boolean);
  const summaryLine = lines
    .slice()
    .reverse()
    .find((l) => /通过,\s*\d+\s*失败/.test(l));
  let passed = 0;
  let failed = 0;
  if (summaryLine) {
    const m = summaryLine.match(/(\d+)\s*\/\s*(\d+)\s*通过,\s*(\d+)\s*失败/);
    if (m) {
      passed = parseInt(m[1], 10);
      failed = parseInt(m[3], 10);
    }
  } else if (res.status !== 0) {
    failed = 1; // 无 summary 行但退出非 0
  }
  totalPassed += passed;
  totalFailed += failed;
  const status = res.status === 0 ? '✅' : '❌';
  console.log(`${status} ${rel.padEnd(48)} ${passed}/${passed + failed}`);
  if (res.status !== 0) {
    failedFiles.push(rel);
    // 打印尾部错误信息
    const tail = (res.stderr || res.stdout || '').split('\n').filter(Boolean).slice(-6);
    tail.forEach((l) => console.log(`     ${l}`));
  }
});

console.log(`\n${'='.repeat(60)}`);
console.log(
  `总计: ${totalPassed}/${totalPassed + totalFailed} 通过, ${totalFailed} 失败` +
    `（${files.length} 文件${failedFiles.length ? `, ${failedFiles.length} 失败` : ''}）`
);
if (failedFiles.length) {
  console.log('失败文件:');
  failedFiles.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
} else {
  console.log('\n🎉 全部测试通过！');
}
