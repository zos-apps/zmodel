/**
 * Toolbar Component
 *
 * Top toolbar with transform tools and add menu.
 */

import React, { useState } from 'react';
import type { TransformTool, EditMode, ShadingMode, PrimitiveType } from '../types';

export interface ToolbarProps {
  tool: TransformTool;
  editMode: EditMode;
  shadingMode: ShadingMode;
  snapToGrid: boolean;
  onToolChange: (tool: TransformTool) => void;
  onEditModeChange: (mode: EditMode) => void;
  onShadingModeChange: (mode: ShadingMode) => void;
  onSnapToGridChange: (enabled: boolean) => void;
  onAddPrimitive: (type: PrimitiveType) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const TOOLS: { id: TransformTool; label: string; shortcut: string }[] = [
  { id: 'select', label: 'Select', shortcut: 'Q' },
  { id: 'move', label: 'Move', shortcut: 'G' },
  { id: 'rotate', label: 'Rotate', shortcut: 'R' },
  { id: 'scale', label: 'Scale', shortcut: 'S' },
];

const PRIMITIVES: { type: PrimitiveType; label: string }[] = [
  { type: 'cube', label: 'Cube' },
  { type: 'sphere', label: 'Sphere' },
  { type: 'cylinder', label: 'Cylinder' },
  { type: 'cone', label: 'Cone' },
  { type: 'plane', label: 'Plane' },
  { type: 'torus', label: 'Torus' },
];

export function Toolbar({
  tool,
  editMode,
  shadingMode,
  snapToGrid,
  onToolChange,
  onEditModeChange,
  onShadingModeChange,
  onSnapToGridChange,
  onAddPrimitive,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: ToolbarProps): React.ReactElement {
  const [showAddMenu, setShowAddMenu] = useState(false);

  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-black/40 border-b border-white/10">
      {/* Undo/Redo */}
      <div className="flex items-center gap-0.5 mr-2">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="p-1.5 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Undo (Ctrl+Z)"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 10h10a5 5 0 0 1 5 5v2M3 10l4 4M3 10l4-4" />
          </svg>
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="p-1.5 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Redo (Ctrl+Shift+Z)"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 10H11a5 5 0 0 0-5 5v2M21 10l-4 4M21 10l-4-4" />
          </svg>
        </button>
      </div>

      {/* Divider */}
      <div className="w-px h-5 bg-white/20 mx-1" />

      {/* Transform Tools */}
      <div className="flex items-center gap-0.5">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            onClick={() => onToolChange(t.id)}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              tool === t.id
                ? 'bg-blue-500/80 text-white'
                : 'hover:bg-white/10 text-white/70'
            }`}
            title={`${t.label} (${t.shortcut})`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="w-px h-5 bg-white/20 mx-1" />

      {/* Edit Mode Toggle */}
      <button
        onClick={() => onEditModeChange(editMode === 'object' ? 'edit' : 'object')}
        className={`px-2 py-1 text-xs rounded transition-colors ${
          editMode === 'edit'
            ? 'bg-orange-500/80 text-white'
            : 'hover:bg-white/10 text-white/70'
        }`}
        title="Toggle Edit Mode (Tab)"
      >
        {editMode === 'object' ? 'Object Mode' : 'Edit Mode'}
      </button>

      {/* Divider */}
      <div className="w-px h-5 bg-white/20 mx-1" />

      {/* Add Primitive */}
      <div className="relative">
        <button
          onClick={() => setShowAddMenu(!showAddMenu)}
          className="px-2 py-1 text-xs rounded hover:bg-white/10 text-white/70 flex items-center gap-1"
        >
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {showAddMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowAddMenu(false)}
            />
            <div className="absolute top-full left-0 mt-1 py-1 bg-gray-800 border border-white/20 rounded-lg shadow-xl z-50 min-w-32">
              <div className="px-2 py-1 text-xs text-white/50 uppercase tracking-wider">
                Mesh
              </div>
              {PRIMITIVES.map((p) => (
                <button
                  key={p.type}
                  onClick={() => {
                    onAddPrimitive(p.type);
                    setShowAddMenu(false);
                  }}
                  className="w-full px-3 py-1.5 text-left text-sm hover:bg-white/10 text-white/80"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Shading Mode */}
      <select
        value={shadingMode}
        onChange={(e) => onShadingModeChange(e.target.value as ShadingMode)}
        className="px-2 py-1 text-xs bg-transparent border border-white/20 rounded text-white/70"
      >
        <option value="solid">Solid</option>
        <option value="wireframe">Wireframe</option>
        <option value="material">Material</option>
      </select>

      {/* Snap to Grid */}
      <label className="flex items-center gap-1.5 px-2 text-xs text-white/70 cursor-pointer">
        <input
          type="checkbox"
          checked={snapToGrid}
          onChange={(e) => onSnapToGridChange(e.target.checked)}
          className="w-3 h-3"
        />
        Snap
      </label>
    </div>
  );
}
