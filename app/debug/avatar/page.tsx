"use client";

/**
 * /debug/avatar  –  GLB morph-target diagnostic
 *
 * Only meaningful in development; in production it just shows a "not available"
 * message so it can safely be deployed without being a security issue.
 *
 * Navigate to  http://localhost:3000/debug/avatar  to see every morph-target
 * name that Three.js finds in your avatar.glb so you can verify the RPM viseme
 * names match what Avatar.tsx expects.
 */

import { Suspense, useMemo, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface MeshInfo {
  name: string;
  morphTargets: string[];
}

// ---------------------------------------------------------------------------
// Required RPM morph-target names (what Avatar.tsx actively uses)
// ---------------------------------------------------------------------------
// The two morph targets this Wolf3D GLB actually exposes.
// Update this set whenever you swap the avatar model.
const REQUIRED_TARGETS = new Set([
  "mouthOpen",
  "mouthSmile",
]);

// ---------------------------------------------------------------------------
// Scanner component – runs inside the Canvas
// ---------------------------------------------------------------------------
function AvatarScanner({ onData }: { onData: (meshes: MeshInfo[]) => void }) {
  const { scene } = useGLTF("/avatar.glb");
  const hasReported = useMemo(() => ({ done: false }), []);

  // Report once after the first frame so Three.js has finished setup
  useFrame(() => {
    if (hasReported.done) return;
    hasReported.done = true;

    const meshes: MeshInfo[] = [];
    scene.traverse((child) => {
      if (
        child instanceof THREE.SkinnedMesh &&
        child.morphTargetDictionary &&
        Object.keys(child.morphTargetDictionary).length > 0
      ) {
        meshes.push({
          name: child.name || "(unnamed)",
          morphTargets: Object.keys(child.morphTargetDictionary),
        });
      }
    });
    onData(meshes);
  });

  return <primitive object={scene} />;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function DebugAvatarPage() {
  // Only render in dev
  if (process.env.NODE_ENV === "production") {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        Debug page not available in production.
      </div>
    );
  }

  const [meshInfos, setMeshInfos] = useState<MeshInfo[]>([]);
  const [scanned, setScanned] = useState(false);

  const handleData = (data: MeshInfo[]) => {
    setMeshInfos(data);
    setScanned(true);
  };

  const allFoundTargets = new Set(meshInfos.flatMap((m) => m.morphTargets));
  const missingTargets = [...REQUIRED_TARGETS].filter((t) => !allFoundTargets.has(t));
  const extraTargets = [...allFoundTargets].filter((t) => !REQUIRED_TARGETS.has(t));

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 font-mono text-sm">
      <h1 className="text-2xl font-bold mb-1 text-cyan-400">
        Avatar GLB Morph-Target Diagnostic
      </h1>
      <p className="text-gray-400 mb-4">
        Scans <code className="text-yellow-300">/public/avatar.glb</code> and
        lists every morph target Three.js exposes. Green = required &amp; found,
        Yellow = present but not driven by Avatar.tsx, Red = required but missing.
        <br />
        <span className="text-yellow-300">Current rig: Wolf3D (mouthOpen + mouthSmile)</span>
      </p>

      {/* 3-D preview + scanner (hidden size) */}
      <div style={{ width: 1, height: 1, overflow: "hidden", position: "absolute" }}>
        <Canvas>
          <Suspense fallback={null}>
            <AvatarScanner onData={handleData} />
          </Suspense>
        </Canvas>
      </div>

      {!scanned && (
        <p className="text-gray-500 animate-pulse">Scanning GLB…</p>
      )}

      {scanned && (
        <>
          {/* Summary banner */}
          <div
            className={`rounded-lg p-4 mb-6 border ${
              missingTargets.length === 0
                ? "border-green-600 bg-green-900/30"
                : "border-red-600 bg-red-900/30"
            }`}
          >
            {missingTargets.length === 0 ? (
              <span className="text-green-400 font-bold">
                ✅ All {REQUIRED_TARGETS.size} required morph targets found.
                Avatar.tsx is fully compatible with this GLB.
              </span>
            ) : (
              <span className="text-red-400 font-bold">
                ⚠️ {missingTargets.length} required morph target(s) MISSING.
                These phonemes will be silently skipped:
                {" "}{missingTargets.join(", ")}
              </span>
            )}
          </div>

          {/* Per-mesh breakdown */}
          {meshInfos.map((mesh) => (
            <div key={mesh.name} className="mb-6">
              <h2 className="text-lg font-semibold text-yellow-300 mb-2">
                SkinnedMesh: <span className="text-white">{mesh.name}</span>
                <span className="text-gray-400 text-xs ml-2">
                  ({mesh.morphTargets.length} morph targets)
                </span>
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1">
                {mesh.morphTargets.map((t) => {
                  const isRequired = REQUIRED_TARGETS.has(t);
                  const isDriven = isRequired; // all required are driven in Avatar.tsx
                  return (
                    <div
                      key={t}
                      className={`px-2 py-1 rounded text-xs ${
                        isDriven
                          ? "bg-green-800 text-green-200"
                          : "bg-gray-800 text-yellow-200"
                      }`}
                    >
                      {isDriven ? "✓" : "·"} {t}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Missing required */}
          {missingTargets.length > 0 && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-red-400 mb-2">
                Missing Required Targets
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                {missingTargets.map((t) => (
                  <div key={t} className="px-2 py-1 rounded text-xs bg-red-900 text-red-200">
                    ✗ {t}
                  </div>
                ))}
              </div>
              <p className="text-red-300 mt-2 text-xs">
                If your model uses different names, update{" "}
                <code className="text-yellow-300">ALL_VISEME_TARGETS</code>,{" "}
                <code className="text-yellow-300">VISEME_MAP</code>, and the{" "}
                <code className="text-yellow-300">REQUIRED_TARGETS</code> set in this page
                to match your GLB's actual blend shape names.
              </p>
            </div>
          )}

          {/* Extra (non-RPM) targets */}
          {extraTargets.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-400 mb-2">
                Extra Targets (not in RPM standard – not driven)
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1">
                {extraTargets.map((t) => (
                  <div key={t} className="px-2 py-1 rounded text-xs bg-gray-800 text-gray-400">
                    · {t}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Raw JSON */}
          <details className="mt-6">
            <summary className="cursor-pointer text-cyan-400 hover:text-cyan-300 mb-2">
              Raw JSON dump
            </summary>
            <pre className="bg-gray-900 rounded p-4 text-xs text-gray-300 overflow-auto max-h-96 border border-gray-700">
              {JSON.stringify(meshInfos, null, 2)}
            </pre>
          </details>
        </>
      )}
    </div>
  );
}
