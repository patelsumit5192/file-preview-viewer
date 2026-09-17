/**
 * Compound File Binary Format (CFBF / OLE2) parser.
 * Implements Microsoft [MS-CFB] specification for legacy Office formats (.doc, .ppt, .xls).
 * Zero external dependencies, client-side browser and Node.js compatible.
 */

export interface CfbfEntry {
  name: string;
  type: number; // 0=Empty, 1=User Storage, 2=User Stream, 5=Root Storage
  size: number;
  startSector: number;
}

export class CfbfReader {
  private view: DataView;
  private u8: Uint8Array;
  private sectorSize: number;
  private miniSectorSize: number;
  private miniStreamCutoff: number;
  private fat: number[] = [];
  private miniFat: number[] = [];
  private entries: Map<string, CfbfEntry> = new Map();
  private miniStream: Uint8Array = new Uint8Array(0);

  constructor(buffer: ArrayBuffer) {
    this.u8 = new Uint8Array(buffer);
    this.view = new DataView(buffer);

    if (!this.isValid()) {
      throw new Error('Invalid CFBF / OLE2 file header signature');
    }

    // Sector shifts
    const sectorShift = this.view.getUint16(30, true);
    this.sectorSize = 1 << sectorShift;
    const miniSectorShift = this.view.getUint16(32, true);
    this.miniSectorSize = 1 << miniSectorShift;
    this.miniStreamCutoff = this.view.getUint32(56, true) || 4096;

    this.parseFat();
    this.parseDirectory();
    this.parseMiniFat();
  }

  /** Check if the magic 8-byte signature matches [MS-CFB] */
  public isValid(): boolean {
    if (this.u8.length < 512) return false;
    const sig = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
    return sig.every((b, i) => this.u8[i] === b);
  }

  /** Return all directory stream/storage entries found in the file */
  public listEntries(): CfbfEntry[] {
    return Array.from(this.entries.values());
  }

  /** Check if a stream exists */
  public hasStream(name: string): boolean {
    return this.entries.has(name) || this.findEntryCaseInsensitive(name) !== null;
  }

  /**
   * Read raw bytes of a named stream (e.g. "WordDocument", "PowerPoint Document", "Workbook")
   */
  public readStream(name: string): Uint8Array | null {
    const entry = this.entries.get(name) || this.findEntryCaseInsensitive(name);
    if (!entry) return null;
    if (entry.size === 0) return new Uint8Array(0);

    // Mini Stream vs Regular Stream
    if (entry.size < this.miniStreamCutoff && entry.type !== 5) {
      return this.readMiniStream(entry.startSector, entry.size);
    } else {
      return this.readRegularStream(entry.startSector, entry.size);
    }
  }

  private findEntryCaseInsensitive(name: string): CfbfEntry | null {
    const lower = name.toLowerCase();
    for (const [key, val] of this.entries.entries()) {
      if (key.toLowerCase() === lower) return val;
    }
    return null;
  }

  private getSectorOffset(sectId: number): number {
    return (sectId + 1) * this.sectorSize;
  }

  private parseFat(): void {
    const csectFat = this.view.getUint32(44, true);
    const difat: number[] = [];

    // First 109 DIFAT entries stored in header (offset 76..511)
    for (let i = 0; i < 109; i++) {
      const sect = this.view.getUint32(76 + i * 4, true);
      if (sect !== 0xffffffff && sect !== 0xfffffffe) {
        difat.push(sect);
      }
    }

    // Chained DIFAT sectors (if file has > 109 FAT sectors)
    let difatSect = this.view.getUint32(68, true);
    const csectDif = this.view.getUint32(72, true);
    const entriesPerSector = (this.sectorSize / 4) - 1;

    for (let i = 0; i < csectDif && difatSect < 0xfffffffe; i++) {
      const offset = this.getSectorOffset(difatSect);
      for (let j = 0; j < entriesPerSector; j++) {
        const sect = this.view.getUint32(offset + j * 4, true);
        if (sect !== 0xffffffff && sect !== 0xfffffffe) {
          difat.push(sect);
        }
      }
      difatSect = this.view.getUint32(offset + entriesPerSector * 4, true);
    }

    // Read all FAT sectors and construct fat array
    for (const fatSect of difat) {
      if (fatSect >= 0xfffffffe) continue;
      const offset = this.getSectorOffset(fatSect);
      const count = this.sectorSize / 4;
      for (let j = 0; j < count; j++) {
        this.fat.push(this.view.getUint32(offset + j * 4, true));
      }
    }
  }

