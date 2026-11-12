# 3D-make-demo

用 AI 驱动、以自然语言提示词生成程序化 3D 内容的项目。所有几何体由代码实时构建，没有 `.glb`、没有贴图，浏览器里直接渲染和交互 —— 从一座建筑模型，到一款可以玩的第一人称动作射击游戏。

## 作品

| 预览 | 说明 |
| :--- | :--- |
| <img src="docs/images/kolner-dom.png" width="380" alt="科隆大教堂三维模型"> | **科隆大教堂 · Kölner Dom**<br><sub>Three.js · 程序化几何 · 1:200</sub><br><br>按真实比例（1:200，总高 157 m）还原的哥特式大教堂：22 m 见方双塔在 100 m 与 122 m 两次收分、132–157 m 八角镂空尖塔，16.4 m 玫瑰窗，七边形半圆后殿，中殿两侧各 10 道飞扶壁。全部几何按材质合批，整座建筑只有约 11 个 draw call。<br><br>四个预设机位 + 自动旋转，昼夜 24 小时进度条驱动光照与窗玻璃自发光，设计模式切成素模 + 图纸网格 + 3D 标注，右侧配色面板可实时改 6 种主体材质色。<br><br>[详细说明与 AI 复现提示词 →](docs/projects/kolner-dom.md) |
| <img src="docs/images/nimbus-salvagers.png" width="380" alt="Nimbus Salvagers 云海拾荒者游戏画面"> | **Nimbus Salvagers · 云海拾荒者**<br><sub>Three.js · 第一人称动作射击 · 程序化云海</sub><br><br>穿越漂浮遗迹的科幻远征：工程师从 Cirrus Reach 涡轮机站点出发，用自动步枪、冲刺、跳跃与过载脉冲抵御三波风之守卫，修复涡轮机并收集线圈代币。原创云层、帆状机械与蓝绿色能量。<br><br>三章节剧情、四档自动改装、12 枚固定代币、程序化合成音效；全部模型与贴图由代码生成。波次表与敌人管理器按数据驱动 / 多实例设计，为合作模式与风之试炼预留接口。<br><br>[详细说明与 AI 复现提示词 →](docs/projects/nimbus-salvagers.md) |
| _待添加_ | _下一个作品排在这里，格式同上：左图右文。_ |

## 快速开始

```powershell
pnpm install
pnpm dev      # 科隆大教堂 http://127.0.0.1:5173
pnpm build    # 产出 科隆大教堂建筑/dist/
pnpm bundle   # 构建并生成 科隆大教堂建筑/kolner-dom.html 单文件版
```

单文件版本把 Three.js、样式和全部程序内联进一个 HTML（约 640 KB），双击即可打开，不需要服务器、不依赖网络。

游戏是独立子项目，有自己的依赖与端口：

```powershell
cd "Nimbus Salvagers 3D 游戏"
pnpm install
pnpm dev      # http://127.0.0.1:5174
pnpm build    # 产出 Nimbus Salvagers 3D 游戏/dist/
```

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
├─ 科隆大教堂建筑/
│  ├─ index.html
│  ├─ kolner-dom.html      单文件版本（构建产物）
│  ├─ scripts/
│  │  ├─ bundle-html.mjs   内联打包
│  │  └─ serve-static.mjs  本地静态预览
│  └─ src/
│     ├─ main.js           场景、灯光、相机、昼夜、交互
│     ├─ cathedral.js      教堂与底座的程序化几何
│     └─ style.css
└─ Nimbus Salvagers 3D 游戏/
   ├─ index.html           标题、HUD、暂停/阵亡/胜利界面
   ├─ package.json         独立依赖与脚本（dev / build / preview）
   ├─ vite.config.js
   └─ src/
      ├─ main.js           状态机、输入、战斗事件、章节流程
      ├─ config.js         平台、波次、改装档位与数值
      ├─ world.js          天空、云海、岛屿、涡轮机、代币、风帆
      ├─ player.js         第一人称控制器、第一人称武器、相机
      ├─ enemies.js        守卫模型、AI、投射物、血条
      ├─ fx.js             粒子、曳光、冲击环、枪口闪光
      ├─ audio.js          WebAudio 合成音效与环境声
      ├─ ui.js             HUD 与界面状态
      └─ style.css
```
