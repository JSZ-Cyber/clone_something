#!/usr/bin/env node
/**
 * table_clone - 规则表导出包批量改名工具
 *
 * 用法:
 *   node table_clone.mjs <zip文件> <旧英文前缀> <新英文前缀> [旧中文前缀] [新中文前缀] [输出路径]
 *
 * 示例:
 *   node table_clone.mjs export.zip dd jd 滴滴 京东
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── 参数解析 ──────────────────────────────────────────────
const args = process.argv.slice(2);

if (args.length < 3) {
  console.error('用法: node table_clone.mjs <zip文件> <旧英文前缀> <新英文前缀> [旧中文前缀] [新中文前缀] [输出路径]');
  console.error('示例: node table_clone.mjs export.zip dd jd 滴滴 京东');
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

// ── 解压 ──────────────────────────────────────────────────
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'table_clone-'));

try {
  // 使用 PowerShell 解压（Windows 兼容）
  execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${tmpDir}' -Force"`, { stdio: 'pipe' });

  // 查找 CSV 文件
  const csvFiles = fs.readdirSync(tmpDir).filter(f => f.endsWith('.csv'));
  if (csvFiles.length === 0) {
    console.error('错误: zip 中未找到 CSV 文件');
    process.exit(1);
  }

  const csvPath = path.join(tmpDir, csvFiles[0]);
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n');
  const header = lines[0];

  // 构建正则
  const enRegex = new RegExp(`${escapeRegex(oldEnPrefix)}_`, 'g');
  const cnRegex = oldCnPrefix ? new RegExp(escapeRegex(oldCnPrefix), 'g') : null;

  let enReplaceCount = 0;
  let cnReplaceCount = 0;
  let weightSkippedCount = 0;

  // assetType 列索引 (col 2)
  // 1 = 权重规则集 (weight rule set) — 只改表名，不改 content
  // 5 = 风险分组
  // 6 = 普通决策表
  const ASSET_TYPE_COL = 2;
  const WEIGHT_RULE_SET_TYPE = '1';

  const newLines = [header];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;

    // 解析 CSV（支持带引号的字段）
    const cols = parseCSVLine(lines[i]);
    const assetType = cols[ASSET_TYPE_COL].replace(/^"|"$/g, '');
    const isWeightRuleSet = assetType === WEIGHT_RULE_SET_TYPE;

    // 替换 assetName (col 1) - 英文前缀（所有类型都改）
    const oldAsset = cols[1];
    cols[1] = cols[1].replace(enRegex, `${newEnPrefix}_`);
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
        const replaced = decoded.replace(enRegex, `${newEnPrefix}_`);
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

  // 写回 CSV
  // Write with UTF-8 BOM
  const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
  const csvBuf = Buffer.from(newLines.join('\n'), 'utf-8');
  fs.writeFileSync(csvPath, Buffer.concat([bom, csvBuf]));

  // 打包 zip
  if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
  execSync(`powershell -Command "Compress-Archive -Path '${tmpDir}\\*' -DestinationPath '${outputPath}' -Force"`, { stdio: 'pipe' });

  // 输出结果
  const stats = fs.statSync(outputPath);
  console.log('─'.repeat(50));
  console.log('替换完成!');
  console.log(`  英文前缀: ${oldEnPrefix}_ → ${newEnPrefix}_ (替换 ${enReplaceCount} 处)`);
  if (oldCnPrefix) {
    console.log(`  中文前缀: ${oldCnPrefix} → ${newCnPrefix} (替换 ${cnReplaceCount} 处)`);
  }
  if (weightSkippedCount > 0) {
    console.log(`  权重规则集: ${weightSkippedCount} 条 (跳过 content 修改，仅改表名)`);
  }
  console.log(`  处理行数: ${newLines.length - 1} 条`);
  console.log(`  输出文件: ${outputPath}`);
  console.log(`  文件大小: ${(stats.size / 1024).toFixed(1)} KB`);
  console.log('─'.repeat(50));

} finally {
  // 清理临时目录
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {}
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
