"use client";

import { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface Avatar3DProps {
  currentViseme: string; // A, B, C, D, E, F, G, H, X
  emotionIntensity?: number; // 0-1 for future emotions
}

/**
 * Rhubarb Viseme to Morph Target Index Mapping
 *
 * Rhubarb outputs 9 viseme shapes:
 * X - Rest position (mouth closed)
 * A - Open mouth (as in "car")
 * B - Lips together (as in "bed")
 * C - Slightly open (as in "bed")
 * D - Wide open (as in "day")
 * E - Rounded (as in "orange")
 * F - Upper teeth on lower lip (as in "food")
 * G - Tongue between teeth (as in "thing")
 * H - Very open (as in "eat")
 */
const VISEME_TO_MORPH_TARGET: Record<string, number> = {
  X: 0, // Rest/closed
  A: 1, // Open (ah)
  B: 2, // Lips together (m, b, p)
  C: 3, // Slightly open (e)
  D: 4, // Wide (ay)
  E: 5, // Rounded (oh)
  F: 6, // Teeth on lip (f, v)
  G: 7, // Tongue visible (th)
  H: 8, // Very open (ee)
};

/**
 * Avatar3D Component
 *
 * Renders a simple 3D head with mouth animation based on visemes.
 * For production, replace with actual GLB/GLTF model with blend shapes.
 */
export function Avatar3D({
  currentViseme,
  emotionIntensity = 0,
}: Avatar3DProps) {
  const headRef = useRef<THREE.Group>(null);
  const mouthRef = useRef<THREE.Mesh>(null);
  const targetVisemeRef = useRef<string>("X");
  const blinkTimerRef = useRef<number>(0);

  useEffect(() => {
    targetVisemeRef.current = currentViseme;
  }, [currentViseme]);

  // Animation loop - smooth transitions and idle animations
  useFrame((state, delta) => {
    if (!mouthRef.current || !headRef.current) return;

    const time = state.clock.getElapsedTime();

    // === MOUTH ANIMATION ===
    // Map viseme to mouth scale (placeholder for morph targets)
    const mouthScales: Record<string, { x: number; y: number; z: number }> = {
      X: { x: 0.8, y: 0.2, z: 0.5 }, // Closed
      A: { x: 1.0, y: 0.8, z: 0.7 }, // Open wide
      B: { x: 0.7, y: 0.2, z: 0.4 }, // Lips together
      C: { x: 0.9, y: 0.4, z: 0.6 }, // Slightly open
      D: { x: 1.2, y: 0.7, z: 0.6 }, // Wide
      E: { x: 0.8, y: 0.5, z: 0.7 }, // Rounded
      F: { x: 0.9, y: 0.3, z: 0.5 }, // F/V
      G: { x: 0.8, y: 0.4, z: 0.6 }, // TH
      H: { x: 1.1, y: 0.6, z: 0.6 }, // EE
    };

    const targetScale =
      mouthScales[targetVisemeRef.current] || mouthScales["X"];

    // Smooth interpolation (lerp) to target scale
    const lerpSpeed = 15; // Higher = faster transitions
    mouthRef.current.scale.x +=
      (targetScale.x - mouthRef.current.scale.x) * delta * lerpSpeed;
    mouthRef.current.scale.y +=
      (targetScale.y - mouthRef.current.scale.y) * delta * lerpSpeed;
    mouthRef.current.scale.z +=
      (targetScale.z - mouthRef.current.scale.z) * delta * lerpSpeed;

    // === IDLE ANIMATIONS ===

    // Subtle breathing motion
    const breathingOffset = Math.sin(time * 0.5) * 0.02;
    headRef.current.position.y = breathingOffset;

    // Gentle head rotation
    const headRotation = Math.sin(time * 0.3) * 0.05;
    headRef.current.rotation.y = headRotation;

    // Slight head tilt
    headRef.current.rotation.z = Math.sin(time * 0.4) * 0.02;

    // === BLINKING ===
    // Simple blink every 3-5 seconds
    blinkTimerRef.current += delta;
    if (blinkTimerRef.current > 3 + Math.random() * 2) {
      blinkTimerRef.current = 0;
      // Blink animation would go here with eyelid morph targets
    }
  });

  return (
    <group ref={headRef} position={[0, 0, 0]}>
      {/* Head - Placeholder sphere (replace with actual 3D model) */}
      <mesh position={[0, 0.2, 0]}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial color="#ffdbac" roughness={0.6} metalness={0.1} />
      </mesh>

      {/* Eyes */}
      <mesh position={[-0.3, 0.4, 0.7]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color="#2c2c2c" />
      </mesh>
      <mesh position={[0.3, 0.4, 0.7]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color="#2c2c2c" />
      </mesh>

      {/* Eye highlights */}
      <mesh position={[-0.25, 0.45, 0.78]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={0.5}
        />
      </mesh>
      <mesh position={[0.35, 0.45, 0.78]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={0.5}
        />
      </mesh>

      {/* Mouth - Animated based on viseme */}
      <mesh ref={mouthRef} position={[0, -0.2, 0.75]}>
        <boxGeometry args={[0.5, 0.2, 0.2]} />
        <meshStandardMaterial color="#8b4513" />
      </mesh>

      {/* Nose */}
      <mesh position={[0, 0.1, 0.85]}>
        <coneGeometry args={[0.15, 0.3, 4]} />
        <meshStandardMaterial color="#ffcba4" />
      </mesh>
    </group>
  );
}

/**
 * PRODUCTION NOTES:
 *
 * To use a real 3D model with blend shapes:
 *
 * 1. Create/obtain a 3D head model with 9 blend shapes matching Rhubarb visemes
 * 2. Export as GLB/GLTF format
 * 3. Place in public/models/avatar.glb
 * 4. Replace the placeholder geometry with:
 *
 * import { useGLTF } from '@react-three/drei';
 *
 * const { scene } = useGLTF('/models/avatar.glb');
 * const meshRef = useRef<THREE.SkinnedMesh>();
 *
 * useEffect(() => {
 *   scene.traverse((child) => {
 *     if (child instanceof THREE.SkinnedMesh && child.morphTargetInfluences) {
 *       meshRef.current = child;
 *     }
 *   });
 * }, [scene]);
 *
 * // In useFrame:
 * if (meshRef.current?.morphTargetInfluences) {
 *   const influences = meshRef.current.morphTargetInfluences;
 *   const targetIndex = VISEME_TO_MORPH_TARGET[targetVisemeRef.current] || 0;
 *
 *   for (let i = 0; i < influences.length; i++) {
 *     const target = i === targetIndex ? 1.0 : 0.0;
 *     influences[i] += (target - influences[i]) * delta * 10;
 *   }
 * }
 *
 * return <primitive object={scene} />;
 */
