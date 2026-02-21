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
      {/* CRANIUM - Realistic human head shape (elongated oval) */}
      <mesh position={[0, 0.25, -0.05]} scale={[0.95, 1.15, 1.0]} castShadow receiveShadow>
        <sphereGeometry args={[0.95, 64, 64]} />
        <meshStandardMaterial 
          color="#f4c8a8"
          roughness={0.85}
          metalness={0.0}
        />
      </mesh>
      
      {/* HAIR - Natural looking hair */}
      <group position={[0, 0.5, 0]}>
        {/* Main hair volume */}
        <mesh position={[0, 0.35, 0]} scale={[1.05, 0.85, 1.05]}>
          <sphereGeometry args={[1.0, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.7]} />
          <meshStandardMaterial 
            color="#3d2817"
            roughness={0.95}
            metalness={0.0}
          />
        </mesh>
        
        {/* Hair strands - left side */}
        <mesh position={[-0.75, 0, 0.2]} rotation={[0, 0, -0.3]}>
          <capsuleGeometry args={[0.3, 0.6, 8, 16]} />
          <meshStandardMaterial color="#3d2817" roughness={0.95} />
        </mesh>
        <mesh position={[-0.85, -0.1, 0.4]} rotation={[0.2, 0, -0.4]}>
          <capsuleGeometry args={[0.25, 0.5, 8, 16]} />
          <meshStandardMaterial color="#3d2817" roughness={0.95} />
        </mesh>
        
        {/* Hair strands - right side */}
        <mesh position={[0.75, 0, 0.2]} rotation={[0, 0, 0.3]}>
          <capsuleGeometry args={[0.3, 0.6, 8, 16]} />
          <meshStandardMaterial color="#3d2817" roughness={0.95} />
        </mesh>
        <mesh position={[0.85, -0.1, 0.4]} rotation={[0.2, 0, 0.4]}>
          <capsuleGeometry args={[0.25, 0.5, 8, 16]} />
          <meshStandardMaterial color="#3d2817" roughness={0.95} />
        </mesh>
        
        {/* Bangs/Fringe */}
        <mesh position={[0, 0.25, 0.8]} rotation={[0.4, 0, 0]}>
          <capsuleGeometry args={[0.2, 0.8, 12, 16]} />
          <meshStandardMaterial color="#3d2817" roughness={0.95} />
        </mesh>
        <mesh position={[-0.25, 0.3, 0.85]} rotation={[0.3, 0.2, -0.1]}>
          <capsuleGeometry args={[0.15, 0.6, 8, 16]} />
          <meshStandardMaterial color="#3d2817" roughness={0.95} />
        </mesh>
        <mesh position={[0.25, 0.3, 0.85]} rotation={[0.3, -0.2, 0.1]}>
          <capsuleGeometry args={[0.15, 0.6, 8, 16]} />
          <meshStandardMaterial color="#3d2817" roughness={0.95} />
        </mesh>
      </group>
      
      {/* FACE - Front facade with proper depth */}
      <mesh position={[0, 0.15, 0.75]} scale={[0.80, 0.95, 0.65]} castShadow receiveShadow>
        <sphereGeometry args={[0.85, 64, 64]} />
        <meshStandardMaterial 
          color="#f7d5b8"
          roughness={0.75}
          metalness={0.0}
        />
      </mesh>
      
      {/* Forehead */}
      <mesh position={[0, 0.65, 0.6]} scale={[0.9, 0.65, 0.7]}>
        <sphereGeometry args={[0.55, 48, 48]} />
        <meshStandardMaterial 
          color="#fae0c8"
          roughness={0.65}
          metalness={0.0}
        />
      </mesh>

      {/* EARS - Realistic placement */}
      <group>
        {/* Left ear */}
        <mesh position={[-0.88, 0.15, 0.1]} rotation={[0, -0.4, -0.2]} castShadow>
          <capsuleGeometry args={[0.15, 0.42, 16, 32]} />
          <meshStandardMaterial color="#f0c4a0" roughness={0.8} />
        </mesh>
        <mesh position={[-0.85, 0.15, 0.15]} rotation={[0, -0.3, -0.2]}>
          <torusGeometry args={[0.12, 0.04, 12, 24]} />
          <meshStandardMaterial color="#e8b890" roughness={0.85} />
        </mesh>
        
        {/* Right ear */}
        <mesh position={[0.88, 0.15, 0.1]} rotation={[0, 0.4, 0.2]} castShadow>
          <capsuleGeometry args={[0.15, 0.42, 16, 32]} />
          <meshStandardMaterial color="#f0c4a0" roughness={0.8} />
        </mesh>
        <mesh position={[0.85, 0.15, 0.15]} rotation={[0, 0.3, 0.2]}>
          <torusGeometry args={[0.12, 0.04, 12, 24]} />
          <meshStandardMaterial color="#e8b890" roughness={0.85} />
        </mesh>
      </group>

      {/* Neck */}
      <mesh position={[0, -0.82, 0.08]} castShadow receiveShadow>
        <cylinderGeometry args={[0.30, 0.36, 0.7, 32]} />
        <meshStandardMaterial 
          color="#f5cdb0"
          roughness={0.75}
        />
      </mesh>
      
      {/* Shoulders hint */}
      <mesh position={[0, -1.15, 0]} scale={[1.8, 0.4, 0.7]}>
        <capsuleGeometry args={[0.35, 0.5, 16, 32]} />
        <meshStandardMaterial color="#4a5568" roughness={0.6} />
      </mesh>

      {/* EYES - Highly realistic */}
      <group position={[0, 0.35, 0]}>
        {/* Eye sockets with proper shadowing */}
        <mesh position={[-0.32, 0.03, 0.82]}>
          <sphereGeometry args={[0.20, 32, 32]} />
          <meshStandardMaterial color="#e8c4a5" roughness={0.9} />
        </mesh>
        <mesh position={[0.32, 0.03, 0.82]}>
          <sphereGeometry args={[0.20, 32, 32]} />
          <meshStandardMaterial color="#e8c4a5" roughness={0.9} />
        </mesh>
        
        {/* Eye whites - glossy */}
        <mesh position={[-0.32, 0.03, 0.96]}>
          <sphereGeometry args={[0.16, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.52]} />
          <meshStandardMaterial 
            color="#ffffff"
            roughness={0.2}
            metalness={0.15}
          />
        </mesh>
        <mesh position={[0.32, 0.03, 0.96]}>
          <sphereGeometry args={[0.16, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.52]} />
          <meshStandardMaterial 
            color="#ffffff"
            roughness={0.2}
            metalness={0.15}
          />
        </mesh>
        
        {/* Iris - detailed */}
        <mesh position={[-0.32, 0.03, 1.08]}>
          <circleGeometry args={[0.08, 32]} />
          <meshStandardMaterial 
            color="#2d5f8d"
            roughness={0.25}
            metalness={0.3}
          />
        </mesh>
        <mesh position={[0.32, 0.03, 1.08]}>
          <circleGeometry args={[0.08, 32]} />
          <meshStandardMaterial 
            color="#2d5f8d"
            roughness={0.25}
            metalness={0.3}
          />
        </mesh>
        
        {/* Iris inner ring */}
        <mesh position={[-0.32, 0.03, 1.09]}>
          <circleGeometry args={[0.05, 32]} />
          <meshStandardMaterial 
            color="#4a8cc2"
            roughness={0.2}
          />
        </mesh>
        <mesh position={[0.32, 0.03, 1.09]}>
          <circleGeometry args={[0.05, 32]} />
          <meshStandardMaterial 
            color="#4a8cc2"
            roughness={0.2}
          />
        </mesh>
        
        {/* Pupils */}
        <mesh ref={leftEyeRef} position={[-0.32, 0.03, 1.10]}>
          <circleGeometry args={[0.035, 32]} />
          <meshStandardMaterial color="#000000" />
        </mesh>
        <mesh ref={rightEyeRef} position={[0.32, 0.03, 1.10]}>
          <circleGeometry args={[0.035, 32]} />
          <meshStandardMaterial color="#000000" />
        </mesh>
        
        {/* Eye highlights - catchlights */}
        <mesh position={[-0.29, 0.06, 1.11]}>
          <circleGeometry args={[0.025, 16]} />
          <meshStandardMaterial
            color="#ffffff"
            emissive="#ffffff"
            emissiveIntensity={1.5}
          />
        </mesh>
        <mesh position={[0.35, 0.06, 1.11]}>
          <circleGeometry args={[0.025, 16]} />
          <meshStandardMaterial
            color="#ffffff"
            emissive="#ffffff"
            emissiveIntensity={1.5}
          />
        </mesh>
        
        {/* Upper eyelids - natural curve */}
        <mesh position={[-0.32, 0.12, 1.05]} rotation={[0.15, 0, 0]}>
          <capsuleGeometry args={[0.04, 0.32, 12, 24]} />
          <meshStandardMaterial color="#f2c8a8" roughness={0.65} />
        </mesh>
        <mesh position={[0.32, 0.12, 1.05]} rotation={[0.15, 0, 0]}>
          <capsuleGeometry args={[0.04, 0.32, 12, 24]} />
          <meshStandardMaterial color="#f2c8a8" roughness={0.65} />
        </mesh>
        
        {/* Lower eyelids */}
        <mesh position={[-0.32, -0.06, 1.05]} rotation={[-0.15, 0, 0]}>
          <capsuleGeometry args={[0.03, 0.32, 12, 24]} />
          <meshStandardMaterial color="#f2c8a8" roughness={0.65} />
        </mesh>
        <mesh position={[0.32, -0.06, 1.05]} rotation={[-0.15, 0, 0]}>
          <capsuleGeometry args={[0.03, 0.32, 12, 24]} />
          <meshStandardMaterial color="#f2c8a8" roughness={0.65} />
        </mesh>
        
        {/* Eyebrows - fuller and natural */}
        <mesh position={[-0.32, 0.22, 1.0]} rotation={[0.1, 0, -0.12]} castShadow>
          <capsuleGeometry args={[0.035, 0.38, 12, 24]} />
          <meshStandardMaterial color="#2d1f15" roughness={0.95} />
        </mesh>
        <mesh position={[0.32, 0.22, 1.0]} rotation={[0.1, 0, 0.12]} castShadow>
          <capsuleGeometry args={[0.035, 0.38, 12, 24]} />
          <meshStandardMaterial color="#2d1f15" roughness={0.95} />
        </mesh>
      </group>

      {/* NOSE - Elegant and proportional */}
      <group position={[0, 0.2, 0]}>
        {/* Nose bridge */}
        <mesh position={[0, 0.18, 0.98]} rotation={[0.1, 0, 0]}>
          <boxGeometry args={[0.14, 0.45, 0.18]} />
          <meshStandardMaterial color="#f5d0b5" roughness={0.7} />
        </mesh>
        
        {/* Nose tip */}
        <mesh position={[0, -0.05, 1.08]}>
          <sphereGeometry args={[0.14, 32, 32]} />
          <meshStandardMaterial color="#f3cab0" roughness={0.65} />
        </mesh>
        
        {/* Nose wings */}
        <mesh position={[-0.10, -0.08, 1.05]} rotation={[0.2, -0.3, -0.1]}>
          <sphereGeometry args={[0.10, 24, 24]} />
          <meshStandardMaterial color="#f3cab0" roughness={0.7} />
        </mesh>
        <mesh position={[0.10, -0.08, 1.05]} rotation={[0.2, 0.3, 0.1]}>
          <sphereGeometry args={[0.10, 24, 24]} />
          <meshStandardMaterial color="#f3cab0" roughness={0.7} />
        </mesh>
        
        {/* Nostrils */}
        <mesh position={[-0.08, -0.12, 1.12]} rotation={[0.5, -0.2, 0]}>
          <capsuleGeometry args={[0.025, 0.06, 8, 16]} />
          <meshStandardMaterial color="#c89878" />
        </mesh>
        <mesh position={[0.08, -0.12, 1.12]} rotation={[0.5, 0.2, 0]}>
          <capsuleGeometry args={[0.025, 0.06, 8, 16]} />
          <meshStandardMaterial color="#c89878" />
        </mesh>
      </group>

      {/* Cheekbones */}
      <mesh position={[-0.52, 0.25, 0.68]} castShadow>
        <sphereGeometry args={[0.24, 32, 32]} />
        <meshStandardMaterial 
          color="#fae5d0"
          roughness={0.7}
        />
      </mesh>
      <mesh position={[0.52, 0.25, 0.68]} castShadow>
        <sphereGeometry args={[0.24, 32, 32]} />
        <meshStandardMaterial 
          color="#fae5d0"
          roughness={0.7}
        />
      </mesh>

      {/* MOUTH & LIPS - Prominent and expressive */}
      <group position={[0, -0.15, 0.95]}>
        {/* Mouth cavity */}
        <mesh ref={mouthRef} position={[0, 0, 0]}>
          <boxGeometry args={[0.65, 0.30, 0.15]} />
          <meshStandardMaterial color="#2a0808" roughness={0.95} />
        </mesh>
        
        {/* Upper teeth */}
        <mesh ref={teethRef} position={[0, 0.13, 0.06]}>
          <boxGeometry args={[0.52, 0.09, 0.08]} />
          <meshStandardMaterial 
            color="#ffffff"
            roughness={0.2}
            metalness={0.05}
            transparent={true}
            opacity={0}
          />
        </mesh>
        
        {/* Lower teeth */}
        <mesh position={[0, -0.13, 0.06]}>
          <boxGeometry args={[0.52, 0.09, 0.08]} />
          <meshStandardMaterial 
            color="#fafafa"
            roughness={0.25}
            metalness={0.05}
            transparent={true}
            opacity={0}
          />
        </mesh>
        
        {/* Tongue */}
        <mesh ref={tongueRef} position={[0, -0.15, 0]}>
          <capsuleGeometry args={[0.16, 0.38, 16, 32]} />
          <meshStandardMaterial 
            color="#e85570"
            roughness={0.5}
            metalness={0.1}
          />
        </mesh>
        
        {/* Upper Lip - Natural and full */}
        <mesh ref={upperLipRef} position={[0, 0.04, 0.08]} rotation={[0.12, 0, 0]}>
          <capsuleGeometry args={[0.10, 0.68, 20, 32]} />
          <meshStandardMaterial 
            color="#cd5a70"
            roughness={0.35}
            metalness={0.08}
          />
        </mesh>
        
        {/* Upper lip cupid's bow */}
        <mesh position={[0, 0.07, 0.12]}>
          <sphereGeometry args={[0.06, 24, 24]} />
          <meshStandardMaterial 
            color="#d86880"
            roughness={0.3}
            metalness={0.1}
          />
        </mesh>
        
        {/* Upper lip highlight */}
        <mesh position={[0, 0.08, 0.14]}>
          <capsuleGeometry args={[0.045, 0.48, 12, 24]} />
          <meshStandardMaterial 
            color="#f098a8"
            roughness={0.15}
            metalness={0.2}
            transparent={true}
            opacity={0.75}
          />
        </mesh>
        
        {/* Lower Lip - Fuller and prominent */}
        <mesh ref={lowerLipRef} position={[0, -0.06, 0.08]} rotation={[-0.12, 0, 0]}>
          <capsuleGeometry args={[0.12, 0.68, 20, 32]} />
          <meshStandardMaterial 
            color="#ba5068"
            roughness={0.35}
            metalness={0.08}
          />
        </mesh>
        
        {/* Lower lip center fullness */}
        <mesh position={[0, -0.08, 0.12]}>
          <sphereGeometry args={[0.08, 24, 24]} />
          <meshStandardMaterial 
            color="#c55a70"
            roughness={0.3}
            metalness={0.1}
          />
        </mesh>
        
        {/* Lower lip highlight - glossy */}
        <mesh position={[0, -0.04, 0.15]}>
          <capsuleGeometry args={[0.055, 0.42, 12, 24]} />
          <meshStandardMaterial 
            color="#e88898"
            roughness={0.1}
            metalness={0.25}
            transparent={true}
            opacity={0.7}
          />
        </mesh>
        
        {/* Lip corners */}
        <mesh position={[-0.36, 0, 0.06]}>
          <sphereGeometry args={[0.05, 16, 16]} />
          <meshStandardMaterial color="#b84860" roughness={0.45} />
        </mesh>
        <mesh position={[0.36, 0, 0.06]}>
          <sphereGeometry args={[0.05, 16, 16]} />
          <meshStandardMaterial color="#b84860" roughness={0.45} />
        </mesh>
        
        {/* Philtrum */}
        <mesh position={[0, 0.18, 0.08]}>
          <boxGeometry args={[0.05, 0.15, 0.03]} />
          <meshStandardMaterial color="#f5cab0" roughness={0.75} />
        </mesh>
      </group>
      
      {/* Chin */}
      <mesh position={[0, -0.60, 0.82]} castShadow>
        <sphereGeometry args={[0.30, 48, 48]} />
        <meshStandardMaterial color="#f7d5b8" roughness={0.75} />
      </mesh>
      
      {/* Jawline */}
      <mesh position={[-0.40, -0.45, 0.52]} rotation={[0, 0, -0.25]} castShadow>
        <capsuleGeometry args={[0.20, 0.35, 16, 32]} />
        <meshStandardMaterial color="#f5d0b5" roughness={0.8} />
      </mesh>
      <mesh position={[0.40, -0.45, 0.52]} rotation={[0, 0, 0.25]} castShadow>
        <capsuleGeometry args={[0.20, 0.35, 16, 32]} />
        <meshStandardMaterial color="#f5d0b5" roughness={0.8} />
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
