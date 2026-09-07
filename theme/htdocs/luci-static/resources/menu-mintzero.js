// mintzero theme frontend logic
// Copyright (C) 2026 LianXia233
// Licensed to the public under the Apache License 2.0.
//
// Loaded via L.require('menu-mintzero') from footer.ut. Extends the LuCI
// baseclass and implements:
//   - Sidebar menu rendering from the live LuCI menu tree
//   - Mobile drawer toggle
//   - Light/Dark/System color scheme cycling
//   - Logout link

'use strict';
'require baseclass';
'require ui';

return baseclass.extend({
	__init__() {
		ui.menu.load().then((tree) => this.render(tree));

		this.initSidebarToggle();
		this.initThemeToggle();
		this.initLogout();
		this.initGlobalWallpaper();
	},

	/* ----- Global wallpaper (admin pages) ------------------------ */

	isMobileUA() {
		return /Android|iPhone|iPad|iPod|Mobile|Windows Phone|WebOS|BlackBerry|Opera Mini|IEMobile/i.test(navigator.userAgent || '');
	},

	initGlobalWallpaper() {
		const cfg = window.mintzeroWallpaper;
		if (!cfg || cfg.enabled === false || cfg.ui_random === false)
			return;
		if (document.getElementById('mz-login'))
			return;

		const grp = this.isMobileUA() ? (cfg.mobile || {}) : (cfg.pc || {});
		let url;
		if (grp.mode === 'custom' && grp.url)
			url = grp.url;
		else if (grp.mode === 'custom')
			return;
		else {
			const api = this.isMobileUA()
				? 'https://uapis.cn/api/v1/random/image?category=acg&type=mb'
				: 'https://api.paugram.com/wallpaper/';
			url = api + (api.indexOf('?') >= 0 ? '&' : '?') + '_mzt=' + Date.now();
		}

		const img = new Image();
		const timer = window.setTimeout(() => { img.src = ''; }, 12000);
		img.onload = () => {
			window.clearTimeout(timer);
			document.documentElement.style.setProperty('--mz-wallpaper', 'url("' + url + '")');
			if (cfg.overlay != null)
				document.documentElement.style.setProperty('--mz-wallpaper-overlay', String(cfg.overlay));
			if (cfg.blur && parseInt(cfg.blur) > 0)
				document.documentElement.style.setProperty('--mz-wallpaper-blur', parseInt(cfg.blur) + 'px');
			document.body.classList.add('mz-has-wallpaper');
		};
		img.onerror = () => window.clearTimeout(timer);
		img.src = url;
	},

	/* ----- Sidebar menu ------------------------------------------ */

	render(tree) {
		this.renderMainMenu(tree);
		this.renderBreadcrumb(tree);
		this.renderModeMenu(tree);

		/* Tab menu for pages with sub-views */
		let node = tree;
		let url = '';

		if (L.env.dispatchpath.length >= 3) {
			for (let i = 0; i < 3 && node; i++) {
				node = node.children[L.env.dispatchpath[i]];
				url = url + (url ? '/' : '') + L.env.dispatchpath[i];
			}

			if (node)
				this.renderTabMenu(node, url);
		}
	},

	renderMainMenu(tree) {
		const ul = document.querySelector('#mainmenu');
		if (!ul)
			return;

		this.renderMenuLevel(ul, tree, '', 0);
		ul.style.display = '';
	},

	/* Breadcrumb in the topbar, built from the live dispatch path */
	renderBreadcrumb(tree) {
		const crumb = document.getElementById('modemenu-breadcrumb');
		if (!crumb || !tree)
			return;

		const segs = L.env.dispatchpath || [];
		const titles = [];
		let node = tree;

		/* The first segment is usually 'admin'; the tree root already
		   represents that node, so start one level deeper. */
		for (let i = (segs[0] === 'admin' ? 1 : 0); i < segs.length; i++) {
			if (!node || !node.children)
				break;
			node = node.children[segs[i]];
			if (!node)
				break;
			titles.push(node.title);
		}

		if (titles.length === 0)
			return;

		crumb.innerHTML = '';
		titles.forEach((t, i) => {
			crumb.appendChild(E('li', {}, [ _(t) ]));
			if (i < titles.length - 1)
				crumb.appendChild(E('li', { 'class': 'mz-crumb-sep' }, [ '/' ]));
		});
		crumb.style.display = '';
	},

	renderMenuLevel(ul, tree, url, level) {
		const children = ui.menu.getChildren(tree);

		if (children.length == 0 || level > 2)
			return;

		children.forEach((child) => {
			const childUrl = url + (url ? '/' : '') + child.name;
			const hasChildren = ui.menu.getChildren(child).length > 0 && level < 2;
			const isActive = L.env.dispatchpath[level] == child.name;

			const li = E('li', { 'class': isActive ? 'active' : '' }, [
				E('a', { 'href': hasChildren ? '#' : L.url(childUrl) }, [
					_(child.title)
				]),
				hasChildren ? this.renderSubMenu(child, childUrl, level) : E([])
			]);

			ul.appendChild(li);
		});
	},

	renderSubMenu(tree, url, level) {
		const ul = E('ul', { 'class': 'mz-submenu' });
		this.renderMenuLevel(ul, tree, url, level + 1);
		return ul;
	},

	renderTabMenu(tree, url) {
		const container = document.querySelector('#tabmenu');
		const ul = E('ul', { 'class': 'tabs' });
		const children = ui.menu.getChildren(tree);
		let activeNode = null;

		children.forEach((child) => {
			const isActive = (L.env.dispatchpath[3] == child.name);

			ul.appendChild(E('li', { 'class': isActive ? 'active' : '' }, [
				E('a', { 'href': L.url(url, child.name) }, [ _(child.title) ])
			]));

			if (isActive)
				activeNode = child;
		});

		if (ul.children.length == 0)
			return;

		container.appendChild(ul);
		container.style.display = '';
	},

	/* Mode menu: top-level sections (Status / Network / ...) */
	renderModeMenu(tree) {
		const ul = document.querySelector('#modemenu');
		const children = ui.menu.getChildren(tree);

		if (!ul)
			return;

		children.forEach((child, index) => {
			const isActive = L.env.requestpath.length
				? child.name === L.env.requestpath[0]
				: index === 0;

			ul.appendChild(E('li', { 'class': isActive ? 'active' : '' }, [
				E('a', { 'href': L.url(child.name) }, [ _(child.title) ])
			]));
		});

		if (ul.children.length > 0)
			ul.style.display = '';
	},

	/* ----- Sidebar drawer (mobile) ------------------------------- */

	initSidebarToggle() {
		const btn = document.querySelector('#mz-sidebar-toggle');
		const sidebar = document.querySelector('#mz-sidebar');
		const overlay = document.querySelector('#mz-overlay');

		if (!btn || !sidebar || !overlay)
			return;

		const setOpen = (open) => {
			sidebar.classList.toggle('is-open', open);
			overlay.hidden = !open;

			if (open) {
				requestAnimationFrame(() => overlay.classList.add('is-open'));
			} else {
				overlay.classList.remove('is-open');
			}

			btn.setAttribute('aria-expanded', open ? 'true' : 'false');
		};

		btn.addEventListener('click', () => {
			setOpen(!sidebar.classList.contains('is-open'));
		});

		overlay.addEventListener('click', () => setOpen(false));
	},

	/* ----- Color scheme ------------------------------------------ */

	initThemeToggle() {
		const btn = document.querySelector('#mz-theme-toggle');
		if (!btn)
			return;

		/* Cycle: system -> light -> dark -> system */
		btn.addEventListener('click', () => {
			const current = document.documentElement.getAttribute('data-theme') || 'system';
			const next = (current == 'system') ? 'light'
				: (current == 'light') ? 'dark' : 'system';

			this.applyTheme(next);
		});
	},

	applyTheme(mode) {
		if (mode == 'system') {
			const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
			document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
		} else {
			document.documentElement.setAttribute('data-theme', mode);
		}

		/* Persist the choice per browser (frontend-only override) */
		try {
			localStorage.setItem('mz-theme', mode);
		} catch (e) { /* private browsing */ }
	},

	/* ----- Logout ------------------------------------------------ */

	initLogout() {
		const link = document.querySelector('#mz-logout');
		if (!link)
			return;

		link.addEventListener('click', (ev) => {
			ev.preventDefault();
			L.ui.sessions ? L.ui.sessions.getLocal().then((s) => {
				if (s)
					fetch(L.url('admin/logout'), { method: 'POST' }).then(() => window.location.reload());
			}) : window.location.assign(L.url('admin/logout'));
		});
	}
});
