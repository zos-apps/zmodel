/**
 * Boolean Modifier
 *
 * Performs CSG (Constructive Solid Geometry) operations.
 * Implements union, difference, and intersection.
 */

import type { EditableMesh, EditableGeometry, Vec3, Face, Edge } from '../types';

export type BooleanOperation = 'union' | 'difference' | 'intersect';

export interface BooleanOptions {
  operation: BooleanOperation;
  target: EditableMesh;
  solver: 'fast' | 'exact';
}

// Plane representation
interface Plane {
  normal: Vec3;
  w: number; // Distance from origin
}

// Polygon with coplanar vertices
interface Polygon {
  vertices: Vec3[];
  plane: Plane;
}

// BSP Tree node
interface BSPNode {
  plane: Plane | null;
  front: BSPNode | null;
  back: BSPNode | null;
  polygons: Polygon[];
}

// Constants
const EPSILON = 1e-5;
const COPLANAR = 0;
const FRONT = 1;
const BACK = 2;
const SPANNING = 3;

// Vector operations
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

function vec3Clone(v: Vec3): Vec3 {
  return { x: v.x, y: v.y, z: v.z };
}

function vec3Flip(v: Vec3): Vec3 {
  return { x: -v.x, y: -v.y, z: -v.z };
}

// Create plane from three points
function planeFromPoints(a: Vec3, b: Vec3, c: Vec3): Plane {
  const n = vec3Normalize(vec3Cross(vec3Sub(b, a), vec3Sub(c, a)));
  return { normal: n, w: vec3Dot(n, a) };
}

// Flip plane
function planeFlip(plane: Plane): Plane {
  return { normal: vec3Flip(plane.normal), w: -plane.w };
}

// Classify point relative to plane
function classifyPoint(plane: Plane, point: Vec3): number {
  const t = vec3Dot(plane.normal, point) - plane.w;
  if (t < -EPSILON) return BACK;
  if (t > EPSILON) return FRONT;
  return COPLANAR;
}

// Split polygon by plane
function splitPolygon(
  plane: Plane,
  polygon: Polygon,
  coplanarFront: Polygon[],
  coplanarBack: Polygon[],
  front: Polygon[],
  back: Polygon[]
): void {
  let polygonType = 0;
  const types: number[] = [];

  for (const v of polygon.vertices) {
    const t = classifyPoint(plane, v);
    polygonType |= t;
    types.push(t);
  }

  switch (polygonType) {
    case COPLANAR:
      if (vec3Dot(plane.normal, polygon.plane.normal) > 0) {
        coplanarFront.push(polygon);
      } else {
        coplanarBack.push(polygon);
      }
      break;

    case FRONT:
      front.push(polygon);
      break;

    case BACK:
      back.push(polygon);
      break;

    case SPANNING: {
      const f: Vec3[] = [];
      const b: Vec3[] = [];

      for (let i = 0; i < polygon.vertices.length; i++) {
        const j = (i + 1) % polygon.vertices.length;
        const ti = types[i];
        const tj = types[j];
        const vi = polygon.vertices[i];
        const vj = polygon.vertices[j];

        if (ti !== BACK) f.push(vec3Clone(vi));
        if (ti !== FRONT) b.push(vec3Clone(vi));

        if ((ti | tj) === SPANNING) {
          const t =
            (plane.w - vec3Dot(plane.normal, vi)) /
            vec3Dot(plane.normal, vec3Sub(vj, vi));
          const v = vec3Lerp(vi, vj, t);
          f.push(v);
          b.push(vec3Clone(v));
        }
      }

      if (f.length >= 3) {
        front.push({ vertices: f, plane: polygon.plane });
      }
      if (b.length >= 3) {
        back.push({ vertices: b, plane: polygon.plane });
      }
      break;
    }
  }
}

// BSP operations
function buildBSP(polygons: Polygon[]): BSPNode {
  const node: BSPNode = {
    plane: null,
    front: null,
    back: null,
    polygons: [],
  };

  if (polygons.length === 0) return node;

  node.plane = polygons[0].plane;
  const front: Polygon[] = [];
  const back: Polygon[] = [];

  for (const p of polygons) {
    splitPolygon(node.plane, p, node.polygons, node.polygons, front, back);
  }

  if (front.length > 0) {
    node.front = buildBSP(front);
  }
  if (back.length > 0) {
    node.back = buildBSP(back);
  }

  return node;
}

function invertBSP(node: BSPNode): void {
  for (const p of node.polygons) {
    p.vertices.reverse();
    p.plane = planeFlip(p.plane);
  }
  if (node.plane) {
    node.plane = planeFlip(node.plane);
  }
  if (node.front) invertBSP(node.front);
  if (node.back) invertBSP(node.back);
  const temp = node.front;
  node.front = node.back;
  node.back = temp;
}

function clipPolygons(node: BSPNode, polygons: Polygon[]): Polygon[] {
  if (!node.plane) return [...polygons];

  let front: Polygon[] = [];
  let back: Polygon[] = [];

  for (const p of polygons) {
    splitPolygon(node.plane, p, front, back, front, back);
  }

  if (node.front) front = clipPolygons(node.front, front);
  if (node.back) {
    back = clipPolygons(node.back, back);
  } else {
    back = [];
  }

  return [...front, ...back];
}

function clipTo(a: BSPNode, b: BSPNode): void {
  a.polygons = clipPolygons(b, a.polygons);
  if (a.front) clipTo(a.front, b);
  if (a.back) clipTo(a.back, b);
}

