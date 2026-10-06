'use client';

import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import Image from 'next/image';
import * as THREE from 'three';
import { publishActiveCard } from '@/lib/activeCard';

export interface InfiniteGalleryProps {
  images: string[];
  flyImages?: string[];
  speed?: number;
  className?: string;
  style?: React.CSSProperties;
}

interface ScrollState {
  velocity: number;
  flyVelocity: number;
  progress: number;
  autoPlay: boolean;
  lastInteraction: number;
}

interface GalleryObjects {
  images: string[];
  materials: THREE.ShaderMaterial[];
  textures: THREE.Texture[];
  flyImages: string[];
  flyMaterials: THREE.ShaderMaterial[];
  flyTextures: THREE.Texture[];
  sceneW?: number;
  sceneH?: number;
}

interface PlaneLayout {
  startX: number;
  startY: number;
  parkZ: number;
}

const MAX_BLUR = 7;
const FADE_START = 0.04;
const FADE_END = 0.16;
const BLUR_END = 0.14;
const TRACK_HALF = 0.45;
const STAGGER = 0.5;
const START_Z = -26;
const DEFAULT_SCENE_W = 2376;
const DEFAULT_SCENE_H = 1932;
const MAX_HORIZONTAL_OFFSET = 8;
const MAX_VERTICAL_OFFSET = 8;
const STACK_SCALE = 0.75;
const STACK_Y = 0.5;
const STACK_RANK = [3, 6, 2, 0, 8, 7, 4, 1, 5];
const FLY_DEPTH_RANGE = 50;
const FLY_CARD_HEIGHT = 2.6;
const FLY_FADE_IN_START = 0.04;
const FLY_FADE_IN_END = 0.16;
const FLY_FADE_OUT_START = 0.44;
const FLY_FADE_OUT_END = 0.49;
const FLY_BLUR_IN_END = 0.14;
const FLY_BLUR_OUT_START = 0.42;

const spatialOffset = (i: number) => {
  const horizontalAngle = (i * 2.618) % (Math.PI * 2);
  const verticalAngle = (i * 1.618 + Math.PI / 3) % (Math.PI * 2);
  const horizontalRadius = (i % 3) * 1.2;
  const verticalRadius = ((i + 1) % 4) * 0.8;
  let dx = (Math.sin(horizontalAngle) * horizontalRadius * MAX_HORIZONTAL_OFFSET) / 3;
  let dy = (Math.cos(verticalAngle) * verticalRadius * MAX_VERTICAL_OFFSET) / 4;
  if (Math.abs(dx) < 1e-4 && Math.abs(dy) < 1e-4) {
    dx = Math.cos(i * 2.399);
    dy = Math.sin(i * 2.399);
  }
  return { dx, dy };
};

const createGalleryMaterial = (texelSize: THREE.Vector2) =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      map: { value: null },
      texelSize: { value: texelSize },
      opacity: { value: 1.0 },
      blurAmount: { value: 0.0 },
      scrollForce: { value: 0.0 },
    },
    vertexShader: `
      uniform float scrollForce;
      varying vec2 vUv;

      void main() {
        vUv = uv;
        vec3 pos = position;

        float curveIntensity = scrollForce * 0.3;
        float distanceFromCenter = length(pos.xy);
        float curve = distanceFromCenter * distanceFromCenter * curveIntensity;

        float ripple1 = sin(pos.x * 2.0 + scrollForce * 3.0) * 0.02;
        float ripple2 = sin(pos.y * 2.5 + scrollForce * 2.0) * 0.015;
        float clothEffect = (ripple1 + ripple2) * abs(curveIntensity) * 2.0;

        pos.z -= (curve + clothEffect);

        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D map;
      uniform vec2 texelSize;
      uniform float opacity;
      uniform float blurAmount;
      uniform float scrollForce;
      varying vec2 vUv;

      void main() {
        vec4 color = texture2D(map, vUv);

        if (blurAmount > 0.0) {
          vec2 step = texelSize * blurAmount * 2.0;
          vec4 blurred = vec4(0.0);
          float total = 0.0;
          for (float x = -2.0; x <= 2.0; x += 1.0) {
            for (float y = -2.0; y <= 2.0; y += 1.0) {
              vec2 offset = vec2(x, y) * step;
              float weight = 1.0 / (1.0 + length(vec2(x, y)));
              blurred += texture2D(map, vUv + offset) * weight;
              total += weight;
            }
          }
          color = blurred / total;
        }

        float curveHighlight = abs(scrollForce) * 0.05;
        color.rgb += vec3(curveHighlight * 0.1);

        gl_FragColor = vec4(color.rgb, color.a * opacity);
      }
    `,
  });

