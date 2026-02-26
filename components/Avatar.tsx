"use client";

import { useRef, useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

// ---------------------------------------------------------------------------
// Rhubarb phoneme → Wolf3D morph-target mapping
//
// This GLB exposes exactly two blend shapes on every SkinnedMesh:
//   mouthOpen   – jaw drop (0 = closed, 1 = fully open)
//   mouthSmile  – lip spread (0 = neutral, 1 = full grin)
//
// Each Rhubarb letter is mapped to a (mouthOpen, mouthSmile) pair that
// approximates the articulatory shape for that phoneme group.
// ---------------------------------------------------------------------------
interface VisemeTarget {
  name: string;
  weight: number;
}

// Look-ahead blend weight — 15 % of the NEXT phoneme bleeds into the
// current frame so transitions feel organic rather than step-function sharp.
const LOOK_AHEAD_WEIGHT = 0.15;

//  Rhubarb │ Phonemes            │ mouthOpen │ mouthSmile
//  ────────┼─────────────────────┼───────────┼───────────
//  X       │ silence / rest      │   0.00    │   0.00
//  A       │ "ah" (most open)    │   1.00    │   0.05
//  B       │ m / b / p (closed)  │   0.00    │   0.00
//  C       │ "oh" (round open)   │   0.65    │   0.00
//  D       │ th / d / n          │   0.35    │   0.12
//  E       │ "oo" (tight round)  │   0.20    │   0.00
//  F       │ f / v               │   0.15    │   0.05
//  G       │ k / g (velar)       │   0.45    │   0.00
//  H       │ s / z / sh / "ee"   │   0.22    │   0.48
const VISEME_MAP: Record<string, VisemeTarget[]> = {
  X: [],  // fully closed — both targets reset to 0
  A: [{ name: "mouthOpen",  weight: 1.00 }, { name: "mouthSmile", weight: 0.05 }],
  B: [],  // lips pressed — both at 0
  C: [{ name: "mouthOpen",  weight: 0.65 }],
  D: [{ name: "mouthOpen",  weight: 0.35 }, { name: "mouthSmile", weight: 0.12 }],
  E: [{ name: "mouthOpen",  weight: 0.20 }],
  F: [{ name: "mouthOpen",  weight: 0.15 }, { name: "mouthSmile", weight: 0.05 }],
  G: [{ name: "mouthOpen",  weight: 0.45 }],
  H: [{ name: "mouthOpen",  weight: 0.22 }, { name: "mouthSmile", weight: 0.48 }],
};

// The two targets present in this Wolf3D GLB — used for per-frame reset
const ALL_VISEME_TARGETS = ["mouthOpen", "mouthSmile"];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface AvatarProps {
  currentViseme: string;
  /** Next queued viseme (from look-ahead in useLipSync) */
  nextViseme: string;
  /** Whether audio is currently playing (suppresses idle breathing) */
  isPlaying: boolean;
}

// ---------------------------------------------------------------------------
// Avatar — loaded from /public/avatar.glb (Ready Player Me full-body .glb)
// ---------------------------------------------------------------------------
export function Avatar({ currentViseme, nextViseme, isPlaying }: AvatarProps) {
  const groupRef    = useRef<THREE.Group>(null);
  const { scene }   = useGLTF("/avatar.glb");

  // Collect every SkinnedMesh that has morph targets
  const morphMeshes = useMemo<THREE.SkinnedMesh[]>(() => {
    const meshes: THREE.SkinnedMesh[] = [];
    scene.traverse((child) => {
      if (
        child instanceof THREE.SkinnedMesh &&
        child.morphTargetDictionary &&
        child.morphTargetInfluences
      ) {
        child.frustumCulled = false;
        meshes.push(child);
      }
    });
    return meshes;
  }, [scene]);

  // On load: compute bounding box, log head height, auto-center the model
  const autoOffset = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  useEffect(() => {
    const box    = new THREE.Box3().setFromObject(scene);
    const size   = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    // Log so user can verify model dimensions in browser console
    console.log(
      `[Avatar] GLB loaded — size: (${size.x.toFixed(2)}, ${size.y.toFixed(2)}, ${size.z.toFixed(2)})` +
      ` | center: (${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)})` +
      ` | head ≈ y=${box.max.y.toFixed(2)}`
    );

    // Shift the group so the top of the head sits at y ≈ 0.1 (camera looks at y=0)
    // Works regardless of whether this is a half-bust or full-body RPM export
    autoOffset.current.set(-center.x, -(box.max.y - 0.12), -center.z);
    if (groupRef.current) {
      groupRef.current.position.copy(autoOffset.current);
    }
  }, [scene]);


  // Desired morph-target weights (updated every time currentViseme changes)
  const targetWeights = useRef<Record<string, number>>({});

  useEffect(() => {
    const weights: Record<string, number> = {};
    ALL_VISEME_TARGETS.forEach((t) => (weights[t] = 0));

    // Primary viseme
    const primary = VISEME_MAP[currentViseme] ?? VISEME_MAP["X"];
    primary.forEach(({ name, weight }) => (weights[name] = weight));

    // Look-ahead: blend 15% of the next viseme into the current target so
    // transitions between phonemes are organic rather than frame-step sharp.
    if (nextViseme && nextViseme !== currentViseme) {
      const ahead = VISEME_MAP[nextViseme] ?? VISEME_MAP["X"];
      ahead.forEach(({ name, weight }) => {
        weights[name] = Math.min(1, (weights[name] ?? 0) + weight * LOOK_AHEAD_WEIGHT);
      });
    }

    targetWeights.current = weights;
  }, [currentViseme, nextViseme]);

  // ---- Idle breath state --------------------------------------------------
  const breathTime = useRef(0);

  // ---- Per-frame animation ------------------------------------------------
  useFrame((_, delta) => {
    if (!groupRef.current) return;

    // Exponential lerp — frame-rate independent
    // Attack 20/s (fast mouth opening) · Decay 10/s (smooth jaw close)
    morphMeshes.forEach((mesh) => {
      if (!mesh.morphTargetDictionary || !mesh.morphTargetInfluences) return;

      ALL_VISEME_TARGETS.forEach((name) => {
        const idx = mesh.morphTargetDictionary![name];
        if (idx === undefined) return;

        const current = mesh.morphTargetInfluences![idx] ?? 0;
        const target  = targetWeights.current[name]        ?? 0;
        const rate    = target > current ? 20 : 10;

        mesh.morphTargetInfluences![idx] = THREE.MathUtils.lerp(
          current,
          target,
          1 - Math.exp(-rate * delta),
        );
      });
    });

    // ---- Idle breathing / speech head-nod ---------------------------------
    breathTime.current += delta * 0.7;

    if (isPlaying) {
      // While speaking: suppress chest rise, add subtle 4 Hz head-nod that
      // makes the avatar feel alive rather than a static talking statue.
      groupRef.current.position.y =
        autoOffset.current.y +
        Math.sin(breathTime.current * (4 / 0.7)) * 0.002;
    } else {
      // Idle: full breathing cycle (primary 0.7 Hz + 2nd harmonic)
      groupRef.current.position.y =
        autoOffset.current.y +
        Math.sin(breathTime.current) * 0.0035 +
        Math.sin(breathTime.current * 2.3) * 0.001;
    }
  });

  return (
    <group ref={groupRef} dispose={null}>
      <primitive object={scene} />
    </group>
  );
}

// Pre-warm the asset fetch so it starts loading before Suspense kicks in
useGLTF.preload("/avatar.glb");
