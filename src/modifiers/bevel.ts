/**
 * Bevel Modifier
 *
 * Bevels edges to create smoother transitions.
 */

import type { EditableMesh, EditableGeometry, Vec3, Face, Edge } from '../types';

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

function vec3Cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export interface BevelOptions {
  amount: number;
  segments?: number;
}

/**
 * Bevel selected edges
 */
export function bevel(
  mesh: EditableMesh,
  selectedEdges: [number, number][],
  options: BevelOptions
): EditableMesh {
  if (selectedEdges.length === 0) return mesh;

  const { amount, segments = 1 } = options;
  const { geometry } = mesh;

  // For simplicity, implement single-segment bevel
  // This creates chamfered edges rather than rounded
  const newVertices: number[] = [...geometry.vertices];
  const newNormals: number[] = [...geometry.normals];
  const newUvs: number[] = [...geometry.uvs];
  const newIndices: number[] = [];

  // Map to track which vertices are affected
  const vertexOffsets = new Map<number, Vec3[]>();

  // For each selected edge, calculate offset directions
  for (const [a, b] of selectedEdges) {
    const va: Vec3 = {
      x: geometry.vertices[a * 3],
      y: geometry.vertices[a * 3 + 1],
      z: geometry.vertices[a * 3 + 2],
    };
    const vb: Vec3 = {
      x: geometry.vertices[b * 3],
      y: geometry.vertices[b * 3 + 1],
      z: geometry.vertices[b * 3 + 2],
    };

    const edgeDir = vec3Normalize(vec3Sub(vb, va));

    // Find adjacent faces to determine bevel direction
    const adjacentFaces: Face[] = [];
    for (const face of geometry.faces) {
      const hasA = face.vertices.includes(a);
      const hasB = face.vertices.includes(b);
      if (hasA && hasB) {
        adjacentFaces.push(face);
      }
    }

    // Calculate perpendicular directions for bevel
    for (const face of adjacentFaces) {
      const perpDir = vec3Normalize(vec3Cross(edgeDir, face.normal));

      if (!vertexOffsets.has(a)) vertexOffsets.set(a, []);
      if (!vertexOffsets.has(b)) vertexOffsets.set(b, []);

      vertexOffsets.get(a)!.push(vec3Scale(perpDir, amount));
      vertexOffsets.get(b)!.push(vec3Scale(perpDir, amount));
    }
  }

  // Create new vertices at offset positions
  const newVertexMap = new Map<number, number[]>();

  for (const [origIdx, offsets] of vertexOffsets) {
    const basePos: Vec3 = {
      x: geometry.vertices[origIdx * 3],
      y: geometry.vertices[origIdx * 3 + 1],
      z: geometry.vertices[origIdx * 3 + 2],
    };
    const baseNormal: Vec3 = {
      x: geometry.normals[origIdx * 3],
      y: geometry.normals[origIdx * 3 + 1],
      z: geometry.normals[origIdx * 3 + 2],
    };
    const baseUv = {
      u: geometry.uvs[origIdx * 2],
      v: geometry.uvs[origIdx * 2 + 1],
    };

    const newVerts: number[] = [];

    for (const offset of offsets) {
      const newIdx = newVertices.length / 3;
      const newPos = vec3Add(basePos, offset);

      newVertices.push(newPos.x, newPos.y, newPos.z);
      newNormals.push(baseNormal.x, baseNormal.y, baseNormal.z);
      newUvs.push(baseUv.u, baseUv.v);

      newVerts.push(newIdx);
    }

    newVertexMap.set(origIdx, newVerts);
  }

  // Rebuild triangles, replacing beveled vertices
  for (let i = 0; i < geometry.indices.length; i += 3) {
    const tri = [geometry.indices[i], geometry.indices[i + 1], geometry.indices[i + 2]];
    let modified = false;

    // Check if any vertex is beveled
    for (let j = 0; j < 3; j++) {
      const newVerts = newVertexMap.get(tri[j]);
      if (newVerts && newVerts.length > 0) {
        // For now, just use the first offset vertex
        tri[j] = newVerts[0];
        modified = true;
      }
    }

    newIndices.push(...tri);
  }

  // Add bevel faces between original and new vertices
  for (const [a, b] of selectedEdges) {
    const newVertsA = newVertexMap.get(a);
    const newVertsB = newVertexMap.get(b);

    if (newVertsA && newVertsB && newVertsA.length > 0 && newVertsB.length > 0) {
      // Create quad between original edge and beveled edge
      // This is simplified - a full implementation would create proper geometry
      newIndices.push(a, newVertsA[0], newVertsB[0]);
      newIndices.push(a, newVertsB[0], b);
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
    const v0: Vec3 = {
      x: newVertices[verts[0] * 3],
      y: newVertices[verts[0] * 3 + 1],
      z: newVertices[verts[0] * 3 + 2],
    };
    const v1: Vec3 = {
      x: newVertices[verts[1] * 3],
      y: newVertices[verts[1] * 3 + 1],
      z: newVertices[verts[1] * 3 + 2],
    };
    const v2: Vec3 = {
      x: newVertices[verts[2] * 3],
      y: newVertices[verts[2] * 3 + 1],
      z: newVertices[verts[2] * 3 + 2],
    };

    const edge1 = vec3Sub(v1, v0);
    const edge2 = vec3Sub(v2, v0);
    const normal = vec3Normalize(vec3Cross(edge1, edge2));

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
