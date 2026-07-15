# Bilibili 动态原图打包下载

打开单条 Bilibili 动态详情页后，一键把本条动态的正文原图打包为 ZIP，并自动保存。

## 支持页面

- `https://www.bilibili.com/opus/<id>`
- `https://t.bilibili.com/<id>`

## 安装

### 方式一：星愿浏览器直接安装

1. 下载或打开 `bilibili-dynamic-originals.user.js`。
2. 星愿可能会把它安装成一个独立扩展。
3. 打开单条动态详情页，右下角出现 `下载原图 ZIP` 即可使用。

### 方式二：篡改猴安装

1. 安装 Tampermonkey / 篡改猴。
2. 新建脚本。
3. 复制 `bilibili-dynamic-originals.user.js` 的全部内容并保存。

## 使用

1. 打开单条动态详情页。
2. 点击右下角 `下载原图 ZIP`。
3. 脚本会自动保存 ZIP；如果浏览器拦截自动下载，再点绿色 `保存 ZIP`。

下载成功后的文件名优先为：

```text
YYYY-MM-DD_HHmm_UP主名_动态标题摘要_动态ID.zip
```

发布时间、UP 主或标题任一读不到时，回退为 `bilibili-dynamic-<动态ID>.zip`。

## 检查

```powershell
node --check .\bilibili-dynamic-originals.user.js
node .\checks\self-check.js
```
