/**
 * Primitive Geometry Factory
 *
 * Creates editable mesh primitives with proper topology for editing.
 */

import type { Vec3, EditableGeometry, EditableMesh, Edge, Face, Material, Color, CubeOptions, SphereOptions, CylinderOptions, PlaneOptions, TorusOptions, PrimitiveType } from '../types';

let idCounter = 0;
function generateId(): string {
  return `mesh-${Date.now().toString(36)}-${(++idCounter).toString(36)}`;
}

function generateGeoId(): string {
  return `geo-${Date.now().toString(36)}-${(++idCounter).toString(36)}`;
}

const DEFAULT_COLOR: Color = { r: 180, g: 180, b: 180, a: 1 };

function createDefaultMaterial(name: string = 'Material'): Material {
  return {
    id: generateId(),
    name,
    color: DEFAULT_COLOR,
    ambient: 0.3,
    diffuse: 0.7,
    specular: 0.5,
    shininess: 32,
    opacity: 1,
    wireframe: false,
    doubleSided: false,
  };
}

// ============================================================================
// Cube
// ============================================================================

export function createCube(options: CubeOptions = {}): EditableMesh {
  const { width = 1, height = 1, depth = 1 } = options;
  const hw = width / 2, hh = height / 2, hd = depth / 2;

  const vertices = new Float32Array([
    // Front face
    -hw, -hh,  hd,   hw, -hh,  hd,   hw,  hh,  hd,  -hw,  hh,  hd,
    // Back face
     hw, -hh, -hd,  -hw, -hh, -hd,  -hw,  hh, -hd,   hw,  hh, -hd,
    // Top face
    -hw,  hh,  hd,   hw,  hh,  hd,   hw,  hh, -hd,  -hw,  hh, -hd,
    // Bottom face
    -hw, -hh, -hd,   hw, -hh, -hd,   hw, -hh,  hd,  -hw, -hh,  hd,
    // Right face
     hw, -hh,  hd,   hw, -hh, -hd,   hw,  hh, -hd,   hw,  hh,  hd,
    // Left face
    -hw, -hh, -hd,  -hw, -hh,  hd,  -hw,  hh,  hd,  -hw,  hh, -hd,
  ]);

  const normals = new Float32Array([
    0, 0, 1,  0, 0, 1,  0, 0, 1,  0, 0, 1,
    0, 0,-1,  0, 0,-1,  0, 0,-1,  0, 0,-1,
    0, 1, 0,  0, 1, 0,  0, 1, 0,  0, 1, 0,
    0,-1, 0,  0,-1, 0,  0,-1, 0,  0,-1, 0,
    1, 0, 0,  1, 0, 0,  1, 0, 0,  1, 0, 0,
   -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
  ]);

  const uvs = new Float32Array([
    0, 0, 1, 0, 1, 1, 0, 1,
    0, 0, 1, 0, 1, 1, 0, 1,
    0, 0, 1, 0, 1, 1, 0, 1,
    0, 0, 1, 0, 1, 1, 0, 1,
    0, 0, 1, 0, 1, 1, 0, 1,
    0, 0, 1, 0, 1, 1, 0, 1,
  ]);

  const indices = new Uint16Array([
     0,  1,  2,  0,  2,  3,
     4,  5,  6,  4,  6,  7,
     8,  9, 10,  8, 10, 11,
    12, 13, 14, 12, 14, 15,
    16, 17, 18, 16, 18, 19,
    20, 21, 22, 20, 22, 23,
  ]);

  // Build edges and faces for edit mode
  const edges: Edge[] = [];
  const faces: Face[] = [];

  for (let i = 0; i < 6; i++) {
    const base = i * 4;
    // Quad edges
    edges.push({ a: base, b: base + 1 });
    edges.push({ a: base + 1, b: base + 2 });
    edges.push({ a: base + 2, b: base + 3 });
    edges.push({ a: base + 3, b: base });

    // Face (as quad)
    const normal: Vec3 = {
      x: normals[base * 3],
      y: normals[base * 3 + 1],
      z: normals[base * 3 + 2],
    };
    faces.push({ vertices: [base, base + 1, base + 2, base + 3], normal });
  }

  const geometry: EditableGeometry = {
    id: generateGeoId(),
    vertices,
    normals,
    uvs,
    indices,
    vertexCount: 24,
    edges,
    faces,
  };

  return {
    id: generateId(),
    name: 'Cube',
    geometry,
    material: createDefaultMaterial(),
    transform: {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    },
    visible: true,
    locked: false,
    parentId: null,
  };
}

// ============================================================================
// Sphere
// ============================================================================

