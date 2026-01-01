/**
 * Bridge Edge Loops
 *
 * Creates faces between two edge loops.
 */

import type { EditableMesh, EditableGeometry, Vec3, Face, Edge } from '../types';

export interface BridgeOptions {
  loop1: number[]; // Vertex indices of first loop
  loop2: number[]; // Vertex indices of second loop
  twist: number;   // Rotation offset for alignment
  segments: number; // Number of subdivisions
  smoothness: number; // Interpolation smoothness (0-1)
  blend: 'linear' | 'smooth' | 'sphere';
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

function vec3Distance(a: Vec3, b: Vec3): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function vec3Cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

// Smooth Hermite interpolation
function smoothStep(t: number): number {
  return t * t * (3 - 2 * t);
}

// Sphere-like interpolation (bulges in middle)
function sphereBlend(t: number): number {
  return Math.sqrt(1 - Math.pow(2 * t - 1, 2)) * 0.5 + 0.5;
}

/**
 * Find optimal alignment between two loops to minimize twist.
 */
function findOptimalAlignment(
  loop1: Vec3[],
  loop2: Vec3[]
): number {
  if (loop1.length !== loop2.length) return 0;

  let bestOffset = 0;
  let minDist = Infinity;

  for (let offset = 0; offset < loop2.length; offset++) {
    let totalDist = 0;
    for (let i = 0; i < loop1.length; i++) {
      const j = (i + offset) % loop2.length;
      totalDist += vec3Distance(loop1[i], loop2[j]);
    }
    if (totalDist < minDist) {
      minDist = totalDist;
      bestOffset = offset;
    }
  }

  return bestOffset;
}

/**
 * Bridge two edge loops.
 */
export function bridgeEdgeLoops(
  mesh: EditableMesh,
  options: BridgeOptions
): EditableMesh {
  const { loop1, loop2, twist, segments, smoothness, blend } = options;
  const { geometry } = mesh;

  if (loop1.length < 3 || loop2.length < 3) return mesh;

  // Get vertex positions for each loop
  const getPos = (idx: number): Vec3 => ({
    x: geometry.vertices[idx * 3],
    y: geometry.vertices[idx * 3 + 1],
    z: geometry.vertices[idx * 3 + 2],
  });

  const getNormal = (idx: number): Vec3 => ({
    x: geometry.normals[idx * 3],
    y: geometry.normals[idx * 3 + 1],
    z: geometry.normals[idx * 3 + 2],
  });

  const getUV = (idx: number): [number, number] => [
    geometry.uvs[idx * 2],
    geometry.uvs[idx * 2 + 1],
  ];

  const loop1Pos = loop1.map(getPos);
  const loop2Pos = loop2.map(getPos);

  // Find optimal alignment if loops are same size
  let alignmentOffset = twist;
  if (loop1.length === loop2.length && twist === 0) {
    alignmentOffset = findOptimalAlignment(loop1Pos, loop2Pos);
  }

  // Start building new geometry
  const newVertices = [...geometry.vertices];
  const newNormals = [...geometry.normals];
  const newUvs = [...geometry.uvs];
  const newIndices = [...geometry.indices];

  // Create intermediate loops if segments > 1
  const allLoops: number[][] = [loop1];

  if (segments > 1) {
    for (let s = 1; s < segments; s++) {
      let t = s / segments;
      
      // Apply blend curve
      switch (blend) {
        case 'smooth':
          t = smoothStep(t);
          break;
        case 'sphere':
          t = sphereBlend(t);
          break;
        // 'linear' uses t as-is
      }

      const intermediateLoop: number[] = [];
      const count = Math.max(loop1.length, loop2.length);

      for (let i = 0; i < count; i++) {
        const i1 = i % loop1.length;
        const i2 = (i + alignmentOffset) % loop2.length;

        const p1 = loop1Pos[i1];
        const p2 = loop2Pos[i2];
        const n1 = getNormal(loop1[i1]);
        const n2 = getNormal(loop2[i2]);
        const uv1 = getUV(loop1[i1]);
        const uv2 = getUV(loop2[i2]);

        // Interpolate position with smoothness factor
        let pos = vec3Lerp(p1, p2, t);
        
        // Apply smoothness (makes bridge rounder)
        if (smoothness > 0) {
          const midPoint = vec3Scale(vec3Add(p1, p2), 0.5);
          const bulge = vec3Normalize(vec3Add(n1, n2));
          const bulgeAmount = Math.sin(Math.PI * t) * smoothness * vec3Distance(p1, p2) * 0.25;
          pos = vec3Add(pos, vec3Scale(bulge, bulgeAmount));
        }

        const newIdx = newVertices.length / 3;
        intermediateLoop.push(newIdx);

        newVertices.push(pos.x, pos.y, pos.z);

        // Interpolate normal
        const normal = vec3Normalize(vec3Lerp(n1, n2, t));
        newNormals.push(normal.x, normal.y, normal.z);

        // Interpolate UV
        newUvs.push(
          uv1[0] + t * (uv2[0] - uv1[0]),
          uv1[1] + t * (uv2[1] - uv1[1])
        );
      }

      allLoops.push(intermediateLoop);
    }
  }

  allLoops.push(loop2.map((v, i) => loop2[(i + alignmentOffset) % loop2.length]));

  // Create faces between consecutive loops
  for (let l = 0; l < allLoops.length - 1; l++) {
    const currentLoop = allLoops[l];
    const nextLoop = allLoops[l + 1];
    
    const count = Math.max(currentLoop.length, nextLoop.length);

    for (let i = 0; i < count; i++) {
      const i0 = i % currentLoop.length;
      const i1 = (i + 1) % currentLoop.length;
      const i2 = i % nextLoop.length;
      const i3 = (i + 1) % nextLoop.length;

      const v0 = currentLoop[i0];
      const v1 = currentLoop[i1];
      const v2 = nextLoop[i2];
      const v3 = nextLoop[i3];

      // Create quad as two triangles
      newIndices.push(v0, v1, v3);
      newIndices.push(v0, v3, v2);
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

/**
 * Detect edge loops from selected edges.
 */
export function detectEdgeLoops(
  geometry: EditableGeometry,
  selectedEdges: [number, number][]
): number[][] {
  const loops: number[][] = [];
  const used = new Set<string>();

  // Build adjacency map
  const adjacency = new Map<number, Set<number>>();
  for (const [a, b] of selectedEdges) {
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    if (!adjacency.has(b)) adjacency.set(b, new Set());
    adjacency.get(a)!.add(b);
    adjacency.get(b)!.add(a);
  }

  // Find loops
  for (const [startA, startB] of selectedEdges) {
    const key = `${Math.min(startA, startB)}-${Math.max(startA, startB)}`;
    if (used.has(key)) continue;

    const loop: number[] = [startA];
    used.add(key);
    let current = startB;
    let prev = startA;

    while (current !== startA) {
      loop.push(current);
      const neighbors = adjacency.get(current);
      if (!neighbors) break;

      let next: number | null = null;
      for (const n of neighbors) {
        if (n !== prev) {
          const edgeKey = `${Math.min(current, n)}-${Math.max(current, n)}`;
          if (!used.has(edgeKey)) {
            next = n;
            used.add(edgeKey);
            break;
          }
        }
      }

      if (next === null) break;
      prev = current;
      current = next;
    }

    if (loop.length >= 3) {
      loops.push(loop);
    }
  }

  return loops;
}
