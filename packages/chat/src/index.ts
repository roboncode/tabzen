// Utilities
export { cn } from './utils/cn';

// Layer 1: Headless Primitives
export { useAutoResize } from './primitives/use-auto-resize';
export { useStickToBottom } from './primitives/use-stick-to-bottom';
export { useTextStream } from './primitives/use-text-stream';
export type { UseTextStreamOptions, TextStreamSegment } from './primitives/use-text-stream';
export { useVoiceRecorder } from './primitives/use-voice-recorder';
export type { UseVoiceRecorderOptions } from './primitives/use-voice-recorder';

// Layer 2: UI Primitives
export { Button, buttonVariants } from './ui/button';
export type { ButtonProps } from './ui/button';
export { Avatar } from './ui/avatar';
export type { AvatarProps } from './ui/avatar';
export { Tooltip } from './ui/tooltip';
export { HoverCard } from './ui/hover-card';
export { Collapsible, CollapsibleTrigger, CollapsibleContent } from './ui/collapsible';
export { ScrollArea } from './ui/scroll-area';
export { Dropdown, DropdownTrigger, DropdownContent, DropdownItem } from './ui/dropdown';
export { Textarea } from './ui/textarea';
export type { TextareaProps } from './ui/textarea';
export { Badge } from './ui/badge';
export type { BadgeProps } from './ui/badge';
export { Separator } from './ui/separator';
export { Dialog, DialogTrigger, DialogContent } from './ui/dialog';

// Layer 3: AI/Feature Components
export { ChatContainer, useChatContainer } from './components/chat-container';
export { Message, MessageAvatar, MessageContent, MessageActions, MessageAction } from './components/message';
export { PromptInput } from './components/prompt-input';
export { ResponseStream } from './components/response-stream';
export { Markdown } from './components/markdown';
export { CodeBlock } from './components/code-block';
export { Loader } from './components/loader';
export { FeedbackBar } from './components/feedback-bar';
export { ChainOfThought, ChainOfThoughtStep, ChainOfThoughtTrigger, ChainOfThoughtItemContent } from './components/chain-of-thought';
export { Source, SourceTrigger, SourceList } from './components/source';
export { PromptSuggestion } from './components/prompt-suggestion';
export { ScrollButton } from './components/scroll-button';
export { Checkpoint, CheckpointIcon, CheckpointTrigger } from './components/checkpoint';
export { Context } from './components/context';
export { VoiceInput } from './components/voice-input';
export { ConversationList } from './components/conversation-list';
export { ConversationItem } from './components/conversation-item';
export { ModelSwitcher } from './components/model-switcher';
export { ChatScopePicker } from './components/chat-scope-picker';