export function createSphere(options: SphereOptions = {}): EditableMesh {
  const { radius = 0.5, segments = 16, rings = 12 } = options;

  const vertices: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let iy = 0; iy <= rings; iy++) {
    const v = iy / rings;
    const phi = v * Math.PI;

    for (let ix = 0; ix <= segments; ix++) {
      const u = ix / segments;
      const theta = u * Math.PI * 2;

      const x = -radius * Math.cos(theta) * Math.sin(phi);
      const y = radius * Math.cos(phi);
      const z = radius * Math.sin(theta) * Math.sin(phi);

      vertices.push(x, y, z);
      normals.push(x / radius, y / radius, z / radius);
      uvs.push(u, 1 - v);
    }
  }

  for (let iy = 0; iy < rings; iy++) {
    for (let ix = 0; ix < segments; ix++) {
      const a = ix + (segments + 1) * iy;
      const b = ix + (segments + 1) * (iy + 1);
      const c = ix + 1 + (segments + 1) * (iy + 1);
      const d = ix + 1 + (segments + 1) * iy;

      if (iy !== 0) indices.push(a, b, d);
      if (iy !== rings - 1) indices.push(b, c, d);
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

  // Build faces (triangles)
  const faces: Face[] = [];
  for (let i = 0; i < indices.length; i += 3) {
    const verts = [indices[i], indices[i + 1], indices[i + 2]];
    const normal: Vec3 = {
      x: normals[indices[i] * 3],
      y: normals[indices[i] * 3 + 1],
      z: normals[indices[i] * 3 + 2],
    };
    faces.push({ vertices: verts, normal });
  }

  const geometry: EditableGeometry = {
    id: generateGeoId(),
    vertices: new Float32Array(vertices),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices),
    vertexCount: vertices.length / 3,
    edges,
    faces,
  };

  return {
    id: generateId(),
    name: 'Sphere',
    geometry,
    material: createDefaultMaterial(),
    transform: {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    },
    visible: true,
    locked: false,
    parentId: null,
  };
}

// ============================================================================
// Cylinder
// ============================================================================

export function createCylinder(options: CylinderOptions = {}): EditableMesh {
  const { radiusTop = 0.5, radiusBottom = 0.5, height = 1, segments = 32 } = options;

  const vertices: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const halfHeight = height / 2;

  // Side vertices
  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    const theta = u * Math.PI * 2;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);

    vertices.push(cos * radiusTop, halfHeight, sin * radiusTop);
    normals.push(cos, 0, sin);
    uvs.push(u, 0);

    vertices.push(cos * radiusBottom, -halfHeight, sin * radiusBottom);
    normals.push(cos, 0, sin);
    uvs.push(u, 1);
  }

  // Side indices
  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    const b = i * 2 + 1;
    const c = (i + 1) * 2 + 1;
    const d = (i + 1) * 2;
    indices.push(a, b, d, b, c, d);
  }

  // Top cap
  const topCenterIdx = vertices.length / 3;
  vertices.push(0, halfHeight, 0);
  normals.push(0, 1, 0);
  uvs.push(0.5, 0.5);

  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    vertices.push(Math.cos(theta) * radiusTop, halfHeight, Math.sin(theta) * radiusTop);
    normals.push(0, 1, 0);
    uvs.push(Math.cos(theta) * 0.5 + 0.5, Math.sin(theta) * 0.5 + 0.5);
  }

  for (let i = 0; i < segments; i++) {
    indices.push(topCenterIdx, topCenterIdx + i + 1, topCenterIdx + i + 2);
  }

  // Bottom cap
  const bottomCenterIdx = vertices.length / 3;
  vertices.push(0, -halfHeight, 0);
  normals.push(0, -1, 0);
  uvs.push(0.5, 0.5);

  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    vertices.push(Math.cos(theta) * radiusBottom, -halfHeight, Math.sin(theta) * radiusBottom);
    normals.push(0, -1, 0);
    uvs.push(Math.cos(theta) * 0.5 + 0.5, Math.sin(theta) * 0.5 + 0.5);
  }

  for (let i = 0; i < segments; i++) {
    indices.push(bottomCenterIdx, bottomCenterIdx + i + 2, bottomCenterIdx + i + 1);
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
      x: normals[indices[i] * 3],
      y: normals[indices[i] * 3 + 1],
      z: normals[indices[i] * 3 + 2],
    };
    faces.push({ vertices: verts, normal });
  }

  const geometry: EditableGeometry = {
    id: generateGeoId(),
    vertices: new Float32Array(vertices),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices),
    vertexCount: vertices.length / 3,
    edges,
    faces,
  };

  return {
    id: generateId(),
    name: 'Cylinder',
    geometry,
    material: createDefaultMaterial(),
    transform: {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    },
    visible: true,
    locked: false,
    parentId: null,
  };
}

// ============================================================================
// Plane
// ============================================================================

