/**
 * zModel - Professional 3D Modeling Application
 *
 * A Blender-inspired 3D modeling application built on the z-os4 graphics engine.
 *
 * Features:
 * - 3D viewport with orbit/pan/zoom navigation
 * - Primitive creation (cube, sphere, cylinder, plane, torus)
 * - Transform tools (move, rotate, scale)
 * - Edit mode (vertex, edge, face selection)
 * - Mesh modifiers (extrude, loop cut, subdivide)
 * - Material editor
 * - Scene outliner
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import type {
  TransformTool,
  EditMode,
  SelectionMode,
  ShadingMode,
  PrimitiveType,
  EditableMesh,
  SelectionState,
  Vec3,
  Color,
  ModelCommand,
} from './types';
import { ModelEngine } from './engine/ModelEngine';
import { createPrimitive } from './engine/primitives';
import { Toolbar } from './components/Toolbar';
import { Outliner } from './components/Outliner';
import { PropertiesPanel } from './components/PropertiesPanel';
import { Viewport } from './components/Viewport';
import { ViewportOverlay } from './components/ViewportOverlay';
import { StatusBar } from './components/StatusBar';

// ============================================================================
// Main App Component
// ============================================================================

export interface ZModelAppProps {
  className?: string;
}

export function ZModelApp({ className = '' }: ZModelAppProps): React.ReactElement {
  // Engine state
  const [engine, setEngine] = useState<ModelEngine | null>(null);
  const [meshes, setMeshes] = useState<EditableMesh[]>([]);
  const [selection, setSelection] = useState<SelectionState>({
    selectedObjects: [],
    selectedVertices: [],
    selectedEdges: [],
    selectedFaces: [],
    activeObject: null,
  });

  // Tool state
  const [tool, setTool] = useState<TransformTool>('select');
  const [editMode, setEditMode] = useState<EditMode>('object');
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('vertex');
  const [shadingMode, setShadingMode] = useState<ShadingMode>('solid');
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [gridSize, setGridSize] = useState(0.25);

  // UI state
  const [showOutliner, setShowOutliner] = useState(true);
  const [showProperties, setShowProperties] = useState(true);
  const [fps, setFps] = useState(0);
  const [triangles, setTriangles] = useState(0);

  // History state
  const [history, setHistory] = useState<ModelCommand[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Camera state for overlay
  const [cameraRotation, setCameraRotation] = useState({ theta: Math.PI / 4, phi: Math.PI / 3 });

  // Refs
  const engineRef = useRef<ModelEngine | null>(null);

  // ============================================================================
  // Engine callbacks
  // ============================================================================

  const handleEngineReady = useCallback((newEngine: ModelEngine) => {
    setEngine(newEngine);
    engineRef.current = newEngine;

    // Subscribe to state updates
    newEngine.subscribe((state) => {
      setFps(state.fps);
      setTriangles(state.triangles);
    });

    // Add initial cube
    const cube = createPrimitive('cube');
    cube.name = 'Cube';
    newEngine.addMesh(cube);
    setMeshes([cube]);
  }, []);

  // Sync meshes from engine
  const syncMeshes = useCallback(() => {
    if (engineRef.current) {
      setMeshes([...engineRef.current.getMeshes()]);
      setSelection(engineRef.current.getSelection());
    }
  }, []);

  // ============================================================================
  // Selection handling
  // ============================================================================

  const handleSelect = useCallback((meshId: string | null, addToSelection: boolean) => {
    if (!engineRef.current) return;

    if (meshId) {
      engineRef.current.selectObject(meshId, addToSelection);
    } else if (!addToSelection) {
      engineRef.current.deselectAll();
    }

    syncMeshes();
  }, [syncMeshes]);

  // ============================================================================
  // Object operations
  // ============================================================================

  const handleAddPrimitive = useCallback((type: PrimitiveType) => {
    if (!engineRef.current) return;

    const mesh = createPrimitive(type);
    mesh.name = type.charAt(0).toUpperCase() + type.slice(1);

    // Position new object at 3D cursor or offset from existing
    const selectedMesh = meshes.find((m) => m.id === selection.activeObject);
    if (selectedMesh) {
      mesh.transform.position = {
        x: selectedMesh.transform.position.x + 2,
        y: selectedMesh.transform.position.y,
        z: selectedMesh.transform.position.z,
      };
    }

    engineRef.current.addMesh(mesh);
    engineRef.current.selectObject(mesh.id);
    syncMeshes();

    // Add to history
    addCommand({
      type: 'add',
      description: `Add ${mesh.name}`,
      execute: () => {
        engineRef.current?.addMesh(mesh);
        engineRef.current?.selectObject(mesh.id);
        syncMeshes();
      },
      undo: () => {
        engineRef.current?.removeMesh(mesh.id);
        syncMeshes();
      },
    });
  }, [meshes, selection.activeObject, syncMeshes]);

  const handleDelete = useCallback(() => {
    if (!engineRef.current) return;

    const toDelete = [...selection.selectedObjects];
    const deletedMeshes = toDelete
      .map((id) => engineRef.current?.getMesh(id))
      .filter((m): m is EditableMesh => !!m);

    for (const id of toDelete) {
      engineRef.current.removeMesh(id);
    }
    syncMeshes();

    addCommand({
      type: 'delete',
      description: `Delete ${toDelete.length} object(s)`,
      execute: () => {
        for (const id of toDelete) {
          engineRef.current?.removeMesh(id);
        }
        syncMeshes();
      },
      undo: () => {
        for (const mesh of deletedMeshes) {
          engineRef.current?.addMesh(mesh);
        }
        syncMeshes();
      },
    });
  }, [selection.selectedObjects, syncMeshes]);

  const handleDuplicate = useCallback(() => {
    if (!engineRef.current) return;

    const duplicates: EditableMesh[] = [];
    for (const id of selection.selectedObjects) {
      const dup = engineRef.current.duplicateMesh(id);
      if (dup) duplicates.push(dup);
    }

    if (duplicates.length > 0) {
      engineRef.current.setSelection({
        selectedObjects: duplicates.map((m) => m.id),
        activeObject: duplicates[0].id,
      });
      syncMeshes();
    }
  }, [selection.selectedObjects, syncMeshes]);

  // ============================================================================
  // Outliner callbacks
  // ============================================================================

  const handleToggleVisibility = useCallback((id: string) => {
    if (!engineRef.current) return;
    const mesh = engineRef.current.getMesh(id);
    if (mesh) {
      engineRef.current.updateMesh(id, { visible: !mesh.visible });
      syncMeshes();
    }
  }, [syncMeshes]);

  const handleToggleLock = useCallback((id: string) => {
    if (!engineRef.current) return;
    const mesh = engineRef.current.getMesh(id);
    if (mesh) {
      engineRef.current.updateMesh(id, { locked: !mesh.locked });
      syncMeshes();
    }
  }, [syncMeshes]);

  const handleRename = useCallback((id: string, name: string) => {
    if (!engineRef.current) return;
    engineRef.current.updateMesh(id, { name });
    syncMeshes();
  }, [syncMeshes]);

  const handleDeleteFromOutliner = useCallback((id: string) => {
    if (!engineRef.current) return;
    engineRef.current.removeMesh(id);
    syncMeshes();
  }, [syncMeshes]);

  // ============================================================================
  // Properties callbacks
  // ============================================================================

  const handleUpdateTransform = useCallback((updates: Partial<{ position: Vec3; rotation: Vec3; scale: Vec3 }>) => {
    if (!engineRef.current || !selection.activeObject) return;
    const mesh = engineRef.current.getMesh(selection.activeObject);
    if (mesh) {
      engineRef.current.updateMesh(selection.activeObject, {
        transform: { ...mesh.transform, ...updates },
      });
      syncMeshes();
    }
  }, [selection.activeObject, syncMeshes]);

  const handleUpdateMaterial = useCallback((updates: Partial<{ color: Color; ambient: number; diffuse: number; specular: number; shininess: number; opacity: number }>) => {
    if (!engineRef.current || !selection.activeObject) return;
    const mesh = engineRef.current.getMesh(selection.activeObject);
    if (mesh) {
      engineRef.current.updateMesh(selection.activeObject, {
        material: { ...mesh.material, ...updates },
      });
      syncMeshes();
    }
  }, [selection.activeObject, syncMeshes]);

  // ============================================================================
  // History (Undo/Redo)
  // ============================================================================

  const addCommand = useCallback((command: ModelCommand) => {
    setHistory((prev) => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(command);
      return newHistory;
    });
    setHistoryIndex((prev) => prev + 1);
  }, [historyIndex]);

  const handleUndo = useCallback(() => {
    if (historyIndex < 0) return;
    const command = history[historyIndex];
    command.undo();
    setHistoryIndex((prev) => prev - 1);
  }, [history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const command = history[historyIndex + 1];
    command.execute();
    setHistoryIndex((prev) => prev + 1);
  }, [history, historyIndex]);

  // ============================================================================
  // Keyboard shortcuts
  // ============================================================================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const key = e.key.toLowerCase();

      // Tool shortcuts
      if (key === 'q') setTool('select');
      if (key === 'g') setTool('move');
      if (key === 'r') setTool('rotate');
      if (key === 's' && !e.ctrlKey && !e.metaKey) setTool('scale');

      // Edit mode
      if (key === 'tab') {
        e.preventDefault();
        setEditMode((m) => (m === 'object' ? 'edit' : 'object'));
      }

      // Selection mode (in edit mode)
      if (editMode === 'edit') {
        if (key === '1') setSelectionMode('vertex');
        if (key === '2') setSelectionMode('edge');
        if (key === '3') setSelectionMode('face');
      }

      // Delete
      if (key === 'x' || key === 'delete') {
        handleDelete();
      }

      // Duplicate
      if (key === 'd' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleDuplicate();
      }

      // Undo/Redo
      if (key === 'z' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      }

      // Add menu (Shift+A)
      if (key === 'a' && e.shiftKey) {
        e.preventDefault();
        handleAddPrimitive('cube');
      }

      // Select all
      if (key === 'a' && !e.shiftKey) {
        e.preventDefault();
        if (engineRef.current) {
          const allIds = meshes.filter((m) => m.visible && !m.locked).map((m) => m.id);
          engineRef.current.setSelection({
            selectedObjects: allIds,
            activeObject: allIds[0] ?? null,
          });
          syncMeshes();
        }
      }

      // Focus on selected (.)
      if (key === '.') {
        if (engineRef.current && selection.activeObject) {
          const mesh = engineRef.current.getMesh(selection.activeObject);
          if (mesh) {
            const scene = engineRef.current.getScene();
            if (scene) {
              scene.camera.target = { ...mesh.transform.position };
            }
          }
        }
      }

      // Hide panels
      if (key === 'n') setShowProperties((v) => !v);
      if (key === 't') setShowOutliner((v) => !v);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editMode, meshes, selection, handleDelete, handleDuplicate, handleUndo, handleRedo, handleAddPrimitive, syncMeshes]);

  // ============================================================================
  // Get selected mesh for properties
  // ============================================================================

  const selectedMesh = selection.activeObject
    ? meshes.find((m) => m.id === selection.activeObject) ?? null
    : null;

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className={`flex flex-col h-full bg-gray-900 text-white ${className}`}>
      {/* Toolbar */}
      <Toolbar
        tool={tool}
        editMode={editMode}
        shadingMode={shadingMode}
        snapToGrid={snapToGrid}
        onToolChange={setTool}
        onEditModeChange={setEditMode}
        onShadingModeChange={setShadingMode}
        onSnapToGridChange={setSnapToGrid}
        onAddPrimitive={handleAddPrimitive}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={historyIndex >= 0}
        canRedo={historyIndex < history.length - 1}
      />

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Outliner */}
        {showOutliner && (
          <div className="w-56 border-r border-white/10 flex-shrink-0">
            <Outliner
              meshes={meshes}
              selection={selection}
              onSelect={handleSelect}
              onToggleVisibility={handleToggleVisibility}
              onToggleLock={handleToggleLock}
              onRename={handleRename}
              onDelete={handleDeleteFromOutliner}
            />
          </div>
        )}

        {/* Viewport */}
        <div className="flex-1 relative">
          <Viewport
            engine={engine}
            tool={tool}
            editMode={editMode}
            selectionMode={selectionMode}
            shadingMode={shadingMode}
            onEngineReady={handleEngineReady}
            onSelect={handleSelect}
          />
          <ViewportOverlay
            tool={tool}
            selection={selection}
            cameraRotation={cameraRotation}
          />
        </div>

        {/* Properties Panel */}
        {showProperties && (
          <div className="w-64 border-l border-white/10 flex-shrink-0">
            <PropertiesPanel
              selectedMesh={selectedMesh}
              onUpdateTransform={handleUpdateTransform}
              onUpdateMaterial={handleUpdateMaterial}
            />
          </div>
        )}
      </div>

      {/* Status Bar */}
      <StatusBar
        meshes={meshes}
        selection={selection}
        editMode={editMode}
        selectionMode={selectionMode}
        fps={fps}
        triangles={triangles}
      />
    </div>
  );
}

// ============================================================================
// App Icon
// ============================================================================

export function ZModelIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="zmodel-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#zmodel-grad)" />
      {/* 3D cube wireframe */}
      <g stroke="white" strokeWidth="2" fill="none" opacity="0.9">
        {/* Front face */}
        <path d="M20 24 L44 24 L44 48 L20 48 Z" />
        {/* Back face (offset) */}
        <path d="M28 16 L52 16 L52 40 L28 40" strokeDasharray="2 2" opacity="0.5" />
        {/* Connecting edges */}
        <path d="M20 24 L28 16" />
        <path d="M44 24 L52 16" />
        <path d="M44 48 L52 40" />
        <path d="M20 48 L28 40" strokeDasharray="2 2" opacity="0.5" />
      </g>
      {/* Axes indicator */}
      <g strokeWidth="2">
        <line x1="12" y1="52" x2="20" y2="52" stroke="#ef4444" />
        <line x1="12" y1="52" x2="12" y2="44" stroke="#22c55e" />
        <line x1="12" y1="52" x2="8" y2="56" stroke="#3b82f6" />
      </g>
    </svg>
  );
}

// ============================================================================
// Default export for zOS app loader
// ============================================================================

export default ZModelApp;
