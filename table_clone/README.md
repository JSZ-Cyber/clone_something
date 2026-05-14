# table_clone - 规则表导出包批量改名工具

## 背景

在规则表管理系统中，经常需要将一组规则表从一个产品线克隆到另一个产品线。系统导出的 zip 包中包含 CSV 文件，其中记录了规则表的元数据和决策表内容。克隆时需要将表名中的产品前缀统一替换（如 `dd` → `jd`，`滴滴` → `京东`）。

## 导出包结构

```
export.zip
└── policy.csv
    ├── artifactId    - 项目标识
    ├── assetName     - 规则表英文名（如 dd_jixin_access_rule）
    ├── assetType     - 资产类型（1=权重规则集, 5=风险分组, 6=普通决策表）
    ├── assetVersion  - 版本号
    ├── content       - base64 编码的决策表 XML（内含 tableName 等）
    ├── name          - 规则表中文名（如 滴滴_集鑫准入规则）
    └── ...其他字段
```

## 资产类型与修改策略

| assetType | 类型 | 表名（assetName/name） | content |
|-----------|------|----------------------|---------|
| `1` | 权重规则集 | 修改 | **不修改** |
| `5` | 风险分组 | 修改 | 修改 |
| `6` | 普通决策表 | 修改 | 修改 |

**重要：权重规则集（assetType=1）的 content 字段不进行任何修改，只替换表名。**

原因：权重规则集的 content 内部结构与其他类型不同，修改可能导致数据损坏。

## 需要修改的字段

| 字段 | 修改内容 | 适用范围 | 示例 |
|------|----------|----------|------|
| `assetName` | 英文前缀替换 | 所有类型 | `dd_jixin_access_rule` → `jd_jixin_access_rule` |
| `name` | 中文前缀替换 | 所有类型 | `滴滴_集鑫准入规则` → `京东_集鑫准入规则` |
| `content` | base64 解码后替换英文前缀，再重新编码 | **仅非权重规则集** | XML 内 `<tableName>dd_xxx</tableName>` → `<tableName>jd_xxx</tableName>` |

## 处理流程

### 1. 解压 zip 到临时目录

使用 PowerShell 的 `Expand-Archive` 命令解压，兼容 Windows 环境。

### 2. 解析 CSV

CSV 中部分字段包含逗号和引号，需要正确处理引号内的逗号分隔。使用逐字符解析方式：

```javascript
function parseCSVLine(line) {
  const cols = [];
  let current = '';
  let inQuotes = false;
  for (let j = 0; j < line.length; j++) {
    const ch = line[j];
    if (ch === '"') { inQuotes = !inQuotes; current += ch; }
    else if (ch === ',' && !inQuotes) { cols.push(current); current = ''; }
    else { current += ch; }
  }
  cols.push(current);
  return cols;
}
```

### 3. 判断资产类型

通过 `assetType` 列（第 2 列，0-indexed）判断：
- `1` = 权重规则集 → 跳过 content 修改
- `5` = 风险分组 → 正常修改 content
- `6` = 普通决策表 → 正常修改 content

### 4. 替换英文前缀

- 正则匹配：`dd_` → `jd_`（全局替换）
- 作用于 `assetName` 列（直接文本替换）— 所有类型
- 作用于 `content` 列（base64 解码 → 替换 → 重新编码）— **仅非权重规则集**

### 5. 替换中文前缀

- 正则匹配：`滴滴` → `京东`（全局替换）
- 仅作用于 `name` 列（中文不出现在 base64 编码内容中）

### 6. 重新打包 zip

使用 PowerShell 的 `Compress-Archive` 命令打包。

## 关键点

1. **权重规则集 content 禁止修改**：assetType=1 的行只改表名，不碰 content
2. **base64 内容必须解码后替换**：`content` 字段是 base64 编码的 XML，直接在编码文本上替换会破坏编码结构
3. **CSV 解析必须处理引号**：字段中可能包含逗号和换行符，需要正确识别引号边界
4. **不修改其他字段**：只修改表名相关的 `name`、`assetName`、`content` 三个字段
5. **输出不覆盖源文件**：默认生成新文件名 `<原文件名>_<新前缀>.zip`

## 使用方式

### 命令行直接调用

```bash
node D:/skills/table_clone/table_clone.mjs <zip文件> <旧英文前缀> <新英文前缀> [旧中文前缀] [新中文前缀] [输出路径]
```

### Claude Code 中调用

```
/table_clone C:\Users\jisizhe\Downloads\export.zip dd jd 滴滴 京东
```

## 文件结构

```
D:\skills\table_clone\
├── SKILL.md           - Claude Code skill 定义
├── table_clone.mjs    - 核心替换脚本（Node.js）
└── README.md          - 本文档
```
