# 代码审查报告 — luci-theme-mintzero（Mint）

- 审查日期：2026-09-07
- 审查基线：分支 `arena/01a079cc-luci-theme-mintzero`（`e95ecf6`，工作树干净）
- 审查方式：静态代码审查（未上真机；标“需实机验证”的结论建议在设备上复核）
- 审查范围：`theme/` 全量（CSS / JS / ucode 模板 / ucode 后端 / rpcd / UCI / ACL / po / 脚本 / 文档）
- 缺陷分级：**P0 致命**（功能断裂/大面积视觉破坏）> **P1 严重** > **P2 中等** > **P3 轻微/建议**

| 文件 | 行数 | 体积 |
|---|---|---|
| `theme/htdocs/luci-static/mintzero/cascade.css` | 3924 | 92K |
| `theme/htdocs/luci-static/mintzero/overview.js` | 955 | 32K |
| `theme/htdocs/luci-static/resources/menu-mintzero.js` | 281 | — |
| `theme/htdocs/luci-static/resources/view/mintzero/sysauth.js` | 154 | — |
| `theme/htdocs/luci-static/resources/view/mintzero/wallpaper.js` | 193 | — |
| `theme/ucode/mintzero/wallpaper.uc` | 115 | — |
| `theme/ucode/template/themes/mintzero/{header,footer,sysauth}.ut` | 168 / 27 / 104 | — |
| 未被引用的 `logo*.svg` 三件套 | — | **412K**（见 OT-18） |

结论先行（TL;DR）：

1. **“部分卡片不透明”属实，且根因不止一处**：最核心的是**嵌套毛玻璃叠加**（外层 0.72 盖内层 0.72，3~4 层叠完等效 98%+ 不透明，约等于没做透明），其次是**侧栏/顶栏/页脚/吸底操作栏四大件完全不透明**，再加上一批遗漏组件（告警族、表头、hover 行、描述块等）。详见 TZ-01 ~ TZ-04。
2. 另有 **2 个 P0**（全站 checkbox 被拉成满宽条；导航菜单有“永久不可见”单点故障风险）与 **一批 P1**（flex/grid 死规则、概览页硬编码中文、菜单/面包屑逻辑互斥、light/dark 变体可能失效等），建议按文末路线图修复。

---

## 一、卡片透明度专项审查（本次重点）

### TZ-01【P0】嵌套毛玻璃层叠加，等效接近不透明 —— “部分不透明”的主因

位置：`cascade.css` L3748–L3778（玻璃选择器组）、L3697–L3728（旧 0.86/0.9 块，已被覆盖，见 TZ-05）。

玻璃底为 `--mz-panel-bg: rgba(255,255,255,0.72)`（浅）/ `rgba(23,30,44,0.72)`（暗），即每层透光率只有 28%。问题是**选择器把“容器和被它包住的子孙”同时列入**，多层叠加后透光率按乘法衰减：

| 嵌套链（真实 DOM 父子关系） | 层数 | 等效不透明度 `1-0.28^n` | 效果 |
|---|---|---|---|
| `.cbi-map` > `.cbi-section` > `.cbi-section-node` > `table`（表单页标配） | 4 | **99.4%** | 基本全 opaque，壁纸不可见 |
| `.ifacebox` > `.ifacebox-head` + `.ifacebox-body`（接口页标配） | 3 | **97.8%** | 同上 |
| `.mz-overview-panel` > `.mz-info-card` / `.mz-ring-card`（概览页） | 2 | **92.2%** | 明显发白发实 |
| `.mz-net-panel` > `.mz-net-card`（概览页网络区） | 2 | **92.2%** | 同上 |
| `.mz-table-card` > `.mz-data-table thead th`（0.85 蓝头） | 2 | ~95% | 表头几乎实色 |

这就是“有的卡片透、有的卡片不透”的直接成因：**单层卡片透得很好，多层嵌套的页面（系统/网络/接口等表单页、接口页）几乎不透**。

修复建议（二选一或组合）：

- 只给**最外层容器**上玻璃底 + `backdrop-filter`，内层一律 `background: transparent`。例如壁纸模式下：
  ```css
  body.mz-has-wallpaper .cbi-section-node,
  body.mz-has-wallpaper .cbi-section-table,
  body.mz-has-wallpaper table.table,
  body.mz-has-wallpaper .ifacebox-head,
  body.mz-has-wallpaper .ifacebox-body,
  body.mz-has-wallpaper .mz-overview-panel,
  body.mz-has-wallpaper .mz-net-panel { background: transparent; backdrop-filter: none; }
  ```
  （`.cbi-map` 本身也不应再套一层底，它只是表单容器。）
- 或者把玻璃底改薄（如 0.55）并仅保留一层 `backdrop-filter`（blur 只在外层做一次，内层只调透明度），兼顾性能（见 TZ-08）。

### TZ-02【P1】四个最大面积的 UI 件完全不透明：侧栏 / 顶栏 / 页脚 / 吸底操作栏

| 部件 | 背景规则 | 位置 |
|---|---|---|
| 左侧栏 `.mz-sidebar`（宽 236px，全高） | `background: var(--mz-color-surface)` 实色 | L161 起 |
| 顶栏 `.mz-topbar`（高 56px，全宽） | `background: var(--mz-color-background)` 实色 | L337 起 |
| 页脚 `.mz-footer` | `background: var(--mz-color-surface)` 实色 | L380、L1949 |
| 吸底操作栏 `.cbi-page-actions`（sticky bottom，表单页常驻） | `background: var(--mz-color-background)` 实色 | L3089 起 |

