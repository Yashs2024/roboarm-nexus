export interface ArmConfig {
  segment1Length: number;
  segment2Length: number;
  baseRotation: number;
}

export interface Coordinates {
  x: number;
  y: number;
  z: number;
}

export interface JointAngles {
  base: number;
  shoulder: number;
  elbow: number;
  gripper: number; // 0 (open) to 100 (closed)
}

export enum Tab {
  SIMULATION = 'SIMULATION',
  CODE_GEN = 'CODE_GEN',
  SETTINGS = 'SETTINGS'
}

export enum HandGesture {
  NONE = 'NONE',
  OPEN_PALM = 'OPEN_PALM',
  PINCH = 'PINCH',
  CLOSED_FIST = 'CLOSED_FIST'
}

export interface GeneratedCode {
  python: string;
  arduino: string;
  explanation: string;
}

export interface Ball {
  id: number;
  x: number;
  y: number;
  color: string;
  radius: number;
  isGripped: boolean;
  vx: number;
  vy: number;
}