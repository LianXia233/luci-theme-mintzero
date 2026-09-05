// mintzero wallpaper backend
// Copyright (C) 2026 LianXia233
// Licensed to the public under the Apache License 2.0.
//
// Server-side Bing wallpaper metadata fetcher with on-disk raw cache.
// Called from header.ut (login page only); the result is embedded into
// the rendered page, so the browser never talks to the LuCI backend for
// metadata. Image bytes are loaded directly by the browser from Bing CDN.
//
// Design notes:
//  - Non-blocking: when the cache is fresh it is served immediately;
//    when it is stale or missing, a background wget is spawned to refresh
//    it and rendering continues with whatever is available. The LuCI page
//    render NEVER waits for Bing.
//  - The raw API response is cached as-is and validated on every read,
//    so a partially written file can never reach the frontend.
//
// Security:
//  - Host allowlist: only www.bing.com (API and images) is ever
//    contacted or emitted.
//  - Strict JSON schema validation before use.
//  - Timeouts enforced via wget -T.
//  - Cache files live in fixed paths under /tmp (no traversal).

'use strict';

import { readfile, writefile, popen, stat, mkdir } from 'fs';
import { cursor } from 'uci';

const BING_API_BASE = 'https://www.bing.com/HPImageArchive.aspx';
const BING_IMAGE_BASE = 'https://www.bing.com';

const CACHE_DIR = '/tmp/mintzero-wallpaper';
const CACHE_RAW = CACHE_DIR + '/bing-raw.json';
const LOCK_FILE = CACHE_DIR + '/refresh.lock';
const LOCK_TTL = 60;

const DEFAULTS = {
	enabled: '1',
	market: 'zh-CN',
	count: 8,
	cache_ttl: 86400
};

const ALLOWED_MARKETS = ['zh-CN', 'en-US', 'ja-JP', 'zh-TW'];

// NOTE: ucode (libucode 20230711 era) does NOT hoist function declarations,
// so helpers must be defined before the functions that call them.

function clampInt(v, min, max, dflt) {
	const n = int(v);
	if (n === null)
		return dflt;
	if (n < min)
		return min;
	return (n > max) ? max : n;
}

// List membership test. Avoids Array.prototype.indexOf, which is missing
// in older ucode (libucode 20230711 era) runtimes.
function inList(v, list) {
	let i;

	for (i = 0; i < length(list); i++) {
		if (list[i] == v)
			return true;
	}

	return false;
}

function loadConfig() {
	const wp = cursor().get_all('mintzero', 'wallpaper') ?? {};
	return {
		enabled: wp.enabled ?? DEFAULTS.enabled,
		market: inList(wp.market ?? '', ALLOWED_MARKETS) ? wp.market : DEFAULTS.market,
		count: clampInt(wp.count, 1, 8, DEFAULTS.count),
		cache_ttl: clampInt(wp.cache_ttl, 300, 604800, DEFAULTS.cache_ttl)
	};
}

// Validate a Bing image path emitted by the API before trusting it.
// Must be a relative path starting with "/" and contain no tricks.
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

// Parse and strictly validate a raw Bing HPImageArchive JSON response.
function parsePool(raw) {
	const data = json(raw);
	if (type(data) != 'object' || type(data.images) != 'array')
		return null;

	const pool = [];
	const images = data.images;
	let i, img, imageUrl, imageUrlBase;

	for (i = 0; i < length(images); i++) {
		img = images[i];
		if (type(img) != 'object')
			continue;

		imageUrl = validImagePath(img.url);
		if (!imageUrl)
			continue;

		// Derive a reasonably sized variant from urlbase when present
		imageUrlBase = validImagePath(img.urlbase);

		push(pool, {
			url: imageUrl,
			urlbase: imageUrlBase ?? imageUrl,
			title: (type(img.title) == 'string') ? img.title : '',
			copyright: (type(img.copyright) == 'string') ? img.copyright : '',
			startdate: (type(img.startdate) == 'string') ? img.startdate : ''
		});
	}

	return length(pool) ? pool : null;
}

function readCache() {
	const st = stat(CACHE_RAW);
	if (!st || st.type != 'file' || !st.size)
		return null;

	const raw = readfile(CACHE_RAW);
	if (!raw)
		return null;

	const images = parsePool(raw);
	return images ? { fetched: st.mtime, images } : null;
}

// Minimal POSIX single-quote shell escaping. Implemented with basic
// builtins only (substr/length) for compatibility with older ucode.
function shellquote(s) {
	let out = "'";
	let i, c;

	for (i = 0; i < length(s); i++) {
		c = substr(s, i, 1);
		if (c == "'")
			out += "'\\''";
		else
			out += c;
	}

	return out + "'";
}

// Spawn a detached background refresh. The subshell redirects all output
// so popen() returns immediately; wget outlives the ucode process.
function spawnRefresh(cfg) {
	// Simple throttle: at most one refresh per LOCK_TTL seconds
	const lock = stat(LOCK_FILE);

	if (lock && lock.type == 'file' && (time() - lock.mtime) < LOCK_TTL)
		return;

	mkdir(CACHE_DIR);
	writefile(LOCK_FILE, sprintf('%d', time()));

	const url = sprintf('%s?format=js&idx=0&n=%d&mkt=%s',
		BING_API_BASE, cfg.count, cfg.market);

	const cmd = sprintf(
		'( wget -q -O %s -T 8 -U "mintzero-wallpaper/1.0" %s ) >/dev/null 2>&1 &',
		shellquote(CACHE_RAW), shellquote(url)
	);

	const p = popen(cmd, 'r');
	p?.close();
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

	// 1. Fresh cache - serve directly, zero network I/O
	const cached = readCache();
	if (cached && (time() - cached.fetched) < cfg.cache_ttl) {
		return { enabled: true, images: cached.images, source: 'cache' };
	}

	// 2. Stale or missing: refresh in the background, never block
	spawnRefresh(cfg);

	// 3. Stale cache is still better than nothing
	if (cached)
		return { enabled: true, images: cached.images, source: 'cache-stale' };

	// 4. Nothing yet - frontend falls back to CSS gradient
	return { enabled: true, images: [], source: 'none' };
}
