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
  const upperLipRef = useRef<THREE.Mesh>(null);
  const lowerLipRef = useRef<THREE.Mesh>(null);
  const tongueRef = useRef<THREE.Mesh>(null);
  const teethRef = useRef<THREE.Mesh>(null);
  const leftEyeRef = useRef<THREE.Mesh>(null);
  const rightEyeRef = useRef<THREE.Mesh>(null);
  const targetVisemeRef = useRef<string>("X");
  const blinkTimerRef = useRef<number>(0);

  useEffect(() => {
    targetVisemeRef.current = currentViseme;
  }, [currentViseme]);

  // Animation loop - smooth transitions and idle animations
  useFrame((state, delta) => {
    if (!mouthRef.current || !headRef.current || !upperLipRef.current || !lowerLipRef.current) return;

    const time = state.clock.getElapsedTime();

    // === MOUTH ANIMATION ===
    // Map viseme to mouth opening and lip positions (MUCH MORE EXAGGERATED)
    const mouthData: Record<string, { 
      mouthHeight: number; 
      mouthWidth: number;
      upperLipY: number;
      lowerLipY: number;
      lipWidth: number;
      tongueY: number;
      teethVisible: number;
    }> = {
      X: { mouthHeight: 0.1, mouthWidth: 1.0, upperLipY: 0.05, lowerLipY: -0.05, lipWidth: 1.0, tongueY: -0.3, teethVisible: 0 }, // Closed
      A: { mouthHeight: 1.2, mouthWidth: 1.1, upperLipY: 0.65, lowerLipY: -0.65, lipWidth: 1.2, tongueY: -0.2, teethVisible: 1 }, // Open wide (car)
      B: { mouthHeight: 0.1, mouthWidth: 0.9, upperLipY: 0.05, lowerLipY: -0.05, lipWidth: 0.95, tongueY: -0.3, teethVisible: 0 }, // Lips together (bed)
      C: { mouthHeight: 0.5, mouthWidth: 1.0, upperLipY: 0.3, lowerLipY: -0.3, lipWidth: 1.05, tongueY: -0.25, teethVisible: 0.5 }, // Slightly open
      D: { mouthHeight: 1.0, mouthWidth: 1.4, upperLipY: 0.55, lowerLipY: -0.55, lipWidth: 1.4, tongueY: -0.2, teethVisible: 1 }, // Wide (day)
      E: { mouthHeight: 0.7, mouthWidth: 0.85, upperLipY: 0.4, lowerLipY: -0.4, lipWidth: 0.9, tongueY: -0.25, teethVisible: 0.7 }, // Rounded (orange)
      F: { mouthHeight: 0.3, mouthWidth: 1.0, upperLipY: 0.15, lowerLipY: -0.25, lipWidth: 1.0, tongueY: -0.3, teethVisible: 0.8 }, // F/V (teeth on lip)
      G: { mouthHeight: 0.5, mouthWidth: 1.0, upperLipY: 0.3, lowerLipY: -0.3, lipWidth: 1.0, tongueY: 0.1, teethVisible: 0.6 }, // TH (tongue visible)
      H: { mouthHeight: 0.9, mouthWidth: 1.3, upperLipY: 0.5, lowerLipY: -0.5, lipWidth: 1.35, tongueY: -0.15, teethVisible: 1 }, // Very open (eat)
    };

    const targetData = mouthData[targetVisemeRef.current] || mouthData["X"];

    // Smooth interpolation (lerp) to target
    const lerpSpeed = 15;
    
    // Animate mouth cavity (inner mouth)
    const currentMouthHeight = mouthRef.current.scale.y;
    const currentMouthWidth = mouthRef.current.scale.x;
    mouthRef.current.scale.y += (targetData.mouthHeight - currentMouthHeight) * delta * lerpSpeed;
    mouthRef.current.scale.x += (targetData.mouthWidth - currentMouthWidth) * delta * lerpSpeed;
    
    // Animate upper lip
    upperLipRef.current.position.y += (targetData.upperLipY - upperLipRef.current.position.y) * delta * lerpSpeed;
    upperLipRef.current.scale.x += (targetData.lipWidth - upperLipRef.current.scale.x) * delta * lerpSpeed;
    
    // Animate lower lip
    lowerLipRef.current.position.y += (targetData.lowerLipY - lowerLipRef.current.position.y) * delta * lerpSpeed;
    lowerLipRef.current.scale.x += (targetData.lipWidth - lowerLipRef.current.scale.x) * delta * lerpSpeed;
    
    // Animate tongue
    if (tongueRef.current) {
      tongueRef.current.position.y += (targetData.tongueY - tongueRef.current.position.y) * delta * lerpSpeed;
    }
    
    // Animate teeth visibility
    if (teethRef.current) {
      const material = teethRef.current.material as THREE.MeshStandardMaterial;
      material.opacity += (targetData.teethVisible - material.opacity) * delta * lerpSpeed;
    }

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
    const blinkThreshold = 3 + Math.random() * 2;
    
    if (leftEyeRef.current && rightEyeRef.current) {
      if (blinkTimerRef.current > blinkThreshold) {
        blinkTimerRef.current = 0;
        // Quick blink
        const blinkProgress = (time * 20) % 1;
        const blinkScale = blinkProgress < 0.1 ? 1 - (blinkProgress * 10) : 1;
        leftEyeRef.current.scale.y = blinkScale;
        rightEyeRef.current.scale.y = blinkScale;
      } else {
        leftEyeRef.current.scale.y = 1;
        rightEyeRef.current.scale.y = 1;
      }
    }
  });

  return (
    <group ref={headRef} position={[0, 0, 0]}>
      {/* Head - More oval shaped like human face */}
      <mesh position={[0, 0.3, 0]}>
        <sphereGeometry args={[1.2, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.7]} />
        <meshStandardMaterial color="#ffd4a3" roughness={0.5} metalness={0.1} />
      </mesh>
      
      {/* Neck */}
      <mesh position={[0, -0.6, 0]}>
        <cylinderGeometry args={[0.4, 0.5, 0.6, 16]} />
        <meshStandardMaterial color="#ffc896" roughness={0.5} metalness={0.1} />
      </mesh>

      {/* Eyes - Much larger and more visible */}
      <group position={[0, 0.5, 0]}>
        {/* Left Eye White */}
        <mesh position={[-0.35, 0, 0.95]}>
          <sphereGeometry args={[0.18, 16, 16]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        
        {/* Right Eye White */}
        <mesh position={[0.35, 0, 0.95]}>
          <sphereGeometry args={[0.18, 16, 16]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        
        {/* Left Iris */}
        <mesh position={[-0.35, 0, 1.08]}>
          <sphereGeometry args={[0.11, 16, 16]} />
          <meshStandardMaterial color="#4a90e2" />
        </mesh>
        
        {/* Right Iris */}
        <mesh position={[0.35, 0, 1.08]}>
          <sphereGeometry args={[0.11, 16, 16]} />
          <meshStandardMaterial color="#4a90e2" />
        </mesh>
        
        {/* Left Pupil */}
        <mesh ref={leftEyeRef} position={[-0.35, 0, 1.15]}>
          <sphereGeometry args={[0.06, 12, 12]} />
          <meshStandardMaterial color="#000000" />
        </mesh>
        
        {/* Right Pupil */}
        <mesh ref={rightEyeRef} position={[0.35, 0, 1.15]}>
          <sphereGeometry args={[0.06, 12, 12]} />
          <meshStandardMaterial color="#000000" />
        </mesh>
        
        {/* Eye highlights */}
        <mesh position={[-0.32, 0.03, 1.19]}>
          <sphereGeometry args={[0.03, 8, 8]} />
          <meshStandardMaterial
            color="#ffffff"
            emissive="#ffffff"
            emissiveIntensity={0.8}
          />
        </mesh>
        <mesh position={[0.38, 0.03, 1.19]}>
          <sphereGeometry args={[0.03, 8, 8]} />
          <meshStandardMaterial
            color="#ffffff"
            emissive="#ffffff"
            emissiveIntensity={0.8}
          />
        </mesh>
        
        {/* Eyebrows */}
        <mesh position={[-0.35, 0.22, 1.0]} rotation={[0, 0, -0.2]}>
          <boxGeometry args={[0.35, 0.06, 0.08]} />
          <meshStandardMaterial color="#5c4033" />
        </mesh>
        <mesh position={[0.35, 0.22, 1.0]} rotation={[0, 0, 0.2]}>
          <boxGeometry args={[0.35, 0.06, 0.08]} />
          <meshStandardMaterial color="#5c4033" />
        </mesh>
      </group>

      {/* Nose - More prominent */}
      <mesh position={[0, 0.25, 1.15]}>
        <coneGeometry args={[0.15, 0.35, 4]} />
        <meshStandardMaterial color="#ffcba4" roughness={0.6} />
      </mesh>
      
      {/* Nostrils */}
      <mesh position={[-0.08, 0.1, 1.22]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color="#d4a574" />
      </mesh>
      <mesh position={[0.08, 0.1, 1.22]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color="#d4a574" />
      </mesh>

      {/* Cheeks - Add some depth */}
      <mesh position={[-0.5, 0.15, 0.85]}>
        <sphereGeometry args={[0.25, 16, 16]} />
        <meshStandardMaterial color="#ffdab3" roughness={0.6} />
      </mesh>
      <mesh position={[0.5, 0.15, 0.85]}>
        <sphereGeometry args={[0.25, 16, 16]} />
        <meshStandardMaterial color="#ffdab3" roughness={0.6} />
      </mesh>

      {/* MOUTH AREA - MUCH LARGER AND MORE VISIBLE */}
      <group position={[0, -0.1, 1.0]}>
        {/* Inner mouth (dark opening) - BIGGER */}
        <mesh ref={mouthRef} position={[0, 0, 0]}>
          <boxGeometry args={[1.0, 0.5, 0.15]} />
          <meshStandardMaterial color="#2d0a0a" />
        </mesh>
        
        {/* Teeth - Upper (visible when mouth opens) */}
        <mesh ref={teethRef} position={[0, 0.25, 0.05]}>
          <boxGeometry args={[0.75, 0.15, 0.1]} />
          <meshStandardMaterial 
            color="#ffffff" 
            roughness={0.2}
            transparent={true}
            opacity={0}
          />
        </mesh>
        
        {/* Tongue */}
        <mesh ref={tongueRef} position={[0, -0.3, -0.05]}>
          <boxGeometry args={[0.5, 0.15, 0.2]} />
          <meshStandardMaterial color="#ff6b9d" roughness={0.4} />
        </mesh>
        
        {/* Upper Lip - MUCH LARGER */}
        <mesh ref={upperLipRef} position={[0, 0.05, 0.08]}>
          <boxGeometry args={[1.0, 0.18, 0.2]} />
          <meshStandardMaterial color="#ff6b8a" roughness={0.3} metalness={0.1} />
        </mesh>
        
        {/* Lower Lip - MUCH LARGER */}
        <mesh ref={lowerLipRef} position={[0, -0.05, 0.08]}>
          <boxGeometry args={[1.0, 0.18, 0.2]} />
          <meshStandardMaterial color="#ff5577" roughness={0.3} metalness={0.1} />
        </mesh>
        
        {/* Lip corners for more realism */}
        <mesh position={[-0.5, 0, 0.1]}>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshStandardMaterial color="#ff5577" roughness={0.4} />
        </mesh>
        <mesh position={[0.5, 0, 0.1]}>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshStandardMaterial color="#ff5577" roughness={0.4} />
        </mesh>
      </group>
      
      {/* Chin */}
      <mesh position={[0, -0.5, 0.9]}>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial color="#ffd4a3" roughness={0.5} />
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
