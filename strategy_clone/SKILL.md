---
name: strategy_clone
description: 策略包一键克隆工具。整合 var_clone、table_clone、process_clone 三个 skill，用户只需提供中英文前缀和相关文件，即可一次性输出变量 CSV、规则表压缩包和决策流程压缩包。当用户需要整体克隆一套策略（包括变量、规则表、决策流程）时使用。
---

# 策略包一键克隆工具

整合 `var_clone`、`table_clone`、`process_clone` 三个 skill，一键完成整套策略克隆。

## 使用方式

```
/strategy_clone <旧英文前缀> <新英文前缀> <旧中文前缀> <新中文前缀> [变量CSV] [规则表zip] [决策流程zip]
```

### 参数说明

| 参数 | 必填 | 说明 |
|------|------|------|
| 旧英文前缀 | 是 | 要替换的英文前缀，如 `dd` |
| 新英文前缀 | 是 | 替换后的英文前缀，如 `jd` |
| 旧中文前缀 | 是 | 要替换的中文前缀，如 `滴滴` |
| 新中文前缀 | 是 | 替换后的中文前缀，如 `京东` |
| 变量CSV | 否 | 变量明细 CSV 文件路径 |
| 规则表zip | 否 | 规则表导出 zip 文件路径 |
| 决策流程zip | 否 | 决策流程导出 zip 文件路径 |

### 示例

```
/strategy_clone dd jd 滴滴 京东 C:\vars.csv C:\table.zip C:\process.zip
/strategy_clone fm mt 富民 美团 C:\vars.csv C:\table.zip
/strategy_clone xy pdd 新氧 拼多多 C:\process.zip
```

## 执行流程

收到用户指令后，按以下步骤执行：

### 第 1 步：检查参数完整性

检查用户是否提供了：
1. 四个前缀参数（旧英文、新英文、旧中文、新中文）
2. 至少一个文件（变量 CSV / 规则表 zip / 决策流程 zip）

如果缺少前缀参数，使用 AskUserQuestion 向用户询问。

如果用户只提供了部分文件，只执行对应的 skill，不强制要求全部提供。

### 第 2 步：调用 var_clone（如果有变量 CSV）

当用户提供了变量 CSV 文件时，执行：

```bash
node D:/skills/var_clone/var_clone.mjs <变量CSV> <第1段旧值>→<新值> cn:<旧中文>→<新中文> <输出路径>
```

- 规则：`1:<旧英文>→<新英文> cn:<旧中文>→<新中文>`
- 输出：`<原文件名>_expanded.csv`（带 UTF-8 BOM）

### 第 3 步：调用 table_clone（如果有规则表 zip）

当用户提供了规则表 zip 文件时，执行：

```bash
node D:/skills/table_clone/table_clone.mjs <规则表zip> <旧英文前缀> <新英文前缀> <旧中文前缀> <新中文前缀> <输出路径>
```

- 输出：`<原文件名>_<新英文前缀>.zip`（仅含 CSV，UTF-8 BOM）
- 权重规则集（assetType=1）跳过 content 修改

### 第 4 步：调用 process_clone（如果有决策流程 zip）

当用户提供了决策流程 zip 文件时，执行：

```bash
node D:/skills/process_clone/process_clone.mjs <决策流程zip> <旧英文前缀> <新英文前缀> <旧中文前缀> <新中文前缀> <输出路径>
```

- 输出：`<原文件名>_<新英文前缀>.zip`（仅含 CSV，UTF-8 BOM，支持驼峰替换）
- 权重规则集（assetType=1）跳过 content 修改

### 第 5 步：汇总输出

向用户报告所有输出文件路径及替换统计。

## 子 Skill 说明

| 子 Skill | 功能 | 输入 | 输出 |
|----------|------|------|------|
| var_clone | 变量批量克隆 | CSV + 规则 | CSV（带 BOM） |
| table_clone | 规则表批量改名 | zip + 前缀 | zip（仅含 CSV） |
| process_clone | 决策流程批量克隆 | zip + 前缀 | zip（仅含 CSV，驼峰支持） |

## 注意事项

- 如果用户只提供了一个或两个文件，只执行对应的 skill，不报错
- 所有输出文件默认不覆盖源文件，生成新文件名
- 规则表和决策流程的 zip 中权重规则集（assetType=1）的 content 不修改
- 变量 CSV 输出带 UTF-8 BOM，确保导入系统正确识别
- 如果用户没有提供某个文件但后续需要，可以单独补充后再调用对应 skill

$ARGUMENTS
