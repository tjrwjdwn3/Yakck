import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface PillAnalysis {
  shape: string;
  color: string;
  markings: string;
  formulation: string;
  possibleNames: string[];
  description: string;
}

export async function analyzePillImage(images: string[], manualMarkings?: string): Promise<PillAnalysis> {
  const imageParts = images.map(img => ({
    inlineData: {
      mimeType: "image/jpeg",
      data: img.split(",")[1] || img
    }
  }));

  const markingPrompt = manualMarkings ? `The user manually noted these markings on the pill: "${manualMarkings}". Use this to improve identification accuracy.` : "";

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          {
            text: `Analyze these pill images (front and back if provided). Identify its visual characteristics precisely. 
            ${markingPrompt}
            Return the result in JSON format with the following fields:
            - shape: (e.g., round, oval, capsule, triangle, etc.)
            - color: (e.g., white, yellow, blue, multi-colored, transparent)
            - markings: (any text, numbers, or logos visible on the pill)
            - formulation: (e.g., tablet, soft gel, hard capsule)
            - possibleNames: (an array of potential drug names in Korean)
            - description: (a brief description of the pill in Korean)
            
            CRITICAL SEARCH PRIORITY:
            1. PRIMARY SOURCE: Match against KPTIC (약학정보원, www.health.kr) official drug database. This is the absolute highest priority.
            2. SECONDARY SOURCE: Match against MFDS (식품의약품안전처) official drug database.
            3. TERTIARY SOURCE: Supplement with HIRA (건강보험심사평가원) data.
            4. COLOR ANALYSIS: Distinguish precisely between similar colors (e.g., light yellow vs. dark yellow, transparent vs. white, multi-colored pills).
            5. SHAPE ANALYSIS: Identify specific shapes (e.g., oblong, circular, hexagonal, triangular) to narrow down candidates.
            6. MARKING ANALYSIS: Carefully read any text, numbers, or logos engraved on the pill.
            
            Focus on accuracy by combining information from all provided images.
            Provide the most likely Korean drug names found in official records, specifically prioritizing those listed in the Korea Pharmaceutical Information Center (약학정보원).`
          },
          ...imageParts
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          shape: { type: Type.STRING },
          color: { type: Type.STRING },
          markings: { type: Type.STRING },
          formulation: { type: Type.STRING },
          possibleNames: { 
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          description: { type: Type.STRING }
        },
        required: ["shape", "color", "markings", "formulation", "possibleNames", "description"]
      }
    }
  });

  try {
    return JSON.parse(response.text || "{}");
  } catch (e) {
    console.error("Failed to parse Gemini response", e);
    throw new Error("분석 결과를 처리하는 중 오류가 발생했습니다.");
  }
}

export interface DrugDetail {
  name: string;
  manufacturer: string;
  efficacy: string;
  usage: string;
  precautions: string;
  appearance: string;
  imageUrl?: string;
}

export async function getDrugDetail(drugName: string): Promise<DrugDetail> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Provide detailed information about the Korean drug named "${drugName}". 
    Include manufacturer, efficacy (효능), usage (용법), precautions (주의사항), and visual appearance description.
    Also, provide a direct image URL from MFDS (식약처) or a reliable medical database if available. If not, provide a placeholder search URL for the image.
    Return the result in JSON format with fields: name, manufacturer, efficacy, usage, precautions, appearance, imageUrl.
    Use Korean for all values except imageUrl.`
    ,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          manufacturer: { type: Type.STRING },
          efficacy: { type: Type.STRING },
          usage: { type: Type.STRING },
          precautions: { type: Type.STRING },
          appearance: { type: Type.STRING },
          imageUrl: { type: Type.STRING }
        },
        required: ["name", "manufacturer", "efficacy", "usage", "precautions", "appearance"]
      }
    }
  });

  try {
    return JSON.parse(response.text || "{}");
  } catch (e) {
    console.error("Failed to parse drug detail", e);
    throw new Error("의약품 상세 정보를 가져오는 중 오류가 발생했습니다.");
  }
}
