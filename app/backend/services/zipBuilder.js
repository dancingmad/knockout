/**
 * zipBuilder.js
 * Minimal ZIP builder that writes entries with leading '/' in their names,
 * matching the exact format produced by the KO II device for .ppak files.
 *
 * Standard ZIP libraries (archiver, yazl, adm-zip) all strip leading slashes
 * for security. The ep-sample-tool's regex requires the slash, so we build the
 * binary manually.
 *
 * Format references:
 *   https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT  §4.3
 */

const zlib = require('zlib');

// ─── CRC-32 ───────────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ─── helpers ──────────────────────────────────────────────────────────────────
function u16(n) { const b = Buffer.alloc(2); b.writeUInt16LE(n, 0); return b; }
function u32(n) { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0, 0); return b; }

function dosDateTime() {
  const d = new Date();
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  return { date, time };
}

// ─── public API ───────────────────────────────────────────────────────────────

/**
 * Build a ZIP buffer from an array of { name, data } entries.
 * `name` is written verbatim — pass names with a leading '/' to match device format.
 * Data is deflate-compressed (method 8).
 */
function buildZip(entries) {
  const localHeaders = [];   // { offset, nameBytes, crc, compSize, uncompSize }
  const parts = [];
  let offset = 0;
  const { date, time } = dosDateTime();

  for (const entry of entries) {
    const nameBytes = Buffer.from(entry.name, 'utf8');
    const raw       = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data);
    const compressed = zlib.deflateRawSync(raw, { level: 6 });
    const crc       = crc32(raw);

    // Local file header
    const lfh = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),  // signature
      u16(20),                                  // version needed
      u16(0),                                   // flags
      u16(8),                                   // compression: deflate
      u16(time),
      u16(date),
      u32(crc),
      u32(compressed.length),
      u32(raw.length),
      u16(nameBytes.length),
      u16(0),                                   // extra field length
      nameBytes,
    ]);

    localHeaders.push({
      offset,
      nameBytes,
      crc,
      compSize:   compressed.length,
      uncompSize: raw.length,
      time,
      date,
    });

    parts.push(lfh, compressed);
    offset += lfh.length + compressed.length;
  }

  // Central directory
  const cdParts = [];
  const cdStart = offset;

  for (const h of localHeaders) {
    const cd = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x01, 0x02]),  // signature
      u16(20),                                  // version made by
      u16(20),                                  // version needed
      u16(0),                                   // flags
      u16(8),                                   // compression
      u16(h.time),
      u16(h.date),
      u32(h.crc),
      u32(h.compSize),
      u32(h.uncompSize),
      u16(h.nameBytes.length),
      u16(0),                                   // extra field length
      u16(0),                                   // comment length
      u16(0),                                   // disk number start
      u16(0),                                   // internal attrs
      u32(0),                                   // external attrs
      u32(h.offset),                            // offset of local header
      h.nameBytes,
    ]);
    cdParts.push(cd);
  }

  const cdBuf  = Buffer.concat(cdParts);
  const cdSize = cdBuf.length;

  // End of central directory
  const eocd = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x05, 0x06]),  // signature
    u16(0),                                   // disk number
    u16(0),                                   // disk with CD
    u16(localHeaders.length),                 // records on this disk
    u16(localHeaders.length),                 // total records
    u32(cdSize),
    u32(cdStart),
    u16(0),                                   // comment length
  ]);

  return Buffer.concat([...parts, cdBuf, eocd]);
}

module.exports = { buildZip };