function GalleryScene({
  images,
  flyImages,
  scrollRef,
}: {
  images: string[];
  flyImages: string[];
  scrollRef: React.RefObject<ScrollState>;
}) {
  const meshes = useRef<(THREE.Mesh | null)[]>([]);
  const flyMeshes = useRef<(THREE.Mesh | null)[]>([]);
  const flyZRef = useRef<number[]>([]);
  const objectsRef = useRef<GalleryObjects | null>(null);

  const count = images.length;
  const flyCount = flyImages.length;

  const layout = useMemo<PlaneLayout[]>(() => {
    return images.map((_, i) => {
      const { dx, dy } = spatialOffset(i);
      const rank = STACK_RANK[i] ?? i;
      return { startX: dx, startY: dy, parkZ: -6 + rank * 0.15 };
    });
  }, [images]);

  const flyLayout = useMemo(() => {
    return flyImages.map((_, i) => {
      const horizontalAngle = (i * 2.618) % (Math.PI * 2);
      const verticalAngle = (i * 1.618 + Math.PI / 3) % (Math.PI * 2);
      const horizontalRadius = (i % 3) * 1.2;
      const verticalRadius = ((i + 1) % 4) * 0.8;
      return {
        x: (Math.sin(horizontalAngle) * horizontalRadius * MAX_HORIZONTAL_OFFSET) / 3,
        y: (Math.cos(verticalAngle) * verticalRadius * MAX_VERTICAL_OFFSET) / 4,
      };
    });
  }, [flyImages]);

  const ensureObjects = () => {
    const current = objectsRef.current;
    if (
      current &&
      current.images === images &&
      current.flyImages === flyImages
    ) {
      return current;
    }
    if (current) {
      current.materials.forEach((material) => material.dispose());
      current.flyMaterials.forEach((material) => material.dispose());
      current.textures.forEach((texture) => texture.dispose());
      current.flyTextures.forEach((texture) => texture.dispose());
    }
    const loader = new THREE.TextureLoader();
    const prepare = (src: string) => {
      const texture = loader.load(src);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      return texture;
    };
    const textures = images.map(prepare);
    const flyTextures = flyImages.map(prepare);
    const texel = new THREE.Vector2(1 / 2376, 1 / 1416);
    const materials = textures.map((texture) => {
      const material = createGalleryMaterial(texel.clone());
      material.uniforms.map.value = texture;
      return material;
    });
    const flyMaterials = flyTextures.map((texture) => {
      const material = createGalleryMaterial(texel.clone());
      material.uniforms.map.value = texture;
      return material;
    });
    const objects: GalleryObjects = {
      images,
      materials,
      textures,
      flyImages,
      flyMaterials,
      flyTextures,
    };
    objectsRef.current = objects;
    return objects;
  };

  useFrame((state, delta) => {
    const objects = ensureObjects();
    const d = Math.min(delta, 0.05);
    const scroll = scrollRef.current;

    if (!scroll.autoPlay && Date.now() - scroll.lastInteraction > 3000) {
      scroll.autoPlay = true;
    }
    const timelineEnd = (count - 1) * STAGGER + 1;
    if (scroll.autoPlay && scroll.progress < timelineEnd) {
      scroll.velocity += 0.25 * d;
    }
    scroll.progress = Math.min(timelineEnd, Math.max(0, scroll.progress + scroll.velocity * d * 5));
    if (scroll.autoPlay) {
      scroll.flyVelocity += 0.25 * d;
    }
    scroll.flyVelocity *= Math.pow(0.95, d * 60);
    scroll.velocity *= Math.pow(0.95, d * 60);

    publishActiveCard(
      scroll.progress >= timelineEnd
        ? null
        : Math.min(count - 1, Math.floor(scroll.progress / STAGGER)),
    );

    for (const material of objects.materials) {
      material.uniforms.scrollForce.value = scroll.velocity;
    }
    for (const material of objects.flyMaterials) {
      material.uniforms.scrollForce.value = scroll.flyVelocity;
    }

    if (!objects.sceneW) {
      let sceneW = 0;
      let sceneH = 0;
      let ready = true;
      for (const texture of objects.textures) {
        const image = texture.image as { width?: number; height?: number } | undefined;
        if (!image?.width || !image?.height) {
          ready = false;
          break;
        }
        sceneW = Math.max(sceneW, image.width);
        sceneH = Math.max(sceneH, image.height);
      }
      if (ready && sceneW > 0 && sceneH > 0) {
        objects.sceneW = sceneW;
        objects.sceneH = sceneH;
      }
    }
    const sceneW = objects.sceneW || DEFAULT_SCENE_W;
    const sceneH = objects.sceneH || DEFAULT_SCENE_H;

    const perspective = state.camera as THREE.PerspectiveCamera;
    const fovScale = Math.tan((perspective.fov * Math.PI) / 360);
    const aspect = state.size.width / Math.max(state.size.height, 1);

    for (let i = 0; i < count; i++) {
      const material = objects.materials[i];
      const texture = objects.textures[i];
      const planeLayout = layout[i];
      const mesh = meshes.current[i];
      if (!material || !texture || !planeLayout || !mesh) continue;

      if (mesh.material !== material) {
        mesh.material = material;
      }

      const image = texture.image as { width?: number; height?: number } | undefined;
      if (image?.width && image?.height) {
        material.uniforms.texelSize.value.set(1 / image.width, 1 / image.height);
      }

      const local = Math.min(1, Math.max(0, scroll.progress - i * STAGGER));
      const eased =
        local < 0.5 ? 4 * local * local * local : 1 - Math.pow(-2 * local + 2, 3) / 2;
      const p = local * TRACK_HALF;

      const parkDepth = Math.abs(planeLayout.parkZ);
      const parkVisHeight = 2 * fovScale * parkDepth;
      const parkVisWidth = parkVisHeight * aspect;
      const worldPerPx = (parkVisWidth / sceneW) * STACK_SCALE;
      const parkWorldY = STACK_Y * fovScale * parkDepth;
      const imageW = image?.width || sceneW;
      const imageH = image?.height || sceneH;

      let opacity = 0;
      if (p > FADE_START) {
        opacity = Math.min(1, (p - FADE_START) / (FADE_END - FADE_START));
      }
      material.uniforms.opacity.value = opacity;
      material.uniforms.blurAmount.value = p >= BLUR_END ? 0 : MAX_BLUR * (1 - p / BLUR_END);

      const z = START_Z + (planeLayout.parkZ - START_Z) * eased;
      mesh.position.set(
        planeLayout.startX * (1 - eased),
        planeLayout.startY * (1 - eased) + parkWorldY * eased,
        z,
      );
      mesh.scale.set(imageW * worldPerPx, imageH * worldPerPx, 1);
      mesh.visible = opacity > 0.001;
    }

    if (flyZRef.current.length !== flyCount) {
      flyZRef.current = Array.from(
        { length: flyCount },
        (_, i) => (FLY_DEPTH_RANGE / Math.max(flyCount, 1)) * i,
      );
    }

    for (let k = 0; k < flyCount; k++) {
      const material = objects.flyMaterials[k];
      const texture = objects.flyTextures[k];
      const planeLayout = flyLayout[k];
      const mesh = flyMeshes.current[k];
      if (!material || !texture || !planeLayout || !mesh) continue;

      if (mesh.material !== material) {
        mesh.material = material;
      }

      const image = texture.image as { width?: number; height?: number } | undefined;
      if (image?.width && image?.height) {
        material.uniforms.texelSize.value.set(1 / image.width, 1 / image.height);
      }

      const newZ = flyZRef.current[k] + scroll.flyVelocity * d * 10;
      flyZRef.current[k] = ((newZ % FLY_DEPTH_RANGE) + FLY_DEPTH_RANGE) % FLY_DEPTH_RANGE;
      const normalizedPosition = flyZRef.current[k] / FLY_DEPTH_RANGE;

      let opacity = 1;
      if (normalizedPosition < FLY_FADE_IN_START) {
        opacity = 0;
      } else if (normalizedPosition <= FLY_FADE_IN_END) {
        opacity =
          (normalizedPosition - FLY_FADE_IN_START) / (FLY_FADE_IN_END - FLY_FADE_IN_START);
      } else if (normalizedPosition >= FLY_FADE_OUT_START) {
        opacity =
          normalizedPosition >= FLY_FADE_OUT_END
            ? 0
            : 1 -
              (normalizedPosition - FLY_FADE_OUT_START) /
                (FLY_FADE_OUT_END - FLY_FADE_OUT_START);
      }
      opacity = Math.max(0, Math.min(1, opacity));

      let blur = 0;
      if (normalizedPosition < 0) {
        blur = MAX_BLUR;
      } else if (normalizedPosition <= FLY_BLUR_IN_END) {
        blur = MAX_BLUR * (1 - normalizedPosition / FLY_BLUR_IN_END);
      } else if (normalizedPosition >= FLY_BLUR_OUT_START) {
        blur =
          normalizedPosition >= FLY_FADE_OUT_END
            ? MAX_BLUR
            : MAX_BLUR *
              ((normalizedPosition - FLY_BLUR_OUT_START) /
                (FLY_FADE_OUT_END - FLY_BLUR_OUT_START));
      }
      blur = Math.max(0, Math.min(MAX_BLUR, blur));

      material.uniforms.opacity.value = opacity;
      material.uniforms.blurAmount.value = blur;

      const imageW = image?.width ?? 1;
      const imageH = image?.height ?? 1;
      const aspect = imageW / imageH;
      mesh.scale.set(
        aspect > 1 ? aspect * FLY_CARD_HEIGHT : FLY_CARD_HEIGHT,
        aspect > 1 ? FLY_CARD_HEIGHT : FLY_CARD_HEIGHT / aspect,
        1,
      );
      mesh.position.set(planeLayout.x, planeLayout.y, flyZRef.current[k] - FLY_DEPTH_RANGE / 2);
      mesh.visible = opacity > 0.001;
    }
  });

  if (count === 0) return null;

  return (
    <>
      {images.map((src, i) => (
        <mesh
          key={src}
          ref={(el) => {
            meshes.current[i] = el;
          }}
          frustumCulled={false}
          visible={false}
        >
          <planeGeometry args={[1, 1]} />
        </mesh>
      ))}
      {flyImages.map((src, i) => (
        <mesh
          key={`fly-${src}`}
          ref={(el) => {
            flyMeshes.current[i] = el;
          }}
          frustumCulled={false}
          visible={false}
        >
          <planeGeometry args={[1, 1, 32, 32]} />
        </mesh>
      ))}
    </>
  );
}

