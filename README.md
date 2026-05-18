# 食世界

这是一个美食项目实验仓库。当前优先版本是无构建静态网页，放在 `docs/` 目录，可直接本地打开，也适合用 GitHub Pages 发布。

## 当前可运行版本

- 当前版本：TasteWorld v0.7
- 静态网页入口：[docs/index.html](./docs/index.html)
- 线上地址：[https://evander764.github.io/tasteworld/](https://evander764.github.io/tasteworld/)
- 功能范围：116 道示例菜谱浏览、默认展示部分菜品并可展开更多、零基础任务入口、条件筛选、健身餐专题、多人忌口配餐、忌口强排除、关键词搜索、今日推荐、随机推荐、详情弹窗、复制分享链接
- 数据入口：`docs/recipes.js` 中的 `window.RECIPES`
- 核心逻辑：`docs/core.js` 中的 `window.TasteworldCore`，浏览器直接使用，同时支持 Node 测试导入
- 每道菜包含 `recommendReason`、`nutritionTags`、`fitnessGoals`、`macroFocus`、`mealPrepFriendly`、`needScenes`、`mealRoles`、`cookability` 和每份营养估算 `nutrition`
- 22 道高频/零基础菜包含 `beginnerGuide`，详情页可展开“新手模式”查看火候、时间、状态判断和失败补救
- 运行时不依赖后端、npm、Vite、微信云开发或小程序环境

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

## 当前架构

- `docs/index.html`: 页面结构和脚本入口，按 `core.js`、`recipes.js`、`app.js` 的顺序加载。
- `docs/core.js`: 纯业务逻辑，包括筛选、忌口判断、配餐评分、营养估算、URL 成员编解码和菜谱数据校验。
- `docs/app.js`: 浏览器 UI 层，包括 DOM 查询、事件监听、渲染、弹窗、URL 同步和移动端筛选面板。
- `docs/recipes.js`: 静态菜谱数据，继续使用全局 `window.RECIPES`，以保持直接双击打开能力。

## 非当前交付范围

当前 GitHub Pages 交付只依赖已跟踪的 `docs/`、`test/`、`package.json` 和本文档。小程序、后台、云函数等早期原型如果存在于本地工作区，只作为历史参考，不属于当前静态站发布内容。

## 验证

```powershell
npm run check
npm test
npm run verify
```

如果 PowerShell 执行策略拦截 `npm.ps1`，使用：

```powershell
npm.cmd run verify
```

也可以单独执行语法检查：

```powershell
node --check docs/core.js
node --check docs/recipes.js
node --check docs/app.js
```

打开页面后建议手动验证：

- 选择任意筛选条件，结果数量会变化。
- 选择“鸡蛋”等忌口标签后，包含该忌口的菜谱会被排除。
- 点击“健身餐专题”卡片后，会写入 URL 参数并筛选出对应菜谱。
- 点击“完全不会做饭”“10 分钟先吃上”“按新手步骤做”后，会写入 `starter` 参数并筛出对应菜谱。
- 在“多人配餐”中填写成员忌口后，生成菜单会按成员分配可吃菜品并估算每个人营养。
- 首次进入页面只展示前 12 道菜，点击“展开更多菜品”后继续显示更多结果。
- 点击“随机一道”会打开当前筛选结果里的某道菜。
- 点击“复制分享链接”后，新窗口打开能恢复同样筛选条件、零基础入口状态和多人配餐状态。
- 点击有新手指南的菜谱卡片会打开详情弹窗，并可展开“新手模式”。
- 手机宽度下筛选区默认隐藏，底部操作条可以打开筛选面板。
