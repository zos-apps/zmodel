/**
 * Sculpt Brushes
 *
 * Brush types and presets for sculpting mode.
 */

import type { Vec3 } from '../types';

export type BrushType = 'grab' | 'smooth' | 'clay' | 'crease' | 'inflate' | 'flatten' | 'pinch';

export interface BrushSettings {
  type: BrushType;
  radius: number;
  strength: number;
  falloff: 'smooth' | 'sharp' | 'linear' | 'constant';
  invert: boolean;
  autoSmooth: number; // 0-1, automatically smooth after stroke
}

export interface BrushPreset {
  name: string;
  settings: BrushSettings;
}

export const BRUSH_PRESETS: Record<BrushType, BrushPreset> = {
  grab: {
    name: 'Grab',
    settings: {
      type: 'grab',
      radius: 0.5,
      strength: 1.0,
      falloff: 'smooth',
      invert: false,
      autoSmooth: 0,
    },
  },
  smooth: {
    name: 'Smooth',
    settings: {
      type: 'smooth',
      radius: 0.3,
      strength: 0.5,
      falloff: 'smooth',
      invert: false,
      autoSmooth: 0,
    },
  },
  clay: {
    name: 'Clay',
    settings: {
      type: 'clay',
      radius: 0.4,
      strength: 0.6,
      falloff: 'smooth',
      invert: false,
      autoSmooth: 0.1,
    },
  },
  crease: {
    name: 'Crease',
    settings: {
      type: 'crease',
      radius: 0.2,
      strength: 0.7,
      falloff: 'sharp',
      invert: false,
      autoSmooth: 0,
    },
  },
  inflate: {
    name: 'Inflate',
    settings: {
      type: 'inflate',
      radius: 0.4,
      strength: 0.5,
      falloff: 'smooth',
      invert: false,
      autoSmooth: 0.05,
    },
  },
  flatten: {
    name: 'Flatten',
    settings: {
      type: 'flatten',
      radius: 0.5,
      strength: 0.6,
      falloff: 'smooth',
      invert: false,
      autoSmooth: 0,
    },
  },
  pinch: {
    name: 'Pinch',
    settings: {
      type: 'pinch',
      radius: 0.3,
      strength: 0.5,
      falloff: 'linear',
      invert: false,
      autoSmooth: 0.1,
    },
  },
};

export function createBrush(type: BrushType): BrushSettings {
  return { ...BRUSH_PRESETS[type].settings };
}

/**
 * Calculate falloff factor based on distance and falloff type.
 */
export function calculateFalloff(
  distance: number,
  radius: number,
  falloff: BrushSettings['falloff']
): number {
  const t = Math.max(0, Math.min(1, distance / radius));

  switch (falloff) {
    case 'smooth':
      // Smooth Hermite interpolation
      return 1 - (3 * t * t - 2 * t * t * t);
    case 'sharp':
      // Sharper curve
      return Math.pow(1 - t, 3);
    case 'linear':
      return 1 - t;
    case 'constant':
      return t < 1 ? 1 : 0;
    default:
      return 1 - t;
  }
}

/**
 * Get vertices within brush radius from a hit point.
 */
export function getAffectedVertices(
  hitPoint: Vec3,
  vertices: Float32Array,
  radius: number
): { index: number; distance: number; weight: number }[] {
  const affected: { index: number; distance: number; weight: number }[] = [];
  const vertexCount = vertices.length / 3;
  const radiusSq = radius * radius;

  for (let i = 0; i < vertexCount; i++) {
    const vx = vertices[i * 3];
    const vy = vertices[i * 3 + 1];
    const vz = vertices[i * 3 + 2];

    const dx = vx - hitPoint.x;
    const dy = vy - hitPoint.y;
    const dz = vz - hitPoint.z;
    const distSq = dx * dx + dy * dy + dz * dz;

    if (distSq <= radiusSq) {
      const distance = Math.sqrt(distSq);
      affected.push({
        index: i,
        distance,
        weight: 0, // Weight calculated separately with falloff
      });
    }
  }

  return affected;
}
