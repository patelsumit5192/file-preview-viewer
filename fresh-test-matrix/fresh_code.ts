/**
 * High-Performance Concurrent Buffer Pool
 */
export class BufferPool {
  private available: Uint8Array[] = [];
  private readonly bufferSize: number;

  constructor(bufferSize = 65536, initialCapacity = 64) {
    this.bufferSize = bufferSize;
    for (let i = 0; i < initialCapacity; i++) {
      this.available.push(new Uint8Array(bufferSize));
    }
  }

  public acquire(): Uint8Array {
    return this.available.pop() ?? new Uint8Array(this.bufferSize);
  }

  public release(buf: Uint8Array): void {
    if (buf.byteLength === this.bufferSize && this.available.length < 512) {
      buf.fill(0);
      this.available.push(buf);
    }
  }
}
