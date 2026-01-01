/**
 * Model Engine
 *
 * Extended 3D engine for zModel with selection, gizmos, grid rendering.
 */

import { WebGL3DEngine, type Scene3D, type WebGLState } from '@z-os/core';
import type { EditableMesh, SelectionState, TransformTool, GizmoState, SelectionMode, Vec3, Color, Camera3D, Light3D, ModelScene } from '../types';
import { SelectionRenderer, type SelectionRenderData } from './SelectionRenderer';
import { GizmoRenderer } from './GizmoRenderer';
import { GridRenderer } from './GridRenderer';

// Line shader for overlays
const LINE_VERTEX_SHADER = `
  attribute vec3 aPosition;
  attribute vec3 aColor;
  uniform mat4 uViewProjection;
  varying vec3 vColor;
  void main() {
    vColor = aColor;
    gl_Position = uViewProjection * vec4(aPosition, 1.0);
    gl_PointSize = 8.0;
  }
`;

const LINE_FRAGMENT_SHADER = `
  precision mediump float;
  varying vec3 vColor;
  void main() {
    gl_FragColor = vec4(vColor, 1.0);
  }
`;

export class ModelEngine {
  private engine: WebGL3DEngine;
  private gl: WebGLRenderingContext;
  private canvas: HTMLCanvasElement;

  private lineProgram: WebGLProgram | null = null;
  private lineUniforms: Record<string, WebGLUniformLocation | null> = {};
  private lineAttributes: Record<string, number> = {};
  private lineVBO: WebGLBuffer | null = null;
  private lineColorVBO: WebGLBuffer | null = null;

  private selectionRenderer: SelectionRenderer;
  private gizmoRenderer: GizmoRenderer;
  private gridRenderer: GridRenderer;

  private meshes: EditableMesh[] = [];
  private selection: SelectionState = {
    selectedObjects: [],
    selectedVertices: [],
    selectedEdges: [],
    selectedFaces: [],
    activeObject: null,
  };
  private gizmoState: GizmoState = {
    visible: false,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    activeAxis: null,
    dragging: false,
  };

  private showGrid = true;
  private showAxes = true;

  constructor(canvas: HTMLCanvasElement, width: number, height: number) {
    this.canvas = canvas;
    this.engine = new WebGL3DEngine(canvas, {
      width,
      height,
      antialias: true,
      alpha: false,
      depth: true,
    });

    const gl = canvas.getContext('webgl');
    if (!gl) throw new Error('WebGL not available');
    this.gl = gl;

    this.selectionRenderer = new SelectionRenderer();
    this.gizmoRenderer = new GizmoRenderer();
    this.gridRenderer = new GridRenderer(20, 20);

    this.initLineShaders();
    this.initDefaultScene();
  }

  private initLineShaders(): void {
    const { gl } = this;

    // Create shaders
    const vs = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vs, LINE_VERTEX_SHADER);
    gl.compileShader(vs);

