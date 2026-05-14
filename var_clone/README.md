# var_clone - 变量批量克隆工具

## 背景

在规则表管理系统中，变量命名遵循分段模式，如 `jd_module_c_jixin`（按 `_` 分割）。克隆变量时需要对某些段进行替换，有时需要生成多段的笛卡尔积组合。本工具支持灵活的段替换规则。

## 变量命名规则

变量名按 `_` 分割为若干段，示例：`jd_module_c_jixin`

```
jd     → 第 1 段
module → 第 2 段
c      → 第 3 段
jixin  → 第 4 段（末段）
```

## 规则格式

```
<段号>:<旧值>→<新值1>,<新值2>,...   替换变量名指定段的值
<段号>:<新值1>,<新值2>,...           替换变量名指定段的当前值
last:<旧值>→<新值1>,<新值2>,...     替换变量名末段的值
cn:<旧中文>→<新中文>                 替换 nameCn 和 variableDesc 中的中文文本
```

| 组成部分 | 说明 |
|----------|------|
| 段号 | 正整数（1-indexed）或 `last` |
| cn | 中文文本替换，作用于 nameCn 和 variableDesc |
| 旧值 | 可选，仅当段值等于旧值时才替换 |
| 新值 | 一个或多个，逗号分隔。多个值时生成所有组合 |

## 使用示例

### 简单前缀替换

```bash
node var_clone.mjs vars.csv 1:jd→pdd
```

`jd_module_c_jixin` → `pdd_module_c_jixin`（仅改第 1 段）

### 单段多值展开

```bash
node var_clone.mjs vars.csv 3:a,b,c
```

`jd_module_c_jixin` → `jd_module_a_jixin`, `jd_module_b_jixin`, `jd_module_c_jixin`

### 多段组合展开

```bash
node var_clone.mjs vars.csv 3:a,b,c last:jixin,guoxin
```

`jd_module_c_jixin` → 6 种组合（3 × 2）

### 三段组合

```bash
node var_clone.mjs vars.csv 1:jd→pdd 3:a,b,c last:jixin,guoxin
```

`jd_module_c_jixin` → 6 种组合（第 1 段固定改 pdd，第 3 段 × 末段）

### 段替换 + 中文替换

```bash
node var_clone.mjs vars.csv 1:fm→mt cn:富民→美团
```

`fm_inner_risk_score`（`nameCn: 富民内部风险模块分`）→ `mt_inner_risk_score`（`nameCn: 美团内部风险模块分`）

## CSV 结构

```
[0]  dataExceptionStrategy
[1]  datasourceName
[2]  varType
[3]  dataType
[4]  defaultValue
[5]  expression
[6]  expressionCn
[7]  groupId
[8]  name             ← 修改
[9]  nameCn           ← 修改（同步替换）
[10] path
[11] valueMode
[12] variableDesc     ← 修改（同步替换）
```

## 修改策略

| 字段 | 操作 | 说明 |
|------|------|------|
| `name` (col 8) | 按规则替换指定段 | `jd_module_c_jixin` → `pdd_module_a_guoxin` |
| `nameCn` (col 9) | 同步替换原值为新值 | `临时jd_module_c_jixin` → `临时pdd_module_a_guoxin` |
| `variableDesc` (col 12) | 同步替换原值为新值 | 同上 |
| 其他字段 | 保持原值 | varType、dataType、groupId 等不变 |

## 使用方式

### 命令行直接调用

```bash
node D:/skills/var_clone/var_clone.mjs <csv文件> <规则...> [输出路径]
```

### Claude Code 中调用

```
/var_clone C:\Users\jisizhe\Downloads\变量明细.csv 1:jd→pdd
/var_clone C:\Users\jisizhe\Downloads\变量明细.csv 3:a,b,c last:jixin,guoxin
```

## 文件结构

```
D:\skills\var_clone\
├── SKILL.md         - Claude Code skill 定义
├── var_clone.mjs    - 核心克隆脚本（Node.js）
└── README.md        - 本文档
```
