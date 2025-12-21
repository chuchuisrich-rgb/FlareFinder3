import React, { useState } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';

interface VoiceRecorderProps {
  onTranscription: (text: string) => void;
  isProcessing?: boolean;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onTranscription, isProcessing = false }) => {
  const [isRecording, setIsRecording] = useState(false);

  const startRecording = () => {
    // @ts-ignore - Web Speech API
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice recognition not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsRecording(true);
    
    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      onTranscription(text);
      setIsRecording(false);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      if (event.error === 'not-allowed') {
        alert("Microphone access denied. Please allow microphone permissions in your browser settings to use voice features.");
      } else if (event.error === 'no-speech') {
        // Ignore no-speech errors (user just didn't say anything)
      } else {
        alert(`Voice error: ${event.error}`);
      }
      setIsRecording(false);
    };

    recognition.onend = () => setIsRecording(false);

    try {
      recognition.start();
    } catch (e) {
      console.error("Failed to start recognition", e);
      setIsRecording(false);
    }
  };

  return (
    <button
      onClick={startRecording}
      disabled={isRecording || isProcessing}
      className={`p-3 rounded-full transition-all shadow-md flex items-center justify-center ${
        isRecording 
          ? 'bg-rose-500 text-white animate-pulse shadow-rose-200' 
          : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'
      } disabled:opacity-50 disabled:cursor-not-allowed`}
      title="Tap to speak"
    >
      {isProcessing ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : isRecording ? (
        <Square className="w-5 h-5" />
      ) : (
        <Mic className="w-5 h-5" />
      )}
    </button>
  );
};