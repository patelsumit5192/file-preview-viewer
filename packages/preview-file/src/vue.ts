import { defineComponent, h, ref, onMounted, onBeforeUnmount, watch, type PropType } from 'vue';
import {
  FilePreviewViewer,
  getDefaultPlugins,
  type FileSource,
  type PreviewPlugin,
  type PreviewViewerOptions,
  type PreviewInstance,
} from './index';

export const FilePreview = defineComponent({
  name: 'FilePreview',
  props: {
    src: {
      type: [String, Object] as PropType<FileSource>,
      required: true,
    },
    plugins: {
      type: Array as PropType<PreviewPlugin[]>,
      default: undefined,
    },
    options: {
      type: Object as PropType<PreviewViewerOptions>,
      default: () => ({}),
    },
  },
  emits: ['loading', 'loaded', 'error', 'page-change', 'zoom-change', 'rotate', 'destroy'],
  setup(props, { emit, expose }) {
    const containerRef = ref<HTMLDivElement | null>(null);
    let viewer: FilePreviewViewer | null = null;
    let instance: PreviewInstance | null = null;

    const renderPreview = async () => {
      const el = containerRef.value;
      if (!viewer || !el || !props.src) return;
      try {
        instance = await viewer.preview(el, props.src, props.options);
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        emit('error', error);
      }
    };

    onMounted(() => {
      viewer = new FilePreviewViewer({ autoRegisterDefaults: false });
      const activePlugins = props.plugins && props.plugins.length > 0 ? props.plugins : getDefaultPlugins();
      viewer.registerPlugins(activePlugins);

      viewer.on('loading', (data) => emit('loading', data));
      viewer.on('loaded', (data) => emit('loaded', data));
      viewer.on('error', (data) => emit('error', data));
      viewer.on('page-change', (data) => emit('page-change', data));
      viewer.on('zoom-change', (data) => emit('zoom-change', data));
      viewer.on('rotate', (data) => emit('rotate', data));
      viewer.on('destroy', (data) => emit('destroy', data));

      renderPreview();
    });

    watch(() => props.src, renderPreview);
    watch(() => props.options, renderPreview, { deep: true });

    onBeforeUnmount(() => {
      viewer?.destroy();
      viewer = null;
      instance = null;
    });

    expose({
      getInstance: () => instance,
      getViewer: () => viewer,
      destroy: () => viewer?.destroy(),
    });

    return () => {
      return h('div', {
        ref: containerRef,
        style: { width: '100%', height: '100%', position: 'relative', overflow: 'hidden' },
      });
    };
  },
});

export default FilePreview;