壁纸模式（`body.mz-has-wallpaper`）对这四个选择器**没有任何覆盖规则**，只抬了 `z-index`（L3690–L3693）。结果是壁纸在左侧被 236px 实色条、顶部被 56px 实色条切断，表单页底部再压一条实色带，“壁纸效果”大打折扣。

修复建议：给四者加玻璃变体（示例，沿用现有 token）：

```css
body.mz-has-wallpaper .mz-sidebar,
body.mz-has-wallpaper .mz-topbar,
body.mz-has-wallpaper .mz-footer,
body.mz-has-wallpaper .cbi-page-actions {
  background: var(--mz-panel-bg-strong);           /* 0.88，可读优先 */
  backdrop-filter: blur(14px) saturate(1.15);
  -webkit-backdrop-filter: blur(14px) saturate(1.15);
}
```

注意同步处理 TZ-07 的 z-index 问题。如果产品决策是“导航区保持实色”，请在文档中明确写出，避免继续被当作 bug。

### TZ-03【P1】遗漏的半透明组件清单（壁纸模式下仍为实色）

玻璃选择器组（L3748–L3778）遗漏了以下**带实色背景**的组件（已逐条核对基础规则确实不透明）：

| # | 组件 | 基础背景 | 位置 | 说明 |
|---|---|---|---|---|
| 1 | `.alert-message` / `.cbi-change-list` / `.apply-notice` | `surface` 实色 + 语义色变体 | 约 L700–760 | 保存提示、变更列表常驻显示，实色块很显眼 |
| 2 | `#xhr_poll_status` | `surface` 实色 | 约 L780 | 顶栏轮询状态 |
| 3 | `.errorbox` / `.warningbox` / `.infobox` / `.cbi-section-error` | 语义 soft（看似浅色但**不透明**，alpha=1 的 pastel 底） | 约 L1450、L1800 | 注意 soft 色是实色不是玻璃 |
| 4 | `.cbi-map > .cbi-map-descr` | `surface` 实色 | L612 | 地图描述卡 |
| 5 | `.cbi-tab-descr` | `surface` 实色 | L802 | 选项卡描述块 |
| 6 | 通用表头 `table.table thead th`、`table.cbi-section-table thead th`、`.table .table-titles .td` | `surface-2` 实色 | L1730–1738、L660 | 玻璃模式只处理了 `.mz-data-table thead`（L3787），通用表头仍是实色行 |
| 7 | 所有表格 hover 行 `tr:hover td` / `.tr:hover .td` | `surface-2` 实色 | L648、L676、L1740、L2198 | 鼠标划过处出现实色横条，玻璃感瞬间破裂 |
| 8 | `.cbi-progressbar` 轨道 | `surface-2` 实色 | 约 L690、L1900 | 小部件，影响小，可保留实色（建议明确为 intentional） |
| 9 | `.label` 徽标 | `surface-2` 实色 | 约 L810 | 小部件，可保留 |
| 10 | `.cbi-dynlist > .add-item > input`、`.cbi-value-field` 内表单控件、`input/select/textarea` 全局、`btn/cbi-button` | `surface` 实色 | L1369/1701、L1640 等 | **建议保持实色**（可用性优先），但应在文档注明“输入控件为有意不透明” |

其中第 1–7 项建议纳入玻璃体系（至少给到 `--mz-panel-bg-strong` 0.88 + 同系语义边框）；第 8–10 项建议保持实色并文档化，避免反复争论。

### TZ-04【P1】接口页防火墙区域色丢失：`--zone-color-rgb` 从未被定义

位置：`cascade.css` L3799、L3803。

```css
body.mz-has-wallpaper .ifacebox-head {
  background-color: rgba(var(--zone-color-rgb, 128, 128, 128), 0.78) !important;
}
```

全仓搜索 `zone-color-rgb` 只有这两处**使用**，没有任何地方**定义**（LuCI 内联样式写的是 `background-color: #rrggbb`，不会设置这个变量）。于是所有接口表头在壁纸模式下都退化为**统一的中灰色**，防火墙 zone 的颜色语义（绿=lan、红=wan 等）全部丢失；且浅/深模式 alpha 还不一致（0.78 vs 0.55），同一页面两种灰。

修复建议：

- 短期：去掉该规则，让表头继承玻璃底 + zona 内联色混合，或改用 `color-mix(in srgb, var(--mz-panel-bg) 60%, transparent)` 思路；
- 长期：用 JS 读取表头计算样式中的内联背景色，换算成 `--zone-color-rgb` 写到元素上，再套半透明（`overview.js`/`menu-mintzero.js` 任选一处集中做）。

### TZ-05【P1】三处“自相矛盾/已失效”的透明度规则

1. **旧 0.86/0.9 规则块已死**（L3697–L3728）：给 `.mz-card/.cbi-section/.mz-info-card/.mz-port-card/.mz-ring-card` 上 0.86、表格上 0.9，但紧接着 L3748 起的玻璃块用 0.72 全覆盖了同一批选择器（后出现 + 同等特异度）。CHANGELOG 还在宣称“面板 86% 半透明”，**文档与代码已脱节**。建议删除旧块或以其为准二选一。
2. **注释与代码相反**（L3869–L3872）：“Slightly deepen the global overlay so cards keep contrast”，实际是 `calc(var(--mz-wallpaper-overlay) * 0.8)` ——**把遮罩调浅了 20%**，不是加深。默认 0.45 会变成 0.36。要么改注释为 lighten，要么改系数为 `* 1.1` 并 clamp。
3. **表头 fallback 色值前后不一**（L3787–L3795）：浅色 fallback `59,130,246`、深色 fallback `96,165,250`，而实际 `--mz-color-primary-rgb` 是浅 `79,110,247` / 深 `125,147,255`。虽然 fallback 正常走不到（变量一定存在），但说明此处是复制粘贴后未同步，建议顺手对齐，免得将来变量改名时 fallback 误导人。

