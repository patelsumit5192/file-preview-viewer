import {
  Component,
  Input,
  Output,
  EventEmitter,
  ElementRef,
  ViewChild,
  OnInit,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  NgZone,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FilePreviewViewer,
  getDefaultPlugins,
  type FileSource,
  type PreviewPlugin,
  type PreviewViewerOptions,
  type PreviewInstance,
} from './index';

@Component({
  selector: 'fp-file-preview',
  standalone: true,
  imports: [CommonModule],
  template: `<div #container [style.width]="'100%'" [style.height]="'100%'"></div>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilePreviewComponent implements OnInit, OnChanges, OnDestroy {
  @Input({ required: true }) src!: FileSource;
  @Input() plugins?: PreviewPlugin[];
  @Input() options: PreviewViewerOptions = {};

  @Output() loading = new EventEmitter<void>();
  @Output() loaded = new EventEmitter<unknown>();
  @Output() error = new EventEmitter<Error>();
  @Output() pageChange = new EventEmitter<unknown>();
  @Output() zoomChange = new EventEmitter<unknown>();
  @Output() rotate = new EventEmitter<unknown>();
  @Output() destroyed = new EventEmitter<void>();

  @ViewChild('container', { static: true }) container!: ElementRef<HTMLDivElement>;

  private viewer: FilePreviewViewer | null = null;
  private instance: PreviewInstance | null = null;

  constructor(private ngZone: NgZone) {}

  ngOnInit(): void {
    const viewer = new FilePreviewViewer({ autoRegisterDefaults: false });
    const activePlugins = this.plugins && this.plugins.length > 0 ? this.plugins : getDefaultPlugins();
    viewer.registerPlugins(activePlugins);
    this.viewer = viewer;

    viewer.on('loading', () => {
      this.ngZone.run(() => this.loading.emit());
    });
    viewer.on('loaded', (data: unknown) => {
      this.ngZone.run(() => this.loaded.emit(data));
    });
    viewer.on('error', (e: unknown) => {
      this.ngZone.run(() => this.error.emit(e instanceof Error ? e : new Error(String(e))));
    });
    viewer.on('page-change', (data: unknown) => {
      this.ngZone.run(() => this.pageChange.emit(data));
    });
    viewer.on('zoom-change', (data: unknown) => {
      this.ngZone.run(() => this.zoomChange.emit(data));
    });
    viewer.on('rotate', (data: unknown) => {
      this.ngZone.run(() => this.rotate.emit(data));
    });
    viewer.on('destroy', () => {
      this.ngZone.run(() => this.destroyed.emit());
    });

    this.render();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['src'] || changes['options']) && !changes['src']?.isFirstChange()) {
      this.render();
    }
  }

  private render(): void {
    if (!this.viewer || !this.src || !this.container) return;

    this.ngZone.runOutsideAngular(async () => {
      try {
        this.instance = await this.viewer!.preview(
          this.container.nativeElement,
          this.src,
          this.options
        );
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        this.ngZone.run(() => {
          this.error.emit(err instanceof Error ? err : new Error(String(err)));
        });
      }
    });
  }

  ngOnDestroy(): void {
    if (this.viewer) {
      this.viewer.destroy();
      this.viewer = null;
      this.instance = null;
    }
  }

  public getInstance(): PreviewInstance | null {
    return this.instance;
  }

  public getViewer(): FilePreviewViewer | null {
    return this.viewer;
  }

  public destroy(): void {
    this.viewer?.destroy();
  }
}

export default FilePreviewComponent;
