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
        label: 'Reset Camera View',
        type: 'button',
        group: 'zoom',
        execute: () => instance.fitToPage?.()
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
      }
    ];
  }

  async render(ctx: RenderContext): Promise<PreviewInstance> {
    const container = ctx.container;
    container.innerHTML = '';
    container.style.overflow = 'hidden';
    container.style.position = 'relative';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.background = '#1a1a1a';

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    // 1. Setup Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1e1e24);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // 2. Setup OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // 3. Add Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight1.position.set(100, 200, 100);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight2.position.set(-100, -100, -100);
    scene.add(dirLight2);

    // 4. Add Grid Helper
    const grid = new THREE.GridHelper(200, 20, 0x444444, 0x222222);
    scene.add(grid);

    // 5. Load and center 3D Model
    let meshGroup = new THREE.Group();
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

    scene.add(meshGroup);

    // 6. Compute bounding box to frame camera nicely
    const box = new THREE.Box3().setFromObject(meshGroup);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const radius = Math.max(sphere.radius, 10);

    const fitCamera = () => {
      camera.position.set(radius * 1.5, radius * 1.2, radius * 2);
      camera.lookAt(0, 0, 0);
      controls.target.set(0, 0, 0);
      controls.update();
    };

    fitCamera();

    // 7. Animation Loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // 8. Handle Resize
    const resizeObserver = new ResizeObserver(() => {
      const newWidth = container.clientWidth || 800;
      const newHeight = container.clientHeight || 600;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
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
      container.innerHTML = '';
    };

    ctx.signal.addEventListener('abort', cleanup);

    return {
      destroy: cleanup,
      zoomIn: () => {
        camera.position.multiplyScalar(0.85);
        controls.update();
      },
      zoomOut: () => {
        camera.position.multiplyScalar(1.15);
        controls.update();
      },
      fitToPage: fitCamera,
      rotateCW: () => {
        isWireframe = !isWireframe;
        materials.forEach(m => {
          (m as THREE.MeshStandardMaterial).wireframe = isWireframe;
        });
      },
      download: () => {
        downloadFile(ctx.buffer, ctx.metadata.name || `model${ext || '.stl'}`);
      }
    };
  }
}

export function threeDPlugin(): ThreeDPlugin {
  return new ThreeDPlugin();
}

export default ThreeDPlugin;
