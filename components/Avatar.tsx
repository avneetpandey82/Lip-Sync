"use client";

import { useRef, useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

// ---------------------------------------------------------------------------
// Rhubarb phoneme → Ready Player Me morph-target mapping
// ---------------------------------------------------------------------------
interface VisemeTarget {
  name: string;
  weight: number;
}

const VISEME_MAP: Record<string, VisemeTarget[]> = {
  X: [{ name: "viseme_sil", weight: 1.0 }],                                  // silence/rest
  A: [{ name: "viseme_aa",  weight: 1.0 }],                                  // open "ah"
  B: [{ name: "viseme_PP",  weight: 1.0 }],                                  // bilabial m/b/p → "ee"
  C: [{ name: "viseme_O",   weight: 1.0 }],                                  // round open "oh"
  D: [{ name: "viseme_TH",  weight: 0.8 }, { name: "viseme_DD", weight: 0.5 }], // dental "th"
  E: [{ name: "viseme_U",   weight: 1.0 }],                                  // round tight "oo"
  F: [{ name: "viseme_FF",  weight: 1.0 }],                                  // labiodental f/v
  G: [{ name: "viseme_kk",  weight: 1.0 }],                                  // velar k/g
  H: [{ name: "viseme_SS",  weight: 1.0 }],                                  // sibilant s/z
};

// All RPM morph-target names we ever touch (for reset)
const ALL_VISEME_TARGETS = [
  "viseme_sil", "viseme_aa", "viseme_PP", "viseme_FF",
  "viseme_TH",  "viseme_DD", "viseme_kk", "viseme_CH",
  "viseme_SS",  "viseme_nn", "viseme_RR", "viseme_E",
  "viseme_I",   "viseme_O",  "viseme_U",
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface AvatarProps {
  currentViseme: string;
}

// ---------------------------------------------------------------------------
// Avatar — loaded from /public/avatar.glb (Ready Player Me full-body .glb)
// ---------------------------------------------------------------------------
export function Avatar({ currentViseme }: AvatarProps) {
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
    const targets = VISEME_MAP[currentViseme] ?? VISEME_MAP["X"];
    targets.forEach(({ name, weight }) => (weights[name] = weight));
    targetWeights.current = weights;
  }, [currentViseme]);

  // ---- Blink state --------------------------------------------------------
  const blinkState = useRef({
    nextBlink:     Date.now() + 2500 + Math.random() * 2000,
    blinking:      false,
    blinkProgress: 0,
  });

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

    // ---- Eye blink ---------------------------------------------------------
    const blink = blinkState.current;
    const now   = Date.now();

    if (!blink.blinking && now >= blink.nextBlink) {
      blink.blinking      = true;
      blink.blinkProgress = 0;
    }

    if (blink.blinking) {
      blink.blinkProgress += delta * 14; // total ~130 ms for full blink cycle
      const influence = Math.sin(Math.min(blink.blinkProgress, Math.PI));

      morphMeshes.forEach((mesh) => {
        if (!mesh.morphTargetDictionary || !mesh.morphTargetInfluences) return;
        (["eyeBlinkLeft", "eyeBlinkRight"] as const).forEach((name) => {
          const idx = mesh.morphTargetDictionary![name];
          if (idx !== undefined) mesh.morphTargetInfluences![idx] = influence;
        });
      });

      if (blink.blinkProgress >= Math.PI) {
        blink.blinking   = false;
        blink.nextBlink  = Date.now() + 2500 + Math.random() * 2000;
      }
    }

    // ---- Idle breathing ----------------------------------------------------
    breathTime.current += delta * 0.7;
    // Add breathing ON TOP of the auto-offset (don't replace it)
    groupRef.current.position.y =
      autoOffset.current.y +
      Math.sin(breathTime.current) * 0.0035 +
      Math.sin(breathTime.current * 2.3) * 0.001;
  });

  return (
    <group ref={groupRef} dispose={null}>
      <primitive object={scene} />
    </group>
  );
}

// Pre-warm the asset fetch so it starts loading before Suspense kicks in
useGLTF.preload("/avatar.glb");
