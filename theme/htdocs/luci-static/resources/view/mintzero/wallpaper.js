// mintzero wallpaper settings view
// Copyright (C) 2026 LianXia233
// Licensed to the public under the Apache License 2.0.

'use strict';
'require view';
'require form';
'require uci';

return view.extend({
	render() {
		const m = new form.Map('mintzero', _('Bing Wallpaper'),
			_('Background image for the login page. Metadata is fetched server-side with caching; the browser loads the image directly from Bing.'));

		const s = m.section(form.TypedSection, 'wallpaper', null, _('Settings'));
		s.addremove = false;
		s.anonymous = true;

		s.option(form.Flag, 'enabled', _('Enabled'),
			_('When disabled, the login page uses the built-in gradient fallback.'));

		const market = s.option(form.ListValue, 'market', _('Bing Market'));
		market.value('zh-CN', 'zh-CN');
		market.value('en-US', 'en-US');
		market.value('ja-JP', 'ja-JP');
		market.value('zh-TW', 'zh-TW');

		const ttl = s.option(form.Value, 'cache_ttl', _('Cache TTL (seconds)'));
		ttl.datatype = 'range(300,604800)';
		ttl.default = '86400';

		const overlay = s.option(form.Value, 'overlay', _('Overlay opacity'),
			_('Dark overlay strength over the wallpaper (0.0 - 1.0).'));
		overlay.datatype = 'ufloat';
		overlay.default = '0.45';

		const blur = s.option(form.Value, 'blur', _('Blur (px)'),
			_('Background blur in pixels; 0 disables.'));
		blur.datatype = 'uinteger';
		blur.default = '0';

		s.option(form.Flag, 'random', _('Random wallpaper'),
			_('Pick a random image from the last fetched pool on each login page load.'));

		return m.render();
	}
});
