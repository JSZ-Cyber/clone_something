---
name: var_clone
description: 变量批量克隆工具。读取变量明细 CSV，按用户指定的规则对变量名各段进行灵活替换，支持多段组合（笛卡尔积）。仅修改 name、nameCn、variableDesc，其他字段不变。当用户需要批量克隆变量、替换变量前缀/后缀、生成变量变体时使用。
---

# 变量批量克隆工具

读取变量明细 CSV，按用户指定的灵活规则批量替换变量名各段。

## 使用方式

```bash
node D:/skills/var_clone/var_clone.mjs <csv文件> <规则1> [规则2] ... [输出路径]
```

### 规则格式

```
<段号>:<旧值>→<新值1>,<新值2>,...   替换变量名指定段的值
<段号>:<新值1>,<新值2>,...           替换变量名指定段的当前值
last:<旧值>→<新值1>,<新值2>,...     替换变量名末段的值
cn:<旧中文>→<新中文>                 替换 nameCn 和 variableDesc 中的中文文本
```

- **段号**：正整数（1-indexed）或 `last` 表示最后一段
- **旧值→新值**：仅当段值等于旧值时才替换
- **新值1,新值2**：多个值时生成所有组合（笛卡尔积）
- **cn:旧→新**：中文文本替换，作用于 nameCn 和 variableDesc，可与段规则组合使用

### 示例

```bash
# 简单替换：第1段 jd→pdd
node D:/skills/var_clone/var_clone.mjs vars.csv 1:jd→pdd

# 单段多值：第3段替换为 a/b/c
node D:/skills/var_clone/var_clone.mjs vars.csv 3:a,b,c

# 多段组合：第3段 a/b/c × 末段 jixin/guoxin = 6种
node D:/skills/var_clone/var_clone.mjs vars.csv 3:a,b,c last:jixin,guoxin

# 三段组合：第1段 jd→pdd × 第3段 a/b/c × 末段 jixin/guoxin
node D:/skills/var_clone/var_clone.mjs vars.csv 1:jd→pdd 3:a,b,c last:jixin,guoxin

# 指定输出路径
node D:/skills/var_clone/var_clone.mjs vars.csv 1:jd→pdd output.csv

# 段替换 + 中文替换：变量名第1段 fm→mt，同时替换中文名中的 富民→美团
node D:/skills/var_clone/var_clone.mjs vars.csv 1:fm→mt cn:富民→美团
```

## 修改范围

| 字段 | 列索引 | 是否修改 |
|------|--------|----------|
| name（变量名） | 8 | 修改 |
| nameCn（中文名称） | 9 | 修改（同步替换对应段） |
| variableDesc（描述） | 12 | 修改（同步替换对应段） |
| 其他字段 | - | 不修改 |

## 执行流程

1. 读取 CSV 文件
2. 解析每条替换规则（段号、旧值、新值列表）
3. 对每行变量，按 `_` 分割变量名
4. 对每条规则，检查段值是否匹配旧值（如指定），生成可选替换值
5. 对多条规则取笛卡尔积，生成所有组合
6. 同步替换 nameCn 和 variableDesc 中的对应段
7. 输出结果 CSV 并预览

## 注意事项

- 仅修改 name、nameCn、variableDesc 三个字段
- 多条规则之间取笛卡尔积（如 3 种 × 2 种 = 6 种组合）
- 指定旧值时仅匹配等于旧值的段，不匹配则保持原值
- 未指定旧值时直接替换当前值
- 变量名须按 `_` 分割后有足够的段数，否则跳过并警告

$ARGUMENTS
