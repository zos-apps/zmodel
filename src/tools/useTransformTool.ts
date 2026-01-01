/**
 * useTransformTool - React hook for transform tool interactions
 */

import { useCallback, useRef, useEffect } from 'react';
import type { Vec3, TransformTool, Camera3D } from '../types';
import { ModelEngine } from '../engine/ModelEngine';
import { TransformController } from './TransformController';
import { getRayFromMouse } from '../engine/raycast';

export interface UseTransformToolOptions {
  engine: ModelEngine | null;
  tool: TransformTool;
  snapToGrid: boolean;
  gridSize: number;
  onTransformStart?: () => void;
  onTransformEnd?: () => void;
}

export interface UseTransformToolReturn {
  handlePointerDown: (e: React.PointerEvent, canvas: HTMLCanvasElement) => void;
  handlePointerMove: (e: React.PointerEvent, canvas: HTMLCanvasElement) => void;
  handlePointerUp: (e: React.PointerEvent) => void;
  isTransforming: boolean;
}

export function useTransformTool(options: UseTransformToolOptions): UseTransformToolReturn {
  const { engine, tool, snapToGrid, gridSize, onTransformStart, onTransformEnd } = options;
  const controllerRef = useRef<TransformController | null>(null);
  const isTransformingRef = useRef(false);
  const lastMouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    if (engine) {
      controllerRef.current = new TransformController(engine);
    }
    return () => {
      controllerRef.current = null;
    };
  }, [engine]);

  useEffect(() => {
    controllerRef.current?.setSnapToGrid(snapToGrid, gridSize);
  }, [snapToGrid, gridSize]);

  const projectToPlane = useCallback(
    (mouseX: number, mouseY: number, canvas: HTMLCanvasElement): Vec3 | null => {
      if (!engine) return null;
      const camera = engine.getCamera();
      if (!camera) return null;

      const rect = canvas.getBoundingClientRect();
      const x = mouseX - rect.left;
      const y = mouseY - rect.top;

      const ray = getRayFromMouse(x, y, rect.width, rect.height, camera);

      // Project to XZ plane at gizmo height
      const gizmoState = engine.getGizmoState();
      const planeY = gizmoState.position.y;

      if (Math.abs(ray.direction.y) < 0.001) return null;

      const t = (planeY - ray.origin.y) / ray.direction.y;
      if (t < 0) return null;

      return {
        x: ray.origin.x + ray.direction.x * t,
        y: planeY,
        z: ray.origin.z + ray.direction.z * t,
      };
    },
    [engine]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, canvas: HTMLCanvasElement) => {
      if (!engine || !controllerRef.current) return;
      if (tool === 'select') return;

      const selection = engine.getSelection();
      if (selection.selectedObjects.length === 0) return;

      // Check if clicking on gizmo
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const camera = engine.getCamera();

      if (!camera) return;

      const ray = getRayFromMouse(x, y, rect.width, rect.height, camera);
      const gizmoState = engine.getGizmoState();

      // Simple gizmo hit detection
      const gizmoPos = gizmoState.position;
      const cameraDistance = Math.sqrt(
        Math.pow(camera.position.x - gizmoPos.x, 2) +
        Math.pow(camera.position.y - gizmoPos.y, 2) +
        Math.pow(camera.position.z - gizmoPos.z, 2)
      );
      const gizmoSize = cameraDistance * 0.1;

      // Detect which axis was clicked
      let hitAxis: 'x' | 'y' | 'z' | null = null;

      const testAxis = (axis: 'x' | 'y' | 'z', dir: Vec3) => {
        // Project ray to axis line and check distance
        const axisEnd = {
          x: gizmoPos.x + dir.x * gizmoSize,
          y: gizmoPos.y + dir.y * gizmoSize,
          z: gizmoPos.z + dir.z * gizmoSize,
        };

        // Simplified: check if mouse is near axis in screen space
        const threshold = gizmoSize * 0.2;
        const toAxis = {
          x: axisEnd.x - ray.origin.x,
          y: axisEnd.y - ray.origin.y,
          z: axisEnd.z - ray.origin.z,
        };
        const dist = Math.sqrt(toAxis.x * toAxis.x + toAxis.y * toAxis.y + toAxis.z * toAxis.z);

        if (dist < threshold * 3) {
          return true;
        }
        return false;
      };

      if (testAxis('x', { x: 1, y: 0, z: 0 })) hitAxis = 'x';
      else if (testAxis('y', { x: 0, y: 1, z: 0 })) hitAxis = 'y';
      else if (testAxis('z', { x: 0, y: 0, z: 1 })) hitAxis = 'z';

      const startPos = projectToPlane(e.clientX, e.clientY, canvas);
      if (!startPos) return;

      controllerRef.current.startTransform(tool, hitAxis, startPos);
      isTransformingRef.current = true;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };

      onTransformStart?.();
      canvas.setPointerCapture(e.pointerId);
    },
    [engine, tool, projectToPlane, onTransformStart]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent, canvas: HTMLCanvasElement) => {
      if (!isTransformingRef.current || !controllerRef.current) return;

      const currentPos = projectToPlane(e.clientX, e.clientY, canvas);
      if (!currentPos) return;

      controllerRef.current.updateTransform(currentPos);
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
    },
    [projectToPlane]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isTransformingRef.current || !controllerRef.current) return;

      controllerRef.current.endTransform();
      isTransformingRef.current = false;

      onTransformEnd?.();
    },
    [onTransformEnd]
  );

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    isTransforming: isTransformingRef.current,
  };
}
