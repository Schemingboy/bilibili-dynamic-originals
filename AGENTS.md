# 项目规则

这个目录只维护一个小工具：Bilibili 单条动态原图打包下载脚本。

## 文件约定

- `bilibili-dynamic-originals.user.js`：唯一可安装的 Tampermonkey 脚本源文件。
- `checks/`：放最小可运行检查，只验证脚本里的关键纯函数。
- `新建 文本文档.txt`：旧脚本备份，不再作为可安装版本维护。

## 修改原则

- 不做桌面程序、不加构建流程、不引入包管理器；Tampermonkey 加 JSZip 已够用。
- 只支持“当前打开的单条动态/opus，或动态列表里的单个动态卡片”打包下载。
- 页面结构变了就优先修图片识别规则，不堆针对某一条动态的特殊判断。

## 验收

修改脚本后至少运行：

```powershell
node --check .\bilibili-dynamic-originals.user.js
node .\checks\self-check.js
```