### TZ-06【P1】panel 容器玻璃化“只做了一半”：`mz-net-panel`/`mz-overview-panel` vs 其他

玻璃组里出现了 `.mz-net-panel` 和 `.mz-overview-panel`（L3764–L3765），但 `overview.js` 实际生成的 **6 个** panel 容器是：`mz-overview-panel`、`mz-port-panel`、`mz-net-panel`、`mz-sys-panel`、`mz-dhcp-panel`、`mz-wifi-panel`、`mz-upnp-panel`（`overview.js` L606–L695）。只有 2 个被玻璃化，另外 5 个保持透明容器。

这导致双重不一致：被玻璃化的 2 个与其内部卡片形成**双层玻璃**（TZ-01），没被玻璃化的反而是对的（透明容器 + 单层玻璃卡）。修复：把 7 个 panel 容器统一为**透明、无边框、无 backdrop-filter**（TZ-01 方案已覆盖），玻璃只留给叶子卡片。

### TZ-07【P1】壁纸模式下移动端抽屉可能关不上：汉堡按钮被侧栏压住

- 壁纸模式把侧栏/顶栏抬到 `z-index: 60`（L3690–L3693）；
- 汉堡按钮 `.mz-sidebar-toggle` 固定 `z-index: 50`（L295–L300）；
- 非壁纸模式侧栏 z=40 < 按钮 50，按钮在上，正常；**壁纸模式侧栏 z=60 > 按钮 50，打开的抽屉把按钮盖住**，用户点不到关闭，必须点遮罩（`mz-overlay` z=35，仍可点，但按钮消失本身就是 bug）。

修复：在壁纸模式下给按钮 `z-index: 70`（高于侧栏），或把侧栏/顶栏的抬升改为 45（仍高于 `::before` 的 0 和 `.mz-main` 的 1 即可，没必要 60）。

### TZ-08【P2】性能：`backdrop-filter` 被铺到每一张卡片上

玻璃组 ~24 个选择器每个都带 `blur(12px) saturate(1.15)`，加上 `body::before` 的全屏 blur。桌面端尚可，**中低端手机上滚动会明显掉帧**（移动端 backdrop-filter 是按元素逐块重算的，表单页几十个 `.cbi-section` 就是几十个模糊层）。

建议：

- 只在外层容器保留 blur（配合 TZ-01 去嵌套，自然减少 60%+ 的模糊层）；
- 增加性能降级：`@media (max-width: 768px)` 或 `prefers-reduced-motion` 下把 blur 降到 6px 或直接关 `backdrop-filter`、改用更高 alpha 的纯色底（如 0.92）；
- `will-change` 不要加（会更糟），保持现状即可。

### TZ-09【P2】`body::before` 遮罩缺 `-webkit-` 前缀，Safari 旧版模糊失效

L3679 只有 `backdrop-filter: blur(...)`，而卡片处 L3773–L3774、登录页 L978–L979 都是标准+`-webkit-` 双写。`::before` 漏了前缀，旧版 Safari/部分 WebView 下全局遮罩的 blur（用户设置的 `blur` 选项）直接不生效。补一行即可。

### TZ-10【P2】`background-attachment: fixed` 在 iOS Safari 下不支持

`body.mz-has-wallpaper` 用 `background-attachment: fixed`（约 L3666–L3672）实现壁纸固定。iOS Safari 长期忽略 body 上的 fixed 背景（滚动时壁纸跟着动/闪烁/错位）。建议改用一个 `position: fixed; inset: 0; z-index: -1` 的专用背景层（或复用现有 `::before` 拆成两层：背景图层 + 遮罩层），兼容性最好。

### TZ-11【P2】全量 `text-shadow` halo：性能 + 渲染 + 合规三问

约 L3850 起给 `.cbi-value-title/description、h2–h4、th、td、label、.cbi-tabmenu li` 等**全量加了文字阴影**。三点提醒：

1. 大表格（DHCP/防火墙/路由表）每格都带阴影，低端机滚动有开销；
2. 小字号（0.75–0.82rem）加 1–3px 模糊阴影会有轻微发虚，Windows 低分屏明显；
3. **WCAG 对比度计算不计 text-shadow**，halo 只是观感加分，合规仍靠底色 alpha 保证——建议把玻璃底的最低 alpha（0.72）当作对比度基线去测一遍，而不是依赖 halo。

建议收敛到标题类（`.mz-section-title/.mz-subtitle/h2/h3`）使用 halo，正文/单元格去掉。

### TZ-12【P2】`.mz-net-header` 半透明后的白字对比度风险

L3787 把网络卡片头改成 primary 色 0.85/0.75 透明，但头上的字是纯白 `#fff` 且**没有 halo**（halo 只给了 section-title）。亮色壁纸 + 0.75 蓝头 + 白字，对比度可能跌破 3:1。建议：表头字加 halo，或表头 alpha 提高到 0.92，或文字改用深色+浅底方案。

### TZ-13【P2】隐私：壁纸请求把路由器地址暴露给第三方 API

`menu-mintzero.js` L32–66、`sysauth.js` L99–144 都是 `new Image()` 直连 `api.paugram.com` / `uapis.cn`，浏览器会默认带 `Referer: http://192.168.x.x/cgi-bin/luci/...`。第三方能知道你的内网 IP 段、管理地址和访问时间。修复成本极低：

```js
img.referrerPolicy = 'no-referrer';
```

两处（登录页 + 后台页）都要加。

