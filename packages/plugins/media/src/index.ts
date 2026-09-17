import type { 
  FileInfo, 
  RenderContext, 
  ToolbarAction, 
  PreviewPlugin, 
  PreviewInstance 
} from '@patel.sumit51/core';

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico', '.tiff', '.tif', '.avif'];
const VIDEO_EXTS = ['.mp4', '.m4v', '.webm', '.ogv', '.ogg', '.mov', '.avi', '.mkv', '.flv', '.wmv', '.3gp', '.mpg', '.mpeg'];
const AUDIO_EXTS = ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a', '.wma', '.opus', '.weba'];

export class MediaPlugin implements PreviewPlugin {
  id = 'media';
  name = 'Media Preview (Image, Video, Audio)';
  extensions = [...IMAGE_EXTS, ...VIDEO_EXTS, ...AUDIO_EXTS];
  mimeTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp', 'image/x-icon', 'image/tiff', 'image/avif',
    'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/x-flv', 'video/x-ms-wmv', 'video/3gpp', 'video/mpeg',
    'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/flac', 'audio/aac', 'audio/mp4', 'audio/x-ms-wma', 'audio/opus', 'audio/webm'
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
          id: 'replay-10',
          icon: 'replay-10',
          label: 'Rewind 10s',
          type: 'button',
          group: 'actions',
          execute: () => {
            instance.rewind?.(10);
          }
        },
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
        },
        {
          id: 'forward-10',
          icon: 'forward-10',
          label: 'Fast Forward 10s',
          type: 'button',
          group: 'actions',
          execute: () => {
            instance.fastForward?.(10);
          }
        },
        {
          id: 'speed',
          icon: 'speed',
          label: 'Playback Speed',
          type: 'button',
          group: 'actions',
          execute: () => {
            (instance as any).cycleSpeed?.();
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
      video.playsInline = true;
      video.style.maxWidth = '90%';
      video.style.maxHeight = '90%';
      video.style.borderRadius = '8px';
      video.style.boxShadow = '0 8px 30px rgba(0,0,0,0.3)';
      video.style.backgroundColor = '#000000';
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
      fastForward: mediaElement ? (seconds = 10) => {
        if (mediaElement) {
          mediaElement.currentTime = Math.min(mediaElement.duration || Infinity, mediaElement.currentTime + seconds);
        }
      } : undefined,
      rewind: mediaElement ? (seconds = 10) => {
        if (mediaElement) {
          mediaElement.currentTime = Math.max(0, mediaElement.currentTime - seconds);
        }
      } : undefined,
      cycleSpeed: mediaElement ? () => {
        if (mediaElement) {
          const speeds = [1.0, 1.25, 1.5, 2.0, 0.5];
          const curIndex = speeds.indexOf(mediaElement.playbackRate);
          const nextIndex = curIndex === -1 ? 0 : (curIndex + 1) % speeds.length;
          mediaElement.playbackRate = speeds[nextIndex];
        }
      } : undefined,
      setPlaybackRate: mediaElement ? (rate: number) => {
        if (mediaElement) mediaElement.playbackRate = rate;
      } : undefined,
      getPlaybackRate: mediaElement ? () => mediaElement?.playbackRate ?? 1.0 : undefined,
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
