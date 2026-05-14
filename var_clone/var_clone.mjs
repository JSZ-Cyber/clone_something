#!/usr/bin/env node
/**
 * var_clone - 变量批量克隆工具
 *
 * 支持灵活的段替换规则，按笛卡尔积生成所有组合。
 * 仅修改 name、nameCn、variableDesc，其他字段不变。
 *
 * 用法:
 *   node var_clone.mjs <csv文件> <规则1> [规则2] ... [输出路径]
 *
 * 规则格式:
 *   <段号>:<旧值>→<新值1>,<新值2>,...   — 替换指定段的指定值
 *   <段号>:<新值1>,<新值2>,...           — 替换指定段的当前值
 *   last:<旧值>→<新值1>,<新值2>,...     — 替换末段的指定值
 *   last:<新值1>,<新值2>,...             — 替换末段的当前值
 *
 * 示例:
 *   node var_clone.mjs vars.csv 1:jd→pdd
 *   node var_clone.mjs vars.csv 3:a,b,c last:jixin,guoxin
 *   node var_clone.mjs vars.csv 1:jd→pdd 3:a,b,c last:jixin,guoxin
 */

import fs from 'fs';
import path from 'path';

// ── 参数解析 ──────────────────────────────────────────────
const rawArgs = process.argv.slice(2);

if (rawArgs.length < 2) {
  console.error('用法: node var_clone.mjs <csv文件> <规则1> [规则2] ... [输出路径]');
  console.error('');
  console.error('规则格式:');
  console.error('  <段号>:<旧值>→<新值1>,<新值2>   替换指定段的指定值');
  console.error('  <段号>:<新值1>,<新值2>           替换指定段的当前值');
  console.error('  last:<旧值>→<新值1>,<新值2>     替换末段的指定值');
  console.error('  last:<新值1>,<新值2>             替换末段的当前值');
  console.error('');
  console.error('示例:');
  console.error('  node var_clone.mjs vars.csv 1:jd→pdd');
  console.error('  node var_clone.mjs vars.csv 3:a,b,c last:jixin,guoxin');
  console.error('  node var_clone.mjs vars.csv 1:jd→pdd 3:a,b,c last:jixin,guoxin');
  process.exit(1);
}

const csvPath = path.resolve(rawArgs[0]);

// 最后一个参数如果是 .csv 结尾则视为输出路径，否则为规则
let outputPath = null;
const ruleArgs = [];
for (let i = 1; i < rawArgs.length; i++) {
  if (rawArgs[i].endsWith('.csv') && i === rawArgs.length - 1 && rawArgs[i].includes('/') || rawArgs[i].includes('\\')) {
    outputPath = path.resolve(rawArgs[i]);
  } else if (rawArgs[i].endsWith('.csv') && i === rawArgs.length - 1 && !rawArgs[i].includes(':')) {
    outputPath = path.resolve(rawArgs[i]);
  } else {
    ruleArgs.push(rawArgs[i]);
  }
}

if (!outputPath) {
  outputPath = csvPath.replace(/\.csv$/i, '_expanded.csv');
}

// ── 验证输入 ──────────────────────────────────────────────
if (!fs.existsSync(csvPath)) {
  console.error(`错误: 文件不存在 - ${csvPath}`);
  process.exit(1);
}

// ── 解析规则 ──────────────────────────────────────────────
// 规则格式: <段号>:<旧值>→<新值1>,<新值2>
// 或: <段号>:<新值1>,<新值2>  (替换当前值)
// 段号可以是数字(1-indexed)或 "last"
// 返回: [{ segment: number, old: string|null, news: string[] }]

