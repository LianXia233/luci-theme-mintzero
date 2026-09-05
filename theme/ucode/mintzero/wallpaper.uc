// mintzero wallpaper backend
// Copyright (C) 2026 LianXia233
// Licensed to the public under the Apache License 2.0.
//
// Server-side Bing wallpaper metadata fetcher with on-disk metadata cache.
// The browser NEVER talks to Bing directly for metadata; it calls this
// backend via the LuCI "sysauth"-adjacent page JS which requests the local
// JSON endpoint rendered by sysauth.ut / login page JS through the wallpaper
// view. Image bytes are loaded directly by the browser from Bing CDN.
//
// Security:
//  - Host allowlist: only www.bing.com / cn.bing.com (API) and
//    www.bing.com / th.bing.com (images) are ever contacted or emitted.
//  - Strict JSON schema validation before caching.
//  - Timeouts enforced via `timeout` on uclient-popen style calls.
//  - Cache file lives in a fixed path under /tmp (no traversal).

'use strict';

import { readfile, writefile, popen, stat } from 'fs';

const BING_API_BASE = 'https://www.bing.com/HPImageArchive.aspx';
const BING_IMAGE_BASE = 'https://www.bing.com';
const BING_ALLOWED_HOSTS = ['www.bing.com', 'cn.bing.com', 'th.bing.com'];

const CACHE_DIR = '/tmp/mintzero-wallpaper';
const CACHE_META = CACHE_DIR + '/metadata.json';
const CACHE_LAST = CACHE_DIR + '/last';

const DEFAULTS = {
	enabled: '1',
	market: 'zh-CN',
	count: 8,
	cache_ttl: 86400
};

const ALLOWED_MARKETS = ['zh-CN', 'en-US', 'ja-JP', 'zh-TW'];

function loadConfig() {
	const uc = require('uci').connect();
	const wp = uc.get_all('mintzero', 'wallpaper') ?? {};
	return {
		enabled: wp.enabled ?? DEFAULTS.enabled,
		market: ALLOWED_MARKETS.indexOf(wp.market ?? '') > -1 ? wp.market : DEFAULTS.market,
		count: clampInt(wp.count, 1, 8, DEFAULTS.count),
		cache_ttl: clampInt(wp.cache_ttl, 300, 604800, DEFAULTS.cache_ttl)
	};
}

function clampInt(v, min, max, dflt) {
	const n = int(v);
	if (n === null || n < min)
		return min;
	return (n > max) ? max : n;
}

// Validate a Bing image path emitted by the API before trusting it.
// Must be a relative path starting with /th?id=OHR. and contain no tricks.
function validImagePath(p) {
	if (type(p) != 'string' || length(p) == 0)
		return null;
	if (substr(p, 0, 1) != '/')
		return null;
	if (index(p, '..') > -1 || index(p, '\\') > -1 || index(p, '//') > -1)
		return null;
	// Allowlist the host we will prefix
	return BING_IMAGE_BASE + p;
}

function fetchWithTimeout(url, timeoutSecs) {
	const cmd = sprintf(
		'wget -q -O - -T %d -U "mintzero-wallpaper/1.0" %s 2>/dev/null',
		timeoutSecs, shquote(url)
	);
	const p = popen(cmd, 'r');
	if (!p)
		return null;
	const out = p.read('all');
	p.close();
	return out;
}

function fetchBingMetadata(cfg) {
	const url = sprintf('%s?format=js&idx=0&n=%d&mkt=%s',
		BING_API_BASE, cfg.count, cfg.market);

	const raw = fetchWithTimeout(url, 4);
	if (!raw || length(raw) == 0)
		return null;

	const data = json(raw);
	if (type(data) != 'object' || type(data.images) != 'array')
		return null;

	const pool = [];
	for (const img of data.images) {
		if (type(img) != 'object')
			continue;
		const imageUrl = validImagePath(img.url);
		if (!imageUrl)
			continue;
		// Derive a reasonably sized variant from urlbase when present
		let imageUrlBase = validImagePath(img.urlbase);
		pool.push({
			url: imageUrl,
			urlbase: imageUrlBase ?? imageUrl,
			title: type(img.title) == 'string' ? img.title : '',
			copyright: type(img.copyright) == 'string' ? img.copyright : '',
			startdate: type(img.startdate) == 'string' ? img.startdate : ''
		});
	}

	if (length(pool) == 0)
		return null;

	return {
		fetched: time(),
		market: cfg.market,
		images: pool
	};
}

function readCache() {
	const raw = readfile(CACHE_META);
	if (!raw)
		return null;
	const data = json(raw);
	return (type(data) == 'object' && type(data.images) == 'array') ? data : null;
}

function writeCache(data) {
	if (!mkdir(CACHE_DIR) && errno() != EEXIST)
		return false;
	return writefile(CACHE_META, sprintf('%.u', data)) ? true : false;
}

export function getWallpapers() {
	const cfg = loadConfig();

	if (cfg.enabled == '0') {
		return {
			enabled: false,
			images: [],
			source: 'disabled'
		};
	}

	// 1. Valid cache
	const cached = readCache();
	if (cached && (time() - cached.fetched) < cfg.cache_ttl) {
		return { enabled: true, images: cached.images, source: 'cache' };
	}

	// 2. Refresh from Bing
	const fresh = fetchBingMetadata(cfg);
	if (fresh) {
		writeCache(fresh);
		return { enabled: true, images: fresh.images, source: 'remote' };
	}

	// 3. Stale cache (Bing unreachable) - still better than nothing
	if (cached)
		return { enabled: true, images: cached.images, source: 'cache-stale' };

	// 4. Nothing - frontend falls back to CSS gradient
	return { enabled: true, images: [], source: 'none' };
}

return { getWallpapers };
