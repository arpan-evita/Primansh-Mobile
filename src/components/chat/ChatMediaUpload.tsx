import { useRef } from 'react';
import { Paperclip, Image, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatMediaUploadProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
  uploadProgress?: number | null;
}

const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'audio/webm', 'audio/mp4', 'audio/mpeg',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip', 'text/plain',
];

export function ChatMediaUpload({ onFileSelected, disabled, uploadProgress }: ChatMediaUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      alert('File type not supported. Please upload an image, audio, PDF, or document.');
      return;
    }
    onFileSelected(file);
    e.target.value = '';
  };

  return (
    <div className="relative flex items-center">
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_TYPES.join(',')}
        onChange={handleChange}
        className="hidden"
        disabled={disabled}
      />

      {uploadProgress !== null && uploadProgress !== undefined ? (
        <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
          <Loader2 size={16} className="text-blue-400 animate-spin" />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          title="Attach file or image"
          className={cn(
            'w-10 h-10 rounded-2xl flex items-center justify-center transition-all shrink-0',
            'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white border border-white/10',
            disabled && 'opacity-40 cursor-not-allowed'
          )}
        >
          <Paperclip size={16} />
        </button>
      )}
    </div>
  );
}
