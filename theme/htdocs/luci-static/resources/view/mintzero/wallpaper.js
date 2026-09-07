// mintzero wallpaper settings view
// Copyright (C) 2026 LianXia233
// Licensed to the public under the Apache License 2.0.

'use strict';
'require view';
'require form';
'require rpc';
'require uci';
'require ui';

var callRefresh = rpc.declare({
	object: 'mintzero',
	method: 'refresh',
	expect: { '': {} }
});

var callFileWrite = rpc.declare({
	object: 'file',
	method: 'write',
	params: [ 'path', 'data' ],
	expect: { code: 0 }
});

	return view.extend({
		render() {
			const self = this;
			const m = new form.Map('mintzero', _('Mint Wallpaper'),
			_('Login page background image settings. Random mode uses device-aware wallpaper APIs; the daily mode fetches a Bing photo pool server-side.'));

		const s = m.section(form.TypedSection, 'wallpaper', null, _('Settings'));
		s.addremove = false;
		s.anonymous = true;

		s.option(form.Flag, 'enabled', _('Enabled'),
			_('When disabled, the login page uses the built-in gradient fallback.'));

		const mode = s.option(form.ListValue, 'mode', _('Wallpaper source'));
		mode.value('bing', _('Daily wallpaper (Bing pool)'));
		mode.value('paugram', _('Random (Paugram)'));
		mode.value('uapis', _('Random ACG (Uapis)'));
		mode.value('custom', _('Custom image'));
		mode.default = 'bing';

		const url = s.option(form.Value, 'custom_url', _('Custom image URL'),
			_('Direct http(s) link to an image. Used in "Custom image" mode when no image has been uploaded.'));
		url.rmempty = true;
		url.depends('mode', 'custom');

		const market = s.option(form.ListValue, 'market', _('Wallpaper market (daily mode)'));
		market.value('zh-CN', 'zh-CN');
		market.value('en-US', 'en-US');
		market.value('ja-JP', 'ja-JP');
		market.value('zh-TW', 'zh-TW');
		market.depends('mode', 'bing');

		const ttl = s.option(form.Value, 'cache_ttl', _('Cache TTL (seconds)'));
		ttl.datatype = 'range(300,604800)';
		ttl.default = '86400';
		ttl.depends('mode', 'bing');

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

		return m.render().then((nodes) => {
			const btnRow = E('div', { 'class': 'cbi-page-actions mz-wp-actions' }, [
				E('button', {
					'type': 'button',
					'class': 'btn cbi-button cbi-button-edit',
					'click': function(ev) {
						ev.preventDefault();
						ev.stopPropagation();
						self.handleRefresh(ev);
					}
				}, [ _('Refresh wallpaper cache') ]),
				E('input', {
					'type': 'file',
					'id': 'mz-wp-file',
					'style': 'display:none',
					'accept': 'image/jpeg,image/png,image/webp',
					'change': ui.createHandlerFn(self, 'handleUpload')
				}),
				E('button', {
					'type': 'button',
					'class': 'btn cbi-button',
					'click': function(ev) {
						ev.preventDefault();
						ev.stopPropagation();
						document.getElementById('mz-wp-file').click();
					}
				}, [ _('Upload custom image…') ])
			]);

			/* Attach to the map's own action bar (next to 保存/重置);
			   fall back to prepending at the top of the map if the bar
			   has not been rendered yet. */
			const bar = nodes.querySelector('.cbi-page-actions');
			if (bar)
				bar.insertBefore(btnRow, bar.firstChild);
			else
				nodes.insertBefore(btnRow, nodes.firstChild);

			return nodes;
		});
	},

	handleRefresh(ev) {
		if (ev) {
			ev.preventDefault();
			ev.stopPropagation();
		}
		return callRefresh().then((data) => {
			if (data && data.spawned)
				ui.addNotification(null, E('p', _('Refresh triggered. The new wallpaper pool loads in the background and appears after the cache reloads.')), 'info');
			else
				ui.addNotification(null, E('p', _('Custom image mode is active - nothing to refresh.')), 'notice');
		}).catch((e) => {
			ui.addNotification(null, E('p', _('Refresh failed: %s').format(e.message)), 'error');
		});
	},

	handleUpload(ev) {
		const file = ev.target.files[0];
		if (!file)
			return;

		if (file.size > 3 * 1024 * 1024) {
			ui.addNotification(null, E('p', _('Image is too large (max 3 MB).')), 'error');
			return;
		}

		return file.arrayBuffer().then((buf) => {
			let bin = '';
			const bytes = new Uint8Array(buf);
			for (let i = 0; i < bytes.length; i++)
				bin += String.fromCharCode(bytes[i]);

			return callFileWrite('/www/luci-static/mintzero/custom.jpg', btoa(bin));
		}).then(() => {
			ui.addNotification(null, E('p', _('Image uploaded. It is used when "Wallpaper source" is set to "Custom image".')), 'info');
		}).catch((e) => {
			ui.addNotification(null, E('p', _('Upload failed: %s').format(e.message)), 'error');
		});
	}
});
