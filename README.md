<h1 align="center">dsh-preset-inspector</h1>

<p align="center">Agent preset 检查器：看清每个 preset 的层来源、装配树、提示词与工具（DeepSeek Harness 插件）</p>

<p align="center">
  <img alt="Preset Inspector" src="./docs/preview/model-input.png" width="100%" />
</p>

## 为什么需要它

设置页的「查看配置」只给你一份 YAML 文本：没有来源、没有包信息、没有层次。可 preset 的实际行为是**多层补丁叠出来的**——`dsh-base` 声明一行、`dsh-web-app` 改它、你的 `cordis.patch.yml` 再改一次。最后哪个值生效、这行是谁加的，全藏在多份文件里。

Preset Inspector 把同一份装配拆成三种看法：

- **模型输入**：当前 preset 实际收到的系统提示词、动态上下文和工具定义；
- **插件树**：每个 preset 由哪些插件行组成，每行来自哪一层；
- **补丁层**：整个 profile 的 bundle / profile / home 补丁栈，以及每层执行的 insert / replace config / disable。

它只读，不改任何 preset 或配置。

## 安装

直接装 git 源：

```sh
dsh plugin --profile web add github:omdsh-dev/dsh-preset-inspector
```

装完重启 `dsh web`。本包依赖宿主注入官方包，**不要用本地目录 `link:` 安装**。

离线或需要固定产物时，可以用 release 里的 tarball：

```sh
pnpm pack
dsh plugin --profile web add ./dsh-preset-inspector-*.tgz
```

## 用起来是什么样

在 **Settings → Agent presets** 的任意 preset 卡片上点「检查」打开面板。面板内可切换 preset，不需要另开入口。

![Settings 入口](docs/preview/settings-entry.png)

### 模型输入

系统提示词按类型分组（身份 / 人设 / 工具引导…）。点「显示来源」可以看到每段的段名、来源和包名；不显示时页面只保留正文。

- **System Prompt**：按 `order` 排列；完整 section 规则由真实 assembly 决定。
- **动态注入**：每个 context 槽位可点击，查看 `order`、必需/可选、归属和装配说明。
- **工具定义**：模型侧真实 schema；工具名、描述、参数和提供方。搜索框可过滤。

![动态上下文详情](docs/preview/context-detail.png)

### 插件树 / 补丁层

插件树展示每行插件、分类、包名、工具列表，以及插入/修改/禁用的层信息。补丁层展示每层实际执行的 ops；`config` patch 会标成整体替换，避免误以为是按 key 合并。

## 能力面

| 能力 | 说明 |
|---|---|
| 模型输入 | 系统提示词、动态注入、工具定义；自动捕获 Agent setup 结果 |
| 来源显示 | 「显示来源」按需显示段名/来源/包名和工具提供方 |
| 插件树 | preset 的插件行、分类、工具、layers |
| 补丁层 | bundle → profile → home 的补丁栈与 ops |
| 官方设置入口 | Settings → Agent presets 卡片上的「检查」（唯一入口，不占侧栏） |
| 兼容性 | 浅/深色、中/英、390px 窄屏、键盘焦点 |

## 已知限制

- **只读**；但为了拿到 Agent setup 阶段的数据，后台会自动执行一次 preset setup。它不发送模型请求；第三方插件在 setup 中可能有文件/网络等副作用。
- Agent/session 条件才注册的工具或提示词段不会出现在 mount 快照里；以实际会话为准。
- 层栈来自请求时读取的磁盘配置；CLI overlay、telemetry patch 和已热协调的内存树不在回放范围内。
- `config` patch 是整体替换，不是按 key 合并。
- 静态扫描只作为兜底，仍是启发式，复杂运行时拼接可能漏/多列。
- 同一 group 内重复 id 的行用 `#2` 区分；删除前一个同名行时序号会前移，极端情况下来源会显示为 patch。
- Settings 卡片上的「检查」是 DOM 装饰：官方 0.2.1 没有 per-card slot，官方卡片结构变化时入口会暂时消失（插件不再提供侧栏备用入口）。面板挂在 `shell.overlay`，打开事件监听和卡片装饰都由它维护。
- dry-run 在 `0.2.1-rc.1` 实测不留下新 session 文件，但依赖 factory rollback 语义；升级 dsh 后需要重新验证。

更多实现细节与验证证据见 [docs/engineering-notes.md](docs/engineering-notes.md)。

## 插件管理

装/卸/启停用官方 CLI：`dsh plugin --profile web add|remove <包>`；已装插件在**侧边栏 Plugins 页**里查看与配置。

## 兼容性

| dsh 版本 | 状态 |
|---|---|
| `0.2.1-rc.1` | ✅ 已验证（2026-10-17，隔离 DSH_HOME：tarball 安装、mount assembly、dry-run、Settings 入口、三视角、浅/深色、中/英、390px 窄屏、键盘焦点） |
| `0.2.0-rc.2` | ⚠️ 未验证——段名/服务名若有差异，模型输入可能显示“运行时”而非模板 |

## 许可

MIT，见 [LICENSE](LICENSE)。
