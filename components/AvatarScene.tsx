"use client";

import { Suspense, Component, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { Avatar } from "./Avatar";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface AvatarSceneProps {
  currentViseme: string;
  nextViseme: string;
  isPlaying: boolean;
}

// ---------------------------------------------------------------------------
// ErrorBoundary — shows the procedural fallback head if avatar.glb is missing
// ---------------------------------------------------------------------------
interface EBState { hasError: boolean }
class AvatarErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  EBState
> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(_: Error): EBState {
    return { hasError: true };
  }
  componentDidCatch(error: Error, _info: unknown) {
    const msg = [
      "[AvatarScene] Could not load /public/avatar.glb — showing fallback head.",
      "To enable the full human avatar:",
      "  1. Visit https://readyplayer.me/avatar",
      "  2. Create a female avatar, enable Morph Targets on export",
      "  3. Save the downloaded .glb as  public/avatar.glb",
    ].join("\n");
    console.warn(msg, error.message);
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Studio background elements (dark gradient planes)
// ---------------------------------------------------------------------------
function StudioBackground() {
  return (
    <>
      {/* Main backdrop */}
      <mesh position={[0, 0, -2.2]} receiveShadow>
        <planeGeometry args={[10, 7]} />
        <meshStandardMaterial
          color="#12192e"
          roughness={1}
          metalness={0}
        />
      </mesh>

      {/* Subtle gradient circle / vignette behind avatar — slightly lighter */}
      <mesh position={[0, 0, -2.1]}>
        <circleGeometry args={[1.4, 64]} />
        <meshStandardMaterial
          color="#1e2d50"
          roughness={1}
          metalness={0}
          transparent
          opacity={0.85}
        />
      </mesh>

      {/* Floor reflection plane */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -1.0, 0]}
        receiveShadow
      >
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial
          color="#0d1220"
          roughness={0.85}
          metalness={0.15}
        />
      </mesh>
    </>
  );
}

// ---------------------------------------------------------------------------
// Procedural fallback head (shown while GLB loads OR if file is missing)
// ---------------------------------------------------------------------------
function FallbackHead() {
  return (
    <group position={[0, 0, 0]}>
      {/* Head */}
      <mesh castShadow>
        <sphereGeometry args={[0.22, 48, 48]} />
        <meshStandardMaterial
          color="#e8c4a0"
          roughness={0.75}
          metalness={0.02}
        />
      </mesh>

      {/* Neck */}
      <mesh position={[0, -0.3, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.09, 0.22, 24]} />
        <meshStandardMaterial color="#e0bc98" roughness={0.8} />
      </mesh>

      {/* Shoulders / torso */}
      <mesh position={[0, -0.7, 0]} castShadow>
        <capsuleGeometry args={[0.22, 0.55, 12, 24]} />
        <meshStandardMaterial
          color="#2a3b6e"
          roughness={0.6}
          metalness={0.1}
        />
      </mesh>

      {/* Left eye */}
      <mesh position={[-0.085, 0.04, 0.195]}>
        <sphereGeometry args={[0.026, 24, 24]} />
        <meshStandardMaterial color="#1a1a2e" roughness={0.1} metalness={0.3} />
      </mesh>

      {/* Right eye */}
      <mesh position={[0.085, 0.04, 0.195]}>
        <sphereGeometry args={[0.026, 24, 24]} />
        <meshStandardMaterial color="#1a1a2e" roughness={0.1} metalness={0.3} />
      </mesh>

      {/* Eye whites */}
      <mesh position={[-0.085, 0.04, 0.188]}>
        <sphereGeometry args={[0.032, 24, 24]} />
        <meshStandardMaterial color="#f5f5f5" roughness={0.3} />
      </mesh>
      <mesh position={[0.085, 0.04, 0.188]}>
        <sphereGeometry args={[0.032, 24, 24]} />
        <meshStandardMaterial color="#f5f5f5" roughness={0.3} />
      </mesh>

      {/* Lips */}
      <mesh position={[0, -0.09, 0.21]}>
        <capsuleGeometry args={[0.022, 0.065, 8, 16]} />
        <meshStandardMaterial color="#c8857a" roughness={0.5} metalness={0.0} />
      </mesh>
      <mesh position={[0, -0.115, 0.21]}>
        <capsuleGeometry args={[0.018, 0.058, 8, 16]} />
        <meshStandardMaterial color="#b87068" roughness={0.45} metalness={0.0} />
      </mesh>

      {/* Nose bridge */}
      <mesh position={[0, 0.0, 0.22]}>
        <capsuleGeometry args={[0.012, 0.04, 8, 16]} />
        <meshStandardMaterial color="#e0b896" roughness={0.7} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton (while model is being fetched)
// ---------------------------------------------------------------------------
function LoadingAvatar() {
  return (
    <group position={[0, 0, 0]}>
      <mesh>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshStandardMaterial
          color="#1e2d50"
          roughness={1}
          wireframe
          transparent
          opacity={0.4}
        />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// AvatarScene — exported, received by page.tsx
// ---------------------------------------------------------------------------
export function AvatarScene({ currentViseme, nextViseme, isPlaying }: AvatarSceneProps) {
  return (
    <div
      className="w-full h-full overflow-hidden"
      style={{ background: "#0d1220", position: "relative" }}
    >
      <Canvas
        /* Camera looks at face center — avatar is auto-shifted so head is at y≈0 */
        camera={{ position: [0, 0.05, 2.0], fov: 28, near: 0.1, far: 50 }}
        onCreated={({ camera }) => camera.lookAt(0, 0, 0)}
        shadows
        gl={{
          antialias:           true,
          toneMapping:         THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
          powerPreference:     "high-performance",
        }}
      >
        {/* Atmospheric fog */}
        <fog attach="fog" args={["#0d1220", 6, 14]} />

        {/* ── Scene geometry ─────────────────────────────────────────────── */}
        <StudioBackground />

        {/* ── 3-point studio lighting ────────────────────────────────────── */}

        {/* Key light — warm white, top-left (main illumination + shadows) */}
        <directionalLight
          position={[-2.5, 3.0, 3]}
          intensity={2.8}
          color="#fff8ee"
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-near={0.5}
          shadow-camera-far={20}
          shadow-camera-left={-4}
          shadow-camera-right={4}
          shadow-camera-top={4}
          shadow-camera-bottom={-4}
          shadow-bias={-0.0005}
        />

        {/* Fill light — cool blue-white, right side (lifts shadows) */}
        <directionalLight
          position={[3.5, 1.5, 2.5]}
          intensity={0.9}
          color="#d8eeff"
        />

        {/* Rim / hair light — purple accent, from behind (separation) */}
        <pointLight
          position={[0.3, 1.5, -1.8]}
          intensity={2.0}
          color="#a07cd8"
          distance={7}
          decay={2}
        />

        {/* Second rim — opposite shoulder for dimension */}
        <pointLight
          position={[-1.5, 0.5, -1.2]}
          intensity={0.6}
          color="#6090d0"
          distance={5}
          decay={2}
        />

        {/* Soft ambient — keeps shadow areas from going pitch black */}
        <ambientLight intensity={1.2} color="#e8f0ff" />

        {/* ── Avatar (GLB) with error + loading fallbacks ─────────────────── */}
        <AvatarErrorBoundary fallback={<FallbackHead />}>
          <Suspense fallback={<LoadingAvatar />}>
            <Avatar
              currentViseme={currentViseme}
              nextViseme={nextViseme}
              isPlaying={isPlaying}
            />
          </Suspense>
        </AvatarErrorBoundary>

      </Canvas>

      {/* ── CSS vignette overlay (replaces postprocessing Vignette) ───── */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "inherit",
          background:
            "radial-gradient(ellipse at 50% 50%, transparent 42%, rgba(0,0,0,0.72) 100%)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
