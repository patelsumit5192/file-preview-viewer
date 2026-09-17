import { describe, it, expect } from 'vitest';
import { detectMagicBytes, extractExtension, mimeFromExtension } from '../detect';

describe('File Detection', () => {
  it('should extract extensions from filenames and URLs', () => {
    expect(extractExtension('document.pdf')).toBe('.pdf');
    expect(extractExtension('image.JPEG')).toBe('.jpeg');
    expect(extractExtension('https://example.com/files/report.xlsx?download=true')).toBe('.xlsx');
    expect(extractExtension('archive.tar.gz')).toBe('.gz');
    expect(extractExtension('no_extension')).toBeUndefined();
  });

  it('should map extensions to correct MIME types', () => {
    expect(mimeFromExtension('.pdf')).toBe('application/pdf');
    expect(mimeFromExtension('.png')).toBe('image/png');
    expect(mimeFromExtension('.docx')).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    expect(mimeFromExtension('.xlsx')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    expect(mimeFromExtension('.mp4')).toBe('video/mp4');
    expect(mimeFromExtension('.csv')).toBe('text/csv');
    expect(mimeFromExtension('.unknown')).toBeUndefined();
  });

  it('should detect PDF from magic bytes %PDF', () => {
    const buffer = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]).buffer;
    expect(detectMagicBytes(buffer)).toBe('application/pdf');
  });

  it('should detect PNG from magic bytes', () => {
    const buffer = new Uint8Array([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D
    ]).buffer;
    expect(detectMagicBytes(buffer)).toBe('image/png');
  });

  it('should detect JPEG from magic bytes', () => {
    const buffer = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46]).buffer;
    expect(detectMagicBytes(buffer)).toBe('image/jpeg');
  });

  it('should detect ZIP/Office container from magic bytes PK', () => {
    const buffer = new Uint8Array([0x50, 0x4B, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]).buffer;
    expect(detectMagicBytes(buffer)).toBe('application/zip');
  });

  it('should return null for unknown binary data', () => {
    const buffer = new Uint8Array([0x01, 0x02, 0x03, 0x04]).buffer;
    expect(detectMagicBytes(buffer)).toBeNull();
  });
});
