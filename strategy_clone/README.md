# strategy_clone - 策略包一键克隆工具

## 背景

克隆一套策略通常涉及三个层面的工作：

1. **变量克隆**（var_clone）：将变量明细中的前缀替换，生成新变量 CSV
2. **规则表克隆**（table_clone）：将规则表导出包中的表名前缀替换，生成新 zip
3. **决策流程克隆**（process_clone）：将决策流程导出包中的表名前缀替换，生成新 zip

这三个操作共享相同的前缀替换逻辑（英文前缀 + 中文前缀），但作用于不同的文件和字段。`strategy_clone` 将它们整合为一个命令，用户只需提供前缀和文件即可一次性完成。

## 使用方式

```
/strategy_clone <旧英文前缀> <新英文前缀> <旧中文前缀> <新中文前缀> [变量CSV] [规则表zip] [决策流程zip]
```

## 执行流程

```
用户输入: /strategy_clone dd jd 滴滴 京东 C:\vars.csv C:\table.zip C:\process.zip
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
              var_clone        table_clone     process_clone
              dd→jd            dd→jd            dd→jd
              滴滴→京东        滴滴→京东        滴滴→京东
                    │               │               │
                    ▼               ▼               ▼
              vars_expanded.csv  table_jd.zip   process_jd.zip
```

## 子 Skill 调用详情

### var_clone

```bash
node D:/skills/var_clone/var_clone.mjs <变量CSV> 1:<旧英文>→<新英文> cn:<旧中文>→<新中文> <输出路径>
```

- 按 `_` 分割变量名，替换第 1 段
- 同步替换 nameCn 和 variableDesc 中的中文文本
- 输出 CSV 带 UTF-8 BOM

### table_clone

```bash
node D:/skills/table_clone/table_clone.mjs <规则表zip> <旧英文> <新英文> <旧中文> <新中文> <输出路径>
```

- 替换 assetName（英文前缀：下划线模式）
- 替换 name（中文前缀）
- 非权重规则集：替换 content 的 base64 内容
- 输出 zip 仅含 CSV

### process_clone

```bash
node D:/skills/process_clone/process_clone.mjs <决策流程zip> <旧英文> <新英文> <旧中文> <新中文> <输出路径>
```

- 替换 assetName（英文前缀：下划线 + 驼峰）
- 替换 name（中文前缀）
- 非权重规则集：替换 content 的 base64 内容
- 输出 zip 仅含 CSV

## 灵活调用

用户可以只提供部分文件，skill 只执行对应的子任务：

```
# 只克隆变量和规则表
/strategy_clone dd jd 滴滴 京东 C:\vars.csv C:\table.zip

# 只克隆决策流程
/strategy_clone fm mt 富民 美团 C:\process.zip

# 只克隆变量
/strategy_clone xy pdd 新氧 拼多多 C:\vars.csv
```

如果缺少前缀参数，会提示用户补充。

## 输出文件命名

| 子 Skill | 输出文件命名规则 |
|----------|-----------------|
| var_clone | `<原文件名>_expanded.csv` |
| table_clone | `<原文件名>_<新英文前缀>.zip` |
| process_clone | `<原文件名>_<新英文前缀>.zip` |

## 文件结构

```
D:\skills\strategy_clone\
├── SKILL.md          - Claude Code skill 定义
└── README.md         - 本文档
```

## 依赖

本 skill 依赖以下三个子 skill：

- `D:\skills\var_clone\var_clone.mjs`
- `D:\skills\table_clone\table_clone.mjs`
- `D:\skills\process_clone\process_clone.mjs`