function parseRule(ruleStr) {
  const parts = ruleStr.split(':');
  if (parts.length < 2) {
    console.error(`规则格式错误: "${ruleStr}"，应为 <段号>:<值> 或 cn:<旧>→<新>`);
    process.exit(1);
  }

  const segStr = parts[0].toLowerCase();

  // 中文替换规则: cn:富民→美团
  if (segStr === 'cn') {
    const valuePart = parts.slice(1).join(':');
    if (!valuePart.includes('→')) {
      console.error(`中文规则格式错误: "${ruleStr}"，应为 cn:<旧>→<新>`);
      process.exit(1);
    }
    const arrowParts = valuePart.split('→');
    return { segment: 'cn', old: arrowParts[0], news: [arrowParts[1]] };
  }

  const segment = segStr === 'last' ? -1 : parseInt(segStr, 10);

  if (segStr !== 'last' && (isNaN(segment) || segment < 1)) {
    console.error(`段号错误: "${segStr}"，应为正整数、"last" 或 "cn"`);
    process.exit(1);
  }

  const valuePart = parts.slice(1).join(':'); // 值部分可能包含冒号

  let old = null;
  let news = [];

  if (valuePart.includes('→')) {
    // 有箭头: 旧值→新值1,新值2
    const arrowParts = valuePart.split('→');
    old = arrowParts[0];
    news = arrowParts[1].split(',').map(s => s.trim());
  } else {
    // 无箭头: 直接替换为新值1,新值2
    news = valuePart.split(',').map(s => s.trim());
  }

  return { segment, old, news };
}

const rules = ruleArgs.map(parseRule);

if (rules.length === 0) {
  console.error('错误: 未提供替换规则');
  process.exit(1);
}

// ── 列索引（自动检测表头） ──────────────────────────────────
function findColIndex(headerLine, colName) {
  const hcols = parseCSVLine(headerLine);
  for (let i = 0; i < hcols.length; i++) {
    if (hcols[i].replace(/^"|"$/g, '').toLowerCase() === colName.toLowerCase()) return i;
  }
  return -1;
}

const headerLine = fs.readFileSync(csvPath, 'utf-8').trim().split('\n')[0];
const COL_NAME = findColIndex(headerLine, 'name');
const COL_NAME_CN = findColIndex(headerLine, 'nameCn');
const COL_VAR_DESC = findColIndex(headerLine, 'variableDesc');

if (COL_NAME < 0 || COL_NAME_CN < 0 || COL_VAR_DESC < 0) {
  console.error(`错误: 未找到必需列 name(${COL_NAME}), nameCn(${COL_NAME_CN}), variableDesc(${COL_VAR_DESC})`);
  process.exit(1);
}

// ── 生成笛卡尔积 ──────────────────────────────────────────
function cartesianProduct(arrays) {
  return arrays.reduce((acc, arr) => {
    const result = [];
    for (const a of acc) {
      for (const b of arr) {
        result.push([...a, b]);
      }
    }
    return result;
  }, [[]]);
}

// ── 分离段规则和中文替换规则 ─────────────────────────────────
const segRules = rules.filter(r => r.segment !== 'cn');
const cnRules = rules.filter(r => r.segment === 'cn');

// ── 解析 CSV ─────────────────────────────────────────────
const content = fs.readFileSync(csvPath, 'utf-8');
const lines = content.trim().split('\n');
const header = lines[0];

const newLines = [header];
let sourceRows = 0;
let skippedRows = 0;

