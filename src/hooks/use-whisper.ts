"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface UseWhisperOptions {
  onTranscript?: (text: string) => void;
  onError?: (error: string) => void;
}

interface UseWhisperReturn {
  isRecording: boolean;
  isTranscribing: boolean;
  isSupported: boolean;
  startRecording: () => void;
  stopRecording: () => Promise<string | null>;
  toggleRecording: () => void;
  cancelRecording: () => void;
}

/**
 * Hook for recording audio and transcribing with OpenAI Whisper
 */
export function useWhisper(options: UseWhisperOptions = {}): UseWhisperReturn {
  const { onTranscript, onError } = options;

  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const isProcessingRef = useRef(false);

  // Check for MediaRecorder support
  useEffect(() => {
    const supported =
      typeof window !== "undefined" &&
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof MediaRecorder !== "undefined";
    console.log("[useWhisper] Support check:", { supported });
    setIsSupported(supported);
  }, []);

  // Process recorded audio and send to Whisper
  const processAudio = useCallback(async (mimeType: string): Promise<string | null> => {
    if (isProcessingRef.current) {
      console.log("[useWhisper] Already processing, skipping");
      return null;
    }
    isProcessingRef.current = true;

    const chunks = [...chunksRef.current];
    chunksRef.current = [];

    console.log("[useWhisper] processAudio called", { chunksCount: chunks.length, mimeType });

    // Clean up stream
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;

    if (chunks.length === 0) {
      console.log("[useWhisper] No audio chunks");
      onError?.("No audio recorded. Please try again.");
      isProcessingRef.current = false;
      return null;
    }

    // Create audio blob
    const audioBlob = new Blob(chunks, { type: mimeType || "audio/webm" });
    console.log("[useWhisper] Created blob", { size: audioBlob.size, type: audioBlob.type });

    if (audioBlob.size < 1000) {
      console.log("[useWhisper] Audio too short");
      onError?.("Recording too short. Please speak for at least 2 seconds.");
      isProcessingRef.current = false;
      return null;
    }

    // Send to Whisper API
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      const ext = mimeType.includes("webm") ? "webm" : mimeType.includes("mp4") ? "m4a" : "webm";
      formData.append("audio", audioBlob, `recording.${ext}`);

      console.log("[useWhisper] Sending to /api/transcribe...");

      // Add timeout for API call (30 seconds)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log("[useWhisper] Response:", response.status);

      if (!response.ok) {
        // Try to parse error, but handle HTML error pages gracefully
        let errorMessage = "Transcription failed";
        const contentType = response.headers.get("content-type");
        if (contentType?.includes("application/json")) {
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch {
            // Ignore JSON parse errors
          }
        }
        throw new Error(errorMessage);
      }

      // Check content type before parsing
      const contentType = response.headers.get("content-type");
      if (!contentType?.includes("application/json")) {
        throw new Error("Invalid response from server");
      }

      const data = await response.json();
      const transcript = data.text || "";
      console.log("[useWhisper] Transcript:", transcript);

      onTranscript?.(transcript);
      return transcript;
    } catch (error) {
      console.error("[useWhisper] Error:", error);
      onError?.(error instanceof Error ? error.message : "Transcription failed");
      return null;
    } finally {
      setIsTranscribing(false);
      isProcessingRef.current = false;
    }
  }, [onTranscript, onError]);

  const startRecording = useCallback(async () => {
    console.log("[useWhisper] startRecording", { isSupported, isRecording });
    if (!isSupported || isRecording || isProcessingRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Find supported mimeType
      const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", ""];
      let mimeType = "";
      for (const t of types) {
        if (t === "" || MediaRecorder.isTypeSupported(t)) {
          mimeType = t;
          break;
        }
      }

      console.log("[useWhisper] Using mimeType:", mimeType || "default");

      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      // Collect data when available
      mediaRecorder.ondataavailable = (e) => {
        console.log("[useWhisper] ondataavailable", { size: e.data.size });
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      // Process when stopped
      mediaRecorder.onstop = () => {
        console.log("[useWhisper] onstop event fired");
        const mt = mediaRecorder.mimeType || mimeType || "audio/webm";
        processAudio(mt);
      };

      mediaRecorder.start();
      setIsRecording(true);
      console.log("[useWhisper] Recording started");
    } catch (error) {
      console.error("[useWhisper] Failed to start:", error);
      onError?.("Failed to access microphone.");
    }
  }, [isSupported, isRecording, onError, processAudio]);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    console.log("[useWhisper] stopRecording", {
      hasRecorder: !!mediaRecorderRef.current,
      state: mediaRecorderRef.current?.state,
    });

    setIsRecording(false);

    const mediaRecorder = mediaRecorderRef.current;
    if (!mediaRecorder) {
      console.log("[useWhisper] No recorder");
      return null;
    }

    if (mediaRecorder.state === "recording") {
      console.log("[useWhisper] Stopping recorder...");
      mediaRecorder.stop();
      // onstop handler will call processAudio
    } else {
      console.log("[useWhisper] Recorder not recording, state:", mediaRecorder.state);
      // Already stopped, process whatever we have
      const mt = mediaRecorder.mimeType || "audio/webm";
      return processAudio(mt);
    }

    return null;
  }, [processAudio]);

  const toggleRecording = useCallback(() => {
    console.log("[useWhisper] toggle", { isRecording });
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // Cancel recording without processing (discards audio)
  const cancelRecording = useCallback(() => {
    console.log("[useWhisper] cancelRecording");
    setIsRecording(false);

    // Stop media recorder without triggering processAudio
    const mediaRecorder = mediaRecorderRef.current;
    if (mediaRecorder && mediaRecorder.state === "recording") {
      // Remove onstop handler to prevent processing
      mediaRecorder.onstop = null;
      mediaRecorder.stop();
    }

    // Clean up
    chunksRef.current = [];
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return {
    isRecording,
    isTranscribing,
    isSupported,
    startRecording,
    stopRecording,
    toggleRecording,
    cancelRecording,
  };
}
