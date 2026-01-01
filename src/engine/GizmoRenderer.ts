/**
 * Gizmo Renderer
 *
 * Renders transform gizmos (move, rotate, scale) for object manipulation.
 */

import type { Vec3, TransformTool, GizmoState } from '../types';

export interface GizmoGeometry {
  vertices: Float32Array;
  colors: Float32Array;
  indices: Uint16Array;
}

const AXIS_COLORS = {
  x: { r: 1, g: 0.2, b: 0.2 }, // Red
  y: { r: 0.2, g: 1, b: 0.2 }, // Green
  z: { r: 0.2, g: 0.4, b: 1 }, // Blue
  highlight: { r: 1, g: 1, b: 0.2 }, // Yellow
};

export class GizmoRenderer {
  private moveGizmo: GizmoGeometry | null = null;
  private rotateGizmo: GizmoGeometry | null = null;
  private scaleGizmo: GizmoGeometry | null = null;

  /**
   * Generate line data for the current gizmo
   */
  generateGizmoLines(
    tool: TransformTool,
    state: GizmoState,
    cameraDistance: number
  ): { vertices: number[]; colors: number[] } {
    if (!state.visible || tool === 'select') {
      return { vertices: [], colors: [] };
    }

    const size = Math.max(0.5, cameraDistance * 0.1);
    const { position, activeAxis } = state;
    const vertices: number[] = [];
    const colors: number[] = [];

    switch (tool) {
      case 'move':
        this.addMoveGizmo(position, size, activeAxis, vertices, colors);
        break;
      case 'rotate':
        this.addRotateGizmo(position, size, activeAxis, vertices, colors);
        break;
      case 'scale':
        this.addScaleGizmo(position, size, activeAxis, vertices, colors);
        break;
    }

    return { vertices, colors };
  }

