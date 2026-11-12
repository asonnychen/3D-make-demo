# 科隆大教堂 · Kölner Dom

按真实比例（1:200，总高 157 m）程序化生成的哥特式大教堂 Three.js 模型。全部几何体由代码实时构建，没有 `.glb`、没有贴图。

## 运行

依赖由仓库根目录统一管理，在根目录执行：

```powershell
pnpm install
pnpm dev      # http://127.0.0.1:5173
pnpm build    # 产出 科隆大教堂建筑/dist/
pnpm bundle   # 用现有 dist 生成 kolner-dom.html 单文件版
pnpm serve    # 本地静态预览单文件版（5180）
```

## 功能

- 四个预设机位 + 自动旋转；OrbitControls 拖拽 / 滚轮 / 右键平移。
- 昼夜 24 小时进度条驱动太阳/月亮位置、光色与窗玻璃自发光。
- 设计模式：素模 + 法线外扩轮廓线 + 图纸网格 + 3D 标注。
- 右侧配色面板实时修改 6 种主体材质色，伴随色自动联动。
- 全部几何按材质合批，整座建筑约 11 个 draw call。

详细说明与 AI 复现提示词见 [`../docs/projects/kolner-dom.md`](../docs/projects/kolner-dom.md)。

## 目录

```
科隆大教堂建筑/
├─ index.html
├─ kolner-dom.html      单文件版本（构建产物）
├─ vite.config.js
├─ scripts/
│  ├─ bundle-html.mjs   内联打包
│  └─ serve-static.mjs  本地静态预览
└─ src/
   ├─ main.js           场景、灯光、相机、昼夜、交互
   ├─ cathedral.js      教堂与底座的程序化几何
   └─ style.css
```

## 项目提示词（Handoff）

下面这段可直接粘贴给新的 AI 会话，用于接手、继续开发或重建本项目。

```text
你接手一个已经完成的科隆大教堂 Three.js 程序化建筑模型项目。

【仓库与环境】
- 仓库：E:\my\AI\3D-make-demo，分支 master。
- 项目目录：科隆大教堂建筑/；依赖统一由仓库根 package.json 管理。
- 运行：在仓库根目录 pnpm install；pnpm dev（http://127.0.0.1:5173）；pnpm build；pnpm bundle（复用 dist 生成单文件版）；pnpm serve（5180）。
- 技术栈：Vite 8 + Three.js r187 + Tailwind CSS v4；无外部模型 / 贴图。

【当前完成度】
- 1:200 科隆大教堂：双塔、玫瑰窗、飞扶壁、七边形后殿，全部程序化几何，按材质合批约 11 个 draw call。
- 四个预设机位 + 自动旋转；OrbitControls 拖拽 / 滚轮 / 右键平移。
- 昼夜 24 小时进度条驱动光照与窗玻璃自发光。
- 设计模式：素模 + 法线外扩轮廓线 + 图纸网格 + 3D 标注。
- 配色面板：6 种主体材质色实时修改，伴随色自动联动。
- dist/ 与 kolner-dom.html 已入库；构建产物随源码一起提交。

【代码地图】
- src/main.js：场景、灯光、相机、昼夜、设计模式、交互与 UI。
- src/cathedral.js：教堂与底座的程序化几何、材质与合批。
- src/style.css：Tailwind + 自定义界面样式。
- scripts/bundle-html.mjs：把 dist 内联为单文件 HTML。
- scripts/serve-static.mjs：单文件版本地预览。

【必须遵守】
- 全部界面中文；首次出现的英文术语附中文解释。
- 不引入外部模型 / 贴图，几何与材质继续程序化生成。
- 修改后运行 pnpm build，并提交更新后的 dist/；不要生成第二份构建目录。
- 提交信息使用中文，格式 <type>: <描述>。
- 发布前用 handoff skill 刷新本提示词并补充到 README，然后构建、提交 dist、推送 origin/master。

【下一步可做】
- 移动端交互优化；更多机位与导览路线。
- 更精细的石雕与窗花几何；draw call 继续优化。
- 单文件版体积优化（按需内联）。
- 增加建筑构件标注与说明面板。

【参考】
- 详细说明与复现提示词：docs/projects/kolner-dom.md
- 最近提交：见仓库 git log --oneline -1
```

