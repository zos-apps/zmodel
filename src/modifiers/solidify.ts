/**
 * Solidify Modifier
 *
 * Adds thickness to mesh surfaces.
 */

import type { EditableMesh, EditableGeometry, Vec3, Face, Edge } from '../types';

export interface SolidifyOptions {
  thickness: number;
  offset: number; // -1 to 1, where 0 is centered
  evenThickness: boolean;
  fillRim: boolean;
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

/**
 * Find boundary edges (edges shared by only one face).
 */
function findBoundaryEdges(geometry: EditableGeometry): [number, number][] {
  const edgeCounts = new Map<string, { edge: [number, number]; count: number }>();

  for (let i = 0; i < geometry.indices.length; i += 3) {
    const tri = [geometry.indices[i], geometry.indices[i + 1], geometry.indices[i + 2]];
    for (let j = 0; j < 3; j++) {
      const a = tri[j];
      const b = tri[(j + 1) % 3];
      const key = `${Math.min(a, b)}-${Math.max(a, b)}`;
      const existing = edgeCounts.get(key);
      if (existing) {
        existing.count++;
      } else {
        edgeCounts.set(key, { edge: [a, b], count: 1 });
      }
    }
  }

  const boundary: [number, number][] = [];
  for (const { edge, count } of edgeCounts.values()) {
    if (count === 1) {
      boundary.push(edge);
    }
  }
  return boundary;
}

/**
 * Apply solidify modifier to mesh.
 */
export function solidify(
  mesh: EditableMesh,
  options: SolidifyOptions
): EditableMesh {
  const { thickness, offset, evenThickness, fillRim } = options;
  const { geometry } = mesh;

  const origVertexCount = geometry.vertexCount;
  const innerOffset = thickness * (offset - 1) / 2;
  const outerOffset = thickness * (offset + 1) / 2;

  // Calculate vertex normals for even thickness
  const vertexNormals: Vec3[] = [];
  if (evenThickness) {
    for (let i = 0; i < origVertexCount; i++) {
      vertexNormals.push({ x: 0, y: 0, z: 0 });
    }
    for (let i = 0; i < geometry.indices.length; i += 3) {
      const i0 = geometry.indices[i];
      const i1 = geometry.indices[i + 1];
      const i2 = geometry.indices[i + 2];

      const normal: Vec3 = {
        x: geometry.normals[i0 * 3],
        y: geometry.normals[i0 * 3 + 1],
        z: geometry.normals[i0 * 3 + 2],
      };

      for (const idx of [i0, i1, i2]) {
        vertexNormals[idx] = vec3Add(vertexNormals[idx], normal);
      }
    }
    for (let i = 0; i < origVertexCount; i++) {
      vertexNormals[i] = vec3Normalize(vertexNormals[i]);
    }
  }

  // Build new geometry
  const newVertices: number[] = [];
  const newNormals: number[] = [];
  const newUvs: number[] = [];
  const newIndices: number[] = [];

  // Outer shell (original)
  for (let i = 0; i < origVertexCount; i++) {
    const x = geometry.vertices[i * 3];
    const y = geometry.vertices[i * 3 + 1];
    const z = geometry.vertices[i * 3 + 2];

    const nx = geometry.normals[i * 3];
    const ny = geometry.normals[i * 3 + 1];
    const nz = geometry.normals[i * 3 + 2];

    const n = evenThickness ? vertexNormals[i] : { x: nx, y: ny, z: nz };
    const displaced = vec3Add({ x, y, z }, vec3Scale(n, outerOffset));

    newVertices.push(displaced.x, displaced.y, displaced.z);
    newNormals.push(nx, ny, nz);
    newUvs.push(geometry.uvs[i * 2], geometry.uvs[i * 2 + 1]);
  }

  // Copy outer indices
  for (let i = 0; i < geometry.indices.length; i++) {
    newIndices.push(geometry.indices[i]);
  }

  // Inner shell (flipped)
  const innerStartIdx = newVertices.length / 3;
  for (let i = 0; i < origVertexCount; i++) {
    const x = geometry.vertices[i * 3];
    const y = geometry.vertices[i * 3 + 1];
    const z = geometry.vertices[i * 3 + 2];

    const nx = geometry.normals[i * 3];
    const ny = geometry.normals[i * 3 + 1];
    const nz = geometry.normals[i * 3 + 2];

    const n = evenThickness ? vertexNormals[i] : { x: nx, y: ny, z: nz };
    const displaced = vec3Add({ x, y, z }, vec3Scale(n, innerOffset));

    newVertices.push(displaced.x, displaced.y, displaced.z);
    newNormals.push(-nx, -ny, -nz); // Flip normals
    newUvs.push(geometry.uvs[i * 2], geometry.uvs[i * 2 + 1]);
  }

  // Copy inner indices (flipped winding)
  for (let i = 0; i < geometry.indices.length; i += 3) {
    newIndices.push(
      geometry.indices[i] + innerStartIdx,
      geometry.indices[i + 2] + innerStartIdx,
      geometry.indices[i + 1] + innerStartIdx
    );
  }

  // Fill rim (connect boundary edges)
  if (fillRim) {
    const boundaryEdges = findBoundaryEdges(geometry);

    for (const [a, b] of boundaryEdges) {
      const outerA = a;
      const outerB = b;
      const innerA = a + innerStartIdx;
      const innerB = b + innerStartIdx;

      // Calculate rim normal
      const edgeDir: Vec3 = {
        x: newVertices[outerB * 3] - newVertices[outerA * 3],
        y: newVertices[outerB * 3 + 1] - newVertices[outerA * 3 + 1],
        z: newVertices[outerB * 3 + 2] - newVertices[outerA * 3 + 2],
      };
      const faceNormal: Vec3 = {
        x: newNormals[outerA * 3],
        y: newNormals[outerA * 3 + 1],
        z: newNormals[outerA * 3 + 2],
      };
      const rimNormal = vec3Normalize({
        x: edgeDir.y * faceNormal.z - edgeDir.z * faceNormal.y,
        y: edgeDir.z * faceNormal.x - edgeDir.x * faceNormal.z,
        z: edgeDir.x * faceNormal.y - edgeDir.y * faceNormal.x,
      });

      // Add rim quad vertices
      const rimStart = newVertices.length / 3;
      
      // Outer edge vertices
      newVertices.push(
        newVertices[outerA * 3], newVertices[outerA * 3 + 1], newVertices[outerA * 3 + 2]
      );
      newNormals.push(rimNormal.x, rimNormal.y, rimNormal.z);
      newUvs.push(0, 0);

      newVertices.push(
        newVertices[outerB * 3], newVertices[outerB * 3 + 1], newVertices[outerB * 3 + 2]
      );
      newNormals.push(rimNormal.x, rimNormal.y, rimNormal.z);
      newUvs.push(1, 0);

      // Inner edge vertices
      newVertices.push(
        newVertices[innerB * 3], newVertices[innerB * 3 + 1], newVertices[innerB * 3 + 2]
      );
      newNormals.push(rimNormal.x, rimNormal.y, rimNormal.z);
      newUvs.push(1, 1);

      newVertices.push(
        newVertices[innerA * 3], newVertices[innerA * 3 + 1], newVertices[innerA * 3 + 2]
      );
      newNormals.push(rimNormal.x, rimNormal.y, rimNormal.z);
      newUvs.push(0, 1);

      // Rim quad triangles
      newIndices.push(rimStart, rimStart + 1, rimStart + 2);
      newIndices.push(rimStart, rimStart + 2, rimStart + 3);
    }
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