  private addMoveGizmo(
    pos: Vec3,
    size: number,
    activeAxis: string | null,
    vertices: number[],
    colors: number[]
  ): void {
    const axes: Array<{ axis: 'x' | 'y' | 'z'; dir: Vec3 }> = [
      { axis: 'x', dir: { x: 1, y: 0, z: 0 } },
      { axis: 'y', dir: { x: 0, y: 1, z: 0 } },
      { axis: 'z', dir: { x: 0, y: 0, z: 1 } },
    ];

    for (const { axis, dir } of axes) {
      const color = activeAxis === axis ? AXIS_COLORS.highlight : AXIS_COLORS[axis];

      // Main axis line
      vertices.push(pos.x, pos.y, pos.z);
      vertices.push(pos.x + dir.x * size, pos.y + dir.y * size, pos.z + dir.z * size);
      colors.push(color.r, color.g, color.b, color.r, color.g, color.b);

      // Arrow head
      const tip = { x: pos.x + dir.x * size, y: pos.y + dir.y * size, z: pos.z + dir.z * size };
      const arrowSize = size * 0.15;

      // Create perpendicular vectors for arrow
      const perp1 = axis === 'y' ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
      const perp2 = axis === 'z' ? { x: 1, y: 0, z: 0 } : { x: 0, y: 0, z: 1 };

      // Arrow lines
      vertices.push(tip.x, tip.y, tip.z);
      vertices.push(
        tip.x - dir.x * arrowSize + perp1.x * arrowSize * 0.3,
        tip.y - dir.y * arrowSize + perp1.y * arrowSize * 0.3,
        tip.z - dir.z * arrowSize + perp1.z * arrowSize * 0.3
      );
      colors.push(color.r, color.g, color.b, color.r, color.g, color.b);

      vertices.push(tip.x, tip.y, tip.z);
      vertices.push(
        tip.x - dir.x * arrowSize - perp1.x * arrowSize * 0.3,
        tip.y - dir.y * arrowSize - perp1.y * arrowSize * 0.3,
        tip.z - dir.z * arrowSize - perp1.z * arrowSize * 0.3
      );
      colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
    }

    // Plane handles (XY, XZ, YZ)
    const planeSize = size * 0.3;
    const planeOffset = size * 0.2;

    // XY plane
    const xyColor = activeAxis === 'xy' ? AXIS_COLORS.highlight : { r: 0.8, g: 0.8, b: 0.2 };
    vertices.push(pos.x + planeOffset, pos.y + planeOffset, pos.z);
    vertices.push(pos.x + planeOffset + planeSize, pos.y + planeOffset, pos.z);
    colors.push(xyColor.r, xyColor.g, xyColor.b, xyColor.r, xyColor.g, xyColor.b);
    vertices.push(pos.x + planeOffset + planeSize, pos.y + planeOffset, pos.z);
    vertices.push(pos.x + planeOffset + planeSize, pos.y + planeOffset + planeSize, pos.z);
    colors.push(xyColor.r, xyColor.g, xyColor.b, xyColor.r, xyColor.g, xyColor.b);
    vertices.push(pos.x + planeOffset + planeSize, pos.y + planeOffset + planeSize, pos.z);
    vertices.push(pos.x + planeOffset, pos.y + planeOffset + planeSize, pos.z);
    colors.push(xyColor.r, xyColor.g, xyColor.b, xyColor.r, xyColor.g, xyColor.b);
    vertices.push(pos.x + planeOffset, pos.y + planeOffset + planeSize, pos.z);
    vertices.push(pos.x + planeOffset, pos.y + planeOffset, pos.z);
    colors.push(xyColor.r, xyColor.g, xyColor.b, xyColor.r, xyColor.g, xyColor.b);

    // XZ plane
    const xzColor = activeAxis === 'xz' ? AXIS_COLORS.highlight : { r: 0.8, g: 0.2, b: 0.8 };
    vertices.push(pos.x + planeOffset, pos.y, pos.z + planeOffset);
    vertices.push(pos.x + planeOffset + planeSize, pos.y, pos.z + planeOffset);
    colors.push(xzColor.r, xzColor.g, xzColor.b, xzColor.r, xzColor.g, xzColor.b);
    vertices.push(pos.x + planeOffset + planeSize, pos.y, pos.z + planeOffset);
    vertices.push(pos.x + planeOffset + planeSize, pos.y, pos.z + planeOffset + planeSize);
    colors.push(xzColor.r, xzColor.g, xzColor.b, xzColor.r, xzColor.g, xzColor.b);
    vertices.push(pos.x + planeOffset + planeSize, pos.y, pos.z + planeOffset + planeSize);
    vertices.push(pos.x + planeOffset, pos.y, pos.z + planeOffset + planeSize);
    colors.push(xzColor.r, xzColor.g, xzColor.b, xzColor.r, xzColor.g, xzColor.b);
    vertices.push(pos.x + planeOffset, pos.y, pos.z + planeOffset + planeSize);
    vertices.push(pos.x + planeOffset, pos.y, pos.z + planeOffset);
    colors.push(xzColor.r, xzColor.g, xzColor.b, xzColor.r, xzColor.g, xzColor.b);

    // YZ plane
    const yzColor = activeAxis === 'yz' ? AXIS_COLORS.highlight : { r: 0.2, g: 0.8, b: 0.8 };
    vertices.push(pos.x, pos.y + planeOffset, pos.z + planeOffset);
    vertices.push(pos.x, pos.y + planeOffset + planeSize, pos.z + planeOffset);
    colors.push(yzColor.r, yzColor.g, yzColor.b, yzColor.r, yzColor.g, yzColor.b);
    vertices.push(pos.x, pos.y + planeOffset + planeSize, pos.z + planeOffset);
    vertices.push(pos.x, pos.y + planeOffset + planeSize, pos.z + planeOffset + planeSize);
    colors.push(yzColor.r, yzColor.g, yzColor.b, yzColor.r, yzColor.g, yzColor.b);
    vertices.push(pos.x, pos.y + planeOffset + planeSize, pos.z + planeOffset + planeSize);
    vertices.push(pos.x, pos.y + planeOffset, pos.z + planeOffset + planeSize);
    colors.push(yzColor.r, yzColor.g, yzColor.b, yzColor.r, yzColor.g, yzColor.b);
    vertices.push(pos.x, pos.y + planeOffset, pos.z + planeOffset + planeSize);
    vertices.push(pos.x, pos.y + planeOffset, pos.z + planeOffset);
    colors.push(yzColor.r, yzColor.g, yzColor.b, yzColor.r, yzColor.g, yzColor.b);
  }