    const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fs, LINE_FRAGMENT_SHADER);
    gl.compileShader(fs);

    this.lineProgram = gl.createProgram()!;
    gl.attachShader(this.lineProgram, vs);
    gl.attachShader(this.lineProgram, fs);
    gl.linkProgram(this.lineProgram);

    gl.deleteShader(vs);
    gl.deleteShader(fs);

    this.lineUniforms = {
      viewProjection: gl.getUniformLocation(this.lineProgram, 'uViewProjection'),
    };

    this.lineAttributes = {
      position: gl.getAttribLocation(this.lineProgram, 'aPosition'),
      color: gl.getAttribLocation(this.lineProgram, 'aColor'),
    };

    this.lineVBO = gl.createBuffer();
    this.lineColorVBO = gl.createBuffer();
  }

  private initDefaultScene(): void {
    const scene = this.engine.createScene('Main');

    // Add lights
    this.engine.addAmbientLight(scene, { r: 255, g: 255, b: 255, a: 1 }, 0.4);
    this.engine.addDirectionalLight(
      scene,
      { x: 1, y: -1, z: -0.5 },
      { r: 255, g: 255, b: 255, a: 1 },
      0.8
    );

    // Set background
    scene.background = { r: 45, g: 45, b: 50, a: 1 };

    // Set camera
    scene.camera.position = { x: 5, y: 4, z: 5 };
    scene.camera.target = { x: 0, y: 0, z: 0 };
  }

  // ============================================================================
  // Public API
  // ============================================================================

  getWebGLEngine(): WebGL3DEngine {
    return this.engine;
  }

  getScene(): Scene3D | undefined {
    return this.engine.getActiveScene();
  }

  getCamera(): Camera3D | undefined {
    return this.engine.getActiveScene()?.camera;
  }

  getMeshes(): EditableMesh[] {
    return this.meshes;
  }

  getMesh(id: string): EditableMesh | undefined {
    return this.meshes.find(m => m.id === id);
  }

  addMesh(mesh: EditableMesh): void {
    this.meshes.push(mesh);
    this.selectionRenderer.setMeshes(this.meshes);
    this.syncMeshesToEngine();
  }

  removeMesh(id: string): void {
    this.meshes = this.meshes.filter(m => m.id !== id);
    this.selection.selectedObjects = this.selection.selectedObjects.filter(s => s !== id);
    if (this.selection.activeObject === id) {
      this.selection.activeObject = null;
    }
    this.selectionRenderer.setMeshes(this.meshes);
    this.syncMeshesToEngine();
  }

  updateMesh(id: string, updates: Partial<EditableMesh>): void {
    const mesh = this.meshes.find(m => m.id === id);
    if (mesh) {
      Object.assign(mesh, updates);
      this.syncMeshesToEngine();
    }
  }

  duplicateMesh(id: string): EditableMesh | null {
    const source = this.meshes.find(m => m.id === id);
    if (!source) return null;

    const newMesh: EditableMesh = {
      ...source,
      id: `mesh-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`,
      name: `${source.name}.001`,
      geometry: { ...source.geometry, id: `geo-${Date.now().toString(36)}` },
      material: { ...source.material, id: `mat-${Date.now().toString(36)}` },
      transform: {
        position: { ...source.transform.position, x: source.transform.position.x + 1 },
        rotation: { ...source.transform.rotation },
        scale: { ...source.transform.scale },
      },
    };

    this.addMesh(newMesh);
    return newMesh;
  }

  // ============================================================================
  // Selection
  // ============================================================================

  getSelection(): SelectionState {
    return this.selection;
  }

  setSelection(selection: Partial<SelectionState>): void {
    Object.assign(this.selection, selection);
    this.updateGizmoPosition();
  }

  selectObject(id: string, addToSelection = false): void {
    if (addToSelection) {
      if (!this.selection.selectedObjects.includes(id)) {
        this.selection.selectedObjects.push(id);
      }
    } else {
      this.selection.selectedObjects = [id];
    }
    this.selection.activeObject = id;
    this.updateGizmoPosition();
  }

  deselectAll(): void {
    this.selection = {
      selectedObjects: [],
      selectedVertices: [],
      selectedEdges: [],
      selectedFaces: [],
      activeObject: null,
    };
    this.gizmoState.visible = false;
  }

  private updateGizmoPosition(): void {
    if (this.selection.selectedObjects.length === 0) {
      this.gizmoState.visible = false;
      return;
    }

    // Calculate center of selection
    let cx = 0, cy = 0, cz = 0;
    let count = 0;

    for (const id of this.selection.selectedObjects) {
      const mesh = this.meshes.find(m => m.id === id);
      if (mesh) {
        cx += mesh.transform.position.x;
        cy += mesh.transform.position.y;
        cz += mesh.transform.position.z;
        count++;
      }
    }

    if (count > 0) {
      this.gizmoState.position = { x: cx / count, y: cy / count, z: cz / count };
      this.gizmoState.visible = true;
    }
  }

  // ============================================================================
  // Gizmo
  // ============================================================================

  getGizmoState(): GizmoState {
    return this.gizmoState;
  }

  setGizmoState(state: Partial<GizmoState>): void {
    Object.assign(this.gizmoState, state);
  }

  // ============================================================================
  // Rendering
  // ============================================================================

  resize(width: number, height: number): void {
    this.engine.resize(width, height);
  }

  start(callback?: (dt: number) => void): void {
    this.engine.start((dt) => {
      callback?.(dt);
    });
  }

  stop(): void {
    this.engine.stop();
  }

  render(
    tool: TransformTool,
    selectionMode: SelectionMode,
    isEditMode: boolean
  ): void {
    const scene = this.engine.getActiveScene();
    if (!scene) return;

    const { gl } = this;

    // Render overlays after main scene
    this.renderOverlays(tool, selectionMode, isEditMode);
  }

  private renderOverlays(
    tool: TransformTool,
    selectionMode: SelectionMode,
    isEditMode: boolean
  ): void {
    const scene = this.engine.getActiveScene();
    if (!scene || !this.lineProgram) return;

    const { gl } = this;

    // Build view-projection matrix
    const camera = scene.camera;
    const viewProjection = this.buildViewProjectionMatrix(camera);

    gl.useProgram(this.lineProgram);
    gl.uniformMatrix4fv(this.lineUniforms.viewProjection, false, viewProjection);

    // Disable depth test for overlays
    gl.disable(gl.DEPTH_TEST);

    // Grid
    if (this.showGrid) {
      const gridData = this.gridRenderer.generateGrid();
      this.drawLines(gridData.vertices, gridData.colors);
    }

    // Axes
    if (this.showAxes) {
      gl.enable(gl.DEPTH_TEST);
      const axesData = this.gridRenderer.generateAxes(1);
      this.drawLines(axesData.vertices, axesData.colors);
      gl.disable(gl.DEPTH_TEST);
    }

    // Selection
    const selectionData = this.selectionRenderer.generateRenderData(
      this.selection,
      selectionMode,
      isEditMode
    );

    // Object outlines (orange)
    if (selectionData.outlineVertices.length > 0) {
      const outlineColors = new Float32Array(selectionData.outlineVertices.length);
      for (let i = 0; i < outlineColors.length; i += 3) {
        outlineColors[i] = 1;
        outlineColors[i + 1] = 0.6;
        outlineColors[i + 2] = 0.2;
      }
      this.drawLines(selectionData.outlineVertices, outlineColors);
    }

    // Selected vertices (yellow points)
    if (selectionData.vertices.length > 0) {
      const vertexColors = new Float32Array(selectionData.vertices.length);
      for (let i = 0; i < vertexColors.length; i += 3) {
        vertexColors[i] = 1;
        vertexColors[i + 1] = 1;
        vertexColors[i + 2] = 0.2;
      }
      this.drawPoints(selectionData.vertices, vertexColors);
    }

    // Selected edges (yellow lines)
    if (selectionData.edges.length > 0) {
      const edgeColors = new Float32Array(selectionData.edges.length);
      for (let i = 0; i < edgeColors.length; i += 3) {
        edgeColors[i] = 1;
        edgeColors[i + 1] = 1;
        edgeColors[i + 2] = 0.2;
      }
      this.drawLines(selectionData.edges, edgeColors);
    }

    // Gizmo
    if (this.gizmoState.visible) {
      const cameraDistance = Math.sqrt(
        Math.pow(camera.position.x - this.gizmoState.position.x, 2) +
        Math.pow(camera.position.y - this.gizmoState.position.y, 2) +
        Math.pow(camera.position.z - this.gizmoState.position.z, 2)
      );
      const gizmoData = this.gizmoRenderer.generateGizmoLines(tool, this.gizmoState, cameraDistance);
      if (gizmoData.vertices.length > 0) {
        this.drawLines(
          new Float32Array(gizmoData.vertices),
          new Float32Array(gizmoData.colors)
        );
      }
    }

    gl.enable(gl.DEPTH_TEST);
  }

  private drawLines(vertices: Float32Array, colors: Float32Array): void {
    const { gl } = this;
    if (vertices.length === 0) return;

    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineVBO);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.lineAttributes.position);
    gl.vertexAttribPointer(this.lineAttributes.position, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineColorVBO);
    gl.bufferData(gl.ARRAY_BUFFER, colors, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.lineAttributes.color);
    gl.vertexAttribPointer(this.lineAttributes.color, 3, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.LINES, 0, vertices.length / 3);
  }

  private drawPoints(vertices: Float32Array, colors: Float32Array): void {
    const { gl } = this;
    if (vertices.length === 0) return;

    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineVBO);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.lineAttributes.position);
    gl.vertexAttribPointer(this.lineAttributes.position, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineColorVBO);
    gl.bufferData(gl.ARRAY_BUFFER, colors, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.lineAttributes.color);
    gl.vertexAttribPointer(this.lineAttributes.color, 3, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.POINTS, 0, vertices.length / 3);
  }

  private buildViewProjectionMatrix(camera: Camera3D): Float32Array {
    // Build view matrix (lookAt)
    const zAxis = this.normalize({
      x: camera.position.x - camera.target.x,
      y: camera.position.y - camera.target.y,
      z: camera.position.z - camera.target.z,
    });
    const xAxis = this.normalize(this.cross(camera.up, zAxis));
    const yAxis = this.cross(zAxis, xAxis);

    const view = new Float32Array([
      xAxis.x, yAxis.x, zAxis.x, 0,
      xAxis.y, yAxis.y, zAxis.y, 0,
      xAxis.z, yAxis.z, zAxis.z, 0,
      -this.dot(xAxis, camera.position),
      -this.dot(yAxis, camera.position),
      -this.dot(zAxis, camera.position),
      1,
    ]);

    // Build projection matrix
    const state = this.engine.getState();
    const aspect = state.width / state.height;
    let proj: Float32Array;

    if (camera.type === 'perspective') {
      const f = 1 / Math.tan(camera.fov / 2);
      const rangeInv = 1 / (camera.near - camera.far);
      proj = new Float32Array([
        f / aspect, 0, 0, 0,
        0, f, 0, 0,
        0, 0, (camera.near + camera.far) * rangeInv, -1,
        0, 0, camera.near * camera.far * rangeInv * 2, 0,
      ]);
    } else {
      const hw = camera.zoom * aspect;
      const hh = camera.zoom;
      proj = new Float32Array([
        1 / hw, 0, 0, 0,
        0, 1 / hh, 0, 0,
        0, 0, -2 / (camera.far - camera.near), 0,
        0, 0, -(camera.far + camera.near) / (camera.far - camera.near), 1,
      ]);
    }

    // Multiply projection * view
    return this.multiplyMatrices(proj, view);
  }

  private normalize(v: Vec3): Vec3 {
    const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    return len > 0 ? { x: v.x / len, y: v.y / len, z: v.z / len } : { x: 0, y: 0, z: 0 };
  }

  private cross(a: Vec3, b: Vec3): Vec3 {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x,
    };
  }

  private dot(a: Vec3, b: Vec3): number {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  private multiplyMatrices(a: Float32Array, b: Float32Array): Float32Array {
    const out = new Float32Array(16);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        out[i * 4 + j] =
          a[i * 4 + 0] * b[0 * 4 + j] +
          a[i * 4 + 1] * b[1 * 4 + j] +
          a[i * 4 + 2] * b[2 * 4 + j] +
          a[i * 4 + 3] * b[3 * 4 + j];
      }
    }
    return out;
  }

  // ============================================================================
  // Sync meshes to base engine
  // ============================================================================

  private syncMeshesToEngine(): void {
    const scene = this.engine.getActiveScene();
    if (!scene) return;

    // Clear existing meshes
    scene.meshes = [];

    // Add editable meshes to scene
    for (const mesh of this.meshes) {
      if (!mesh.visible) continue;

      // Create geometry in engine
      const geometry = {
        id: mesh.geometry.id,
        vertices: mesh.geometry.vertices,
        normals: mesh.geometry.normals,
        uvs: mesh.geometry.uvs,
        indices: mesh.geometry.indices,
        vertexCount: mesh.geometry.vertexCount,
      };

      // Upload geometry if needed (simplified - in production would cache)
      const engineMesh = this.engine.createMesh(geometry, mesh.material, mesh.transform);
      engineMesh.id = mesh.id;
      engineMesh.name = mesh.name;
      engineMesh.visible = mesh.visible;

      scene.meshes.push(engineMesh);
    }
  }

  // ============================================================================
  // Utility
  // ============================================================================

  setGridVisible(visible: boolean): void {
    this.showGrid = visible;
  }

  setAxesVisible(visible: boolean): void {
    this.showAxes = visible;
  }

  getState(): WebGLState {
    return this.engine.getState();
  }

  subscribe(callback: (state: WebGLState) => void): () => void {
    return this.engine.subscribe(callback);
  }

  destroy(): void {
    const { gl } = this;
    if (this.lineProgram) gl.deleteProgram(this.lineProgram);
    if (this.lineVBO) gl.deleteBuffer(this.lineVBO);
    if (this.lineColorVBO) gl.deleteBuffer(this.lineColorVBO);
    this.engine.destroy();
  }
}
