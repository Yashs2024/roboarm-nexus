import { ArmConfig, Coordinates, JointAngles } from '../types';
import { BASE_X, BASE_Y, CANVAS_HEIGHT, CANVAS_WIDTH } from '../constants';

/**
 * Calculates Inverse Kinematics for a 2-Segment Planar Arm (Analytical Solution)
 * Uses Law of Cosines to determine shoulder and elbow angles.
 */
export const calculateIK = (
  target: Coordinates,
  config: ArmConfig
): JointAngles => {
  const { x, y, z } = target;
  
  const l1 = config.segment1Length;
  const l2 = config.segment2Length;

  // 1. Base Rotation (Theta 0) - Top down view
  // In a 2D side-view simulation, we mostly care about 'Reach' (r) and 'Height' (y)
  const baseAngleRad = Math.atan2(x, z);
  const baseAngleDeg = (baseAngleRad * 180) / Math.PI;

  // 2. Planar Reach
  // We treat 'x' passed from mapInputToCoordinates as the radial distance from base in the screen plane.
  // Since we are simulating 2D, let's treat target.x as the horizontal reach and target.y as vertical.
  // We need absolute distance from origin (0,0) for the 2-link solution.
  // Our system: Origin is (0,0). Target is (x, y).
  
  // Distance to target
  const dist = Math.sqrt(x * x + y * y);
  
  // Reachability check
  const maxReach = l1 + l2;
  let adjustX = x;
  let adjustY = y;

  if (dist > maxReach) {
    const ratio = maxReach / dist;
    adjustX = x * ratio;
    adjustY = y * ratio;
  } else if (dist < Math.abs(l1 - l2)) {
      // Too close (singularity)
      // We don't change logic much, math handles it or returns NaN usually, 
      // but let's clamp minimum distance slightly if needed.
  }

  // Inverse Kinematics (Geometric / Law of Cosines)
  // theta2 (Elbow) calculation:
  // r^2 = l1^2 + l2^2 - 2*l1*l2*cos(180 - theta2)
  // cos(theta2) = (x^2 + y^2 - l1^2 - l2^2) / (2*l1*l2)
  
  const rSquared = adjustX * adjustX + adjustY * adjustY;
  const cosAngle2 = (rSquared - l1 * l1 - l2 * l2) / (2 * l1 * l2);
  
  // Clamp cosAngle2 to [-1, 1] to avoid NaN errors due to floating point precision
  const c2 = Math.max(-1, Math.min(1, cosAngle2));
  
  // Elbow Angle (relative to upper arm direction, typically)
  // Note: MediaPipe Y is down, but our coordinate system Y is Up (handled in mapInput).
  // Standard solution:
  // theta2 is usually negative for "elbow up" or positive for "elbow down" config.
  // Let's assume elbow 'up' (relative to line connecting shoulder-wrist) 
  // actually in this sim, usually elbow bends 'forward'.
  const theta2Rad = -Math.acos(c2); // Negative for standard elbow bend direction

  // Shoulder Angle (theta1)
  // theta1 = atan2(y, x) - atan2(k2, k1)
  // k1 = l1 + l2*cos(theta2)
  // k2 = l2*sin(theta2)
  const k1 = l1 + l2 * Math.cos(theta2Rad);
  const k2 = l2 * Math.sin(theta2Rad);
  const theta1Rad = Math.atan2(adjustY, adjustX) - Math.atan2(k2, k1);

  return {
    base: Math.floor(baseAngleDeg),
    shoulder: Math.floor((theta1Rad * 180) / Math.PI),
    elbow: Math.floor((theta2Rad * 180) / Math.PI),
    gripper: 0
  };
};

export const mapInputToCoordinates = (
  normX: number,
  normY: number,
  config: ArmConfig
): Coordinates => {
  // Clamp input
  const clampedX = Math.max(0, Math.min(1, normX));
  const clampedY = Math.max(0, Math.min(1, normY));

  // Map to Canvas pixels
  const screenX = clampedX * CANVAS_WIDTH;
  const screenY = clampedY * CANVAS_HEIGHT;

  // Convert to Arm Coordinate System (Relative to Base)
  // X: Horizontal distance from base (Right is positive)
  // Y: Vertical height from base (Up is positive)
  
  const x = screenX - BASE_X;
  const y = BASE_Y - screenY; // Invert Y because screen Y is down, arm Y is up
  const z = 0;

  return { x, y, z };
};