function allPolygons(node: BSPNode): Polygon[] {
  let polygons = [...node.polygons];
  if (node.front) polygons = [...polygons, ...allPolygons(node.front)];
  if (node.back) polygons = [...polygons, ...allPolygons(node.back)];
  return polygons;
}

function mergeBSP(a: BSPNode, polygons: Polygon[]): void {
  if (!a.plane && polygons.length > 0) {
    a.plane = polygons[0].plane;
  }
  if (!a.plane) return;

  const front: Polygon[] = [];
  const back: Polygon[] = [];

  for (const p of polygons) {
    splitPolygon(a.plane, p, a.polygons, a.polygons, front, back);
  }

  if (front.length > 0) {
    if (!a.front) a.front = buildBSP([]);
    mergeBSP(a.front, front);
  }
  if (back.length > 0) {
    if (!a.back) a.back = buildBSP([]);
    mergeBSP(a.back, back);
  }
}

// Convert mesh to polygons
function meshToPolygons(mesh: EditableMesh): Polygon[] {
  const { geometry, transform } = mesh;
  const polygons: Polygon[] = [];

  // Apply transform
  const applyTransform = (v: Vec3): Vec3 => {
    // Scale
    let x = v.x * transform.scale.x;
    let y = v.y * transform.scale.y;
    let z = v.z * transform.scale.z;

    // Rotate (simplified - assumes Euler angles)
    const { rotation } = transform;
    const cosX = Math.cos(rotation.x), sinX = Math.sin(rotation.x);
    const cosY = Math.cos(rotation.y), sinY = Math.sin(rotation.y);
    const cosZ = Math.cos(rotation.z), sinZ = Math.sin(rotation.z);

    // Rotation around X
    let y1 = y * cosX - z * sinX;
    let z1 = y * sinX + z * cosX;

    // Rotation around Y
    let x1 = x * cosY + z1 * sinY;
    z = -x * sinY + z1 * cosY;
    x = x1;
    y = y1;

    // Rotation around Z
    x1 = x * cosZ - y * sinZ;
    y1 = x * sinZ + y * cosZ;

    // Translate
    return {
      x: x1 + transform.position.x,
      y: y1 + transform.position.y,
      z: z + transform.position.z,
    };
  };

  for (let i = 0; i < geometry.indices.length; i += 3) {
    const i0 = geometry.indices[i];
    const i1 = geometry.indices[i + 1];
    const i2 = geometry.indices[i + 2];

    const v0 = applyTransform({
      x: geometry.vertices[i0 * 3],
      y: geometry.vertices[i0 * 3 + 1],
      z: geometry.vertices[i0 * 3 + 2],
    });
    const v1 = applyTransform({
      x: geometry.vertices[i1 * 3],
      y: geometry.vertices[i1 * 3 + 1],
      z: geometry.vertices[i1 * 3 + 2],
    });
    const v2 = applyTransform({
      x: geometry.vertices[i2 * 3],
      y: geometry.vertices[i2 * 3 + 1],
      z: geometry.vertices[i2 * 3 + 2],
    });

    const plane = planeFromPoints(v0, v1, v2);
    polygons.push({ vertices: [v0, v1, v2], plane });
  }

  return polygons;
}

// Convert polygons back to mesh geometry
function polygonsToGeometry(polygons: Polygon[]): EditableGeometry {
  const vertices: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  let vertexIndex = 0;

  for (const p of polygons) {
    const { normal } = p.plane;

    // Triangulate polygon (fan triangulation)
    for (let i = 1; i < p.vertices.length - 1; i++) {
      const verts = [p.vertices[0], p.vertices[i], p.vertices[i + 1]];

      for (const v of verts) {
        vertices.push(v.x, v.y, v.z);
        normals.push(normal.x, normal.y, normal.z);
        uvs.push(0, 0); // UVs lost in boolean ops
        indices.push(vertexIndex++);
      }
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

  return {
    id: `geo-${Date.now().toString(36)}`,
    vertices: new Float32Array(vertices),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices),
    vertexCount: vertices.length / 3,
    edges,
    faces,
  };
}

/**
 * Apply boolean modifier to mesh.
 */
export function boolean(
  mesh: EditableMesh,
  options: BooleanOptions
): EditableMesh {
  const { operation, target } = options;

  // Convert meshes to polygons
  const aPolygons = meshToPolygons(mesh);
  const bPolygons = meshToPolygons(target);

  // Build BSP trees
  const a = buildBSP(aPolygons);
  const b = buildBSP(bPolygons);

  let resultPolygons: Polygon[];

  switch (operation) {
    case 'union': {
      clipTo(a, b);
      clipTo(b, a);
      invertBSP(b);
      clipTo(b, a);
      invertBSP(b);
      mergeBSP(a, allPolygons(b));
      resultPolygons = allPolygons(a);
      break;
    }

    case 'difference': {
      invertBSP(a);
      clipTo(a, b);
      clipTo(b, a);
      invertBSP(b);
      clipTo(b, a);
      invertBSP(b);
      mergeBSP(a, allPolygons(b));
      invertBSP(a);
      resultPolygons = allPolygons(a);
      break;
    }

    case 'intersect': {
      invertBSP(a);
      clipTo(b, a);
      invertBSP(b);
      clipTo(a, b);
      clipTo(b, a);
      mergeBSP(a, allPolygons(b));
      invertBSP(a);
      resultPolygons = allPolygons(a);
      break;
    }

    default:
      resultPolygons = aPolygons;
  }

  const newGeometry = polygonsToGeometry(resultPolygons);

  return {
    ...mesh,
    geometry: newGeometry,
    // Reset transform since it was baked in
    transform: {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    },
  };
}
