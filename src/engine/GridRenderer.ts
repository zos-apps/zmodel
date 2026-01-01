/**
 * Grid Renderer
 *
 * Renders floor grid and axes for scene orientation.
 */

export interface GridData {
  vertices: Float32Array;
  colors: Float32Array;
}

export class GridRenderer {
  private gridSize: number;
  private gridDivisions: number;

  constructor(size: number = 10, divisions: number = 10) {
    this.gridSize = size;
    this.gridDivisions = divisions;
  }

  /**
   * Generate grid line data
   */
  generateGrid(): GridData {
    const vertices: number[] = [];
    const colors: number[] = [];

    const step = this.gridSize / this.gridDivisions;
    const half = this.gridSize / 2;

    // Grid lines
    for (let i = 0; i <= this.gridDivisions; i++) {
      const pos = -half + i * step;
      const isCenter = Math.abs(pos) < 0.001;

      // X-parallel lines (along Z)
      vertices.push(-half, 0, pos);
      vertices.push(half, 0, pos);

      if (isCenter) {
        // Center line (blue for Z axis direction)
        colors.push(0.2, 0.2, 0.6, 0.2, 0.2, 0.6);
      } else {
        colors.push(0.3, 0.3, 0.3, 0.3, 0.3, 0.3);
      }

      // Z-parallel lines (along X)
      vertices.push(pos, 0, -half);
      vertices.push(pos, 0, half);

      if (isCenter) {
        // Center line (red for X axis direction)
        colors.push(0.6, 0.2, 0.2, 0.6, 0.2, 0.2);
      } else {
        colors.push(0.3, 0.3, 0.3, 0.3, 0.3, 0.3);
      }
    }

    return {
      vertices: new Float32Array(vertices),
      colors: new Float32Array(colors),
    };
  }

  /**
   * Generate axes indicator data
   */
  generateAxes(size: number = 1): GridData {
    const vertices: number[] = [];
    const colors: number[] = [];

    // X axis (red)
    vertices.push(0, 0, 0);
    vertices.push(size, 0, 0);
    colors.push(1, 0.2, 0.2, 1, 0.2, 0.2);

    // Y axis (green)
    vertices.push(0, 0, 0);
    vertices.push(0, size, 0);
    colors.push(0.2, 1, 0.2, 0.2, 1, 0.2);

    // Z axis (blue)
    vertices.push(0, 0, 0);
    vertices.push(0, 0, size);
    colors.push(0.2, 0.4, 1, 0.2, 0.4, 1);

    return {
      vertices: new Float32Array(vertices),
      colors: new Float32Array(colors),
    };
  }

  /**
   * Generate corner axes gizmo (for viewport corner)
   */
  generateCornerAxes(size: number = 0.5): {
    lines: { vertices: number[]; colors: number[] };
    labels: { x: string; y: string; z: string };
  } {
    const vertices: number[] = [];
    const colors: number[] = [];

    // X axis
    vertices.push(0, 0, 0, size, 0, 0);
    colors.push(1, 0.3, 0.3, 1, 0.3, 0.3);

    // Y axis
    vertices.push(0, 0, 0, 0, size, 0);
    colors.push(0.3, 1, 0.3, 0.3, 1, 0.3);

    // Z axis
    vertices.push(0, 0, 0, 0, 0, size);
    colors.push(0.3, 0.5, 1, 0.3, 0.5, 1);

    return {
      lines: { vertices, colors },
      labels: { x: 'X', y: 'Y', z: 'Z' },
    };
  }

  setSize(size: number): void {
    this.gridSize = size;
  }

  setDivisions(divisions: number): void {
    this.gridDivisions = divisions;
  }
}
