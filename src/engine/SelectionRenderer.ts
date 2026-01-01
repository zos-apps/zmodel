/**
 * Selection Renderer
 *
 * Renders selection highlights for vertices, edges, faces, and objects.
 */

import type { Vec3, EditableMesh, SelectionState, SelectionMode, Transform3D } from '../types';

// Transform a point by a transform
function transformPoint(p: Vec3, t: Transform3D): Vec3 {
  let result = { x: p.x * t.scale.x, y: p.y * t.scale.y, z: p.z * t.scale.z };
  const { rotation } = t;
  const cosX = Math.cos(rotation.x), sinX = Math.sin(rotation.x);
  result = { x: result.x, y: result.y * cosX - result.z * sinX, z: result.y * sinX + result.z * cosX };
  const cosY = Math.cos(rotation.y), sinY = Math.sin(rotation.y);
  result = { x: result.x * cosY + result.z * sinY, y: result.y, z: -result.x * sinY + result.z * cosY };
  const cosZ = Math.cos(rotation.z), sinZ = Math.sin(rotation.z);
  result = { x: result.x * cosZ - result.y * sinZ, y: result.x * sinZ + result.y * cosZ, z: result.z };
  return { x: result.x + t.position.x, y: result.y + t.position.y, z: result.z + t.position.z };
}

export interface SelectionRenderData {
  vertices: Float32Array;
  edges: Float32Array;
  faceHighlights: Float32Array;
  outlineVertices: Float32Array;
}

export class SelectionRenderer {
  private meshes: Map<string, EditableMesh> = new Map();

  setMeshes(meshes: EditableMesh[]): void {
    this.meshes.clear();
    for (const mesh of meshes) {
      this.meshes.set(mesh.id, mesh);
    }
  }

  /**
   * Generate render data for selection visualization
   */
  generateRenderData(
    selection: SelectionState,
    mode: SelectionMode,
    isEditMode: boolean
  ): SelectionRenderData {
    const vertices: number[] = [];
    const edges: number[] = [];
    const faceHighlights: number[] = [];
    const outlineVertices: number[] = [];

    // Object selection outline
    for (const meshId of selection.selectedObjects) {
      const mesh = this.meshes.get(meshId);
      if (!mesh) continue;

      const bbox = this.getBoundingBox(mesh);
      this.addBoundingBoxLines(bbox, outlineVertices);
    }

    // Edit mode selections
    if (isEditMode && selection.activeObject) {
      const mesh = this.meshes.get(selection.activeObject);
      if (mesh) {
        // Vertex selection
        if (mode === 'vertex') {
          for (const idx of selection.selectedVertices) {
            const v: Vec3 = {
              x: mesh.geometry.vertices[idx * 3],
              y: mesh.geometry.vertices[idx * 3 + 1],
              z: mesh.geometry.vertices[idx * 3 + 2],
            };
            const tv = transformPoint(v, mesh.transform);
            vertices.push(tv.x, tv.y, tv.z);
          }
        }

        // Edge selection
        if (mode === 'edge') {
          for (const [a, b] of selection.selectedEdges) {
            const v0: Vec3 = {
              x: mesh.geometry.vertices[a * 3],
              y: mesh.geometry.vertices[a * 3 + 1],
              z: mesh.geometry.vertices[a * 3 + 2],
            };
            const v1: Vec3 = {
              x: mesh.geometry.vertices[b * 3],
              y: mesh.geometry.vertices[b * 3 + 1],
              z: mesh.geometry.vertices[b * 3 + 2],
            };
            const tv0 = transformPoint(v0, mesh.transform);
            const tv1 = transformPoint(v1, mesh.transform);
            edges.push(tv0.x, tv0.y, tv0.z, tv1.x, tv1.y, tv1.z);
          }
        }

        // Face selection
        if (mode === 'face') {
          for (const faceIdx of selection.selectedFaces) {
            const face = mesh.geometry.faces[faceIdx];
            if (!face) continue;

            for (const vertIdx of face.vertices) {
              const v: Vec3 = {
                x: mesh.geometry.vertices[vertIdx * 3],
                y: mesh.geometry.vertices[vertIdx * 3 + 1],
                z: mesh.geometry.vertices[vertIdx * 3 + 2],
              };
              const tv = transformPoint(v, mesh.transform);
              faceHighlights.push(tv.x, tv.y, tv.z);
            }
          }
        }
      }
    }

    return {
      vertices: new Float32Array(vertices),
      edges: new Float32Array(edges),
      faceHighlights: new Float32Array(faceHighlights),
      outlineVertices: new Float32Array(outlineVertices),
    };
  }

  private getBoundingBox(mesh: EditableMesh): { min: Vec3; max: Vec3 } {
    const { vertices } = mesh.geometry;
    const { transform } = mesh;

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (let i = 0; i < mesh.geometry.vertexCount; i++) {
      const v: Vec3 = { x: vertices[i * 3], y: vertices[i * 3 + 1], z: vertices[i * 3 + 2] };
      const tv = transformPoint(v, transform);

      minX = Math.min(minX, tv.x);
      minY = Math.min(minY, tv.y);
      minZ = Math.min(minZ, tv.z);
      maxX = Math.max(maxX, tv.x);
      maxY = Math.max(maxY, tv.y);
      maxZ = Math.max(maxZ, tv.z);
    }

    return {
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ },
    };
  }

  private addBoundingBoxLines(bbox: { min: Vec3; max: Vec3 }, out: number[]): void {
    const { min, max } = bbox;

    // Bottom face
    out.push(min.x, min.y, min.z, max.x, min.y, min.z);
    out.push(max.x, min.y, min.z, max.x, min.y, max.z);
    out.push(max.x, min.y, max.z, min.x, min.y, max.z);
    out.push(min.x, min.y, max.z, min.x, min.y, min.z);

    // Top face
    out.push(min.x, max.y, min.z, max.x, max.y, min.z);
    out.push(max.x, max.y, min.z, max.x, max.y, max.z);
    out.push(max.x, max.y, max.z, min.x, max.y, max.z);
    out.push(min.x, max.y, max.z, min.x, max.y, min.z);

    // Vertical edges
    out.push(min.x, min.y, min.z, min.x, max.y, min.z);
    out.push(max.x, min.y, min.z, max.x, max.y, min.z);
    out.push(max.x, min.y, max.z, max.x, max.y, max.z);
    out.push(min.x, min.y, max.z, min.x, max.y, max.z);
  }
}
