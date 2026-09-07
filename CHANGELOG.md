# Changelog

All notable changes to **luci-theme-mintzero** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Fixed (2026-09-07 手机端排版与壁纸按钮)

### Added (2026-09-07 随机壁纸按设备切换 + NTP 列表样式)
- 随机壁纸改为按访问设备类型自动选择第三方 API：桌面端 `api.paugram.com/wallpaper/`，移动端（UA 检测）`uapis.cn/api/v1/random/image?category=acg&type=mb`；带时间戳防缓存，API 加载失败自动回退本地 Bing 壁纸池，再失败回退渐变兜底（原流程不受影响）
- 候选 NTP 服务器等 cbi-dynlist 动态列表主题化：条目卡片化（浅灰底、圆角、悬停描边）、新增输入行与 + 按钮对齐排版，宽度收敛至 480px
- cbi-dynlist 条目注入可见的「编辑 ✎ / 删除 ✕」按钮：LuCSI 原生删除热区是不可见的 ::after 伪元素（本主题无样式导致热区为 0 宽，无法删除），且原生无就地编辑；通过 `L.dom.findClassInstance` 调用 DynamicList 组件原生 removeItem/addItem，保证与 uci staging 正确同步（实测编辑/删除/保存并应用后 /etc/config/system 生效）

- P1：手机端保存/应用/重置按钮全宽——480/768px 断点把操作栏堆叠并把所有按钮拉伸到 100% 宽 → 恢复行内排列、内容自适应宽度（32px 高）
- P1：应用成功后无任何提示（LuCSI 应用完成仅关闭弹窗）——主题监听 `uci-applied` / `uci-reverted` 事件弹出成功/回滚通知；因应用成功后页面会重载，通知通过 sessionStorage 标记在重载后的页面上补显
- P2：「正在应用更改」弹窗美化：居中排版、加大字号、底部进度条动画
- P1：手机端保存/应用/重置按钮过宽——统一收窄（内容自适应宽、32px 等高、文字不截断，下拉省略符隐藏仅保留箭头）
### Changed (2026-09-07 壁纸设置迁移 + 按钮挂载加固)
- 移除 mintzero 独立菜单与 Dashboard 页面（与概览页功能冲突）：删除 `admin/mintzero/*` 全部路由与 `view/mintzero/dashboard.js`
- 壁纸设置迁移至「系统」菜单下，更名「Mint壁纸设置」（`admin/system/mintwallpaper/settings`），刷新端点同步迁移至 `admin/system/mintwallpaper/refresh`
- 壁纸页刷新/上传按钮挂载逻辑加固：优先注入地图自带操作栏（与保存/重置同排），操作栏未渲染时回退插入地图顶部

### Changed (2026-09-07 去 Bing 化 + RPC 刷新端点)
- 壁纸页全面去 Bing 字样：标题「Mint Wallpaper」，来源选项「每日壁纸（Bing 源）/ 自定义图片」，市场选项改为「壁纸市场（每日模式）」，刷新按钮改为「刷新壁纸缓存」
- 刷新端点从页面路由改为 **rpcd ubus 服务**（`/usr/libexec/rpcd/mintzero`，方法 `mintzero refresh`）：不再注册菜单/tab，点击按钮不再跳出后台 JSON 页面，改由 ubus RPC 原地返回状态
- 部署设置 `luci.main.resource_version=mz20260907f` 强制所有客户端浏览器刷新静态资源缓存（解决 view JS 缓存导致按钮/选项不显示的问题）
- 清理 po 中 Dashboard 遗留条目，新增迁移后文案的简体中文翻译

