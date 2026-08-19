# dsh-elf i18n 设计：界面跟随 DSH 语言（中/英）

日期：2026-08-19
状态：已批准（用户 2026-08-19 选择「同意，开始实现」）

## 背景与目标

dsh-elf 2.1.0 的界面与 host 错误消息全部硬编码为中文；系统提示词也是中文。
目标：支持英文，并根据 DSH 设置中的语言，**自动、零刷新地**在中/英之间切换。

范围（用户确认）：界面文字 + host 错误消息跟随 DSH 语言；系统提示词改为中英双语
模板，让模型按用户当前界面语言回复，**不强制**语言。

## 机制（已核实，无需发明）

当前 DSH 桌面版内置 `@deepseek-ai/dsh-client-locale`；同生态插件 dsh-market 的既有模式：

- `inject` 数组加入 `'locale'`；
- `ctx.locale.register(NS, { zh, en })` 注册命名空间双语词典；
- `useSyncExternalStore(cb => ctx.locale.subscribe(cb), () => ctx.locale.getSnapshot())`
  订阅变化 → 语言切换即重渲染（无需刷新页面）；
- 语言判定：`String(snapshot.active).toLowerCase().startsWith('zh') ? 'zh' : 'en'`；
- 槽位注册元数据支持 `label: () => t('name')` 与 `locale: NS`，入口名也可本地化。

## 设计

### 1. 新增 `src/locales.js`

zh（事实源）/ en（1:1 镜像）两本词典，覆盖现有全部用户可见字符串：

- 窗口/槽位名：`name`（DeepSeek 小精灵 / DeepSeek Elf）、`title`（DeepSeek 精灵 /
  DeepSeek Elf）
- 头部：`mini`（最小化到小精灵 / Minimize to elf）、`clearTitle`（清空聊天 /
  Clear chat）、`clear`（清空 / Clear）
- 配置面板：`modelSource`（模型来源 / Model source）、`follow`（跟随会话默认 /
  Follow session default）、`provider`（提供方 / Provider）、`apiBase`（API 地址 /
  API base URL）、`apiKey`（API Key）、`model`（模型 / Model）、`reasoning`
  （reasoning / reasoning）、`effortPh`（可选：high / medium / low /
  Optional: high / medium / low）、`cfgHint`（自定义模式说明，长句双语）
- 消息区：`inputPh`（问小精灵点什么… / Ask the elf something…）、`empty`
  （临时聊天提示 / chat-not-saved hint）、`copy`（复制 / Copy）、`send`（➤，无文字）
- 错误/状态：`needCustomCfg`（请先填写 API 地址、API Key 和模型名）、`reqFailed`
  （请求失败 / Request failed）、`chatEnded`（对话结束 / Chat ended）、
  `hostFail`（小精灵 Host 请求失败 ({0}) / Elf host request failed ({0})）、
  `modelFollow`（跟随默认 / Following default）
- 参数化约定：含动态数字/拼接的文案统一用 `{0}` 占位（同 dsh-market 的
  `string.replace('{0}', …)` 约定），`effModelCustom` 的域名/模型/effort 拼接保持。

### 2. `src/client.js`

- `export const inject = ['slots', 'locale']`；`apply` 开头：
  `ctx.effect(() => ctx.locale.register(NS, { zh, en }))`，`const t = ctx.locale.bind(NS)`。
- ElfApp 内：`const lang = useSyncExternalStore(...)`；渲染一律查词典
  （`T = lang === 'zh' ? zh : en`，或 `t(key)`）。
- `callHost` 错误文案、`send()` 各错误路径、复制按钮、占位符等替换为词典文本。
- 槽位注册：`label: () => t('name')`、`locale: NS`。
- **降级**：若 `ctx.locale` 为 undefined（旧 host），取
  `String(document.documentElement.lang || navigator.language || 'zh')` 做加载时快照，
  不订阅（无实时切换但仍按加载时语言渲染）。

### 3. `src/host.js`（= lib/index.js）

- `elf.chat.start` 请求体接受可选 `lang`（'zh' | 'en'，缺省 'zh'，向后兼容）；
  该 lang 仅用于本聊天实例的错误文案与系统提示词（按 chatId 记忆在 entry 上）。
- 错误消息表按 lang 输出：413 / 400 / 405 / 404 / LLM 不可用 / 无消息 / 未配置模型 /
  对话不存在，中英两套。
- SYSTEM_PROMPT 改双语模板：中文段 + 英文段 + 一句「请使用用户当前界面语言
  回复（中文或英文）。」不强制——模型根据提问语言与说明自行判断。

### 4. 版本与文档

- package.json 2.1.0 → 2.2.0；README.md / README.zh.md 在 Features 或 Configuration
  附近加一句 Language 说明（跟随 DSH 设置语言，支持中英）。
- CHANGELOG.md 新增 2.2.0 条目（尚未发布，日期填写当日）。
- README 中 `minimumReleaseAgeExclude` 示例同步为 `dsh-elf@2.2.0`。

### 5. 测试

- `test/client.test.js` 增守卫：`inject` 含 `'locale'`；`src/locales.js` 的 en 键与 zh
  完全一致（1:1）；client.js 含 `useSyncExternalStore` 与 `startsWith('zh')` 判定；
  含降级分支 `navigator.language`。
- `test/host.test.js` 增用例：`elf.chat.start` 传 `lang:'en'` 且无消息 → 英文错误
  （'No message content'）；缺省 lang → 中文错误（无消息）；捕获 `llm.stream`
  的 options，断言 lang='en' 时 system 含 "DeepSeek elf"、lang='zh'（或缺省）时含
  中文段。

### 6. 部署节奏

- 本地 `npm run check/test/build` 全绿后提交（拆 2-3 笔：feat(i18n) 客户端、feat(i18n)
  host、docs/版本）。
- 推送 dsh-elf main（提交数继续 >10，不受影响）。
- PR #1694 的 gate 仍待仓库年龄通过（2026-08-19 11:21 UTC 之后推一笔空提交重触发）。
  本版本合并进 PR 分支前无需改动 awesome-dsh-plugin 条目（描述与本功能不冲突）。
- npm 发布 2.2.0：若环境无 npm 凭据，则由用户发布或在用户授权下处理。

## 不做的事（YAGNI）

- 不引入 i18n 框架；不做「自定义界面语言」独立选项（只跟随 DSH 设置）；
- 不本地化 localStorage 键名（内部标识，无用户可见性）；
- 不强制模型回复语言（双语模板说明，模型自行判断）。