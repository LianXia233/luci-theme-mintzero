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

/* Pure-SVG sparkline for live traffic. Fixed ring buffer, no libraries. */
function sparkline(series, color) {
	const W = 280, H = 48, N = 60;
	const max = Math.max.apply(null, series.concat([1]));

	let pts = '';
	for (let i = 0; i < series.length; i++) {
		const x = (i / (N - 1)) * W;
		const y = H - (series[i] / max) * (H - 4) - 2;
		pts += (i ? ' L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
	}

	return E('svg', {
		'viewBox': '0 0 %d %d'.format(W, H),
		'class': 'mz-spark',
		'aria-hidden': 'true',
		'stroke': color,
		'fill': 'none'
	}, E('path', { 'd': pts + (series.length ? ' L%d %d L0 %d Z'.format(W, H, H) : '') }));
}

return view.extend({
	state: {
		down: [],
		up: []
	},

	load() {
		return Promise.all([
			L.resolveDefault(callSystemBoard(), {}),
			L.resolveDefault(callSystemInfo(), {}),
			L.resolveDefault(callLuciVersion(), {}),
			uci.load('luci').catch(() => {})
		]);
	},

	pollData() {
		return Promise.all([
			L.resolveDefault(callSystemInfo(), {})
		]).then((data) => this.updateCards(data[0]));
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

		set('mz-dash-memory', memPct != null ? '%s (%s / %s)'.format(memPct, fmtBytes(memUsed), fmtBytes(mem.total)) : null);
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

			card(_('Resources'), E('div', {}, [
				kv([
					_('Memory Usage'), null,
					_('Load Average'), null,
					_('Uptime'), null
				]),
				E('div', { 'id': 'mz-dash-memory' }, E('em', { 'class': 'spinning' }, _('Collecting data...'))),
				E('div', { 'id': 'mz-dash-load' }),
				E('div', { 'id': 'mz-dash-uptime' })
			])),

			card(_('Traffic'), E('div', { 'class': 'mz-traffic' }, [
				E('div', { 'class': 'mz-traffic-row' }, [
					E('span', { 'class': 'mz-traffic-label mz-traffic-down' }, _('Download')),
					E('span', { 'id': 'mz-traffic-down-now', 'class': 'mz-traffic-now' }, E('em', {}, _('N/A')))
				]),
				E('div', { 'id': 'mz-traffic-down-graph' }, [ this.renderGraph('down') ]),
				E('div', { 'class': 'mz-traffic-row' }, [
					E('span', { 'class': 'mz-traffic-label mz-traffic-up' }, _('Upload')),
					E('span', { 'id': 'mz-traffic-up-now', 'class': 'mz-traffic-now' }, E('em', {}, _('N/A')))
				]),
				E('div', { 'id': 'mz-traffic-up-graph' }, [ this.renderGraph('up') ]),
				E('p', { 'class': 'mz-traffic-note' },
					_('Live traffic requires a statistics source (e.g. luci-mod-dashboard or nlbwmon). Without it, values show N/A.'))
			])),

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

	renderGraph(kind) {
		return sparkline(this.state[kind], kind == 'down' ? '#4f6ef7' : '#2f9e6e');
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
