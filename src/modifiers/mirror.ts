/**
 * Mirror Modifier
 *
 * Mirrors mesh geometry across one or more axes.
 */

import type { EditableMesh, EditableGeometry, Vec3, Face, Edge } from '../types';

export interface MirrorOptions {
  axis: 'x' | 'y' | 'z';
  merge: boolean;
  mergeThreshold: number;
  flipNormals: boolean;
}

/**
 * Apply mirror modifier to mesh.
 */
export function mirror(
  mesh: EditableMesh,
  options: MirrorOptions
): EditableMesh {
  const { axis, merge, mergeThreshold, flipNormals } = options;
  const { geometry } = mesh;

  const axisIdx = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
  const origVertexCount = geometry.vertexCount;

  // Build new arrays
  const newVertices: number[] = [...geometry.vertices];
  const newNormals: number[] = [...geometry.normals];
  const newUvs: number[] = [...geometry.uvs];
  const newIndices: number[] = [...geometry.indices];

  // Mapping from original vertex to merged vertex (for vertices on mirror plane)
  const mergeMap = new Map<number, number>();

  // Find vertices to merge (on the mirror plane)
  if (merge) {
    for (let i = 0; i < origVertexCount; i++) {
      const value = geometry.vertices[i * 3 + axisIdx];
      if (Math.abs(value) < mergeThreshold) {
        mergeMap.set(i, i); // Will be merged with itself
      }
    }
  }

  // Copy mirrored vertices
  const vertexMapping = new Map<number, number>();
  let newVertexIndex = origVertexCount;

  for (let i = 0; i < origVertexCount; i++) {
    if (mergeMap.has(i)) {
      vertexMapping.set(i, i);
      continue;
    }

    // Create mirrored vertex
    const x = geometry.vertices[i * 3];
    const y = geometry.vertices[i * 3 + 1];
    const z = geometry.vertices[i * 3 + 2];

    const nx = geometry.normals[i * 3];
    const ny = geometry.normals[i * 3 + 1];
    const nz = geometry.normals[i * 3 + 2];

    const u = geometry.uvs[i * 2];
    const v = geometry.uvs[i * 2 + 1];

    // Mirror position
    const mirroredPos = [x, y, z];
    mirroredPos[axisIdx] = -mirroredPos[axisIdx];

    // Mirror normal
    const mirroredNormal = [nx, ny, nz];
    if (flipNormals) {
      mirroredNormal[axisIdx] = -mirroredNormal[axisIdx];
    }

    newVertices.push(mirroredPos[0], mirroredPos[1], mirroredPos[2]);
    newNormals.push(mirroredNormal[0], mirroredNormal[1], mirroredNormal[2]);
    newUvs.push(axis === 'x' ? 1 - u : u, v);

    vertexMapping.set(i, newVertexIndex);
    newVertexIndex++;
  }

  // Copy mirrored triangles with flipped winding
  for (let i = 0; i < geometry.indices.length; i += 3) {
    const i0 = geometry.indices[i];
    const i1 = geometry.indices[i + 1];
    const i2 = geometry.indices[i + 2];

    const m0 = vertexMapping.get(i0) ?? i0;
    const m1 = vertexMapping.get(i1) ?? i1;
    const m2 = vertexMapping.get(i2) ?? i2;

    // Flip winding order for correct face orientation
    newIndices.push(m0, m2, m1);
  }

  // Build edges
  const edges: Edge[] = [];
  const edgeSet = new Set<string>();
  for (let i = 0; i < newIndices.length; i += 3) {
    const tri = [newIndices[i], newIndices[i + 1], newIndices[i + 2]];
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
  for (let i = 0; i < newIndices.length; i += 3) {
    const verts = [newIndices[i], newIndices[i + 1], newIndices[i + 2]];
    const normal: Vec3 = {
      x: newNormals[verts[0] * 3],
      y: newNormals[verts[0] * 3 + 1],
      z: newNormals[verts[0] * 3 + 2],
    };
    faces.push({ vertices: verts, normal });
  }

  const newGeometry: EditableGeometry = {
    id: geometry.id,
    vertices: new Float32Array(newVertices),
    normals: new Float32Array(newNormals),
    uvs: new Float32Array(newUvs),
    indices: new Uint16Array(newIndices),
    vertexCount: newVertices.length / 3,
    edges,
    faces,
  };

  return {
    ...mesh,
    geometry: newGeometry,
  };
}
