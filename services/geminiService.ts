import { GoogleGenAI, Type } from "@google/genai";
import { ArmConfig, GeneratedCode } from '../types';

export const generateSystemCode = async (
  config: ArmConfig, 
  userNotes: string
): Promise<GeneratedCode> => {
  
  // Initialize Gemini with the API key from environment variables.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Use 'gemini-3-pro-preview' for complex text/coding tasks.
  const model = "gemini-3-pro-preview";

  const prompt = `
    You are a Senior Robotics Engineer. I need full code for a 2-link robotic arm system using Computer Vision.
    
    System Specs:
    - Arm Dimensions (2-DOF Planar): 
      L1 (Shoulder)=${config.segment1Length}mm, L2 (Forearm)=${config.segment2Length}mm.
    - Hardware: Arduino/ESP32, 3 Servos (Base, Shoulder, Elbow, Gripper).
    - Host: Python script using MediaPipe for Hand Tracking.
    - Communication: Serial (USB).
    
    User Specific Requirements: ${userNotes}

    Please generate a JSON response with the following structure:
    {
      "python": "Full Python script code using cv2, mediapipe, serial. Uses 2-Link analytical IK.",
      "arduino": "Full C++ Arduino sketch code with Servo library and parsing logic",
      "explanation": "A brief Markdown summary of how the architecture works and safety failsafes."
    }
    
    Ensure the Python code includes:
    1. MediaPipe Hands initialization.
    2. Logic to map hand landmarks to XYZ coordinates.
    3. **Gesture Recognition Logic**:
       - **Pinch**: Close Gripper.
       - **Open Palm**: Open Gripper.
       - **Fist**: Stop/Lock.
    4. Serial data transmission formatted as "BASE,SHOULDER,ELBOW,GRIPPER\\n".
    5. Analytical Inverse Kinematics for 2 segments (Law of cosines).
    
    Ensure the Arduino code includes:
    1. Servo object initialization for 4 servos.
    2. Parsing logic to accept comma-separated angles.
    3. Interpolation/Smoothing logic for fluid motion.
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            python: { type: Type.STRING },
            arduino: { type: Type.STRING },
            explanation: { type: Type.STRING }
          },
          required: ["python", "arduino", "explanation"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");

    return JSON.parse(text) as GeneratedCode;
  } catch (error) {
    console.error("Gemini Generation Error:", error);
    throw new Error("Failed to generate code.");
  }
};