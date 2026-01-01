/**
 * Outliner Component
 *
 * Scene hierarchy view with object visibility and selection.
 */

import React from 'react';
import type { EditableMesh, SelectionState } from '../types';

export interface OutlinerProps {
  meshes: EditableMesh[];
  selection: SelectionState;
  onSelect: (id: string, addToSelection: boolean) => void;
  onToggleVisibility: (id: string) => void;
  onToggleLock: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

export function Outliner({
  meshes,
  selection,
  onSelect,
  onToggleVisibility,
  onToggleLock,
  onRename,
  onDelete,
}: OutlinerProps): React.ReactElement {
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingName, setEditingName] = React.useState('');

  const handleDoubleClick = (mesh: EditableMesh) => {
    setEditingId(mesh.id);
    setEditingName(mesh.name);
  };

  const handleNameSubmit = (id: string) => {
    if (editingName.trim()) {
      onRename(id, editingName.trim());
    }
    setEditingId(null);
  };

  return (
    <div className="flex flex-col h-full bg-black/30">
      <div className="px-3 py-2 border-b border-white/10 text-xs font-medium text-white/60 uppercase tracking-wider">
        Outliner
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Scene Root */}
        <div className="px-2 py-1.5 text-sm text-white/50 flex items-center gap-2">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a10 10 0 0 1 0 20" />
          </svg>
          Scene
        </div>

        {/* Objects */}
        <div className="pl-2">
          {meshes.length === 0 ? (
            <div className="px-4 py-8 text-center text-white/30 text-xs">
              No objects in scene.
              <br />
              Press Shift+A to add.
            </div>
          ) : (
            meshes.map((mesh) => {
              const isSelected = selection.selectedObjects.includes(mesh.id);
              const isActive = selection.activeObject === mesh.id;

              return (
                <div
                  key={mesh.id}
                  onClick={(e) => onSelect(mesh.id, e.shiftKey)}
                  onDoubleClick={() => handleDoubleClick(mesh)}
                  className={`group flex items-center gap-1 px-2 py-1 cursor-pointer rounded-sm mx-1 ${
                    isActive
                      ? 'bg-blue-500/50'
                      : isSelected
                      ? 'bg-blue-500/30'
                      : 'hover:bg-white/5'
                  }`}
                >
                  {/* Icon */}
                  <div className="w-4 h-4 flex items-center justify-center text-white/40">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                    </svg>
                  </div>

                  {/* Name */}
                  {editingId === mesh.id ? (
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={() => handleNameSubmit(mesh.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleNameSubmit(mesh.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="flex-1 px-1 py-0 text-sm bg-black/50 border border-blue-500 rounded outline-none"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span
                      className={`flex-1 text-sm truncate ${
                        mesh.visible ? 'text-white/80' : 'text-white/30'
                      }`}
                    >
                      {mesh.name}
                    </span>
                  )}

                  {/* Controls */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* Visibility */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleVisibility(mesh.id);
                      }}
                      className={`p-0.5 rounded hover:bg-white/10 ${
                        mesh.visible ? 'text-white/50' : 'text-white/20'
                      }`}
                      title={mesh.visible ? 'Hide' : 'Show'}
                    >
                      {mesh.visible ? (
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      )}
                    </button>

                    {/* Lock */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleLock(mesh.id);
                      }}
                      className={`p-0.5 rounded hover:bg-white/10 ${
                        mesh.locked ? 'text-orange-400' : 'text-white/30'
                      }`}
                      title={mesh.locked ? 'Unlock' : 'Lock'}
                    >
                      {mesh.locked ? (
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                        </svg>
                      )}
                    </button>

                    {/* Delete */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(mesh.id);
                      }}
                      className="p-0.5 rounded hover:bg-red-500/30 text-white/30 hover:text-red-400"
                      title="Delete"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-white/10 text-xs text-white/40">
        {meshes.length} object{meshes.length !== 1 ? 's' : ''}
        {selection.selectedObjects.length > 0 && (
          <span> | {selection.selectedObjects.length} selected</span>
        )}
      </div>
    </div>
  );
}
