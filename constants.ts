import { ArmConfig, Ball } from './types';

export const DEFAULT_ARM_CONFIG: ArmConfig = {
  segment1Length: 150, // mm - increased slightly for better reach with 2 links
  segment2Length: 120, // mm
  baseRotation: 0,
};

export const INITIAL_TARGET: { x: number; y: number } = {
  x: 100,
  y: 100,
};

// Simulation Canvas Dimensions
export const CANVAS_WIDTH = 600;
export const CANVAS_HEIGHT = 400;
export const BASE_X = 300; 
export const BASE_Y = 350; 

export const INITIAL_BALLS: Ball[] = [
  { id: 1, x: BASE_X - 100, y: BASE_Y - 20, color: '#ef4444', radius: 15, isGripped: false, vx: 0, vy: 0 }, // Red
  { id: 2, x: BASE_X + 120, y: BASE_Y - 20, color: '#3b82f6', radius: 15, isGripped: false, vx: 0, vy: 0 }, // Blue
  { id: 3, x: BASE_X - 150, y: BASE_Y - 20, color: '#10b981', radius: 15, isGripped: false, vx: 0, vy: 0 }, // Green
  { id: 4, x: BASE_X + 80, y: BASE_Y - 80, color: '#f59e0b', radius: 15, isGripped: false, vx: 0, vy: 0 }, // Amber
];