### TZ-14【P2】UA 判定 + API 地址在 3 处重复硬编码

UA 正则出现在 `menu-mintzero.js` L28、`sysauth.js` L101；API 地址 `paugram/uapis` 在两文件各拼一次（menu L46–50、sysauth L113–136，其中 sysauth 还有个**从未被调用**的 `wallpaperSourceUrl()` L105 与内联逻辑重复）。下次换壁纸源要改 3–4 处，必漏。建议抽一个最小共享模块（如 `resources/mintzero-wp.js`）或至少把常量收敛到 `window.mintzeroWallpaper` 里由后端统一下发。

### TZ-15【P1】`ui_random` 缺省=true：新鲜安装即全局壁纸

`header.ut`（约 L75–95）里 `ui_random: {{ (wp.ui_random == '0') ? 'false' : 'true' }}` —— UCI 里没这个键时默认 **true**，而 shipped 的 `/etc/config/mintzero` 和 `uci-defaults` 里**根本没有这个键**（见 TZ-17）。于是：全新安装 → 后台每页都去请求第三方 API → 无外网/慢外网环境每页挂一个 12 秒超时的请求；且与设置页显示不一致（见 OT-09）。建议：uci-defaults 显式写入 `ui_random 1`（如果产品 decided 默认开）或改缺省为关，二选一并文档化。

### TZ-16【P2】`overlay`/`blur` 服务端无校验，非法值会击穿遮罩

`wallpaper.uc` `loadConfig()`（约 L60–72）对 `overlay`/`blur` 是**直通**（`wp.overlay ?? '0.45'`），不检验范围。手改 UCI（如 `overlay 'abc'`、`overlay '9'`）后，前端 `String(cfg.overlay)` 照单全收，CSS `calc(abc * 0.8)` 非法 → `::before` 背景声明整条丢弃 → **遮罩消失，只剩 halo**，亮壁纸下直接不可读。表单有 `datatype ufloat/uinteger`，但 UCI 手改绕得过。建议后端 clamp：overlay 钳到 0–1，blur 钳到 0–40。

### TZ-17【P1】配置与后端已漂移：Bing 链路“已死但还在跑”

现状拼图（已全部核对）：

- `/etc/config/mintzero` 与 `uci-defaults` 写的还是**旧 Bing 时代**的键：`market/cache_ttl/random`（config 全文 16 行；uci-defaults 约 L15–28），而新 UI 用的 `ui_random/pc_mode/mobile_mode/pc_url/mobile_url` 两处**都没写**（靠代码缺省值硬撑）。
- `rpcd/mintzero`（全文 37 行）读的是**谁也不写的** `mintzero.wallpaper.mode`（新 UI 写的是 `pc_mode`/`mobile_mode`），于是 `mode` 恒为缺省 `bing` → `spawned` 恒为 true → 每次点“刷新壁纸缓存”都去 `wget` 一次 Bing API，但**新前端根本不消费这个缓存**（直接调 paugram/uapis）。即：按钮触发的是无用下载 + “新壁纸池将在后台加载”的**误导通知**（`wallpaper.js` L153–166 的 else 分支“Random mode is active”实际不可达）。
- rpcd ACL（`root/usr/share/rpcd/acl.d/*.json`）授权了**不存在**的 `mintzero wallpaper` 方法（rpcd 只实现了 `refresh`）。

修复：uci-defaults/config 改写新键并删除废弃键（`market/cache_ttl/random/mode/count`）；rpcd 的 Bing 下载要么删除（按钮改为纯前端行为/弃用），要么明确其新语义；ACL 删掉 `wallpaper` 方法。

---

## 二、其他缺陷

### OT-01【P0】全站 checkbox/radio 被拉成满宽条

`cascade.css` L1701–1705：

```css
.cbi-value-field input,          /* ← 把 checkbox 也命中了 */
.cbi-value-field select,
.cbi-value-field textarea { width: 100%; }
```

它与 L1670 的 `input[type="checkbox"], input[type="radio"] { width: 16px; ... }` **特异度相同**（都是 0,1,1），但 L1701 在后 → 覆盖生效。结果：几乎所有 LuCI 表单里的勾选框（checkbox 都在 `.cbi-value-field` 内）变成 **100% 宽 × 16px 高**的满宽色条。L1369 还有一处同样的旧规则（同样在 L587 的 checkbox 规则之后，同样覆盖）。

修复（二选一）：

```css
/* 方案 A：排除勾选类 */
.cbi-value-field input:not([type="checkbox"]):not([type="radio"]),
.cbi-value-field select, .cbi-value-field textarea { width: 100%; }
/* 方案 B：在文件末尾加救济规则 */
.cbi-value-field input[type="checkbox"], .cbi-value-field input[type="radio"] { width: 16px; }
```

### OT-02【P0】导航菜单有“永久不可见”的单点故障

三重隐藏叠加，显示只依赖一条脆弱链路：

1. `header.ut` 给 `#mainmenu` 写了内联 `style="display:none"`；
2. `cascade.css`（约 L2280）`#mainmenu { display: none !important; }`，只有 `.mz-menu-ready` 能解开（`!important` 连内联样式都压得住）；
3. 唯一的解开者在 `overview.js` `initMenu()`（L702–L735）末尾：`mm.classList.add('mz-menu-ready')`。

而 `overview.js` 是 `defer` + `setTimeout(boot, 800)`（L794–L796）+ 轮询等待 `ui.menu` 渲染。**任何一环失败**（JS 报错、慢设备 20 秒观察窗没赶上、LuCI API 变化）→ 用户永久没有导航。而 `menu-mintzero.js` L89–96 里 `ul.style.display = ''` 看似在“显示菜单”，实则被 `!important` 压制，**完全无效**（误导性代码）。

