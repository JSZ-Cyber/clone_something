---
name: table_clone
description: 规则表导出包批量改名工具。从 zip 导出包中提取 CSV，批量替换规则表的英文前缀（如 dd→jd）和中文前缀（如 滴滴→京东），然后重新打包。权重规则集（assetType=1）仅修改表名，不修改 content 内容。当用户需要对规则表导出包进行批量改名、前缀替换时使用。
---

# 规则表导出包批量改名工具

对规则表导出的 zip 包进行批量前缀替换，支持英文前缀和中文前缀同时替换。

## 使用方式

```bash
node D:/skills/table_clone/table_clone.mjs <zip文件路径> <旧英文前缀> <新英文前缀> [旧中文前缀] [新中文前缀] [输出路径]
```

### 参数说明

| 参数 | 必填 | 说明 |
|------|------|------|
| zip文件路径 | 是 | 源 zip 文件的完整路径 |
| 旧英文前缀 | 是 | 要替换的英文前缀，如 `dd` |
| 新英文前缀 | 是 | 替换后的英文前缀，如 `jd` |
| 旧中文前缀 | 否 | 要替换的中文前缀，如 `滴滴` |
| 新中文前缀 | 否 | 替换后的中文前缀，如 `京东` |
| 输出路径 | 否 | 输出 zip 文件路径，默认为源文件同目录下 `<原文件名>_<新前缀>.zip` |

### 示例

```bash
# 英文+中文前缀替换
node D:/skills/table_clone/table_clone.mjs "C:/Users/jisizhe/Downloads/export.zip" dd jd 滴滴 京东

# 仅英文前缀替换
node D:/skills/table_clone/table_clone.mjs "C:/Users/jisizhe/Downloads/export.zip" dd jd

# 指定输出路径
node D:/skills/table_clone/table_clone.mjs "C:/Users/jisizhe/Downloads/export.zip" dd jd 滴滴 京东 "C:/Users/jisizhe/Downloads/output.zip"
```

## 资产类型说明

CSV 中 `assetType` 列（第 2 列）标识规则表类型：

| assetType | 类型 | content 修改 |
|-----------|------|-------------|
| `1` | 权重规则集 | **不修改**（仅改表名） |
| `5` | 风险分组 | 修改 |
| `6` | 普通决策表 | 修改 |

**重要：权重规则集（assetType=1）的 content 字段不进行任何修改，只替换表名（`assetName`、`name`）。**

## 执行流程

1. 解压 zip 文件到临时目录
2. 读取 CSV 文件，解析每一行
3. 对所有行替换 `assetName` 列中的英文前缀（如 `dd_` → `jd_`）
4. 对所有行替换 `name` 列中的中文前缀（如 `滴滴` → `京东`）
5. 对**非权重规则集**的行，解码 `content` 列的 base64 内容，替换其中的英文前缀，重新编码
6. 统计替换结果，写回 CSV
7. 重新打包为 zip 文件
8. 输出替换统计和输出文件路径

## 注意事项

- 仅修改规则表名相关字段（`name`、`assetName`、`content`），不修改其他字段
- **权重规则集（assetType=1）的 content 字段禁止修改**，只改表名
- `content` 字段是 base64 编码的 XML，内部也包含表名引用，非权重规则集会一并替换
- 中文前缀仅出现在 `name` 列中，`content` 的 base64 编码中通常不含中文
- 输出文件默认不覆盖源文件，会生成新文件名

$ARGUMENTS
