# SPDX-License-Identifier: Apache-2.0
#
# Copyright (C) 2026 LianXia233
#
# mintzero - a modern LuCI theme

include $(TOPDIR)/rules.mk

LUCI_TITLE:=mintzero Theme
LUCI_DEPENDS:=+luci-base +ucode-mod-fs +ucode-mod-uci

PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=LianXia233

define Package/luci-theme-mintzero/postrm
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	uci -q delete luci.themes.mintzero
	uci -q delete luci.themes.mintzero-light
	uci -q delete luci.themes.mintzero-dark
	uci commit luci
}
endef

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
