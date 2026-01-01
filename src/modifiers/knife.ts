/**
 * Knife Tool
 *
 * Cuts through mesh geometry along a path.
 */

import type { EditableMesh, EditableGeometry, Vec3, Face, Edge } from '../types';

export interface KnifeCut {
  points: Vec3[];
  throughCut: boolean;
  constrainAngle: boolean;
  angleIncrement: number;
}

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

function vec3Lerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

// Intersect line segment with triangle, return intersection point and barycentric coords
function segmentTriangleIntersect(
  p0: Vec3, p1: Vec3,
  v0: Vec3, v1: Vec3, v2: Vec3
): { point: Vec3; t: number; bary: Vec3 } | null {
  const EPSILON = 1e-6;

  const e1 = vec3Sub(v1, v0);
  const e2 = vec3Sub(v2, v0);
  const dir = vec3Sub(p1, p0);
  const h = vec3Cross(dir, e2);
  const a = vec3Dot(e1, h);

  if (Math.abs(a) < EPSILON) return null;

  const f = 1 / a;
  const s = vec3Sub(p0, v0);
  const u = f * vec3Dot(s, h);

  if (u < 0 || u > 1) return null;

  const q = vec3Cross(s, e1);
  const v = f * vec3Dot(dir, q);

  if (v < 0 || u + v > 1) return null;

  const t = f * vec3Dot(e2, q);

  if (t < 0 || t > 1) return null;

  const point = vec3Add(p0, vec3Scale(dir, t));
  const bary: Vec3 = { x: 1 - u - v, y: u, z: v };

  return { point, t, bary };
}

// Split an edge at a point, return new vertex index
function splitEdge(
  vertices: number[],
  normals: number[],
  uvs: number[],
  v0: number,
  v1: number,
  t: number
): number {
  const newIdx = vertices.length / 3;

  const x = vertices[v0 * 3] + t * (vertices[v1 * 3] - vertices[v0 * 3]);
  const y = vertices[v0 * 3 + 1] + t * (vertices[v1 * 3 + 1] - vertices[v0 * 3 + 1]);
  const z = vertices[v0 * 3 + 2] + t * (vertices[v1 * 3 + 2] - vertices[v0 * 3 + 2]);

  const nx = normals[v0 * 3] + t * (normals[v1 * 3] - normals[v0 * 3]);
  const ny = normals[v0 * 3 + 1] + t * (normals[v1 * 3 + 1] - normals[v0 * 3 + 1]);
  const nz = normals[v0 * 3 + 2] + t * (normals[v1 * 3 + 2] - normals[v0 * 3 + 2]);

  const u = uvs[v0 * 2] + t * (uvs[v1 * 2] - uvs[v0 * 2]);
  const v = uvs[v0 * 2 + 1] + t * (uvs[v1 * 2 + 1] - uvs[v0 * 2 + 1]);

  vertices.push(x, y, z);
  normals.push(nx, ny, nz);
  uvs.push(u, v);

  return newIdx;
}

/**
 * Apply knife cut to mesh.
 */
