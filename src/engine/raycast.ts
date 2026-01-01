/**
 * Raycasting utilities for object selection
 */

import type { Vec3, Camera3D, EditableMesh, Transform3D } from '../types';

export interface Ray {
  origin: Vec3;
  direction: Vec3;
}

export interface RaycastHit {
  meshId: string;
  distance: number;
  point: Vec3;
  faceIndex: number;
  vertexIndex?: number;
}

// Vector math helpers
function vec3Sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function vec3Add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function vec3Scale(v: Vec3, s: number): Vec3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

function vec3Dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function vec3Cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function vec3Normalize(v: Vec3): Vec3 {
  const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (len === 0) return { x: 0, y: 0, z: 0 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

function vec3Length(v: Vec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

// Transform a point by a transform
function transformPoint(p: Vec3, t: Transform3D): Vec3 {
  // Apply scale
  let result = { x: p.x * t.scale.x, y: p.y * t.scale.y, z: p.z * t.scale.z };

  // Apply rotation (Euler XYZ)
  const { rotation } = t;

  // Rotate X
  const cosX = Math.cos(rotation.x);
  const sinX = Math.sin(rotation.x);
  result = {
    x: result.x,
    y: result.y * cosX - result.z * sinX,
    z: result.y * sinX + result.z * cosX,
  };

  // Rotate Y
  const cosY = Math.cos(rotation.y);
  const sinY = Math.sin(rotation.y);
  result = {
    x: result.x * cosY + result.z * sinY,
    y: result.y,
    z: -result.x * sinY + result.z * cosY,
  };

  // Rotate Z
  const cosZ = Math.cos(rotation.z);
  const sinZ = Math.sin(rotation.z);
  result = {
    x: result.x * cosZ - result.y * sinZ,
    y: result.x * sinZ + result.y * cosZ,
    z: result.z,
  };

  // Apply translation
  return vec3Add(result, t.position);
}

/**
 * Get ray from mouse position in screen space
 */
export function getRayFromMouse(
  mouseX: number,
  mouseY: number,
  width: number,
  height: number,
  camera: Camera3D
): Ray {
  // Convert to normalized device coordinates (-1 to 1)
  const ndcX = (mouseX / width) * 2 - 1;
  const ndcY = 1 - (mouseY / height) * 2;

  const origin = camera.position;
  const forward = vec3Normalize(vec3Sub(camera.target, camera.position));
  const right = vec3Normalize(vec3Cross(forward, camera.up));
  const up = vec3Cross(right, forward);

  // Calculate ray direction based on camera type
  let direction: Vec3;
  if (camera.type === 'perspective') {
    const fovScale = Math.tan(camera.fov / 2);
    const aspect = width / height;
    direction = vec3Normalize({
      x: forward.x + right.x * ndcX * fovScale * aspect + up.x * ndcY * fovScale,
      y: forward.y + right.y * ndcX * fovScale * aspect + up.y * ndcY * fovScale,
      z: forward.z + right.z * ndcX * fovScale * aspect + up.z * ndcY * fovScale,
    });
  } else {
    // Orthographic
    const orthoWidth = camera.zoom * 2 * (width / height);
    const orthoHeight = camera.zoom * 2;
    const rayOrigin: Vec3 = {
      x: origin.x + right.x * ndcX * orthoWidth / 2 + up.x * ndcY * orthoHeight / 2,
      y: origin.y + right.y * ndcX * orthoWidth / 2 + up.y * ndcY * orthoHeight / 2,
      z: origin.z + right.z * ndcX * orthoWidth / 2 + up.z * ndcY * orthoHeight / 2,
    };
    return { origin: rayOrigin, direction: forward };
  }

  return { origin, direction };
}

/**
 * Ray-triangle intersection using Moller-Trumbore algorithm
 */
function rayTriangleIntersect(
  ray: Ray,
  v0: Vec3,
  v1: Vec3,
  v2: Vec3
): { hit: boolean; distance: number; point: Vec3 } {
  const EPSILON = 0.000001;

  const edge1 = vec3Sub(v1, v0);
  const edge2 = vec3Sub(v2, v0);
  const h = vec3Cross(ray.direction, edge2);
  const a = vec3Dot(edge1, h);

  if (a > -EPSILON && a < EPSILON) {
    return { hit: false, distance: Infinity, point: { x: 0, y: 0, z: 0 } };
  }

  const f = 1.0 / a;
  const s = vec3Sub(ray.origin, v0);
  const u = f * vec3Dot(s, h);

  if (u < 0.0 || u > 1.0) {
    return { hit: false, distance: Infinity, point: { x: 0, y: 0, z: 0 } };
  }

  const q = vec3Cross(s, edge1);
  const v = f * vec3Dot(ray.direction, q);

  if (v < 0.0 || u + v > 1.0) {
    return { hit: false, distance: Infinity, point: { x: 0, y: 0, z: 0 } };
  }

  const t = f * vec3Dot(edge2, q);

  if (t > EPSILON) {
    const point = vec3Add(ray.origin, vec3Scale(ray.direction, t));
    return { hit: true, distance: t, point };
  }

  return { hit: false, distance: Infinity, point: { x: 0, y: 0, z: 0 } };
}

/**
 * Raycast against a mesh
 */
export function raycastMesh(ray: Ray, mesh: EditableMesh): RaycastHit | null {
  if (!mesh.visible) return null;

  const { geometry, transform } = mesh;
  const { vertices, indices } = geometry;

  let closestHit: RaycastHit | null = null;
  let closestDist = Infinity;

  // Iterate through triangles
  for (let i = 0; i < indices.length; i += 3) {
    const i0 = indices[i];
    const i1 = indices[i + 1];
    const i2 = indices[i + 2];

    // Get vertices and transform them
    const v0: Vec3 = { x: vertices[i0 * 3], y: vertices[i0 * 3 + 1], z: vertices[i0 * 3 + 2] };
    const v1: Vec3 = { x: vertices[i1 * 3], y: vertices[i1 * 3 + 1], z: vertices[i1 * 3 + 2] };
    const v2: Vec3 = { x: vertices[i2 * 3], y: vertices[i2 * 3 + 1], z: vertices[i2 * 3 + 2] };

    const tv0 = transformPoint(v0, transform);
    const tv1 = transformPoint(v1, transform);
    const tv2 = transformPoint(v2, transform);

    const result = rayTriangleIntersect(ray, tv0, tv1, tv2);

    if (result.hit && result.distance < closestDist) {
      closestDist = result.distance;
      closestHit = {
        meshId: mesh.id,
        distance: result.distance,
        point: result.point,
        faceIndex: Math.floor(i / 3),
      };
    }
  }

  return closestHit;
}

/**
 * Raycast against all meshes in scene
 */
export function raycast(ray: Ray, meshes: EditableMesh[]): RaycastHit | null {
  let closestHit: RaycastHit | null = null;
  let closestDist = Infinity;

  for (const mesh of meshes) {
    const hit = raycastMesh(ray, mesh);
    if (hit && hit.distance < closestDist) {
      closestDist = hit.distance;
      closestHit = hit;
    }
  }

  return closestHit;
}

/**
 * Find closest vertex to a point on a mesh
 */
export function findClosestVertex(mesh: EditableMesh, point: Vec3): number {
  const { geometry, transform } = mesh;
  const { vertices } = geometry;

  let closestIdx = 0;
  let closestDist = Infinity;

  for (let i = 0; i < geometry.vertexCount; i++) {
    const v: Vec3 = { x: vertices[i * 3], y: vertices[i * 3 + 1], z: vertices[i * 3 + 2] };
    const tv = transformPoint(v, transform);
    const dist = vec3Length(vec3Sub(tv, point));
    if (dist < closestDist) {
      closestDist = dist;
      closestIdx = i;
    }
  }

  return closestIdx;
}

/**
 * Check if a point is near an edge
 */
export function isPointNearEdge(
  mesh: EditableMesh,
  point: Vec3,
  edgeIdx: number,
  threshold: number
): boolean {
  const { geometry, transform } = mesh;
  const { vertices, edges } = geometry;
  const edge = edges[edgeIdx];

  const v0: Vec3 = { x: vertices[edge.a * 3], y: vertices[edge.a * 3 + 1], z: vertices[edge.a * 3 + 2] };
  const v1: Vec3 = { x: vertices[edge.b * 3], y: vertices[edge.b * 3 + 1], z: vertices[edge.b * 3 + 2] };

  const tv0 = transformPoint(v0, transform);
  const tv1 = transformPoint(v1, transform);

  // Calculate distance from point to line segment
  const line = vec3Sub(tv1, tv0);
  const len = vec3Length(line);
  if (len === 0) return vec3Length(vec3Sub(point, tv0)) < threshold;

  const t = Math.max(0, Math.min(1, vec3Dot(vec3Sub(point, tv0), line) / (len * len)));
  const projection = vec3Add(tv0, vec3Scale(line, t));
  const dist = vec3Length(vec3Sub(point, projection));

  return dist < threshold;
}