  private addRotateGizmo(
    pos: Vec3,
    size: number,
    activeAxis: string | null,
    vertices: number[],
    colors: number[]
  ): void {
    const segments = 32;

    // X rotation (around X axis) - YZ plane circle
    const xColor = activeAxis === 'x' ? AXIS_COLORS.highlight : AXIS_COLORS.x;
    for (let i = 0; i < segments; i++) {
      const a1 = (i / segments) * Math.PI * 2;
      const a2 = ((i + 1) / segments) * Math.PI * 2;
      vertices.push(pos.x, pos.y + Math.cos(a1) * size, pos.z + Math.sin(a1) * size);
      vertices.push(pos.x, pos.y + Math.cos(a2) * size, pos.z + Math.sin(a2) * size);
      colors.push(xColor.r, xColor.g, xColor.b, xColor.r, xColor.g, xColor.b);
    }

    // Y rotation (around Y axis) - XZ plane circle
    const yColor = activeAxis === 'y' ? AXIS_COLORS.highlight : AXIS_COLORS.y;
    for (let i = 0; i < segments; i++) {
      const a1 = (i / segments) * Math.PI * 2;
      const a2 = ((i + 1) / segments) * Math.PI * 2;
      vertices.push(pos.x + Math.cos(a1) * size, pos.y, pos.z + Math.sin(a1) * size);
      vertices.push(pos.x + Math.cos(a2) * size, pos.y, pos.z + Math.sin(a2) * size);
      colors.push(yColor.r, yColor.g, yColor.b, yColor.r, yColor.g, yColor.b);
    }

    // Z rotation (around Z axis) - XY plane circle
    const zColor = activeAxis === 'z' ? AXIS_COLORS.highlight : AXIS_COLORS.z;
    for (let i = 0; i < segments; i++) {
      const a1 = (i / segments) * Math.PI * 2;
      const a2 = ((i + 1) / segments) * Math.PI * 2;
      vertices.push(pos.x + Math.cos(a1) * size, pos.y + Math.sin(a1) * size, pos.z);
      vertices.push(pos.x + Math.cos(a2) * size, pos.y + Math.sin(a2) * size, pos.z);
      colors.push(zColor.r, zColor.g, zColor.b, zColor.r, zColor.g, zColor.b);
    }
  }