修复：加一个与业务无关的安全网，例如在 `menu-mintzero.js` 渲染完成后直接 `ul.classList.add('mz-menu-ready')`（把“显示菜单”的责任还给渲染者），或在 CSS 侧加 `<noscript>`/超时回退。无论如何不要让全站导航依赖一个 800ms 延迟的非关键脚本。

### OT-03【P1】`.mz-info-cards` / `.mz-rings` 的桌面固定列规则从未生效

- L1203–L1219：两者 `display: flex`；
- L2402–L2407、L2455–L2462 及 `@media ≥1024px / ≥1400px` 各块：只写了 `grid-template-columns: ... !important`，**从没写 `display: grid`**。

`grid-template-columns` 对 flex 容器是无意义声明。于是 CHANGELOG 里“桌面固定像素列、真正居中”等 5 轮布局调优，**对信息卡和圆环区全部没生效**（实际 fallback 到 `flex: 1 1 150px/280px` 流式排列）。port/net/sys/wifi 四个 grid 容器不受影响。

修复：给 `.mz-info-cards, .mz-rings` 补 `display: grid`（并复核 `justify-content` 在 grid 下的语义），或删掉这些死规则、承认 flex 行为。

### OT-04【P1】圆环卡片标题类名对不上：`mz-ring-info`/`mz-ring-title` 无样式

`overview.js` L533/537/543 输出 `<div class="mz-ring-info"><div class="mz-ring-title">CPU…`，但 CSS 里只有 `.mz-ring-meta/.mz-ring-label/.mz-ring-value-text`（L1235–L1246），**`mz-ring-info`/`mz-ring-title` 全仓零定义**。圆环标题现在是裸块级文本（字号/颜色/间距全靠继承），与设计稿两张皮。修复：统一用 CSS 已有的 `mz-ring-meta` + `mz-ring-label`（JS 侧改三行）。

### OT-05【P1】概览面板硬编码中文，英文界面也显示中文

`overview.js` 内写死的中文：DHCP 空状态（L308）、UPnP 标题/空状态（L490–L492）、各 `mz-section-title`（端口状态/网络/系统信息/DHCP 租约/无线等）与圆环标题（内存/存储，L537/543）。README 自称“国际化就绪（英文+简体中文）”，但普通脚本没有 `_()` 通道。修复：把文案抽成 `L.tr()`/字典按 `document.documentElement.lang` 选择，或至少中英双语 key 映射（端口/网络等识别已做双语，见 CHANGELOG，输出侧照做即可）。

### OT-06【P1】菜单渲染与面包屑对“树根形态”假设互斥（需实机验证，二者必坏其一）

- `menu-mintzero.js` `renderMenuLevel`（L131 起）：把 `tree` 当**虚拟根**（children 含 `admin`），靠 `overview.js initMenu()` 把顶层 `admin` 节点拆散提升（L702 起注释“移除管理权节点”佐证）；
- 同文件 `renderBreadcrumb`（L99 起）：注释写“The tree root already represents that node”，跳过 `admin` 首段后直接 `node.children[segs[i]]` ——把 `tree` 当 **admin 本体**。

两种假设不可能同时成立：如果 `tree` 是虚拟根，面包屑 `tree.children['status']` 为 undefined → **面包屑永不显示**；如果 `tree` 是 admin 本体，主菜单首层渲染就错了。请实机确认后统一，并给面包屑加无数据时的隐藏（现在 titles 为空直接 return，留空 `ul`，尚可）。

### OT-07【P1】`renderModeMenu` 的输出被 CSS 永久隐藏

`menu-mintzero.js` L184–204 渲染 `#modemenu`，但 CSS（约 L1310）`#modemenu { display: none !important; }` 全局隐藏。要么删渲染函数（死代码），要么删 CSS 隐藏（如果顶栏模式菜单是想要的功能）。现状是两边打架。

### OT-08【P1】`header.ut` 的 `theme` 变量来源不明，light/dark 变体可能整体失效（需实机验证）

`header.ut`（约 L14）：`theme == 'mintzero-dark' ? ...`，注释称“`theme` 是 mediaurlbase 的 basename”。但 LuCI ucode 模板上下文是否提供裸 `theme` 变量**存疑**（传统只保证 `media`/`resource` 等）。若 `theme` 未定义 → `themepref` 恒为 `system` → **mintzero-light/dark 两个变体选了也白选**（永远跟随系统）。最稳的修复是不依赖它：

```ucode
const m = split(media ?? '', '/');
const basename = m[length(m)-1] ?? 'mintzero';
const themepref = (basename == 'mintzero-dark' ? 'dark' : (basename == 'mintzero-light' ? 'light' : 'system'));
```

### OT-09【P1】设置页与实际行为对 `ui_random` 缺省值理解相反

`wallpaper.js` L41 `form.Flag 'ui_random'` **没设 default** → UCI 无键时表单显示**关**；而 `header.ut` 无键时判 **true（开）**（见 TZ-15）。用户看到“关”以为没开壁纸，实际每页都在拉。修复：uci-defaults 显式写键（推荐，见 TZ-17）+ 表单侧设 `uiRandom.default = '1'`（按 LuCI form API 以实际生效写法为准）。

### OT-10【P1】概览数据采集与 LuCI 渲染顺序/语言强耦合

- `collectCore` 取 `tables[0/1/2]` 当系统/内存/存储（L149–L158），**不校验表头**：LuCI 增删一张表就全盘错位（把别处数字当内存用）；
- `parseBar` 正则（`overview.js` 约 L95–110）要求 `used unit / total unit (pct%)` 英文式样，locale 变化即匹配失败 → 静默显示 0%；
- 端口 up/down 靠中英 substring（约 L195–215），其他语言误判。

