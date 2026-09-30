/**
 * Minimal Compliant CFBF (Compound File Binary Format / OLE2) Builder
 * Creates valid .doc, .ppt, and .msg binary files.
 */
function createCfbf(entries) {
  // entries: Array<{ name: string; data: Buffer }>
  const SECTOR_SIZE = 512;
  const ENTRY_SIZE = 128;
  const ENTRIES_PER_SECTOR = SECTOR_SIZE / ENTRY_SIZE; // 4

  // Sector allocation plan:
  // Sector 0: FAT
  // Sector 1: Directory (Root Entry + up to 3 streams)
  // Sector 2+: Stream data
  
  // Ensure entries are at least 4096 bytes for standard FAT sector reading
  const preparedEntries = entries.map(e => {
    if (e.data.length < 4096) {
      const padded = Buffer.alloc(4096, 0);
      e.data.copy(padded);
      return { name: e.name, data: padded, realSize: e.data.length };
    }
    return { name: e.name, data: e.data, realSize: e.data.length };
  });

  const dirEntriesCount = preparedEntries.length + 1; // +1 for Root Entry
  const dirSectorsCount = Math.ceil(dirEntriesCount / ENTRIES_PER_SECTOR);
  let currentSector = 1 + dirSectorsCount;

  // Calculate total sectors needed for streams
  const streamAllocations = [];
  for (const entry of preparedEntries) {
    const sectorsNeeded = Math.ceil(entry.data.length / SECTOR_SIZE) || 1;
    streamAllocations.push({
      entry,
      startSector: currentSector,
      sectorsCount: sectorsNeeded,
      size: entry.data.length
    });
    currentSector += sectorsNeeded;
  }

  const fat = new Int32Array(Math.max(128, currentSector + 16));
  fat.fill(-1); // -1 = FREESECT
  
  // Sector 0 is FAT: FAT[0] = -3 (FATSECT)
  fat[0] = -3;
  // Directory sectors chain
  for (let s = 1; s <= dirSectorsCount; s++) {
    fat[s] = (s === dirSectorsCount) ? -2 : (s + 1);
  }

  // Chain stream sectors
  for (const alloc of streamAllocations) {
    for (let i = 0; i < alloc.sectorsCount; i++) {
      const sec = alloc.startSector + i;
      fat[sec] = (i === alloc.sectorsCount - 1) ? -2 : (sec + 1);
    }
  }

  // Create Directory buffer (multiple sectors if needed)
  const dirBuf = Buffer.alloc(dirSectorsCount * SECTOR_SIZE, 0);

  // Helper to write directory entry (128 bytes)
  function writeDirEntry(offset, name, type, startSec, size, childId = -1, leftId = -1, rightId = -1) {
    const entryBuf = dirBuf.subarray(offset, offset + ENTRY_SIZE);
    // Name in UTF-16LE (max 31 chars + null terminator = 64 bytes)
    const nameLen = Math.min(name.length, 31);
    for (let i = 0; i < nameLen; i++) {
      entryBuf.writeUInt16LE(name.charCodeAt(i), i * 2);
    }
    entryBuf.writeUInt16LE(0, nameLen * 2);
    entryBuf.writeUInt16LE((nameLen + 1) * 2, 64); // cb (length in bytes)
    entryBuf.writeUInt8(type, 66); // type: 1=user storage, 2=user stream, 5=root
    entryBuf.writeUInt8(1, 67); // color: black (1)
    entryBuf.writeInt32LE(leftId, 68);
    entryBuf.writeInt32LE(rightId, 72);
    entryBuf.writeInt32LE(childId, 76);
    // start sector (offset 116)
    entryBuf.writeUInt32LE(startSec, 116);
    // size (offset 120)
    entryBuf.writeUInt32LE(size, 120);
    entryBuf.writeUInt32LE(0, 124); // high 32-bit size
  }

  // Entry 0: Root Entry (type 5)
  // childId points to Entry 1
  writeDirEntry(0, 'Root Entry', 5, 0, 0, entries.length > 0 ? 1 : -1);

  // Write stream entries in a simple linked BST
  for (let i = 0; i < entries.length; i++) {
    const alloc = streamAllocations[i];
    const offset = (i + 1) * ENTRY_SIZE;
    const rightId = (i + 1 < entries.length) ? (i + 2) : -1;
    writeDirEntry(offset, alloc.entry.name, 2, alloc.startSector, alloc.size, -1, -1, rightId);
  }

  // Header (512 bytes)
  const headerBuf = Buffer.alloc(SECTOR_SIZE, 0);
  // Magic: D0 CF 11 E0 A1 B1 1A E1
  const sig = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
  sig.forEach((b, i) => headerBuf[i] = b);
  headerBuf.writeUInt16LE(0xFFFE, 28); // byte order
  headerBuf.writeUInt16LE(9, 30); // sector shift = 9 (512)
  headerBuf.writeUInt16LE(6, 32); // mini sector shift = 6 (64)
  headerBuf.writeUInt32LE(1, 44); // num FAT sectors = 1
  headerBuf.writeUInt32LE(1, 48); // first dir sector = 1
  headerBuf.writeUInt32LE(0, 56); // mini stream cutoff = 0 (all streams use regular FAT sectors)
  headerBuf.writeInt32LE(-2, 60); // first mini FAT sector
  headerBuf.writeUInt32LE(0, 64); // num mini FAT sectors
  headerBuf.writeInt32LE(-2, 68); // first DIFAT sector
  headerBuf.writeUInt32LE(0, 72); // num DIFAT sectors
  // DIFAT in header: points to sector 0 for first FAT sector
  headerBuf.writeUInt32LE(0, 76);
  for (let i = 1; i < 109; i++) {
    headerBuf.writeInt32LE(-1, 76 + i * 4);
  }

  // Convert FAT Int32Array to Buffer
  const fatBuf = Buffer.from(fat.buffer);

  // Stream data buffers padded to 512
  const streamBufs = streamAllocations.map(alloc => {
    const paddedLen = alloc.sectorsCount * SECTOR_SIZE;
    const buf = Buffer.alloc(paddedLen, 0);
    alloc.entry.data.copy(buf);
    return buf;
  });

  return Buffer.concat([headerBuf, fatBuf, dirBuf, ...streamBufs]);
}

module.exports = { createCfbf };
