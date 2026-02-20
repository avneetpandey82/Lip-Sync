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
    <div className="w-full h-[600px] bg-gradient-to-b from-slate-900 to-slate-700 rounded-lg overflow-hidden shadow-2xl">
      <Canvas
        shadows
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        }}
      >
        {/* Camera Setup */}
        <PerspectiveCamera makeDefault position={[0, 0, 5]} fov={50} />

        {/* Lighting */}
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[5, 5, 5]}
          intensity={0.8}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <pointLight position={[-5, 3, -3]} intensity={0.3} color="#9090ff" />
        <pointLight position={[5, 3, -3]} intensity={0.3} color="#ff9090" />

        {/* Rim light for depth */}
        <directionalLight
          position={[0, 2, -5]}
          intensity={0.2}
          color="#ffffff"
        />

        {/* Avatar with Suspense for loading */}
        <Suspense fallback={null}>
          <Avatar3D currentViseme={currentViseme} />
        </Suspense>

        {/* Interactive Controls */}
        <OrbitControls
          enableZoom={true}
          enablePan={false}
          minDistance={3}
          maxDistance={8}
          minPolarAngle={Math.PI / 4} // Limit vertical rotation
          maxPolarAngle={Math.PI / 1.5}
          target={[0, 0, 0]}
        />

        {/* Background atmosphere */}
        <color attach="background" args={["#1e293b"]} />
        <fog attach="fog" args={["#1e293b", 8, 15]} />
      </Canvas>

      {/* Debug overlay */}
      <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-sm px-3 py-2 rounded text-xs font-mono">
        <div className="text-gray-400">Viseme:</div>
        <div className="text-white font-bold text-lg">{currentViseme}</div>
      </div>
    </div>
  );
}