建议：按表头关键词定位表格（已有 `findSection` 机制，复用即可），`parseBar` 失败时保留旧值而非归零。

### OT-11【P1】`hideOriginalSections` 靠标题前缀隐藏原文，脆弱且昂贵

`overview.js` L17–21（HIDE_PREFIXES，中英硬编码）+ L589–603 + 全局 MutationObserver（L700 起）。新语言/新版 LuCI 改个标题 → 原文与面板**重复显示**；且每次 XHR 轮询触发 subtree mutation 都要全量 `querySelectorAll` 过一遍。建议：隐藏逻辑改按 `data-page` + section 在 `findSection` 中的**定位结果**隐藏（找得到的才藏，找不到的不藏），并把 observer 收敛到 `#mz-view` 的 `childList`（现状已是，可再加防抖）。

### OT-12【P1】两处脚本竞态操作同一棵菜单 DOM

`menu-mintzero.js`（`ui.menu.load().then(render)`）和 `overview.js initMenu()`（轮询等 children 再折叠/拆顶层）都读写 `#mainmenu`，时序靠运气。建议：折叠/拆顶层逻辑并入 `menu-mintzero.js` 的 `render().then()` 之后，`overview.js` 不再碰菜单（也顺带解 OT-02 的一半问题）。

### OT-13【P1】`overview.js` 在**所有后台页面**加载

`footer.ut`（约 L23–24）无条件引入 32KB 的 `overview.js`，其 `boot()` 在非概览页也要跑菜单轮询 + 建两个 MutationObserver（20 秒窗）。建议：只在 `data-page="admin-status-overview"` 时引入（`header/footer.ut` 按 `ctx.request_path` 条件输出），菜单折叠逻辑搬走后（OT-12）该文件即可彻底按需加载。

### OT-14【P2】切到“跟随系统”后要刷新才跟随

`menu-mintzero.js` L252 `applyTheme('system')` 只算一次 `matchMedia` 写死值，不挂 `change` 监听（监听只在 `header.ut` 首屏脚本里、且仅当 localStorage 非 light/dark 时挂）。用户 light→dark→system 点完，换系统主题要刷新才生效。修复：`applyTheme` 内统一维护一个 listener（system 时挂上并立即 apply，light/dark 时摘掉）。

### OT-15【P2】CSS 规模与特异度失控：171 个 `!important`，3924 行多层覆盖

同一组件反复定义 2–5 次，后浪覆盖前浪，中间的全是死代码（抽样）：

| 组件 | 定义次数（位置） |
|---|---|
| `.cbi-dropdown` | 3 次（约 L1560、L1640、 overhaul 段） |
| `.cbi-value` / `.cbi-value-title` / `.cbi-value-field` | 3 次（约 L590、L1360、L1680） |
| `table.table` / `table.cbi-section-table` | 3 次（约 L650、L1400、L1720）+ 移动端 2 次 |
| `.cbi-tabmenu` / `ul.cbi-tabmenu` | 3 次（约 L1420、L1790、L3130） |
| `.ifacebox` 三件套 | 3 次（约 L860、L1340、L1830） |
| `.cbi-progressbar` | 2 次（约 L690、L1900） |
| `.errorbox/.warningbox/.infobox` | 2 次（约 L1450、L1800） |
| `.mz-menu-group > a`（含 `::after` 三角） | 3 次（约 L1180、L1310、L1920） |
| `.cbi-page-actions/.cbi-section-actions` 方向 | column→row 来回覆盖 5+ 次（末尾的 768px 块说了算） |
| `.mz-sys-grid` 列数 | `!important` 覆盖 6+ 次 |
| `.mz-section-title` 对齐 | 左→中→左 3 次 |

文件头注释自称“single source of truth”，现状恰相反。建议冻结新 `!important`（CR 红线），排期做一次“按组件收敛 + 删除死层”的重构（可借助覆盖率：实机跑一遍主要页面，删零命中规则）。

### OT-16【P2】`sysauth.js` 死代码与小毛病

- `pickWallpaper()`（L22–42，Bing 池时代遗留）、`wallpaperSourceUrl()`（L105–114，从未被调用，与 L116–136 内联逻辑重复）：删；
- `copyright`（L77 取了元素但**从未赋值**）：登录页右下角版权区永远是空 div，CHANGELOG“版权永不移除”名存实亡。要么删元素，要么在自定义模式下填图片来源；
- `applyWallpaperSettings(card, wp)` 的 `card` 参数未使用；
- `#luci_password` 被 focus 两次（L65 在 setupRemember 内、L148 无条件）：空用户名时也抢密码框，且打断用户输入。建议只在“已记住用户名”时 focus 密码，否则 focus 用户名。

### OT-17【P2】`wallpaper.js` 死函数 + 上传实现粗糙

- `mkUpload()`（L78–99）定义后从未调用（实际用的是 L108–144 的内联按钮组）：删；
- L180–187 上传用 `for` 逐字节 `String.fromCharCode` 拼 3MB 字符串再 `btoa`：主线程卡顿明显。建议 `FileReader.readAsDataURL` 取 base64 段，或分块 `String.fromCharCode.apply`；
- 上传中按钮不禁用、无进度：连点会并发写同一文件。建议加 busy 态；
- 服务端无 MIME/魔数校验（见 TZ-17 上下文）：仅靠前端 `accept`，配置错误可写入非图片。`custom-*.jpg` 是经 uhttpd 静态 served 的，内容不可信时有 sniff 风险，建议 rpcd/file 侧校验或至少文档警示。

