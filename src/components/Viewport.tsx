/**
 * Viewport Component
 *
 * Main 3D viewport with canvas and interaction handling.
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useOrbitControls } from '@z-os/sdk';
import type { TransformTool, EditMode, SelectionMode, ShadingMode, EditableMesh, Vec3 } from '../types';
import { ModelEngine } from '../engine/ModelEngine';
import { raycast, getRayFromMouse } from '../engine/raycast';

export interface ViewportProps {
  engine: ModelEngine | null;
  tool: TransformTool;
  editMode: EditMode;
  selectionMode: SelectionMode;
  shadingMode: ShadingMode;
  onEngineReady: (engine: ModelEngine) => void;
  onSelect: (meshId: string | null, addToSelection: boolean) => void;
}

export function Viewport({
  engine,
  tool,
  editMode,
  selectionMode,
  shadingMode,
  onEngineReady,
  onSelect,
}: ViewportProps): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<ModelEngine | null>(null);

  // Camera orbit state
  const [cameraState, setCameraState] = useState({
    distance: 8,
    theta: Math.PI / 4,
    phi: Math.PI / 3,
    target: { x: 0, y: 0, z: 0 } as Vec3,
  });
  const isDraggingRef = useRef(false);
  const isPanningRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });

  // Initialize engine
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const modelEngine = new ModelEngine(canvas, rect.width, rect.height);
    engineRef.current = modelEngine;

    modelEngine.start();
    onEngineReady(modelEngine);

    // Handle resize
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          modelEngine.resize(width, height);
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      modelEngine.destroy();
      engineRef.current = null;
    };
  }, [onEngineReady]);

  // Update camera from state
  useEffect(() => {
    if (!engineRef.current) return;

    const scene = engineRef.current.getScene();
    if (!scene) return;

    const { distance, theta, phi, target } = cameraState;
    const clampedPhi = Math.max(0.1, Math.min(Math.PI - 0.1, phi));

    scene.camera.position = {
      x: target.x + distance * Math.sin(clampedPhi) * Math.sin(theta),
      y: target.y + distance * Math.cos(clampedPhi),
      z: target.z + distance * Math.sin(clampedPhi) * Math.cos(theta),
    };
    scene.camera.target = target;
  }, [cameraState]);

  // Render loop
  useEffect(() => {
    if (!engineRef.current) return;

    const renderLoop = () => {
      if (engineRef.current) {
        engineRef.current.render(tool, selectionMode, editMode === 'edit');
      }
    };

    const intervalId = setInterval(renderLoop, 16); // ~60fps
    return () => clearInterval(intervalId);
  }, [tool, selectionMode, editMode]);

  // Mouse handlers
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const canvas = canvasRef.current;
      if (!canvas || !engineRef.current) return;

      canvas.setPointerCapture(e.pointerId);
      lastMouseRef.current = { x: e.clientX, y: e.clientY };

      // Middle mouse or shift+left for orbit/pan
      if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
        if (e.altKey) {
          isPanningRef.current = true;
        } else {
          isDraggingRef.current = true;
        }
        return;
      }

      // Left click for selection
      if (e.button === 0 && tool === 'select') {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const camera = engineRef.current.getCamera();
        if (!camera) return;

        const ray = getRayFromMouse(x, y, rect.width, rect.height, camera);
        const meshes = engineRef.current.getMeshes();
        const hit = raycast(ray, meshes);

        if (hit) {
          onSelect(hit.meshId, e.ctrlKey || e.metaKey);
        } else if (!e.ctrlKey && !e.metaKey) {
          onSelect(null, false);
        }
      }
    },
    [tool, onSelect]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDraggingRef.current && !isPanningRef.current) return;

      const dx = e.clientX - lastMouseRef.current.x;
      const dy = e.clientY - lastMouseRef.current.y;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };

      if (isDraggingRef.current) {
        // Orbit
        setCameraState((prev) => ({
          ...prev,
          theta: prev.theta - dx * 0.005,
          phi: Math.max(0.1, Math.min(Math.PI - 0.1, prev.phi + dy * 0.005)),
        }));
      } else if (isPanningRef.current) {
        // Pan
        const panSpeed = cameraState.distance * 0.001;
        setCameraState((prev) => ({
          ...prev,
          target: {
            x: prev.target.x - dx * panSpeed,
            y: prev.target.y + dy * panSpeed,
            z: prev.target.z,
          },
        }));
      }
    },
    [cameraState.distance]
  );

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.releasePointerCapture(e.pointerId);
    }
    isDraggingRef.current = false;
    isPanningRef.current = false;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY * 0.01;
    setCameraState((prev) => ({
      ...prev,
      distance: Math.max(1, Math.min(100, prev.distance + delta)),
    }));
  }, []);

  return (
    <div ref={containerRef} className="relative w-full h-full bg-gray-900">
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        className="w-full h-full cursor-crosshair"
        style={{ touchAction: 'none' }}
      />

      {/* View indicator */}
      <div className="absolute top-2 left-2 text-xs text-white/50">
        Perspective
      </div>

      {/* FPS counter */}
      <div className="absolute top-2 right-2 text-xs text-white/40 font-mono">
        {engine?.getState().fps ?? 0} FPS
      </div>
    </div>
  );
}
