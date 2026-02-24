"use client";

import { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface Avatar3DProps {
  currentViseme: string;
  emotionIntensity?: number;
}

// Rhubarb Viseme Mappings
const VISEME_CONFIG: Record<string, {
  mouthScale: [number, number];
  lipPosition: [number, number];
  lipScale: number;
  tongueY: number;
  teethOpacity: number;
}> = {
  X: { mouthScale: [1.0, 0.1], lipPosition: [0.08, -0.08], lipScale: 1.0, tongueY: -0.3, teethOpacity: 0 },
  A: { mouthScale: [1.2, 1.5], lipPosition: [0.8, -0.8], lipScale: 1.3, tongueY: -0.15, teethOpacity: 1 },
  B: { mouthScale: [0.9, 0.1], lipPosition: [0.08, -0.08], lipScale: 0.95, tongueY: -0.3, teethOpacity: 0 },
  C: { mouthScale: [1.05, 0.6], lipPosition: [0.35, -0.35], lipScale: 1.1, tongueY: -0.25, teethOpacity: 0.6 },
  D: { mouthScale: [1.5, 1.2], lipPosition: [0.7, -0.7], lipScale: 1.5, tongueY: -0.18, teethOpacity: 1 },
  E: { mouthScale: [0.85, 0.8], lipPosition: [0.45, -0.45], lipScale: 0.9, tongueY: -0.25, teethOpacity: 0.7 },
  F: { mouthScale: [1.0, 0.4], lipPosition: [0.2, -0.3], lipScale: 1.0, tongueY: -0.3, teethOpacity: 0.9 },
  G: { mouthScale: [1.0, 0.6], lipPosition: [0.35, -0.35], lipScale: 1.0, tongueY: 0.15, teethOpacity: 0.7 },
  H: { mouthScale: [1.4, 1.1], lipPosition: [0.6, -0.6], lipScale: 1.4, tongueY: -0.12, teethOpacity: 1 },
};

export function Avatar3D({ currentViseme, emotionIntensity = 0 }: Avatar3DProps) {
  const avatarRef = useRef<THREE.Group>(null);
  const mouthRef = useRef<THREE.Mesh>(null);
  const upperLipRef = useRef<THREE.Mesh>(null);
  const lowerLipRef = useRef<THREE.Mesh>(null);
  const tongueRef = useRef<THREE.Mesh>(null);
  const teethRef = useRef<THREE.Mesh>(null);
  const leftEyeRef = useRef<THREE.Mesh>(null);
  const rightEyeRef = useRef<THREE.Mesh>(null);
  const currentVisemeRef = useRef<string>("X");
  const blinkTimer = useRef<number>(0);

  useEffect(() => {
    currentVisemeRef.current = currentViseme;
  }, [currentViseme]);

  useFrame((state, delta) => {
    if (!avatarRef.current || !mouthRef.current) return;

    const time = state.clock.getElapsedTime();
    const config = VISEME_CONFIG[currentVisemeRef.current] || VISEME_CONFIG.X;
    const lerpSpeed = 20;

    // Mouth animation
    if (mouthRef.current) {
      mouthRef.current.scale.x += (config.mouthScale[0] - mouthRef.current.scale.x) * delta * lerpSpeed;
      mouthRef.current.scale.y += (config.mouthScale[1] - mouthRef.current.scale.y) * delta * lerpSpeed;
    }

    // Lip animation
    if (upperLipRef.current && lowerLipRef.current) {
      upperLipRef.current.position.y += (config.lipPosition[0] - upperLipRef.current.position.y) * delta * lerpSpeed;
      upperLipRef.current.scale.x += (config.lipScale - upperLipRef.current.scale.x) * delta * lerpSpeed;
      
      lowerLipRef.current.position.y += (config.lipPosition[1] - lowerLipRef.current.position.y) * delta * lerpSpeed;
      lowerLipRef.current.scale.x += (config.lipScale - lowerLipRef.current.scale.x) * delta * lerpSpeed;
    }

    // Tongue animation
    if (tongueRef.current) {
      tongueRef.current.position.y += (config.tongueY - tongueRef.current.position.y) * delta * lerpSpeed;
    }

    // Teeth animation
    if (teethRef.current) {
      const material = teethRef.current.material as THREE.MeshStandardMaterial;
      material.opacity += (config.teethOpacity - material.opacity) * delta * lerpSpeed;
    }

    // Idle animations
    avatarRef.current.position.y = Math.sin(time * 0.6) * 0.03;
    avatarRef.current.rotation.y = Math.sin(time * 0.4) * 0.06;
    avatarRef.current.rotation.z = Math.cos(time * 0.5) * 0.03;

    // Blinking
    blinkTimer.current += delta;
    if (blinkTimer.current > 3.5) {
      blinkTimer.current = 0;
    }
    
    const blinkPhase = blinkTimer.current < 0.15 ? 1 - (blinkTimer.current / 0.15) : 1;
    if (leftEyeRef.current) leftEyeRef.current.scale.y = blinkPhase;
    if (rightEyeRef.current) rightEyeRef.current.scale.y = blinkPhase;
  });

  return (
    <group ref={avatarRef}>
      {/* HEAD */}
      <mesh position={[0, 0, 0]} castShadow receiveShadow>
        <sphereGeometry args={[1, 64, 64]} />
        <meshStandardMaterial color="#ffd4a3" roughness={0.6} metalness={0.1} />
      </mesh>

      {/* FACE FRONT */}
      <mesh position={[0, 0, 0.7]} scale={[0.9, 0.95, 0.4]} castShadow receiveShadow>
        <sphereGeometry args={[0.85, 32, 32]} />
        <meshStandardMaterial color="#ffe4b8" roughness={0.55} />
      </mesh>

      {/* HAIR */}
      <group position={[0, 0.5, -0.15]}>
        <mesh scale={[1.15, 0.9, 1.15]}>
          <sphereGeometry args={[1.05, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.7]} />
          <meshStandardMaterial color="#2a1810" roughness={0.9} />
        </mesh>
        <mesh position={[-0.75, -0.15, 0.2]} rotation={[0, 0, -0.25]}>
          <capsuleGeometry args={[0.22, 0.65, 16, 32]} />
          <meshStandardMaterial color="#2a1810" roughness={0.9} />
        </mesh>
        <mesh position={[0.75, -0.15, 0.2]} rotation={[0, 0, 0.25]}>
          <capsuleGeometry args={[0.22, 0.65, 16, 32]} />
          <meshStandardMaterial color="#2a1810" roughness={0.9} />
        </mesh>
      </group>

      {/* NECK */}
      <mesh position={[0, -1, 0.1]}>
        <cylinderGeometry args={[0.35, 0.4, 0.8, 32]} />
        <meshStandardMaterial color="#ffd0a0" roughness={0.65} />
      </mesh>

      {/* SHOULDERS */}
      <mesh position={[0, -1.4, 0.05]} scale={[1.8, 0.4, 0.75]}>
        <capsuleGeometry args={[0.45, 0.5, 32, 64]} />
        <meshStandardMaterial color="#3a4a5a" roughness={0.65} />
      </mesh>

      {/* EARS */}
      <mesh position={[-0.95, 0.05, 0]} rotation={[0, -0.25, -0.12]} castShadow>
        <capsuleGeometry args={[0.15, 0.45, 16, 32]} />
        <meshStandardMaterial color="#ffcca0" roughness={0.75} />
      </mesh>
      <mesh position={[0.95, 0.05, 0]} rotation={[0, 0.25, 0.12]} castShadow>
        <capsuleGeometry args={[0.15, 0.45, 16, 32]} />
        <meshStandardMaterial color="#ffcca0" roughness={0.75} />
      </mesh>

      {/* EYES */}
      <group position={[0, 0.25, 0.9]}>
        {/* Left Eye */}
        <group position={[-0.3, 0, 0]}>
          <mesh position={[0, 0, 0.05]}>
            <sphereGeometry args={[0.15, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
            <meshStandardMaterial color="#ffffff" roughness={0.2} />
          </mesh>
          <mesh position={[0, 0, 0.18]}>
            <circleGeometry args={[0.08, 32]} />
            <meshStandardMaterial color="#1e5a8a" roughness={0.3} />
          </mesh>
          <mesh ref={leftEyeRef} position={[0, 0, 0.19]}>
            <circleGeometry args={[0.04, 32]} />
            <meshStandardMaterial color="#000000" />
          </mesh>
          <mesh position={[0.03, 0.03, 0.2]}>
            <circleGeometry args={[0.02, 16]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={3} />
          </mesh>
          <mesh position={[0, 0.12, 0.14]} rotation={[0.08, 0, 0]}>
            <capsuleGeometry args={[0.035, 0.3, 16, 32]} />
            <meshStandardMaterial color="#ffd4a3" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.25, 0.1]} rotation={[0, 0, -0.08]}>
            <capsuleGeometry args={[0.035, 0.35, 16, 32]} />
            <meshStandardMaterial color="#1a120c" roughness={0.95} />
          </mesh>
        </group>

        {/* Right Eye */}
        <group position={[0.3, 0, 0]}>
          <mesh position={[0, 0, 0.05]}>
            <sphereGeometry args={[0.15, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
            <meshStandardMaterial color="#ffffff" roughness={0.2} />
          </mesh>
          <mesh position={[0, 0, 0.18]}>
            <circleGeometry args={[0.08, 32]} />
            <meshStandardMaterial color="#1e5a8a" roughness={0.3} />
          </mesh>
          <mesh ref={rightEyeRef} position={[0, 0, 0.19]}>
            <circleGeometry args={[0.04, 32]} />
            <meshStandardMaterial color="#000000" />
          </mesh>
          <mesh position={[0.03, 0.03, 0.2]}>
            <circleGeometry args={[0.02, 16]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={3} />
          </mesh>
          <mesh position={[0, 0.12, 0.14]} rotation={[0.08, 0, 0]}>
            <capsuleGeometry args={[0.035, 0.3, 16, 32]} />
            <meshStandardMaterial color="#ffd4a3" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.25, 0.1]} rotation={[0, 0, 0.08]}>
            <capsuleGeometry args={[0.035, 0.35, 16, 32]} />
            <meshStandardMaterial color="#1a120c" roughness={0.95} />
          </mesh>
        </group>
      </group>

      {/* NOSE */}
      <group position={[0, 0.05, 0.95]}>
        <mesh position={[0, 0.08, 0]} rotation={[0.08, 0, 0]}>
          <boxGeometry args={[0.12, 0.4, 0.18]} />
          <meshStandardMaterial color="#ffd0a5" roughness={0.65} />
        </mesh>
        <mesh position={[0, -0.12, 0.1]}>
          <sphereGeometry args={[0.12, 24, 24]} />
          <meshStandardMaterial color="#ffccaa" roughness={0.6} />
        </mesh>
        <mesh position={[-0.06, -0.16, 0.12]} rotation={[0.35, -0.15, 0]}>
          <capsuleGeometry args={[0.022, 0.05, 8, 16]} />
          <meshStandardMaterial color="#cc9878" />
        </mesh>
        <mesh position={[0.06, -0.16, 0.12]} rotation={[0.35, 0.15, 0]}>
          <capsuleGeometry args={[0.022, 0.05, 8, 16]} />
          <meshStandardMaterial color="#cc9878" />
        </mesh>
      </group>

      {/* MOUTH */}
      <group position={[0, -0.25, 1.0]}>
        <mesh ref={mouthRef} position={[0, 0, 0]}>
          <boxGeometry args={[0.6, 0.3, 0.15]} />
          <meshStandardMaterial color="#140505" roughness={1} />
        </mesh>
        <mesh ref={teethRef} position={[0, 0.12, 0.06]}>
          <boxGeometry args={[0.5, 0.1, 0.08]} />
          <meshStandardMaterial color="#ffffff" roughness={0.15} transparent opacity={0} />
        </mesh>
        <mesh ref={tongueRef} position={[0, -0.15, 0]}>
          <capsuleGeometry args={[0.15, 0.35, 16, 32]} />
          <meshStandardMaterial color="#d64560" roughness={0.4} />
        </mesh>
        <mesh ref={upperLipRef} position={[0, 0.08, 0.09]} rotation={[0.12, 0, 0]}>
          <capsuleGeometry args={[0.1, 0.65, 24, 48]} />
          <meshStandardMaterial color="#c85570" roughness={0.25} />
        </mesh>
        <mesh ref={lowerLipRef} position={[0, -0.08, 0.09]} rotation={[-0.12, 0, 0]}>
          <capsuleGeometry args={[0.12, 0.65, 24, 48]} />
          <meshStandardMaterial color="#b84865" roughness={0.25} />
        </mesh>
        <mesh position={[-0.34, 0, 0.07]}>
          <sphereGeometry args={[0.05, 16, 16]} />
          <meshStandardMaterial color="#a84560" roughness={0.4} />
        </mesh>
        <mesh position={[0.34, 0, 0.07]}>
          <sphereGeometry args={[0.05, 16, 16]} />
          <meshStandardMaterial color="#a84560" roughness={0.4} />
        </mesh>
      </group>

      {/* CHIN */}
      <mesh position={[0, -0.65, 0.85]} castShadow>
        <sphereGeometry args={[0.3, 32, 32]} />
        <meshStandardMaterial color="#ffd4a3" roughness={0.65} />
      </mesh>

      {/* JAW */}
      <mesh position={[-0.45, -0.5, 0.6]} rotation={[0, 0, -0.18]} castShadow>
        <capsuleGeometry args={[0.18, 0.4, 16, 32]} />
        <meshStandardMaterial color="#ffd0a0" roughness={0.7} />
      </mesh>
      <mesh position={[0.45, -0.5, 0.6]} rotation={[0, 0, 0.18]} castShadow>
        <capsuleGeometry args={[0.18, 0.4, 16, 32]} />
        <meshStandardMaterial color="#ffd0a0" roughness={0.7} />
      </mesh>
    </group>
  );
}
