import { FilesetResolver, HandLandmarker, HandLandmarkerResult } from "@mediapipe/tasks-vision";
import { HandGesture } from "../types";

let handLandmarker: HandLandmarker | undefined;
let isLoading = false;

export const initializeVision = async (): Promise<boolean> => {
  if (handLandmarker) return true;
  if (isLoading) return false;

  isLoading = true;
  try {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm"
    );
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
        delegate: "GPU"
      },
      runningMode: "VIDEO",
      numHands: 1,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5
    });
    return true;
  } catch (e) {
    console.error("Failed to initialize vision:", e);
    return false;
  } finally {
    isLoading = false;
  }
};

export const detectHands = (video: HTMLVideoElement, timestamp: number): HandLandmarkerResult | null => {
  if (!handLandmarker) return null;
  return handLandmarker.detectForVideo(video, timestamp);
};

export const analyzeGesture = (landmarks: any[]): HandGesture => {
  if (!landmarks || landmarks.length === 0) return HandGesture.NONE;

  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const wrist = landmarks[0];

  // Calculate Pinch Distance (Thumb Tip to Index Tip)
  const pinchDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
  
  // Calculate "Folded" status for Fist detection
  // We check if finger tips are close to the wrist
  // Indices for tips: 8 (Index), 12 (Middle), 16 (Ring), 20 (Pinky)
  const tips = [8, 12, 16, 20];
  let foldedCount = 0;
  
  for (const idx of tips) {
    // Distance from tip to wrist
    const dist = Math.hypot(landmarks[idx].x - wrist.x, landmarks[idx].y - wrist.y);
    // Threshold depends on hand size/depth, but 0.15 is a reasonable normalized heuristic for "curled"
    if (dist < 0.25) { // Relaxed threshold for web
        foldedCount++;
    }
  }

  // Priority Logic:
  // 1. Fist (Safety/Lock) - if 3 or more fingers are folded
  if (foldedCount >= 3) {
      return HandGesture.CLOSED_FIST;
  }

  // 2. Pinch (Action/Grip) - if index and thumb are close
  if (pinchDist < 0.05) {
      return HandGesture.PINCH;
  }

  // 3. Default
  return HandGesture.OPEN_PALM;
};

// Simple skeleton drawing helper
export const drawLandmarks = (ctx: CanvasRenderingContext2D, landmarks: any[]) => {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  
  ctx.fillStyle = "#38bdf8"; // Sky blue points
  ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
  ctx.lineWidth = 2;

  // Connections
  const connections = [
    [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
    [0, 5], [5, 6], [6, 7], [7, 8], // Index
    [0, 9], [9, 10], [10, 11], [11, 12], // Middle
    [0, 13], [13, 14], [14, 15], [15, 16], // Ring
    [0, 17], [17, 18], [18, 19], [19, 20] // Pinky
  ];

  // Draw Lines
  connections.forEach(([i, j]) => {
     const p1 = landmarks[i];
     const p2 = landmarks[j];
     ctx.beginPath();
     ctx.moveTo(p1.x * ctx.canvas.width, p1.y * ctx.canvas.height);
     ctx.lineTo(p2.x * ctx.canvas.width, p2.y * ctx.canvas.height);
     ctx.stroke();
  });

  // Draw Points
  landmarks.forEach((p: any) => {
    ctx.beginPath();
    ctx.arc(p.x * ctx.canvas.width, p.y * ctx.canvas.height, 3, 0, 2 * Math.PI);
    ctx.fill();
  });
};