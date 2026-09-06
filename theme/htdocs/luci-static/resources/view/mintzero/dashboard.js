// mintzero dashboard overview
// Copyright (C) 2026 LianXia233
// Licensed to the public under the Apache License 2.0.
//
// A real-data dashboard rendered on admin/status/overview style pages is
// owned by luci-mod-status; this view provides an OPTIONAL mintzero landing
// page registered at admin/mintzero/dashboard. All numbers come from
// standard ubus/rpcd endpoints - no mock data. Values that the platform
// cannot provide render as N/A (never faked 0).

'use strict';
'require view';
'require dom';
'require poll';
'require rpc';
'require uci';

var callSystemBoard = rpc.declare({
	object: 'system',
	method: 'board'
});

var callSystemInfo = rpc.declare({
	object: 'system',
	method: 'info'
});

var callLuciVersion = rpc.declare({
	object: 'luci',
	method: 'getVersion'
});

function na(v) {
	return (v == null || v === '') ? E('em', {}, _('N/A')) : v;
}

function fmtBytes(n) {
	return (n != null) ? '%1024.2mB'.format(n) : E('em', {}, _('N/A'));
}

function fmtUptime(s) {
	return (s > 0) ? '%t'.format(s) : E('em', {}, _('N/A'));
}

function card(title, body) {
	return E('div', { 'class': 'mz-card' }, [
		E('h3', { 'class': 'mz-card-title' }, title),
		E('div', { 'class': 'mz-card-body' }, body)
	]);
}

function kv(pairs) {
	const table = E('table', { 'class': 'table' });

	for (let i = 0; i < pairs.length; i += 2) {
		table.appendChild(E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td left', 'width': '40%' }, [ pairs[i] ]),
			E('td', { 'class': 'td left' }, [ na(pairs[i + 1]) ])
		]));
	}

	return table;
}

function loadPercent(v, max) {
	return (max > 0 && v != null) ? '%.1f%%'.format(100 * v / max) : null;
}

return view.extend({
	load() {
		return Promise.all([
			L.resolveDefault(callSystemBoard(), {}),
			L.resolveDefault(callSystemInfo(), {}),
			L.resolveDefault(callLuciVersion(), {}),
			uci.load('luci').catch(() => {})
		]);
	},

	updateCards(info) {
		const mem = info.memory ?? {};
		const load = Array.isArray(info.load) ? info.load : [];
		const memUsed = (mem.total && mem.free != null) ? mem.total - mem.free : null;
		const memPct = loadPercent(memUsed, mem.total);
		const load1 = load.length ? load[0] / 65535.0 : null;

		const set = (id, v) => {
			const el = document.getElementById(id);
			if (el)
				dom.content(el, na(v));
		};

		set('mz-dash-memory', memPct != null
			? '%s (%s / %s)'.format(memPct, fmtBytes(memUsed), fmtBytes(mem.total))
			: null);
		set('mz-dash-load', load1 != null ? '%.2f'.format(load1) : null);
		set('mz-dash-uptime', fmtUptime(info.uptime));
	},

	render(data) {
		const [board, info, luciver] = data;
		const rel = board.release ?? {};

		const grid = E('div', { 'class': 'mz-dash-grid' }, [
			card(_('System'), kv([
				_('Hostname'), board.hostname,
				_('Model'), board.model,
				_('Firmware Version'), rel.description ?? null,
				_('Kernel Version'), board.kernel
			])),

			card(_('Resources'), (() => {
				const t = E('table', { 'class': 'table' });
				const row = (label, id) => t.appendChild(E('tr', { 'class': 'tr' }, [
					E('td', { 'class': 'td left', 'width': '40%' }, [label]),
					E('td', { 'class': 'td left', 'id': id },
						[E('em', { 'class': 'spinning' }, _('Collecting data...'))])
				]));
				row(_('Memory Usage'), 'mz-dash-memory');
				row(_('Load Average'), 'mz-dash-load');
				row(_('Uptime'), 'mz-dash-uptime');
				return t;
			})()),

			card(_('Software'), kv([
				_('LuCI Version'), (luciver.branch ?? '') + ' ' + (luciver.revision ?? ''),
				_('Target Platform'), rel.target ?? null
			]))
		]);

		/* Initial fill + polling (partial DOM updates only) */
		this.updateCards(info);

		poll.add(L.bind(function() {
			return L.resolveDefault(callSystemInfo(), {}).then(L.bind(this.updateCards, this));
		}, this), 5);

		return grid;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