### Changed (2026-09-07 双端独立壁纸源)
- 新增「后台页面随机壁纸」开关：开启后随机壁纸**全局覆盖登录后的所有页面**（body 背景 + 可调遮罩 + 面板 86% 半透明，保证文字可读），关闭后仅登录页生效
- 随机壁纸每次登录/刷新自动更换（时间戳防缓存），加载失败自动回退渐变兜底
- 壁纸来源重构为**桌面端 / 手机端双组独立配置**：各组可选「随机 API（桌面 Paugram / 手机 Uapis ACG）」或「自定义图片」
- 自定义支持直链或上传（分别写入 custom-pc.jpg / custom-mobile.jpg，3MB 上限）
- 登录页按访问设备 UA 自动使用对应组的配置，失败保持渐变兜底
- 移除 Bing 每日壁纸模式及市场/缓存期选项，上传后端服务改经 rpcd ubus
- 登录页顶部移除 mintzero 文字，改用方形像素头像图（login-logo.png，泛洪抠白保透明、88px 圆角展示）
- 登录页 logo 改用圆形像素头像（login-logo.png 换为圆形透明版）
- 状态概览页信息卡上方新增方形像素头像 banner（overview-banner.png，96px 居中，随面板惰性创建）
- 侧栏品牌区移除 mintzero 文字，仅保留居中的品牌 logo
- 侧栏品牌 logo 更新为方形像素头像（overview-banner.png，56px 圆角居中）
- 主题显示名更名为 **Mint**（LUCI_TITLE=Mint Theme、README、alt 文本；包名/路径保留 mintzero 以兼容升级）

### Fixed (2026-09-07 壁纸背景排版修复)
- P0：全局壁纸开启后整个主内容被顶到页面下方——壁纸样式误将固定定位的侧栏改为 position:relative 使其进入文档流 → 侧栏定位不再被触碰，仅提升层级，并同步处理 stray 选择器
- 表格与表单区块在壁纸模式下补 90% 底色，保证可读性
- 登录欢迎语更新为「可可，嗨嗨嗨~！登录以管理你的网络。」

### Fixed (2026-09-07 概览页修复)
- 移除状态概览面板上方的像素头像 banner（应需求撤下），相关 JS 注入与 CSS 一并清理
- 修复 overview.js 在 banner 调整过程中被误损坏的问题：概览面板数据卡片与 CPU/内存/存储圆环恢复正常渲染（从完好历史版本恢复）
- 壁纸来源新增两个随机源选项：「随机壁纸（Paugram）」「随机 ACG（Uapis）」，选择后登录页直接从对应 API 拉图（模式经 header.ut 嵌入前端）；随机壁纸开关仅在每日壁纸模式下作为兼容开关

### Changed (2026-09-07 品牌形象更新)
- 全新像素风品牌 logo：侧栏品牌、登录页 logo、favicon（svg/48/180）全部替换为像素猫娘头像
- 边缘白底经泛洪填充转为透明、圆形裁剪去除 JPEG 噪点，透明像素完整保留
- P1：随机壁纸去除 Bing 壁纸池回退——随机模式仅使用按设备选择的第三方 API（桌面 paugram / 移动 uapis acg-mb），API 失败时保持 CSS 渐变兜底
- P2：侧栏菜单组双重三角形显示异常——`.mz-menu-group > a::after` 在两处重复定义（border 三角与字符 ▾ 属性混合同时渲染）→ 合并为单一 border 三角
- P1：无线编辑弹窗手机端每个标签行被撑到 120px 高——`.modal .cbi-value-title { flex: 0 0 120px }` 的 flex-basis 在列布局下变成高度 → 改为 `flex: 0 0 auto; width: 100%`，弹窗内表单行恢复紧凑
- P1：壁纸设置页「刷新 Bing 缓存」「上传自定义图片」按钮缺少 type=button，点击触发 LuCI 表单提交导致跳转页面 → 补 `type='button'` 与 preventDefault，点击后原地弹出通知
- P2：弹窗内无线状态 <output> 文本块限高 9rem 内部滚动，避免状态行超过 1000px
- P2：保存/重置按钮配色对齐官方 LuCI 分层（保存浅蓝、重置浅红），修复合并后的基础按钮规则在文件后部覆盖前部配色层的问题（配色层追加至文件末尾）

