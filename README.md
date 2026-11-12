# 3D-make-demo

用 AI 驱动、以自然语言提示词生成程序化 3D 内容的项目。所有几何体由代码实时构建，没有 `.glb`、没有贴图，浏览器里直接渲染和交互 —— 从一座建筑模型，到一款可以玩的第一人称动作射击游戏。

## 作品

| 预览 | 说明 |
| :--- | :--- |
| <img src="docs/images/kolner-dom.png" width="380" alt="科隆大教堂三维模型"> | **科隆大教堂 · Kölner Dom**<br><sub>Three.js · 程序化几何 · 1:200</sub><br><br>按真实比例（1:200，总高 157 m）还原的哥特式大教堂：22 m 见方双塔在 100 m 与 122 m 两次收分、132–157 m 八角镂空尖塔，16.4 m 玫瑰窗，七边形半圆后殿，中殿两侧各 10 道飞扶壁。全部几何按材质合批，整座建筑只有约 11 个 draw call。<br><br>四个预设机位 + 自动旋转，昼夜 24 小时进度条驱动光照与窗玻璃自发光，设计模式切成素模 + 图纸网格 + 3D 标注，右侧配色面板可实时改 6 种主体材质色。<br><br>[详细说明与 AI 复现提示词 →](docs/projects/kolner-dom.md) |
| <img src="docs/images/nimbus-salvagers.png" width="380" alt="Nimbus Salvagers 云海拾荒者游戏画面"> | **Nimbus Salvagers · 云海拾荒者**<br><sub>Three.js · 第一人称动作射击 · 程序化云海</sub><br><br>穿越漂浮遗迹的科幻远征：工程师从 Cirrus Reach 涡轮机站点出发，用自动步枪、冲刺、跳跃与过载脉冲抵御三波风之守卫，修复涡轮机并收集线圈代币。原创云层、帆状机械与蓝绿色能量。<br><br>三章节剧情、四档自动改装、12 枚固定代币、程序化合成音效；全部模型与贴图由代码生成。波次表与敌人管理器按数据驱动 / 多实例设计，为合作模式与风之试炼预留接口。<br><br>[详细说明与 AI 复现提示词 →](docs/projects/nimbus-salvagers.md) |
| _待添加_ | _下一个作品排在这里，格式同上：左图右文。_ |

## 快速开始

根目录是容器与共享依赖层：所有项目共用根 `package.json` 的依赖（以 Three.js 为主），一次安装即可；每个子目录仍是独立项目，各自启动、互不干扰。新增项目请遵循 [`AGENTS.md`](AGENTS.md) 的「项目目录规则」。

```powershell
pnpm install          # 仓库根目录，安装所有项目共用的依赖

pnpm dev              # 项目 01 · 科隆大教堂  http://127.0.0.1:5173
pnpm build            # 构建科隆大教堂 → 科隆大教堂建筑/dist/
pnpm bundle           # 生成单文件版 → 科隆大教堂建筑/kolner-dom.html

pnpm dev:game         # 项目 02 · Nimbus Salvagers  http://127.0.0.1:5174
pnpm build:game       # 构建游戏 → Nimbus Salvagers 3D 游戏/dist/
```

单文件版本把 Three.js、样式和全部程序内联进一个 HTML（约 640 KB），双击即可打开，不需要服务器、不依赖网络。

技术栈：Vite + Three.js + Tailwind CSS v4。

## 目录结构

```
3D-make-demo/
├─ README.md               作品索引
├─ AGENTS.md               项目目录规则与协作约定
├─ .gitignore
├─ package.json            共享依赖与各项目脚本
├─ pnpm-lock.yaml          统一锁文件
├─ docs/
│  ├─ images/              作品预览图
│  ├─ projects/            每个作品的详细说明与 AI 提示词
│  └─ agents/              技能配置（issue 追踪器、triage 标签、领域文档）
├─ 科隆大教堂建筑/          项目 01 · 端口 5173
│  ├─ README.md
│  ├─ index.html
│  ├─ vite.config.js
│  ├─ kolner-dom.html      单文件版本（构建产物）
│  ├─ scripts/
│  └─ src/
└─ Nimbus Salvagers 3D 游戏/  项目 02 · 端口 5174
   ├─ README.md
   ├─ index.html
   ├─ vite.config.js
   └─ src/
```
