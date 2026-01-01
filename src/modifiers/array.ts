/**
 * Array Modifier
 *
 * Creates copies of mesh geometry in a linear pattern.
 */

import type { EditableMesh, EditableGeometry, Vec3, Face, Edge } from '../types';

export interface ArrayOptions {
  count: number;
  offset: Vec3;
  offsetType: 'constant' | 'relative' | 'object';
  mergeVertices: boolean;
  mergeThreshold: number;
  startCap: string | null;
  endCap: string | null;
}

/**
 * Apply array modifier to mesh.
 */
export function array(
  mesh: EditableMesh,
  options: ArrayOptions
): EditableMesh {
  const { count, offset, offsetType, mergeVertices, mergeThreshold } = options;
  const { geometry } = mesh;

  if (count <= 1) return mesh;

  const origVertexCount = geometry.vertexCount;
  const origIndexCount = geometry.indices.length;

  // Calculate actual offset based on type
  let actualOffset: Vec3;
  if (offsetType === 'relative') {
    // Calculate bounding box
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (let i = 0; i < origVertexCount; i++) {
      const x = geometry.vertices[i * 3];
      const y = geometry.vertices[i * 3 + 1];
      const z = geometry.vertices[i * 3 + 2];
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
    }

    const sizeX = maxX - minX;
    const sizeY = maxY - minY;
    const sizeZ = maxZ - minZ;

    actualOffset = {
      x: sizeX * offset.x,
      y: sizeY * offset.y,
      z: sizeZ * offset.z,
    };
  } else {
    actualOffset = offset;
  }

  // Build new arrays
  const newVertices: number[] = [];
  const newNormals: number[] = [];
  const newUvs: number[] = [];
  const newIndices: number[] = [];

  // Merge map for vertices at copy boundaries
  const mergeMap = new Map<string, number>();

  for (let copy = 0; copy < count; copy++) {
    const copyOffset = {
      x: actualOffset.x * copy,
      y: actualOffset.y * copy,
      z: actualOffset.z * copy,
    };

    const baseVertex = newVertices.length / 3;

    // Copy vertices with offset
    for (let i = 0; i < origVertexCount; i++) {
      const x = geometry.vertices[i * 3] + copyOffset.x;
      const y = geometry.vertices[i * 3 + 1] + copyOffset.y;
      const z = geometry.vertices[i * 3 + 2] + copyOffset.z;

      // Check for merge with previous copy
      if (mergeVertices && copy > 0) {
        const key = `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;
        const existingIdx = mergeMap.get(key);
        if (existingIdx !== undefined) {
          // Will handle in index remapping
        }
      }

      newVertices.push(x, y, z);
      newNormals.push(
        geometry.normals[i * 3],
        geometry.normals[i * 3 + 1],
        geometry.normals[i * 3 + 2]
      );
      newUvs.push(geometry.uvs[i * 2], geometry.uvs[i * 2 + 1]);

      // Store for potential merge
      if (mergeVertices) {
        const key = `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;
        if (!mergeMap.has(key)) {
          mergeMap.set(key, baseVertex + i);
        }
      }
    }

    // Copy indices with offset
    for (let i = 0; i < origIndexCount; i++) {
      newIndices.push(geometry.indices[i] + baseVertex);
    }
  }

  // Apply merge if enabled
  let finalVertices = newVertices;
  let finalNormals = newNormals;
  let finalUvs = newUvs;
  let finalIndices = newIndices;

  if (mergeVertices) {
    const { vertices, normals, uvs, indices, vertexCount } = mergeCloseVertices(
      new Float32Array(newVertices),
      new Float32Array(newNormals),
      new Float32Array(newUvs),
      new Uint16Array(newIndices),
      mergeThreshold
    );
    finalVertices = [...vertices];
    finalNormals = [...normals];
    finalUvs = [...uvs];
    finalIndices = [...indices];
  }

  // Build edges
  const edges: Edge[] = [];
  const edgeSet = new Set<string>();
  for (let i = 0; i < finalIndices.length; i += 3) {
    const tri = [finalIndices[i], finalIndices[i + 1], finalIndices[i + 2]];
    for (let j = 0; j < 3; j++) {
      const a = Math.min(tri[j], tri[(j + 1) % 3]);
      const b = Math.max(tri[j], tri[(j + 1) % 3]);
      const key = `${a}-${b}`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        edges.push({ a, b });
      }
    }
  }

  // Build faces
  const faces: Face[] = [];
  for (let i = 0; i < finalIndices.length; i += 3) {
    const verts = [finalIndices[i], finalIndices[i + 1], finalIndices[i + 2]];
    const normal: Vec3 = {
      x: finalNormals[verts[0] * 3],
      y: finalNormals[verts[0] * 3 + 1],
      z: finalNormals[verts[0] * 3 + 2],
    };
    faces.push({ vertices: verts, normal });
  }

  const newGeometry: EditableGeometry = {
    id: geometry.id,
    vertices: new Float32Array(finalVertices),
    normals: new Float32Array(finalNormals),
    uvs: new Float32Array(finalUvs),
    indices: new Uint16Array(finalIndices),
    vertexCount: finalVertices.length / 3,
    edges,
    faces,
  };

  return {
    ...mesh,
    geometry: newGeometry,
  };
}

/**
 * Merge vertices that are within threshold distance.
 */
function mergeCloseVertices(
  vertices: Float32Array,
  normals: Float32Array,
  uvs: Float32Array,
  indices: Uint16Array,
  threshold: number
): {
  vertices: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint16Array;
  vertexCount: number;
} {
  const vertexCount = vertices.length / 3;
  const thresholdSq = threshold * threshold;

  // Map from old index to new index
  const indexMap = new Map<number, number>();
  const newVertices: number[] = [];
  const newNormals: number[] = [];
  const newUvs: number[] = [];
  let newIdx = 0;

  for (let i = 0; i < vertexCount; i++) {
    const x = vertices[i * 3];
    const y = vertices[i * 3 + 1];
    const z = vertices[i * 3 + 2];

    // Check if close to existing new vertex
    let merged = false;
    for (let j = 0; j < newVertices.length / 3; j++) {
      const dx = newVertices[j * 3] - x;
      const dy = newVertices[j * 3 + 1] - y;
      const dz = newVertices[j * 3 + 2] - z;
      if (dx * dx + dy * dy + dz * dz < thresholdSq) {
        indexMap.set(i, j);
        merged = true;
        break;
      }
    }

    if (!merged) {
      indexMap.set(i, newIdx);
      newVertices.push(x, y, z);
      newNormals.push(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]);
      newUvs.push(uvs[i * 2], uvs[i * 2 + 1]);
      newIdx++;
    }
  }

  // Remap indices
  const newIndices: number[] = [];
  for (let i = 0; i < indices.length; i++) {
    newIndices.push(indexMap.get(indices[i]) ?? indices[i]);
  }

  return {
    vertices: new Float32Array(newVertices),
    normals: new Float32Array(newNormals),
    uvs: new Float32Array(newUvs),
    indices: new Uint16Array(newIndices),
    vertexCount: newVertices.length / 3,
  };
}