### Added
- 菜单一级标题加粗 700 字重 + 深色，与二级菜单明确区分
- 顶部信息卡片（设备/运行时间/平均负载/型号）统一 72px 高度 + 垂直居中
- 系统信息 11 项整合到单个大卡片内，分隔线列表布局
- DHCP 租约 / 已连接站点 / UPnP 端口映射表格全宽居左对齐
- 端口状态 / 网络上游 / 无线 radio 固定 2 列布局
- 所有卡片及内部内容左对齐（标题 + 文字 + 容器）
- 保存并应用按钮蓝色样式 + hover 上浮效果 + 阴影
- 保存提示 / 变更列表 / 警告框语义色样式（warning 黄 / error 红 / success 绿）
- PC 端宽屏内容居中（max-width 1280px）+ 多列网格优化
- 菜单 FOUC 闪烁修复（JS 处理完成后才显示菜单）
- 概览页全 section 重写为卡片 UI（系统信息 / DHCP 租约 / 无线 / 已连接站点 / UPnP 端口映射）
- 概览页端口状态卡片（接口名 / 连接状态 / 速率 / 所属区域 / 上下行流量）
- 概览页网络上游卡片（IPv4/IPv6 协议 / 地址 / 网关 / DNS / 有效期 / 设备信息）
- 页脚居中 + mintzero 链接指向主题仓库
- 圆环进度条内显示百分比数字（SVG text，方向修正）

### Changed
- 系统信息 label 固定 110px 灰色，value 左对齐 flex:1 占满剩余空间
- 信息卡片 label .78rem 500 字重，value 1rem 700 字重
- 菜单一级标题 .95rem 700 字重深色，二级 .88rem 400 字重灰色
- 网格容器从 `1fr` 拉伸改为固定最大列宽，卡片不拉伸
- 表格卡片去掉 max-width 限制，全宽居左

### Fixed
- 菜单顶部多余的"管理权"节点移除（子项提升到顶层）
- 系统信息卡片高度不一致（固件版本换行致 64px vs 42px）→ 统一等高
- apply 按钮无 `.important` 类时显示为白色 → 强制蓝色
- 残留 LuCI 页面标题 H2 可见 → 隐藏
- 网页刷新时菜单先展开再折叠（FOUC）→ CSS 默认隐藏，JS 处理完加 class 显示
- PC 端内容过宽无 max-width 限制 → 1280px 居中
- 圆环百分比文字方向错误（SVG rotate(-90deg) 连带 text 旋转）→ text 反向 rotate(90deg)
- 全页面排版混乱 / 按钮样式错误 / 响应式缺失 → 全面补充 LuCI 组件样式
- 保存并应用下拉按钮显示为蓝色块 + 项目符号列表 → 补充 `.cbi-dropdown` 系列样式

### Added (2026-09-07 第二轮修复)
- 顶栏面包屑导航（`renderBreadcrumb`，基于 `L.env.dispatchpath` 逐级显示当前页面路径）
- Dashboard 视图完整样式（`.mz-dash-grid` 自适应网格 + `.mz-card` 卡片 + 流量行 + 迷你图容器，640px 以下单列）
- 主题切换按钮选择持久化到 localStorage（`mz-theme`），刷新后不再回退
- 端口/网络/系统/DHCP/无线/UPnP 区块识别改为中英文双语匹配，兼容英文界面
- postrm 卸载时同时清理 `/usr/share/luci/acl.d/` 与 `/usr/share/rpcd/acl.d/` 两处 ACL 及主题 uci 变体

