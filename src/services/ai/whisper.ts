/**
 * Audio/Video Utilities
 * Provides audio extraction from video files using ffmpeg
 * 
 * Note: SageMaker Whisper endpoint has been removed.
 * All transcription now uses Gemini via Vertex AI.
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Extracts audio from video file using ffmpeg-static (bundled ffmpeg)
 * 
 * @param videoPath - Path to video file
 * @param outputPath - Path where audio file should be saved
 * @returns Path to extracted audio file
 * @throws Error if ffmpeg fails
 */
export async function extractAudioFromVideo(
  videoPath: string,
  outputPath: string
): Promise<string> {
  const { execFile } = require('child_process');
  const { promisify } = require('util');
  const execFileAsync = promisify(execFile);
  
  // Use bundled ffmpeg-static instead of system ffmpeg
  const ffmpegPath = require('ffmpeg-static');

  try {
    // Use ffmpeg to extract audio as WAV format (best for Whisper)
    const args = [
      '-i', videoPath,
      '-vn',
      '-acodec', 'pcm_s16le',
      '-ar', '16000',
      '-ac', '1',
      '-y', // Overwrite output file if exists
      outputPath
    ];
    
    console.log(`[Audio Extraction] Extracting audio from video: ${path.basename(videoPath)}`);
    console.log(`[Audio Extraction] Using ffmpeg at: ${ffmpegPath}`);
    
    await execFileAsync(ffmpegPath, args);
    
    if (!fs.existsSync(outputPath)) {
      throw new Error('Audio file was not created');
    }

    console.log(`[Audio Extraction] Audio extracted successfully: ${path.basename(outputPath)}`);
    
    return outputPath;
  } catch (error: any) {
    throw new Error(`Failed to extract audio from video: ${error?.message || 'Unknown error'}`);
  }
}
