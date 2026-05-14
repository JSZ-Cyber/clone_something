# process_clone - 决策流程导出包克隆工具

## 背景

在规则表管理系统中，经常需要将一组决策流程从一个产品线克隆到另一个产品线。系统导出的 zip 包中包含 CSV 文件，记录了规则表的元数据和决策表内容。克隆时需要将表名中的产品前缀统一替换。

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

**权重规则集（assetType=1）的 content 字段不进行任何修改，只替换表名。**

## 英文前缀替换规则

支持两种模式，确保所有引用都被替换：

1. **下划线模式**：`dd_xxx` → `jd_xxx`（匹配 `前缀_`）
2. **驼峰模式**：`ddXxx` → `jdXxx`（匹配 `前缀` + 大写字母）

```javascript
function replacePrefix(text, oldPrefix, newPrefix) {
  // 下划线: dd_ → jd_
  let result = text.replace(new RegExp(oldPrefix + '_', 'g'), newPrefix + '_');
  // 驼峰: ddR → mtR (后跟大写字母)
  result = result.replace(new RegExp(oldPrefix + '(?=[A-Z])', 'g'), newPrefix);
  return result;
}
```

## 使用方式

### 命令行直接调用

```bash
node D:/skills/process_clone/process_clone.mjs <zip文件> <旧英文前缀> <新英文前缀> [旧中文前缀] [新中文前缀] [输出路径]
```

### Claude Code 中调用

```
/process_clone C:\Users\jisizhe\Downloads\export.zip dd jd 滴滴 京东
/process_clone C:\Users\jisizhe\Downloads\export.zip fm mt 富民 美团
/process_clone C:\Users\jisizhe\Downloads\export.zip jd mt 京东 美团
```

## 处理流程

1. 解压 zip 到临时目录
2. 解析 CSV，逐行处理
3. 替换 `assetName`（英文前缀：下划线 + 驼峰）
4. 替换 `name`（中文前缀）
5. 非权重规则集：解码 content 的 base64 → 替换英文前缀 → 重新编码
6. 写回 CSV（UTF-8 BOM）
7. 仅保留 CSV 文件，删除其他文件
8. 重新打包 zip

## 输出特性

- **仅含 CSV**：输出 zip 中只包含 CSV 文件
- **UTF-8 BOM**：CSV 使用 BOM 编码，确保导入系统正确识别
- **不覆盖源文件**：默认生成新文件名 `<原文件名>_<新前缀>.zip`

## 文件结构

```
D:\skills\process_clone\
├── SKILL.md              - Claude Code skill 定义
├── process_clone.mjs     - 核心克隆脚本（Node.js）
└── README.md             - 本文档
```
