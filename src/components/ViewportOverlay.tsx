/**
 * Viewport Overlay Component
 *
 * Overlay UI elements on the viewport (axes indicator, selection info, etc.)
 */

import React from 'react';
import type { Vec3, TransformTool, SelectionState } from '../types';

export interface ViewportOverlayProps {
  tool: TransformTool;
  selection: SelectionState;
  cameraRotation: { theta: number; phi: number };
}

export function ViewportOverlay({
  tool,
  selection,
  cameraRotation,
}: ViewportOverlayProps): React.ReactElement {
  // Calculate axis orientation based on camera rotation
  const { theta, phi } = cameraRotation;

  // Simple 2D projection of axes for the corner indicator
  const axisLength = 20;
  const xAxis = {
    x: Math.cos(theta) * axisLength,
    y: -Math.sin(phi) * Math.sin(theta) * axisLength,
  };
  const yAxis = {
    x: 0,
    y: -Math.cos(phi) * axisLength,
  };
  const zAxis = {
    x: Math.sin(theta) * axisLength,
    y: Math.sin(phi) * Math.cos(theta) * axisLength,
  };

  return (
    <>
      {/* Axes indicator */}
      <div className="absolute bottom-4 left-4 w-16 h-16">
        <svg viewBox="-30 -30 60 60" className="w-full h-full">
          {/* X axis (red) */}
          <line x1="0" y1="0" x2={xAxis.x} y2={xAxis.y} stroke="#ef4444" strokeWidth="2" />
          <text x={xAxis.x * 1.3} y={xAxis.y * 1.3} fill="#ef4444" fontSize="8" textAnchor="middle" dominantBaseline="middle">
            X
          </text>

          {/* Y axis (green) */}
          <line x1="0" y1="0" x2={yAxis.x} y2={yAxis.y} stroke="#22c55e" strokeWidth="2" />
          <text x={yAxis.x * 1.3} y={yAxis.y * 1.3 - 5} fill="#22c55e" fontSize="8" textAnchor="middle" dominantBaseline="middle">
            Y
          </text>

          {/* Z axis (blue) */}
          <line x1="0" y1="0" x2={zAxis.x} y2={zAxis.y} stroke="#3b82f6" strokeWidth="2" />
          <text x={zAxis.x * 1.3} y={zAxis.y * 1.3} fill="#3b82f6" fontSize="8" textAnchor="middle" dominantBaseline="middle">
            Z
          </text>

          {/* Center dot */}
          <circle cx="0" cy="0" r="2" fill="white" opacity="0.5" />
        </svg>
      </div>

      {/* Tool indicator */}
      <div className="absolute bottom-4 right-4 px-2 py-1 bg-black/50 rounded text-xs text-white/70">
        {tool === 'select' && 'Select (Q)'}
        {tool === 'move' && 'Move (G)'}
        {tool === 'rotate' && 'Rotate (R)'}
        {tool === 'scale' && 'Scale (S)'}
      </div>

      {/* Selection count */}
      {selection.selectedObjects.length > 0 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-blue-500/80 rounded text-xs text-white">
          {selection.selectedObjects.length} object{selection.selectedObjects.length !== 1 ? 's' : ''} selected
        </div>
      )}
    </>
  );
}
