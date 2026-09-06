#!/usr/bin/env python3
"""po2lmo: compile a LuCI .po catalog into .lmo format.

Reimplementation of luci-base po2lmo.c (Apache-2.0, Jo-Philipp Wich).
Format: data section first (each msgstr padded to 4 bytes), then the
index (entries sorted by key_id, big-endian uint32 key/val/offset/len),
then a final big-endian uint32 marker = total data size.
"""
import struct
import sys
import re


def sfh_hash(data: bytes, initval: int) -> int:
    """SuperFastHash (Paul Hsieh), as used by luci-base sfh_hash()."""
    data = data + b'\x00' * 3  # guard for reads
    hash_ = initval & 0xFFFFFFFF
    length = len(data) if initval is None else initval
    hash_ = length & 0xFFFFFFFF
    rem = length & 3
    blocks = length >> 2
    pos = 0

    def get16(p):
        return data[p] | (data[p + 1] << 8)

    while blocks > 0:
        hash_ = (hash_ + get16(pos)) & 0xFFFFFFFF
        tmp = ((get16(pos + 2) << 11) ^ hash_) & 0xFFFFFFFF
        hash_ = ((hash_ << 16) ^ tmp) & 0xFFFFFFFF
        pos += 4
        hash_ = (hash_ + (hash_ >> 11)) & 0xFFFFFFFF
        blocks -= 1

    if rem == 3:
        hash_ = (hash_ + get16(pos)) & 0xFFFFFFFF
        hash_ ^= (hash_ << 16) & 0xFFFFFFFF
        b = data[pos + 2]
        if b >= 128:
            b -= 256  # signed char
        hash_ ^= ((b << 18) & 0xFFFFFFFF)
        hash_ = (hash_ + (hash_ >> 11)) & 0xFFFFFFFF
    elif rem == 2:
        hash_ = (hash_ + get16(pos)) & 0xFFFFFFFF
        hash_ ^= (hash_ << 11) & 0xFFFFFFFF
        hash_ = (hash_ + (hash_ >> 17)) & 0xFFFFFFFF
    elif rem == 1:
        b = data[pos]
        if b >= 128:
            b -= 256  # signed char
        hash_ = (hash_ + (b & 0xFFFFFFFF)) & 0xFFFFFFFF
        hash_ ^= (hash_ << 10) & 0xFFFFFFFF
        hash_ = (hash_ + (hash_ >> 1)) & 0xFFFFFFFF

    hash_ ^= (hash_ << 3) & 0xFFFFFFFF
    hash_ = (hash_ + (hash_ >> 5)) & 0xFFFFFFFF
    hash_ ^= (hash_ << 4) & 0xFFFFFFFF
    hash_ = (hash_ + (hash_ >> 17)) & 0xFFFFFFFF
    hash_ ^= (hash_ << 25) & 0xFFFFFFFF
    hash_ = (hash_ + (hash_ >> 6)) & 0xFFFFFFFF
    return hash_ & 0xFFFFFFFF


def unescape(s: str) -> str:
    return s.replace('\\"', '"').replace('\\\\', '\\').replace('\\n', '\n').replace('\\t', '\t')


def parse_po(path):
    """Return list of (msgid, msgstr, plural_index). Also handles the
    Plural-Forms header lines as (None, line, 0) entries like po2lmo."""
    entries = []
    msgid = None
    msgstr = None
    cur = None  # 'id' | 'str'
    plural = None
    plural_num = 0
    strmap = {}

    def flush():
        nonlocal msgid, msgstr
        if msgid is not None and msgstr is not None:
            entries.append((msgid, msgstr, plural_num))
        msgid = None
        msgstr = None

    with open(path, 'r', encoding='utf-8') as f:
        for raw in f:
            line = raw.rstrip('\n')
            if line.startswith('msgid "'):
                flush()
                msgid = unescape(line[7:].rstrip()[:-1] if line[7:].rstrip().endswith('"') else line[7:].rstrip())
                cur = 'id'
            elif line.startswith('msgid_plural "'):
                plural = unescape(line[14:].rstrip()[:-1])
                cur = None
            elif line.startswith('msgstr['):
                plural_num = int(line[7:line.index(']')])
                msgstr = unescape(line[line.index('" ') + 2:].rstrip()[:-1]) if '" ' in line else ''
                cur = 'str'
            elif line.startswith('msgstr "'):
                plural_num = 0
                msgstr = unescape(line[8:].rstrip()[:-1])
                cur = 'str'
            elif line.startswith('"') and cur:
                cont = unescape(line.rstrip()[1:-1])
                if cur == 'id':
                    msgid = (msgid or '') + cont
                else:
                    msgstr = (msgstr or '') + cont
            elif line.startswith('msgctxt'):
                flush()
                cur = None
            elif line.strip() == '' or line.startswith('#'):
                if line.startswith('#'):
                    continue
                flush()
                cur = None
    flush()

    out = []
    for mid, mstr, pnum in entries:
        if mid == '' :
            # header: extract Plural-Forms lines
            field = mstr or ''
            for part in field.replace('\\n', '\n').split('\n'):
                if part.lower().startswith('plural-forms:'):
                    out.append((None, part[14:] if part[13] == ' ' else part[13:], 0))
            continue
        out.append((mid, mstr, pnum))
    return out


def compile_lmo(po_path, lmo_path):
    entries = parse_po(po_path)
    data = bytearray()
    index = []
    for mid, mstr, pnum in entries:
        if mid is None:
            key_id, val_id = 0, 0
        else:
            key = mid.encode('utf-8')
            key_id = sfh_hash(key, len(key))
            val_id = pnum + 1
            if key_id == val_id:
                continue
        raw = mstr.encode('utf-8')
        length = len(raw)
        pad = (4 - (length % 4)) % 4
        index.append((key_id, val_id, len(data), length))
        data += raw + b'\x00' * pad

    index.sort(key=lambda e: e[0])
    with open(lmo_path, 'wb') as f:
        # data section first, then index, then 4-byte data-size marker
        # (lmo_open reads the marker from EOF and treats everything
        # between marker-offset and EOF-4 as the entry index)
        f.write(data)
        for key_id, val_id, off, length in index:
            f.write(struct.pack('>IIII', key_id, val_id, off, length))
        f.write(struct.pack('>I', len(data)))


if __name__ == '__main__':
    compile_lmo(sys.argv[1], sys.argv[2])
    print('compiled', sys.argv[1], '->', sys.argv[2])
