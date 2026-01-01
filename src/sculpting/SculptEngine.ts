/**
 * Sculpt Engine
 *
 * Handles sculpting operations on mesh geometry.
 */

import type { EditableMesh, Vec3 } from '../types';
import { type BrushSettings, calculateFalloff, getAffectedVertices } from './brushes';

export interface SculptStroke {
  points: Vec3[];
  brush: BrushSettings;
  meshId: string;
}

export interface SculptBrush {
  settings: BrushSettings;
  isActive: boolean;
  lastPosition: Vec3 | null;
  accumulatedDelta: Vec3;
}

// Vector utilities
function vec3Add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function vec3Sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function vec3Scale(v: Vec3, s: number): Vec3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

function vec3Normalize(v: Vec3): Vec3 {
  const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (len === 0) return { x: 0, y: 0, z: 0 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

function vec3Length(v: Vec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

function vec3Dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export class SculptEngine {
  private mesh: EditableMesh | null = null;
  private originalVertices: Float32Array | null = null;
  private brush: SculptBrush;
  private symmetry: { x: boolean; y: boolean; z: boolean } = { x: false, y: false, z: false };

  constructor() {
    this.brush = {
      settings: {
        type: 'grab',
        radius: 0.5,
        strength: 1.0,
        falloff: 'smooth',
        invert: false,
        autoSmooth: 0,
      },
      isActive: false,
      lastPosition: null,
      accumulatedDelta: { x: 0, y: 0, z: 0 },
    };
  }

  setMesh(mesh: EditableMesh): void {
    this.mesh = mesh;
    this.originalVertices = new Float32Array(mesh.geometry.vertices);
  }

  getMesh(): EditableMesh | null {
    return this.mesh;
  }

  setBrushSettings(settings: Partial<BrushSettings>): void {
    Object.assign(this.brush.settings, settings);
  }

  getBrushSettings(): BrushSettings {
    return { ...this.brush.settings };
  }

  setSymmetry(axis: 'x' | 'y' | 'z', enabled: boolean): void {
    this.symmetry[axis] = enabled;
  }

  beginStroke(hitPoint: Vec3): void {
    this.brush.isActive = true;
    this.brush.lastPosition = hitPoint;
    this.brush.accumulatedDelta = { x: 0, y: 0, z: 0 };
    
    // Store original vertices for this stroke
    if (this.mesh) {
      this.originalVertices = new Float32Array(this.mesh.geometry.vertices);
    }
  }

  updateStroke(hitPoint: Vec3, delta: Vec3): void {
    if (!this.brush.isActive || !this.mesh) return;

    const { settings } = this.brush;
    const invert = settings.invert ? -1 : 1;

    // Apply brush effect
    this.applyBrush(hitPoint, delta, invert);

    // Apply symmetry
    if (this.symmetry.x) {
      const symPoint = { x: -hitPoint.x, y: hitPoint.y, z: hitPoint.z };
      const symDelta = { x: -delta.x, y: delta.y, z: delta.z };
      this.applyBrush(symPoint, symDelta, invert);
    }
    if (this.symmetry.y) {
      const symPoint = { x: hitPoint.x, y: -hitPoint.y, z: hitPoint.z };
      const symDelta = { x: delta.x, y: -delta.y, z: delta.z };
      this.applyBrush(symPoint, symDelta, invert);
    }
    if (this.symmetry.z) {
      const symPoint = { x: hitPoint.x, y: hitPoint.y, z: -hitPoint.z };
      const symDelta = { x: delta.x, y: delta.y, z: -delta.z };
      this.applyBrush(symPoint, symDelta, invert);
    }

    this.brush.lastPosition = hitPoint;
    this.brush.accumulatedDelta = vec3Add(this.brush.accumulatedDelta, delta);
  }

  endStroke(): void {
    if (!this.brush.isActive || !this.mesh) return;

    // Apply auto-smooth if enabled
    if (this.brush.settings.autoSmooth > 0) {
      this.applySmooth(this.brush.lastPosition!, this.brush.settings.autoSmooth);
    }

    // Recalculate normals
    this.recalculateNormals();

    this.brush.isActive = false;
    this.brush.lastPosition = null;
  }

  private applyBrush(hitPoint: Vec3, delta: Vec3, invert: number): void {
    if (!this.mesh) return;

    const { settings } = this.brush;
    const vertices = this.mesh.geometry.vertices;
    const normals = this.mesh.geometry.normals;
    const affected = getAffectedVertices(hitPoint, vertices, settings.radius);

    for (const { index, distance } of affected) {
      const falloff = calculateFalloff(distance, settings.radius, settings.falloff);
      const weight = falloff * settings.strength * invert;

      const vx = vertices[index * 3];
      const vy = vertices[index * 3 + 1];
      const vz = vertices[index * 3 + 2];

      const nx = normals[index * 3];
      const ny = normals[index * 3 + 1];
      const nz = normals[index * 3 + 2];

      let offset: Vec3 = { x: 0, y: 0, z: 0 };

      switch (settings.type) {
        case 'grab':
          // Move vertices with the mouse
          offset = vec3Scale(delta, weight);
          break;

        case 'smooth':
          // Average with neighbors (simplified - full implementation needs neighbor data)
          offset = this.calculateSmoothOffset(index, weight);
          break;

        case 'clay':
          // Push vertices along surface normal with height limit
          const clayHeight = settings.radius * 0.3;
          offset = vec3Scale({ x: nx, y: ny, z: nz }, weight * clayHeight);
          break;

        case 'crease':
          // Pull vertices toward stroke center
          const toCenter = vec3Sub(hitPoint, { x: vx, y: vy, z: vz });
          const creaseAmount = weight * 0.3;
          offset = vec3Add(
            vec3Scale(toCenter, creaseAmount * 0.5),
            vec3Scale({ x: nx, y: ny, z: nz }, -creaseAmount * 0.5)
          );
          break;

        case 'inflate':
          // Push vertices along their normals
          offset = vec3Scale({ x: nx, y: ny, z: nz }, weight * settings.radius * 0.2);
          break;

        case 'flatten':
          // Flatten to average plane
          offset = this.calculateFlattenOffset(index, hitPoint, affected, weight);
          break;

        case 'pinch':
          // Pull vertices toward stroke line
          const toLine = vec3Sub(hitPoint, { x: vx, y: vy, z: vz });
          offset = vec3Scale(toLine, weight * 0.2);
          break;
      }

      vertices[index * 3] = vx + offset.x;
      vertices[index * 3 + 1] = vy + offset.y;
      vertices[index * 3 + 2] = vz + offset.z;
    }
  }

  private calculateSmoothOffset(vertexIndex: number, weight: number): Vec3 {
    if (!this.mesh) return { x: 0, y: 0, z: 0 };

    const vertices = this.mesh.geometry.vertices;
    const edges = this.mesh.geometry.edges;
    
    // Find neighbors via edges
    const neighbors: number[] = [];
    for (const edge of edges) {
      if (edge.a === vertexIndex) neighbors.push(edge.b);
      if (edge.b === vertexIndex) neighbors.push(edge.a);
    }

    if (neighbors.length === 0) return { x: 0, y: 0, z: 0 };

    // Calculate average position of neighbors
    let avgX = 0, avgY = 0, avgZ = 0;
    for (const n of neighbors) {
      avgX += vertices[n * 3];
      avgY += vertices[n * 3 + 1];
      avgZ += vertices[n * 3 + 2];
    }
    avgX /= neighbors.length;
    avgY /= neighbors.length;
    avgZ /= neighbors.length;

    // Move toward average
    const vx = vertices[vertexIndex * 3];
    const vy = vertices[vertexIndex * 3 + 1];
    const vz = vertices[vertexIndex * 3 + 2];

    return {
      x: (avgX - vx) * weight,
      y: (avgY - vy) * weight,
      z: (avgZ - vz) * weight,
    };
  }

  private calculateFlattenOffset(
    vertexIndex: number,
    hitPoint: Vec3,
    affected: { index: number; distance: number }[],
    weight: number
  ): Vec3 {
    if (!this.mesh) return { x: 0, y: 0, z: 0 };

    const vertices = this.mesh.geometry.vertices;
    const normals = this.mesh.geometry.normals;

    // Calculate average plane from affected vertices
    let avgNormal: Vec3 = { x: 0, y: 0, z: 0 };
    for (const { index } of affected) {
      avgNormal.x += normals[index * 3];
      avgNormal.y += normals[index * 3 + 1];
      avgNormal.z += normals[index * 3 + 2];
    }
    avgNormal = vec3Normalize(avgNormal);

    // Project vertex onto plane
    const vx = vertices[vertexIndex * 3];
    const vy = vertices[vertexIndex * 3 + 1];
    const vz = vertices[vertexIndex * 3 + 2];

    const toVertex = vec3Sub({ x: vx, y: vy, z: vz }, hitPoint);
    const dist = vec3Dot(toVertex, avgNormal);

    return vec3Scale(avgNormal, -dist * weight);
  }

  private applySmooth(center: Vec3, strength: number): void {
    if (!this.mesh) return;

    const vertices = this.mesh.geometry.vertices;
    const affected = getAffectedVertices(center, vertices, this.brush.settings.radius);

    for (const { index, distance } of affected) {
      const falloff = calculateFalloff(distance, this.brush.settings.radius, 'smooth');
      const offset = this.calculateSmoothOffset(index, falloff * strength);

      vertices[index * 3] += offset.x;
      vertices[index * 3 + 1] += offset.y;
      vertices[index * 3 + 2] += offset.z;
    }
  }

  private recalculateNormals(): void {
    if (!this.mesh) return;

    const { vertices, indices, normals } = this.mesh.geometry;
    const vertexCount = vertices.length / 3;

    // Reset normals
    for (let i = 0; i < normals.length; i++) {
      normals[i] = 0;
    }

    // Accumulate face normals
    for (let i = 0; i < indices.length; i += 3) {
      const i0 = indices[i];
      const i1 = indices[i + 1];
      const i2 = indices[i + 2];

      const v0: Vec3 = { x: vertices[i0 * 3], y: vertices[i0 * 3 + 1], z: vertices[i0 * 3 + 2] };
      const v1: Vec3 = { x: vertices[i1 * 3], y: vertices[i1 * 3 + 1], z: vertices[i1 * 3 + 2] };
      const v2: Vec3 = { x: vertices[i2 * 3], y: vertices[i2 * 3 + 1], z: vertices[i2 * 3 + 2] };

      const e1 = vec3Sub(v1, v0);
      const e2 = vec3Sub(v2, v0);

      // Cross product
      const n: Vec3 = {
        x: e1.y * e2.z - e1.z * e2.y,
        y: e1.z * e2.x - e1.x * e2.z,
        z: e1.x * e2.y - e1.y * e2.x,
      };

      // Add to vertex normals
      for (const idx of [i0, i1, i2]) {
        normals[idx * 3] += n.x;
        normals[idx * 3 + 1] += n.y;
        normals[idx * 3 + 2] += n.z;
      }
    }

    // Normalize
    for (let i = 0; i < vertexCount; i++) {
      const nx = normals[i * 3];
      const ny = normals[i * 3 + 1];
      const nz = normals[i * 3 + 2];
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (len > 0) {
        normals[i * 3] = nx / len;
        normals[i * 3 + 1] = ny / len;
        normals[i * 3 + 2] = nz / len;
      }
    }
  }

  /**
   * Undo last stroke by restoring original vertices.
   */
  undoStroke(): void {
    if (!this.mesh || !this.originalVertices) return;
    this.mesh.geometry.vertices.set(this.originalVertices);
    this.recalculateNormals();
  }
}
