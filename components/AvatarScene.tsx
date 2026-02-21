"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { Avatar3D } from "./Avatar3D";
import { Suspense } from "react";
import * as THREE from "three";

interface AvatarSceneProps {
  currentViseme: string;
}

/**
 * AvatarScene - Main 3D canvas container with lighting and camera setup
 */
export function AvatarScene({ currentViseme }: AvatarSceneProps) {
  return (
    <div className="w-full h-[600px] bg-gradient-to-b from-blue-50 to-blue-100 rounded-lg overflow-hidden shadow-2xl border-2 border-blue-200">
      <Canvas
        shadows
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.3;
        }}
      >
        {/* Camera Setup - Portrait angle */}
        <PerspectiveCamera makeDefault position={[0, 0.3, 3.5]} fov={42} />

        {/* Lighting - Professional beauty lighting for realistic skin */}
        <ambientLight intensity={0.55} color="#fef8f4" />
        
        {/* Key light - main light from front-left, warm and soft */}
        <directionalLight
          position={[-2.5, 3.5, 5]}
          intensity={1.8}
          color="#fff5ed"
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-far={20}
          shadow-camera-left={-6}
          shadow-camera-right={6}
          shadow-camera-top={6}
          shadow-camera-bottom={-6}
          shadow-bias={-0.0001}
        />
        
        {/* Fill light - soften shadows from right, cooler tone */}
        <directionalLight
          position={[3.5, 2.5, 4]}
          intensity={0.7}
          color="#ebf4ff"
        />
        
        {/* Rim/Hair light - edge highlighting from back */}
        <directionalLight
          position={[0, 3, -5]}
          intensity={0.65}
          color="#d4e4ff"
        />
        
        {/* Top light - natural overhead */}
        <pointLight position={[0, 5, 2]} intensity={0.4} color="#fffaf0" />
        
        {/* Eye/Face sparkle lights */}
        <pointLight position={[-0.5, 0.7, 2.5]} intensity={0.25} color="#ffffff" />
        <pointLight position={[0.5, 0.7, 2.5]} intensity={0.25} color="#ffffff" />

        {/* Avatar with Suspense for loading */}
        <Suspense fallback={null}>
          <Avatar3D currentViseme={currentViseme} />
        </Suspense>

        {/* Interactive Controls - Portrait viewing optimized */}
        <OrbitControls
          enableZoom={true}
          enablePan={false}
          minDistance={2.5}
          maxDistance={6}
          minPolarAngle={Math.PI / 3.5}
          maxPolarAngle={Math.PI / 1.7}
          target={[0, 0.2, 0]}
          enableDamping={true}
          dampingFactor={0.08}
          rotateSpeed={0.5}
        />

        {/* Background - Soft professional studio gradient */}
        <color attach="background" args={["#f0f8ff"]} />
        <fog attach="fog" args={["#dce8f5", 6, 12]} />
      </Canvas>

      {/* Debug overlay */}
      <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-sm px-3 py-2 rounded text-xs font-mono">
        <div className="text-gray-400">Viseme:</div>
        <div className="text-white font-bold text-lg">{currentViseme}</div>
      </div>
    </div>
  );
}