export function createPlane(options: PlaneOptions = {}): EditableMesh {
  const { width = 2, height = 2, widthSegments = 1, heightSegments = 1 } = options;
  const hw = width / 2;
  const hh = height / 2;
  const gridX = widthSegments;
  const gridY = heightSegments;

  const vertices: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let iy = 0; iy <= gridY; iy++) {
    const y = iy / gridY;
    for (let ix = 0; ix <= gridX; ix++) {
      const x = ix / gridX;
      vertices.push(x * width - hw, 0, y * height - hh);
      normals.push(0, 1, 0);
      uvs.push(x, 1 - y);
    }
  }

  for (let iy = 0; iy < gridY; iy++) {
    for (let ix = 0; ix < gridX; ix++) {
      const a = ix + (gridX + 1) * iy;
      const b = ix + (gridX + 1) * (iy + 1);
      const c = ix + 1 + (gridX + 1) * (iy + 1);
      const d = ix + 1 + (gridX + 1) * iy;
      indices.push(a, b, d, b, c, d);
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
    faces.push({ vertices: verts, normal: { x: 0, y: 1, z: 0 } });
  }

  const geometry: EditableGeometry = {
    id: generateGeoId(),
    vertices: new Float32Array(vertices),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices),
    vertexCount: vertices.length / 3,
    edges,
    faces,
  };

  return {
    id: generateId(),
    name: 'Plane',
    geometry,
    material: createDefaultMaterial(),
    transform: {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    },
    visible: true,
    locked: false,
    parentId: null,
  };
}

// ============================================================================
// Torus
// ============================================================================

export function createTorus(options: TorusOptions = {}): EditableMesh {
  const { radius = 0.5, tube = 0.2, radialSegments = 16, tubularSegments = 32 } = options;

  const vertices: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let j = 0; j <= radialSegments; j++) {
    for (let i = 0; i <= tubularSegments; i++) {
      const u = (i / tubularSegments) * Math.PI * 2;
      const v = (j / radialSegments) * Math.PI * 2;

      const x = (radius + tube * Math.cos(v)) * Math.cos(u);
      const y = tube * Math.sin(v);
      const z = (radius + tube * Math.cos(v)) * Math.sin(u);

      vertices.push(x, y, z);

      const cx = radius * Math.cos(u);
      const cz = radius * Math.sin(u);
      const nx = x - cx;
      const ny = y;
      const nz = z - cz;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      normals.push(nx / len, ny / len, nz / len);

      uvs.push(i / tubularSegments, j / radialSegments);
    }
  }

  for (let j = 0; j < radialSegments; j++) {
    for (let i = 0; i < tubularSegments; i++) {
      const a = (tubularSegments + 1) * j + i;
      const b = (tubularSegments + 1) * (j + 1) + i;
      const c = (tubularSegments + 1) * (j + 1) + i + 1;
      const d = (tubularSegments + 1) * j + i + 1;
      indices.push(a, b, d, b, c, d);
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
      x: normals[indices[i] * 3],
      y: normals[indices[i] * 3 + 1],
      z: normals[indices[i] * 3 + 2],
    };
    faces.push({ vertices: verts, normal });
  }

  const geometry: EditableGeometry = {
    id: generateGeoId(),
    vertices: new Float32Array(vertices),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices),
    vertexCount: vertices.length / 3,
    edges,
    faces,
  };

  return {
    id: generateId(),
    name: 'Torus',
    geometry,
    material: createDefaultMaterial(),
    transform: {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    },
    visible: true,
    locked: false,
    parentId: null,
  };
}

// ============================================================================
// Cone
// ============================================================================

export function createCone(options: CylinderOptions = {}): EditableMesh {
  const { radiusBottom = 0.5, height = 1, segments = 32 } = options;
  return createCylinder({ radiusTop: 0, radiusBottom, height, segments });
}

// ============================================================================
// Factory
// ============================================================================

export interface PrimitiveFactory {
  cube: (options?: CubeOptions) => EditableMesh;
  sphere: (options?: SphereOptions) => EditableMesh;
  cylinder: (options?: CylinderOptions) => EditableMesh;
  plane: (options?: PlaneOptions) => EditableMesh;
  torus: (options?: TorusOptions) => EditableMesh;
  cone: (options?: CylinderOptions) => EditableMesh;
}

export function createPrimitive(type: PrimitiveType, options?: Record<string, unknown>): EditableMesh {
  switch (type) {
    case 'cube':
      return createCube(options as CubeOptions);
    case 'sphere':
      return createSphere(options as SphereOptions);
    case 'cylinder':
      return createCylinder(options as CylinderOptions);
    case 'plane':
      return createPlane(options as PlaneOptions);
    case 'torus':
      return createTorus(options as TorusOptions);
    case 'cone':
      return createCone(options as CylinderOptions);
    case 'icosphere':
      return createSphere({ ...(options as SphereOptions), segments: 8, rings: 4 });
    default:
      return createCube();
  }
}
