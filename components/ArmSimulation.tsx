import React, { useMemo } from 'react';
import { JointAngles, ArmConfig, Ball } from '../types';
import { BASE_X, BASE_Y } from '../constants';

interface ArmSimulationProps {
  angles: JointAngles;
  config: ArmConfig;
  target: { x: number; y: number };
  balls?: Ball[];
}

export const ArmSimulation: React.FC<ArmSimulationProps> = ({ angles, config, target, balls = [] }) => {
  // Forward Kinematics for Visualization
  const { positions, pathString, gripperPos } = useMemo(() => {
    // Base position
    const p0 = { x: BASE_X, y: BASE_Y };
    
    // Angles
    const a1 = angles.shoulder;
    const a2 = a1 + angles.elbow; // Elbow angle is relative

    // Convert to radians (SVG Y is down, so we flip sin for visual coordinate system if angle is standard math)
    // In our IK, Y+ is UP. SVG Y+ is DOWN.
    // If IK returns standard math angles (0 is right, 90 is up), we need to negate for SVG rotation OR map properly.
    // Let's assume standard Math: cos(a), -sin(a).
    const toRad = (deg: number) => (deg * Math.PI) / 180;

    const p1 = {
      x: p0.x + config.segment1Length * Math.cos(toRad(a1)),
      y: p0.y - config.segment1Length * Math.sin(toRad(a1)) // SVG y is inverted
    };
    
    const p2 = {
      x: p1.x + config.segment2Length * Math.cos(toRad(a2)),
      y: p1.y - config.segment2Length * Math.sin(toRad(a2))
    };

    return {
      positions: { p0, p1, p2 },
      pathString: `M ${p0.x} ${p0.y} L ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`,
      gripperPos: p2
    };
  }, [angles, config]);

  return (
    <div className="relative w-full h-full rounded-lg overflow-hidden">
      <div className="absolute top-4 left-4 z-10 font-mono text-xs text-slate-300 drop-shadow-md bg-black/50 p-2 rounded pointer-events-none">
        <p>BASE: {angles.base}°</p>
        <p>SHLDR: {angles.shoulder}°</p>
        <p>ELBOW: {angles.elbow}°</p>
        <p>GRIP: {angles.gripper > 50 ? 'CLOSED' : 'OPEN'}</p>
      </div>

      <svg className="w-full h-full" viewBox={`0 0 600 400`}>
        {/* Grid */}
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
          </pattern>
          <radialGradient id="ballGrad">
            <stop offset="0%" stopColor="rgba(255,255,255,0.8)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.1)" />
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        
        {/* Floor */}
        <line x1="0" y1={BASE_Y} x2="600" y2={BASE_Y} stroke="#94a3b8" strokeWidth="2" strokeOpacity="0.5" />
        
        {/* Balls */}
        {balls.map(ball => (
          <g key={ball.id} transform={`translate(${ball.x}, ${ball.y})`}>
            <circle r={ball.radius} fill={ball.color} stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
            <circle r={ball.radius} fill="url(#ballGrad)" opacity="0.4" />
          </g>
        ))}

        {/* Arm Shadow */}
        <path d={pathString} stroke="rgba(0,0,0,0.5)" strokeWidth="20" strokeLinecap="round" fill="none" transform="translate(4, 4)" />
        
        {/* Arm Segments */}
        <line x1={positions.p0.x} y1={positions.p0.y} x2={positions.p1.x} y2={positions.p1.y} stroke="#0ea5e9" strokeWidth="14" strokeLinecap="round" />
        <line x1={positions.p1.x} y1={positions.p1.y} x2={positions.p2.x} y2={positions.p2.y} stroke="#0284c7" strokeWidth="12" strokeLinecap="round" />

        {/* Joints */}
        <circle cx={positions.p0.x} cy={positions.p0.y} r="10" fill="#e2e8f0" />
        <circle cx={positions.p1.x} cy={positions.p1.y} r="8" fill="#cbd5e1" />
        <circle cx={positions.p2.x} cy={positions.p2.y} r="7" fill="#cbd5e1" />

        {/* Gripper */}
        {/* Rotate gripper based on total angle of last segment (p1->p2) */}
        <g transform={`translate(${positions.p2.x}, ${positions.p2.y}) rotate(${-(angles.shoulder + angles.elbow)})`}>
             <rect x="-2" y="-8" width="16" height="16" fill="#38bdf8" rx="2" />
             {/* Fingers */}
             <line x1="10" y1="-6" x2="25" y2={angles.gripper < 50 ? -12 : -4} stroke="#bae6fd" strokeWidth="4" />
             <line x1="10" y1="6" x2="25" y2={angles.gripper < 50 ? 12 : 4} stroke="#bae6fd" strokeWidth="4" />
        </g>

      </svg>
    </div>
  );
};