# mintzero

A modern, lightweight, responsive LuCI theme for current OpenWrt/LuCI master
(ucode-based, ucode template engine).

Design direction: modern dashboard, card UI, high information density with
generous whitespace, Apple/Linear-like restraint. Not a CSS reskin of another
theme; templates and menu rendering are implemented against the current LuCI
master theme interface.

## Features

- Modern design system built on CSS variables (design tokens): color, spacing,
  radius, shadow, typography
- Light / Dark / System color schemes (System is the default, honors
  `prefers-color-scheme`; per-browser override via sidebar toggle)
- Fullscreen Bing daily wallpaper login page with gradient fallback
- Sidebar navigation rendered from the live LuCI menu tree (no hardcoded menus)
- Mobile drawer navigation with overlay
- Responsive from 480px to 1280px+; tables reflow to cards on mobile
- Dashboard view with real system data (ubus/rpcd); unsupported values show
  N/A, never fake numbers
- Accessible: skip link, focus-visible outlines, aria labels, keyboard
  operable login
- No CDN, no web fonts, no icon fonts, no frontend frameworks, no jQuery
- i18n ready (English + Simplified Chinese)

## Installation

### From source (in OpenWrt buildroot)

Clone this repository into your buildroot `package/` directory (or add it as a
feed), then:

```sh
./scripts/feeds update -a
./scripts/feeds install luci-theme-mintzero
make menuconfig   # LuCI -> 4. Themes -> luci-theme-mintzero
make package/luci-theme-mintzero/compile V=s
```

Install the resulting `luci-theme-mintzero_*.apk`/`.ipk` on the device, or use
`opkg install` / `apk add` with the built artifact.

### Selecting the theme

After installation the theme is registered automatically via uci-defaults:

```sh
uci set luci.main.mediaurlbase=/luci-static/mintzero
uci commit luci
/etc/init.d/rpcd reload
```

## Bing Wallpaper

The login page can display the Bing daily wallpaper.

### How it works

```
Bing HPImageArchive API
        |
  ucode backend (wallpaper.uc)     <- server-side, on the router
        |  strict JSON validation
        |  host allowlist (www.bing.com / cn.bing.com / th.bing.com)
        |  4s timeout
        v
metadata cache (/tmp/mintzero-wallpaper/metadata.json, TTL configurable)
        v
login page JS (preloads via new Image(), random pick, fade-in)
        v
browser loads image bytes directly from Bing CDN (not proxied)
```

- The browser never calls the Bing API directly; only the ucode backend does.
- Image bytes are loaded by the browser straight from Bing (no proxying
  through the router).
- A random wallpaper is chosen per login page visit; the same image is not
  repeated twice in a row (when the pool allows).
- Copyright/title of the wallpaper is shown in the bottom-right corner of the
  login page and is never removed.

### Offline behavior

If Bing is unreachable (no internet, DNS failure, timeout, API error, invalid
JSON, image load error), the login page still renders instantly:

1. cached metadata (valid TTL) -> 2. stale cached metadata -> 3. built-in CSS
gradient fallback.

Bing is never allowed to block or break the login page.

## Theme Settings

A settings page is provided under `mintzero` > `Bing Wallpaper`
(`/cgi-bin/luci/admin/mintzero/wallpaper/settings`), backed by
`/etc/config/mintzero`:

| Option | Type | Default | Meaning |
|---|---|---|---|
| enabled | boolean | 1 | wallpaper feature on/off |
| market | enum | zh-CN | Bing market (zh-CN, en-US, ja-JP, zh-TW) |
| cache_ttl | seconds | 86400 | metadata cache TTL |
| overlay | float | 0.45 | dark overlay opacity on login page |
| blur | px | 0 | login background blur |
| random | boolean | 1 | random wallpaper per visit |

## Development

Directory layout (follows current LuCI master conventions):

```
luci-theme-mintzero/
├── Makefile                  # luci.mk based package
├── htdocs/luci-static/mintzero/
│   ├── cascade.css           # design system + layout + components
│   ├── logo.svg              # color logo
│   ├── logo-mono.svg         # monochrome (currentColor)
│   ├── logo-dark.svg         # dark mode variant
│   └── favicon/              # favicon.svg / -48.png / -180.png
├── htdocs/luci-static/resources/
│   ├── menu-mintzero.js      # sidebar/menu renderer (LuCI JS API)
│   └── view/mintzero/
│       ├── sysauth.js        # login page frontend
│       ├── dashboard.js      # dashboard view (real data)
│       └── wallpaper.js      # wallpaper settings form
├── ucode/template/themes/mintzero/
│   ├── header.ut             # shell, sidebar, topbar
│   ├── footer.ut             # footer, L.require('menu-mintzero')
│   └── sysauth.ut            # login page (native form kept intact)
├── ucode/mintzero/
│   └── wallpaper.uc          # Bing metadata fetch + cache + validation
├── root/
│   ├── etc/config/mintzero           # UCI config
│   ├── etc/uci-defaults/30_luci-theme-mintzero
│   ├── usr/share/luci/menu.d/luci-theme-mintzero.json
│   └── usr/share/luci/acl.d/luci-theme-mintzero.json
└── po/ (templates + zh_Hans)
```

## Build

Requires a current OpenWrt buildroot with the LuCI feed. The package uses the
standard `luci.mk` build; CSS/JS minification is applied by the standard LuCI
build options (`LUCI_MINIFY_CSS`, `LUCI_MINIFY_JS`). ucode template
precompilation is disabled (`LUCI_MINIFY_UT=0`) because `header.ut` imports
the theme's own backend module `luci.mintzero.wallpaper`, which cannot be
resolved by the build host's ucode compiler.

```sh
make package/luci-theme-mintzero/compile V=s
```

## Compatibility

- Target: current OpenWrt main / LuCI master (ucode template engine, `.ut`)
- Browsers: Chrome/Chromium, Firefox, Safari, Android WebView
  (CSS custom properties, flexbox, grid; `backdrop-filter` is progressive
  enhancement only)
- Login page and admin UI work without JavaScript-rendered wallpapers, without
  CDN access, and on small screens

## Troubleshooting

- Theme not selectable: run the uci-defaults script manually
  (`sh /etc/uci-defaults/30_luci-theme-mintzero`), then reload rpcd.
- Wallpaper never appears: check `/tmp/mintzero-wallpaper/bing-raw.json`;
  if absent, the router has no internet or Bing is unreachable - the gradient
  fallback is expected behavior.
- Want to force a fixed scheme: pick `mintzero-light` or `mintzero-dark` in
  System > System > Language and Style, or use the sidebar toggle.

## License

Apache-2.0. See [LICENSE](./LICENSE).