function FallbackGallery({ images }: { images: string[] }) {
  return (
    <div className="flex h-full w-full items-center justify-center overflow-y-auto bg-stone p-6">
      <div className="grid w-full max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {images.map((src) => (
          <div
            key={src}
            className="relative aspect-16/10 overflow-hidden rounded-lg border border-black/10 bg-white/70"
          >
            <Image
              src={src}
              alt=""
              fill
              sizes="(max-width: 640px) 100vw, 33vw"
              className="object-cover"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function InfiniteGallery({
  images,
  flyImages = [],
  speed = 1,
  className = 'h-96 w-full',
  style,
}: InfiniteGalleryProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<ScrollState>({
    velocity: 0,
    progress: 0,
    flyVelocity: 0,
    autoPlay: true,
    lastInteraction: 0,
  });

  const [webglSupported] = useState(() => {
    if (typeof document === 'undefined') return true;
    try {
      const canvas = document.createElement('canvas');
      return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
    } catch {
      return false;
    }
  });

  const handleWheel = useCallback(
    (event: WheelEvent) => {
      event.preventDefault();
      const scroll = scrollRef.current;
      scroll.velocity += event.deltaY * 0.01 * speed;
      scroll.flyVelocity += event.deltaY * 0.01 * speed;
      scroll.autoPlay = false;
      scroll.lastInteraction = Date.now();
    },
    [speed],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
        event.preventDefault();
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
        event.preventDefault();
      } else {
        return;
      }
      const direction = event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 1;
      const scroll = scrollRef.current;
      scroll.velocity += direction * 2 * speed;
      scroll.flyVelocity += direction * 2 * speed;
      scroll.autoPlay = false;
      scroll.lastInteraction = Date.now();
    },
    [speed],
  );

  useEffect(() => {
    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleWheel, handleKeyDown]);

  if (!webglSupported) {
    return (
      <div className={className} style={style}>
        <FallbackGallery images={images} />
      </div>
    );
  }

  return (
    <div ref={containerRef} className={className} style={style}>
      <Canvas
        camera={{ position: [0, 0, 0], fov: 55 }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]}
      >
        <GalleryScene images={images} flyImages={flyImages} scrollRef={scrollRef} />
      </Canvas>
    </div>
  );
}
