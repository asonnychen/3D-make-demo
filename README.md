# 3D-make-demo

用 AI 驱动、以自然语言提示词生成程序化 3D 建筑模型的项目。所有几何体由代码实时构建，没有 `.glb`、没有贴图，浏览器里直接渲染和交互。

## 作品

| 预览 | 说明 |
| :--- | :--- |
| <img src="docs/images/kolner-dom.png" width="380" alt="科隆大教堂三维模型"> | **科隆大教堂 · Kölner Dom**<br><sub>Three.js · 程序化几何 · 1:200</sub><br><br>按真实比例（1:200，总高 157 m）还原的哥特式大教堂：22 m 见方双塔在 100 m 与 122 m 两次收分、132–157 m 八角镂空尖塔，16.4 m 玫瑰窗，七边形半圆后殿，中殿两侧各 10 道飞扶壁。全部几何按材质合批，整座建筑只有约 11 个 draw call。<br><br>四个预设机位 + 自动旋转，昼夜 24 小时进度条驱动光照与窗玻璃自发光，设计模式切成素模 + 图纸网格 + 3D 标注，右侧配色面板可实时改 6 种主体材质色。<br><br>[详细说明与 AI 复现提示词 →](docs/projects/kolner-dom.md) |
| _待添加_ | _下一个模型排在这里，格式同上：左图右文。_ |

## 快速开始

```powershell
pnpm install
pnpm dev      # http://127.0.0.1:5173
pnpm build    # 产出 科隆大教堂建筑/dist/
pnpm bundle   # 构建并生成 科隆大教堂建筑/kolner-dom.html 单文件版
```

单文件版本把 Three.js、样式和全部程序内联进一个 HTML（约 640 KB），双击即可打开，不需要服务器、不依赖网络。

技术栈：Vite + Three.js + Tailwind CSS v4。

## 目录结构

```
3D-make-demo/
├─ package.json            依赖与脚本（dev / build / preview / bundle）
├─ pnpm-lock.yaml
├─ vite.config.js          vite 根指向 科隆大教堂建筑/
├─ docs/
│  ├─ images/              作品预览图
│  ├─ projects/            每个作品的详细说明与 AI 提示词
│  └─ agents/              技能配置（issue 追踪器、triage 标签、领域文档）
└─ 科隆大教堂建筑/
   ├─ index.html
   ├─ kolner-dom.html      单文件版本（构建产物）
   ├─ scripts/
   │  ├─ bundle-html.mjs   内联打包
   │  └─ serve-static.mjs  本地静态预览
   └─ src/
      ├─ main.js           场景、灯光、相机、昼夜、交互
      ├─ cathedral.js      教堂与底座的程序化几何
      └─ style.css
```
