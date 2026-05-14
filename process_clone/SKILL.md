---
name: process_clone
description: 决策流程导出包克隆工具。从 zip 导出包中提取 CSV，批量替换规则表的英文前缀（支持下划线和驼峰）和中文名称，然后重新打包为仅含 CSV 的 zip。权重规则集（assetType=1）仅修改表名，不修改 content 内容。当用户需要克隆决策流程、复制规则表、替换流程前缀时使用。
---

# 决策流程导出包克隆工具

对决策流程导出的 zip 包进行批量前缀替换，支持英文前缀（下划线 + 驼峰）和中文前缀同时替换。

## 使用方式

```bash
node D:/skills/process_clone/process_clone.mjs <zip文件> <旧英文前缀> <新英文前缀> [旧中文前缀] [新中文前缀] [输出路径]
```

### 参数说明

| 参数 | 必填 | 说明 |
|------|------|------|
| zip文件 | 是 | 源 zip 文件的完整路径 |
| 旧英文前缀 | 是 | 要替换的英文前缀，如 `dd` |
| 新英文前缀 | 是 | 替换后的英文前缀，如 `jd` |
| 旧中文前缀 | 否 | 要替换的中文前缀，如 `滴滴` |
| 新中文前缀 | 否 | 替换后的中文前缀，如 `京东` |
| 输出路径 | 否 | 输出 zip 路径，默认为源文件同目录下 `<原文件名>_<新前缀>.zip` |

### 示例

```bash
# dd→jd, 滴滴→京东
node D:/skills/process_clone/process_clone.mjs export.zip dd jd 滴滴 京东

# fm→mt, 富民→美团（支持驼峰：fmRuleSetProcess → mtRuleSetProcess）
node D:/skills/process_clone/process_clone.mjs export.zip fm mt 富民 美团

# jd→mt, 京东→美团
node D:/skills/process_clone/process_clone.mjs export.zip jd mt 京东 美团
```

## 资产类型与修改策略

| assetType | 类型 | 表名（assetName/name） | content |
|-----------|------|----------------------|---------|
| `1` | 权重规则集 | 修改 | **不修改** |
| `5` | 风险分组 | 修改 | 修改 |
| `6` | 普通决策表 | 修改 | 修改 |

**重要：权重规则集（assetType=1）的 content 字段不进行任何修改，只替换表名。**

## 英文前缀替换规则

支持两种模式：

1. **下划线模式**：`dd_xxx` → `jd_xxx`
2. **驼峰模式**：`ddXxx` → `jdXxx`（前缀后跟大写字母时）

两种模式在 `assetName` 列和 `content` 的 base64 解码内容中均生效。

## 输出特性

- 输出 zip 中**仅包含 CSV 文件**，不含其他文件
- CSV 使用 **UTF-8 BOM** 编码，确保系统正确识别
- 输出文件默认不覆盖源文件

## 执行流程

1. 解压 zip 文件到临时目录
2. 读取 CSV 文件，解析每一行
3. 对所有行替换 `assetName` 列中的英文前缀（下划线 + 驼峰）
4. 对所有行替换 `name` 列中的中文前缀
5. 对**非权重规则集**的行，解码 `content` 列的 base64 内容，替换英文前缀，重新编码
6. 写回 CSV（带 UTF-8 BOM）
7. 删除非 CSV 文件，重新打包为 zip
8. 输出替换统计

## 注意事项

- 仅修改规则表名相关字段（`name`、`assetName`、`content`），不修改其他字段
- **权重规则集（assetType=1）的 content 字段禁止修改**，只改表名
- 中文前缀仅出现在 `name` 列中，`content` 的 base64 编码中通常不含中文
- 驼峰替换仅在前缀后跟大写字母时触发，避免误替换（如 `info` 中的 `in`）

$ARGUMENTS