  private addScaleGizmo(
    pos: Vec3,
    size: number,
    activeAxis: string | null,
    vertices: number[],
    colors: number[]
  ): void {
    const axes: Array<{ axis: 'x' | 'y' | 'z'; dir: Vec3 }> = [
      { axis: 'x', dir: { x: 1, y: 0, z: 0 } },
      { axis: 'y', dir: { x: 0, y: 1, z: 0 } },
      { axis: 'z', dir: { x: 0, y: 0, z: 1 } },
    ];

    for (const { axis, dir } of axes) {
      const color = activeAxis === axis ? AXIS_COLORS.highlight : AXIS_COLORS[axis];

      // Main axis line
      vertices.push(pos.x, pos.y, pos.z);
      vertices.push(pos.x + dir.x * size, pos.y + dir.y * size, pos.z + dir.z * size);
      colors.push(color.r, color.g, color.b, color.r, color.g, color.b);

      // Box at end
      const boxSize = size * 0.1;
      const tip = { x: pos.x + dir.x * size, y: pos.y + dir.y * size, z: pos.z + dir.z * size };

      // Draw cube wireframe at tip
      const offsets = [
        [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
        [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1],
      ];

      const edges = [
        [0, 1], [1, 2], [2, 3], [3, 0],
        [4, 5], [5, 6], [6, 7], [7, 4],
        [0, 4], [1, 5], [2, 6], [3, 7],
      ];

      for (const [a, b] of edges) {
        const pa = offsets[a];
        const pb = offsets[b];
        vertices.push(
          tip.x + pa[0] * boxSize, tip.y + pa[1] * boxSize, tip.z + pa[2] * boxSize,
          tip.x + pb[0] * boxSize, tip.y + pb[1] * boxSize, tip.z + pb[2] * boxSize
        );
        colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
      }
    }

    // Center cube for uniform scale
    const uniformColor = activeAxis === null ? AXIS_COLORS.highlight : { r: 0.8, g: 0.8, b: 0.8 };
    const centerSize = size * 0.15;
    const centerEdges = [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7],
    ];
    const centerOffsets = [
      [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
      [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1],
    ];

    for (const [a, b] of centerEdges) {
      const pa = centerOffsets[a];
      const pb = centerOffsets[b];
      vertices.push(
        pos.x + pa[0] * centerSize, pos.y + pa[1] * centerSize, pos.z + pa[2] * centerSize,
        pos.x + pb[0] * centerSize, pos.y + pb[1] * centerSize, pos.z + pb[2] * centerSize
      );
      colors.push(uniformColor.r, uniformColor.g, uniformColor.b, uniformColor.r, uniformColor.g, uniformColor.b);
    }
  }

  /**
   * Hit test for gizmo interaction
   */
  hitTestGizmo(
    tool: TransformTool,
    position: Vec3,
    ray: { origin: Vec3; direction: Vec3 },
    cameraDistance: number
  ): 'x' | 'y' | 'z' | 'xy' | 'xz' | 'yz' | null {
    if (tool === 'select') return null;

    const size = Math.max(0.5, cameraDistance * 0.1);
    const threshold = size * 0.15;

    // Test axis proximity
    const axes: Array<{ axis: 'x' | 'y' | 'z'; dir: Vec3 }> = [
      { axis: 'x', dir: { x: 1, y: 0, z: 0 } },
      { axis: 'y', dir: { x: 0, y: 1, z: 0 } },
      { axis: 'z', dir: { x: 0, y: 0, z: 1 } },
    ];

    let closestAxis: 'x' | 'y' | 'z' | null = null;
    let closestDist = threshold;

    for (const { axis, dir } of axes) {
      const dist = this.distanceToLine(
        ray.origin,
        ray.direction,
        position,
        { x: position.x + dir.x * size, y: position.y + dir.y * size, z: position.z + dir.z * size }
      );

      if (dist < closestDist) {
        closestDist = dist;
        closestAxis = axis;
      }
    }

    return closestAxis;
  }

  private distanceToLine(
    rayOrigin: Vec3,
    rayDir: Vec3,
    lineStart: Vec3,
    lineEnd: Vec3
  ): number {
    // Simplified distance calculation
    const w0 = {
      x: rayOrigin.x - lineStart.x,
      y: rayOrigin.y - lineStart.y,
      z: rayOrigin.z - lineStart.z,
    };
    const u = {
      x: lineEnd.x - lineStart.x,
      y: lineEnd.y - lineStart.y,
      z: lineEnd.z - lineStart.z,
    };

    const a = rayDir.x * rayDir.x + rayDir.y * rayDir.y + rayDir.z * rayDir.z;
    const b = rayDir.x * u.x + rayDir.y * u.y + rayDir.z * u.z;
    const c = u.x * u.x + u.y * u.y + u.z * u.z;
    const d = rayDir.x * w0.x + rayDir.y * w0.y + rayDir.z * w0.z;
    const e = u.x * w0.x + u.y * w0.y + u.z * w0.z;

    const denom = a * c - b * b;
    if (Math.abs(denom) < 0.0001) return Infinity;

    const sc = (b * e - c * d) / denom;
    const tc = Math.max(0, Math.min(1, (a * e - b * d) / denom));

    const point1 = {
      x: rayOrigin.x + rayDir.x * sc,
      y: rayOrigin.y + rayDir.y * sc,
      z: rayOrigin.z + rayDir.z * sc,
    };
    const point2 = {
      x: lineStart.x + u.x * tc,
      y: lineStart.y + u.y * tc,
      z: lineStart.z + u.z * tc,
    };

    const dx = point1.x - point2.x;
    const dy = point1.y - point2.y;
    const dz = point1.z - point2.z;

    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
}
