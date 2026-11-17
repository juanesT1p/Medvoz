import { useCallback, useEffect, useRef, useState } from 'react';
import { toSpokenText } from '@medvoz/shared';
import { synthesizeSpeech } from '../api/prescriptions.js';

export type VoiceSource = 'cloud' | 'native';
export const VOICE_SPEEDS = [0.8, 1, 1.2] as const;

export function useVoicePlayer(text: string) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioUrlRef = useRef<string | null>(null);
  const nativeQueueRef = useRef<string[]>([]);
  const nativeIndexRef = useRef(0);
  const nativeOffsetRef = useRef(0);
  const [source, setSource] = useState<VoiceSource>('cloud');
  const [speed, setSpeed] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const clearAudioUrl = useCallback(() => {
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = null;
    if (audioRef.current) audioRef.current.removeAttribute('src');
  }, []);

  const stopNative = useCallback(() => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    nativeQueueRef.current = [];
    nativeIndexRef.current = 0;
    nativeOffsetRef.current = 0;
  }, []);

  const speakChunk = useCallback((chunk: string) => {
    const utterance = new SpeechSynthesisUtterance(chunk);
    utterance.rate = speed;
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find((candidate) => candidate.lang.toLowerCase() === 'es-co')
      ?? voices.find((candidate) => candidate.lang.toLowerCase() === 'es-419')
      ?? voices.find((candidate) => candidate.lang.toLowerCase() === 'es-es');
    utterance.lang = voice?.lang ?? 'es-CO';
    if (voice) utterance.voice = voice;
    utterance.onboundary = (event) => {
      if (event.name !== 'word' && event.name !== 'sentence') return;
      const spokenCharacters = nativeOffsetRef.current + event.charIndex;
      setCurrentTime(text.length === 0 ? 0 : spokenCharacters / text.length);
    };
    utterance.onend = () => {
      nativeOffsetRef.current += chunk.length + 1;
      nativeIndexRef.current += 1;
      const next = nativeQueueRef.current[nativeIndexRef.current];
      if (next) {
        speakChunk(next);
      } else {
        setPlaying(false);
        setCurrentTime(1);
      }
    };
    utterance.onerror = (event) => {
      if (event.error === 'canceled' || event.error === 'interrupted') return;
      setPlaying(false);
      setError('No se pudo reproducir la voz del navegador.');
    };
    window.speechSynthesis.speak(utterance);
  }, [speed, text.length]);

  const speakNative = useCallback(() => {
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
      setPlaying(false);
      setError('Este navegador no tiene una voz compatible disponible.');
      return;
    }
    stopNative();
    const spokenText = toSpokenText(text);
    const chunks = splitIntoPhrases(spokenText);
    if (chunks.length === 0) return;
    nativeQueueRef.current = chunks;
    setCurrentTime(0);
    setDuration(0);
    setError(null);
    setNotice('La voz nativa no ofrece una duración exacta; la barra muestra el avance aproximado.');
    setPlaying(true);
    speakChunk(chunks[0] ?? '');
  }, [speakChunk, stopNative, text]);

  const loadCloudAudio = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const blob = await synthesizeSpeech(text);
      clearAudioUrl();
      const url = URL.createObjectURL(blob);
      audioUrlRef.current = url;
      const audio = audioRef.current;
      if (!audio) throw new Error('Elemento de audio no disponible.');
      audio.src = url;
      audio.playbackRate = speed;
      await audio.play();
      setPlaying(true);
      setNotice(null);
    } catch {
      setSource('native');
      setNotice('El audio en la nube no está disponible; cambiamos a la voz nativa de tu dispositivo.');
      speakNative();
    } finally {
      setLoading(false);
    }
  }, [clearAudioUrl, speakNative, speed, text]);

  const toggle = useCallback(() => {
    setError(null);
    if (source === 'native') {
      if (!('speechSynthesis' in window)) {
        speakNative();
        return;
      }
      if (playing) window.speechSynthesis.pause();
      else if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        setPlaying(true);
      } else speakNative();
      if (playing) setPlaying(false);
      return;
    }

    const audio = audioRef.current;
    if (!audioUrlRef.current || !audio) {
      void loadCloudAudio();
      return;
    }
    if (audio.paused) void audio.play();
    else audio.pause();
  }, [loadCloudAudio, playing, source, speakNative]);

  const selectSource = useCallback((nextSource: VoiceSource) => {
    if (nextSource === source) return;
    stopNative();
    audioRef.current?.pause();
    setPlaying(false);
    setSource(nextSource);
    setNotice(nextSource === 'native' ? 'La voz nativa no ofrece una duración exacta; la barra muestra el avance aproximado.' : null);
  }, [source, stopNative]);

  const reset = useCallback(() => {
    if (source === 'native') {
      speakNative();
      return;
    }
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = 0;
      void audio.play();
    }
  }, [speakNative, source]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      setPlaying(false);
      setCurrentTime(audio.duration || 0);
    };
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);

  useEffect(() => {
    return () => {
      stopNative();
      clearAudioUrl();
    };
  }, [clearAudioUrl, stopNative]);

  return {
    audioRef,
    source,
    speed,
    setSpeed,
    loading,
    playing,
    currentTime,
    duration,
    error,
    notice,
    progress: duration > 0 ? Math.min(1, currentTime / duration) : currentTime,
    indeterminate: source === 'native' || duration === 0,
    toggle,
    reset,
    selectSource,
  };
}

function splitIntoPhrases(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .flatMap((phrase) => phrase.match(/.{1,180}(?:\s|$)/g) ?? [])
    .map((phrase) => phrase.trim())
    .filter(Boolean);
}
