# 食世界

这是一个美食项目实验仓库。当前优先版本是无构建静态网页，放在 `docs/` 目录，可直接本地打开，也适合用 GitHub Pages 发布。

## 当前可运行版本

- 静态网页入口：[docs/index.html](./docs/index.html)
- 线上地址：[https://evander764.github.io/tasteworld/](https://evander764.github.io/tasteworld/)
- 功能范围：60 道示例菜谱浏览、条件筛选、忌口强排除、关键词搜索、今日推荐、随机推荐、详情弹窗、复制分享链接
- 数据入口：`docs/recipes.js` 中的 `window.RECIPES`
- 每道菜包含 `recommendReason`、`nutritionTags` 和每份营养估算 `nutrition`
- 不依赖后端、npm、Vite、微信云开发或小程序环境

## 本地运行

最简单方式：直接双击打开 `docs/index.html`。

更接近线上环境的方式：

```powershell
python -m http.server 4173 -d docs
```

然后访问：

```text
http://localhost:4173
```

## GitHub Pages 发布

当前仓库发布到 `Evander764/tasteworld`，GitHub Pages 使用 `master` 分支的 `/docs` 目录。

发布地址：

```text
https://evander764.github.io/tasteworld/
```

## 旧版目录

这些目录保留作为后续扩展参考，静态网页第一版不会依赖它们：

- `miniprogram/`: 微信小程序原型
- `admin-web/`: React 后台原型
- `cloudfunctions/`: 云函数接口原型
- `shared/`: 早期共享数据和服务原型

## 验证

```powershell
node --check docs/app.js
node --check docs/recipes.js
```

打开页面后建议手动验证：

- 选择任意筛选条件，结果数量会变化。
- 选择“鸡蛋”等忌口标签后，包含该忌口的菜谱会被排除。
- 点击“随机一道”会打开当前筛选结果里的某道菜。
- 点击“复制分享链接”后，新窗口打开能恢复同样筛选条件。
- 点击任意菜谱卡片会打开详情弹窗。
- 手机宽度下筛选区默认隐藏，底部操作条可以打开筛选面板。
