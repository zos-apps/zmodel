/**
 * Proportional Editing (Soft Selection)
 *
 * Provides smooth falloff for transform operations affecting nearby vertices.
 */

import type { EditableMesh, Vec3 } from '../types';

export type FalloffType = 'smooth' | 'sphere' | 'root' | 'inverse_square' | 'sharp' | 'linear' | 'constant' | 'random';

export interface ProportionalEditSettings {
  enabled: boolean;
  connected: boolean;  // Only affect topologically connected vertices
  projected: boolean;  // Use 2D screen-space distance
  falloff: FalloffType;
  size: number;        // Influence radius
}

export interface AffectedVertex {
  index: number;
  weight: number;  // 0-1, falloff weight
  originalPosition: Vec3;
}

// Falloff functions
export function calculateFalloff(distance: number, size: number, type: FalloffType): number {
  if (distance >= size) return 0;
  if (distance <= 0) return 1;

  const t = distance / size;

  switch (type) {
    case 'smooth':
      // Smooth Hermite interpolation (like Blender's smooth)
      return 1 - (3 * t * t - 2 * t * t * t);

    case 'sphere':
      // Spherical falloff (sqrt curve)
      return Math.sqrt(1 - t * t);

    case 'root':
      // Square root falloff
      return 1 - Math.sqrt(t);

    case 'inverse_square':
      // Inverse square (physics-like)
      return 1 / (1 + 9 * t * t);

    case 'sharp':
      // Sharp falloff (cubic)
      const s = 1 - t;
      return s * s * s;

    case 'linear':
      return 1 - t;

    case 'constant':
      return 1;

    case 'random':
      // Random with distance bias
      return (1 - t) * (0.5 + 0.5 * Math.random());

    default:
      return 1 - t;
  }
}

/**
 * Get all vertices affected by proportional edit from selected vertices.
 */
export function getAffectedVertices(
  mesh: EditableMesh,
  selectedVertices: number[],
  settings: ProportionalEditSettings
): AffectedVertex[] {
  const { geometry } = mesh;
  const { size, falloff, connected, projected } = settings;
  const affected: AffectedVertex[] = [];

  if (!settings.enabled || selectedVertices.length === 0) {
    // Just return selected vertices with weight 1
    return selectedVertices.map(index => ({
      index,
      weight: 1,
      originalPosition: {
        x: geometry.vertices[index * 3],
        y: geometry.vertices[index * 3 + 1],
        z: geometry.vertices[index * 3 + 2],
      },
    }));
  }

  // Calculate center of selection
  let centerX = 0, centerY = 0, centerZ = 0;
  for (const idx of selectedVertices) {
    centerX += geometry.vertices[idx * 3];
    centerY += geometry.vertices[idx * 3 + 1];
    centerZ += geometry.vertices[idx * 3 + 2];
  }
  centerX /= selectedVertices.length;
  centerY /= selectedVertices.length;
  centerZ /= selectedVertices.length;
  const center: Vec3 = { x: centerX, y: centerY, z: centerZ };

  // Get connected vertices if needed
  let validVertices: Set<number>;
  if (connected) {
    validVertices = getConnectedVertices(mesh, selectedVertices);
  } else {
    validVertices = new Set(Array.from({ length: geometry.vertexCount }, (_, i) => i));
  }

  // Calculate weights for all vertices
  for (const index of validVertices) {
    const x = geometry.vertices[index * 3];
    const y = geometry.vertices[index * 3 + 1];
    const z = geometry.vertices[index * 3 + 2];

    // Calculate distance from selection center
    const dx = x - center.x;
    const dy = y - center.y;
    const dz = z - center.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // Calculate weight
    let weight: number;
    if (selectedVertices.includes(index)) {
      weight = 1; // Selected vertices always have full weight
    } else if (distance < size) {
      weight = calculateFalloff(distance, size, falloff);
    } else {
      continue; // Outside influence radius
    }

    if (weight > 0.001) {
      affected.push({
        index,
        weight,
        originalPosition: { x, y, z },
      });
    }
  }

  return affected;
}

/**
 * Get vertices connected topologically to selected vertices.
 */