export function knifeCut(
  mesh: EditableMesh,
  cut: KnifeCut
): EditableMesh {
  if (cut.points.length < 2) return mesh;

  const { geometry } = mesh;
  
  const vertices = [...geometry.vertices];
  const normals = [...geometry.normals];
  const uvs = [...geometry.uvs];
  const indices: number[] = [];

  // Track cuts per triangle
  const triangleCuts = new Map<number, { edge: number; point: Vec3; t: number }[]>();

  // For each segment in the cut path
  for (let segIdx = 0; segIdx < cut.points.length - 1; segIdx++) {
    const segStart = cut.points[segIdx];
    const segEnd = cut.points[segIdx + 1];

    // Extend segment for through-cuts
    const dir = vec3Normalize(vec3Sub(segEnd, segStart));
    const p0 = cut.throughCut
      ? vec3Sub(segStart, vec3Scale(dir, 1000))
      : segStart;
    const p1 = cut.throughCut
      ? vec3Add(segEnd, vec3Scale(dir, 1000))
      : segEnd;

    // Find intersections with triangles
    for (let i = 0; i < geometry.indices.length; i += 3) {
      const i0 = geometry.indices[i];
      const i1 = geometry.indices[i + 1];
      const i2 = geometry.indices[i + 2];

      const v0: Vec3 = { x: geometry.vertices[i0 * 3], y: geometry.vertices[i0 * 3 + 1], z: geometry.vertices[i0 * 3 + 2] };
      const v1: Vec3 = { x: geometry.vertices[i1 * 3], y: geometry.vertices[i1 * 3 + 1], z: geometry.vertices[i1 * 3 + 2] };
      const v2: Vec3 = { x: geometry.vertices[i2 * 3], y: geometry.vertices[i2 * 3 + 1], z: geometry.vertices[i2 * 3 + 2] };

      const result = segmentTriangleIntersect(p0, p1, v0, v1, v2);
      if (result) {
        // Determine which edge(s) to split based on barycentric coords
        const { bary, point } = result;
        const triIdx = i / 3;

        if (!triangleCuts.has(triIdx)) {
          triangleCuts.set(triIdx, []);
        }

        // Find edge closest to intersection
        const edges = [[0, 1], [1, 2], [2, 0]];
        const baryVals = [bary.x, bary.y, bary.z];
        
        // If near a vertex, don't split
        const VERTEX_THRESHOLD = 0.05;
        const nearVertex = baryVals.some(b => b > 1 - VERTEX_THRESHOLD);
        
        if (!nearVertex) {
          // Find edge to split (one with two low barycentric coords)
          for (let e = 0; e < 3; e++) {
            const [e0, e1] = edges[e];
            const oppositeIdx = 3 - e0 - e1;
            if (baryVals[oppositeIdx] < 0.9) {
              // Calculate t along edge
              const b0 = baryVals[e0];
              const b1 = baryVals[e1];
              const t = b1 / (b0 + b1);
              
              triangleCuts.get(triIdx)!.push({
                edge: e,
                point,
                t,
              });
              break;
            }
          }
        }
      }
    }
  }

  // Rebuild triangles with cuts
  for (let i = 0; i < geometry.indices.length; i += 3) {
    const triIdx = i / 3;
    const cuts = triangleCuts.get(triIdx);
    
    const i0 = geometry.indices[i];
    const i1 = geometry.indices[i + 1];
    const i2 = geometry.indices[i + 2];

    if (!cuts || cuts.length === 0) {
      // No cuts, keep original triangle
      indices.push(i0, i1, i2);
      continue;
    }

    if (cuts.length === 1) {
      // Single cut - split into two triangles
      const { edge, t } = cuts[0];
      const edgeVerts = [[i0, i1], [i1, i2], [i2, i0]][edge];
      const newVert = splitEdge(vertices, normals, uvs, edgeVerts[0], edgeVerts[1], t);
      const oppositeVert = [i2, i0, i1][edge];

      // Two new triangles
      indices.push(edgeVerts[0], newVert, oppositeVert);
      indices.push(newVert, edgeVerts[1], oppositeVert);
    } else if (cuts.length === 2) {
      // Two cuts - create quad cut through triangle
      const sorted = cuts.sort((a, b) => a.edge - b.edge);
      
      // Create new vertices for both cuts
      const edge0 = sorted[0].edge;
      const edge1 = sorted[1].edge;
      const edgeVerts0 = [[i0, i1], [i1, i2], [i2, i0]][edge0];
      const edgeVerts1 = [[i0, i1], [i1, i2], [i2, i0]][edge1];
      
      const newVert0 = splitEdge(vertices, normals, uvs, edgeVerts0[0], edgeVerts0[1], sorted[0].t);
      const newVert1 = splitEdge(vertices, normals, uvs, edgeVerts1[0], edgeVerts1[1], sorted[1].t);

      // Create appropriate triangulation
      // This depends on which edges were cut
      if (edge1 - edge0 === 1 || (edge0 === 0 && edge1 === 2)) {
        // Adjacent edges cut
        const sharedVert = [i1, i2, i0][edge0];
        const startVert = edgeVerts0[0];
        const endVert = edgeVerts1[1];

        indices.push(startVert, newVert0, newVert1);
        indices.push(startVert, newVert1, endVert);
        indices.push(newVert0, sharedVert, newVert1);
      } else {
        // Opposite edges (shouldn't happen in triangle)
        indices.push(i0, i1, i2);
      }
    } else {
      // Multiple cuts - just keep original for now
      indices.push(i0, i1, i2);
    }
  }

  // Build edges
  const edges: Edge[] = [];
  const edgeSet = new Set<string>();
  for (let i = 0; i < indices.length; i += 3) {
    const tri = [indices[i], indices[i + 1], indices[i + 2]];
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
  for (let i = 0; i < indices.length; i += 3) {
    const verts = [indices[i], indices[i + 1], indices[i + 2]];
    const normal: Vec3 = {
      x: normals[verts[0] * 3],
      y: normals[verts[0] * 3 + 1],
      z: normals[verts[0] * 3 + 2],
    };
    faces.push({ vertices: verts, normal });
  }

  const newGeometry: EditableGeometry = {
    id: geometry.id,
    vertices: new Float32Array(vertices),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices),
    vertexCount: vertices.length / 3,
    edges,
    faces,
  };

  return {
    ...mesh,
    geometry: newGeometry,
  };
}

/**
 * Knife project - project edges onto mesh surface.
 */
export function knifeProject(
  mesh: EditableMesh,
  projectMesh: EditableMesh,
  viewDirection: Vec3
): EditableMesh {
  // Project edges of projectMesh onto mesh surface
  // Simplified: collect edge paths and apply knife cut
  const cuts: Vec3[] = [];

  // Project each edge of the project mesh
  for (const edge of projectMesh.geometry.edges) {
    const v0: Vec3 = {
      x: projectMesh.geometry.vertices[edge.a * 3],
      y: projectMesh.geometry.vertices[edge.a * 3 + 1],
      z: projectMesh.geometry.vertices[edge.a * 3 + 2],
    };
    const v1: Vec3 = {
      x: projectMesh.geometry.vertices[edge.b * 3],
      y: projectMesh.geometry.vertices[edge.b * 3 + 1],
      z: projectMesh.geometry.vertices[edge.b * 3 + 2],
    };

    cuts.push(v0, v1);
  }

  if (cuts.length < 2) return mesh;

  return knifeCut(mesh, {
    points: cuts,
    throughCut: true,
    constrainAngle: false,
    angleIncrement: 0,
  });
}
