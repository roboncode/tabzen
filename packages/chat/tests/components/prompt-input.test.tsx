import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import { PromptInput } from '../../src/components/prompt-input';

describe('PromptInput', () => {
  it('renders textarea with placeholder', () => {
    render(() => <PromptInput placeholder="Type here..." onSubmit={() => {}} />);
    expect(screen.getByPlaceholderText('Type here...')).toBeTruthy();
  });

  it('calls onSubmit when Enter is pressed without Shift', async () => {
    const onSubmit = vi.fn();
    render(() => <PromptInput placeholder="Type..." onSubmit={onSubmit} />);
    const textarea = screen.getByPlaceholderText('Type...');
    await fireEvent.input(textarea, { target: { value: 'Hello' } });
    await fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    expect(onSubmit).toHaveBeenCalledWith('Hello');
  });

  it('does not submit on Shift+Enter', async () => {
    const onSubmit = vi.fn();
    render(() => <PromptInput placeholder="Type..." onSubmit={onSubmit} />);
    const textarea = screen.getByPlaceholderText('Type...');
    await fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