function getConnectedVertices(mesh: EditableMesh, selectedVertices: number[]): Set<number> {
  const { geometry } = mesh;
  const connected = new Set<number>(selectedVertices);
  const toVisit = [...selectedVertices];

  // Build adjacency from edges
  const adjacency = new Map<number, Set<number>>();
  for (const edge of geometry.edges) {
    if (!adjacency.has(edge.a)) adjacency.set(edge.a, new Set());
    if (!adjacency.has(edge.b)) adjacency.set(edge.b, new Set());
    adjacency.get(edge.a)!.add(edge.b);
    adjacency.get(edge.b)!.add(edge.a);
  }

  // BFS to find connected vertices
  while (toVisit.length > 0) {
    const current = toVisit.pop()!;
    const neighbors = adjacency.get(current);
    if (!neighbors) continue;

    for (const neighbor of neighbors) {
      if (!connected.has(neighbor)) {
        connected.add(neighbor);
        toVisit.push(neighbor);
      }
    }
  }

  return connected;
}

/**
 * Apply proportional transform to mesh.
 */
export function applyProportionalTransform(
  mesh: EditableMesh,
  affectedVertices: AffectedVertex[],
  transform: (original: Vec3, weight: number) => Vec3
): void {
  const { geometry } = mesh;

  for (const { index, weight, originalPosition } of affectedVertices) {
    const newPos = transform(originalPosition, weight);
    geometry.vertices[index * 3] = newPos.x;
    geometry.vertices[index * 3 + 1] = newPos.y;
    geometry.vertices[index * 3 + 2] = newPos.z;
  }
}

/**
 * Proportional move.
 */
export function proportionalMove(
  mesh: EditableMesh,
  selectedVertices: number[],
  delta: Vec3,
  settings: ProportionalEditSettings
): void {
  const affected = getAffectedVertices(mesh, selectedVertices, settings);
  
  applyProportionalTransform(mesh, affected, (original, weight) => ({
    x: original.x + delta.x * weight,
    y: original.y + delta.y * weight,
    z: original.z + delta.z * weight,
  }));
}

/**
 * Proportional scale.
 */
export function proportionalScale(
  mesh: EditableMesh,
  selectedVertices: number[],
  scale: Vec3,
  center: Vec3,
  settings: ProportionalEditSettings
): void {
  const affected = getAffectedVertices(mesh, selectedVertices, settings);
  
  applyProportionalTransform(mesh, affected, (original, weight) => {
    const effectiveScale = {
      x: 1 + (scale.x - 1) * weight,
      y: 1 + (scale.y - 1) * weight,
      z: 1 + (scale.z - 1) * weight,
    };
    return {
      x: center.x + (original.x - center.x) * effectiveScale.x,
      y: center.y + (original.y - center.y) * effectiveScale.y,
      z: center.z + (original.z - center.z) * effectiveScale.z,
    };
  });
}

/**
 * Proportional rotate.
 */
export function proportionalRotate(
  mesh: EditableMesh,
  selectedVertices: number[],
  axis: Vec3,
  angle: number,
  center: Vec3,
  settings: ProportionalEditSettings
): void {
  const affected = getAffectedVertices(mesh, selectedVertices, settings);
  
  // Normalize axis
  const len = Math.sqrt(axis.x * axis.x + axis.y * axis.y + axis.z * axis.z);
  const ax = axis.x / len;
  const ay = axis.y / len;
  const az = axis.z / len;

  applyProportionalTransform(mesh, affected, (original, weight) => {
    const effectiveAngle = angle * weight;
    const cos = Math.cos(effectiveAngle);
    const sin = Math.sin(effectiveAngle);
    const oneMinusCos = 1 - cos;

    // Translate to center
    const x = original.x - center.x;
    const y = original.y - center.y;
    const z = original.z - center.z;

    // Rodrigues rotation formula
    const dot = ax * x + ay * y + az * z;
    const crossX = ay * z - az * y;
    const crossY = az * x - ax * z;
    const crossZ = ax * y - ay * x;

    return {
      x: center.x + x * cos + crossX * sin + ax * dot * oneMinusCos,
      y: center.y + y * cos + crossY * sin + ay * dot * oneMinusCos,
      z: center.z + z * cos + crossZ * sin + az * dot * oneMinusCos,
    };
  });
}
