import {useCallback, useEffect, useRef, useState} from 'react';

/* -------------------------------------------------------------------------- *
 * Native voice search via the browser's Web Speech API (SpeechRecognition).
 * No library, no API key, no cost. Feature-detected — callers only render the
 * mic when `supported` is true, so unsupported browsers (e.g. Firefox) never
 * see a dead button. Recognition itself is browser-provided (Chrome streams to
 * Google, Safari may run on-device); we only read the transcript it returns.
 * -------------------------------------------------------------------------- */

// Minimal structural types for the parts of the Web Speech API we touch, so we
// avoid `any` without pulling in the full lib.dom speech typings.
interface SpeechResultAlternative {
  transcript: string;
}
interface SpeechResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechResultAlternative;
}
interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: ArrayLike<SpeechResult>;
}
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export function useVoiceSearch({
  onResult,
  onInterim,
  lang = 'en-US',
}: {
  /** Called with the final transcript when the user stops speaking. */
  onResult: (text: string) => void;
  /** Called with the live (interim) transcript while speaking, if provided. */
  onInterim?: (text: string) => void;
  lang?: string;
}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  // Detect support on the client (SSR has no window).
  useEffect(() => {
    setSupported(Boolean(getRecognitionCtor()));
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    recognitionRef.current?.abort();

    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.interimResults = Boolean(onInterim);
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      let final = '';
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) final += result[0].transcript;
        else interim += result[0].transcript;
      }
      if (interim && onInterim) onInterim(interim);
      if (final) onResult(final.trim());
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, [lang, onInterim, onResult]);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  // Abort any in-flight recognition on unmount.
  useEffect(() => () => recognitionRef.current?.abort(), []);

  return {supported, listening, start, stop, toggle};
}

function MicIcon({className}: {className?: string}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

/** Mic toggle button for the search bars. Pulses brand-green while listening. */
export function MicButton({
  listening,
  onToggle,
  className,
}: {
  listening: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      onMouseDown={(e) => e.preventDefault()}
      aria-label={listening ? 'Stop voice search' : 'Search by voice'}
      aria-pressed={listening}
      className={`grid shrink-0 place-items-center rounded-xl transition-colors ${
        listening
          ? 'animate-pulse bg-red-50 text-red-600'
          : 'text-ink hover:bg-mint'
      } ${className ?? ''}`}
    >
      <MicIcon className="h-4 w-4" />
    </button>
  );
}
