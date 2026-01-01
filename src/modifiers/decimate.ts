/**
 * Decimate Modifier
 *
 * Reduces mesh polygon count while preserving shape.
 * Implements edge collapse decimation.
 */

import type { EditableMesh, EditableGeometry, Vec3, Face, Edge } from '../types';

export interface DecimateOptions {
  ratio: number; // Target ratio (0-1)
  mode: 'collapse' | 'unsubdivide' | 'planar';
  symmetry: boolean;
  symmetryAxis: 'x' | 'y' | 'z';
}

function vec3Add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function vec3Sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function vec3Scale(v: Vec3, s: number): Vec3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

function vec3Dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function vec3LengthSq(v: Vec3): number {
  return v.x * v.x + v.y * v.y + v.z * v.z;
}

function vec3Normalize(v: Vec3): Vec3 {
  const len = Math.sqrt(vec3LengthSq(v));
  if (len === 0) return { x: 0, y: 0, z: 0 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

// Quadric Error Metric (Q matrix)
interface Quadric {
  a: number; b: number; c: number; d: number;
  e: number; f: number; g: number;
  h: number; i: number;
  j: number;
}

function createQuadric(): Quadric {
  return { a: 0, b: 0, c: 0, d: 0, e: 0, f: 0, g: 0, h: 0, i: 0, j: 0 };
}

function quadricFromPlane(n: Vec3, d: number): Quadric {
  return {
    a: n.x * n.x, b: n.x * n.y, c: n.x * n.z, d: n.x * d,
    e: n.y * n.y, f: n.y * n.z, g: n.y * d,
    h: n.z * n.z, i: n.z * d,
    j: d * d,
  };
}

function addQuadric(q1: Quadric, q2: Quadric): Quadric {
  return {
    a: q1.a + q2.a, b: q1.b + q2.b, c: q1.c + q2.c, d: q1.d + q2.d,
    e: q1.e + q2.e, f: q1.f + q2.f, g: q1.g + q2.g,
    h: q1.h + q2.h, i: q1.i + q2.i,
    j: q1.j + q2.j,
  };
}

function evaluateQuadric(q: Quadric, v: Vec3): number {
  return (
    q.a * v.x * v.x + 2 * q.b * v.x * v.y + 2 * q.c * v.x * v.z + 2 * q.d * v.x +
    q.e * v.y * v.y + 2 * q.f * v.y * v.z + 2 * q.g * v.y +
    q.h * v.z * v.z + 2 * q.i * v.z +
    q.j
  );
}

interface CollapseCandidate {
  v1: number;
  v2: number;
  error: number;
  position: Vec3;
}

/**
 * Apply decimate modifier to mesh.
 */
export function decimate(
  mesh: EditableMesh,
  options: DecimateOptions
): EditableMesh {
  const { ratio, mode } = options;
  const { geometry } = mesh;

  if (ratio >= 1) return mesh;

  switch (mode) {
    case 'collapse':
      return decimateCollapse(mesh, ratio);
    case 'planar':
      return decimatePlanar(mesh, ratio);
    case 'unsubdivide':
      return decimateUnsubdivide(mesh, ratio);
    default:
      return mesh;
  }
}

function decimateCollapse(mesh: EditableMesh, ratio: number): EditableMesh {
  const { geometry } = mesh;
  const origFaceCount = geometry.indices.length / 3;
  const targetFaceCount = Math.max(4, Math.floor(origFaceCount * ratio));

  // Copy geometry data to work with
  const vertices: Vec3[] = [];
  const vertexCount = geometry.vertexCount;
  for (let i = 0; i < vertexCount; i++) {
    vertices.push({
      x: geometry.vertices[i * 3],
      y: geometry.vertices[i * 3 + 1],
      z: geometry.vertices[i * 3 + 2],
    });
  }

  const faces: [number, number, number][] = [];
  for (let i = 0; i < geometry.indices.length; i += 3) {
    faces.push([geometry.indices[i], geometry.indices[i + 1], geometry.indices[i + 2]]);
  }

  // Compute quadrics for each vertex
  const quadrics: Quadric[] = [];
  for (let i = 0; i < vertexCount; i++) {
    quadrics.push(createQuadric());
  }

  for (const [i0, i1, i2] of faces) {
    const v0 = vertices[i0];
    const v1 = vertices[i1];
    const v2 = vertices[i2];

    const e1 = vec3Sub(v1, v0);
    const e2 = vec3Sub(v2, v0);
    const n = vec3Normalize({
      x: e1.y * e2.z - e1.z * e2.y,
      y: e1.z * e2.x - e1.x * e2.z,
      z: e1.x * e2.y - e1.y * e2.x,
    });
    const d = -vec3Dot(n, v0);
    const planeQ = quadricFromPlane(n, d);

    quadrics[i0] = addQuadric(quadrics[i0], planeQ);
    quadrics[i1] = addQuadric(quadrics[i1], planeQ);
    quadrics[i2] = addQuadric(quadrics[i2], planeQ);
  }

  // Build edge list
  const edgeSet = new Set<string>();
  const edges: [number, number][] = [];

  for (const [i0, i1, i2] of faces) {
    const addEdge = (a: number, b: number) => {
      const key = `${Math.min(a, b)}-${Math.max(a, b)}`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        edges.push([Math.min(a, b), Math.max(a, b)]);
      }
    };
    addEdge(i0, i1);
    addEdge(i1, i2);
    addEdge(i2, i0);
  }

  // Track removed vertices
  const removedVertices = new Set<number>();
  const vertexRemap = new Map<number, number>();

  // Collapse edges until target reached
  while (faces.length > targetFaceCount) {
    // Find best edge to collapse
    let bestEdge: [number, number] | null = null;
    let bestError = Infinity;
    let bestPos: Vec3 = { x: 0, y: 0, z: 0 };

    for (const [v1, v2] of edges) {
      if (removedVertices.has(v1) || removedVertices.has(v2)) continue;

      const q = addQuadric(quadrics[v1], quadrics[v2]);
      
      // Try midpoint
      const mid = vec3Scale(vec3Add(vertices[v1], vertices[v2]), 0.5);
      const error = evaluateQuadric(q, mid);

      if (error < bestError) {
        bestError = error;
        bestEdge = [v1, v2];
        bestPos = mid;
      }
    }

    if (!bestEdge) break;

    const [v1, v2] = bestEdge;

    // Move v1 to optimal position
    vertices[v1] = bestPos;
    quadrics[v1] = addQuadric(quadrics[v1], quadrics[v2]);

    // Mark v2 as removed
    removedVertices.add(v2);

    // Remap v2 to v1 in all faces
    for (let i = faces.length - 1; i >= 0; i--) {
      const face = faces[i];
      
      // Replace v2 with v1
      for (let j = 0; j < 3; j++) {
        if (face[j] === v2) face[j] = v1;
      }

      // Remove degenerate faces
      if (face[0] === face[1] || face[1] === face[2] || face[2] === face[0]) {
        faces.splice(i, 1);
      }
    }

    // Update edges
    for (let i = edges.length - 1; i >= 0; i--) {
      const edge = edges[i];
      if (edge[0] === v2) edge[0] = v1;
      if (edge[1] === v2) edge[1] = v1;
      if (edge[0] === edge[1]) {
        edges.splice(i, 1);
      }
    }
  }

  // Rebuild geometry
  const newVertices: number[] = [];
  const newNormals: number[] = [];
  const newUvs: number[] = [];
  const newIndices: number[] = [];

  // Create compact vertex array
  const newVertexMap = new Map<number, number>();
  let newIdx = 0;

  for (const face of faces) {
    for (const vIdx of face) {
      if (!newVertexMap.has(vIdx)) {
        const v = vertices[vIdx];
        newVertices.push(v.x, v.y, v.z);
        newNormals.push(0, 0, 0); // Will recalculate
        newUvs.push(
          geometry.uvs[vIdx * 2] ?? 0,
          geometry.uvs[vIdx * 2 + 1] ?? 0
        );
        newVertexMap.set(vIdx, newIdx++);
      }
    }
  }

  // Build new indices
  for (const face of faces) {
    newIndices.push(
      newVertexMap.get(face[0])!,
      newVertexMap.get(face[1])!,
      newVertexMap.get(face[2])!
    );
  }

  // Recalculate normals
  for (let i = 0; i < newIndices.length; i += 3) {
    const i0 = newIndices[i];
    const i1 = newIndices[i + 1];
    const i2 = newIndices[i + 2];

    const v0: Vec3 = { x: newVertices[i0 * 3], y: newVertices[i0 * 3 + 1], z: newVertices[i0 * 3 + 2] };
    const v1: Vec3 = { x: newVertices[i1 * 3], y: newVertices[i1 * 3 + 1], z: newVertices[i1 * 3 + 2] };
    const v2: Vec3 = { x: newVertices[i2 * 3], y: newVertices[i2 * 3 + 1], z: newVertices[i2 * 3 + 2] };

    const e1 = vec3Sub(v1, v0);
    const e2 = vec3Sub(v2, v0);
    const n: Vec3 = {
      x: e1.y * e2.z - e1.z * e2.y,
      y: e1.z * e2.x - e1.x * e2.z,
      z: e1.x * e2.y - e1.y * e2.x,
    };

    for (const idx of [i0, i1, i2]) {
      newNormals[idx * 3] += n.x;
      newNormals[idx * 3 + 1] += n.y;
      newNormals[idx * 3 + 2] += n.z;
    }
  }

  // Normalize
  for (let i = 0; i < newVertices.length / 3; i++) {
    const nx = newNormals[i * 3];
    const ny = newNormals[i * 3 + 1];
    const nz = newNormals[i * 3 + 2];
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (len > 0) {
      newNormals[i * 3] = nx / len;
      newNormals[i * 3 + 1] = ny / len;
      newNormals[i * 3 + 2] = nz / len;
    }
  }

  // Build edges
  const finalEdges: Edge[] = [];
  const finalEdgeSet = new Set<string>();
  for (let i = 0; i < newIndices.length; i += 3) {
    const tri = [newIndices[i], newIndices[i + 1], newIndices[i + 2]];
    for (let j = 0; j < 3; j++) {
      const a = Math.min(tri[j], tri[(j + 1) % 3]);
      const b = Math.max(tri[j], tri[(j + 1) % 3]);
      const key = `${a}-${b}`;
      if (!finalEdgeSet.has(key)) {
        finalEdgeSet.add(key);
        finalEdges.push({ a, b });
      }
    }
  }

  // Build faces
  const finalFaces: Face[] = [];
  for (let i = 0; i < newIndices.length; i += 3) {
    const verts = [newIndices[i], newIndices[i + 1], newIndices[i + 2]];
    const normal: Vec3 = {
      x: newNormals[verts[0] * 3],
      y: newNormals[verts[0] * 3 + 1],
      z: newNormals[verts[0] * 3 + 2],
    };
    finalFaces.push({ vertices: verts, normal });
  }

  const newGeometry: EditableGeometry = {
    id: geometry.id,
    vertices: new Float32Array(newVertices),
    normals: new Float32Array(newNormals),
    uvs: new Float32Array(newUvs),
    indices: new Uint16Array(newIndices),
    vertexCount: newVertices.length / 3,
    edges: finalEdges,
    faces: finalFaces,
  };

  return {
    ...mesh,
    geometry: newGeometry,
  };
}

function decimatePlanar(mesh: EditableMesh, ratio: number): EditableMesh {
  // Planar decimation - merge coplanar faces
  // Simplified: just use collapse for now
  return decimateCollapse(mesh, ratio);
}

function decimateUnsubdivide(mesh: EditableMesh, ratio: number): EditableMesh {
  // Unsubdivide - reverse subdivision
  // Simplified: just use collapse for now
  return decimateCollapse(mesh, ratio);
}
