import type { 
  FileInfo, 
  RenderContext, 
  ToolbarAction, 
  PreviewPlugin, 
  PreviewInstance 
} from '@patel.sumit51/core';

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
const VIDEO_EXTS = ['.mp4', '.webm', '.ogg'];
const AUDIO_EXTS = ['.mp3', '.wav', '.ogg'];

export class MediaPlugin implements PreviewPlugin {
  id = 'media';
  name = 'Media Preview';
  extensions = [...IMAGE_EXTS, ...VIDEO_EXTS, ...AUDIO_EXTS];
  mimeTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'video/mp4', 'video/webm', 'video/ogg',
    'audio/mpeg', 'audio/wav', 'audio/ogg'
  ];
  weight = 90;

  supports(file: FileInfo): boolean {
    const ext = file.metadata.extension?.toLowerCase() || '';
    const mime = file.metadata.mimeType?.toLowerCase() || '';
    
    return this.extensions.includes(ext) || 
           this.mimeTypes.some(m => mime.startsWith(m.split('/')[0]));
  }

  getToolbarActions(instance: PreviewInstance): ToolbarAction[] {
    const actions: ToolbarAction[] = [];
    
    if (instance.zoomIn) {
      actions.push(
        {
          id: 'zoom-out',
          icon: 'zoom-out',
          label: 'Zoom Out',
          type: 'button',
          group: 'zoom',
          execute: () => {
            instance.zoomOut?.();
          }
        },
        {
          id: 'zoom-in',
          icon: 'zoom-in',
          label: 'Zoom In',
          type: 'button',
          group: 'zoom',
          execute: () => {
            instance.zoomIn?.();
          }
        },
        {
          id: 'fit-page',
          icon: 'fit-page',
          label: 'Fit to Page',
          type: 'button',
          group: 'zoom',
          execute: () => {
            instance.fitToPage?.();
          }
        },
        {
          id: 'rotate-cw',
          icon: 'rotate-cw',
          label: 'Rotate',
          type: 'button',
          group: 'view',
          execute: () => {
            instance.rotateCW?.();
          }
        }
      );
    }
    
    if (instance.play) {
      actions.push(
        {
          id: 'play',
          icon: 'play',
          label: 'Play',
          type: 'button',
          group: 'actions',
          execute: () => {
            instance.play?.();
          }
        },
        {
          id: 'pause',
          icon: 'pause',
          label: 'Pause',
          type: 'button',
          group: 'actions',
          execute: () => {
            instance.pause?.();
          }
        }
      );
    }

    actions.push({
      id: 'download',
      icon: 'download',
      label: 'Download',
      type: 'button',
      group: 'actions',
      execute: () => {
        instance.download?.();
      }
    });

    if (instance.print) {
      actions.push({
        id: 'print',
        icon: 'print',
        label: 'Print',
        type: 'button',
        group: 'actions',
        execute: () => {
          instance.print?.();
        }
      });
    }

    return actions;
  }

  async render(ctx: RenderContext): Promise<PreviewInstance> {
    const mimeType = ctx.metadata.mimeType || 'application/octet-stream';
    const isImage = mimeType.startsWith('image/') || IMAGE_EXTS.includes(ctx.metadata.extension || '');
    const isVideo = mimeType.startsWith('video/') || VIDEO_EXTS.includes(ctx.metadata.extension || '');
    const isAudio = mimeType.startsWith('audio/') || AUDIO_EXTS.includes(ctx.metadata.extension || '');
    
    let url = '';
    
    if (ctx.metadata.extension === '.svg' || mimeType === 'image/svg+xml') {
      const decoder = new TextDecoder('utf-8');
      const svgText = decoder.decode(ctx.buffer);
      const blob = new Blob([svgText], { type: 'image/svg+xml' });
      url = URL.createObjectURL(blob);
    } else {
      const blob = new Blob([ctx.buffer], { type: mimeType });
      url = URL.createObjectURL(blob);
    }
    
    let element: HTMLElement;
    let currentZoom = 1.0;
    let rotation = 0;
    let mediaElement: HTMLMediaElement | null = null;
    
    if (isImage) {
      const img = document.createElement('img');
      img.src = url;
      img.style.maxWidth = '100%';
      img.style.maxHeight = '100%';
      img.style.objectFit = 'contain';
      img.style.transition = 'transform 0.2s ease';
      element = img;
    } else if (isVideo) {
      const video = document.createElement('video');
      video.src = url;
      video.controls = true;
      video.style.maxWidth = '100%';
      video.style.maxHeight = '100%';
      element = video;
      mediaElement = video;
    } else if (isAudio) {
      const audio = document.createElement('audio');
      audio.src = url;
      audio.controls = true;
      element = audio;
      mediaElement = audio;
    } else {
      element = document.createElement('div');
      element.textContent = 'Unsupported media type';
    }
    
    ctx.container.style.display = 'flex';
    ctx.container.style.alignItems = 'center';
    ctx.container.style.justifyContent = 'center';
    ctx.container.style.overflow = 'hidden';
    ctx.container.appendChild(element);

    const applyTransform = () => {
      element.style.transform = `scale(${currentZoom}) rotate(${rotation}deg)`;
    };

    const cleanup = () => {
      if (url) URL.revokeObjectURL(url);
      element.remove();
      ctx.container.innerHTML = '';
    };

    ctx.signal.addEventListener('abort', cleanup);

    return {
      destroy: cleanup,
      zoomIn: isImage ? () => {
        currentZoom += 0.1;
        applyTransform();
      } : undefined,
      zoomOut: isImage ? () => {
        currentZoom = Math.max(0.1, currentZoom - 0.1);
        applyTransform();
      } : undefined,
      getZoom: isImage ? () => currentZoom : undefined,
      setZoom: isImage ? (level: number) => {
        currentZoom = level;
        applyTransform();
      } : undefined,
      fitToPage: isImage ? () => {
        currentZoom = 1.0;
        rotation = 0;
        applyTransform();
      } : undefined,
      rotateCW: isImage || isVideo ? () => {
        rotation = (rotation + 90) % 360;
        applyTransform();
      } : undefined,
      rotateCCW: isImage || isVideo ? () => {
        rotation = (rotation - 90 + 360) % 360;
        applyTransform();
      } : undefined,
      getRotation: () => rotation,
      play: mediaElement ? () => mediaElement?.play() : undefined,
      pause: mediaElement ? () => mediaElement?.pause() : undefined,
      isPlaying: mediaElement ? () => !mediaElement?.paused : undefined,
      download: () => {
        const a = document.createElement('a');
        a.href = url;
        a.download = ctx.metadata.name || 'media';
        a.click();
      },
      print: isImage ? () => {
        window.print();
      } : undefined
    };
  }
}

export function mediaPlugin(): MediaPlugin {
  return new MediaPlugin();
}

export default MediaPlugin;
