import React, { useState, useEffect, useRef } from 'react';
import { ArmConfig, Coordinates, JointAngles, Tab, GeneratedCode, HandGesture, Ball } from './types';
import { DEFAULT_ARM_CONFIG, INITIAL_BALLS, BASE_Y, BASE_X } from './constants';
import { calculateIK, mapInputToCoordinates } from './services/kinematics';
import { generateSystemCode } from './services/geminiService';
import { initializeVision, detectHands, analyzeGesture, drawLandmarks } from './services/visionService';
import { ArmSimulation } from './components/ArmSimulation';
import { ControlPanel } from './components/ControlPanel';
import { CodeViewer } from './components/CodeViewer';
import { Activity, Code, LayoutDashboard, Camera, Hand, Lock, MousePointer2, ScanEye } from 'lucide-react';

const App: React.FC = () => {
  // --- State ---
  const [config, setConfig] = useState<ArmConfig>(DEFAULT_ARM_CONFIG);
  const [activeTab, setActiveTab] = useState<Tab>(Tab.SIMULATION);
  
  // Simulation State (Visuals)
  // We keep these as state because we WANT re-renders when they change (at 30fps)
  const [target, setTarget] = useState<Coordinates>({ x: 100, y: 100, z: 0 });
  const [angles, setAngles] = useState<JointAngles>({ base: 0, shoulder: 90, elbow: -90, gripper: 0 });
  const [gesture, setGesture] = useState<HandGesture>(HandGesture.OPEN_PALM);
  const [balls, setBalls] = useState<Ball[]>(INITIAL_BALLS);
  
  // High Frequency Data (Refs to avoid re-render thrashing)
  const inputPosRef = useRef<{x: number, y: number}>({ x: 0.5, y: 0.5 });
  const lastVideoTimeRef = useRef<number>(-1);
  const configRef = useRef(config);
  const gestureRef = useRef(gesture);

  // Sync refs with state
  useEffect(() => { configRef.current = config; }, [config]);
  useEffect(() => { gestureRef.current = gesture; }, [gesture]);
  
  // Code Gen State
  const [generatedCode, setGeneratedCode] = useState<GeneratedCode | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Vision State
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  const [isVisionReady, setIsVisionReady] = useState(false);

  // --- Logic ---

  // 1. Initialize Vision System
  useEffect(() => {
    const startVision = async () => {
      const ready = await initializeVision();
      setIsVisionReady(ready);
    };
    if (activeTab === Tab.SIMULATION) {
      startVision();
    }
  }, [activeTab]);

  // 2. Camera & Tracking Loop
  // Updates Refs only (no re-renders), except for Gesture changes
  useEffect(() => {
    let stream: MediaStream | null = null;

    const loop = () => {
      if (videoRef.current && videoRef.current.readyState >= 2 && isVisionReady) {
        if (videoRef.current.currentTime !== lastVideoTimeRef.current) {
          lastVideoTimeRef.current = videoRef.current.currentTime;
          
          const detections = detectHands(videoRef.current, performance.now());
          const ctx = canvasRef.current?.getContext('2d');
          
          if (ctx && canvasRef.current) {
             ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

             if (detections && detections.landmarks.length > 0) {
               const landmarks = detections.landmarks[0];
               drawLandmarks(ctx, landmarks);

               const pointer = landmarks[5]; 
               const normX = 1 - pointer.x;
               const normY = pointer.y;

               const currentGesture = analyzeGesture(landmarks);
               
               // Only trigger React update if gesture actually changes
               if (currentGesture !== gestureRef.current) {
                 setGesture(currentGesture);
               }

               if (currentGesture !== HandGesture.CLOSED_FIST) {
                 // Update Ref directly - NO RE-RENDER
                 inputPosRef.current = { x: normX, y: normY };
               }
             }
          }
        }
      }
      requestRef.current = requestAnimationFrame(loop);
    };

    const enableCamera = async () => {
      if (activeTab === Tab.SIMULATION) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 640, height: 480, frameRate: 30 } 
          });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.onloadeddata = () => {
               requestRef.current = requestAnimationFrame(loop);
            };
          }
        } catch (err) {
          console.error("Camera access denied or failed:", err);
        }
      }
    };

    if (activeTab === Tab.SIMULATION) {
      enableCamera();
    }

    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [activeTab, isVisionReady]);

  // 3. Kinematics & Physics Loop
  // Runs at fixed 30fps, reads from Refs, updates State (Visuals)
  useEffect(() => {
    // Only run this effect once on mount/tab change. 
    // It uses Refs for data, so it doesn't need to restart when data changes.
    
    const updatePhysics = () => {
      const cfg = configRef.current;
      const gest = gestureRef.current;
      const inp = inputPosRef.current;

      // 1. Update Target from Input
      const newCoords = mapInputToCoordinates(inp.x, inp.y, cfg);
      setTarget(newCoords);

      // 2. Calculate IK
      const calculatedAngles = calculateIK(newCoords, cfg);
      
      // Gripper logic
      const isGripping = gest === HandGesture.PINCH;
      calculatedAngles.gripper = isGripping ? 100 : 0;
      setAngles(calculatedAngles);

      // 3. Ball Physics & Interaction
      const gripperVisX = BASE_X + (newCoords.x);
      const gripperVisY = BASE_Y - newCoords.y;

      setBalls(prevBalls => prevBalls.map(ball => {
        let { x, y, vx, vy, isGripped } = ball;

        // Interaction
        const dist = Math.hypot(x - gripperVisX, y - gripperVisY);
        const gripThreshold = 30;

        if (isGripping && dist < gripThreshold) {
          isGripped = true;
        } 
        if (!isGripping) {
          isGripped = false;
        }

        if (isGripped) {
          x = gripperVisX;
          y = gripperVisY + 15; // Hang slightly below gripper
          vx = 0;
          vy = 0;
        } else {
          // Gravity
          vy += 0.5; // gravity
          vx *= 0.95; // air drag
          
          y += vy;
          x += vx;

          // Floor collision
          if (y > BASE_Y - ball.radius) {
            y = BASE_Y - ball.radius;
            vy *= -0.6; // bounce
            vx *= 0.8; // friction
          }
          
          // Wall collision
          if (x < 0 || x > 600) vx *= -1;
        }

        return { ...ball, x, y, vx, vy, isGripped };
      }));
    };

    // Run physics at 30fps
    const physicsInterval = window.setInterval(updatePhysics, 33);
    return () => clearInterval(physicsInterval);

  }, []); // Empty dependency array = Stable Loop!

  // 4. Manual Fallback
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTab !== Tab.SIMULATION) return;
    if (gesture !== HandGesture.CLOSED_FIST && !isVisionReady) {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        // Update Ref directly
        inputPosRef.current = { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
    }
  };

  const handleMouseDown = () => {
     if (!isVisionReady) setGesture(HandGesture.PINCH);
  };
  const handleMouseUp = () => {
     if (!isVisionReady) setGesture(HandGesture.OPEN_PALM);
  };

  // 5. Code Gen
  const handleGenerateCode = async (notes: string) => {
    setIsGenerating(true);
    try {
      const code = await generateSystemCode(config, notes);
      setGeneratedCode(code);
    } catch (e) {
      alert("Failed to generate code.");
    } finally {
      setIsGenerating(false);
    }
  };

  // UI Helpers
  const getGestureStyle = () => {
    switch(gesture) {
       case HandGesture.CLOSED_FIST: 
          return { 
            bg: "bg-amber-500/10", 
            border: "border-amber-500/50", 
            text: "text-amber-500",
            shadow: "shadow-[0_0_20px_rgba(245,158,11,0.2)]",
            label: "SAFETY LOCK",
            sub: "Movement Halted",
            icon: <Lock size={24} />
          };
       case HandGesture.PINCH: 
          return { 
            bg: "bg-emerald-500/10", 
            border: "border-emerald-500/50", 
            text: "text-emerald-500",
            shadow: "shadow-[0_0_20px_rgba(16,185,129,0.2)]",
            label: "GRIP ACTIVE",
            sub: "Pinch to Hold",
            icon: <Hand size={24} />
          };
       case HandGesture.OPEN_PALM: 
          return { 
            bg: "bg-sky-500/10", 
            border: "border-sky-500/50", 
            text: "text-sky-500",
            shadow: "shadow-[0_0_20px_rgba(14,165,233,0.2)]",
            label: "TRACKING",
            sub: "Open Palm",
            icon: <MousePointer2 size={24} />
          };
       default: 
          return { 
            bg: "bg-slate-800/80", 
            border: "border-slate-700", 
            text: "text-slate-500",
            shadow: "shadow-none",
            label: "SEARCHING",
            sub: "No Hand Detected",
            icon: <ScanEye size={24} className="animate-pulse" />
          };
    }
 };

 const gs = getGestureStyle();

  return (
    <div className="h-screen w-screen bg-slate-950 flex flex-col font-sans text-slate-200">
      
      {/* Top Bar */}
      <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-3">
           <div className="h-8 w-8 bg-sky-600 rounded flex items-center justify-center shadow-lg shadow-sky-900/50">
             <Activity className="text-white" size={20} />
           </div>
           <div>
             <h1 className="font-bold text-white tracking-wide">ROBOARM <span className="text-sky-500">NEXUS</span></h1>
             <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Industrial AI Controller</p>
           </div>
        </div>

        <nav className="flex bg-slate-800 rounded p-1">
          <button 
            onClick={() => setActiveTab(Tab.SIMULATION)}
            className={`px-4 py-1.5 rounded text-sm font-medium transition-all ${activeTab === Tab.SIMULATION ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <div className="flex items-center gap-2"><LayoutDashboard size={14}/> Simulation</div>
          </button>
          <button 
            onClick={() => setActiveTab(Tab.CODE_GEN)}
            className={`px-4 py-1.5 rounded text-sm font-medium transition-all ${activeTab === Tab.CODE_GEN ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <div className="flex items-center gap-2"><Code size={14}/> Code Architect</div>
          </button>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden p-6 gap-6 flex">
        
        {/* Left Col: Main Interactive Area */}
        <section className="flex-1 flex flex-col gap-4 min-w-0">
          
          {activeTab === Tab.SIMULATION ? (
            <div 
              className="flex-1 bg-black rounded-xl border border-slate-800 overflow-hidden relative flex flex-col group select-none"
              onMouseMove={handleMouseMove}
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
            >
              {/* Webcam Feed & Canvas Overlay */}
              <div className="absolute inset-0 z-0 flex items-center justify-center bg-slate-900">
                {!isVisionReady && (
                   <div className="flex flex-col items-center gap-2 text-slate-500 animate-pulse">
                      <ScanEye size={32} />
                      <span className="text-xs">Initializing Neural Engine...</span>
                   </div>
                )}
                <video 
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="absolute inset-0 w-full h-full object-cover opacity-40 grayscale-[20%]"
                />
                <canvas 
                   ref={canvasRef}
                   width={640}
                   height={480}
                   className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/10 to-slate-900/10 pointer-events-none" />
              </div>

              {/* Enhanced Overlay UI */}
              <div className="absolute top-4 right-4 z-20 flex flex-col gap-3 min-w-[220px]">
                
                {/* Status Card */}
                <div className="bg-slate-900/90 backdrop-blur p-4 rounded-xl border border-slate-700 shadow-2xl">
                   <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Vision Engine</span>
                      <div className={`flex items-center gap-1.5 ${isVisionReady ? 'text-emerald-500' : 'text-amber-500'}`}>
                         <div className={`w-2 h-2 rounded-full ${isVisionReady ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></div>
                         <span className="text-[10px] font-bold">{isVisionReady ? 'ONLINE' : 'CONNECTING'}</span>
                      </div>
                   </div>

                   {/* Gesture Box */}
                   <div className={`flex items-center gap-3 p-3 rounded-lg border transition-all duration-300 ${gs.bg} ${gs.border} ${gs.text} ${gs.shadow}`}>
                      <div className="p-2 bg-black/20 rounded-full backdrop-blur-sm shrink-0">
                        {gs.icon}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-black tracking-widest leading-none mb-1">{gs.label}</span>
                        <span className="text-[10px] opacity-80 leading-none truncate">{gs.sub}</span>
                      </div>
                   </div>
                   
                   {/* Target Coordinates */}
                   <div className="grid grid-cols-2 gap-2 mt-3">
                      <div className="bg-slate-800/50 p-2 rounded border border-slate-700/50">
                        <span className="text-[9px] text-slate-500 block uppercase">Target X</span>
                        <span className="text-sm font-mono text-white">{target.x.toFixed(0)}</span>
                      </div>
                      <div className="bg-slate-800/50 p-2 rounded border border-slate-700/50">
                        <span className="text-[9px] text-slate-500 block uppercase">Target Y</span>
                        <span className="text-sm font-mono text-white">{target.y.toFixed(0)}</span>
                      </div>
                   </div>
                </div>

              </div>

              {/* Simulation Layer */}
              <div className={`flex-1 relative z-10 ${gesture === HandGesture.CLOSED_FIST ? 'cursor-not-allowed' : 'cursor-crosshair'}`}>
                <ArmSimulation angles={angles} config={config} target={target} balls={balls} />
              </div>
            </div>
          ) : (
            <div className="flex-1">
              <CodeViewer 
                code={generatedCode} 
                loading={isGenerating} 
                onGenerate={handleGenerateCode} 
              />
            </div>
          )}

        </section>

        {/* Right Col: Controls (Fixed Width) */}
        <aside className="w-80 shrink-0">
          <ControlPanel 
            config={config} 
            setConfig={setConfig} 
          />
        </aside>

      </main>
    </div>
  );
};

export default App;