for (let i = 1; i < lines.length; i++) {
  if (!lines[i].trim()) continue;
  sourceRows++;

  const cols = parseCSVLine(lines[i]);
  const name = cols[COL_NAME].replace(/^"|"$/g, '');
  const nameCn = cols[COL_NAME_CN].replace(/^"|"$/g, '');
  const desc = cols[COL_VAR_DESC].replace(/^"|"$/g, '');

  const parts = name.split('_');

  // 对每条段规则，计算该行在该段的可选替换值
  const ruleOptions = []; // 每个元素是一组 [替换值, 原始段值]

  for (const rule of segRules) {
    const segIdx = rule.segment === -1 ? parts.length - 1 : rule.segment - 1;

    if (segIdx < 0 || segIdx >= parts.length) {
      console.warn(`警告: 第 ${i} 行变量 "${name}" 只有 ${parts.length} 段，无法访问第 ${rule.segment} 段，跳过`);
      skippedRows++;
      ruleOptions.push(null);
      continue;
    }

    const currentVal = parts[segIdx];

    // 如果指定了旧值，检查当前值是否匹配
    if (rule.old !== null && currentVal !== rule.old) {
      // 不匹配，保持原值（只有一种选择）
      ruleOptions.push([[currentVal, currentVal]]);
    } else {
      // 匹配或未指定旧值，使用新值列表
      ruleOptions.push(rule.news.map(n => [n, currentVal]));
    }
  }

  // 检查是否有跳过的规则
  if (ruleOptions.includes(null)) continue;

  // 生成所有组合
  const combos = segRules.length > 0 ? cartesianProduct(ruleOptions) : [[[]]];

  for (const combo of combos) {
    const newParts = [...parts];
    let newNameCn = nameCn;
    let newDesc = desc;

    for (let r = 0; r < segRules.length; r++) {
      const rule = segRules[r];
      const [newVal, origVal] = combo[r];
      const segIdx = rule.segment === -1 ? parts.length - 1 : rule.segment - 1;

      newParts[segIdx] = newVal;

      // 同步替换中文名称和描述
      if (origVal !== newVal) {
        newNameCn = newNameCn.split(origVal).join(newVal);
        newDesc = newDesc.split(origVal).join(newVal);
      }
    }

    // 应用中文替换规则
    for (const cnRule of cnRules) {
      newNameCn = newNameCn.split(cnRule.old).join(cnRule.news[0]);
      newDesc = newDesc.split(cnRule.old).join(cnRule.news[0]);
    }

    const newName = newParts.join('_');
    const newCols = [...cols];
    newCols[COL_NAME] = '"' + newName + '"';
    newCols[COL_NAME_CN] = '"' + newNameCn + '"';
    newCols[COL_VAR_DESC] = '"' + newDesc + '"';
    newLines.push(newCols.join(','));
  }
}

// ── 写出 ─────────────────────────────────────────────────
// Write with UTF-8 BOM (required by import system)
const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
const csvBuf = Buffer.from(newLines.join('\n'), 'utf-8');
fs.writeFileSync(outputPath, Buffer.concat([bom, csvBuf]));

// ── 输出结果 ─────────────────────────────────────────────
const totalRows = newLines.length - 1;
const comboCount = totalRows / sourceRows || 0;

console.log('─'.repeat(60));
console.log('克隆完成!');
console.log(`  源变量: ${sourceRows} 条`);
console.log(`  生成变量: ${totalRows} 条 (每条 × ${comboCount} 种组合)`);
if (skippedRows > 0) console.log(`  跳过: ${skippedRows} 条（段数不足）`);
console.log(`  规则:`);
for (const rule of rules) {
  if (rule.segment === 'cn') {
    console.log(`    中文: ${rule.old} → ${rule.news.join('/')}`);
  } else {
    const segLabel = rule.segment === -1 ? '末段' : `第${rule.segment}段`;
    if (rule.old !== null) {
      console.log(`    ${segLabel}: ${rule.old} → ${rule.news.join('/')}`);
    } else {
      console.log(`    ${segLabel}: → ${rule.news.join('/')}`);
    }
  }
}
console.log(`  输出文件: ${outputPath}`);
console.log('─'.repeat(60));

// 预览
const COL_DATA_TYPE = findColIndex(headerLine, 'dataType');
console.log('\n预览:');
console.log('name | nameCn | dataType');
console.log('-'.repeat(60));
for (let i = 1; i < newLines.length; i++) {
  const c = parseCSVLine(newLines[i]);
  const n = c[COL_NAME].replace(/^"|"$/g, '');
  const nc = c[COL_NAME_CN].replace(/^"|"$/g, '');
  const dt = COL_DATA_TYPE >= 0 ? c[COL_DATA_TYPE].replace(/^"|"$/g, '') : '-';
  console.log(`${n} | ${nc} | ${dt}`);
}

// ── 工具函数 ──────────────────────────────────────────────

function parseCSVLine(line) {
  const cols = [];
  let current = '';
  let inQuotes = false;
  for (let j = 0; j < line.length; j++) {
    const ch = line[j];
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
    } else if (ch === ',' && !inQuotes) {
      cols.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cols.push(current);
  return cols;
}
