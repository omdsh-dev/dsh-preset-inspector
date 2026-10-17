/**
 * Browser half of dsh-preset-inspector.
 *
 * Three faces of one composition:
 *  - Model view: the ordered document the model receives, each passage
 *    labelled with where it comes from (deployment, preset, or package).
 *  - Harness view: the plugin tree, including each row's layer trail.
 *  - Layers view: the patch stack itself, with per-layer operations.
 */
window.__ModuleLoader__.load({
  id: 'dsh-preset-inspector',
  factory: (require) => {
    const React = require('react')
    const { useEffect, useMemo, useRef, useState } = React
    // The sidebar footer is a narrow, often transformed container; a portaled
    // overlay is the only way to render a full-surface dialog above it.
    let ReactDOM
    try {
      ReactDOM = require('react-dom')
    } catch {
      ReactDOM = undefined
    }
    const h = React.createElement

    const NS = 'preset-inspector'
    const ROUTE = '/api/preset-inspector/data'
    const ASSEMBLE_ROUTE = '/api/preset-inspector/assemble'
    const DRY_ROUTE = '/api/preset-inspector/dryrun'

    /**
     * UI copy lives here, never inline in the render functions. The client
     * registers the same table through `ctx.locale.register`; the local lookup
     * is the fallback for a stubbed/bare host.
     */
    const DICTS = {
      zh: {
        'panel.title': 'Preset 检查器',
        'panel.close': '关闭',
        'panel.reload': '重新读取',
        'face.model': '模型输入',
        'face.harness': '插件树',
        'face.layers': '补丁层',
        'preset.default': '默认',
        'preset.broken': '加载异常',
        'preset.brokenHint': '这个 preset 在挂载时报告了错误：{message}',
        'stats.rows': '{count} 行',
        'stats.tools': '{count} 个工具',
        'state.loading': '读取中…',
        'state.loadFailed': '读取失败：',
        'state.mounting': '正在挂载这个 preset…',
        'state.assembleFailed': '装配失败：',
        'state.retry': '重试',
        'empty.presets': '没有找到 agent preset',
        'empty.presetsHint': '这份 profile 没有声明 preset；可以切到「装配层」看补丁栈。',
        'empty.sections': '这个 preset 没有注册任何提示词段。',
        'model.systemTitle': '系统提示词',
        'model.sectionCount': '{count} 段',
        'model.contextCount': '{count} 个插槽',
        'model.toolCount': '{count} 个工具',
        'model.showSources': '显示来源',
        'model.hideSources': '隐藏来源',
        'model.openSection': '查看详情：{title}',
        'model.copyNote': '复制内容仅含可展示正文；省略 {count} 段运行时/静态提示。',
        'model.runtimeTitle': '{count} 段没有可直接展示的静态正文（仍属于 System Prompt）：',
        'model.contextTitle': '动态注入',
        'context.required': '必需',
        'context.optional': '可选',
        'context.note': '具体触发条件在 provider 内；可选项在 suppressRuntimeContext 时会被抑制。探针只看到槽位，不执行真实会话条件。',
        'context.empty': '没有注册运行时上下文。',
        'context.view': '查看上下文详情：{name}',
        'context.detailNote': '触发条件由注册该 context 的 provider 决定；这里只展示装配信息（order、required、origin），不执行 provider。',
        'model.copy': '全文复制',
        'model.copied': '已复制',
        'model.copyFailed': '复制失败',
        'model.runtimeHint': '运行时',
        'model.staticHint': '静态片段，实际内容在运行时求值。',
        'model.noStatic': '这一段没有静态文本，内容在运行时生成。',
        'model.toolTitle': '工具定义',
        'tools.empty': '没有解析到工具。',
        'tools.search': '筛选工具…',
        'tools.noMatch': '没有匹配的工具。',
        'tools.note': '没有写死的说明，描述在运行时生成。',
        'tools.source': '提供方',
        'tools.appears': '出现在',
        'tools.params': '参数（{count}）',
        'tools.noParams': '未声明',
        'tools.parametersJson': '参数（JSON）',
        'tools.schema': '参数 schema',
        'model.assemblyError': '部分提示词或工具信息不可用：{error}',
        'drawer.close': '关闭详情',
        'field.kind': '类型',
        'field.order': 'order',
        'field.source': '来源',
        'field.visibility': '可见性',
        'field.lastChanged': '最后修改',
        'field.probe': '探针求值',
        'field.staticHint': '静态扫描片段',
        'field.origin': '归属',
        'field.package': '包',
        'field.version': '版本',
        'field.category': '类别',
        'field.status': '状态',
        'field.enabled': '启用',
        'field.disabled': '已禁用',
        'field.conditional': '条件禁用：{condition}',
        'field.layer': '来源层',
        'field.trail': '层溯源',
        'field.config': '声明的 config',
        'field.before': '变更前',
        'field.after': '变更后',
        'action.insert': '插入',
        'action.patch': '修改',
        'action.replace': '替换',
        'action.remove': '移除',
        'action.disable': '禁用',
        'action.touch': '引用',
        'origin.deployment': '部署层',
        'origin.preset': 'preset',
        'origin.package': '工具包',
        'origin.unknown': '未知来源',
        'kind.identity': '身份',
        'kind.persona': '人设',
        'kind.instructions': '指令',
        'kind.tools': '工具引导',
        'kind.skills': '技能',
        'kind.context': '上下文',
        'kind.other': '其他',
        'category.persona': '人设',
        'category.instructions': '指令',
        'category.tool': '工具',
        'category.skill': '技能',
        'category.capability': '能力',
        'category.ui': '界面',
        'category.other': '其他',
        'section.identity': '身份',
        'section.persona': '人设',
        'section.personaSuffix': '人设后缀',
        'section.deliverables': '交付物引用',
        'section.source': '运行环境',
        'section.web': '界面上下文',
        'section.mcp': 'MCP 资源',
        'section.planPolicy': '计划策略',
        'section.tool': '工具引导：{name}',
        'section.context': '上下文：{name}',
        'group.badge': '组',
        'disabled.badge': '已禁用',
        'conditional.badge': '条件',
        'layers.title': '补丁层',
        'layers.scope': '整个 profile',
        'layers.hint': '按启动顺序列出补丁层；config 是整体替换。',
        'layers.empty': '没有可读取的补丁层。',
        'layers.patches': '{count} 条补丁',
        'layers.ops': '{count} 个操作',
        'layers.files': '文件',
        'layers.noOps': '空层',
        'layers.showAll': '展开全部操作（{count}）',
        'layers.showLess': '收起',
        'layers.skipped': '{count} 个 bundle 被跳过，未计入本报告：',
        'layers.layer': '层 {index}',
        'layers.kind.bundle': 'bundle',
        'layers.kind.profile': 'profile',
        'layers.kind.home': 'home',
        'layers.configKeys': 'config: {keys}',
        'layers.replaceConfig': '替换 config: {keys}',
        'layers.condition': '条件：{condition}',
        'tree.title': '插件树 · {id} · 来自 {layer}',
        'tree.heading': '插件树',
        'tree.search': '筛选行、包名或工具…',
        'tree.expand': '全部展开',
        'tree.collapse': '全部折叠',
        'tree.empty': '这个 preset 没有声明插件行。',
        'tree.noMatch': '没有匹配的行。',
        'boundary.title': 'Preset 检查器面板出错',
        'boundary.close': '关闭面板',
        'trigger.label': 'Preset 检查器',
        'settings.inspect': '检查',
      },
      en: {
        'panel.title': 'Preset Inspector',
        'panel.close': 'Close',
        'panel.reload': 'Reload',
        'face.model': 'Model input',
        'face.harness': 'Plugin tree',
        'face.layers': 'Patch layers',
        'preset.default': 'default',
        'preset.broken': 'load error',
        'preset.brokenHint': 'This preset reported an error while mounting: {message}',
        'stats.rows': '{count} rows',
        'stats.tools': '{count} tools',
        'state.loading': 'Loading…',
        'state.loadFailed': 'Failed to load: ',
        'state.mounting': 'Mounting this preset…',
        'state.assembleFailed': 'Assembly failed: ',
        'state.retry': 'Retry',
        'empty.presets': 'No agent presets found',
        'empty.presetsHint': 'This profile declares no presets; open Layers to inspect its patch stack.',
        'empty.sections': 'This preset registered no prompt sections.',
        'model.systemTitle': 'System Prompt',
        'model.sectionCount': '{count} sections',
        'model.contextCount': '{count} slots',
        'model.toolCount': '{count} tools',
        'model.showSources': 'Show sources',
        'model.hideSources': 'Hide sources',
        'model.openSection': 'Open details: {title}',
        'model.copyNote': 'Copy includes the rendered body; {count} runtime/static-hint sections omitted.',
        'model.runtimeTitle': '{count} sections have no displayable static body (still part of System Prompt):',
        'model.contextTitle': 'Dynamic context',
        'context.required': 'required',
        'context.optional': 'optional',
        'context.note': 'The exact condition lives inside the provider; optional contexts are suppressed by suppressRuntimeContext. The probe sees the slot but does not evaluate a live session.',
        'context.empty': 'No runtime context registered.',
        'context.view': 'Open context details: {name}',
        'context.detailNote': 'The registering provider owns the trigger condition; this shows assembly metadata (order, required, origin) without running the provider.',
        'model.copy': 'Copy all',
        'model.copied': 'Copied',
        'model.copyFailed': 'Copy failed',
        'model.runtimeHint': 'runtime',
        'model.staticHint': 'Static hint only; the real value is evaluated at request time.',
        'model.noStatic': 'No static text; generated at request time.',
        'model.toolTitle': 'Tools definition',
        'tools.empty': 'No tools were resolved.',
        'tools.search': 'Filter tools…',
        'tools.noMatch': 'No matching tools.',
        'tools.note': 'No static description; generated at request time.',
        'tools.source': 'Provider',
        'tools.appears': 'Appears in',
        'tools.params': 'Parameters ({count})',
        'tools.noParams': 'Not declared',
        'tools.parametersJson': 'Parameters (JSON)',
        'tools.schema': 'Parameter schema',
        'model.assemblyError': 'Some prompt or tool information is unavailable: {error}',
        'drawer.close': 'Close details',
        'field.kind': 'Kind',
        'field.order': 'order',
        'field.source': 'Source',
        'field.visibility': 'Visibility',
        'field.lastChanged': 'Last changed',
        'field.probe': 'Probe evaluation',
        'field.staticHint': 'Static scan hint',
        'field.origin': 'Origin',
        'field.package': 'Package',
        'field.version': 'Version',
        'field.category': 'Category',
        'field.status': 'Status',
        'field.enabled': 'Enabled',
        'field.disabled': 'Disabled',
        'field.conditional': 'Conditionally disabled: {condition}',
        'field.layer': 'Source layer',
        'field.trail': 'Layer trail',
        'field.config': 'Declared config',
        'field.before': 'Before',
        'field.after': 'After',
        'action.insert': 'insert',
        'action.patch': 'patch',
        'action.replace': 'replace',
        'action.remove': 'remove',
        'action.disable': 'disable',
        'action.touch': 'touch',
        'origin.deployment': 'deployment',
        'origin.preset': 'preset',
        'origin.package': 'tool package',
        'origin.unknown': 'unknown origin',
        'kind.identity': 'identity',
        'kind.persona': 'persona',
        'kind.instructions': 'instructions',
        'kind.tools': 'tool guidance',
        'kind.skills': 'skills',
        'kind.context': 'context',
        'kind.other': 'other',
        'category.persona': 'persona',
        'category.instructions': 'instructions',
        'category.tool': 'tool',
        'category.skill': 'skill',
        'category.capability': 'capability',
        'category.ui': 'ui',
        'category.other': 'other',
        'section.identity': 'Identity',
        'section.persona': 'Persona',
        'section.personaSuffix': 'Persona suffix',
        'section.deliverables': 'Deliverable references',
        'section.source': 'Runtime source',
        'section.web': 'Web surface',
        'section.mcp': 'MCP resources',
        'section.planPolicy': 'Plan policy',
        'section.tool': 'Tool guidance: {name}',
        'section.context': 'Context: {name}',
        'group.badge': 'group',
        'disabled.badge': 'disabled',
        'conditional.badge': 'conditional',
        'layers.title': 'Patch layers',
        'layers.scope': 'profile-wide',
        'layers.hint': 'Layers in boot order; config patches replace the whole config.',
        'layers.empty': 'No patch layers available.',
        'layers.patches': 'Patches: {count}',
        'layers.ops': 'Operations: {count}',
        'layers.files': 'Files',
        'layers.noOps': 'Empty layer',
        'layers.showAll': 'Show all {count} operations',
        'layers.showLess': 'Show less',
        'layers.skipped': '{count} bundles were skipped and are absent from this report:',
        'layers.layer': 'Layer {index}',
        'layers.kind.bundle': 'bundle',
        'layers.kind.profile': 'profile',
        'layers.kind.home': 'home',
        'layers.configKeys': 'config: {keys}',
        'layers.replaceConfig': 'replace config: {keys}',
        'layers.condition': 'condition: {condition}',
        'tree.title': 'Plugin tree · {id} · from {layer}',
        'tree.heading': 'Plugin tree',
        'tree.search': 'Filter rows, packages, or tools…',
        'tree.expand': 'Expand all',
        'tree.collapse': 'Collapse all',
        'tree.empty': 'This preset declares no plugin rows.',
        'tree.noMatch': 'No matching rows.',
        'boundary.title': 'Preset Inspector panel failed',
        'boundary.close': 'Close panel',
        'trigger.label': 'Preset Inspector',
        'settings.inspect': 'Inspect',
      },
    }

    /** Locale service captured at apply; absent in a bare host, so every read is optional. */
    let localeService

    /** @returns the active locale tag, falling back to the browser language, then English. */
    function currentLang() {
      try {
        const tag = localeService?.getSnapshot?.()?.active
        if (typeof tag === 'string' && tag !== '') return tag.toLowerCase().startsWith('zh') ? 'zh' : 'en'
      } catch {
        // Fall through to the browser language.
      }
      const tag = typeof navigator === 'undefined' ? '' : navigator.language
      return typeof tag === 'string' && tag.toLowerCase().startsWith('zh') ? 'zh' : 'en'
    }

    /** Re-render when the user switches the UI language. */
    function useLang() {
      const [lang, setLang] = useState(currentLang())
      useEffect(() => {
        if (localeService === undefined || typeof localeService.subscribe !== 'function') return undefined
        // Call through the service: the method reads `this.listeners`, so an
        // extracted reference loses its receiver.
        let unsubscribe
        try {
          unsubscribe = localeService.subscribe(() => setLang(currentLang()))
        } catch {
          return undefined
        }
        return typeof unsubscribe === 'function' ? unsubscribe : undefined
      }, [])
      return lang
    }

    /** @returns the localized string with `{name}` placeholders filled. */
    function tr(lang, key, params) {
      const table = DICTS[lang] ?? DICTS.zh
      const value = table[key] ?? DICTS.zh[key] ?? key
      if (params === undefined) return value
      return value.replace(/\{(\w+)\}/g, (whole, name) => (params[name] === undefined ? whole : String(params[name])))
    }

    const CSS = [
      '.dpi-backdrop{position:fixed;inset:0;z-index:2000;display:flex;align-items:center;justify-content:center;padding:clamp(8px,3vw,32px);background:var(--dsw-alias-bg-mask-1)}',
      '.dpi-panel{display:flex;flex-direction:column;width:min(1120px,100%);height:min(840px,100%);min-height:0;overflow:hidden;border:0;border-radius:var(--dsw-radius-panel);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-family:var(--dsw-font-family);font-size:var(--dsh-content-font-size,14px);box-shadow:var(--dsw-elevation-panel)}',
      '.dpi-panel:focus{outline:none}',
      '.dpi-head{display:flex;align-items:center;gap:12px;padding:14px 20px;border-bottom:0.5px solid var(--dsw-alias-border-l1);flex:0 0 auto;min-width:0}',
      '.dpi-title{font-size:16px;font-weight:600;line-height:22px}',
      '.dpi-brand{display:flex;align-items:baseline;gap:8px;min-width:0}',
      '.dpi-profile{font-family:var(--ds-font-family-code);color:var(--dsw-alias-label-secondary);font-size:11px;line-height:17px;white-space:nowrap}',
      '.dpi-sub{font-size:12px;line-height:16px;color:var(--dsw-alias-label-secondary);margin-top:2px}',
      '.dpi-grow{flex:1;min-width:0}',
      '.dpi-icon{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;flex:0 0 28px;border-radius:var(--dsw-radius-sm);border:none;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer}',
      '.dpi-icon:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}',
      '.dpi-seg{display:flex;gap:4px;padding:4px;border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-module-platform);flex:0 0 auto}',
      '.dpi-seg-btn{height:28px;padding:0 12px;border:none;border-radius:var(--dsw-radius-sm);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;cursor:pointer;white-space:nowrap}',
      '.dpi-seg-btn[aria-pressed="true"]{background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);box-shadow:var(--dsw-shadow-lv1)}',
      '.dpi-subhead{display:flex;align-items:center;gap:8px;padding:8px 20px;border-bottom:0.5px solid var(--dsw-alias-border-l1);flex:0 0 auto;flex-wrap:wrap}',
      '.dpi-preset-name{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary)}',
      '.dpi-preset-id{font-family:var(--ds-font-family-code);font-size:10.5px;color:var(--dsw-alias-label-secondary)}',
      '.dpi-preset-desc{flex:1 1 320px;min-width:0;color:var(--dsw-alias-label-secondary)}',
      '.dpi-preset-facts{display:flex;gap:10px;flex-wrap:wrap;margin-left:auto;font-family:var(--ds-font-family-code);font-size:10.5px;color:var(--dsw-alias-label-secondary)}',
      '.dpi-pill{height:26px;max-width:280px;padding:0 12px;border-radius:999px;corner-shape:round;border:0.5px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12.5px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.dpi-pill[aria-pressed="true"]{background:var(--dsw-alias-button-primary-fill);border-color:transparent;color:var(--dsw-alias-label-primary-foreground)}',
      '.dpi-sep{width:0.5px;height:14px;background:var(--dsw-alias-border-l2);flex:0 0 0.5px}',
      '.dpi-stat-line{display:flex;gap:12px;font-size:11.5px;color:var(--dsw-alias-label-secondary);white-space:nowrap;align-items:center;margin-left:auto}',
      '.dpi-main{flex:1;display:flex;min-height:0;position:relative}',
      '.dpi-scroll{flex:1;overflow:auto;min-width:0}',
      '.dpi-doc{max-width:860px;margin:0 auto;padding:18px 30px 64px}',
      '.dpi-flow{display:flex;flex-direction:column;gap:2px;font-size:var(--dsh-content-font-size,13.5px);line-height:1.7}',
      '.dpi-type-label{display:flex;align-items:center;gap:8px;margin:12px 0 2px;font-size:10px;line-height:14px;letter-spacing:.08em;text-transform:uppercase;color:var(--dsw-alias-label-secondary)}',
      '.dpi-type-label:first-child{margin-top:0}',
      '.dpi-type-label::after{content:"";flex:1;height:0.5px;background:var(--dsw-alias-border-l1)}',
      '.dpi-block[data-type="identity"]{--dpi-type-color:var(--dsw-alias-label-secondary)}',
      '.dpi-block[data-type="persona"]{--dpi-type-color:var(--dsw-alias-state-business-primary)}',
      '.dpi-block[data-type="instructions"]{--dpi-type-color:var(--dsw-alias-state-warn-primary)}',
      '.dpi-block[data-type="tools"]{--dpi-type-color:var(--dsw-alias-state-success-primary)}',
      '.dpi-block[data-type="skills"]{--dpi-type-color:color-mix(in srgb,var(--dsw-alias-state-business-primary) 55%,var(--dsw-alias-state-success-primary) 45%)}',
      '.dpi-block[data-type="context"]{--dpi-type-color:var(--dsw-alias-label-caption)}',
      '.dpi-block[data-type="other"]{--dpi-type-color:var(--dsw-alias-label-tertiary)}',
      '.dpi-block{position:relative;margin:0 -8px;padding:6px 8px 8px 12px;border-left:2px solid var(--dpi-type-color,var(--dsw-alias-border-l3));border-radius:var(--dsw-radius-sm);cursor:pointer;outline-offset:2px}',
      '.dpi-block:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.dpi-block-meta{display:flex;align-items:baseline;gap:6px;flex-wrap:wrap;margin:0 0 3px;font-family:var(--ds-font-family-code);font-size:10.5px;line-height:16px;color:var(--dsw-alias-label-secondary)}',
      '.dpi-block-meta .dpi-meta-src{color:var(--dsw-alias-label-secondary);font-family:var(--ds-font-family-code)}',
      '.dpi-note{font-size:var(--dsh-content-font-size-secondary,12px);line-height:18px;color:var(--dsw-alias-label-secondary)}',
      '.dpi-runtime-note{margin-top:16px;padding-top:10px;border-top:0.5px solid var(--dsw-alias-border-l1);font-size:12px;color:var(--dsw-alias-label-secondary)}',
      '.dpi-runtime-summary{cursor:pointer;color:var(--dsw-alias-label-secondary);font-size:11.5px}',
      '.dpi-runtime-list{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}',
      '.dpi-runtime-item{padding:1px 8px;border-radius:999px;corner-shape:round;border:0.5px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-secondary);font-family:var(--ds-font-family-code);font-size:11px;line-height:20px;cursor:pointer}',
      '.dpi-runtime-item:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l4)}',
      '.dpi-face-block{margin-top:22px;padding-top:14px;border-top:0.5px solid var(--dsw-alias-border-l1)}',
      '.dpi-face-block-first{margin-top:0;padding-top:0;border-top:0}',
      '.dpi-section-head{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin-bottom:6px;min-width:0}',
      '.dpi-section-title{font-size:12.5px;letter-spacing:.04em;color:var(--dsw-alias-label-primary);font-weight:600}',
      '.dpi-section-count{font-size:11.5px;color:var(--dsw-alias-label-secondary);white-space:nowrap}',
      '.dpi-section-actions{margin-left:auto;display:flex;gap:6px;align-items:center;flex-wrap:wrap}',
      '.dpi-face-count{font-size:11.5px;color:var(--dsw-alias-label-secondary);white-space:nowrap}',
      '.dpi-context-list{display:flex;flex-direction:column;gap:4px;margin-top:8px}',
      '.dpi-context-row{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;width:100%;padding:5px 7px;border:0.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-sm);background:transparent;color:inherit;font:inherit;font-size:12px;line-height:17px;text-align:left;cursor:pointer}',
      '.dpi-context-row:hover{background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-border-l2)}',
      '.dpi-context-name{font-family:var(--ds-font-family-code);font-size:11.5px;font-weight:600;word-break:break-all}',
      '.dpi-context-origin{margin-left:auto;color:var(--dsw-alias-label-secondary);font-family:var(--ds-font-family-code);font-size:10.5px}',
      '.dpi-toolgrid{display:flex;flex-direction:column;gap:2px;margin-top:8px}',
      '.dpi-tool{display:flex;align-items:baseline;gap:10px;padding:5px 7px;border-radius:var(--dsw-radius-sm);cursor:pointer;border:0.5px solid transparent;border-bottom-color:var(--dsw-alias-border-l1);background:transparent;color:inherit;font:inherit;font-size:12.5px;text-align:left;width:100%;flex-wrap:wrap}',
      '.dpi-tool:hover{background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-border-l1)}',
      '.dpi-tool-name{flex:0 0 142px;font-family:var(--ds-font-family-code);font-size:12px;font-weight:600;line-height:18px;white-space:nowrap}',
      '.dpi-tool-desc{flex:1 1 180px;min-width:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden}',
      '.dpi-tool-badge{font-size:10.5px;color:var(--dsw-alias-label-secondary);white-space:nowrap;max-width:180px;overflow:hidden;text-overflow:ellipsis;font-family:var(--ds-font-family-code)}',
      '.dpi-tree{padding:16px 20px 56px;display:flex;flex-direction:column;gap:2px}',
      '.dpi-tree-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:0 10px 8px}',
      '.dpi-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:0 10px 10px}',
      '.dpi-search{height:28px;min-width:180px;flex:1 1 220px;padding:0 9px;border:0.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm);background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px}',
      '.dpi-tool-search{flex:0 1 240px;width:240px;max-width:100%}',
      '.dpi-toolbar-btn{height:26px;padding:0 10px;border:0.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11.5px;cursor:pointer;white-space:nowrap}',
      '.dpi-toolbar-btn:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.dpi-toolbar-btn[disabled]{opacity:.55;cursor:progress}',
      '.dpi-node{display:flex;align-items:flex-start;gap:8px;width:100%;padding:7px 10px;border-radius:var(--dsw-radius-sm);border:0.5px solid transparent;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}',
      '.dpi-node:hover{background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-border-l1)}',
      '.dpi-node-core{display:flex;align-items:center;gap:8px;min-width:0;flex-wrap:wrap;flex:1}',
      '.dpi-node-id{font-family:var(--ds-font-family-code);font-size:12px;font-weight:600;white-space:nowrap;flex:0 0 auto}',
      '.dpi-node-pkg{font-family:var(--ds-font-family-code);font-size:11px;color:var(--dsw-alias-label-secondary);min-width:0;flex:0 1 auto;max-width:46%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dpi-node-tools{font-size:11px;color:var(--dsw-alias-label-secondary);font-family:var(--ds-font-family-code);min-width:0;flex:1 1 200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dpi-layer-chip{font-family:var(--ds-font-family-code);font-size:10px;line-height:16px;padding:0 5px;border-radius:var(--dsw-radius-xs);background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);white-space:nowrap;flex:0 0 auto}',
      '.dpi-badge{display:inline-flex;align-items:center;height:18px;padding:0 6px;border-radius:999px;corner-shape:round;font-size:10.5px;line-height:18px;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);white-space:nowrap;flex:0 0 auto}',
      '.dpi-badge[data-kind="group"]{background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 12%,transparent);color:var(--dsw-alias-state-business-primary)}',
      '.dpi-badge[data-kind="tool"]{background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 12%,transparent);color:var(--dsw-alias-state-success-primary)}',
      '.dpi-badge[data-kind="persona"]{background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 12%,transparent);color:var(--dsw-alias-state-warn-primary)}',
      '.dpi-badge[data-kind="warn"]{background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 12%,transparent);color:var(--dsw-alias-state-warn-primary)}',
      '.dpi-children{margin-left:18px;padding-left:10px;border-left:0.5px dashed var(--dsw-alias-border-l2);display:flex;flex-direction:column;gap:2px}',
      '.dpi-chev{width:12px;flex:0 0 12px;color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:20px}',
      '.dpi-drawer{flex:0 0 380px;display:flex;flex-direction:column;min-height:0;border-left:0.5px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1)}',
      '.dpi-drawer-head{display:flex;align-items:flex-start;gap:8px;padding:16px 16px 12px;border-bottom:0.5px solid var(--dsw-alias-border-l1)}',
      '.dpi-drawer-title{font-size:14px;font-weight:600;line-height:20px;word-break:break-word}',
      '.dpi-drawer-body{flex:1;overflow:auto;padding:14px 16px 24px;display:flex;flex-direction:column;gap:12px}',
      '.dpi-field{display:flex;flex-direction:column;gap:2px}',
      '.dpi-field-k{font-size:11px;color:var(--dsw-alias-label-secondary)}',
      '.dpi-field-v{font-size:12.5px;line-height:18px;word-break:break-word}',
      '.dpi-quote{margin:0;padding:12px 14px;border-radius:var(--dsw-radius-md);background:var(--dsw-alias-markdown-code-block);font-family:var(--ds-font-family-code);font-size:12px;line-height:1.6;white-space:pre-wrap;word-break:break-word;max-height:320px;overflow:auto}',
      '.dpi-trail{display:flex;flex-direction:column;gap:4px}',
      '.dpi-trail-step{display:flex;align-items:baseline;gap:6px;flex-wrap:wrap;font-size:11.5px;line-height:17px}',
      '.dpi-trail-label{font-family:var(--ds-font-family-code);font-size:10.5px;color:var(--dsw-alias-label-secondary);word-break:break-all}',
      '.dpi-diff{display:flex;flex-direction:column;gap:8px}',
      '.dpi-diff-label{font-size:10.5px;color:var(--dsw-alias-label-secondary);margin-bottom:2px}',
      '.dpi-empty{padding:40px 8px;text-align:center;font-size:13px;color:var(--dsw-alias-label-secondary)}',
      '.dpi-empty-hint{margin-top:6px;font-size:12px;color:var(--dsw-alias-label-secondary)}',
      '.dpi-doc-p{margin:6px 0 0;font-size:var(--dsh-content-font-size,13.5px);line-height:1.75;color:var(--dsw-alias-label-primary)}',
      '.dpi-doc-h{margin:12px 0 0;font-weight:600;line-height:1.4;color:var(--dsw-alias-label-primary)}',
      '.dpi-doc-h1{font-size:17px}.dpi-doc-h2{font-size:15px}.dpi-doc-h3{font-size:14px}.dpi-doc-h4,.dpi-doc-h5,.dpi-doc-h6{font-size:13px}',
      '.dpi-doc-list{margin:6px 0 0;padding-left:20px;display:flex;flex-direction:column;gap:3px;font-size:var(--dsh-content-font-size,13.5px);line-height:1.7}',
      '.dpi-doc-code{margin:8px 0 0;padding:10px 12px;border-radius:var(--dsw-radius-md);background:var(--dsw-alias-markdown-code-block);font-family:var(--ds-font-family-code);font-size:12px;line-height:1.6;white-space:pre-wrap;word-break:break-word;overflow:auto}',
      '.dpi-inline-code{padding:1px 5px;border-radius:var(--dsw-radius-xs);background:var(--dsw-alias-markdown-inline-code);font-family:var(--ds-font-family-code);font-size:12px}',
      '.dpi-layers{padding:20px 24px 64px;display:flex;flex-direction:column;gap:12px;max-width:1000px;margin:0 auto}',
      '.dpi-layer{border:0.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-lg);padding:14px 16px;background:var(--dsw-alias-bg-layer-1)}',
      '.dpi-layer-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '.dpi-layer-title{font-family:var(--ds-font-family-code);font-size:12.5px;font-weight:600;word-break:break-all;min-width:0}',
      '.dpi-layer-meta{display:flex;gap:10px;flex-wrap:wrap;font-size:11.5px;color:var(--dsw-alias-label-secondary);margin-top:4px}',
      '.dpi-files{display:flex;flex-direction:column;gap:2px;margin-top:8px;font-family:var(--ds-font-family-code);font-size:10.5px;color:var(--dsw-alias-label-secondary);word-break:break-all}',
      '.dpi-ops{display:flex;flex-direction:column;gap:2px;margin-top:10px}',
      '.dpi-op{display:flex;align-items:baseline;gap:6px;flex-wrap:wrap;padding:3px 4px;border-radius:var(--dsw-radius-xs)}',
      '.dpi-op-id{font-family:var(--ds-font-family-code);font-size:11.5px;font-weight:600;word-break:break-all;min-width:0}',
      '.dpi-op-name{font-family:var(--ds-font-family-code);font-size:10.5px;color:var(--dsw-alias-label-secondary);word-break:break-all;min-width:0}',
      '.dpi-op-keys{font-size:10.5px;color:var(--dsw-alias-label-secondary);word-break:break-all;min-width:0}',
      '.dpi-warning{margin:12px 20px 0;padding:10px 12px;border:1px solid var(--dsw-alias-state-warn-primary);border-radius:var(--dsw-radius-md);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 10%,transparent);color:var(--dsw-alias-label-primary);font-size:var(--dsh-content-font-size-secondary,12px);line-height:18px}',
      '.dpi-warning-list{margin-top:6px;font-family:var(--ds-font-family-code);font-size:10.5px;color:var(--dsw-alias-label-secondary);word-break:break-all}',
      '.dpi-panel button:focus-visible,.dpi-panel [role="button"]:focus-visible,.dpi-panel input:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}',
      '.dpi-trigger{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:var(--dsw-radius-sm);border:none;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer}',
      '.dpi-trigger:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}',
      '.dpi-settings-entry{height:26px;padding:0 9px;margin-left:6px;border:0.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11.5px;cursor:pointer;white-space:nowrap}',
      '.dpi-settings-entry:hover{background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-border-l3);color:var(--dsw-alias-label-primary)}',
      '@media (max-width:760px){.dpi-backdrop{padding:8px}.dpi-panel{width:100%;height:100%;border-radius:var(--dsw-radius-lg)}.dpi-drawer{position:absolute;inset:0 0 0 auto;width:min(380px,100%);box-shadow:var(--dsw-elevation-panel)}.dpi-stat-line{margin-left:0}}',
      '@media (max-width:560px){.dpi-head{flex-wrap:wrap;row-gap:8px;padding:12px 16px}.dpi-head .dpi-grow{flex:1 1 100%;order:1}.dpi-head .dpi-sub{display:none}.dpi-head .dpi-seg{order:2;flex:1 1 0;min-width:0;overflow-x:auto;scrollbar-width:none}.dpi-seg::-webkit-scrollbar{display:none}.dpi-seg-btn{padding:0 10px;font-size:12.5px}.dpi-head .dpi-icon{order:3}.dpi-subhead{padding:10px 16px}.dpi-doc{padding:16px 20px 64px}.dpi-section-actions{width:100%;margin-left:0}.dpi-tool-search{flex:1 1 100%;width:100%}}',
      '@media (pointer:coarse){.dpi-icon,.dpi-trigger{width:36px;height:36px;flex-basis:36px}.dpi-pill{height:32px}.dpi-toolbar-btn{height:32px}.dpi-search{height:34px}.dpi-tool{padding:10px 8px}.dpi-runtime-item{line-height:24px}}',
    ].join('')

    /** Inject or refresh the panel stylesheet once per page. */
    function installStyles() {
      if (typeof document === 'undefined') return
      const existing = document.getElementById('dpi-styles')
      if (existing !== null) {
        // Client HMR replaces this bundle without a page reload; keep the
        // stylesheet in sync instead of leaving the first copy in place.
        if (existing.textContent !== CSS) existing.textContent = CSS
        return
      }
      const style = document.createElement('style')
      style.id = 'dpi-styles'
      style.textContent = CSS
      document.head.appendChild(style)
    }

    /**
     * Add an "Inspect" action to each card in the official Agent presets
     * settings section. The official panel exposes no per-card slot in
     * 0.2.1, so this is a small, re-applied DOM decoration. A failed match is
     * harmless; the sidebar entry remains the supported fallback.
     */
    function installSettingsEntries() {
      if (typeof document === 'undefined') return undefined
      let timer
      const scan = () => {
        const text = tr(currentLang(), 'settings.inspect')
        for (const card of document.querySelectorAll('li[data-agent-preset-id]')) {
          const id = card.getAttribute('data-agent-preset-id')
          if (id === null || id === '') continue
          let button = card.querySelector('[data-preset-inspector-entry]')
          if (button !== null) {
            if (button.textContent !== text) button.textContent = text
            continue
          }
          const foot = [...card.children].find((child) => child.tagName === 'DIV')
          if (foot === undefined) continue
          button = document.createElement('button')
          button.type = 'button'
          button.className = 'dpi-settings-entry'
          button.dataset.presetInspectorEntry = ''
          button.textContent = text
          button.title = text
          button.setAttribute('aria-label', `${text}: ${id}`)
          button.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('preset-inspector:open', { detail: { preset: id } }))
          })
          const icon = foot.lastElementChild
          foot.insertBefore(button, icon !== null && icon.tagName === 'BUTTON' ? icon : null)
        }
      }
      scan()
      if (typeof MutationObserver === 'undefined') return undefined
      const observer = new MutationObserver(() => {
        if (timer !== undefined) clearTimeout(timer)
        timer = setTimeout(() => {
          timer = undefined
          scan()
        }, 250)
      })
      observer.observe(document.body, { childList: true, subtree: true })
      return () => {
        if (timer !== undefined) clearTimeout(timer)
        observer.disconnect()
      }
    }

    /** @returns the composed report from the host half. */
    async function loadReport() {
      const response = await fetch(ROUTE, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
      const value = await response.json().catch(() => ({ ok: false, error: response.statusText }))
      if (value.ok === false) throw new Error(value.error ?? 'report failed')
      return value
    }

    /** @returns the probe assembly for one preset. */
    async function loadAssembly(presetId) {
      const response = await fetch(ASSEMBLE_ROUTE, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ preset: presetId }),
      })
      const value = await response.json().catch(() => ({ ok: false, error: response.statusText }))
      if (value.ok === false) throw new Error(value.error ?? 'assembly failed')
      return value
    }

    /** @returns an Agent-scope capture from the dry-run route. */
    async function loadAgentCapture(presetId) {
      const response = await fetch(DRY_ROUTE, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ preset: presetId }),
      })
      const value = await response.json().catch(() => ({ ok: false, error: response.statusText }))
      if (value.ok === false) throw new Error(value.error ?? 'agent capture failed')
      return value
    }

    /** Collect de-duplicated tools from a preset's nodes. */
    function collectTools(nodes) {
      const seen = new Map()
      const walk = (list) => {
        for (const node of list ?? []) {
          // A hard-disabled row contributes nothing to the model; a
          // conditionally disabled one might, so it stays listed.
          if (node.disabled === true) continue
          for (const tool of node.tools ?? []) {
            if (!seen.has(tool.name)) seen.set(tool.name, { ...tool, source: node.name })
          }
          if (node.children !== undefined) walk(node.children)
        }
      }
      walk(nodes)
      return [...seen.values()]
    }

    /** @returns a package name without its npm scope, for dense rows. */
    function shortPackage(value) {
      return String(value ?? '').replace(/^@[^/]+\//, '')
    }

    /** @returns the last two path segments, for layer labels in dense rows. */
    function shortPath(value) {
      const parts = String(value).split(/[\\/]/)
      return parts.slice(-2).join('/') || String(value)
    }

    /** @returns deduplicated tools for a preset, sorted by name. */
    function presetTools(preset) {
      return collectTools(preset.plugins).sort((left, right) => left.name.localeCompare(right.name))
    }

    /** A titled field in the drawer. */
    function Field(props) {
      return h('div', { className: 'dpi-field' },
        h('div', { className: 'dpi-field-k' }, props.label),
        h('div', { className: 'dpi-field-v' }, props.children),
      )
    }

    /** Right-hand detail drawer. */
    function Drawer(props) {
      const lang = useLang()
      const detail = props.detail
      if (detail === undefined) return null
      return h('aside', {
        className: 'dpi-drawer',
        ref: props.drawerRef,
        tabIndex: -1,
        'aria-labelledby': 'dpi-drawer-title',
      },
        h('div', { className: 'dpi-drawer-head' },
          h('div', { className: 'dpi-grow' },
            h('div', { className: 'dpi-drawer-title', id: 'dpi-drawer-title' }, detail.title),
            detail.subtitle ? h('div', { className: 'dpi-sub' }, detail.subtitle) : null,
          ),
          h('button', { className: 'dpi-icon', type: 'button', 'aria-label': tr(lang, 'drawer.close'), onClick: props.onClose },
            h('svg', { width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': 'true' },
              h('path', { d: 'M4 4l8 8M12 4l-8 8', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' }))),
        ),
        h('div', { className: 'dpi-drawer-body' },
          (detail.fields ?? []).map((field) => h(Field, { key: field.label, label: field.label }, field.value)),
          detail.trail && detail.trail.length > 0 ? h('div', { className: 'dpi-field' },
            h('div', { className: 'dpi-field-k' }, tr(lang, 'field.trail')),
            h('div', { className: 'dpi-trail' }, detail.trail.map((step, index) => h('div', { className: 'dpi-trail-step', key: index },
              h('span', { className: 'dpi-badge' }, tr(lang, 'action.' + step.action)),
              h('span', { className: 'dpi-trail-label', title: step.label }, 'L' + step.layer + ' · ' + step.label),
            ))),
          ) : null,
          detail.text ? h('pre', { className: 'dpi-quote' }, detail.text) : null,
          detail.note ? h('div', { className: 'dpi-note' }, detail.note) : null,
          detail.diff ? h('div', { className: 'dpi-diff' },
            h('div', null,
              h('div', { className: 'dpi-field-k' }, tr(lang, 'field.before')),
              h('pre', { className: 'dpi-quote' }, detail.diff.before),
            ),
            h('div', null,
              h('div', { className: 'dpi-field-k' }, tr(lang, 'field.after')),
              h('pre', { className: 'dpi-quote' }, detail.diff.after),
            ),
          ) : null,
          detail.code ? h('div', null,
            h('div', { className: 'dpi-field-k' }, detail.codeLabel ?? tr(lang, 'field.config')),
            h('pre', { className: 'dpi-quote', style: { marginTop: 4 } }, detail.code),
          ) : null,
        ),
      )
    }

    /** Split inline text on backticks so code spans render as code. */
    function inline(text, keyBase) {
      const parts = []
      const pattern = /`([^`]+)`/g
      let last = 0
      let match = pattern.exec(text)
      let index = 0
      while (match !== null) {
        if (match.index > last) parts.push(text.slice(last, match.index))
        parts.push(h('code', { key: keyBase + '-i' + index++, className: 'dpi-inline-code' }, match[1]))
        last = match.index + match[0].length
        match = pattern.exec(text)
      }
      if (last < text.length) parts.push(text.slice(last))
      return parts
    }

    /**
     * Render one prompt section as a small Markdown document: headings, lists,
     * fenced code and paragraphs. Length-bounded by the section text itself.
     * @param text - the section template.
     * @param keyBase - stable key prefix.
     * @returns React children.
     */
    function renderMarkdown(text, keyBase) {
      const lines = text.split('\n')
      const out = []
      let i = 0
      while (i < lines.length) {
        const line = lines[i]
        if (/^\s*```/.test(line)) {
          const buffer = []
          i++
          while (i < lines.length && !/^\s*```/.test(lines[i])) { buffer.push(lines[i]); i++ }
          i++
          out.push(h('pre', { key: keyBase + '-c' + out.length, className: 'dpi-doc-code' }, buffer.join('\n')))
          continue
        }
        const heading = /^(#{1,6})\s+(.*)$/.exec(line)
        if (heading !== null) {
          const level = Math.min(heading[1].length, 6)
          out.push(h('div', { key: keyBase + '-h' + out.length, className: 'dpi-doc-h dpi-doc-h' + level }, inline(heading[2], keyBase + out.length)))
          i++
          continue
        }
        if (/^\s*(?:[-*]|\d+\.)\s+/.test(line)) {
          const ordered = /^\s*\d+\.\s+/.test(line)
          const items = []
          while (i < lines.length && /^\s*(?:[-*]|\d+\.)\s+/.test(lines[i])) {
            const item = lines[i].replace(/^\s*(?:[-*]|\d+\.)\s+/, '')
            items.push(h('li', { key: keyBase + '-l' + i }, inline(item, keyBase + i)))
            i++
          }
          // System prompts commonly use numbered steps; rendering them as
          // bullets loses the order the model actually sees.
          out.push(h(ordered ? 'ol' : 'ul', { key: keyBase + '-u' + out.length, className: 'dpi-doc-list' }, items))
          continue
        }
        if (line.trim() === '') { i++; continue }
        const paragraph = []
        while (i < lines.length && lines[i].trim() !== '' && !/^\s*(?:```|#{1,6}\s|(?:[-*]|\d+\.)\s)/.test(lines[i])) {
          paragraph.push(lines[i])
          i++
        }
        out.push(h('p', { key: keyBase + '-p' + out.length, className: 'dpi-doc-p' }, inline(paragraph.join(' '), keyBase + out.length)))
      }
      return out
    }

    /** @returns the localized label for a section type. */
    function kindLabel(type, lang) {
      return tr(lang, 'kind.' + (type in { identity: 1, persona: 1, instructions: 1, tools: 1, skills: 1, context: 1, other: 1 } ? type : 'other'))
    }

    /** @returns the localized human title for one prompt section. */
    function sectionTitle(name, lang) {
      const table = {
        'harness:identity': 'section.identity',
        'deployment:persona-prefix': 'section.persona',
        'deployment:persona-suffix': 'section.personaSuffix',
        'ui:deliverable-file-references': 'section.deliverables',
        'harness:source': 'section.source',
        'app:web-surface': 'section.web',
        'mcp-resource-servers': 'section.mcp',
        'plan:policy': 'section.planPolicy',
      }
      if (name.startsWith('tool:')) return tr(lang, 'section.tool', { name: name.slice(5) })
      if (name.startsWith('dsh-context:')) return tr(lang, 'section.context', { name: name.slice('dsh-context:'.length) })
      return table[name] === undefined ? name : tr(lang, table[name])
    }

    /** Map a prompt section name to the colour band it belongs to. */
    function sectionType(name) {
      if (name === 'harness:identity') return 'identity'
      if (name === 'deployment:persona-prefix' || name === 'deployment:persona-suffix') return 'persona'
      if (name.startsWith('tool:')) return 'tools'
      if (name.includes('skill')) return 'skills'
      if (name === 'plan:policy' || name.includes('instruction') || name.includes('policy')) return 'instructions'
      if (name.startsWith('context:') || name.startsWith('dsh-context:') || name.startsWith('runtime:') || name.startsWith('mcp-') ||
          name === 'harness:source' || name === 'app:web-surface' || name.startsWith('ui:')) return 'context'
      return 'other'
    }

    /** @returns the visible provenance label for a prompt section. */
    function sectionSource(section, lang) {
      if (section.origin === 'deployment') return tr(lang, 'origin.deployment')
      if (section.origin === 'preset') return tr(lang, 'origin.preset')
      if (section.origin === 'package') return section.source ?? tr(lang, 'origin.package')
      return tr(lang, 'origin.unknown')
    }

    /** One interactive block: prompt text plus optional persistent provenance. */
    function DocBlock(props) {
      const section = props.section
      const lang = props.lang
      const type = sectionType(section.name)
      const hint = section.runtimeDependent === true
      const title = sectionTitle(section.name, lang)
      const meta = [
        title,
        section.source ?? sectionSource(section, lang),
        hint ? tr(lang, 'model.runtimeHint') : '',
      ].filter(Boolean).join(' · ')
      return h('div', {
        className: 'dpi-block',
        'data-type': type,
        role: 'button',
        tabIndex: 0,
        'aria-label': tr(lang, 'model.openSection', { title }),
        'aria-description': meta,
        'aria-haspopup': 'dialog',
        onClick: (event) => props.onClick(event.currentTarget),
        onKeyDown: (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            props.onClick(event.currentTarget)
          }
        },
      },
        props.showSources ? h('div', { className: 'dpi-block-meta' },
          h('span', null, section.name),
          h('span', { className: 'dpi-meta-src' }, section.source ?? sectionSource(section, lang)),
          hint ? h('span', { className: 'dpi-meta-src' }, tr(lang, 'model.runtimeHint')) : null,
        ) : null,
        renderMarkdown(section.text, section.name),
      )
    }

    /** Model face: the probe-mounted preset's prompt sections and tools. */
    function ModelFace(props) {
      const lang = props.lang
      const preset = props.preset
      const assembly = props.assembly
      const mountData = assembly?.data
      const captured = props.agentCapture?.status === 'ok' ? props.agentCapture.data : undefined
      const data = captured ?? mountData
      const mountSections = mountData?.sections ?? []
      const mountByName = new Map(mountSections.map((section) => [section.name, section]))
      const rawSections = data?.sections ?? []
      const sections = captured === undefined
        ? rawSections
        : rawSections.map((section) => {
          const mount = mountByName.get(section.name)
          return {
            ...mount,
            ...section,
            order: section.order ?? mount?.order,
            source: section.source ?? mount?.source,
            origin: section.origin ?? mount?.origin,
          }
        })
      const mountContexts = mountData?.contexts ?? []
      const contextByName = new Map(mountContexts.map((entry) => [entry.name, entry]))
      const rawContexts = data?.contexts ?? []
      const contexts = captured === undefined
        ? rawContexts
        : rawContexts.map((entry) => ({ ...contextByName.get(entry.name), ...entry, required: entry.required ?? contextByName.get(entry.name)?.required === true }))
      // The mount assembly is authoritative; the static scan is only a
      // fallback when assembly or the runtime registry is unavailable.
      const runtimeTools = Array.isArray(data?.tools) ? data.tools : undefined
      const mountTools = mountData?.tools ?? []
      const mountToolByName = new Map(mountTools.map((tool) => [tool.name, tool]))
      const tools = runtimeTools === undefined
        ? presetTools(preset)
        : runtimeTools.map((tool) => {
          const mount = mountToolByName.get(tool.name)
          return { ...mount, ...tool, source: tool.source ?? mount?.source }
        })
      const assemblyError = data?.assemblyError
      const ordered = [...sections].sort((left, right) => (left.order ?? 1e9) - (right.order ?? 1e9))
      const withText = ordered.filter((section) => typeof section.text === 'string' && section.text !== '')
      // Empty static sections (text === '') are not runtime output; they are
      // simply unconfigured and would only inflate the runtime count.
      const runtimeSections = ordered.filter((section) => section.text === undefined)
      const loading = assembly === undefined || assembly.status === 'loading'
      const failed = assembly?.status === 'error'
      // Runtime sections without text cannot be copied. A function-valued
      // section that only has a static hint must not masquerade as its real
      // request-time text either; probe-evaluated text is real for this scope.
      const copySections = withText.filter((section) => section.runtimeDependent !== true || section.textSource === 'probe')
      const copyText = copySections.map((section) => section.text).join('\n\n')
      const omitted = withText.length - copySections.length + runtimeSections.length
      const [copyState, setCopyState] = useState('idle')
      const [showSources, setShowSources] = useState(false)
      const [toolQuery, setToolQuery] = useState('')
      const copyTimer = useRef(undefined)
      useEffect(() => () => {
        if (copyTimer.current !== undefined) clearTimeout(copyTimer.current)
      }, [])
      const needle = toolQuery.trim().toLowerCase()
      const filteredTools = needle === ''
        ? tools
        : tools.filter((tool) => [tool.name, tool.description, tool.source].filter(Boolean).join(' ').toLowerCase().includes(needle))
      /** Copy only the rendered prompt body; omit runtime-only sections and static hints. */
      const copyAll = async () => {
        if (copyText === '') return
        let copied = true
        try {
          await navigator.clipboard.writeText(copyText)
        } catch {
          try {
            const area = document.createElement('textarea')
            area.value = copyText
            area.style.position = 'fixed'
            area.style.opacity = '0'
            document.body.appendChild(area)
            area.select()
            copied = document.execCommand('copy')
            area.remove()
          } catch {
            copied = false
          }
        }
        setCopyState(copied ? 'copied' : 'failed')
        if (copyTimer.current !== undefined) clearTimeout(copyTimer.current)
        copyTimer.current = setTimeout(() => setCopyState('idle'), 1800)
      }

      // Consecutive sections of one type share a small group label; this gives
      // the document a scan line without repeating metadata on every block.
      const promptBlocks = []
      let lastType
      for (const section of withText) {
        const type = sectionType(section.name)
        if (type !== lastType) {
          promptBlocks.push(h('div', { className: 'dpi-type-label', key: 'type-' + type + '-' + section.name }, kindLabel(type, lang)))
          lastType = type
        }
        promptBlocks.push(h(DocBlock, {
          key: section.name,
          section,
          lang,
          showSources,
          onClick: (trigger) => props.onSection(section, trigger),
        }))
      }

      return h('div', { className: 'dpi-doc' },
        h('section', { className: 'dpi-face-block dpi-face-block-first' },
          h('div', { className: 'dpi-section-head' },
            h('div', { className: 'dpi-section-title' }, tr(lang, 'model.systemTitle')),
            h('span', { className: 'dpi-section-count' }, tr(lang, 'model.sectionCount', { count: withText.length + runtimeSections.length })),
            h('div', { className: 'dpi-section-actions' },
              h('button', {
                type: 'button',
                className: 'dpi-toolbar-btn',
                'aria-pressed': showSources,
                onClick: () => setShowSources((value) => !value),
              }, showSources ? tr(lang, 'model.hideSources') : tr(lang, 'model.showSources')),
              copyText !== '' ? h('button', {
                type: 'button',
                className: 'dpi-toolbar-btn',
                title: omitted > 0 ? tr(lang, 'model.copyNote', { count: omitted }) : undefined,
                onClick: copyAll,
              }, copyState === 'copied' ? tr(lang, 'model.copied') : copyState === 'failed' ? tr(lang, 'model.copyFailed') : tr(lang, 'model.copy')) : null,
            ),
          ),
          assemblyError !== undefined ? h('div', { className: 'dpi-warning' }, tr(lang, 'model.assemblyError', { error: assemblyError })) : null,
          withText.length === 0 && runtimeSections.length === 0
            ? h('div', { className: 'dpi-empty' }, tr(lang, 'empty.sections'))
            : h('div', { className: 'dpi-flow' }, promptBlocks),
          runtimeSections.length > 0 ? h('details', { className: 'dpi-runtime-note' },
            h('summary', { className: 'dpi-runtime-summary' }, tr(lang, 'model.runtimeTitle', { count: runtimeSections.length })),
            h('div', { className: 'dpi-runtime-list' },
              runtimeSections.map((section) => h('button', {
                key: 'rt' + section.name,
                type: 'button',
                className: 'dpi-runtime-item',
                title: section.name + ' · order ' + (section.order ?? '—'),
                onClick: (event) => props.onSection(section, event.currentTarget),
              }, section.name)),
            ),
          ) : null,
        ),
        h('section', { className: 'dpi-face-block' },
          h('div', { className: 'dpi-section-head' },
            h('div', { className: 'dpi-section-title' }, tr(lang, 'model.contextTitle')),
            h('span', { className: 'dpi-section-count' }, tr(lang, 'model.contextCount', { count: contexts.length })),
          ),
          contexts.length === 0
            ? h('div', { className: 'dpi-note', style: { marginTop: 8 } }, tr(lang, 'context.empty'))
            : h('div', { className: 'dpi-context-list' },
              contexts.map((entry) => h('button', {
                className: 'dpi-context-row',
                key: entry.name,
                type: 'button',
                title: 'order ' + (entry.order ?? '—'),
                'aria-label': tr(lang, 'context.view', { name: entry.name }),
                'aria-haspopup': 'dialog',
                onClick: (event) => props.onContext(entry, event.currentTarget),
              },
                h('span', { className: 'dpi-context-name' }, entry.name),
                h('span', { className: 'dpi-badge', 'data-kind': entry.required ? 'tool' : undefined }, entry.required ? tr(lang, 'context.required') : tr(lang, 'context.optional')),
                entry.origin === 'preset' ? h('span', { className: 'dpi-context-origin' }, tr(lang, 'origin.preset')) : null,
              )),
            ),
        ),
        h('section', { className: 'dpi-face-block' },
          h('div', { className: 'dpi-section-head' },
            h('div', { className: 'dpi-section-title' }, tr(lang, 'model.toolTitle')),
            h('span', { className: 'dpi-section-count' }, tr(lang, 'model.toolCount', { count: tools.length })),
          ),
          tools.length > 0 ? h('input', {
            className: 'dpi-search dpi-tool-search',
            type: 'search',
            value: toolQuery,
            placeholder: tr(lang, 'tools.search'),
            'aria-label': tr(lang, 'tools.search'),
            onChange: (event) => setToolQuery(event.target.value),
            style: { marginTop: 6 },
          }) : null,
          tools.length === 0
            ? h('div', { className: 'dpi-note', style: { marginTop: 8 } }, tr(lang, 'tools.empty'))
            : filteredTools.length === 0
              ? h('div', { className: 'dpi-note', style: { marginTop: 8 } }, tr(lang, 'tools.noMatch'))
              : h('div', { className: 'dpi-toolgrid' },
                filteredTools.map((tool) => h('button', {
                  key: tool.name,
                  type: 'button',
                  className: 'dpi-tool',
                  title: [tool.name, tool.source, tool.description].filter(Boolean).join(' · '),
                  onClick: (event) => props.onTool(tool, event.currentTarget),
                },
                  h('span', { className: 'dpi-tool-name' }, tool.name),
                  h('span', { className: 'dpi-tool-desc' }, tool.description ?? tr(lang, 'tools.note')),
                  showSources && tool.source ? h('span', { className: 'dpi-tool-badge' }, shortPackage(tool.source)) : null,
                )),
              ),
        ),
      )
    }

    /** Filter a tree by id/name/tool text, preserving ancestors of matches. */
    function filterTree(nodes, query) {
      const needle = query.trim().toLowerCase()
      if (needle === '') return nodes
      const walk = (list) => {
        const out = []
        for (const node of list ?? []) {
          const hay = [
            node.id,
            node.name,
            ...(node.tools ?? []).map((tool) => tool.name),
          ].filter(Boolean).join(' ').toLowerCase()
          if (hay.includes(needle)) {
            // A row that matches itself keeps its whole subtree.
            out.push(node)
            continue
          }
          if (node.children !== undefined) {
            const children = walk(node.children)
            if (children.length > 0) out.push({ ...node, children })
          }
        }
        return out
      }
      return walk(nodes)
    }

    /** Harness face: the plugin tree behind the document. */
    function HarnessFace(props) {
      const lang = props.lang
      const preset = props.preset
      const [collapsed, setCollapsed] = useState(new Set())
      const [query, setQuery] = useState('')
      const nodes = preset.plugins
      const visible = useMemo(() => filterTree(nodes, query), [nodes, query])
      const allGroups = useMemo(() => {
        const keys = []
        const walk = (list) => {
          for (const node of list ?? []) {
            if (node.children !== undefined) keys.push(node.path)
            if (node.children !== undefined) walk(node.children)
          }
        }
        walk(nodes)
        return keys
      }, [nodes])

      const toggle = (path) => {
        setCollapsed((current) => {
          const next = new Set(current)
          if (next.has(path)) next.delete(path)
          else next.add(path)
          return next
        })
      }

      const renderNode = (node) => {
        const key = node.path
        const isGroup = node.children !== undefined
        const open = query.trim() !== '' ? true : !collapsed.has(key)
        const toolNames = (node.tools ?? []).map((tool) => tool.name)
        const trail = node.trail ?? []
        const last = trail.at(-1)
        const badges = []
        if (isGroup) badges.push(h('span', { key: 'group', className: 'dpi-badge', 'data-kind': 'group' }, tr(lang, 'group.badge')))
        else if (node.category !== 'tool') badges.push(h('span', { key: 'cat', className: 'dpi-badge', 'data-kind': node.category }, tr(lang, 'category.' + node.category)))
        if (node.disabled) badges.push(h('span', { key: 'off', className: 'dpi-badge', 'data-kind': 'warn' }, tr(lang, 'disabled.badge')))
        else if (node.disabledCondition) badges.push(h('span', { key: 'cond', className: 'dpi-badge', 'data-kind': 'warn', title: node.disabledCondition }, tr(lang, 'conditional.badge')))
        const row = h('button', {
          key,
          type: 'button',
          className: 'dpi-node',
          'aria-expanded': isGroup ? open : undefined,
          'aria-haspopup': isGroup ? undefined : 'dialog',
          onClick: (event) => (isGroup ? toggle(key) : props.onNode(node, event.currentTarget)),
          title: [node.id, node.name, toolNames.length > 0 ? '→ ' + toolNames.join(', ') : ''].filter(Boolean).join(' · '),
        },
          h('span', { className: 'dpi-chev' }, isGroup ? (open ? '▾' : '▸') : ''),
          h('span', { className: 'dpi-node-core' },
            h('span', { className: 'dpi-node-id' }, node.id ?? node.name ?? '—'),
            ...badges,
            node.name ? h('span', { className: 'dpi-node-pkg' }, node.name) : null,
            last && last.action !== 'insert' ? h('span', { className: 'dpi-layer-chip', title: last.label + ' · ' + last.action }, 'L' + last.layer) : null,
            toolNames.length > 0 ? h('span', { className: 'dpi-node-tools' }, '→ ' + toolNames.join(', ')) : null,
          ),
        )
        if (!isGroup) return row
        return h('div', { key: 'w' + key },
          row,
          open ? h('div', { className: 'dpi-children' }, node.children.map((child) => renderNode(child))) : null,
        )
      }

      return h('div', { className: 'dpi-tree' },
        preset.broken ? h('div', { className: 'dpi-warning', style: { margin: '0 10px 10px' } }, tr(lang, 'preset.brokenHint', { message: preset.broken })) : null,
        h('div', { className: 'dpi-section-head dpi-tree-head' },
          h('div', { className: 'dpi-section-title', title: tr(lang, 'tree.title', { id: preset.id, layer: shortPath(preset.declaredBy ?? '?') }) }, tr(lang, 'tree.heading')),
          h('span', { className: 'dpi-section-count', title: preset.declaredBy ?? '' }, [preset.id, preset.declaredBy === undefined ? undefined : shortPath(preset.declaredBy)].filter(Boolean).join(' · ')),
        ),
        h('div', { className: 'dpi-toolbar' },
          h('input', {
            className: 'dpi-search dpi-tool-search',
            type: 'search',
            value: query,
            placeholder: tr(lang, 'tree.search'),
            'aria-label': tr(lang, 'tree.search'),
            onChange: (event) => setQuery(event.target.value),
          }),
          h('button', { type: 'button', className: 'dpi-toolbar-btn', onClick: () => setCollapsed(new Set()) }, tr(lang, 'tree.expand')),
          h('button', { type: 'button', className: 'dpi-toolbar-btn', onClick: () => setCollapsed(new Set(allGroups)) }, tr(lang, 'tree.collapse')),
        ),
        visible.length === 0
          ? h('div', { className: 'dpi-empty' }, tr(lang, query.trim() === '' ? 'tree.empty' : 'tree.noMatch'))
          : visible.map((node) => renderNode(node)),
      )
    }

    /** Layers face: the patch stack and each layer's operations. */
    function LayersFace(props) {
      const lang = props.lang
      const report = props.report
      const layers = report?.layers ?? []
      const [expanded, setExpanded] = useState(new Set())
      const LIMIT = 6
      const toggle = (index) => setExpanded((current) => {
        const next = new Set(current)
        if (next.has(index)) next.delete(index)
        else next.add(index)
        return next
      })
      return h('div', { className: 'dpi-layers' },
        h('div', { className: 'dpi-section-head' },
          h('div', { className: 'dpi-section-title' }, tr(lang, 'layers.title')),
          h('span', { className: 'dpi-badge' }, tr(lang, 'layers.scope')),
        ),
        h('div', { className: 'dpi-note' }, tr(lang, 'layers.hint')),
        layers.length === 0 ? h('div', { className: 'dpi-empty' }, tr(lang, 'layers.empty')) : null,
        layers.map((layer) => h('section', { className: 'dpi-layer', key: layer.index }, 
          h('div', { className: 'dpi-layer-head' },
            h('span', { className: 'dpi-layer-chip' }, tr(lang, 'layers.layer', { index: layer.index })),
            h('span', { className: 'dpi-badge' }, tr(lang, 'layers.kind.' + layer.kind)),
            h('span', { className: 'dpi-layer-title', title: layer.label }, layer.kind === 'bundle' ? layer.label : shortPath(layer.label)),
            h('span', { className: 'dpi-layer-meta' },
              h('span', null, tr(lang, 'layers.patches', { count: layer.patches })),
              h('span', null, tr(lang, 'layers.ops', { count: (layer.ops ?? []).length })),
            ),
          ),
          h('div', { className: 'dpi-files' },
            h('div', { className: 'dpi-field-k' }, tr(lang, 'layers.files')),
            ...(layer.files ?? []).map((file) => h('div', { key: file, title: file }, shortPath(file))),
          ),
          (layer.ops ?? []).length === 0 ? h('div', { className: 'dpi-note', style: { marginTop: 8 } }, tr(lang, 'layers.noOps')) : h('div', { className: 'dpi-ops' },
            ...(expanded.has(layer.index) ? layer.ops : layer.ops.slice(0, LIMIT)).map((op, index) => h('div', { className: 'dpi-op', key: index },
              h('span', { className: 'dpi-badge' }, tr(lang, 'action.' + op.action)),
              op.id ? h('span', { className: 'dpi-op-id' }, op.id) : null,
              op.name ? h('span', { className: 'dpi-op-name' }, op.name) : null,
              op.configKeys && op.configKeys.length > 0 ? h('span', { className: 'dpi-op-keys' }, tr(lang, op.action === 'insert' ? 'layers.configKeys' : 'layers.replaceConfig', { keys: op.configKeys.join(', ') })) : null,
              op.disabledCondition ? h('span', { className: 'dpi-op-keys' }, tr(lang, 'layers.condition', { condition: op.disabledCondition })) : null,
              op.disabled ? h('span', { className: 'dpi-badge', 'data-kind': 'warn' }, tr(lang, 'disabled.badge')) : null,
            )),
            layer.ops.length > LIMIT
              ? h('button', { type: 'button', className: 'dpi-toolbar-btn', onClick: () => toggle(layer.index), style: { marginTop: 6, alignSelf: 'flex-start' } },
                expanded.has(layer.index) ? tr(lang, 'layers.showLess') : tr(lang, 'layers.showAll', { count: layer.ops.length }))
              : null,
          ),
        )),
      )
    }

    /** Persisted selection between open/close; the panel unmounts on close. */
    let lastView = { preset: undefined, face: 'model' }

    /** The inspector panel. */
    function Panel(props) {
      const lang = useLang()
      const initialPreset = props.initialPreset
      const [report, setReport] = useState(undefined)
      const [error, setError] = useState(undefined)
      const [selected, setSelected] = useState(initialPreset ?? lastView.preset)
      const [face, setFace] = useState(lastView.face)
      const [detail, setDetail] = useState(undefined)
      const [reloadKey, setReloadKey] = useState(0)
      const [agentCaptures, setAgentCaptures] = useState({})
      const assemblyCache = useRef(new Map())
      const [, bumpAssembly] = useState(0)
      const panelRef = useRef(null)
      const closeRef = useRef(null)
      const backdropRef = useRef(null)
      const scrollRef = useRef(null)
      const drawerRef = useRef(null)
      const lastTriggerRef = useRef(undefined)

      /** Close the detail drawer and return focus to the row that opened it. */
      const closeDetail = () => {
        const trigger = lastTriggerRef.current
        setDetail(undefined)
        // The trigger is still mounted behind the drawer, so restore focus now;
        // waiting for a frame makes Escape look like it left focus in the body.
        if (trigger?.isConnected) trigger.focus?.()
      }

      useEffect(() => {
        let live = true
        setReport(undefined)
        setError(undefined)
        setAgentCaptures({})
        assemblyCache.current.clear()
        bumpAssembly((value) => value + 1)
        loadReport()
          .then((value) => {
            if (!live) return
            setReport(value)
            const presets = value.presets ?? []
            setSelected((current) => {
              if (current !== undefined && presets.some((item) => item.id === current)) return current
              return (presets.find((item) => item.isDefault) ?? presets[0])?.id
            })
          })
          .catch((cause) => live && setError(String(cause)))
        return () => { live = false }
      }, [reloadKey])

      useEffect(() => {
        lastView = { preset: selected, face }
      }, [selected, face])

      useEffect(() => {
        if (initialPreset !== undefined) setSelected(initialPreset)
      }, [initialPreset])

      // The three faces share one scroll container; without a reset a switch
      // lands at the clamped bottom of the previous face.
      useEffect(() => {
        if (scrollRef.current !== null) scrollRef.current.scrollTop = 0
      }, [face, selected])

      // A drawer is a detail view, not an inline expansion: move focus into it
      // so keyboard users do not have to tab through the whole tree first.
      useEffect(() => {
        if (detail === undefined) return
        drawerRef.current?.querySelector('button')?.focus?.()
      }, [detail])

      useEffect(() => {
        if (selected === undefined) return undefined
        const cached = assemblyCache.current.get(selected)
        if (cached !== undefined && cached.status !== 'error') return undefined
        let live = true
        assemblyCache.current.set(selected, { status: 'loading' })
        bumpAssembly((value) => value + 1)
        loadAssembly(selected)
          .then((value) => {
            if (!live) return
            assemblyCache.current.set(selected, { status: 'ok', data: value })
            bumpAssembly((current) => current + 1)
          })
          .catch((cause) => {
            if (!live) return
            assemblyCache.current.set(selected, { status: 'error', error: String(cause) })
            bumpAssembly((current) => current + 1)
          })
        return () => {
          live = false
          // A selection change before the fetch settled must not leave a
          // permanent "loading" entry that blocks the retry on revisit.
          if (assemblyCache.current.get(selected)?.status === 'loading') assemblyCache.current.delete(selected)
        }
      }, [selected, reloadKey])

      // Hidden progressive enhancement: mount assembly paints first, then the
      // Agent setup capture replaces it when available. Mechanism labels are
      // intentionally absent from the UI; failures keep the mount view.
      useEffect(() => {
        if (face !== 'model' || selected === undefined) return undefined
        if (agentCaptures[selected] !== undefined) return undefined
        let live = true
        setAgentCaptures((current) => ({ ...current, [selected]: { status: 'loading' } }))
        loadAgentCapture(selected)
          .then((value) => {
            if (!live) return
            setAgentCaptures((current) => ({ ...current, [selected]: { status: 'ok', data: value } }))
          })
          .catch((error) => {
            if (!live) return
            if (typeof console !== 'undefined') console.warn('[preset-inspector] agent capture:', error)
            setAgentCaptures((current) => ({ ...current, [selected]: { status: 'error', error: String(error) } }))
          })
        return () => {
          live = false
          setAgentCaptures((current) => {
            if (current[selected]?.status !== 'loading') return current
            const next = { ...current }
            delete next[selected]
            return next
          })
        }
      }, [face, selected, reloadKey])

      // Modal behavior: initial focus, focus trap, background inert, scroll
      // lock, and focus restore. The dialog claims aria-modal, so it must
      // actually behave like one.
      useEffect(() => {
        const previous = typeof document === 'undefined' ? undefined : document.activeElement
        const panel = panelRef.current
        const backdrop = backdropRef.current
        const body = typeof document === 'undefined' ? undefined : document.body
        const previousOverflow = body?.style.overflow
        if (body !== undefined) body.style.overflow = 'hidden'
        closeRef.current?.focus?.()
        const inerted = []
        if (backdrop !== undefined && backdrop !== null && backdrop.parentElement === body) {
          for (const sibling of [...body.children]) {
            if (sibling === backdrop || sibling.tagName === 'STYLE' || sibling.tagName === 'SCRIPT') continue
            inerted.push({ element: sibling, inert: sibling.hasAttribute('inert'), hidden: sibling.getAttribute('aria-hidden') })
            sibling.setAttribute('inert', '')
            sibling.setAttribute('aria-hidden', 'true')
          }
        }
        const onKeyDown = (event) => {
          if (event.key !== 'Tab' || panel === null) return
          const focusable = [...panel.querySelectorAll('button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')]
            .filter((element) => element.getClientRects().length > 0)
          if (focusable.length === 0) {
            event.preventDefault()
            panel.focus()
            return
          }
          const first = focusable[0]
          const last = focusable[focusable.length - 1]
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault()
            last.focus()
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault()
            first.focus()
          } else if (!panel.contains(document.activeElement)) {
            event.preventDefault()
            first.focus()
          }
        }
        window.addEventListener('keydown', onKeyDown, true)
        return () => {
          window.removeEventListener('keydown', onKeyDown, true)
          if (body !== undefined) body.style.overflow = previousOverflow ?? ''
          for (const entry of inerted) {
            if (!entry.inert) entry.element.removeAttribute('inert')
            if (entry.hidden === null) entry.element.removeAttribute('aria-hidden')
            else entry.element.setAttribute('aria-hidden', entry.hidden)
          }
          if (previous !== undefined && typeof previous.focus === 'function') previous.focus()
        }
      }, [])

      useEffect(() => {
        const onKey = (event) => {
          if (event.key !== 'Escape') return
          if (detail !== undefined) closeDetail()
          else props.onClose()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      }, [detail, props])

      const preset = useMemo(() => report?.presets?.find((item) => item.id === selected), [report, selected])
      const assembly = selected === undefined ? undefined : assemblyCache.current.get(selected)
      const toolCount = useMemo(() => {
        const captured = selected === undefined ? undefined : agentCaptures[selected]
        const runtime = captured?.status === 'ok' ? captured.data.tools : assembly?.data?.tools
        if (Array.isArray(runtime)) return runtime.length
        return preset === undefined ? 0 : presetTools(preset).length
      }, [preset, assembly, agentCaptures, selected])

      /** Open the drawer for one prompt section. */
      const openSection = (section, trigger) => {
        lastTriggerRef.current = trigger ?? document.activeElement
        setDetail({
        title: sectionTitle(section.name, lang),
        subtitle: [section.name, sectionSource(section, lang)].filter(Boolean).join(' · '),
        fields: [
          { label: tr(lang, 'field.kind'), value: kindLabel(sectionType(section.name), lang) },
          { label: tr(lang, 'field.order'), value: section.order === undefined ? '—' : String(section.order) },
          { label: tr(lang, 'field.origin'), value: sectionSource(section, lang) },
          { label: tr(lang, 'field.source'), value: section.source ?? sectionSource(section, lang) },
          ...(section.staticHint === undefined ? [] : [{ label: tr(lang, 'field.staticHint'), value: section.staticHint }]),
        ],
        text: section.text === undefined || section.text === '' ? undefined : section.text,
        note: section.text === undefined || section.text === '' ? tr(lang, 'model.noStatic') : section.runtimeDependent ? tr(lang, 'model.staticHint') : undefined,
        })
      }

      const openTool = (tool, trigger) => {
        lastTriggerRef.current = trigger ?? document.activeElement
        setDetail({
        title: tool.name,
        subtitle: tool.source ?? '—',
        text: tool.description,
        note: tool.description === undefined ? tr(lang, 'tools.note') : undefined,
        fields: [
          { label: tr(lang, 'tools.source'), value: tool.source ?? '—' },
          { label: tr(lang, 'tools.appears'), value: (tool.presets ?? []).join(', ') || '—' },
          tool.parameters && tool.parameters.length > 0
            ? { label: tr(lang, 'tools.params', { count: tool.parameters.length }), value: tool.parameters.map((parameter) => parameter.name + (parameter.required ? ' *' : '') + (parameter.type ? ' : ' + parameter.type : '')).join('\n') }
            : { label: tr(lang, 'tools.params', { count: 0 }), value: tr(lang, 'tools.noParams') },
        ],
        codeLabel: tool.schema === undefined ? tr(lang, 'tools.parametersJson') : tr(lang, 'tools.schema'),
        code: tool.schema !== undefined ? JSON.stringify(tool.schema, undefined, 2) : tool.parameters && tool.parameters.length > 0 ? JSON.stringify(tool.parameters, undefined, 2) : undefined,
        })
      }

      const openNode = (node, trigger) => {
        lastTriggerRef.current = trigger ?? document.activeElement
        const trail = node.trail ?? []
        const lastPatch = [...trail].reverse().find((step) => step.action === 'patch' || step.action === 'replace')
        const status = node.disabled
          ? tr(lang, 'field.disabled')
          : node.disabledCondition
            ? tr(lang, 'field.conditional', { condition: node.disabledCondition })
            : tr(lang, 'field.enabled')
        setDetail({
          title: node.id ?? node.name ?? '—',
          subtitle: node.name,
          fields: [
            { label: tr(lang, 'field.package'), value: node.name ?? '—' },
            { label: tr(lang, 'field.version'), value: node.version ?? '—' },
            { label: tr(lang, 'field.category'), value: tr(lang, 'category.' + node.category) },
            { label: tr(lang, 'field.status'), value: status },
            { label: tr(lang, 'field.layer'), value: node.sourceLayer ?? '—' },
            ...(node.lastChangedBy === undefined || node.lastChangedBy === node.sourceLayer ? [] : [{ label: tr(lang, 'field.lastChanged'), value: node.lastChangedBy }]),
          ],
          trail,
          diff: lastPatch?.before === undefined ? undefined : {
            before: JSON.stringify(lastPatch.before, undefined, 2),
            after: JSON.stringify(lastPatch.after, undefined, 2),
          },
          codeLabel: tr(lang, 'field.config'),
          code: node.config !== undefined && node.config !== null && Object.keys(node.config).length > 0 ? JSON.stringify(node.config, undefined, 2) : undefined,
        })
      }

      const openContext = (entry, trigger) => {
        lastTriggerRef.current = trigger ?? document.activeElement
        setDetail({
          title: entry.name,
          subtitle: tr(lang, 'model.contextTitle'),
          fields: [
            { label: tr(lang, 'field.order'), value: entry.order === undefined ? '—' : String(entry.order) },
            { label: tr(lang, 'field.visibility'), value: entry.required ? tr(lang, 'context.required') : tr(lang, 'context.optional') },
            { label: tr(lang, 'field.origin'), value: entry.origin === 'deployment' ? tr(lang, 'origin.deployment') : tr(lang, 'origin.preset') },
          ],
          note: tr(lang, 'context.detailNote'),
        })
      }

      const header = h('header', { className: 'dpi-head' },
        h('div', { className: 'dpi-grow dpi-brand' },
          h('div', { className: 'dpi-title', id: 'dpi-title' }, tr(lang, 'panel.title')),
          h('span', { className: 'dpi-profile' }, report?.profile?.name ?? 'profile'),
        ),
        h('div', { className: 'dpi-seg', role: 'group', 'aria-label': tr(lang, 'panel.title') },
          h('button', { type: 'button', className: 'dpi-seg-btn', 'aria-pressed': face === 'model', onClick: () => setFace('model') }, tr(lang, 'face.model')),
          h('button', { type: 'button', className: 'dpi-seg-btn', 'aria-pressed': face === 'harness', onClick: () => setFace('harness') }, tr(lang, 'face.harness')),
          h('button', { type: 'button', className: 'dpi-seg-btn', 'aria-pressed': face === 'layers', onClick: () => setFace('layers') }, tr(lang, 'face.layers')),
        ),
        h('button', {
          className: 'dpi-icon',
          type: 'button',
          'aria-label': tr(lang, 'panel.reload'),
          title: tr(lang, 'panel.reload'),
          onClick: () => { setDetail(undefined); setReloadKey((value) => value + 1) },
        }, h('svg', { width: 15, height: 15, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': 'true' },
          h('path', { d: 'M13 8a5 5 0 1 1-1.5-3.6M13 2.5V6h-3.5', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round' }))),
        h('button', {
          ref: closeRef,
          className: 'dpi-icon',
          type: 'button',
          'aria-label': tr(lang, 'panel.close'),
          title: tr(lang, 'panel.close'),
          onClick: props.onClose,
        }, h('svg', { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': 'true' },
          h('path', { d: 'M4 4l8 8M12 4l-8 8', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' }))),
      )

      const subhead = face === 'layers' ? null : h('div', { className: 'dpi-subhead' },
        (report?.presets ?? []).map((item) => h('button', {
          key: item.id,
          type: 'button',
          className: 'dpi-pill',
          'aria-pressed': item.id === selected,
          title: item.description ?? item.id,
          onClick: () => { setSelected(item.id); setDetail(undefined) },
        }, item.name ?? item.id)),
        h('div', { className: 'dpi-grow' }),
        preset !== undefined ? h('div', { className: 'dpi-stat-line' },
          h('span', null, tr(lang, 'stats.rows', { count: preset.plugins.length })),
          h('span', { className: 'dpi-sep' }),
          h('span', null, tr(lang, 'stats.tools', { count: toolCount })),
          preset.isDefault ? h('span', { className: 'dpi-badge' }, tr(lang, 'preset.default')) : null,
          preset.broken ? h('span', { className: 'dpi-badge', 'data-kind': 'warn', title: preset.broken }, tr(lang, 'preset.broken')) : null,
        ) : null,
      )

      const emptyPresets = report !== undefined && (report.presets ?? []).length === 0
      const body = h('div', { className: 'dpi-main' },
        h('div', { className: 'dpi-scroll', ref: scrollRef },
          error !== undefined ? h('div', { className: 'dpi-empty', role: 'status' },
            tr(lang, 'state.loadFailed') + error,
            h('div', { style: { marginTop: 12 } }, h('button', { type: 'button', className: 'dpi-toolbar-btn', onClick: () => setReloadKey((value) => value + 1) }, tr(lang, 'state.retry'))),
          ) : null,
          report === undefined && error === undefined ? h('div', { className: 'dpi-empty', role: 'status' }, tr(lang, 'state.loading')) : null,
          report !== undefined && (report.skipped ?? []).length > 0 ? h('div', { className: 'dpi-warning' },
            tr(lang, 'layers.skipped', { count: report.skipped.length }),
            h('div', { className: 'dpi-warning-list' }, report.skipped.map((entry) => (entry.packageName ?? '?') + ' — ' + (entry.reason ?? '')).join('\n')),
          ) : null,
          emptyPresets && face !== 'layers' ? h('div', { className: 'dpi-empty' },
            tr(lang, 'empty.presets'),
            h('div', { className: 'dpi-empty-hint' }, tr(lang, 'empty.presetsHint')),
          ) : null,
          emptyPresets && face === 'layers' ? h(LayersFace, { report, lang }) : null,
          !emptyPresets && preset !== undefined && face === 'model' ? h(ModelFace, {
            key: 'model-' + preset.id,
            preset,
            assembly,
            lang,
            onSection: openSection,
            onTool: openTool,
            onContext: openContext,
            agentCapture: selected === undefined ? undefined : agentCaptures[selected],
          }) : null,
          !emptyPresets && preset !== undefined && face === 'harness' ? h(HarnessFace, {
            key: 'harness-' + preset.id,
            preset,
            lang,
            onNode: openNode,
          }) : null,
          !emptyPresets && face === 'layers' ? h(LayersFace, { report, lang }) : null,
        ),
        h(Drawer, { detail, onClose: closeDetail, drawerRef }),
      )

      return h('div', {
        className: 'dpi-backdrop',
        ref: backdropRef,
        role: 'presentation',
        onClick: (event) => { if (event.target === event.currentTarget) props.onClose() },
      },
        h('div', {
          className: 'dpi-panel',
          ref: panelRef,
          role: 'dialog',
          'aria-modal': 'true',
          'aria-labelledby': 'dpi-title',
          tabIndex: -1,
        }, header, subhead, body),
      )
    }

    /** Keeps a panel crash inside the panel area and lets the user close it. */
    class Boundary extends React.Component {
      constructor(props) {
        super(props)
        this.state = { error: undefined }
      }

      static getDerivedStateFromError(error) {
        return { error }
      }

      componentDidCatch(error) {
        if (typeof console !== 'undefined') console.error('[preset-inspector]', error)
      }

      render() {
        if (this.state.error !== undefined) {
          const labels = this.props.labels ?? {}
          return h('div', {
            className: 'dpi-backdrop',
            role: 'presentation',
            onClick: (event) => { if (event.target === event.currentTarget) this.props.onClose?.() },
          },
            h('div', {
              className: 'dpi-panel',
              role: 'alertdialog',
              'aria-modal': 'true',
              'aria-label': labels.title,
              style: { height: 'auto', padding: 24 },
            },
              h('div', { className: 'dpi-title' }, labels.title),
              h('pre', { className: 'dpi-quote', style: { marginTop: 12 } }, String(this.state.error?.stack ?? this.state.error)),
              h('div', { style: { marginTop: 16, display: 'flex', justifyContent: 'flex-end' } },
                h('button', {
                  type: 'button',
                  className: 'dpi-toolbar-btn',
                  onClick: () => this.props.onClose?.(),
                }, labels.close),
              ),
            ),
          )
        }
        return this.props.children
      }
    }

    /**
     * Render the dialog above the whole page when a portal host exists, and
     * inline otherwise so the panel never silently disappears.
     * @param element - the dialog element.
     * @returns the portaled or inline element.
     */
    function renderOverlay(element) {
      if (ReactDOM !== undefined && typeof ReactDOM.createPortal === 'function' && typeof document !== 'undefined' && document.body !== null) {
        return ReactDOM.createPortal(element, document.body)
      }
      return element
    }

    /** Sidebar footer seat: the button that opens the panel. */
    function Trigger() {
      const lang = useLang()
      const [view, setView] = useState({ open: false, preset: undefined })
      useEffect(() => {
        installStyles()
        const openFromSettings = (event) => {
          const preset = typeof event.detail?.preset === 'string' ? event.detail.preset : undefined
          setView({ open: true, preset })
        }
        window.addEventListener('preset-inspector:open', openFromSettings)
        const stopSettingsEntries = installSettingsEntries()
        return () => {
          window.removeEventListener('preset-inspector:open', openFromSettings)
          stopSettingsEntries?.()
        }
      }, [lang])
      return h(React.Fragment, null,
        h('button', {
          type: 'button',
          className: 'dpi-trigger',
          title: tr(lang, 'trigger.label'),
          'aria-label': tr(lang, 'trigger.label'),
          'aria-haspopup': 'dialog',
          'aria-expanded': view.open,
          onClick: () => setView({ open: true, preset: undefined }),
        }, h('svg', { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': 'true' },
          h('rect', { x: 2.25, y: 2.75, width: 11.5, height: 10.5, rx: 2.5, stroke: 'currentColor', strokeWidth: 1.3 }),
          h('path', { d: 'M2.5 6.25h11M6.25 6.5v6.5', stroke: 'currentColor', strokeWidth: 1.3 }),
        )),
        view.open ? renderOverlay(h(Boundary, {
          labels: { title: tr(lang, 'boundary.title'), close: tr(lang, 'boundary.close') },
          onClose: () => setView({ open: false, preset: undefined }),
        }, h(Panel, {
          initialPreset: view.preset,
          onClose: () => setView({ open: false, preset: undefined }),
        }))) : null,
      )
    }

    return {
      name: 'preset-inspector',
      // Strict injection: without declaring `slots` the client entry fails to
      // activate. `locale` is in the normal host; the panel still renders with
      // its own dictionary when a bare test context omits it.
      inject: ['slots', 'locale'],
      apply(ctx) {
        localeService = ctx.locale
        if (typeof localeService?.register === 'function') {
          try {
            ctx.effect(() => localeService.register(NS, DICTS), 'preset-inspector: dictionaries')
          } catch {
            // The local table remains the fallback.
          }
        }
        installStyles()
        ctx.effect(
          () =>
            ctx.slots.inject('sidebar.footer.action', () =>
              ctx.slots.register({ name: 'sidebar.footer.action', id: 'preset-inspector', inject: () => ({}) }, Trigger),
            ),
          'preset-inspector: footer action',
        )
      },
    }
  },
})
