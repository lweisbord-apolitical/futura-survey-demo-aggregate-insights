import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

// Force Node.js runtime (not Edge) for OpenAI SDK
export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * POST /api/transcribe
 * Transcribe audio using OpenAI Whisper
 */
export async function POST(request: NextRequest) {
  console.log("[Transcribe API] Request received");

  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File | null;

    console.log("[Transcribe API] Audio file:", {
      exists: !!audioFile,
      name: audioFile?.name,
      size: audioFile?.size,
      type: audioFile?.type
    });

    if (!audioFile) {
      return NextResponse.json(
        { error: "No audio file provided" },
        { status: 400 }
      );
    }

    console.log("[Transcribe API] Calling OpenAI Whisper...");

    // Call OpenAI Whisper API
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      language: "en",
    });

    console.log("[Transcribe API] Transcription result:", transcription.text);

    return NextResponse.json({
      text: transcription.text,
    });
  } catch (error) {
    console.error("[Transcribe API] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to transcribe audio",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
