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
