# Bilibili 动态原图打包下载设计

## 目标

用一个 Tampermonkey 脚本，在单条 Bilibili 动态详情页一键下载本条动态的所有正文原图，并打包为一个 ZIP。

## 范围

支持页面：

- `https://www.bilibili.com/opus/<id>`
- `https://t.bilibili.com/<id>`

不做：

- 用户主页动态流卡片按钮
- 粘贴动态链接下载
- 批量下载多个动态
- 桌面程序、构建流程、包管理器

## 交互

详情页右下角显示一个固定按钮：`下载原图 ZIP`。

按钮状态：

- `读取图片`：正在收集图片链接
- `1/9`：正在下载第 1 张，共 9 张
- `打包中`：正在生成 ZIP
- `完成`：ZIP 已触发下载
- `失败: <原因>`：下载或打包失败

如果没有找到图片，弹窗提示用户先展开图片或滚动到图片加载出来后重试。

## 取图逻辑

脚本从当前详情页收集两类来源：

1. DOM 中的 `img`、`source`、`a`、内联 `style` 背景图。
2. 页面脚本数据中的 `/bfs/` 图片链接。

收集后统一清洗：

- `//i0.hdslb.com/...` 补成 `https://...`
- `http://...` 改为 `https://...`
- 去掉 B 站缩略图参数，例如 `@1048w_...`
- 去掉查询参数
- 过滤 `face`、`emote`、`garb`、`space`、`account`、`wbi` 等非正文图片目录
- 去重

这让脚本主要依赖详情页已经包含的数据，不优先请求 B 站详情接口，减少接口风控风险。

## 下载与打包

使用 Tampermonkey 的 `GM_xmlhttpRequest` 下载图片二进制。

使用 JSZip 生成 ZIP：

- 图片文件名：`01.jpg`、`02.png` 等顺序名
- ZIP 文件名：`bilibili-dynamic-<动态ID>.zip`
- 不压缩图片，使用 `STORE`，减少浏览器 CPU 消耗

## 错误处理

单次点击期间按钮锁定，避免重复下载。

请求失败、超时、打包失败时：

- 在控制台输出完整错误
- 按钮显示简短失败原因
- 3 秒后恢复按钮文字

## 验证

每次改脚本后运行：

```powershell
node --check .\bilibili-dynamic-originals.user.js
node .\checks\self-check.js
```

自检覆盖：

- 图片 URL 清洗
- 正文图片过滤
- 页面脚本文本中的 `/bfs/` 图片提取
- 文件扩展名识别
