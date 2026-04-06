import { useRef, useState } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AudioRecorderProps {
  onAudioReady: (file: File) => void;
  disabled?: boolean;
}

export function AudioRecorder({ onAudioReady, disabled }: AudioRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isStartingRef = useRef(false);

  const toggleRecording = async () => {
    if (disabled || isStartingRef.current) return;

    if (recording) {
      // STOP RECORDING
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
            mediaRecorderRef.current.stop();
        } catch(e) { console.error('Error stopping recorder', e); }
      }
      setRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    // START RECORDING
    try {
      isStartingRef.current = true;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Fallback MIME types for broader browser support
      const types = ['audio/webm', 'audio/mp4', 'audio/ogg', ''];
      let mimeType = types[0];
      for (const t of types) {
          if (t === '' || MediaRecorder.isTypeSupported(t)) {
              mimeType = t;
              break;
          }
      }

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];

      recorder.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
        
        // Only send if we actually recorded something (e.g. at least 1 second)
        // Include duration in filename for parsing later
        const file = new File([blob], `audio_${seconds}s_${Date.now()}.webm`, { type: mimeType || 'audio/webm' });
        onAudioReady(file);
        setSeconds(0);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      isStartingRef.current = false;

      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } catch (err) {
      console.error('Microphone access denied:', err);
      isStartingRef.current = false;
    }
  };

  const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <button
      type="button"
      onClick={toggleRecording}
      disabled={disabled}
      title={recording ? 'Click to send' : 'Click to record voice message'}
      className={cn(
        'relative w-10 h-10 rounded-2xl flex items-center justify-center transition-all shrink-0',
        recording
          ? 'bg-red-500 text-white shadow-lg shadow-red-500/40 scale-110 animate-pulse'
          : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white border border-white/10',
        disabled && 'opacity-40 cursor-not-allowed'
      )}
    >
      {recording ? <Square size={14} /> : <Mic size={16} />}
      {recording && (
        <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-[10px] font-bold text-red-400 bg-[#070b14] px-2 py-0.5 rounded-full border border-red-500/30 whitespace-nowrap">
          {fmt(seconds)}
        </span>
      )}
    </button>
  );
}
