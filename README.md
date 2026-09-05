# luci-theme-mintzero

现代化 LuCI 主题，面向 OpenWrt main / LuCI master（ucode 模板引擎）。

设计方向：现代 Dashboard、卡片式 UI、高信息密度与大量留白，Apple/Linear 风格的克制视觉。不是对其他主题的 CSS 换肤——模板与菜单渲染均基于当前 LuCI master 主题接口实现。

## 功能特性

- 基于 CSS 变量（Design Tokens）的现代设计系统：色彩、间距、圆角、阴影、字体
- 浅色 / 深色 / 跟随系统三种配色（默认跟随系统，尊重 `prefers-color-scheme`；侧栏按钮可覆盖）
- Bing 每日壁纸全屏登录页，带渐变兜底
- 侧栏导航从 LuCI 实时菜单树渲染（无硬编码菜单）
- 移动端抽屉式导航 + 遮罩
- 480px 至 1280px+ 全段响应式；移动端表格重排为卡片
- Dashboard 视图展示真实系统数据（ubus/rpcd）；不支持的值显示 N/A，绝不造假数据
- 无障碍：跳转链接、focus-visible、aria 标签、键盘可操作的登录页
- 无 CDN、无 Web 字体、无图标字体、无前端框架、无 jQuery
- 国际化就绪（英文 + 简体中文）

## 目录结构

```
.github/workflows/build.yml   # GitHub Actions 云编译（x86_64 + mediatek/filogic）
theme/                        # 主题源码（放入 buildroot 的 feeds/luci/themes/ 下编译）
├── Makefile                  # 基于 luci.mk 的包定义
├── htdocs/luci-static/mintzero/
│   ├── cascade.css           # 设计系统 + 布局 + 组件
│   ├── logo.svg              # 彩色 Logo
│   ├── logo-mono.svg         # 单色（currentColor）
│   ├── logo-dark.svg         # 深色模式变体
│   └── favicon/              # favicon.svg / -48.png / -180.png
├── htdocs/luci-static/resources/
│   ├── menu-mintzero.js      # 侧栏/菜单渲染器（LuCI JS API）
│   └── view/mintzero/
│       ├── sysauth.js        # 登录页前端
│       ├── dashboard.js      # Dashboard 视图（真实数据）
│       └── wallpaper.js      # 壁纸设置表单
├── ucode/template/themes/mintzero/
│   ├── header.ut             # 页面骨架、侧栏、顶栏
│   ├── footer.ut             # 页脚、L.require('menu-mintzero')
│   └── sysauth.ut            # 登录页（保留原生认证表单）
├── ucode/mintzero/
│   └── wallpaper.uc          # Bing 元数据抓取 + 缓存 + 校验
├── root/
│   ├── etc/config/mintzero           # UCI 配置
│   ├── etc/uci-defaults/30_luci-theme-mintzero
│   ├── usr/share/luci/menu.d/luci-theme-mintzero.json
│   └── usr/share/luci/acl.d/luci-theme-mintzero.json
└── po/                       # templates + zh_Hans
```

## 云编译（GitHub Actions）

推送到 `main` 分支自动触发构建（x86_64 与 mediatek/filogic 两个目标）：

- 基于官方**预编译 SDK**（跳过工具链编译，单次构建从约 40-60 分钟降到 5-10 分钟）
- 构建产物上传至 workflow artifacts
- 同时发布到 `nightly` prerelease

也可在 Actions 页面手动触发（workflow_dispatch）。

## 本地编译

本主题是纯数据包（无 C/Lua 源码，luci.mk 的 `Build/Compile` 为空），构建实际只有文件装配 + po 转 lmo。**不要**为它编译整套 OpenWrt 工具链——用官方预编译 SDK 最快（几分钟），或只在完整 buildroot 里启用 ccache。

### 方式一：官方预编译 SDK（推荐）

