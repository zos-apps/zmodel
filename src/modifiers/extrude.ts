/**
 * Extrude Modifier
 *
 * Extrudes selected faces along their normals.
 */

import type { EditableMesh, EditableGeometry, Vec3, Face, Edge } from '../types';

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

export interface ExtrudeOptions {
  distance: number;
  useNormals?: boolean;
}

/**
 * Extrude selected faces on a mesh
 */
export function extrude(
  mesh: EditableMesh,
  selectedFaces: number[],
  options: ExtrudeOptions
): EditableMesh {
  if (selectedFaces.length === 0) return mesh;

  const { distance, useNormals = true } = options;
  const { geometry } = mesh;

  // Collect all vertices that belong to selected faces
  const selectedVertices = new Set<number>();
  const faceMap = new Map<number, Face>();

  for (const faceIdx of selectedFaces) {
    const face = geometry.faces[faceIdx];
    if (face) {
      faceMap.set(faceIdx, face);
      for (const vertIdx of face.vertices) {
        selectedVertices.add(vertIdx);
      }
    }
  }

  // Calculate average normal if not using per-vertex normals
  let avgNormal: Vec3 = { x: 0, y: 0, z: 0 };
  for (const [, face] of faceMap) {
    avgNormal = vec3Add(avgNormal, face.normal);
  }
  avgNormal = vec3Normalize(avgNormal);

  // Create new vertices (extruded positions)
  const oldVertexCount = geometry.vertexCount;
  const vertexMapping = new Map<number, number>(); // old index -> new index

  const newVertices: number[] = [...geometry.vertices];
  const newNormals: number[] = [...geometry.normals];
  const newUvs: number[] = [...geometry.uvs];
  const newIndices: number[] = [...geometry.indices];

  let newVertexIndex = oldVertexCount;

  for (const oldIdx of selectedVertices) {
    const x = geometry.vertices[oldIdx * 3];
    const y = geometry.vertices[oldIdx * 3 + 1];
    const z = geometry.vertices[oldIdx * 3 + 2];

    // Get normal for this vertex
    const normal = useNormals
      ? vec3Normalize({
          x: geometry.normals[oldIdx * 3],
          y: geometry.normals[oldIdx * 3 + 1],
          z: geometry.normals[oldIdx * 3 + 2],
        })
      : avgNormal;

    // Calculate new position
    const offset = vec3Scale(normal, distance);
    newVertices.push(x + offset.x, y + offset.y, z + offset.z);

    // Copy normal
    newNormals.push(normal.x, normal.y, normal.z);

    // Copy UVs
    newUvs.push(geometry.uvs[oldIdx * 2], geometry.uvs[oldIdx * 2 + 1]);

    vertexMapping.set(oldIdx, newVertexIndex);
    newVertexIndex++;
  }

  // Update face indices to use new vertices
  const newFaces: Face[] = [...geometry.faces];
  const newEdges: Edge[] = [...geometry.edges];

  for (const faceIdx of selectedFaces) {
    const face = faceMap.get(faceIdx)!;
    const newFaceVerts = face.vertices.map((v) => vertexMapping.get(v) ?? v);

    // Update the face
    newFaces[faceIdx] = { ...face, vertices: newFaceVerts };

    // Update indices for this face's triangles
    // Find triangles that belong to this face and update them
    for (let i = 0; i < newIndices.length; i += 3) {
      const tri = [newIndices[i], newIndices[i + 1], newIndices[i + 2]];
      const inFace = tri.every((idx) => face.vertices.includes(idx));
      if (inFace) {
        newIndices[i] = vertexMapping.get(tri[0]) ?? tri[0];
        newIndices[i + 1] = vertexMapping.get(tri[1]) ?? tri[1];
        newIndices[i + 2] = vertexMapping.get(tri[2]) ?? tri[2];
      }
    }
  }

  // Create side faces (connecting old vertices to new vertices)
  const boundaryEdges: [number, number][] = [];

  // Find boundary edges (edges where only one adjacent face is selected)
  for (const faceIdx of selectedFaces) {
    const face = faceMap.get(faceIdx)!;
    const verts = face.vertices;
    for (let i = 0; i < verts.length; i++) {
      const a = verts[i];
      const b = verts[(i + 1) % verts.length];

      // Check if this edge is shared with another selected face
      let isShared = false;
      for (const otherFaceIdx of selectedFaces) {
        if (otherFaceIdx === faceIdx) continue;
        const otherFace = faceMap.get(otherFaceIdx)!;
        const otherVerts = otherFace.vertices;
        for (let j = 0; j < otherVerts.length; j++) {
          const oa = otherVerts[j];
          const ob = otherVerts[(j + 1) % otherVerts.length];
          if ((a === oa && b === ob) || (a === ob && b === oa)) {
            isShared = true;
            break;
          }
        }
        if (isShared) break;
      }

      if (!isShared) {
        boundaryEdges.push([a, b]);
      }
    }
  }

  // Create side quads for boundary edges
  for (const [a, b] of boundaryEdges) {
    const newA = vertexMapping.get(a)!;
    const newB = vertexMapping.get(b)!;

    // Add two triangles for the quad (a, b, newB, newA)
    newIndices.push(a, b, newB);
    newIndices.push(a, newB, newA);

    // Add edges
    newEdges.push({ a, b: newA });
    newEdges.push({ a: b, b: newB });

    // Add face
    const edgeVec: Vec3 = {
      x: newVertices[b * 3] - newVertices[a * 3],
      y: newVertices[b * 3 + 1] - newVertices[a * 3 + 1],
      z: newVertices[b * 3 + 2] - newVertices[a * 3 + 2],
    };
    const upVec: Vec3 = {
      x: newVertices[newA * 3] - newVertices[a * 3],
      y: newVertices[newA * 3 + 1] - newVertices[a * 3 + 1],
      z: newVertices[newA * 3 + 2] - newVertices[a * 3 + 2],
    };
    const faceNormal = vec3Normalize({
      x: edgeVec.y * upVec.z - edgeVec.z * upVec.y,
      y: edgeVec.z * upVec.x - edgeVec.x * upVec.z,
      z: edgeVec.x * upVec.y - edgeVec.y * upVec.x,
    });

    newFaces.push({ vertices: [a, b, newB, newA], normal: faceNormal });
  }

  // Create new geometry
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
