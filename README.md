# 食世界

这是一个美食项目实验仓库。当前优先版本是无构建静态网页，放在 `docs/` 目录，可直接本地打开，也适合用 GitHub Pages 发布。

## 当前可运行版本

- 静态网页入口：[docs/index.html](./docs/index.html)
- 功能范围：菜谱浏览、条件筛选、忌口强排除、关键词搜索、随机推荐、详情弹窗
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

当前仓库还没有远程地址，也还没有提交记录。首次发布可以按这个顺序做：

1. 在 GitHub 创建一个新仓库。
2. 在本地提交当前代码。
3. 把本地仓库推送到 GitHub。
4. 打开 GitHub 仓库的 `Settings > Pages`。
5. `Source` 选择 `Deploy from a branch`。
6. `Branch` 选择默认分支，例如 `master`。
7. `Folder` 选择 `/docs`。
8. 保存后访问 GitHub Pages 生成的地址。

生成的地址通常是：

```text
https://<username>.github.io/<repo>/
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
- 选择“含鸡蛋”等忌口标签后，包含该忌口的菜谱会被排除。
- 点击“随机一道”会打开当前筛选结果里的某道菜。
- 点击任意菜谱卡片会打开详情弹窗。
