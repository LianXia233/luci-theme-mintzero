/*
 * mintzero - status overview enhancer
 * Copyright (C) 2026 LianXia233
 * Licensed to the public under the Apache License 2.0.
 *
 * Builds mintzero overview panels once, then patches live values in place
 * so LuCI XHR polls do not force a full DOM tear-down every few seconds.
 */
(function () {
	'use strict';

	var CIRC = 2 * Math.PI * 52;
	var REFRESH_MS = 5000;
	var started = false;
	var hideObserver = null;

	var HIDE_PREFIXES = [
		'内存', '存储', '端口状态', '网络', '系统', 'DHCP', '无线', 'DSL',
		'Memory', 'Storage', 'Ports', 'Switch', 'Network', 'System', 'Wireless',
		'UPnP', '端口映射', 'Active Connections'
	];

	function esc(s) {
		return String(s == null ? '' : s)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	}

	function titleStarts(h, prefixes) {
		if (!h) return false;
		var t = h.textContent.trim();
		for (var i = 0; i < prefixes.length; i++) {
			if (t.indexOf(prefixes[i]) === 0) return true;
		}
		return false;
	}

	function titleHas(h, prefixes) {
		if (!h) return false;
		var t = h.textContent.trim();
		for (var i = 0; i < prefixes.length; i++) {
			if (t.indexOf(prefixes[i]) >= 0) return true;
		}
		return false;
	}

	function findSection(prefixes, opts) {
		opts = opts || {};
		var found = null;
		document.querySelectorAll('#mz-view .cbi-section').forEach(function (sec) {
			if (found) return;
			var h = sec.querySelector('h2, h3, .cbi-section-title');
			if (!h) return;
			var ok = opts.contains ? titleHas(h, prefixes) : titleStarts(h, prefixes);
			if (!ok) return;
			var st = h.textContent.trim();
			if (opts.exclude && st.indexOf(opts.exclude) >= 0) return;
			found = sec;
		});
		return found;
	}

	function tableMap(tbl) {
		var map = {};
		tbl.querySelectorAll('tr').forEach(function (row) {
			var cells = row.querySelectorAll('td, th');
			if (cells.length < 2) return;
			var label = cells[0].textContent.trim();
			if (!label || (label in map)) return;
			var bar = cells[1].querySelector('.cbi-progressbar[title]');
			var val;
			if (bar) {
				val = bar.getAttribute('title');
			} else {
				var parts = [];
				for (var ci = 1; ci < cells.length; ci++)
					parts.push(cells[ci].textContent.trim());
				val = parts.join(' ');
			}
			map[label] = val.replace(/\s+/g, ' ').trim();
		});
		return map;
	}

	function pick(map) {
		for (var i = 1; i < arguments.length; i++) {
			if (map[arguments[i]]) return map[arguments[i]];
		}
		return '';
	}

	function parseBar(table) {
		var bars = table.querySelectorAll('.cbi-progressbar[title]');
		if (!bars.length) return null;
		var m = bars[0].getAttribute('title').match(
			/([\d.]+)\s*([A-Za-z]+)\s*\/\s*([\d.]+)\s*([A-Za-z]+)\s*\((\d+)%\)/
		);
		if (!m) return null;
		return {
			used: m[1],
			usedUnit: m[2],
			total: m[3],
			totalUnit: m[4],
			pct: parseInt(m[5], 10)
		};
	}

	function ringHtml(pct, cls, id) {
		pct = Math.max(0, Math.min(100, parseInt(pct, 10) || 0));
		var offset = CIRC * (1 - pct / 100);
		return '<svg class="mz-ring" viewBox="0 0 120 120" aria-hidden="true" data-mz-ring="' + esc(id) + '">' +
			'<circle class="mz-ring-bg" cx="60" cy="60" r="52"></circle>' +
			'<circle class="mz-ring-fg ' + esc(cls) + '" cx="60" cy="60" r="52" ' +
			'stroke-dasharray="' + CIRC + '" stroke-dashoffset="' + offset + '"></circle>' +
			'<text class="mz-ring-text" x="60" y="67" text-anchor="middle">' + pct + '%</text>' +
			'</svg>';
	}

	function setRing(root, id, pct) {
		var svg = root.querySelector('[data-mz-ring="' + id + '"]');
		if (!svg) return;
		pct = Math.max(0, Math.min(100, parseInt(pct, 10) || 0));
		var fg = svg.querySelector('.mz-ring-fg');
		var text = svg.querySelector('.mz-ring-text');
		if (fg) fg.setAttribute('stroke-dashoffset', String(CIRC * (1 - pct / 100)));
		if (text) text.textContent = pct + '%';
	}

	function setText(root, id, value) {
		var el = root.querySelector('[data-mz-id="' + id + '"]');
		if (!el) return;
		var next = value == null ? '' : String(value);
		if (el.textContent !== next) el.textContent = next;
	}

	function setHtml(root, id, html) {
		var el = root.querySelector('[data-mz-id="' + id + '"]');
		if (!el) return;
		if (el.getAttribute('data-mz-html') !== html) {
			el.innerHTML = html;
			el.setAttribute('data-mz-html', html);
		}
	}

	function collectCore(tables) {
		var info = tableMap(tables[0]);
		var cpuRaw = pick(info, 'CPU 使用率（%）', 'CPU 使用率', 'CPU usage');
		var cpuM = cpuRaw.match(/(\d+)/);
		var tempRaw = pick(info, '温度', 'Temperature');
		var tempM = tempRaw.match(/CPU:\s*([\d.]+)/);

		var mem = parseBar(tables[1]) || {
			used: '0', usedUnit: 'MiB', total: '0', totalUnit: 'MiB', pct: 0
		};
		var storage = parseBar(tables[2]) || {
			used: '0', usedUnit: 'MiB', total: '0', totalUnit: 'MiB', pct: 0
		};

		var memDetails = [];
		tables[1].querySelectorAll('tr').forEach(function (row) {
			var cells = row.querySelectorAll('td');
			if (cells.length < 2) return;
			var label = cells[0].textContent.trim();
			var bar = cells[1].querySelector('.cbi-progressbar[title]');
			var val = '';
			if (bar) {
				var m = bar.getAttribute('title').match(/([\d.]+\s*[A-Za-z]+)/);
				if (m) val = m[1];
			} else {
				val = cells[1].textContent.trim();
			}
			if (label && val) memDetails.push({ label: label, value: val });
		});

		var tempInfo = '';
		tables[2].querySelectorAll('tr').forEach(function (row) {
			if (row.textContent.indexOf('临时') >= 0) {
				var bar = row.querySelector('.cbi-progressbar[title]');
				if (bar) tempInfo = bar.getAttribute('title').replace(/\s*\(.*\)/, '');
			}
		});

		return {
			cpu: cpuM ? cpuM[1] : '0',
			temp: tempM ? tempM[1] : '',
			hostname: pick(info, '主机名', 'Hostname'),
			uptime: pick(info, '运行时间', 'Uptime'),
			load: pick(info, '平均负载', 'Load Average', 'Load'),
			model: pick(info, '型号', 'Model'),
			mem: mem,
			storage: storage,
			memDetails: memDetails,
			tempInfo: tempInfo
		};
	}

	function collectPorts(section) {
		var cards = [];
		if (!section) return cards;
		section.querySelectorAll('.ifacebox').forEach(function (box) {
			var heads = box.querySelectorAll('.ifacebox-head');
			var bodies = box.querySelectorAll('.ifacebox-body');
			var name = heads[0] ? heads[0].textContent.trim() : '';
			var statusText = bodies[0] ? bodies[0].textContent.trim() : '';
			var statusLower = statusText.toLowerCase();
			var isDown = !statusText ||
				statusText.indexOf('未连接') >= 0 ||
				statusLower.indexOf('no link') >= 0 ||
				statusLower.indexOf('not connected') >= 0 ||
				statusLower.indexOf('disconnected') >= 0 ||
				statusLower === 'down' ||
				statusLower.indexOf(' link down') >= 0;
			var isUp = !isDown;
			var speed = statusText || 'no link';
			var tx = '', rx = '';
			if (bodies[1]) {
				/* textContent works on display:none nodes; innerText does not */
				var t = bodies[1].textContent;
				var txm = t.match(/\u25b2\s*([\d.]+\s*[A-Za-z]+)/);
				var rxm = t.match(/\u25bc\s*([\d.]+\s*[A-Za-z]+)/);
				if (!txm) txm = t.match(/TX[:\s]*([\d.]+\s*[A-Za-z\/]+)/i);
				if (!rxm) rxm = t.match(/RX[:\s]*([\d.]+\s*[A-Za-z\/]+)/i);
				if (txm) tx = txm[1].trim();
				if (rxm) rx = rxm[1].trim();
			}
			var zones = [];
			box.querySelectorAll('.ifacebadge').forEach(function (b) {
				var zt = b.textContent.trim().replace(/\s+/g, ' ');
				if (zt) {
					zt = zt.replace(/:\s*$/, '').trim();
					if (zt && zones.indexOf(zt) < 0) zones.push(zt);
				}
			});
			cards.push({ name: name, speed: speed, isUp: isUp, tx: tx, rx: rx, zones: zones });
		});
		return cards;
	}

	var NET_KEEP = {
		'协议': true, '协议:': true, 'Protocol': true,
		'地址': true, '地址:': true, 'Address': true, 'IPv6-地址': true,
		'网关': true, '网关:': true, 'Gateway': true,
		'DNS': true, 'DNS:': true,
		'已连接': true, '已连接:': true, 'Connected': true,
		'剩余有效期': true, '剩余有效期:': true, 'Expires': true,
		'分发前缀': true, '分发前缀:': true, 'Prefix': true
	};

	function collectNet(section) {
		var cards = [];
		if (!section) return cards;
		section.querySelectorAll('.ifacebox').forEach(function (box) {
			var head = box.querySelector('.ifacebox-head');
			var title = head ? head.textContent.trim() : '';
			var body = box.querySelector('.ifacebox-body');
			var items = [];
			var seenDns = false;
			if (body) {
				body.querySelectorAll(':scope > .nowrap, :scope > * > .nowrap').forEach(function (nw) {
					var strong = nw.querySelector(':scope > strong');
					var label = strong ? strong.textContent.trim() : '';
					var value = nw.textContent.replace(label, '').trim();
					if (!label || !value) return;
					var key = label.replace(/[:：]\s*$/, '').trim();
					if (key.indexOf('DHCPv6') === 0) return;
					if (key === 'DNS' || key.indexOf('DNS') === 0) {
						if (seenDns) return;
						seenDns = true;
						key = 'DNS';
					} else if (key === '分发前缀') {
						key = '前缀';
					} else if (key === '剩余有效期') {
						key = '有效期';
					}
					if (NET_KEEP[key]) {
						if (value.length > 48) value = value.substring(0, 46) + '…';
						items.push({ label: key, value: value });
					}
				});
			}
			cards.push({ title: title, items: items });
		});
		return cards;
	}

	function collectSys(section) {
		var items = [];
		if (!section) return items;
		section.querySelectorAll('table tr').forEach(function (row) {
			var cells = row.querySelectorAll('td');
			if (cells.length < 2) return;
			var label = cells[0].textContent.trim();
			var value = cells[1].textContent.trim();
			if (label && value && label !== '?') items.push({ label: label, value: value });
		});
		return items;
	}

	function collectDhcp(section) {
		var tables = [];
		if (!section) return tables;
		section.querySelectorAll('table').forEach(function (t, ti) {
			var rows = t.querySelectorAll('tr');
			if (rows.length <= 1) {
				tables.push({ empty: ti === 0 ? '暂无 IPv4 租约' : '暂无 IPv6 租约' });
				return;
			}
			var headers = [];
			rows[0].querySelectorAll('th').forEach(function (th, ci) {
				if (ci < 5) headers.push(th.textContent.trim());
			});
			var body = [];
			for (var ri = 1; ri < rows.length; ri++) {
				var cells = rows[ri].querySelectorAll('td');
				if (cells.length < 2) continue;
				var row = [];
				for (var ci = 0; ci < Math.min(cells.length, 5); ci++)
					row.push(cells[ci].textContent.trim());
				body.push(row);
			}
			tables.push({ headers: headers, rows: body });
		});
		return tables;
	}

	function collectWifi(section) {
		var radios = [];
		var stations = null;
		if (!section) return { radios: radios, stations: stations };

		section.querySelectorAll('.ifacebox').forEach(function (box) {
			var name = box.querySelector('.ifacebox-head')
				? box.querySelector('.ifacebox-head').textContent.trim() : '';
			var body = box.querySelector('.ifacebox-body');
			var info = {};
			if (body) {
				body.querySelectorAll('.nowrap').forEach(function (nw) {
					var strong = nw.querySelector('strong');
					var label = strong ? strong.textContent.trim().replace(/:$/, '') : '';
					var value = nw.textContent.replace(strong ? strong.textContent : '', '').trim();
					if (label) info[label] = value;
				});
			}
			radios.push({ name: name, info: info });
		});

		var wifiTable = section.querySelector('table');
		if (wifiTable) {
			var rows = wifiTable.querySelectorAll('tr');
			if (rows.length > 1) {
				var headers = [];
				var body = [];
				var ths = rows[0].querySelectorAll('th');
				for (var hi = 0; hi < Math.min(ths.length, 5); hi++)
					headers.push(ths[hi].textContent.trim().substring(0, 12));
				for (var ri = 1; ri < rows.length; ri++) {
					var cells = rows[ri].querySelectorAll('td');
					if (cells.length < 2) continue;
					var row = [];
					for (var ci = 0; ci < Math.min(cells.length, 5); ci++)
						row.push(cells[ci].textContent.trim().substring(0, 25));
					body.push(row);
				}
				stations = { headers: headers, rows: body };
			}
		}
		return { radios: radios, stations: stations };
	}

	function collectUpnp(section) {
		if (!section) return { empty: true };
		var table = section.querySelector('table');
		if (!table) return { empty: true };
		var rows = table.querySelectorAll('tr');
		if (rows.length <= 1 || (rows.length === 2 && rows[1].textContent.indexOf('没有') >= 0))
			return { empty: true };
		var headers = [];
		rows[0].querySelectorAll('th').forEach(function (th, ci) {
			if (ci < 6) headers.push(th.textContent.trim().substring(0, 10));
		});
		var body = [];
		for (var ri = 1; ri < rows.length; ri++) {
			var cells = rows[ri].querySelectorAll('td');
			if (cells.length < 2) continue;
			var row = [];
			for (var ci = 0; ci < Math.min(cells.length, 6); ci++)
				row.push(cells[ci].textContent.trim());
			body.push(row);
		}
		return { headers: headers, rows: body };
	}

	function dataTableHtml(headers, rows) {
		var html = '<div class="mz-table-card"><table class="mz-data-table"><thead><tr>';
		headers.forEach(function (h) { html += '<th>' + esc(h) + '</th>'; });
		html += '</tr></thead><tbody>';
		rows.forEach(function (row) {
			html += '<tr>';
			row.forEach(function (c) { html += '<td>' + esc(c) + '</td>'; });
			html += '</tr>';
		});
		html += '</tbody></table></div>';
		return html;
	}

	function portsHtml(cards) {
		return '<h3 class="mz-section-title">端口状态</h3><div class="mz-port-grid">' +
			cards.map(function (p) {
				return '<div class="mz-port-card' + (p.isUp ? ' up' : ' down') + '">' +
					'<div class="mz-port-name">' + esc(p.name) + '</div>' +
					'<div class="mz-port-status">' +
					(p.isUp
						? '<span class="mz-port-dot up"></span> '
						: '<span class="mz-port-dot down"></span> ') +
					esc(p.speed) + '</div>' +
					(p.zones.length
						? '<div class="mz-port-zones">' + esc(p.zones.join(', ')) + '</div>'
						: '') +
					((p.tx || p.rx)
						? '<div class="mz-port-traffic">' +
							(p.tx ? '<span class="mz-tx">▲ ' + esc(p.tx) + '</span>' : '') +
							(p.rx ? '<span class="mz-rx">▼ ' + esc(p.rx) + '</span>' : '') +
							'</div>'
						: '') +
					'</div>';
			}).join('') + '</div>';
	}

	function netHtml(cards) {
		return '<h3 class="mz-section-title">网络</h3><div class="mz-net-grid">' +
			cards.map(function (n) {
				return '<div class="mz-net-card">' +
					'<div class="mz-net-header">' + esc(n.title) + '</div>' +
					'<div class="mz-net-body">' +
					n.items.map(function (it) {
						return '<div class="mz-net-row"><span class="mz-net-label">' +
							esc(it.label) + '</span><span class="mz-net-value" title="' +
							esc(it.value) + '">' + esc(it.value) + '</span></div>';
					}).join('') +
					'</div></div>';
			}).join('') + '</div>';
	}

	function sysHtml(items) {
		return '<h3 class="mz-section-title">系统信息</h3><div class="mz-sys-grid">' +
			items.map(function (it) {
				return '<div class="mz-sys-item"><span class="mz-sys-label">' +
					esc(it.label) + '</span><span class="mz-sys-value">' +
					esc(it.value) + '</span></div>';
			}).join('') + '</div>';
	}

	function dhcpHtml(tables) {
		var html = '<h3 class="mz-section-title">DHCP 租约</h3>';
		tables.forEach(function (t) {
			if (t.empty) {
				html += '<div class="mz-empty-state">' + esc(t.empty) + '</div>';
			} else {
				html += dataTableHtml(t.headers, t.rows);
			}
		});
		return html;
	}

	function wifiHtml(data) {
		var html = '<h3 class="mz-section-title">无线</h3><div class="mz-wifi-radios">';
		data.radios.forEach(function (r) {
			var enc = r.info['加密'] ? String(r.info['加密']).substring(0, 15) : '-';
			html += '<div class="mz-wifi-card">' +
				'<div class="mz-wifi-name">' + esc(r.info['SSID'] || r.name) + '</div>' +
				'<div class="mz-wifi-sub">' + esc(r.name) + ' · ' +
				esc(r.info['信道'] || '') + ' · ' + esc(r.info['速率'] || '') + '</div>' +
				'<div class="mz-wifi-stats">' +
				'<span><strong>' + esc(r.info['关联数'] || '0') + '</strong> 已连接</span>' +
				'<span><strong>' + esc(enc) + '</strong></span>' +
				'</div></div>';
		});
		html += '</div>';
		if (data.stations) {
			html += '<h4 class="mz-subtitle">已连接站点</h4>' +
				dataTableHtml(data.stations.headers, data.stations.rows);
		}
		return html;
	}

	function upnpHtml(data) {
		var html = '<h3 class="mz-section-title">UPnP 端口映射</h3>';
		if (data.empty)
			return html + '<div class="mz-empty-state">当前没有生效的端口映射</div>';
		return html + dataTableHtml(data.headers, data.rows);
	}

	function ensurePanel(view, cls, afterEl) {
		var el = view.querySelector('.' + cls);
		if (el) return el;
		el = document.createElement('div');
		el.className = cls;
		if (afterEl && afterEl.parentNode === view)
			view.insertBefore(el, afterEl.nextSibling);
		else
			view.appendChild(el);
		return el;
	}

	function removePanel(view, cls) {
		var el = view.querySelector('.' + cls);
		if (el) el.parentNode.removeChild(el);
	}

	function patchPanel(el, html) {
		if (!el) return;
		if (el.getAttribute('data-mz-html') === html) return;
		el.innerHTML = html;
		el.setAttribute('data-mz-html', html);
	}

	function buildCoreHtml(core) {
		return '<div class="mz-info-cards">' +
			'<div class="mz-info-card"><div class="mz-info-label">设备</div>' +
			'<div class="mz-info-value" data-mz-id="hostname">' + esc(core.hostname) + '</div></div>' +
			'<div class="mz-info-card"><div class="mz-info-label">运行时间</div>' +
			'<div class="mz-info-value" data-mz-id="uptime">' + esc(core.uptime) + '</div></div>' +
			'<div class="mz-info-card"><div class="mz-info-label">平均负载</div>' +
			'<div class="mz-info-value" data-mz-id="load">' + esc(core.load) + '</div></div>' +
			'<div class="mz-info-card"><div class="mz-info-label">型号</div>' +
			'<div class="mz-info-value" data-mz-id="model">' + esc(core.model) + '</div></div>' +
			'</div>' +
			'<div class="mz-rings">' +
			'<div class="mz-ring-card">' + ringHtml(core.cpu, 'mz-ring-cpu', 'cpu') +
			'<div class="mz-ring-info"><div class="mz-ring-title">CPU</div>' +
			'<div class="mz-ring-sub" data-mz-id="temp"' + (core.temp ? '' : ' hidden') + '>' +
			(core.temp ? ('温度 ' + esc(core.temp) + '°C') : '') + '</div></div></div>' +
			'<div class="mz-ring-card">' + ringHtml(core.mem.pct, 'mz-ring-mem', 'mem') +
			'<div class="mz-ring-info"><div class="mz-ring-title">内存</div>' +
			'<div class="mz-ring-pct" data-mz-id="mem-pct">' +
			esc(core.mem.used) + ' / ' + esc(core.mem.total) + ' ' + esc(core.mem.totalUnit) +
			'</div>' +
			'</div></div>' +
			'<div class="mz-ring-card">' + ringHtml(core.storage.pct, 'mz-ring-storage', 'storage') +
			'<div class="mz-ring-info"><div class="mz-ring-title">存储</div>' +
			'<div class="mz-ring-pct" data-mz-id="storage-pct">' +
			esc(core.storage.used) + ' / ' + esc(core.storage.total) + ' ' + esc(core.storage.totalUnit) +
			'</div>' +
			'<div class="mz-ring-sub" data-mz-id="temp-info"' + (core.tempInfo ? '' : ' hidden') + '>' +
			(core.tempInfo ? ('临时 ' + esc(core.tempInfo)) : '') + '</div></div></div>' +
			'</div>';
	}

	function patchCore(panel, core) {
		setText(panel, 'hostname', core.hostname);
		setText(panel, 'uptime', core.uptime);
		setText(panel, 'load', core.load);
		setText(panel, 'model', core.model);
		setRing(panel, 'cpu', core.cpu);
		setRing(panel, 'mem', core.mem.pct);
		setRing(panel, 'storage', core.storage.pct);
		setText(panel, 'mem-pct',
			core.mem.used + ' / ' + core.mem.total + ' ' + core.mem.totalUnit);
		setText(panel, 'storage-pct',
			core.storage.used + ' / ' + core.storage.total + ' ' + core.storage.totalUnit);

		var tempEl = panel.querySelector('[data-mz-id="temp"]');
		if (tempEl) {
			if (core.temp) {
				tempEl.hidden = false;
				tempEl.textContent = '温度 ' + core.temp + '°C';
			} else {
				tempEl.hidden = true;
				tempEl.textContent = '';
			}
		}

		var tempInfoEl = panel.querySelector('[data-mz-id="temp-info"]');
		if (tempInfoEl) {
			if (core.tempInfo) {
				tempInfoEl.hidden = false;
				tempInfoEl.textContent = '临时 ' + core.tempInfo;
			} else {
				tempInfoEl.hidden = true;
				tempInfoEl.textContent = '';
			}
		}

	}

	function hideOriginalSections() {
		document.querySelectorAll('#mz-view .cbi-section').forEach(function (sec) {
			if (sec.classList.contains('mz-hidden-section')) return;
			var h = sec.querySelector('h2, h3, .cbi-section-title');
			if (!h) return;
			var txt = h.textContent.trim();
			for (var i = 0; i < HIDE_PREFIXES.length; i++) {
				var p = HIDE_PREFIXES[i];
				if (txt.indexOf(p) === 0 || (p.length > 3 && txt.indexOf(p) >= 0 &&
					(p === 'UPnP' || p === '端口映射' || p === 'Active Connections'))) {
					sec.classList.add('mz-hidden-section');
					return;
				}
			}
		});
	}

	function refreshOverview() {
		if (document.body.getAttribute('data-page') !== 'admin-status-overview')
			return false;

		var view = document.getElementById('mz-view');
		if (!view) return false;

		var tables = view.querySelectorAll('table.table');
		if (tables.length < 3) return false;

		var core = collectCore(tables);
		var panel = view.querySelector('.mz-overview-panel');
		if (!panel) {
			panel = document.createElement('div');
			panel.className = 'mz-overview-panel';
			panel.innerHTML = buildCoreHtml(core);
			view.insertBefore(panel, view.firstChild);
		} else {
			patchCore(panel, core);
		}

		var cursor = panel;
		var ports = collectPorts(findSection(['端口状态', 'Ports', 'Switch']));
		if (ports.length) {
			var portPanel = ensurePanel(view, 'mz-port-panel', cursor);
			patchPanel(portPanel, portsHtml(ports));
			cursor = portPanel;
		} else {
			removePanel(view, 'mz-port-panel');
		}

		var nets = collectNet(findSection(['网络', 'Network']));
		if (nets.length) {
			var netPanel = ensurePanel(view, 'mz-net-panel', cursor);
			patchPanel(netPanel, netHtml(nets));
			cursor = netPanel;
		} else {
			removePanel(view, 'mz-net-panel');
		}

		var sysSec = null;
		document.querySelectorAll('#mz-view .cbi-section').forEach(function (sec) {
			var h = sec.querySelector('h2, h3');
			var st = h ? h.textContent.trim() : '';
			if (h && titleStarts(h, ['系统', 'System']) &&
				st.indexOf('端口') < 0 && st.indexOf('Ports') < 0)
				sysSec = sec;
		});
		var sysItems = collectSys(sysSec);
		if (sysItems.length) {
			var sysPanel = ensurePanel(view, 'mz-sys-panel', cursor);
			patchPanel(sysPanel, sysHtml(sysItems));
			cursor = sysPanel;
		} else {
			removePanel(view, 'mz-sys-panel');
		}

		var dhcp = collectDhcp(findSection(['DHCP']));
		if (dhcp.length) {
			var dhcpPanel = ensurePanel(view, 'mz-dhcp-panel', cursor);
			patchPanel(dhcpPanel, dhcpHtml(dhcp));
			cursor = dhcpPanel;
		} else {
			removePanel(view, 'mz-dhcp-panel');
		}

		var wifi = collectWifi(findSection(['无线', 'Wireless']));
		if (wifi.radios.length || wifi.stations) {
			var wifiPanel = ensurePanel(view, 'mz-wifi-panel', cursor);
			patchPanel(wifiPanel, wifiHtml(wifi));
			cursor = wifiPanel;
		} else {
			removePanel(view, 'mz-wifi-panel');
		}

		var upnpSec = findSection(['UPnP', '端口映射', 'Active Connections'], { contains: true });
		if (upnpSec) {
			var upnpPanel = ensurePanel(view, 'mz-upnp-panel', cursor);
			patchPanel(upnpPanel, upnpHtml(collectUpnp(upnpSec)));
		} else {
			removePanel(view, 'mz-upnp-panel');
		}

		hideOriginalSections();
		return true;
	}

	function watchHiddenSections() {
		var view = document.getElementById('mz-view');
		if (!view || hideObserver) return;
		hideObserver = new MutationObserver(function () {
			hideOriginalSections();
		});
		hideObserver.observe(view, { childList: true, subtree: true });
	}

	function initMenu() {
		var topLi = document.querySelector('#mainmenu > li');
		if (topLi) {
			var topUl = topLi.querySelector(':scope > ul');
			if (topUl) {
				while (topUl.firstChild)
					topLi.parentNode.insertBefore(topUl.firstChild, topLi);
			}
			topLi.parentNode.removeChild(topLi);
		}

		document.querySelectorAll('#mainmenu > li').forEach(function (li) {
			var sub = li.querySelector(':scope > ul');
			if (!sub) return;
			li.classList.add('mz-menu-group');
			var a = li.querySelector(':scope > a');
			if (!a) return;
			var label = a.textContent.trim();
			var hasActive = sub.querySelector('.active, li.active > a, a.active') !== null;
			var stored = null;
			try { stored = localStorage.getItem('mz-nav-' + label); } catch (err) {}
			var collapsed = stored !== null ? stored === '1' : !hasActive;
			if (collapsed) {
				li.classList.add('mz-collapsed');
				sub.style.display = 'none';
			}
			a.addEventListener('click', function (e) {
				e.preventDefault();
				var nowCollapsed = li.classList.toggle('mz-collapsed');
				sub.style.display = nowCollapsed ? 'none' : '';
				try {
					localStorage.setItem('mz-nav-' + label, nowCollapsed ? '1' : '0');
				} catch (err) {}
			});
		});

		var mm = document.getElementById('mainmenu');
		if (mm) mm.classList.add('mz-menu-ready');
	}

	function boot() {
		var menuDone = false;
		var overviewReady = false;

		function tryMenu() {
			if (menuDone) return;
			var mm = document.getElementById('mainmenu');
			if (mm && mm.children.length > 0) {
				menuDone = true;
				try { initMenu(); } catch (err) {}
			}
		}

		function tryOverview() {
			if (document.body.getAttribute('data-page') !== 'admin-status-overview') {
				overviewReady = true;
				return;
			}
			if (refreshOverview()) {
				if (!overviewReady) {
					overviewReady = true;
					watchHiddenSections();
					if (!started) {
						started = true;
						setInterval(function () {
							try { refreshOverview(); } catch (err) {}
						}, REFRESH_MS);
					}
				}
			}
		}

		function tick() {
			tryMenu();
			tryOverview();
			if (menuDone && overviewReady) return true;
			return false;
		}

		if (tick()) return;

		var observer = new MutationObserver(function () {
			if (tick()) observer.disconnect();
		});
		var mm = document.getElementById('mainmenu');
		var view = document.getElementById('mz-view');
		if (mm) observer.observe(mm, { childList: true, subtree: true });
		if (view) observer.observe(view, { childList: true, subtree: true });
		setTimeout(function () { observer.disconnect(); }, 20000);
	}

	if (document.readyState === 'loading')
		document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 800); });
	else
		setTimeout(boot, 800);

	/* ==== Apply feedback: success / revert notifications ====
	   LuCSI closes the apply modal without any success message; listen
	   for the uci-applied / uci-reverted events and surface one. */
	function mzNotify(msg, cls) {
		try {
			var box = document.createElement('div');
			box.className = 'alert-message mz-apply-success ' + (cls || 'success');
			box.setAttribute('role', 'alert');
			var p = document.createElement('p');
			p.style.margin = '0';
			p.textContent = msg;
			box.appendChild(p);
			var main = document.getElementById('maincontent') || document.body;
			main.insertBefore(box, main.firstChild);
			box.classList.add('fade-in');
			setTimeout(function () {
				box.style.transition = 'opacity .4s';
				box.style.opacity = '0';
				setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, 450);
			}, 6000);
		} catch (err) {}
	}

	document.addEventListener('uci-applied', function () {
		try { sessionStorage.setItem('mz-apply-ok', String(Date.now())); } catch (err) {}
		mzNotify('配置已成功应用。', 'success');
	});

	document.addEventListener('uci-reverted', function () {
		mzNotify('已回滚到最近保存的配置。', 'notice');
	});

	/* LuCSI reloads the page right after a successful apply, which would
	   swallow the notification - replay it once on the fresh page. */
	try {
		var ts = parseInt(sessionStorage.getItem('mz-apply-ok'), 10);
		if (ts && (Date.now() - ts) < 30000) {
			sessionStorage.removeItem('mz-apply-ok');
			setTimeout(function () { mzNotify('配置已成功应用。', 'success'); }, 600);
		}
	} catch (err) {}

	/* ==== cbi-dynlist edit/delete affordances ====
	   LuCSI dynlists have no visible edit or delete controls: delete is
	   bound to an invisible ::after hotspot and in-place editing does
	   not exist. Inject explicit edit/delete buttons per item. */
	function mzDlFireChange(dl) {
		dl.dispatchEvent(new CustomEvent('cbi-dynlist-change', {
			bubbles: true,
			detail: { value: '', add: true }
		}));
	}

	function mzDlStartEdit(item) {
		if (item.querySelector('.mz-dl-edit-input'))
			return;
		var hidden = item.querySelector('input[type="hidden"]');
		var span = item.querySelector('span');
		if (!hidden || !span)
			return;
		var old = hidden.value;
		var input = document.createElement('input');
		input.type = 'text';
		input.className = 'cbi-input-text mz-dl-edit-input';
		input.value = old;
		span.style.display = 'none';
		item.insertBefore(input, span);

		var commit = function () {
			var v = input.value.trim();
			input.parentNode.removeChild(input);
			span.style.display = '';
			if (!v || v === old)
				return;
			var dl = item.closest('.cbi-dynlist');
			var inst = null;
			try { inst = L.dom.findClassInstance(dl); } catch (err) {}
			if (inst && typeof inst.removeItem === 'function' && typeof inst.addItem === 'function') {
				inst.removeItem(dl, item);
				inst.addItem(dl, v, null, true);
			} else {
				span.textContent = v;
				hidden.value = v;
				if (dl)
					mzDlFireChange(dl);
			}
		};

		input.addEventListener('keydown', function (ev) {
			if (ev.key === 'Enter') {
				ev.preventDefault();
				commit();
			} else if (ev.key === 'Escape') {
				input.parentNode.removeChild(input);
				span.style.display = '';
			}
		});
		input.addEventListener('blur', commit);
		input.focus();
		input.select();
	}

	function mzDlAttach(item) {
		if (item.querySelector('.mz-dl-actions'))
			return;
		var actions = document.createElement('div');
		actions.className = 'mz-dl-actions';

		var edit = document.createElement('button');
		edit.type = 'button';
		edit.className = 'mz-dl-btn mz-dl-edit';
		edit.textContent = '✎';
		edit.setAttribute('aria-label', '编辑');
		edit.addEventListener('click', function (ev) {
			ev.preventDefault();
			ev.stopPropagation();
			mzDlStartEdit(item);
		});

		var del = document.createElement('button');
		del.type = 'button';
		del.className = 'mz-dl-btn mz-dl-del';
		del.textContent = '✕';
		del.setAttribute('aria-label', '删除');
		del.addEventListener('click', function (ev) {
			ev.preventDefault();
			ev.stopPropagation();
			var dl = item.closest('.cbi-dynlist');
			var inst = null;
			try { inst = L.dom.findClassInstance(dl); } catch (err) {}
			if (inst && typeof inst.removeItem === 'function') {
				inst.removeItem(dl, item);
			} else {
				item.parentNode.removeChild(item);
				if (dl)
					mzDlFireChange(dl);
			}
		});

		actions.appendChild(edit);
		actions.appendChild(del);
		item.appendChild(actions);
	}

	function mzDlEnhance(root) {
		(root || document).querySelectorAll('.cbi-dynlist').forEach(function (dl) {
			dl.querySelectorAll(':scope > .item').forEach(mzDlAttach);
		});
	}

	var mzDlObserver = new MutationObserver(function () {
		mzDlEnhance(document);
	});
	document.addEventListener('DOMContentLoaded', function () {
		mzDlEnhance(document);
		mzDlObserver.observe(document.body, { childList: true, subtree: true });
	});
})();