### OT-18【P2】412KB 的 logo SVG 是“PNG 套壳”且**零引用**

- `logo.svg`（148K）、`logo-dark.svg`（148K）、`logo-mono.svg`（116K）内容都是 `<svg><image href="data:image/png;base64,...">` 单行——**把 256px PNG 包进 SVG 冒充矢量**，无任何缩放优势；
- 全仓引用检查：模板/JS 只用了 `overview-banner.png`（`header.ut` L109）与 `login-logo.png`（`sysauth.ut` L19），**三个 SVG 零引用**；
- `favicon/` 整目录 220K，`favicon.svg` 同样是套壳（`favicon-48.png`/`favicon-180.png` 已够用）。

路由器闪存寸土寸金，建议：删三个 logo SVG（省 412KB）；favicon.svg 换真矢量或删（保留 png）；`login-logo.png` 72K + `overview-banner.png` 84K 可再压（logo 类 PNG 用 oxipng/pngquant 常能省 30–50%）。

### OT-19【P2】模板三份拷贝 vs 注释声称 symlink，已漂移

`htdocs/luci-static/mintzero-{dark,light}` 是 symlink（好），但 `ucode/template/themes/mintzero-{dark,light}/` 是**三个文件的实体拷贝**（与 `mintzero/` 内容逐字节相同，已用 `diff -q` 确认），而 `uci-defaults` 注释写的是“symlink 指向原文件”——注释与现实相反。下次改 header 漏同步一个目录，light/dark 变体就行为分叉。建议：构建/安装时用 symlink（若 luci.mk 打包跟随），或三目录缩成一份 + 文档说明。

### OT-20【P2】README 与 CHANGELOG 与代码脱节

- README 还在讲：Bing 壁纸全流程、`dashboard.js`、壁纸 JSON 刷新端点、旧选项表（market/cache_ttl/random）——**四处全已过时**（Bing 已下线、Dashboard 已删、刷新改 rpcd、新选项未文档化）；
- README 目录树列了 `wallpaper-refresh.ut`，该文件**不存在**；
- CHANGELOG 称登录欢迎语改为「可可，嗨嗨嗨~」，实际 `sysauth.ut` 仍是英文 `Welcome back! …`；
- CHANGELOG 称“面板 86% 半透明”，实际 0.86 规则已死（见 TZ-05），生效的是 0.72。

建议发版前把 README 的壁纸章节按“双端独立源 + rpcd + 全局壁纸开关”重写。

### OT-21【P2】静态资源版本号手工维护且已分叉

`header.ut` 里 CSS 是 `?v=mz20260907f`，`footer.ut` 里 `overview.js` 是 `?v=mz20260907e`（e vs f 不一致）；CHANGELOG 却说用 `luci.main.resource_version` 强制刷新——代码里根本没用该机制。建议：统一抽一个版本号变量（模板常量），每次发版只改一处。

### OT-22【P2】壁纸后端失败静默吞掉，自定义图失效无从排查

`header.ut`（约 L20–27）`try { wallpaper = getWallpapers(); } catch (e) { wallpaper = {enabled:true, pc:null, mobile:null} }` —— `import` 失败、UCI 异常、`stat` 异常全部吞掉，前端退化为随机 API。用户配了自定义图却不生效时**零日志**。建议 catch 里打一行 `console`/syslog（ucode 侧可用 `print` 进 uhttpd 日志或归一化错误页注释）。

### OT-23【P2】登录用户名疑似双重转义

`sysauth.ut`（约 L37）：`value="{{ entityencode(duser, true) }}"`。ucode `{{ }}` 默认已做 HTML 转义，再叠 `entityencode` 会把 `&` 编成 `&amp;amp;`。用户名含特殊字符时回显错误。建议二留一（留 `{{ duser }}` 即可），并实机用 `a&b"<>` 类用户名验证。

### OT-24【P2】注销无错误处理

`menu-mintzero.js` L268–280：`fetch(POST admin/logout).then(reload)`，失败/非 2xx 照样 reload，用户以为退了其实没退（公共电脑场景有安全观感问题）。建议检查 `res.ok`，失败弹通知。

### OT-25【P2】rpcd 把 UCI 值直接拼进 shell（root-only，低危但应修）

