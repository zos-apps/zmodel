/**
 * Mesh Modifiers
 *
 * V2: Advanced Modeling features
 */

// Basic modifiers
export { extrude } from './extrude';
export { loopCut } from './loopCut';
export { subdivide } from './subdivide';
export { bevel } from './bevel';

// V2: Advanced modifiers
export { mirror, type MirrorOptions } from './mirror';
export { array, type ArrayOptions } from './array';
export { boolean, type BooleanOptions, type BooleanOperation } from './boolean';
export { solidify, type SolidifyOptions } from './solidify';
export { decimate, type DecimateOptions } from './decimate';
export { knifeCut, knifeProject, type KnifeCut } from './knife';
export { bridgeEdgeLoops, detectEdgeLoops, type BridgeOptions } from './bridge';
