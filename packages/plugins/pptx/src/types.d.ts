declare module 'pptx-browser' {
  export class PptxRenderer {
    load(source: ArrayBuffer | Uint8Array, onProgress?: (progress: number) => void): Promise<void>;
    renderSlide(slideIndex: number, canvas: HTMLCanvasElement, width?: number): Promise<void>;
    destroy(): void;
    slidePaths: string[];
  }
}
