declare module 'pptx-browser' {
  export interface SlideSize {
    cx: number;
    cy: number;
  }

  export interface SlideSearchResult {
    slideIndex: number;
    text: string;
    context: string;
  }

  export class PptxRenderer {
    load(source: ArrayBuffer | Uint8Array, onProgress?: (progress: number) => void): Promise<void>;
    renderSlide(slideIndex: number, canvas: HTMLCanvasElement, width?: number): Promise<void>;
    destroy(): void;
    slidePaths: string[];
    slideCount: number;
    slideSize: SlideSize;
    extractSlide(slideIndex: number): any;
    extractText(slideIndex: number): string;
    searchSlides(query: string): SlideSearchResult[];
  }
}
