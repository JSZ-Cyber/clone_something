#!/usr/bin/env node
/**
 * process_clone - 决策流程导出包克隆工具
 *
 * 从 zip 导出包中提取 CSV，批量替换规则表的英文前缀和中文名称，然后重新打包。
 * 权重规则集（assetType=1）仅修改表名，不修改 content。
 * 输出 zip 中只包含 CSV 文件。
 *
 * 用法:
 *   node process_clone.mjs <zip文件> <旧英文前缀> <新英文前缀> [旧中文前缀] [新中文前缀] [输出路径]
 *
 * 示例:
 *   node process_clone.mjs export.zip dd jd 滴滴 京东
 *   node process_clone.mjs export.zip fm mt 富民 美团
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import os from 'os';

// ── 参数解析 ──────────────────────────────────────────────
const args = process.argv.slice(2);

if (args.length < 3) {
  console.error('用法: node process_clone.mjs <zip文件> <旧英文前缀> <新英文前缀> [旧中文前缀] [新中文前缀] [输出路径]');
  console.error('示例: node process_clone.mjs export.zip dd jd 滴滴 京东');
  process.exit(1);
}

const zipPath = path.resolve(args[0]);
const oldEnPrefix = args[1];
const newEnPrefix = args[2];
const oldCnPrefix = args[3] || null;
const newCnPrefix = args[4] || null;
const outputPath = args[5]
  ? path.resolve(args[5])
  : zipPath.replace(/\.zip$/i, `_${newEnPrefix}.zip`);

// ── 验证输入 ──────────────────────────────────────────────
if (!fs.existsSync(zipPath)) {
  console.error(`错误: 文件不存在 - ${zipPath}`);
  process.exit(1);
}

// ── 工具函数 ──────────────────────────────────────────────

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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

function replacePrefix(text, oldPrefix, newPrefix) {
  // 替换 oldPrefix_ → newPrefix_
  let result = text.replace(new RegExp(escapeRegex(oldPrefix) + '_', 'g'), newPrefix + '_');
  // 替换驼峰 oldPrefixX → newPrefixX (oldPrefix 后跟大写字母)
  result = result.replace(new RegExp(escapeRegex(oldPrefix) + '(?=[A-Z])', 'g'), newPrefix);
  return result;
}

// ── 解压 ──────────────────────────────────────────────────
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'process_clone-'));

try {
  // 使用 PowerShell 解压（Windows 兼容）
  const psExtract = `Expand-Archive -Path "${zipPath}" -DestinationPath "${tmpDir}" -Force`;
  const psExtractFile = path.join(tmpDir, '_extract.ps1');
  fs.writeFileSync(psExtractFile, psExtract);
  execSync(`powershell -ExecutionPolicy Bypass -File "${psExtractFile}"`, { stdio: 'pipe' });

  // 查找 CSV 文件
  const csvFiles = fs.readdirSync(tmpDir).filter(f => f.endsWith('.csv'));
  if (csvFiles.length === 0) {
    console.error('错误: zip 中未找到 CSV 文件');
    process.exit(1);
  }

  const csvPath = path.join(tmpDir, csvFiles[0]);
  const content = fs.readFileSync(csvPath, 'utf-8').replace(/^﻿/, ''); // 去掉 BOM
  const lines = content.split('\n');
  const header = lines[0];

  // 构建正则
  const enReplaceOld = oldEnPrefix;
  const enReplaceNew = newEnPrefix;
  const cnRegex = oldCnPrefix ? new RegExp(escapeRegex(oldCnPrefix), 'g') : null;

  // assetType 列索引
  const ASSET_TYPE_COL = 2;
  const WEIGHT_RULE_SET_TYPE = '1';

  let enReplaceCount = 0;
  let cnReplaceCount = 0;
  let weightSkippedCount = 0;

  const newLines = [header];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;

    const cols = parseCSVLine(lines[i]);
    const assetType = cols[ASSET_TYPE_COL].replace(/^"|"$/g, '');
    const isWeightRuleSet = assetType === WEIGHT_RULE_SET_TYPE;

    // 替换 assetName (col 1) - 英文前缀（所有类型都改）
    const oldAsset = cols[1];
    cols[1] = replacePrefix(cols[1], enReplaceOld, enReplaceNew);
    if (cols[1] !== oldAsset) enReplaceCount++;

    // 替换 name (col 8) - 中文前缀（所有类型都改）
    if (cnRegex) {
      const oldName = cols[8];
      cols[8] = cols[8].replace(cnRegex, newCnPrefix);
      if (cols[8] !== oldName) cnReplaceCount++;
    }

    // 替换 content (col 4) - base64 编码内容中的英文前缀
    // ⚠️ 权重规则集 (assetType=1) 不修改 content，只修改表名
    if (isWeightRuleSet) {
      weightSkippedCount++;
    } else {
      const rawContent = cols[4];
      const isQuoted = rawContent.startsWith('"') && rawContent.endsWith('"');
      const b64 = isQuoted ? rawContent.slice(1, -1) : rawContent;

      try {
        const decoded = Buffer.from(b64, 'base64').toString('utf-8');
        const replaced = replacePrefix(decoded, enReplaceOld, enReplaceNew);
        if (replaced !== decoded) {
          const reEncoded = Buffer.from(replaced, 'utf-8').toString('base64');
          cols[4] = isQuoted ? `"${reEncoded}"` : reEncoded;
          enReplaceCount++;
        }
      } catch {
        // base64 解码失败则跳过
      }
    }

    newLines.push(cols.join(','));
  }

  // 写回 CSV（带 UTF-8 BOM）
  const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
  const csvBuf = Buffer.from(newLines.join('\n'), 'utf-8');
  fs.writeFileSync(csvPath, Buffer.concat([bom, csvBuf]));

  // 删除非 CSV 文件（只保留 CSV）
  const allFiles = fs.readdirSync(tmpDir);
  for (const f of allFiles) {
    const fullPath = path.join(tmpDir, f);
    if (fs.statSync(fullPath).isFile() && !f.endsWith('.csv') && !f.startsWith('_')) {
      fs.unlinkSync(fullPath);
    }
  }

  // 打包 zip
  if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
  const psCompress = `Compress-Archive -Path "${tmpDir}\\${csvFiles[0]}" -DestinationPath "${outputPath}" -Force`;
  const psCompressFile = path.join(tmpDir, '_compress.ps1');
  fs.writeFileSync(psCompressFile, psCompress);
  execSync(`powershell -ExecutionPolicy Bypass -File "${psCompressFile}"`, { stdio: 'pipe' });

  // 输出结果
  const stats = fs.statSync(outputPath);
  console.log('─'.repeat(60));
  console.log('流程克隆完成!');
  console.log(`  英文前缀: ${oldEnPrefix} → ${newEnPrefix} (替换 ${enReplaceCount} 处)`);
  if (oldCnPrefix) {
    console.log(`  中文前缀: ${oldCnPrefix} → ${newCnPrefix} (替换 ${cnReplaceCount} 处)`);
  }
  if (weightSkippedCount > 0) {
    console.log(`  权重规则集: ${weightSkippedCount} 条 (跳过 content 修改，仅改表名)`);
  }
  console.log(`  处理行数: ${newLines.length - 1} 条`);
  console.log(`  输出文件: ${outputPath}`);
  console.log(`  文件大小: ${(stats.size / 1024).toFixed(1)} KB`);
  console.log('─'.repeat(60));

} finally {
  // 清理临时目录
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {}
}
