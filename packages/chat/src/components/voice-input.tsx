import { splitProps, Show } from 'solid-js';
import { cn } from '../utils/cn';
import { Button } from '../ui/button';
import { Tooltip } from '../ui/tooltip';
import { useVoiceRecorder } from '../primitives/use-voice-recorder';

export interface VoiceInputProps {
  onTranscribe: (audio: Blob) => Promise<string>;
  onTranscription: (text: string) => void;
  disabled?: boolean;
  class?: string;
}

export function VoiceInput(props: VoiceInputProps) {
  const [local] = splitProps(props, ['onTranscribe', 'onTranscription', 'disabled', 'class']);
  const { isRecording, start, stop } = useVoiceRecorder();

  async function handleClick() {
    if (isRecording()) { stop(); }
    else {
      try {
        const blob = await start();
        const text = await local.onTranscribe(blob);
        if (text.trim()) local.onTranscription(text.trim());
      } catch { /* error in useVoiceRecorder */ }
    }
  }

  return (
    <Tooltip content={isRecording() ? 'Stop recording' : 'Voice input'}>
      <Button variant="ghost" size="icon-sm" onClick={handleClick} disabled={local.disabled}
        class={cn(isRecording() && 'text-red-400 animate-pulse', local.class)}>
        <Show when={isRecording()} fallback={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
        }>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6"/><path d="M17 16.95A7 7 0 015 12v-2m14 0v2c0 .76-.13 1.49-.35 2.17"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
        </Show>
      </Button>
    </Tooltip>
  );
}
