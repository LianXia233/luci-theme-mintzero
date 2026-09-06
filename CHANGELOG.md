# Changelog

All notable changes to **luci-theme-mintzero** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

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
