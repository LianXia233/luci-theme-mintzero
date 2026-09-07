// mintzero wallpaper settings view
// Copyright (C) 2026 LianXia233
// Licensed to the public under the Apache License 2.0.

'use strict';
'require view';
'require form';
'require rpc';
'require uci';
'require ui';

var callFileWrite = rpc.declare({
	object: 'file',
	method: 'write',
	params: [ 'path', 'data' ],
	expect: { code: 0 }
});

var PC_CUSTOM = '/www/luci-static/mintzero/custom-pc.jpg';
var MOBILE_CUSTOM = '/www/luci-static/mintzero/custom-mobile.jpg';

return view.extend({
	render() {
		const self = this;
		const m = new form.Map('mintzero', _('Mint Wallpaper'),
			_('Login page background image. Configure separate sources for desktop and mobile visitors.'));

		const s = m.section(form.TypedSection, 'wallpaper', null, _('Settings'));
		s.addremove = false;
		s.anonymous = true;

		s.option(form.Flag, 'enabled', _('Enabled'),
			_('When disabled, the login page uses the built-in gradient fallback.'));

		/* ---- PC source ---- */
		const pcMode = s.option(form.ListValue, 'pc_mode', _('Desktop source'));
		pcMode.value('random', _('Random (Paugram)'));
		pcMode.value('custom', _('Custom image'));
		pcMode.default = 'random';

		const pcUrl = s.option(form.Value, 'pc_url', _('Desktop custom image URL'),
			_('Direct http(s) link to an image. Used when no desktop image has been uploaded.'));
		pcUrl.rmempty = true;
		pcUrl.depends('pc_mode', 'custom');

		/* ---- Mobile source ---- */
		const mMode = s.option(form.ListValue, 'mobile_mode', _('Mobile source'));
		mMode.value('random', _('Random ACG (Uapis)'));
		mMode.value('custom', _('Custom image'));
		mMode.default = 'random';

		const mUrl = s.option(form.Value, 'mobile_url', _('Mobile custom image URL'),
			_('Direct http(s) link to an image. Used when no mobile image has been uploaded.'));
		mUrl.rmempty = true;
		mUrl.depends('mobile_mode', 'custom');

		/* ---- Global ---- */
		const overlay = s.option(form.Value, 'overlay', _('Overlay opacity'),
			_('Dark overlay strength over the wallpaper (0.0 - 1.0).'));
		overlay.datatype = 'ufloat';
		overlay.default = '0.45';

		const blur = s.option(form.Value, 'blur', _('Blur (px)'),
			_('Background blur in pixels; 0 disables.'));
		blur.datatype = 'uinteger';
		blur.default = '0';

		return m.render().then((nodes) => {
			const mkUpload = function (fileId, labelText) {
				return [
					E('input', {
						'type': 'file',
						'id': fileId,
						'style': 'display:none',
						'accept': 'image/jpeg,image/png,image/webp',
						'change': ui.createHandlerFn(self, 'handleUpload', fileId)
					}),
					E('button', {
						'type': 'button',
						'class': 'btn cbi-button',
						'click': function(ev) {
							ev.preventDefault();
							ev.stopPropagation();
							document.getElementById(fileId).click();
						}
					}, [ labelText ])
				];
			};

			const btnRow = E('div', { 'class': 'cbi-page-actions mz-wp-actions' }, [
				E('button', {
					'type': 'button',
					'class': 'btn cbi-button',
					'click': function(ev) {
						ev.preventDefault();
						ev.stopPropagation();
						document.getElementById('mz-wp-file-pc').click();
					}
				}, [ _('Upload desktop image…') ]),
				E('input', {
					'type': 'file',
					'id': 'mz-wp-file-pc',
					'style': 'display:none',
					'accept': 'image/jpeg,image/png,image/webp',
					'change': ui.createHandlerFn(self, 'handleUpload', 'pc')
				}),
				E('button', {
					'type': 'button',
					'class': 'btn cbi-button',
					'click': function(ev) {
						ev.preventDefault();
						ev.stopPropagation();
						document.getElementById('mz-wp-file-mobile').click();
					}
				}, [ _('Upload mobile image…') ]),
				E('input', {
					'type': 'file',
					'id': 'mz-wp-file-mobile',
					'style': 'display:none',
					'accept': 'image/jpeg,image/png,image/webp',
					'change': ui.createHandlerFn(self, 'handleUpload', 'mobile')
				})
			]);

			const bar = nodes.querySelector('.cbi-page-actions');
			if (bar)
				bar.insertBefore(btnRow, bar.firstChild);
			else
				nodes.insertBefore(btnRow, nodes.firstChild);

			return nodes;
		});
	},

	handleUpload(kind, ev) {
		const file = ev.target.files[0];
		if (!file)
			return;

		if (file.size > 3 * 1024 * 1024) {
			ui.addNotification(null, E('p', _('Image is too large (max 3 MB).')), 'error');
			return;
		}

		const target = (kind === 'mobile') ? MOBILE_CUSTOM : PC_CUSTOM;

		return file.arrayBuffer().then((buf) => {
			let bin = '';
			const bytes = new Uint8Array(buf);
			for (let i = 0; i < bytes.length; i++)
				bin += String.fromCharCode(bytes[i]);

			return callFileWrite(target, btoa(bin));
		}).then(() => {
			ui.addNotification(null, E('p', _('Image uploaded. Set the matching source to "Custom image" to use it.')), 'info');
		}).catch((e) => {
			ui.addNotification(null, E('p', _('Upload failed: %s').format(e.message)), 'error');
		});
	}
});
