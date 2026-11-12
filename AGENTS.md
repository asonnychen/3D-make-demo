# 3D-make-demo

一个「一目录一项目」的 3D 作品仓库。根目录是容器与共享依赖层，每个子目录是一个独立项目；所有项目都以 Three.js 为主，依赖统一由根 `package.json` 管理。

| 目录 | 项目 | 端口 |
| :--- | :--- | :--- |
| `科隆大教堂建筑/` | 科隆大教堂 · Kölner Dom | 5173 |
| `Nimbus Salvagers 3D 游戏/` | Nimbus Salvagers · 云海拾荒者 | 5174 |

> **铁律：先建文件夹，再开发。** 新增任何项目，第一步都必须先在仓库根目录创建新的项目文件夹，之后所有代码、页面、构建配置与文档都放在该文件夹内。禁止在根目录直接写项目代码，禁止把新项目塞进已有项目的目录，禁止多个项目共用一个目录。

## 项目目录规则

### 1. 一目录一项目

- 每个项目一个根级目录，目录名即项目名（保留中文 / 英文展示名）。
- 项目之间不得相互 `import`、共享源码或共享构建配置。
- 根目录只保留共享内容：`README.md`、`AGENTS.md`、`.gitignore`、`docs/`，以及共享的 `package.json`、`pnpm-lock.yaml`、`node_modules/`。
- 项目目录内不得出现 `package.json`、`pnpm-lock.yaml`、`node_modules/`。
- 每个项目自带 `README.md`，说明运行方式、操作、目录与实现要点。

### 2. 共享依赖，独立源码

所有项目共用根 `package.json` 的依赖（`three`、`vite`、`tailwindcss`、`@tailwindcss/vite`）。每个项目目录至少包含：

```
<项目>/
├─ README.md
├─ index.html
├─ vite.config.js        # 端口写在项目内
└─ src/                  # 入口与源码
```

- 新增依赖时改根 `package.json`，然后在仓库根目录执行 `pnpm install`。
- 项目内只放页面、源码、静态资源与 Vite 配置，不单独安装依赖。
- 每个项目在根 `package.json` 注册一对脚本：`dev:<name>` 与 `build:<name>`，内部用 `cd <项目> && vite` 启动。
- `dist/` 必须提交到 git，作为该项目唯一的构建产物；部署和预览直接使用它。

### 3. 端口与脚本

每个项目使用独立端口，避免同时开发时冲突：

| 端口 | 项目 | 脚本 |
| :--- | :--- | :--- |
| 5173 | 科隆大教堂建筑 | `pnpm dev` / `pnpm build` |
| 5174 | Nimbus Salvagers 3D 游戏 | `pnpm dev:game` / `pnpm build:game` |
| 5180 | 科隆大教堂单文件静态预览 | `pnpm serve` |
| 5175+ | 新项目依次递增 | `pnpm dev:<name>` / `pnpm build:<name>` |

新项目在 `vite.config.js` 中显式写 `server.port`，在根 `package.json` 添加上面的脚本，并更新本表与根 `README.md`。

### 4. 命名

- 目录名：项目展示名（可含中文与空格），与作品标题一致。
- 根 `package.json` 的 `name`：仓库名 `3d-make-demo`；项目名由目录名与脚本后缀体现。
- 文档 slug：`docs/projects/<slug>.md` 与 `docs/images/<slug>.png`，slug 使用小写 kebab-case。

### 5. 文档与索引

新增项目时同步更新：

1. 项目内 `README.md`（运行、操作、目录、已知限制）。
2. `docs/projects/<slug>.md`（详细说明 + AI 复现提示词）。
3. `docs/images/<slug>.png`（作品预览图，建议 1440×900 左右）。
4. 根 `README.md` 的「作品」表格，一行一个项目，左图右文，并链接到详细文档。
5. 根 `README.md` 的「目录结构」，以及本文的项目表、端口表与脚本。

### 6. 新增项目清单

1. **先在仓库根目录创建新的项目文件夹**（这一步必须先做，确认目录建好后再写任何代码）。
2. 在新文件夹内放入 `index.html`、`vite.config.js`、`src/`、`README.md`，不创建 `package.json`。
3. 在根 `package.json` 增加 `dev:<name>` 与 `build:<name>` 脚本，并在 `vite.config.js` 里分配端口。
4. 在仓库根目录 `pnpm install`（仅在新增依赖时需要），`pnpm build:<name>` 确认产出。
5. 更新根 `README.md`、`docs/projects/`、`docs/images/` 与本文表格。
6. 提交信息使用中文，格式 `<type>: <描述>`。

### 7. 质量底线

- 全部界面中文；首次出现的英文术语附中文解释。
- 以 Three.js 为主；不引入外部模型 / 贴图 / 音频（除非项目 README 明确说明），优先程序化生成。
- 修改后运行 `pnpm build:<name>`，浏览器控制台 0 错误。
- 不提交 `node_modules/`、日志与临时截图；`dist/` 必须提交。
- 提交前 `git status` 确认只包含目标项目的改动。

### 8. 构建产物与避免重复打包

- 每个项目的 `dist/` 入库；源码变更后重新运行 `pnpm build:<name>`，并把更新后的 `dist/` 一起提交。
- `dist/` 是该项目的唯一构建目录：不要复制、改名，也不要为同一份源码生成第二份输出目录。
- 避免重复打包：部署或预览直接使用已提交的 `dist/`，不要为了同一份源码反复构建。
- 需要科隆大教堂单文件版时运行 `pnpm bundle`，它复用现有 `dist`，不会再执行一次构建。
- 提交前确认没有残留的旧构建文件；Vite 构建会自动清空 `dist/`。

### 9. 项目提交与发布规则

发布任何项目（提交并推送）之前，按以下顺序完成：

1. **刷新项目提示词**：用 `handoff` skill 为该项目生成 / 更新交接文档与项目提示词，并把提示词补充到该项目 `README.md` 的「项目提示词（Handoff）」一节。
2. **同步文档**：更新 `docs/projects/<slug>.md`、`docs/images/<slug>.png`、根 `README.md` 的作品表与目录结构（有变化时）。
3. **构建入库**：运行 `pnpm build:<name>`，把更新后的 `dist/` 一并提交。
4. **发布前自检**：浏览器控制台 0 错误；`git status` 只包含目标项目的改动；确认没有残留旧构建文件。
5. **提交并推送**：使用中文提交信息 `<type>: <描述>`，推送 `origin/master`；推送后 `git status -sb` 应显示与远端同步。

规则示例（历史做法）：

> 用 handoff skill 生成`Nimbus Salvagers 3D 游戏`的项目提示词，补充到 readme，发布到 git。

要求：

- 项目 `README.md` 没有「项目提示词（Handoff）」一节时，不允许发布该项目。
- 提示词必须反映当前实现：运行方式、操作、文件地图、已知限制、下一步。
- 发布即包含 `dist/`，不要只提交源码。
- 推送失败时先解决认证或冲突，不要改用强推。

## Agent skills

### Issue tracker

Issues live in GitHub Issues at `asonnychen/3D-make-demo`, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default triage labels, unchanged. See `docs/agents/triage-labels.md`.

### Domain docs

多项目仓库：每个项目目录是一个 context。需要领域文档时，在项目内维护 `GLOSSARY.md` 与 `docs/adr/`，并在根目录 `GLOSSARY-MAP.md` 登记；共享的 issue 追踪与 triage 配置见 `docs/agents/`。详见 `docs/agents/domain.md`。
