# Bilibili 动态原图打包下载

Tampermonkey 脚本：打开单条 Bilibili 动态详情页后，一键下载本条动态的所有正文原图并打包为 ZIP。

## 支持页面

- `https://www.bilibili.com/opus/<id>`
- `https://t.bilibili.com/<id>`

## 使用

1. 安装 Tampermonkey。
2. 新建脚本，复制 `bilibili-dynamic-originals.user.js` 的内容。
3. 打开单条动态详情页，点击右下角 `下载原图 ZIP`。

## 检查

```powershell
node --check .\bilibili-dynamic-originals.user.js
node .\checks\self-check.js
```
