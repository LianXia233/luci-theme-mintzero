// mintzero login view
// Copyright (C) 2026 LianXia233
// Licensed to the public under the Apache License 2.0.
//
// Frontend for the mintzero login page. The login card rendered by
// sysauth.ut contains the single native LuCI login form, so authentication
// is a plain POST of luci_username / luci_password - no JS in the loop.
// This module only adds remember-username and the wallpaper background.
//
// Wallpaper strategy (never blocks login):
//   1. Page renders instantly with CSS gradient fallback
//   2. Wallpaper metadata is embedded server-side by header.ut
//   3. Selected image is preloaded via new Image(), then cross-fades in
//   4. Any failure keeps the gradient - no white screen possible

'use strict';
'require view';
'require ui';

const REMEMBER_KEY = 'mz-username';

function pickWallpaper(images, random) {
	if (!images || !images.length)
		return null;

	if (!random || images.length == 1)
		return images[0];

	/* Avoid repeating the last shown wallpaper when possible */
	let last = null;
	try { last = sessionStorage.getItem('mz-last-wallpaper'); } catch (e) {}

	let pick = images[Math.floor(Math.random() * images.length)];
	if (images.length > 1 && last !== null) {
		let guard = 0;
		while (pick.url === last && guard++ < 4)
			pick = images[Math.floor(Math.random() * images.length)];
	}

	try { sessionStorage.setItem('mz-last-wallpaper', pick.url); } catch (e) {}
	return pick;
}

function applyWallpaperSettings(card, wp) {
	if (!wp)
		return;

	if (wp.overlay != null)
		document.documentElement.style.setProperty('--mz-wallpaper-overlay', String(wp.overlay));

	if (wp.blur && parseInt(wp.blur) > 0)
		document.documentElement.style.setProperty('--mz-wallpaper-blur', parseInt(wp.blur) + 'px');
}

function setupRemember() {
	const user = document.querySelector('#luci_username');
	const remember = document.querySelector('#mz-remember');
	if (!user || !remember)
		return;

	try {
		const saved = localStorage.getItem(REMEMBER_KEY);
		if (saved) {
			user.value = saved;
			document.querySelector('#luci_password')?.focus();
		}

		remember.checked = !!saved;
	} catch (e) { /* storage unavailable */ }
}

return view.extend({
	render() {
		const root = document.getElementById('mz-login');
		const card = root?.querySelector('.mz-login-card');
		const bg = document.getElementById('mz-login-bg');
		const copyright = document.getElementById('mz-login-copyright');
		const form = document.getElementById('mz-login-form');

		setupRemember();

		/* Persist the remembered username when the native form is submitted.
		   The form posts by itself; JS must not interfere with the flow. */
		if (form) {
			form.addEventListener('submit', () => {
				const user = document.querySelector('#luci_username');
				const remember = document.querySelector('#mz-remember');

				if (user && remember) {
					try {
						if (remember.checked)
							localStorage.setItem(REMEMBER_KEY, user.value);
						else
							localStorage.removeItem(REMEMBER_KEY);
					} catch (e) { /* storage unavailable */ }
				}
			});
		}

		/* Wallpaper: data embedded server-side; local UI first, image later */
	function isMobileUA() {
		return /Android|iPhone|iPad|iPod|Mobile|Windows Phone|WebOS|BlackBerry|Opera Mini|IEMobile/i.test(navigator.userAgent || '');
	}

	function randomApiUrl() {
		const api = isMobileUA()
			? 'https://uapis.cn/api/v1/random/image?category=acg&type=mb'
			: 'https://api.paugram.com/wallpaper/';
		return api + (api.indexOf('?') >= 0 ? '&' : '?') + '_mzt=' + Date.now();
	}

	const cfg = window.mintzeroWallpaper ?? {};
	if (cfg.enabled !== false && bg) {
		applyWallpaperSettings(card, cfg);

		const showWallpaper = (url, meta) => {
			const img = new Image();
			const timer = window.setTimeout(() => { img.src = ''; }, 12000);

			img.onload = () => {
				window.clearTimeout(timer);
				document.documentElement.style.setProperty('--mz-wallpaper', `url("${url}")`);
				bg.classList.add('is-loaded');

				if (copyright && meta && (meta.title || meta.copyright)) {
					copyright.textContent = [meta.title, meta.copyright]
						.filter(Boolean).join(' - ');
					copyright.removeAttribute('aria-hidden');
				}
			};

			img.onerror = () => window.clearTimeout(timer);
			img.src = url;
		};

		const loadFromPool = () => {
			const pick = pickWallpaper(cfg.images, cfg.random !== false);
			if (pick)
				showWallpaper(pick.url, pick);
		};

		/* Random wallpaper: device-aware third-party APIs only. On
		   failure the CSS gradient fallback stays in place - the Bing
		   pool is intentionally NOT used for random mode. */
		if (cfg.random !== false) {
			const img = new Image();
			const timer = window.setTimeout(() => { img.src = ''; }, 12000);

			img.onload = () => {
				window.clearTimeout(timer);
				showWallpaper(img.src, null);
			};
			img.onerror = () => {
				window.clearTimeout(timer);
				/* keep gradient fallback; no Bing pool fallback here */
			};
			img.src = randomApiUrl();
		} else {
			loadFromPool();
		}
	}

		document.querySelector('#luci_password')?.focus();

		return E([]);
	},

	addFooter() {}
});