`root/usr/libexec/rpcd/mintzero` L24–30：`mkt`/`cnt` 取自 UCI，未过滤 `"$\`` ` 就拼进 `wget "...n=${cnt}&mkt=${mkt}"`。能写 UCI 的已是 root，危害有限，但手滑写个带引号的值就会炸。顺手加个白名单（`mkt` 限 `[A-Za-z-]*`，`cnt` 限数字）即可。另：注释说“drop throttle lock”但只删不建，锁语义已死（且整个 Bing 下载见 TZ-17，优先处理去留）。

### OT-26【P2】`scripts/po2lmo.py`：plural 单行解析 bug + 定位不明

- `parse_po` 的 `msgstr[` 分支（约 L100–108）：`line.index('" ')` 要求引号后跟空格，标准单行 `msgstr[0] "foo"` 命中 `else ''` → **译文丢空**。多行写法（`msgstr[0] ""` + 续行）才走得通。当前中文 po 无 plural，暂无影响，但工具自称通用编译器就不该错。修复：用正则 `^msgstr\[(\d+)\]\s*"(.*)"$` 提取引号内容；
- `unescape` 不处理 `\r` 等，转义顺序也有隐患；
- 更大的问题：luci.mk 构建本来就会调 host `po2lmo` 编 po，这个脚本是冗余的“第二实现”（CHANGELOG 称 PoC）。建议明确其定位：要么删（用官方工具链），要么补测试向量（与 `po2lmo.c` 同输入比对输出哈希）并在 CI 里跑。

### OT-27【P3】死 CSS 清单（发射端已删，样式还在）

| 选择器 | 状态 |
|---|---|
| `.mz-dash-grid` / `.mz-card` 相关流量 `.mz-traffic*` / `.mz-spark`（约 L2776–L2870） | Dashboard 页面已删（见 CHANGELOG），整段 ~95 行可删（注意 `.mz-card` 在玻璃组被引用，若删需同步） |
| `.mz-mem-detail`（L1246 起） | 明细功能已砍（`collectCore` 的 memDetails 不再渲染），只剩 CSS |
| `.mz-net-device`（L2098 起） | `netHtml` 已不输出该节点 |
| `.mz-login-title`（L993） | `sysauth.ut` 无此元素（只有 welcome 文案） |
| `.mz-topbar-inner`（L2289） | `header.ut` 无此元素 |
| `.mz-brand-logo` 28px（L192） | 被 L3653 的 56px 全覆盖 |

### OT-28【P3】有发射、无样式的类（裸奔但多半无害）

| 类 | 发射处 | 现状 |
|---|---|---|
| `.mz-auth-extra`、`.mz-passkey-hint` | `sysauth.ut` | 无任何规则；passkey 按钮靠 `.btn` 兜底，`hidden`+`disabled` 且**主题无 JS 会启用它**（见 OT-31） |
| `.mz-wp-actions` | `wallpaper.js` L96 | 无规则，按钮靠 `.cbi-page-actions` 继承排版，尚可 |
| `.mz-crumb-sep` | `menu-mintzero.js` 面包屑 | 无规则，`/` 分隔符无边距样式 |
| `.mz-submenu` | `menu-mintzero.js` L159 | 无规则，靠 `.mz-menu ul` 通用规则兜底，尚可 |

### OT-29【P3】卸载/升级残留

- `postrm` 只清 ACL + 主题注册，不清 `/etc/config/mintzero` 与 `/www/.../custom-*.jpg`（重装后旧图“复活”，用户困惑）；
- `uci-defaults` 从不删除废弃键（`market/cache_ttl/random/mode/count`），老用户配置里僵尸键越积越多。建议升级时 `uci -q delete` 清理。

### OT-30【P3】`theme-color` 写死深色

`header.ut`（约 L62）`<meta name="theme-color" content="#0f172a">` 不分浅深模式。浅色模式下移动端浏览器顶栏仍是深色。建议按 `themepref` 输出两个值。

### OT-31【P2】Passkey 按钮是“永久隐藏的死 DOM”（除非有插件接管）

`sysauth.ut`（约 L73–78）：按钮 `hidden` + `disabled` + title“未配置”，而主题 JS（`sysauth.js` 全文 154 行）**没有任何 passkey/WebAuthn 逻辑**。如果设计是“等第三方 auth 插件的 `auth_assets` 脚本来启用”，请在注释写明约定（插件需做 `hidden=false` + 绑定）；否则应删掉，避免无障碍树里留一个永不可用的控件。

### OT-32【P3】登录页焦点策略粗暴

`sysauth.js` L148 无条件 `focus()` 密码框：首次访问（用户名空）也把光标钉在密码框，且与 L65 重复。建议：有记住的用户名 → focus 密码；否则 focus 用户名。

### OT-33【P2】`.cbi-section-node` 的横向滚动会裁掉下拉菜单

约 L3875 起 `.cbi-section-node { overflow-x: auto; }` 建立了滚动容器，而“保存并应用”下拉（`.cbi-dropdown.open > ul`，`position:absolute; z-index:100`）若位于其内部，纵向溢出会被裁掉（overflow-x 非 visible 会把 overflow-y 也算成 auto）。表格页的操作列下拉是重灾区。建议：滚动容器改包在更内层，或下拉改用 `position: fixed` 定位（LuCI 原生行为即如此，需核对）。

---

## 三、值得肯定的地方（保持）

- 壁纸“永不挡登录”设计：渐变兜底 + `new Image()` 预载 + 12s 超时 + 失败静默，容错链完整。
- `overview.js` 自写 `esc()` 并对所有插值转义，XSS 卫生良好；`wallpaper.uc` 的 `validCustomUrl` 白名单思路正确（http(s) + 元字符过滤）。
- 无障碍 baseline 齐全：skip-link、`:focus-visible`、aria、reduced-motion。
- 弹窗系统、吸底操作栏、cbi-tab 显隐、`box-sizing` 修复等都是对 LuCI 痛点的有效修补。
- CHANGELOG 详细到值得表扬（虽然部分条目已与代码脱节，见 OT-20）。

## 四、修复优先级路线图

| 优先级 | 条目 | 工作量估计 |
|---|---|---|
| P0 本轮必修 | TZ-01（去嵌套玻璃）、OT-01（checkbox）、OT-02（菜单保活） | S–M |
| P1 次轮 | TZ-02/03/04/06/07/15/17、OT-03–OT-13 | M |
| P2 排期 | TZ-08–14/16、OT-14–26、OT-31/33 | M–L（含 CSS 收敛 OT-15） |
| P3 顺手 | OT-27–30/32、文档同步 OT-20 | S |

最小闭环建议（先让“壁纸效果”达标）：TZ-01 + TZ-02 + TZ-03(1–7) + TZ-07 + OT-01 + OT-09，一次改完即可解决用户当前可见的全部透明问题。

---

*报告生成：静态审查，未修改任何源码。如需，我可以按上述路线图逐项出 patch。*
