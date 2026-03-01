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

// Look-ahead blend weight — 20 % of the NEXT phoneme bleeds into the
// current frame so transitions feel organic rather than step-function sharp.
const LOOK_AHEAD_WEIGHT = 0.20;

// Silence gate: amplitude below this level → mouth closes regardless of phoneme.
// Prevents the jaw hanging open during inter-word or inter-sentence pauses.
const SILENCE_THRESHOLD = 0.07;
// Floor for consonants (B/F/G/D) — these have near-zero mouthOpen already,
// but a small floor stops their shape fully disappearing on soft consonants.
const CONSONANT_AMP_FLOOR = 0.10;

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
  X: [], // fully closed — both targets reset to 0
  A: [
    { name: "mouthOpen", weight: 1.0 },
    { name: "mouthSmile", weight: 0.05 },
  ],
  B: [], // lips pressed — both at 0
  C: [{ name: "mouthOpen", weight: 0.65 }],
  D: [
    { name: "mouthOpen", weight: 0.35 },
    { name: "mouthSmile", weight: 0.12 },
  ],
  E: [{ name: "mouthOpen", weight: 0.2 }],
  F: [
    { name: "mouthOpen", weight: 0.15 },
    { name: "mouthSmile", weight: 0.05 },
  ],
  G: [{ name: "mouthOpen", weight: 0.45 }],
  H: [
    { name: "mouthOpen", weight: 0.22 },
    { name: "mouthSmile", weight: 0.48 },
  ],
};

// The two targets present in this Wolf3D GLB — used for per-frame reset
const ALL_VISEME_TARGETS = ["mouthOpen", "mouthSmile"];

// Only these meshes have visible mouth geometry — skip EyeLeft/EyeRight
// which share the morph dictionary but produce no visible change.
const MOUTH_MESHES = new Set(["Wolf3D_Head", "Wolf3D_Teeth"]);

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface AvatarProps {
  currentViseme: string;
  /** Next queued viseme (from look-ahead in useLipSync) */
  nextViseme: string;
  /** Whether audio is currently playing (suppresses idle breathing) */
  isPlaying: boolean;
  /**
   * Instantaneous RMS amplitude from the PCM waveform [0–1].
   * Used to gate and scale mouthOpen so the jaw tracks actual speech energy:
   *   • silence gaps  → mouth closes even if phoneme says open
   *   • stressed vowels → mouth opens proportionally wider
   */
  mouthAmplitude: number;
}

// ---------------------------------------------------------------------------
// Avatar — loaded from /public/avatar.glb (Ready Player Me full-body .glb)
// ---------------------------------------------------------------------------
export function Avatar({ currentViseme, nextViseme, isPlaying, mouthAmplitude }: AvatarProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF("/avatar.glb");

  const morphMeshes = useMemo<THREE.SkinnedMesh[]>(() => {
    const meshes: THREE.SkinnedMesh[] = [];
    scene.traverse((child) => {
      if (
        child instanceof THREE.SkinnedMesh &&
        MOUTH_MESHES.has(child.name) &&
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
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    // Log so user can verify model dimensions in browser console
    console.log(
      `[Avatar] GLB loaded — size: (${size.x.toFixed(2)}, ${size.y.toFixed(2)}, ${size.z.toFixed(2)})` +
        ` | center: (${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)})` +
        ` | head ≈ y=${box.max.y.toFixed(2)}`,
    );

    // Shift the group so the top of the head sits at y ≈ 0.1 (camera looks at y=0)
    // Works regardless of whether this is a half-bust or full-body RPM export
    autoOffset.current.set(-center.x, -(box.max.y - 0.12), -center.z);
    if (groupRef.current) {
      groupRef.current.position.copy(autoOffset.current);
    }
  }, [scene]);

  // Synchronous render-time refs — updated during render so useFrame always
  // reads the current viseme on the very next rAF tick with zero lag.
  const currentVisemeRef    = useRef(currentViseme);
  const nextVisemeRef       = useRef(nextViseme);
  const mouthAmplitudeRef   = useRef(mouthAmplitude);
  currentVisemeRef.current  = currentViseme;
  nextVisemeRef.current     = nextViseme;
  mouthAmplitudeRef.current = mouthAmplitude;

  // ---- Idle breath state --------------------------------------------------
  const breathTime = useRef(0);

  // ---- Per-frame animation ------------------------------------------------
  useFrame((_, delta) => {
    if (!groupRef.current) return;

    // Build target weights inline from render-time refs (zero stale-closure lag).
    const cv  = currentVisemeRef.current;
    const nv  = nextVisemeRef.current;
    const amp = mouthAmplitudeRef.current; // 0–1 RMS amplitude

    const weights: Record<string, number> = {};
    ALL_VISEME_TARGETS.forEach((t) => (weights[t] = 0));

    const primary = VISEME_MAP[cv] ?? VISEME_MAP["X"];
    primary.forEach(({ name, weight }) => (weights[name] = weight));

    if (nv && nv !== cv) {
      const ahead = VISEME_MAP[nv] ?? VISEME_MAP["X"];
      ahead.forEach(({ name, weight }) => {
        weights[name] = Math.min(1, (weights[name] ?? 0) + weight * LOOK_AHEAD_WEIGHT);
      });
    }

    // ── Amplitude-gate mouthOpen ───────────────────────────────────────────
    // Scale mouthOpen by actual speech energy from the PCM waveform.
    // • Below SILENCE_THRESHOLD → jaw closes (mouth tracks silence gaps).
    // • Above threshold          → smooth ramp so stressed vowels open wider.
    // mouthSmile is a SHAPE target, not energy, so it is NOT gated by amplitude.
    if (isPlaying) {
      // Smooth gate: 0 at silence threshold, 1 at full amplitude
      const gate = amp < SILENCE_THRESHOLD
        ? 0
        : Math.pow((amp - SILENCE_THRESHOLD) / (1.0 - SILENCE_THRESHOLD), 0.65);

      const rawOpen = weights['mouthOpen'] ?? 0;
      // Consonants (B/D/F/G) have rawOpen ≤ 0.45; give them a soft floor so
      // shape is preserved even when amplitude is low (e.g. voiceless stops).
      if (rawOpen > 0) {
        const floor = rawOpen < 0.25 ? CONSONANT_AMP_FLOOR : 0;
        weights['mouthOpen'] = rawOpen * Math.max(gate, floor);
      }
    }

    // Exponential lerp — frame-rate independent.
    // Attack 60/s → reaches 99 % target in ~3 frames (50 ms at 60fps).
    // Decay  18/s → smooth natural jaw close.
    morphMeshes.forEach((mesh) => {
      if (!mesh.morphTargetDictionary || !mesh.morphTargetInfluences) return;

      ALL_VISEME_TARGETS.forEach((name) => {
        const idx = mesh.morphTargetDictionary![name];
        if (idx === undefined) return;

        const current = mesh.morphTargetInfluences![idx] ?? 0;
        const target  = weights[name] ?? 0;
        // Attack 120/s → 99% in ~2 frames at 60 fps (instant-feeling onset).
        // Decay   22/s → gradual close so silence gaps read as natural pauses
        //                rather than a snapping-shut mouth.
        const rate = target > current ? 120 : 22;

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
        autoOffset.current.y + Math.sin(breathTime.current * (4 / 0.7)) * 0.002;
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
