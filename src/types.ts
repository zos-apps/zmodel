/**
 * zModel Types - Core type definitions for the 3D modeling application
 */

import type { Vec3, Color, Transform3D, Geometry, Material, Mesh3D, Scene3D, Camera3D, Light3D } from '@z-os/core';

// ============================================================================
// Edit Mode Types
// ============================================================================

export type EditMode = 'object' | 'edit';
export type SelectionMode = 'vertex' | 'edge' | 'face';
export type TransformTool = 'select' | 'move' | 'rotate' | 'scale';
export type ViewMode = 'perspective' | 'top' | 'front' | 'right';
export type ShadingMode = 'solid' | 'wireframe' | 'material';

// ============================================================================
// Selection Types
// ============================================================================

export interface SelectionState {
  selectedObjects: string[];
  selectedVertices: number[];
  selectedEdges: [number, number][];
  selectedFaces: number[];
  activeObject: string | null;
}

// ============================================================================
// Extended Mesh Types
// ============================================================================

export interface EditableMesh {
  id: string;
  name: string;
  geometry: EditableGeometry;
  material: Material;
  transform: Transform3D;
  visible: boolean;
  locked: boolean;
  parentId: string | null;
}

export interface EditableGeometry {
  id: string;
  vertices: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint16Array;
  vertexCount: number;
  // Edit mode data
  edges: Edge[];
  faces: Face[];
}

export interface Edge {
  a: number;
  b: number;
}

export interface Face {
  vertices: number[]; // Indices into vertex array (3 or 4 vertices)
  normal: Vec3;
}

// ============================================================================
// Scene Types
// ============================================================================

export interface ModelScene {
  id: string;
  name: string;
  objects: EditableMesh[];
  lights: Light3D[];
  camera: Camera3D;
  background: Color;
  gridVisible: boolean;
  axesVisible: boolean;
}

// ============================================================================
// App State
// ============================================================================

export interface ZModelState {
  // Scene
  scene: ModelScene;

  // Mode
  editMode: EditMode;
  selectionMode: SelectionMode;
  transformTool: TransformTool;
  viewMode: ViewMode;
  shadingMode: ShadingMode;

  // Selection
  selection: SelectionState;

  // History
  historyIndex: number;
  history: HistoryEntry[];

  // UI State
  showOutliner: boolean;
  showProperties: boolean;
  snapToGrid: boolean;
  gridSize: number;
}

export interface HistoryEntry {
  type: string;
  description: string;
  state: Partial<ZModelState>;
  timestamp: number;
}

// ============================================================================
// Primitive Options
// ============================================================================

export interface CubeOptions {
  width?: number;
  height?: number;
  depth?: number;
}

export interface SphereOptions {
  radius?: number;
  segments?: number;
  rings?: number;
}

export interface CylinderOptions {
  radiusTop?: number;
  radiusBottom?: number;
  height?: number;
  segments?: number;
}

export interface PlaneOptions {
  width?: number;
  height?: number;
  widthSegments?: number;
  heightSegments?: number;
}

export interface TorusOptions {
  radius?: number;
  tube?: number;
  radialSegments?: number;
  tubularSegments?: number;
}

export type PrimitiveType = 'cube' | 'sphere' | 'cylinder' | 'plane' | 'torus' | 'cone' | 'icosphere';

// ============================================================================
// Gizmo Types
// ============================================================================

export interface GizmoState {
  visible: boolean;
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
  activeAxis: 'x' | 'y' | 'z' | 'xy' | 'xz' | 'yz' | null;
  dragging: boolean;
}

// ============================================================================
// Command Types (for undo/redo)
// ============================================================================

export interface ModelCommand {
  type: string;
  execute: () => void;
  undo: () => void;
  description: string;
}

// ============================================================================
// View State
// ============================================================================

export interface ViewState {
  mode: ViewMode;
  camera: {
    distance: number;
    theta: number;
    phi: number;
    target: Vec3;
  };
}

// ============================================================================
// Material Preset
// ============================================================================

export interface MaterialPreset {
  id: string;
  name: string;
  color: Color;
  metallic: number;
  roughness: number;
  ambient: number;
  diffuse: number;
  specular: number;
  shininess: number;
}

// Re-export core types
export type { Vec3, Color, Transform3D, Geometry, Material, Mesh3D, Scene3D, Camera3D, Light3D };
