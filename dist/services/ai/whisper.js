"use strict";
/**
 * Audio/Video Utilities
 * Provides audio extraction from video files using ffmpeg
 *
 * Note: SageMaker Whisper endpoint has been removed.
 * All transcription now uses Gemini via Vertex AI.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractAudioFromVideo = extractAudioFromVideo;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Extracts audio from video file using ffmpeg-static (bundled ffmpeg)
 *
 * @param videoPath - Path to video file
 * @param outputPath - Path where audio file should be saved
 * @returns Path to extracted audio file
 * @throws Error if ffmpeg fails
 */
async function extractAudioFromVideo(videoPath, outputPath) {
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
    }
    catch (error) {
        throw new Error(`Failed to extract audio from video: ${error?.message || 'Unknown error'}`);
    }
}
//# sourceMappingURL=whisper.js.map