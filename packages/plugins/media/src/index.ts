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
          id: 'reset-zoom',
          icon: 'reset-zoom',
          label: 'Reset Zoom',
          type: 'button',
          group: 'zoom',
          execute: () => {
            instance.resetZoom?.();
          }
        },
        {
          id: 'fit-width',
          icon: 'fit-width',
          label: 'Fit to Width',
          type: 'button',
          group: 'zoom',
          execute: () => {
            instance.fitToWidth?.();
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

    actions.push({
      id: 'open-window',
      icon: 'open-window',
      label: 'Open in Separate Full Window',
      type: 'button',
      group: 'actions',
      execute: () => {
        (instance as any).openInSeparateWindow?.();
      }
    });

    return actions;
  }

  async render(ctx: RenderContext): Promise<PreviewInstance> {
    const ext = (ctx.metadata.extension || '').toLowerCase();
    let mimeType = ctx.metadata.mimeType || '';
    if (!mimeType || mimeType === 'application/octet-stream') {
      const audioMimes: Record<string, string> = {
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.ogg': 'audio/ogg',
        '.flac': 'audio/flac',
        '.aac': 'audio/aac',
        '.m4a': 'audio/mp4',
        '.wma': 'audio/x-ms-wma',
        '.opus': 'audio/opus',
        '.weba': 'audio/webm'
      };
      if (audioMimes[ext]) {
        mimeType = audioMimes[ext];
      } else {
        mimeType = 'application/octet-stream';
      }
    }
    const isImage = mimeType.startsWith('image/') || IMAGE_EXTS.includes(ext);
    const isVideo = mimeType.startsWith('video/') || VIDEO_EXTS.includes(ext);
    const isAudio = mimeType.startsWith('audio/') || AUDIO_EXTS.includes(ext);
    
    let url = '';
    let naturalW = 800;
    let naturalH = 600;
    
    if (ctx.metadata.extension === '.svg' || mimeType === 'image/svg+xml') {
      const decoder = new TextDecoder('utf-8');
      const svgText = decoder.decode(ctx.buffer);
      try {
        const vbMatch = svgText.match(/viewBox=["']\s*([0-9.-]+)\s+([0-9.-]+)\s+([0-9.-]+)\s+([0-9.-]+)\s*["']/i);
        if (vbMatch) {
          const vw = parseFloat(vbMatch[3]);
          const vh = parseFloat(vbMatch[4]);
          if (vw > 0 && vh > 0) {
            naturalW = vw;
            naturalH = vh;
          }
        } else {
          const wMatch = svgText.match(/width=["']([0-9.]+)(?:px)?["']/i);
          const hMatch = svgText.match(/height=["']([0-9.]+)(?:px)?["']/i);
          if (wMatch && hMatch) {
            naturalW = parseFloat(wMatch[1]) || naturalW;
            naturalH = parseFloat(hMatch[1]) || naturalH;
          }
        }
      } catch {}
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
      video.style.borderRadius = '8px';
      video.style.boxShadow = '0 8px 30px rgba(0,0,0,0.3)';
      video.style.backgroundColor = '#000000';
      video.style.objectFit = 'contain';
      video.style.transition = 'transform 0.2s ease';
      element = video;
      mediaElement = video;

      const onMeta = () => {
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          naturalW = video.videoWidth;
          naturalH = video.videoHeight;
        }
        updateBaseDimensions();
        applyTransform();
      };

      if (video.readyState >= 1 && video.videoWidth > 0) {
        naturalW = video.videoWidth;
        naturalH = video.videoHeight;
      } else {
        video.addEventListener('loadedmetadata', onMeta, { once: true });
        video.addEventListener('canplay', onMeta, { once: true });
      }
    } else if (isAudio) {
      const audioCard = document.createElement('div');
      audioCard.className = 'fp-audio-card';

      // 1. Vinyl Disc Artwork
      const artWrapper = document.createElement('div');
      artWrapper.className = 'fp-audio-artwork-wrapper';
      const disc = document.createElement('div');
      disc.className = 'fp-audio-disc';
      const discCenter = document.createElement('div');
      discCenter.className = 'fp-audio-disc-center';
      const discHole = document.createElement('div');
      discHole.className = 'fp-audio-disc-hole';
      discCenter.appendChild(discHole);
      disc.appendChild(discCenter);
      artWrapper.appendChild(disc);
      audioCard.appendChild(artWrapper);

      // 2. Track Info & Badges
      const info = document.createElement('div');
      info.className = 'fp-audio-info';
      const title = document.createElement('div');
      title.className = 'fp-audio-title';
      title.textContent = ctx.metadata.name || 'Audio Track';
      
      const badges = document.createElement('div');
      badges.className = 'fp-audio-badges';
      
      const extTag = document.createElement('span');
      extTag.className = 'fp-audio-ext-tag';
      const cleanExt = (ext || '.mp3').replace('.', '').toUpperCase();
      extTag.textContent = `${cleanExt} AUDIO`;
      badges.appendChild(extTag);

      const timeTag = document.createElement('span');
      timeTag.className = 'fp-audio-time-tag';
      timeTag.textContent = '0:00';
      badges.appendChild(timeTag);

      info.appendChild(title);
      info.appendChild(badges);
      audioCard.appendChild(info);

      // 3. Animated Waveform Equalizer Bars
      const waveform = document.createElement('div');
      waveform.className = 'fp-audio-waveform';
      for (let i = 0; i < 16; i++) {
        const bar = document.createElement('div');
        bar.className = 'fp-audio-wave-bar';
        waveform.appendChild(bar);
      }
      audioCard.appendChild(waveform);

      // 4. Native audio element
      const nativeWrapper = document.createElement('div');
      nativeWrapper.className = 'fp-audio-native-wrapper';
      const audio = document.createElement('audio');
      audio.src = url;
      audio.controls = true;
      nativeWrapper.appendChild(audio);
      audioCard.appendChild(nativeWrapper);

      const onPlay = () => {
        disc.classList.add('playing');
        waveform.classList.add('playing');
      };
      const onPause = () => {
        disc.classList.remove('playing');
        waveform.classList.remove('playing');
      };
      const formatTime = (secs: number) => {
        if (!isFinite(secs) || isNaN(secs)) return '0:00';
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
      };
      const onTimeUpdate = () => {
        timeTag.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
      };
      const onLoadedMetadata = () => {
        timeTag.textContent = `0:00 / ${formatTime(audio.duration)}`;
      };

      audio.addEventListener('play', onPlay);
      audio.addEventListener('pause', onPause);
      audio.addEventListener('timeupdate', onTimeUpdate);
      audio.addEventListener('loadedmetadata', onLoadedMetadata);

      element = audioCard;
      mediaElement = audio;
    } else {
      element = document.createElement('div');
      element.textContent = 'Unsupported media type';
    }
    
    const scrollWrapper = document.createElement('div');
    scrollWrapper.className = 'fp-media-scroll-wrapper';
    scrollWrapper.style.minWidth = '100%';
    scrollWrapper.style.minHeight = '100%';
    scrollWrapper.style.width = isAudio ? '100%' : 'max-content';
    scrollWrapper.style.height = isAudio ? '100%' : 'max-content';
    scrollWrapper.style.display = 'flex';
    scrollWrapper.style.flexDirection = 'column';
    scrollWrapper.style.alignItems = 'center';
    scrollWrapper.style.justifyContent = isAudio ? 'center' : 'flex-start';
    scrollWrapper.style.padding = '16px';
    scrollWrapper.style.boxSizing = 'border-box';

    const sizer = document.createElement('div');
    sizer.className = 'fp-media-sizer';
    sizer.style.position = 'relative';
    sizer.style.flexShrink = '0';
    sizer.style.display = 'flex';
    sizer.style.justifyContent = 'center';
    sizer.style.alignItems = 'center';
    sizer.style.margin = 'auto 0';
    if (isAudio) {
      sizer.style.width = '100%';
      sizer.style.maxWidth = '520px';
      sizer.style.margin = 'auto';
    }

    sizer.appendChild(element);
    scrollWrapper.appendChild(sizer);

    ctx.container.style.overflow = 'auto';
    ctx.container.style.padding = '0';
    ctx.container.innerHTML = '';
    ctx.container.appendChild(scrollWrapper);

    let baseW = naturalW;
    let baseH = naturalH;
    let fitMode: 'width' | 'page' = ((ctx as any)?.options?.fitMode as any) || 'width';
    let isUserZoomed = false;

    const updateBaseDimensions = () => {
      if (!isImage && !isVideo) return;
      if (isImage) {
        const img = element as HTMLImageElement;
        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
          naturalW = img.naturalWidth;
          naturalH = img.naturalHeight;
        }
      } else if (isVideo) {
        const vid = element as HTMLVideoElement;
        if (vid.videoWidth > 0 && vid.videoHeight > 0) {
          naturalW = vid.videoWidth;
          naturalH = vid.videoHeight;
        }
      }

      const availW = Math.max(100, ctx.container.clientWidth - 32);
      const availH = Math.max(100, ctx.container.clientHeight - 32);

      let fitRatio: number;
      if (fitMode === 'page') {
        fitRatio = Math.min(availW / naturalW, availH / naturalH);
      } else {
        fitRatio = availW / naturalW;
      }
      baseW = Math.max(1, Math.round(naturalW * fitRatio));
      baseH = Math.max(1, Math.round(naturalH * fitRatio));
    };

    const applyTransform = () => {
      if (isImage || isVideo) {
        if (!isUserZoomed) {
          updateBaseDimensions();
        }
        const availH = Math.max(100, ctx.container.clientHeight - 32);
        const isRotated90 = (rotation % 180 !== 0);
        const boxW = Math.round((isRotated90 ? baseH : baseW) * currentZoom);
        const boxH = Math.round((isRotated90 ? baseW : baseH) * currentZoom);

        sizer.style.width = `${boxW}px`;
        sizer.style.height = `${boxH}px`;
        sizer.style.margin = boxH < availH ? 'auto 0' : '0';

        const elW = isRotated90 ? boxH : boxW;
        const elH = isRotated90 ? boxW : boxH;
        element.style.width = `${elW}px`;
        element.style.height = `${elH}px`;
        element.style.maxWidth = 'none';
        element.style.maxHeight = 'none';
        element.style.transform = rotation ? `rotate(${rotation}deg)` : 'none';
        element.style.transformOrigin = 'center center';
        element.style.flexShrink = '0';
      } else {
        if (!isAudio) {
          element.style.transform = `scale(${currentZoom}) rotate(${rotation}deg)`;
        }
      }
    };

    updateBaseDimensions();
    applyTransform();

    if (isImage) {
      const img = element as HTMLImageElement;
      if (img.complete && img.naturalWidth > 0) {
        updateBaseDimensions();
        applyTransform();
      } else {
        img.onload = () => {
          updateBaseDimensions();
          applyTransform();
        };
      }
    }

    const ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
          if (!isUserZoomed && currentZoom === 1.0) {
            updateBaseDimensions();
            applyTransform();
          }
        })
      : null;
    ro?.observe(ctx.container);

    const cleanup = () => {
      ro?.disconnect();
      if (mediaElement) {
        mediaElement.pause();
        mediaElement.src = '';
      }
      if (url) URL.revokeObjectURL(url);
      scrollWrapper.remove();
      ctx.container.innerHTML = '';
    };

    ctx.signal.addEventListener('abort', cleanup);

    return {
      destroy: cleanup,
      zoomIn: isImage ? () => {
        isUserZoomed = true;
        currentZoom = Math.min(5.0, Math.round((currentZoom + 0.15) * 100) / 100);
        applyTransform();
      } : undefined,
      zoomOut: isImage ? () => {
        isUserZoomed = true;
        currentZoom = Math.max(0.1, Math.round((currentZoom - 0.15) * 100) / 100);
        applyTransform();
      } : undefined,
      getZoom: isImage ? () => currentZoom : undefined,
      setZoom: isImage ? (level: number) => {
        isUserZoomed = true;
        currentZoom = level;
        applyTransform();
      } : undefined,
      fitToPage: () => {
        if (isImage || isVideo) {
          isUserZoomed = false;
          fitMode = 'page';
          currentZoom = 1.0;
          rotation = 0;
          ctx.container.scrollTop = 0;
          ctx.container.scrollLeft = 0;
          updateBaseDimensions();
          applyTransform();
        } else if (isAudio) {
          ctx.container.scrollTop = 0;
          ctx.container.scrollLeft = 0;
          currentZoom = 1.0;
        }
      },
      fitToWidth: () => {
        if (isImage || isVideo) {
          isUserZoomed = false;
          fitMode = 'width';
          currentZoom = 1.0;
          rotation = 0;
          ctx.container.scrollTop = 0;
          ctx.container.scrollLeft = 0;
          updateBaseDimensions();
          applyTransform();
        } else if (isAudio) {
          ctx.container.scrollTop = 0;
          ctx.container.scrollLeft = 0;
          currentZoom = 1.0;
        }
      },
      resetZoom: () => {
        if (isImage || isVideo) {
          isUserZoomed = false;
          fitMode = ((ctx as any)?.options?.fitMode as any) || 'width';
          currentZoom = 1.0;
          rotation = 0;
          ctx.container.scrollTop = 0;
          ctx.container.scrollLeft = 0;
          updateBaseDimensions();
          applyTransform();
        } else if (isAudio) {
          ctx.container.scrollTop = 0;
          ctx.container.scrollLeft = 0;
          currentZoom = 1.0;
        }
      },
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
