/**
 * Audio/Video Utilities
 * Provides audio extraction from video files using ffmpeg
 *
 * Note: SageMaker Whisper endpoint has been removed.
 * All transcription now uses Gemini via Vertex AI.
 */
/**
 * Extracts audio from video file using ffmpeg-static (bundled ffmpeg)
 *
 * @param videoPath - Path to video file
 * @param outputPath - Path where audio file should be saved
 * @returns Path to extracted audio file
 * @throws Error if ffmpeg fails
 */
export declare function extractAudioFromVideo(videoPath: string, outputPath: string): Promise<string>;
//# sourceMappingURL=whisper.d.ts.map