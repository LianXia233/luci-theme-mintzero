// mintzero login view
// Copyright (C) 2026 LianXia233
// Licensed to the public under the Apache License 2.0.
//
// Frontend for the mintzero login page. The visible card is rendered by
// sysauth.ut; this module wires it to the hidden standard LuCI form so the
// actual POST / authentication flow stays 100% LuCI-native.
//
// Wallpaper strategy (never blocks login):
//   1. Page renders instantly with CSS gradient fallback
//   2. JS fetches local wallpaper metadata from the theme endpoint
//   3. Selected image is preloaded via new Image(), then cross-fades in
//   4. Any failure keeps the gradient - no white screen possible

'use strict';
'require view';
'require ui';
'require request';

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

function requestWallpaperMetadata(timeoutMs) {
	/* Local-only endpoint rendered by the theme; falls through to gradient
	   on any error. request.get default timeout keeps this from hanging. */
	return request.get(L.url('mintzero/wallpapers'), { timeout: timeoutMs })
		.then((r) => {
			const j = r.json();
			return (j && j.images && j.images.length) ? j : null;
		})
		.catch(() => null);
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

function bindSubmit() {
	const form = document.querySelector('#mz-login-form');
	const btn = form?.querySelector('button[type="submit"]');
	if (!form || !btn)
		return;

	btn.addEventListener('click', () => {
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

	form.addEventListener('keypress', (ev) => {
		if (ev.key === 'Enter')
			btn.click();
	});
}

return view.extend({
	render() {
		const root = document.getElementById('mz-login');
		const card = root?.querySelector('.mz-login-card');
		const bg = document.getElementById('mz-login-bg');
		const copyright = document.getElementById('mz-login-copyright');

		/* Wire login card to the hidden native form */
		const nativeForm = document.querySelector('section form');
		const nativeBtn = document.querySelector('section button');
		const submitBtn = card?.querySelector('button[type="submit"]');

		if (nativeForm && submitBtn) {
			const submit = () => nativeForm.submit();

			submitBtn.addEventListener('click', submit);
			document.getElementById('mz-login-form')?.addEventListener('keypress', (ev) => {
				if (ev.key === 'Enter') {
					ev.preventDefault();
					submit();
				}
			});

			setupRemember();
			bindSubmit();
		}

		/* Wallpaper: local UI first, remote later; never blocks */
		const cfg = window.mintzeroWallpaper ?? {};
		if (cfg.enabled !== false && bg) {
			requestWallpaperMetadata(5000).then((wp) => {
				if (!wp)
					return;

				applyWallpaperSettings(card, wp);
				const pick = pickWallpaper(wp.images, cfg.random !== false);
				if (!pick)
					return;

				const img = new Image();
				const timer = window.setTimeout(() => { img.src = ''; }, 10000);

				img.onload = () => {
					window.clearTimeout(timer);
					document.documentElement.style.setProperty('--mz-wallpaper', `url("${pick.url}")`);
					bg.classList.add('is-loaded');

					if (copyright && (pick.title || pick.copyright)) {
						copyright.textContent = [pick.title, pick.copyright]
							.filter(Boolean).join(' - ');
						copyright.removeAttribute('aria-hidden');
					}
				};

				img.onerror = () => window.clearTimeout(timer);
				img.src = pick.url;
			});
		}

		document.querySelector('#luci_password')?.focus();

		return E([]);
	},

	addFooter() {}
});