### Fixed (2026-09-07 第二轮修复)
- P0：ACL 只安装到 `/usr/share/luci/acl.d/` 而 rpcd 只读 `/usr/share/rpcd/acl.d/`，致 `wallpaper` 授权组缺失、`admin/mintzero` 菜单整体消失 → 新增 `theme/root/usr/share/rpcd/acl.d/luci-theme-mintzero.json`，实机验证菜单恢复
- P1：暗色模式下 `warningbox`/`alert-message`/`infobox`/`cbi-change-list`/`#xhr_poll_status` 硬编码浅色背景刺眼 → 追加 `html[data-theme="dark"]` 覆盖改用 token 颜色
- P1：footer.ut 隐藏条件表达式缺少右括号（`>= 0` 后语法错误）致整个内联脚本失效 → 补全括号，`node --check` 通过
- P2：SVG 圆环 `transform-origin` 重复声明 → 收敛为 `transform-box: fill-box; transform-origin: center`
- P2：`htdocs/luci-static/mintzero/menu-mintzero.js` 死代码副本与 `resources/` 版本冲突 → 删除

### Added (2026-09-07 第三轮修复)
- 全站弹窗系统样式（`#modal_overlay` fixed 全屏 + z-index 2000 + 半透明背景，`.modal` 居中 720px/90vh 内部滚动，640px 以下窄屏适配）
- 保存/应用操作栏吸底（`.cbi-page-actions` sticky bottom），滚动时始终可见
- 「保存并应用」统一主色（蓝底白字 + hover 提亮），样式一致不再丑
- 表单控件全局 `box-sizing: border-box`，修复 system 页输入框溢出字段容器 26px
- 表格操作列相邻按钮间距 + 单元格 `overflow-wrap`

### Fixed (2026-09-07 第三轮修复)
- P0：LuCI 动态弹窗（无线编辑、上传、保存并应用进度等）完全无样式——`#modal_overlay` 为 body 末尾静态透明 div（实测 1600×10177px、y=-4639），被 z-40 侧栏遮挡且进度弹窗不可见（用户误以为卡死）→ 弹窗层修复后全部正常居中显示
- P1：`#modal_overlay` 初版无条件显示暗色背景与空弹窗白块 → 改为仅 `body.modal-overlay-active` 时显示背景/弹窗，默认 `pointer-events: none` 不再拦截登录页点击
- P1：syslog/dmesg 日志输出为裸 `<textarea>`，浏览器默认宽约 163px，日志被压成窄条 → `#maincontent textarea` 全宽 + 等宽字体，PC/手机验证正常
- P1：日志页筛选行 label 中途折行、控件溢出（手机端）→ 筛选行 flex 换行 + label 禁止折行
- P2：`.mz-view` 横向溢出护栏（`overflow-x: clip`），网络页表格轻微出血不再撑开页面

### Added (2026-09-07 第四轮修复 + 壁纸功能)
- 壁纸来源可选 Bing 每日壁纸或自定义图片；自定义支持上传图片（≤3MB，写入 /www/luci-static/mintzero/custom.jpg）或填写 http(s) 图片直链
- 「刷新 Bing 缓存」手动刷新按钮（新增 `admin/mintzero/wallpaper/refresh` JSON 端点，跳过节流锁强制重取）
- cbi 选项卡（`ul.cbi-tabmenu`）完整样式：active 蓝色下划线、disabled 灰色
- 第三方应用设计变量桥接：定义 `--brand/--surface/--text/--hairline` 等 21 个变量映射到主题 token（修复 taygedo 等应用白底白字不可见）
- 新增 `scripts/po2lmo.py`（po → lmo 编译器，PoC 于实机验证）

