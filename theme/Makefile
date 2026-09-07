# SPDX-License-Identifier: Apache-2.0
#
# Copyright (C) 2026 LianXia233
#
# mintzero - a modern LuCI theme

include $(TOPDIR)/rules.mk

LUCI_TITLE:=Mint Theme
LUCI_DEPENDS:=+luci-base +ucode-mod-fs +ucode-mod-uci
# Ship the ucode templates as source: header.ut imports the theme's own
# backend module (luci.mintzero.wallpaper), which the build host cannot
# resolve, so precompilation with ucode/host must be disabled.
LUCI_MINIFY_UT:=0

PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=LianXia233 <LianXia233@users.noreply.github.com>

define Package/luci-theme-mintzero/postrm
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	uci -q delete luci.themes.mintzero
	uci -q delete luci.themes.MintzeroLight
	uci -q delete luci.themes.MintzeroDark
	uci commit luci
	rm -f /usr/share/luci/acl.d/luci-theme-mintzero.json
	rm -f /usr/share/rpcd/acl.d/luci-theme-mintzero.json
	rm -f /www/luci-static/mintzero/custom-pc.jpg
	rm -f /www/luci-static/mintzero/custom-mobile.jpg
}
endef

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
