/**
 * Loop Cut Modifier
 *
 * Adds edge loops to a mesh by subdividing selected edges.
 */

import type { EditableMesh, EditableGeometry, Vec3, Face, Edge } from '../types';

function vec3Lerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

function vec3Normalize(v: Vec3): Vec3 {
  const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (len === 0) return { x: 0, y: 0, z: 0 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

export interface LoopCutOptions {
  numberOfCuts?: number;
  smoothness?: number;
}

/**
 * Add loop cuts to edges
 */
export function loopCut(
  mesh: EditableMesh,
  selectedEdges: [number, number][],
  options: LoopCutOptions = {}
): EditableMesh {
  if (selectedEdges.length === 0) return mesh;

  const { numberOfCuts = 1 } = options;
  const { geometry } = mesh;

  const newVertices: number[] = [...geometry.vertices];
  const newNormals: number[] = [...geometry.normals];
  const newUvs: number[] = [...geometry.uvs];
  const newIndices: number[] = [];
  const newEdges: Edge[] = [];
  const newFaces: Face[] = [];

  // Map to store new vertices created for each edge
  const edgeVertexMap = new Map<string, number[]>();

  // Create new vertices along selected edges
  for (const [a, b] of selectedEdges) {
    const edgeKey = `${Math.min(a, b)}-${Math.max(a, b)}`;
    const newVerts: number[] = [];

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

    const na: Vec3 = {
      x: geometry.normals[a * 3],
      y: geometry.normals[a * 3 + 1],
      z: geometry.normals[a * 3 + 2],
    };
    const nb: Vec3 = {
      x: geometry.normals[b * 3],
      y: geometry.normals[b * 3 + 1],
      z: geometry.normals[b * 3 + 2],
    };

    const ua = { u: geometry.uvs[a * 2], v: geometry.uvs[a * 2 + 1] };
    const ub = { u: geometry.uvs[b * 2], v: geometry.uvs[b * 2 + 1] };

    for (let i = 1; i <= numberOfCuts; i++) {
      const t = i / (numberOfCuts + 1);
      const newIdx = newVertices.length / 3;

      const pos = vec3Lerp(va, vb, t);
      const normal = vec3Normalize(vec3Lerp(na, nb, t));
      const uv = {
        u: ua.u + (ub.u - ua.u) * t,
        v: ua.v + (ub.v - ua.v) * t,
      };

      newVertices.push(pos.x, pos.y, pos.z);
      newNormals.push(normal.x, normal.y, normal.z);
      newUvs.push(uv.u, uv.v);

      newVerts.push(newIdx);
    }

    edgeVertexMap.set(edgeKey, newVerts);
  }

  // Process each triangle and subdivide if it contains a cut edge
  for (let i = 0; i < geometry.indices.length; i += 3) {
    const triVerts = [geometry.indices[i], geometry.indices[i + 1], geometry.indices[i + 2]];
    const cutEdges: Array<{ edge: [number, number]; newVerts: number[]; localIdx: [number, number] }> = [];

    // Check which edges of this triangle are being cut
    for (let j = 0; j < 3; j++) {
      const a = triVerts[j];
      const b = triVerts[(j + 1) % 3];
      const edgeKey = `${Math.min(a, b)}-${Math.max(a, b)}`;
      const edgeNewVerts = edgeVertexMap.get(edgeKey);

      if (edgeNewVerts) {
        cutEdges.push({
          edge: [a, b],
          newVerts: a < b ? edgeNewVerts : [...edgeNewVerts].reverse(),
          localIdx: [j, (j + 1) % 3],
        });
      }
    }

    if (cutEdges.length === 0) {
      // No cuts, keep original triangle
      newIndices.push(...triVerts);
    } else if (cutEdges.length === 2) {
      // Two edges cut - create a strip of quads
      const cut1 = cutEdges[0];
      const cut2 = cutEdges[1];

      // Find the shared vertex
      const sharedIdx = triVerts.find(
        (v) => (v === cut1.edge[0] || v === cut1.edge[1]) && (v === cut2.edge[0] || v === cut2.edge[1])
      );

      if (sharedIdx !== undefined) {
        // Build triangles connecting the cut vertices
        const other1 = cut1.edge[0] === sharedIdx ? cut1.edge[1] : cut1.edge[0];
        const other2 = cut2.edge[0] === sharedIdx ? cut2.edge[1] : cut2.edge[0];
        const newVerts1 = cut1.edge[0] === sharedIdx ? cut1.newVerts : [...cut1.newVerts].reverse();
        const newVerts2 = cut2.edge[0] === sharedIdx ? cut2.newVerts : [...cut2.newVerts].reverse();

        // Triangle at shared vertex
        newIndices.push(sharedIdx, newVerts1[0], newVerts2[0]);

        // Quads in the middle
        for (let k = 0; k < numberOfCuts - 1; k++) {
          newIndices.push(newVerts1[k], newVerts1[k + 1], newVerts2[k]);
          newIndices.push(newVerts2[k], newVerts1[k + 1], newVerts2[k + 1]);
        }

        // Triangle at the base
        const lastNew1 = newVerts1[newVerts1.length - 1];
        const lastNew2 = newVerts2[newVerts2.length - 1];
        newIndices.push(lastNew1, other1, other2);
        newIndices.push(lastNew1, other2, lastNew2);
      } else {
        // Fallback: keep original
        newIndices.push(...triVerts);
      }
    } else if (cutEdges.length === 1) {
      // One edge cut - split triangle into smaller triangles
      const cut = cutEdges[0];
      const [a, b] = cut.edge;
      const c = triVerts.find((v) => v !== a && v !== b)!;

      // Triangle from c to first new vertex
      newIndices.push(c, a, cut.newVerts[0]);

      // Triangles along the cut edge
      for (let k = 0; k < cut.newVerts.length - 1; k++) {
        newIndices.push(c, cut.newVerts[k], cut.newVerts[k + 1]);
      }

      // Triangle from c to last new vertex and b
      newIndices.push(c, cut.newVerts[cut.newVerts.length - 1], b);
    } else {
      // All three edges cut (complex case) - fallback to original
      newIndices.push(...triVerts);
    }
  }

  // Rebuild edges from new indices
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
