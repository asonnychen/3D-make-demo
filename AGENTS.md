# 3D-make-demo

一个「一目录一项目」的 3D 作品仓库。根目录只是容器，每个子目录都是一个独立项目，自行安装依赖、启动、构建与部署，互不干扰。

| 目录 | 项目 | 技术栈 | 端口 |
| :--- | :--- | :--- | :--- |
| `科隆大教堂建筑/` | 科隆大教堂 · Kölner Dom | Vite + Three.js + Tailwind CSS v4 | 5173 |
| `Nimbus Salvagers 3D 游戏/` | Nimbus Salvagers · 云海拾荒者 | Vite + Three.js + Tailwind CSS v4 | 5174 |

> **铁律：先建文件夹，再开发。** 新增任何项目，第一步都必须先在仓库根目录创建新的项目文件夹，之后所有代码、依赖、构建配置与文档都放在该文件夹内。禁止在根目录直接写项目代码，禁止把新项目塞进已有项目的目录，禁止多个项目共用一个目录。

## 项目目录规则

### 1. 一目录一项目

- 每个项目一个根级目录，目录名即项目名（保留中文 / 英文展示名）。
- 项目之间不得相互 `import`、共享源码或共享 `node_modules`。
- 根目录不得放置任何项目的 `package.json`、`vite.config.*`、`node_modules`、`dist`。
- 根目录只保留共享内容：`README.md`、`AGENTS.md`、`.gitignore`、`docs/`。
- 每个项目自带 `README.md`，说明运行方式、操作、目录与实现要点。

### 2. 每个项目必须自包含

每个项目目录至少包含：

```
<项目>/
├─ README.md
├─ index.html
├─ package.json          # name 使用小写 kebab-case
├─ pnpm-lock.yaml        # 提交，锁定依赖
├─ vite.config.js        # 端口写在项目内
└─ src/                  # 入口与源码
```

- 依赖、脚本、构建配置全部放在项目内；不从根目录继承任何配置。
- `node_modules/`、`dist/` 由根 `.gitignore` 统一忽略，不提交。
- 项目内使用相对路径引用自己的资源，不引用其他项目的文件。

### 3. 端口分配

每个项目使用独立端口，避免同时开发时冲突：

| 端口 | 用途 |
| :--- | :--- |
| 5173 | 科隆大教堂建筑 |
| 5174 | Nimbus Salvagers 3D 游戏 |
| 5180 | 科隆大教堂单文件静态预览（`pnpm serve`） |
| 5175+ | 新项目依次递增 |

新项目在 `vite.config.js` 中显式写 `server.port`，并更新本表与根 `README.md`。

### 4. 命名

- 目录名：项目展示名（可含中文与空格），与作品标题一致。
- `package.json` 的 `name`：小写 kebab-case，例如 `nimbus-salvagers`、`cologne-cathedral-three`。
- 文档 slug：`docs/projects/<slug>.md` 与 `docs/images/<slug>.png`，slug 使用小写 kebab-case。

### 5. 文档与索引

新增项目时同步更新：

1. 项目内 `README.md`（运行、操作、目录、已知限制）。
2. `docs/projects/<slug>.md`（详细说明 + AI 复现提示词）。
3. `docs/images/<slug>.png`（作品预览图，建议 1440×900 左右）。
4. 根 `README.md` 的「作品」表格，一行一个项目，左图右文，并链接到详细文档。
5. 根 `README.md` 的「目录结构」，以及本文的项目表与端口表。

### 6. 新增项目清单

1. **先在仓库根目录创建新的项目文件夹**（这一步必须先做，确认目录建好后再写任何代码）。
2. 在新文件夹内放入 `index.html`、`package.json`、`vite.config.js`、`src/`、`README.md`。
3. `cd <新文件夹> && pnpm install`，提交 `pnpm-lock.yaml`。
4. 在新文件夹内 `pnpm dev` 自测，`pnpm build` 确认产出。
5. 更新根 `README.md`、`docs/projects/`、`docs/images/` 与本文表格。
6. 提交信息使用中文，格式 `<type>: <描述>`。

### 7. 质量底线

- 全部界面中文；首次出现的英文术语附中文解释。
- 不引入外部模型 / 贴图 / 音频（除非项目 README 明确说明），优先程序化生成。
- 修改后运行 `pnpm build`，浏览器控制台 0 错误。
- 不提交 `node_modules/`、`dist/`、日志与临时截图。
- 提交前 `git status` 确认只包含目标项目的改动。

## Agent skills

### Issue tracker

Issues live in GitHub Issues at `asonnychen/3D-make-demo`, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default triage labels, unchanged. See `docs/agents/triage-labels.md`.

### Domain docs

多项目仓库：每个项目目录是一个 context。需要领域文档时，在项目内维护 `GLOSSARY.md` 与 `docs/adr/`，并在根目录 `GLOSSARY-MAP.md` 登记；共享的 issue 追踪与 triage 配置见 `docs/agents/`。详见 `docs/agents/domain.md`。
