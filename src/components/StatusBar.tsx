/**
 * Status Bar Component
 *
 * Bottom status bar with scene stats and hints.
 */

import React from 'react';
import type { EditMode, SelectionMode, EditableMesh, SelectionState } from '../types';

export interface StatusBarProps {
  meshes: EditableMesh[];
  selection: SelectionState;
  editMode: EditMode;
  selectionMode: SelectionMode;
  fps: number;
  triangles: number;
}

export function StatusBar({
  meshes,
  selection,
  editMode,
  selectionMode,
  fps,
  triangles,
}: StatusBarProps): React.ReactElement {
  // Calculate totals
  const totalVertices = meshes.reduce((sum, m) => sum + m.geometry.vertexCount, 0);
  const totalFaces = meshes.reduce((sum, m) => sum + m.geometry.faces.length, 0);

  // Get hint based on current state
  const getHint = (): string => {
    if (editMode === 'object') {
      if (selection.selectedObjects.length === 0) {
        return 'Click to select | Shift+A to add | Tab for edit mode';
      }
      return 'G move | R rotate | S scale | X delete | D duplicate';
    } else {
      if (selectionMode === 'vertex') {
        return 'Click vertices to select | E extrude | G move';
      } else if (selectionMode === 'edge') {
        return 'Click edges to select | Ctrl+R loop cut';
      } else {
        return 'Click faces to select | E extrude | I inset';
      }
    }
  };

  return (
    <div className="flex items-center justify-between px-3 py-1 bg-black/40 border-t border-white/10 text-xs text-white/60">
      {/* Left: Hint */}
      <div className="flex-1 truncate">
        {getHint()}
      </div>

      {/* Center: Edit mode info */}
      {editMode === 'edit' && (
        <div className="flex items-center gap-3 mx-4">
          <button
            className={`px-2 py-0.5 rounded ${selectionMode === 'vertex' ? 'bg-blue-500/50 text-white' : 'text-white/50'}`}
          >
            Vertex
          </button>
          <button
            className={`px-2 py-0.5 rounded ${selectionMode === 'edge' ? 'bg-blue-500/50 text-white' : 'text-white/50'}`}
          >
            Edge
          </button>
          <button
            className={`px-2 py-0.5 rounded ${selectionMode === 'face' ? 'bg-blue-500/50 text-white' : 'text-white/50'}`}
          >
            Face
          </button>
        </div>
      )}

      {/* Right: Stats */}
      <div className="flex items-center gap-4 text-white/40 font-mono">
        <span>Objs: {meshes.length}</span>
        <span>Verts: {totalVertices.toLocaleString()}</span>
        <span>Faces: {totalFaces.toLocaleString()}</span>
        <span>Tris: {triangles.toLocaleString()}</span>
        <span className="text-green-400/60">{fps} FPS</span>
      </div>
    </div>
  );
}
