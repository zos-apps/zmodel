/**
 * Transform Controller
 *
 * Handles move, rotate, scale operations on objects.
 */

import type { Vec3, EditableMesh, TransformTool, GizmoState } from '../types';
import { ModelEngine } from '../engine/ModelEngine';

export interface TransformOperation {
  type: TransformTool;
  meshIds: string[];
  axis: 'x' | 'y' | 'z' | 'xy' | 'xz' | 'yz' | null;
  startPosition: Vec3;
  currentPosition: Vec3;
  initialTransforms: Map<string, { position: Vec3; rotation: Vec3; scale: Vec3 }>;
}

export class TransformController {
  private engine: ModelEngine;
  private currentOperation: TransformOperation | null = null;
  private snapToGrid = false;
  private gridSize = 0.25;

  constructor(engine: ModelEngine) {
    this.engine = engine;
  }

  setSnapToGrid(enabled: boolean, gridSize?: number): void {
    this.snapToGrid = enabled;
    if (gridSize !== undefined) this.gridSize = gridSize;
  }

  /**
   * Start a transform operation
   */
  startTransform(
    tool: TransformTool,
    axis: 'x' | 'y' | 'z' | 'xy' | 'xz' | 'yz' | null,
    startPos: Vec3
  ): void {
    const selection = this.engine.getSelection();
    if (selection.selectedObjects.length === 0) return;

    // Store initial transforms
    const initialTransforms = new Map<string, { position: Vec3; rotation: Vec3; scale: Vec3 }>();
    for (const id of selection.selectedObjects) {
      const mesh = this.engine.getMesh(id);
      if (mesh) {
        initialTransforms.set(id, {
          position: { ...mesh.transform.position },
          rotation: { ...mesh.transform.rotation },
          scale: { ...mesh.transform.scale },
        });
      }
    }

    this.currentOperation = {
      type: tool,
      meshIds: [...selection.selectedObjects],
      axis,
      startPosition: startPos,
      currentPosition: startPos,
      initialTransforms,
    };

    this.engine.setGizmoState({ dragging: true, activeAxis: axis });
  }

  /**
   * Update the transform during drag
   */
  updateTransform(currentPos: Vec3): void {
    if (!this.currentOperation) return;

    this.currentOperation.currentPosition = currentPos;

    const delta = {
      x: currentPos.x - this.currentOperation.startPosition.x,
      y: currentPos.y - this.currentOperation.startPosition.y,
      z: currentPos.z - this.currentOperation.startPosition.z,
    };

    // Apply axis constraint
    const constrainedDelta = this.constrainToAxis(delta, this.currentOperation.axis);

    // Snap if enabled
    if (this.snapToGrid) {
      constrainedDelta.x = Math.round(constrainedDelta.x / this.gridSize) * this.gridSize;
      constrainedDelta.y = Math.round(constrainedDelta.y / this.gridSize) * this.gridSize;
      constrainedDelta.z = Math.round(constrainedDelta.z / this.gridSize) * this.gridSize;
    }

    // Apply to meshes
    for (const id of this.currentOperation.meshIds) {
      const initial = this.currentOperation.initialTransforms.get(id);
      if (!initial) continue;

      switch (this.currentOperation.type) {
        case 'move':
          this.applyMove(id, initial.position, constrainedDelta);
          break;
        case 'rotate':
          this.applyRotate(id, initial.rotation, constrainedDelta);
          break;
        case 'scale':
          this.applyScale(id, initial.scale, constrainedDelta);
          break;
      }
    }
  }

  /**
   * End the transform operation
   */
  endTransform(): TransformOperation | null {
    if (!this.currentOperation) return null;

    const operation = this.currentOperation;
    this.currentOperation = null;
    this.engine.setGizmoState({ dragging: false, activeAxis: null });

    return operation;
  }

  /**
   * Cancel the current operation and restore initial state
   */
  cancelTransform(): void {
    if (!this.currentOperation) return;

    // Restore initial transforms
    for (const id of this.currentOperation.meshIds) {
      const initial = this.currentOperation.initialTransforms.get(id);
      if (!initial) continue;

      this.engine.updateMesh(id, {
        transform: {
          position: { ...initial.position },
          rotation: { ...initial.rotation },
          scale: { ...initial.scale },
        },
      });
    }

    this.currentOperation = null;
    this.engine.setGizmoState({ dragging: false, activeAxis: null });
  }

