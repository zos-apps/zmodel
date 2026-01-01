/**
 * Subdivide Modifier
 *
 * Subdivides mesh faces for smoother geometry.
 */

import type { EditableMesh, EditableGeometry, Vec3, Face, Edge } from '../types';

function vec3Lerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

function vec3Add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function vec3Scale(v: Vec3, s: number): Vec3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

function vec3Normalize(v: Vec3): Vec3 {
  const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (len === 0) return { x: 0, y: 0, z: 0 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

export interface SubdivideOptions {
  iterations?: number;
  smooth?: boolean;
}

/**
 * Subdivide all faces in the mesh
 */
export function subdivide(
  mesh: EditableMesh,
  options: SubdivideOptions = {}
): EditableMesh {
  const { iterations = 1, smooth = false } = options;
  let result = mesh;

  for (let iter = 0; iter < iterations; iter++) {
    result = subdivideOnce(result, smooth);
  }

  return result;
}

function subdivideOnce(mesh: EditableMesh, smooth: boolean): EditableMesh {
  const { geometry } = mesh;

  const newVertices: number[] = [...geometry.vertices];
  const newNormals: number[] = [...geometry.normals];
  const newUvs: number[] = [...geometry.uvs];
  const newIndices: number[] = [];

  // Map to store midpoint vertices for edges
  const midpointMap = new Map<string, number>();

  function getEdgeKey(a: number, b: number): string {
    return `${Math.min(a, b)}-${Math.max(a, b)}`;
  }

  function getMidpoint(a: number, b: number): number {
    const key = getEdgeKey(a, b);
    let midIdx = midpointMap.get(key);

    if (midIdx === undefined) {
      midIdx = newVertices.length / 3;
      midpointMap.set(key, midIdx);

      const va: Vec3 = {
        x: newVertices[a * 3],
        y: newVertices[a * 3 + 1],
        z: newVertices[a * 3 + 2],
      };
      const vb: Vec3 = {
        x: newVertices[b * 3],
        y: newVertices[b * 3 + 1],
        z: newVertices[b * 3 + 2],
      };

      const na: Vec3 = {
        x: newNormals[a * 3],
        y: newNormals[a * 3 + 1],
        z: newNormals[a * 3 + 2],
      };
      const nb: Vec3 = {
        x: newNormals[b * 3],
        y: newNormals[b * 3 + 1],
        z: newNormals[b * 3 + 2],
      };

      const midPos = vec3Lerp(va, vb, 0.5);
      const midNormal = vec3Normalize(vec3Lerp(na, nb, 0.5));
      const midUv = {
        u: (newUvs[a * 2] + newUvs[b * 2]) / 2,
        v: (newUvs[a * 2 + 1] + newUvs[b * 2 + 1]) / 2,
      };

      newVertices.push(midPos.x, midPos.y, midPos.z);
      newNormals.push(midNormal.x, midNormal.y, midNormal.z);
      newUvs.push(midUv.u, midUv.v);
    }

    return midIdx;
  }

  // Subdivide each triangle into 4 triangles
  for (let i = 0; i < geometry.indices.length; i += 3) {
    const v0 = geometry.indices[i];
    const v1 = geometry.indices[i + 1];
    const v2 = geometry.indices[i + 2];

    const m01 = getMidpoint(v0, v1);
    const m12 = getMidpoint(v1, v2);
    const m20 = getMidpoint(v2, v0);

    // 4 new triangles
    newIndices.push(v0, m01, m20);
    newIndices.push(m01, v1, m12);
    newIndices.push(m20, m12, v2);
    newIndices.push(m01, m12, m20);
  }

  // Apply smoothing if requested
  if (smooth) {
    // Catmull-Clark-like smoothing: move original vertices toward their neighbors
    const vertexNeighbors = new Map<number, Set<number>>();

    // Build neighbor map
    for (let i = 0; i < newIndices.length; i += 3) {
      const tri = [newIndices[i], newIndices[i + 1], newIndices[i + 2]];
      for (let j = 0; j < 3; j++) {
        const v = tri[j];
        if (!vertexNeighbors.has(v)) {
          vertexNeighbors.set(v, new Set());
        }
        vertexNeighbors.get(v)!.add(tri[(j + 1) % 3]);
        vertexNeighbors.get(v)!.add(tri[(j + 2) % 3]);
      }
    }

    // Smooth original vertices (not midpoints)
    const smoothedPositions: Vec3[] = [];
    const oldVertexCount = geometry.vertexCount;

    for (let i = 0; i < oldVertexCount; i++) {
      const neighbors = vertexNeighbors.get(i);
      if (!neighbors || neighbors.size === 0) {
        smoothedPositions[i] = {
          x: newVertices[i * 3],
          y: newVertices[i * 3 + 1],
          z: newVertices[i * 3 + 2],
        };
        continue;
      }

      let sum: Vec3 = { x: 0, y: 0, z: 0 };
      for (const n of neighbors) {
        sum = vec3Add(sum, {
          x: newVertices[n * 3],
          y: newVertices[n * 3 + 1],
          z: newVertices[n * 3 + 2],
        });
      }
      const avg = vec3Scale(sum, 1 / neighbors.size);
      const current: Vec3 = {
        x: newVertices[i * 3],
        y: newVertices[i * 3 + 1],
        z: newVertices[i * 3 + 2],
      };

      // Blend toward average (0.5 smoothing factor)
      smoothedPositions[i] = vec3Lerp(current, avg, 0.25);
    }

    // Apply smoothed positions
    for (let i = 0; i < oldVertexCount; i++) {
      newVertices[i * 3] = smoothedPositions[i].x;
      newVertices[i * 3 + 1] = smoothedPositions[i].y;
      newVertices[i * 3 + 2] = smoothedPositions[i].z;
    }
  }

  // Rebuild edges
  const newEdges: Edge[] = [];
  const edgeSet = new Set<string>();
  for (let i = 0; i < newIndices.length; i += 3) {
    const tri = [newIndices[i], newIndices[i + 1], newIndices[i + 2]];
    for (let j = 0; j < 3; j++) {
      const a = Math.min(tri[j], tri[(j + 1) % 3]);
      const b = Math.max(tri[j], tri[(j + 1) % 3]);
      const key = `${a}-${b}`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        newEdges.push({ a, b });
      }
    }
  }

  // Rebuild faces
  const newFaces: Face[] = [];
  for (let i = 0; i < newIndices.length; i += 3) {
    const verts = [newIndices[i], newIndices[i + 1], newIndices[i + 2]];
    const normal: Vec3 = {
      x: newNormals[verts[0] * 3],
      y: newNormals[verts[0] * 3 + 1],
      z: newNormals[verts[0] * 3 + 2],
    };
    newFaces.push({ vertices: verts, normal });
  }

  const newGeometry: EditableGeometry = {
    id: geometry.id,
    vertices: new Float32Array(newVertices),
    normals: new Float32Array(newNormals),
    uvs: new Float32Array(newUvs),
    indices: new Uint16Array(newIndices),
    vertexCount: newVertices.length / 3,
    edges: newEdges,
    faces: newFaces,
  };

  return {
    ...mesh,
    geometry: newGeometry,
  };
}