### Fixed (2026-09-07 第四轮修复)
- P0：**所有页面 tab 选项卡失效、编辑弹窗全部选项平铺**——根因是 LuCI `switchTab()` 只切换 `data-tab-active` 属性，面板隐藏完全依赖主题 CSS，而主题缺少 `[data-tab-active="false"] { display: none }` 规则 → 补上后 tab 正常切换，弹窗高度从 10177px 恢复正常
- P0：cbi-dropdown 关闭态未隐藏未选中项（LuCI 用 `selected` **属性**而非 class），保存并应用按钮堆叠所有选项、高度 92px，误杀修复时又因选择器写错导致按钮文字消失 → 最终规则 `:not([selected]):not(.hidden)`
- P1：手机端每个选项间隔 ~340px——`.cbi-value-field { flex: 1 1 300px }` 的 basis 在列布局下变成高度 300px → 移动端改为 `flex: 1 1 auto`
- P1：wallpaper.uc 中 `validCustomUrl` 定义在调用方 `loadConfig` 之后，ucode 不做函数提升，登录页壁纸报 error、刷新端点 500 → 函数移到调用前
- P1：设备 `/etc/config/mintzero` 的 section type 为 `mintzero` 而视图按 `wallpaper` 过滤，设置页显示「尚无任何配置」→ 修正设备配置类型
- P2：主题 po 翻译未安装到设备（无 lmo 文件），Dashboard/mintzero 页面中英混杂 → po 编译 lmo 部署至 `/usr/lib/lua/luci/i18n/luci-theme-mintzero.zh-cn.lmo`，登录页与 mintzero 页面全中文
- P2：Dashboard Resources 卡片值显示 N/A 且真实值散落行外（DOM 结构错误）→ 值直接填入对应行
- P2：移动端保存/应用按钮全宽且过高 → 统一 32px 高、auto 宽度、行内排列，与「保存/重置」对齐

### Fixed (2026-09-07 第五轮修复)
- P1：概览页数据冻结不自动刷新——footer.ut 的 `initOverview()` 只在加载时解析一次被 LuCI 轮询更新的隐藏原始表格，生成的面板是静态快照 → 改为可重入（重建前先移除旧面板）并每 5 秒从实时数据重建，实测运行时间/负载/CPU 使用率持续更新
- P2：保存并应用下拉按钮与「保存/重置」高度不一致 → 统一 34px（移动端 32px），下拉内部行高压平
- P2：概览信息卡内容串行（"OWRT型号Hiveton…"）——innerText 正则跨单元格吞并相邻标签 → 改为逐单元格 label→value 解析，中英文标签均支持

---

## [0.2.0] - 2026-09-06

### Added
- 概览页 3 圆形进度环（CPU / 内存 / 存储），SVG 绘制，百分比内显
- 概览页 4 信息卡（设备 / 运行时间 / 平均负载 / 型号）
- 概览页内存详情（可用数 / 已使用 / 已缓冲 / 已缓存）
- 可折叠侧边栏菜单（8 分组，状态存 localStorage）
- 全面 UI 重写：按钮 / 表单 / 表格 / 卡片 / 菜单 / 响应式
- 深色登录页 + Bing 每日壁纸背景

### Fixed
- wallpaper.uc ucode 兼容修复（for-of / indexOf / shquote / 函数声明提升 / 模块导出）
- uci-defaults 变体名含连字符致 `uci: Parse error` → 改用驼峰 `MintzeroLight` / `MintzeroDark`
- 按钮下拉 / 表单布局 / 菜单默认折叠 / 响应式样式
- 圆环内百分比数字显示

---

## [0.1.0] - 2026-09-05

### Added
- 初始主题框架：header.ut / footer.ut / cascade.css
- 4 主题变体注册（mintzero / mintzero-light / mintzero-dark / mintzero-dark-compact）
- Bing 每日壁纸后端（wallpaper.uc，兼容 libucode20230711）
- GitHub Actions CI（预编译 SDK，构建时间 40-60min 降至 5-10min）
- nightly APK 自动发布

### Fixed
- P0：header.ut 调用不存在的 `uci.connect()` 致登录页 500
- P0：sysauth 双表单致登录输入丢失
- P1：壁纸端点无路由 / wallpaper.uc 引用未导入符号 / 三变体共用 mediaurlbase
- README 白名单描述修正
- Makefile postrm 同步变体名

---

[Unreleased]: https://github.com/LianXia233/luci-theme-mintzero/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/LianXia233/luci-theme-mintzero/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/LianXia233/luci-theme-mintzero/releases/tag/v0.1.0