  private constrainToAxis(delta: Vec3, axis: string | null): Vec3 {
    switch (axis) {
      case 'x':
        return { x: delta.x, y: 0, z: 0 };
      case 'y':
        return { x: 0, y: delta.y, z: 0 };
      case 'z':
        return { x: 0, y: 0, z: delta.z };
      case 'xy':
        return { x: delta.x, y: delta.y, z: 0 };
      case 'xz':
        return { x: delta.x, y: 0, z: delta.z };
      case 'yz':
        return { x: 0, y: delta.y, z: delta.z };
      default:
        return delta;
    }
  }

  private applyMove(id: string, initialPos: Vec3, delta: Vec3): void {
    const mesh = this.engine.getMesh(id);
    if (!mesh) return;

    this.engine.updateMesh(id, {
      transform: {
        ...mesh.transform,
        position: {
          x: initialPos.x + delta.x,
          y: initialPos.y + delta.y,
          z: initialPos.z + delta.z,
        },
      },
    });
  }

  private applyRotate(id: string, initialRot: Vec3, delta: Vec3): void {
    const mesh = this.engine.getMesh(id);
    if (!mesh) return;

    // Convert delta to rotation (simplified - delta magnitude becomes rotation angle)
    const rotationScale = 0.01; // Sensitivity
    this.engine.updateMesh(id, {
      transform: {
        ...mesh.transform,
        rotation: {
          x: initialRot.x + delta.x * rotationScale,
          y: initialRot.y + delta.y * rotationScale,
          z: initialRot.z + delta.z * rotationScale,
        },
      },
    });
  }

  private applyScale(id: string, initialScale: Vec3, delta: Vec3): void {
    const mesh = this.engine.getMesh(id);
    if (!mesh) return;

    // Scale based on delta (1 unit = 0.5 scale change)
    const scaleRate = 0.5;
    this.engine.updateMesh(id, {
      transform: {
        ...mesh.transform,
        scale: {
          x: Math.max(0.01, initialScale.x + delta.x * scaleRate),
          y: Math.max(0.01, initialScale.y + delta.y * scaleRate),
          z: Math.max(0.01, initialScale.z + delta.z * scaleRate),
        },
      },
    });
  }

  /**
   * Quick move by fixed amount
   */
  moveBy(delta: Vec3): void {
    const selection = this.engine.getSelection();
    for (const id of selection.selectedObjects) {
      const mesh = this.engine.getMesh(id);
      if (!mesh) continue;

      this.engine.updateMesh(id, {
        transform: {
          ...mesh.transform,
          position: {
            x: mesh.transform.position.x + delta.x,
            y: mesh.transform.position.y + delta.y,
            z: mesh.transform.position.z + delta.z,
          },
        },
      });
    }
  }

  /**
   * Quick rotate by fixed amount
   */
  rotateBy(delta: Vec3): void {
    const selection = this.engine.getSelection();
    for (const id of selection.selectedObjects) {
      const mesh = this.engine.getMesh(id);
      if (!mesh) continue;

      this.engine.updateMesh(id, {
        transform: {
          ...mesh.transform,
          rotation: {
            x: mesh.transform.rotation.x + delta.x,
            y: mesh.transform.rotation.y + delta.y,
            z: mesh.transform.rotation.z + delta.z,
          },
        },
      });
    }
  }

  /**
   * Quick scale by factor
   */
  scaleBy(factor: Vec3): void {
    const selection = this.engine.getSelection();
    for (const id of selection.selectedObjects) {
      const mesh = this.engine.getMesh(id);
      if (!mesh) continue;

      this.engine.updateMesh(id, {
        transform: {
          ...mesh.transform,
          scale: {
            x: mesh.transform.scale.x * factor.x,
            y: mesh.transform.scale.y * factor.y,
            z: mesh.transform.scale.z * factor.z,
          },
        },
      });
    }
  }

  /**
   * Reset transform to default
   */
  resetTransform(type: 'position' | 'rotation' | 'scale' | 'all'): void {
    const selection = this.engine.getSelection();
    for (const id of selection.selectedObjects) {
      const mesh = this.engine.getMesh(id);
      if (!mesh) continue;

      const newTransform = { ...mesh.transform };

      if (type === 'position' || type === 'all') {
        newTransform.position = { x: 0, y: 0, z: 0 };
      }
      if (type === 'rotation' || type === 'all') {
        newTransform.rotation = { x: 0, y: 0, z: 0 };
      }
      if (type === 'scale' || type === 'all') {
        newTransform.scale = { x: 1, y: 1, z: 1 };
      }

      this.engine.updateMesh(id, { transform: newTransform });
    }
  }
}
