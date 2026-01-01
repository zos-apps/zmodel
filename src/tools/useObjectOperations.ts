/**
 * useObjectOperations - Hook for object manipulation operations
 */

import { useCallback } from 'react';
import type { PrimitiveType, EditableMesh, ModelCommand } from '../types';
import { ModelEngine } from '../engine/ModelEngine';
import { createPrimitive } from '../engine/primitives';

export interface UseObjectOperationsOptions {
  engine: ModelEngine | null;
  onCommand?: (command: ModelCommand) => void;
}

export interface UseObjectOperationsReturn {
  addPrimitive: (type: PrimitiveType) => EditableMesh | null;
  deleteSelected: () => void;
  duplicateSelected: () => EditableMesh[];
  selectAll: () => void;
  deselectAll: () => void;
  hideSelected: () => void;
  showAll: () => void;
  focusSelected: () => void;
}

export function useObjectOperations(options: UseObjectOperationsOptions): UseObjectOperationsReturn {
  const { engine, onCommand } = options;

  const addPrimitive = useCallback(
    (type: PrimitiveType): EditableMesh | null => {
      if (!engine) return null;

      const mesh = createPrimitive(type);
      mesh.name = type.charAt(0).toUpperCase() + type.slice(1);

      const previousMeshes = [...engine.getMeshes()];

      engine.addMesh(mesh);
      engine.selectObject(mesh.id);

      onCommand?.({
        type: 'add_primitive',
        description: `Add ${mesh.name}`,
        execute: () => {
          engine.addMesh(mesh);
          engine.selectObject(mesh.id);
        },
        undo: () => {
          engine.removeMesh(mesh.id);
          engine.deselectAll();
        },
      });

      return mesh;
    },
    [engine, onCommand]
  );

  const deleteSelected = useCallback(() => {
    if (!engine) return;

    const selection = engine.getSelection();
    if (selection.selectedObjects.length === 0) return;

    const deletedMeshes: EditableMesh[] = [];
    for (const id of selection.selectedObjects) {
      const mesh = engine.getMesh(id);
      if (mesh) {
        deletedMeshes.push({ ...mesh });
        engine.removeMesh(id);
      }
    }

    engine.deselectAll();

    onCommand?.({
      type: 'delete',
      description: `Delete ${deletedMeshes.length} object(s)`,
      execute: () => {
        for (const mesh of deletedMeshes) {
          engine.removeMesh(mesh.id);
        }
        engine.deselectAll();
      },
      undo: () => {
        for (const mesh of deletedMeshes) {
          engine.addMesh(mesh);
        }
      },
    });
  }, [engine, onCommand]);

  const duplicateSelected = useCallback((): EditableMesh[] => {
    if (!engine) return [];

    const selection = engine.getSelection();
    if (selection.selectedObjects.length === 0) return [];

    const duplicates: EditableMesh[] = [];
    const originalIds = [...selection.selectedObjects];

    for (const id of originalIds) {
      const duplicate = engine.duplicateMesh(id);
      if (duplicate) {
        duplicates.push(duplicate);
      }
    }

    // Select the duplicates
    engine.setSelection({
      selectedObjects: duplicates.map(m => m.id),
      activeObject: duplicates[0]?.id ?? null,
    });

    onCommand?.({
      type: 'duplicate',
      description: `Duplicate ${duplicates.length} object(s)`,
      execute: () => {
        for (const mesh of duplicates) {
          engine.addMesh(mesh);
        }
        engine.setSelection({
          selectedObjects: duplicates.map(m => m.id),
          activeObject: duplicates[0]?.id ?? null,
        });
      },
      undo: () => {
        for (const mesh of duplicates) {
          engine.removeMesh(mesh.id);
        }
        engine.setSelection({
          selectedObjects: originalIds,
          activeObject: originalIds[0] ?? null,
        });
      },
    });

    return duplicates;
  }, [engine, onCommand]);

  const selectAll = useCallback(() => {
    if (!engine) return;

    const meshes = engine.getMeshes();
    const ids = meshes.filter(m => m.visible && !m.locked).map(m => m.id);

    engine.setSelection({
      selectedObjects: ids,
      activeObject: ids[0] ?? null,
    });
  }, [engine]);

  const deselectAll = useCallback(() => {
    engine?.deselectAll();
  }, [engine]);

  const hideSelected = useCallback(() => {
    if (!engine) return;

    const selection = engine.getSelection();
    for (const id of selection.selectedObjects) {
      engine.updateMesh(id, { visible: false });
    }
    engine.deselectAll();
  }, [engine]);

  const showAll = useCallback(() => {
    if (!engine) return;

    const meshes = engine.getMeshes();
    for (const mesh of meshes) {
      engine.updateMesh(mesh.id, { visible: true });
    }
  }, [engine]);

  const focusSelected = useCallback(() => {
    if (!engine) return;

    const selection = engine.getSelection();
    if (selection.selectedObjects.length === 0) return;

    // Calculate center of selection
    let cx = 0, cy = 0, cz = 0;
    let count = 0;

    for (const id of selection.selectedObjects) {
      const mesh = engine.getMesh(id);
      if (mesh) {
        cx += mesh.transform.position.x;
        cy += mesh.transform.position.y;
        cz += mesh.transform.position.z;
        count++;
      }
    }

    if (count > 0) {
      const scene = engine.getScene();
      if (scene) {
        scene.camera.target = { x: cx / count, y: cy / count, z: cz / count };
      }
    }
  }, [engine]);

  return {
    addPrimitive,
    deleteSelected,
    duplicateSelected,
    selectAll,
    deselectAll,
    hideSelected,
    showAll,
    focusSelected,
  };
}