  private parseDirectory(): void {
    const dirStartSect = this.view.getUint32(48, true);
    const dirBytes = this.readRegularStream(dirStartSect);
    const dirView = new DataView(dirBytes.buffer, dirBytes.byteOffset, dirBytes.byteLength);
    const entryCount = dirBytes.length / 128;

    for (let i = 0; i < entryCount; i++) {
      const offset = i * 128;
      const type = dirView.getUint8(offset + 66);
      if (type === 0) continue; // Unallocated

      const nameLen = dirView.getUint16(offset + 64, true);
      let name = '';
      if (nameLen > 2) {
        const charCount = (nameLen / 2) - 1; // exclude null terminator
        const chars: string[] = [];
        for (let c = 0; c < charCount; c++) {
          const charCode = dirView.getUint16(offset + c * 2, true);
          chars.push(String.fromCharCode(charCode));
        }
        name = chars.join('');
      }

      const startSector = dirView.getUint32(offset + 116, true);
      // Low 32-bits of size (Office files are almost never > 4GB)
      const size = dirView.getUint32(offset + 120, true);

      const entry: CfbfEntry = { name, type, size, startSector };
      this.entries.set(name, entry);

      // Root entry stores the Mini Stream
      if (type === 5) {
        this.miniStream = this.readRegularStream(startSector, size);
      }
    }
  }

  private parseMiniFat(): void {
    const miniFatStart = this.view.getUint32(60, true);
    const csectMiniFat = this.view.getUint32(64, true);
    if (miniFatStart >= 0xfffffffe || csectMiniFat === 0) return;

    let sect = miniFatStart;
    for (let i = 0; i < csectMiniFat && sect < 0xfffffffe; i++) {
      const offset = this.getSectorOffset(sect);
      const count = this.sectorSize / 4;
      for (let j = 0; j < count; j++) {
        this.miniFat.push(this.view.getUint32(offset + j * 4, true));
      }
      sect = this.fat[sect] ?? 0xfffffffe;
    }
  }

  private readRegularStream(startSector: number, targetSize?: number): Uint8Array {
    if (startSector >= 0xfffffffe) return new Uint8Array(0);

    const chunks: Uint8Array[] = [];
    let curr = startSector;
    let totalBytes = 0;
    const visited = new Set<number>();

    while (curr < 0xfffffffe && !visited.has(curr)) {
      visited.add(curr);
      const offset = this.getSectorOffset(curr);
      if (offset + this.sectorSize <= this.u8.length) {
        chunks.push(this.u8.subarray(offset, offset + this.sectorSize));
        totalBytes += this.sectorSize;
      }
      curr = this.fat[curr] ?? 0xfffffffe;
    }

    const result = new Uint8Array(totalBytes);
    let pos = 0;
    for (const chunk of chunks) {
      result.set(chunk, pos);
      pos += chunk.length;
    }

    if (targetSize !== undefined && targetSize < result.length) {
      return result.subarray(0, targetSize);
    }
    return result;
  }

  private readMiniStream(startSector: number, targetSize: number): Uint8Array {
    if (this.miniStream.length === 0 || startSector >= 0xfffffffe) return new Uint8Array(0);

    const chunks: Uint8Array[] = [];
    let curr = startSector;
    let totalBytes = 0;
    const visited = new Set<number>();

    while (curr < 0xfffffffe && !visited.has(curr)) {
      visited.add(curr);
      const offset = curr * this.miniSectorSize;
      if (offset + this.miniSectorSize <= this.miniStream.length) {
        chunks.push(this.miniStream.subarray(offset, offset + this.miniSectorSize));
        totalBytes += this.miniSectorSize;
      }
      curr = this.miniFat[curr] ?? 0xfffffffe;
    }

    const result = new Uint8Array(totalBytes);
    let pos = 0;
    for (const chunk of chunks) {
      result.set(chunk, pos);
      pos += chunk.length;
    }

    return result.subarray(0, targetSize);
  }
}