```sh
# 以 x86/64 为例；其他目标把路径换成对应的 targets/架构/
BASE=https://downloads.openwrt.org/snapshots/targets/x86/64
SDK=$(curl -fsSL "$BASE/" | grep -o 'openwrt-sdk-.*tar.zst' | head -1)
curl -fsSLO "$BASE/$SDK"
tar --zstd -xf "$SDK"
mv openwrt-sdk-* sdk
cd sdk

echo "src-git luci https://github.com/openwrt/luci.git;master" > feeds.conf.default
./scripts/feeds update luci
mkdir -p feeds/luci/themes/luci-theme-mintzero
cp -a /本地路径/luci-theme-mintzero/theme/* feeds/luci/themes/luci-theme-mintzero/
./scripts/feeds install -a

echo "CONFIG_PACKAGE_luci-theme-mintzero=m" >> .config
make defconfig
make package/feeds/luci/luci-theme-mintzero/compile -j$(nproc) V=s
```

### 方式二：完整 buildroot

把 `theme/` 目录内容放入 buildroot 的 `feeds/luci/themes/luci-theme-mintzero/`，然后：

```sh
./scripts/feeds update -a
./scripts/feeds install luci-theme-mintzero
make menuconfig   # LuCI -> 4. Themes -> luci-theme-mintzero
make package/luci-theme-mintzero/compile -j$(nproc) V=s
```

buildroot 场景强烈建议启用 ccache（首次仍要编译工具链，之后增量编译显著加速）：

```sh
echo "CONFIG_CCACHE=y" >> .config
make defconfig
```

构建出的 `.apk`/`.ipk` 安装到设备即可。JS 压缩由 luci-base 的 `jsmin` 处理；CSS 压缩（csstidy）位于 packages feed，默认未启用。包为架构无关的 `all` 包。

## 主题启用

安装后 uci-defaults 会自动注册并启用主题：

```sh
uci set luci.main.mediaurlbase=/luci-static/mintzero
uci commit luci
/etc/init.d/rpcd reload
```

## Bing 壁纸

```
Bing HPImageArchive API
        |
  ucode 后端（wallpaper.uc）    <- 路由器服务端
        |  严格 JSON 校验
        |  host 白名单（www.bing.com / cn.bing.com / th.bing.com）
        |  4 秒超时
        v
元数据缓存（/tmp/mintzero-wallpaper/metadata.json，TTL 可配置）
        v
登录页 JS（new Image() 预加载、随机选图、淡入）
        v
浏览器直连 Bing CDN 加载图片（不经路由器代理）
```

- 浏览器从不直接调用 Bing API；只有 ucode 后端访问
- 图片字节由浏览器直连 Bing 加载，路由器不代理图片流量
- 每次进入登录页随机选图，池子允许时不连续重复
- 壁纸版权/标题显示在登录页右下角，永不移除

### 离线行为

Bing 不可达（无外网、DNS 失败、超时、API 错误、JSON 异常、图片加载失败）时登录页依然即时渲染，按以下优先级兜底：

1. 有效缓存 -> 2. 过期缓存 -> 3. 内置 CSS 渐变

Bing 绝不阻塞或破坏登录页。

## 壁纸设置

设置页位于 `mintzero` > `Bing Wallpaper`（`/cgi-bin/luci/admin/mintzero/wallpaper/settings`），配置文件 `/etc/config/mintzero`：

| 选项 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| enabled | 布尔 | 1 | 壁纸功能开关 |
| market | 枚举 | zh-CN | Bing 市场（zh-CN / en-US / ja-JP / zh-TW） |
| cache_ttl | 秒 | 86400 | 元数据缓存有效期 |
| overlay | 浮点 | 0.45 | 登录页深色遮罩不透明度 |
| blur | 像素 | 0 | 登录页背景模糊 |
| random | 布尔 | 1 | 每次访问随机选图 |

## 兼容性

- 目标：当前 OpenWrt main / LuCI master（ucode 模板引擎，`.ut`）
- 浏览器：Chrome/Chromium、Firefox、Safari、Android WebView（`backdrop-filter` 仅为渐进增强）
- 无 JavaScript 壁纸、无 CDN、小屏幕下登录页与后台均可正常工作

## 故障排查

- 主题不可选：手动执行 `sh /etc/uci-defaults/30_luci-theme-mintzero`，然后重启 rpcd
- 壁纸不出现：检查 `/tmp/mintzero-wallpaper/bing-raw.json`；文件不存在说明路由器无外网或 Bing 不可达，渐变兜底属预期行为
- 强制固定配色：在 系统 > 系统 > 语言和外观 选择 `mintzero-light` 或 `mintzero-dark`，或使用侧栏切换按钮

## 许可证

Apache-2.0，见 [theme/LICENSE](./theme/LICENSE)。
