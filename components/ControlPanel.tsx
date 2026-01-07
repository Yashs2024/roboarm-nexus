import React from 'react';
import { ArmConfig } from '../types';
import { Settings, AlertTriangle } from 'lucide-react';

interface ControlPanelProps {
  config: ArmConfig;
  setConfig: (c: ArmConfig) => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({ 
  config, 
  setConfig, 
}) => {
  
  const handleChange = (key: keyof ArmConfig, val: string) => {
    setConfig({ ...config, [key]: parseFloat(val) || 0 });
  };

  return (
    <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 h-full flex flex-col gap-6">
      
      {/* Header */}
      <div className="flex items-center gap-2 text-sky-400 mb-2">
        <Settings size={20} />
        <h2 className="text-lg font-bold">System Configuration</h2>
      </div>

      {/* Hardware Config */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Arm Dimensions (mm)</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Segment 1 (Shoulder)</label>
            <input 
              type="number" 
              value={config.segment1Length}
              onChange={(e) => handleChange('segment1Length', e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white focus:border-sky-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Segment 2 (Forearm)</label>
            <input 
              type="number" 
              value={config.segment2Length}
              onChange={(e) => handleChange('segment2Length', e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white focus:border-sky-500 outline-none"
            />
          </div>
        </div>
      </div>

      <div className="mt-4 p-4 bg-slate-900 rounded-lg border border-slate-700">
         <p className="text-xs text-slate-400 text-center">
            2-DOF Simulation Mode.<br/>Standard Planar configuration.
         </p>
      </div>

      {/* Safety Status */}
      <div className="mt-auto bg-amber-900/20 border border-amber-900/50 p-3 rounded flex items-start gap-3">
        <AlertTriangle className="text-amber-500 shrink-0" size={18} />
        <div className="space-y-1">
          <p className="text-xs font-bold text-amber-500">SAFETY FAILSAFE ACTIVE</p>
          <p className="text-[10px] text-amber-200/60 leading-tight">
            System will auto-lock if hand tracking confidence drops below 60% or if boundary limits are exceeded.
          </p>
        </div>
      </div>

    </div>
  );
};