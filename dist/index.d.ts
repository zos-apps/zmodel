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
interface ZModelAppProps {
    className?: string;
}
declare function ZModelApp({ className }: ZModelAppProps): React.ReactElement;
declare function ZModelIcon(): React.ReactElement;

export { ZModelApp, type ZModelAppProps, ZModelIcon, ZModelApp as default };
