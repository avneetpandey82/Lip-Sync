"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { Avatar3D } from "./Avatar3D";
import { Suspense } from "react";

interface AvatarSceneProps {
  currentViseme: string;
}

/**
 * AvatarScene - Main 3D canvas container with lighting and camera setup
 */
export function AvatarScene({ currentViseme }: AvatarSceneProps) {
  return (
    <div className="w-full h-[600px] bg-gradient-to-b from-blue-900 to-slate-800 rounded-lg overflow-hidden shadow-2xl border-4 border-blue-700">
      <Canvas
        shadows
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        }}
      >
        {/* Camera Setup - Closer for better face visibility */}
        <PerspectiveCamera makeDefault position={[0, 0, 3.5]} fov={50} />

        {/* Lighting - Brighter and more focused on face */}
        <ambientLight intensity={0.6} />
        
        {/* Main front light */}
        <directionalLight
          position={[0, 2, 5]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        
        {/* Fill lights from sides */}
        <pointLight position={[-3, 1, 3]} intensity={0.5} color="#ffffff" />
        <pointLight position={[3, 1, 3]} intensity={0.5} color="#ffffff" />
        
        {/* Top light for highlights */}
        <directionalLight
          position={[0, 5, 2]}
          intensity={0.4}
          color="#ffffff"
        />
        
        {/* Rim light from behind */}
        <directionalLight
          position={[0, 0, -3]}
          intensity={0.3}
          color="#88bbff"
        />

        {/* Avatar with Suspense for loading */}
        <Suspense fallback={null}>
          <Avatar3D currentViseme={currentViseme} />
        </Suspense>

        {/* Interactive Controls - Optimized for face viewing */}
        <OrbitControls
          enableZoom={true}
          enablePan={false}
          minDistance={2.5}
          maxDistance={6}
          minPolarAngle={Math.PI / 3} // Limit vertical rotation
          maxPolarAngle={Math.PI / 1.8}
          target={[0, 0.2, 0]} // Focus slightly above center (face level)
          enableDamping={true}
          dampingFactor={0.05}
        />

        {/* Background atmosphere */}
        <color attach="background" args={["#1a2332"]} />
        <fog attach="fog" args={["#1a2332", 6, 12]} />
      </Canvas>

      {/* Debug overlay */}
      <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-sm px-3 py-2 rounded text-xs font-mono">
        <div className="text-gray-400">Viseme:</div>
        <div className="text-white font-bold text-lg">{currentViseme}</div>
      </div>
    </div>
  );
}
