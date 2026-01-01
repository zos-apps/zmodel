/**
 * Properties Panel Component
 *
 * Shows transform and material properties for selected objects.
 */

import React, { useState, useEffect } from 'react';
import type { EditableMesh, Vec3, Color } from '../types';

export interface PropertiesPanelProps {
  selectedMesh: EditableMesh | null;
  onUpdateTransform: (updates: Partial<{ position: Vec3; rotation: Vec3; scale: Vec3 }>) => void;
  onUpdateMaterial: (updates: Partial<{ color: Color; ambient: number; diffuse: number; specular: number; shininess: number; opacity: number }>) => void;
}

interface VectorInputProps {
  label: string;
  value: Vec3;
  onChange: (value: Vec3) => void;
  step?: number;
}

function VectorInput({ label, value, onChange, step = 0.1 }: VectorInputProps): React.ReactElement {
  const handleChange = (axis: 'x' | 'y' | 'z', val: string) => {
    const num = parseFloat(val);
    if (!isNaN(num)) {
      onChange({ ...value, [axis]: num });
    }
  };

  return (
    <div className="space-y-1">
      <label className="text-xs text-white/50 uppercase tracking-wider">{label}</label>
      <div className="flex gap-1">
        <div className="flex-1">
          <div className="flex items-center gap-1">
            <span className="text-xs text-red-400 w-3">X</span>
            <input
              type="number"
              value={value.x.toFixed(3)}
              onChange={(e) => handleChange('x', e.target.value)}
              step={step}
              className="w-full px-2 py-1 text-xs bg-black/30 border border-white/10 rounded focus:border-blue-500 outline-none"
            />
          </div>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-1">
            <span className="text-xs text-green-400 w-3">Y</span>
            <input
              type="number"
              value={value.y.toFixed(3)}
              onChange={(e) => handleChange('y', e.target.value)}
              step={step}
              className="w-full px-2 py-1 text-xs bg-black/30 border border-white/10 rounded focus:border-blue-500 outline-none"
            />
          </div>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-1">
            <span className="text-xs text-blue-400 w-3">Z</span>
            <input
              type="number"
              value={value.z.toFixed(3)}
              onChange={(e) => handleChange('z', e.target.value)}
              step={step}
              className="w-full px-2 py-1 text-xs bg-black/30 border border-white/10 rounded focus:border-blue-500 outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

interface SliderInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

function SliderInput({ label, value, onChange, min = 0, max = 1, step = 0.01 }: SliderInputProps): React.ReactElement {
  return (
    <div className="space-y-1">
      <div className="flex justify-between">
        <label className="text-xs text-white/50">{label}</label>
        <span className="text-xs text-white/70">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        min={min}
        max={max}
        step={step}
        className="w-full h-1 bg-white/10 rounded appearance-none cursor-pointer"
      />
    </div>
  );
}

function ColorInput({ color, onChange }: { color: Color; onChange: (c: Color) => void }): React.ReactElement {
  const hexColor = `#${Math.round(color.r).toString(16).padStart(2, '0')}${Math.round(color.g).toString(16).padStart(2, '0')}${Math.round(color.b).toString(16).padStart(2, '0')}`;

  const handleHexChange = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
      onChange({ r, g, b, a: color.a });
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={hexColor}
        onChange={(e) => handleHexChange(e.target.value)}
        className="w-8 h-8 rounded border border-white/20 cursor-pointer"
      />
      <input
        type="text"
        value={hexColor}
        onChange={(e) => handleHexChange(e.target.value)}
        className="flex-1 px-2 py-1 text-xs bg-black/30 border border-white/10 rounded focus:border-blue-500 outline-none"
      />
    </div>
  );
}

export function PropertiesPanel({
  selectedMesh,
  onUpdateTransform,
  onUpdateMaterial,
}: PropertiesPanelProps): React.ReactElement {
  const [expandedSections, setExpandedSections] = useState({
    transform: true,
    material: true,
    geometry: false,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  if (!selectedMesh) {
    return (
      <div className="flex flex-col h-full bg-black/30">
        <div className="px-3 py-2 border-b border-white/10 text-xs font-medium text-white/60 uppercase tracking-wider">
          Properties
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-white/30 text-xs px-4">
            No object selected.
            <br />
            Select an object to view properties.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-black/30">
      <div className="px-3 py-2 border-b border-white/10 text-xs font-medium text-white/60 uppercase tracking-wider">
        Properties
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Object Name */}
        <div className="px-3 py-2 border-b border-white/5">
          <div className="text-sm font-medium text-white/90">{selectedMesh.name}</div>
          <div className="text-xs text-white/40">{selectedMesh.geometry.vertexCount} vertices</div>
        </div>

        {/* Transform Section */}
        <div className="border-b border-white/5">
          <button
            onClick={() => toggleSection('transform')}
            className="w-full px-3 py-2 flex items-center justify-between hover:bg-white/5"
          >
            <span className="text-xs font-medium text-white/70">Transform</span>
            <svg
              className={`w-4 h-4 text-white/40 transition-transform ${expandedSections.transform ? 'rotate-180' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {expandedSections.transform && (
            <div className="px-3 pb-3 space-y-3">
              <VectorInput
                label="Position"
                value={selectedMesh.transform.position}
                onChange={(position) => onUpdateTransform({ position })}
              />
              <VectorInput
                label="Rotation"
                value={{
                  x: (selectedMesh.transform.rotation.x * 180) / Math.PI,
                  y: (selectedMesh.transform.rotation.y * 180) / Math.PI,
                  z: (selectedMesh.transform.rotation.z * 180) / Math.PI,
                }}
                onChange={(rotation) =>
                  onUpdateTransform({
                    rotation: {
                      x: (rotation.x * Math.PI) / 180,
                      y: (rotation.y * Math.PI) / 180,
                      z: (rotation.z * Math.PI) / 180,
                    },
                  })
                }
                step={1}
              />
              <VectorInput
                label="Scale"
                value={selectedMesh.transform.scale}
                onChange={(scale) => onUpdateTransform({ scale })}
              />
            </div>
          )}
        </div>

        {/* Material Section */}
        <div className="border-b border-white/5">
          <button
            onClick={() => toggleSection('material')}
            className="w-full px-3 py-2 flex items-center justify-between hover:bg-white/5"
          >
            <span className="text-xs font-medium text-white/70">Material</span>
            <svg
              className={`w-4 h-4 text-white/40 transition-transform ${expandedSections.material ? 'rotate-180' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {expandedSections.material && (
            <div className="px-3 pb-3 space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-white/50">Color</label>
                <ColorInput
                  color={selectedMesh.material.color}
                  onChange={(color) => onUpdateMaterial({ color })}
                />
              </div>

              <SliderInput
                label="Ambient"
                value={selectedMesh.material.ambient}
                onChange={(ambient) => onUpdateMaterial({ ambient })}
              />

              <SliderInput
                label="Diffuse"
                value={selectedMesh.material.diffuse}
                onChange={(diffuse) => onUpdateMaterial({ diffuse })}
              />

              <SliderInput
                label="Specular"
                value={selectedMesh.material.specular}
                onChange={(specular) => onUpdateMaterial({ specular })}
              />

              <SliderInput
                label="Shininess"
                value={selectedMesh.material.shininess}
                onChange={(shininess) => onUpdateMaterial({ shininess })}
                min={1}
                max={128}
                step={1}
              />

              <SliderInput
                label="Opacity"
                value={selectedMesh.material.opacity}
                onChange={(opacity) => onUpdateMaterial({ opacity })}
              />
            </div>
          )}
        </div>

        {/* Geometry Section */}
        <div className="border-b border-white/5">
          <button
            onClick={() => toggleSection('geometry')}
            className="w-full px-3 py-2 flex items-center justify-between hover:bg-white/5"
          >
            <span className="text-xs font-medium text-white/70">Geometry</span>
            <svg
              className={`w-4 h-4 text-white/40 transition-transform ${expandedSections.geometry ? 'rotate-180' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {expandedSections.geometry && (
            <div className="px-3 pb-3 space-y-2 text-xs">
              <div className="flex justify-between text-white/60">
                <span>Vertices</span>
                <span className="text-white/80">{selectedMesh.geometry.vertexCount}</span>
              </div>
              <div className="flex justify-between text-white/60">
                <span>Edges</span>
                <span className="text-white/80">{selectedMesh.geometry.edges.length}</span>
              </div>
              <div className="flex justify-between text-white/60">
                <span>Faces</span>
                <span className="text-white/80">{selectedMesh.geometry.faces.length}</span>
              </div>
              <div className="flex justify-between text-white/60">
                <span>Triangles</span>
                <span className="text-white/80">{selectedMesh.geometry.indices.length / 3}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
