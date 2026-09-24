import type { 
  FileInfo, 
  RenderContext, 
  ToolbarAction, 
  PreviewPlugin, 
  PreviewInstance 
} from '@patel.sumit51/core';
import { downloadFile } from '@patel.sumit51/core';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class ThreeDPlugin implements PreviewPlugin {
  id = '3d';
  name = '3D Model Preview';
  extensions = ['.stl', '.obj'];
  mimeTypes = ['model/stl', 'model/obj', 'application/sla', 'text/plain'];
  weight = 75;

  supports(file: FileInfo): boolean {
    const ext = file.metadata.extension?.toLowerCase();
    return ext === '.stl' || ext === '.obj';
  }

  getToolbarActions(instance: PreviewInstance): ToolbarAction[] {
    return [
      {
        id: 'zoom-out',
        icon: 'zoom-out',
        label: 'Zoom Out',
        type: 'button',
        group: 'zoom',
        execute: () => instance.zoomOut?.()
      },
      {
        id: 'zoom-in',
        icon: 'zoom-in',
        label: 'Zoom In',
        type: 'button',
        group: 'zoom',
        execute: () => instance.zoomIn?.()
      },
      {
        id: 'fit-page',
        icon: 'fit-page',
        label: 'Fit to Page',
        type: 'button',
        group: 'zoom',
        execute: () => instance.fitToPage?.()
      },
      {
        id: 'reset-zoom',
        icon: 'reset-zoom',
        label: 'Reset Zoom',
        type: 'button',
        group: 'zoom',
        execute: () => instance.resetZoom?.()
      },
      {
        id: 'fit-width',
        icon: 'fit-width',
        label: 'Fit to Width',
        type: 'button',
        group: 'zoom',
        execute: () => instance.fitToWidth?.()
      },
      {
        id: 'rotate-cw',
        icon: 'rotate-cw',
        label: 'Toggle Wireframe',
        type: 'button',
        group: 'view',
        execute: () => instance.rotateCW?.()
      },
      {
        id: 'download',
        icon: 'download',
        label: 'Download 3D Model',
        type: 'button',
        group: 'actions',
        execute: () => instance.download?.()
      },
      {
        id: 'open-window',
        icon: 'open-window',
        label: 'Open in Separate Full Window',
        type: 'button',
        group: 'actions',
        execute: () => {
          (instance as any).openInSeparateWindow?.();
        }
      }
    ];
  }

  async render(ctx: RenderContext): Promise<PreviewInstance> {
    const container = ctx.container;
    container.innerHTML = '';
    container.style.overflow = 'auto';
    container.style.position = 'relative';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.padding = '0';
    container.style.background = '#1a1a1a';

    let currentZoom = 1.0;
    let isUserZoomed = false;

    let baseW = Math.max(100, container.clientWidth || 800);
    let baseH = Math.max(100, container.clientHeight || 600);

    const updateBaseDimensions = () => {
      baseW = Math.max(100, container.clientWidth || 800);
      baseH = Math.max(100, container.clientHeight || 600);
    };

    // 1. Setup Scrollable Layout Structure
    const scrollWrapper = document.createElement('div');
    scrollWrapper.className = 'fp-3d-scroll-wrapper';
    scrollWrapper.style.minWidth = '100%';
    scrollWrapper.style.minHeight = '100%';
    scrollWrapper.style.width = 'max-content';
    scrollWrapper.style.height = 'max-content';
    scrollWrapper.style.display = 'flex';
    scrollWrapper.style.alignItems = 'flex-start';
    scrollWrapper.style.justifyContent = 'flex-start';
    scrollWrapper.style.boxSizing = 'border-box';

    const sizer = document.createElement('div');
    sizer.className = 'fp-3d-sizer';
    sizer.style.position = 'relative';
    sizer.style.flexShrink = '0';
    sizer.style.display = 'flex';
    sizer.style.justifyContent = 'center';
    sizer.style.alignItems = 'center';
    sizer.style.margin = 'auto';

    // 2. Setup Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1e1e24);

    const camera = new THREE.PerspectiveCamera(45, baseW / baseH, 0.1, 2000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(baseW, baseH);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;

    sizer.appendChild(renderer.domElement);
    scrollWrapper.appendChild(sizer);
    container.appendChild(scrollWrapper);

    // 3. Setup OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // 4. Add Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight1.position.set(100, 200, 100);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight2.position.set(-100, -100, -100);
    scene.add(dirLight2);

    // 5. Add Grid Helper
    const grid = new THREE.GridHelper(200, 20, 0x444444, 0x222222);
    scene.add(grid);

    // 6. Load and center 3D Model
    const meshGroup = new THREE.Group();
    let isWireframe = false;
    const ext = ctx.metadata.extension?.toLowerCase();
    const materials: THREE.Material[] = [];

    if (ext === '.stl') {
      const loader = new STLLoader();
      const geometry = loader.parse(ctx.buffer);
      geometry.computeVertexNormals();
      geometry.center();

      const material = new THREE.MeshStandardMaterial({
        color: 0x3b82f6,
        roughness: 0.4,
        metalness: 0.2
      });
      materials.push(material);

      const mesh = new THREE.Mesh(geometry, material);
      meshGroup.add(mesh);
    } else if (ext === '.obj') {
      const loader = new OBJLoader();
      const text = new TextDecoder().decode(ctx.buffer);
      const obj = loader.parse(text);

      obj.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const m = child as THREE.Mesh;
          m.geometry.computeVertexNormals();
          const mat = new THREE.MeshStandardMaterial({
            color: 0x10b981,
            roughness: 0.5,
            metalness: 0.1
          });
          materials.push(mat);
          m.material = mat;
        }
      });
      meshGroup.add(obj);
    }

    // Center meshGroup at origin
    const initialBox = new THREE.Box3().setFromObject(meshGroup);
    const center = initialBox.getCenter(new THREE.Vector3());
    meshGroup.position.sub(center);
    scene.add(meshGroup);

    // 7. Compute bounding box to frame camera nicely
    const box = new THREE.Box3().setFromObject(meshGroup);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 10;

    grid.position.y = -size.y / 2;
    const gridScale = Math.max(0.1, maxDim / 50);
    grid.scale.set(gridScale, 1, gridScale);

    const fovRad = camera.fov * (Math.PI / 180);
    let cameraDistance = (maxDim / 2) / Math.tan(fovRad / 2);
    cameraDistance = Math.max(cameraDistance * 1.5, 2);

    const fitCamera = () => {
      camera.position.set(cameraDistance * 0.8, cameraDistance * 0.6, cameraDistance);
      camera.lookAt(0, 0, 0);
      controls.target.set(0, 0, 0);
      controls.update();
    };

    fitCamera();

    // 8. Transform & Canvas Physical Sizing for Zoom & Scrollbars
    const applyZoom = () => {
      if (!isUserZoomed) {
        updateBaseDimensions();
      }
      const boxW = Math.round(baseW * currentZoom);
      const boxH = Math.round(baseH * currentZoom);

      sizer.style.width = `${boxW}px`;
      sizer.style.height = `${boxH}px`;
      const marginV = boxH < container.clientHeight ? 'auto' : '0';
      const marginH = boxW < container.clientWidth ? 'auto' : '0';
      sizer.style.margin = `${marginV} ${marginH}`;

      renderer.domElement.style.width = `${boxW}px`;
      renderer.domElement.style.height = `${boxH}px`;
      renderer.domElement.style.maxWidth = 'none';
      renderer.domElement.style.maxHeight = 'none';

      renderer.setSize(boxW, boxH, false);
      camera.aspect = boxW / boxH;
      camera.updateProjectionMatrix();
    };

    applyZoom();

    // 9. Animation Loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // 10. Handle Resize
    const resizeObserver = new ResizeObserver(() => {
      if (!isUserZoomed && currentZoom === 1.0) {
        updateBaseDimensions();
        applyZoom();
      }
    });
    resizeObserver.observe(container);

    const cleanup = () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      materials.forEach(m => m.dispose());
      meshGroup.traverse((child) => {
        if ((child as THREE.Mesh).geometry) {
          (child as THREE.Mesh).geometry.dispose();
        }
      });
      scrollWrapper.remove();
      container.innerHTML = '';
    };

    ctx.signal.addEventListener('abort', cleanup);

    return {
      destroy: cleanup,
      zoomIn: () => {
        isUserZoomed = true;
        currentZoom = Math.min(5.0, Number((currentZoom * 1.25).toFixed(2)));
        applyZoom();
      },
      zoomOut: () => {
        currentZoom = Math.max(0.2, Number((currentZoom / 1.25).toFixed(2)));
        if (currentZoom <= 1.0) {
          isUserZoomed = false;
        }
        applyZoom();
      },
      getZoom: () => currentZoom,
      setZoom: (level: number) => {
        isUserZoomed = level !== 1.0;
        currentZoom = Math.max(0.2, Math.min(5.0, level));
        applyZoom();
      },
      fitToPage: () => {
        isUserZoomed = false;
        currentZoom = 1.0;
        updateBaseDimensions();
        applyZoom();
        container.scrollTop = 0;
        container.scrollLeft = 0;
        fitCamera();
      },
      fitToWidth: () => {
        isUserZoomed = false;
        currentZoom = 1.0;
        updateBaseDimensions();
        applyZoom();
        container.scrollTop = 0;
        container.scrollLeft = 0;
        fitCamera();
      },
      resetZoom: () => {
        isUserZoomed = false;
        currentZoom = 1.0;
        updateBaseDimensions();
        applyZoom();
        container.scrollTop = 0;
        container.scrollLeft = 0;
        fitCamera();
      },
      rotateCW: () => {
        isWireframe = !isWireframe;
        materials.forEach(m => {
          (m as THREE.MeshStandardMaterial).wireframe = isWireframe;
        });
      },
      download: () => {
        downloadFile(ctx.buffer, ctx.metadata.name || `model${ext || '.stl'}`);
      },
      isSearchable: false
    };
  }
}

export function threeDPlugin(): ThreeDPlugin {
  return new ThreeDPlugin();
}

export default ThreeDPlugin;
