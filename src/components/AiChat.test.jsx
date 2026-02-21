import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import AiChat from './AiChat.jsx';

// Mock scrollIntoView
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

describe('AiChat', () => {
  // --- Story 1: Right-side sliding sidebar layout ---
  describe('sidebar layout', () => {
    it('renders the toggle button when closed', () => {
      render(<AiChat onSubmit={vi.fn()} isLoading={false} progress={null} />);
      expect(screen.getByTestId('ai-chat-toggle')).toBeInTheDocument();
      expect(screen.queryByTestId('ai-chat-panel')).not.toBeInTheDocument();
    });

    it('toggle button is positioned bottom-right', () => {
      render(<AiChat onSubmit={vi.fn()} isLoading={false} progress={null} />);
      const toggle = screen.getByTestId('ai-chat-toggle');
      expect(toggle.style.position).toBe('fixed');
      expect(toggle.style.bottom).toBeTruthy();
      expect(toggle.style.right).toBeTruthy();
    });

    it('opens the sidebar panel when toggle is clicked', () => {
      render(<AiChat onSubmit={vi.fn()} isLoading={false} progress={null} />);
      fireEvent.click(screen.getByTestId('ai-chat-toggle'));
      const panel = screen.getByTestId('ai-chat-panel');
      expect(panel).toBeInTheDocument();
      expect(panel.style.position).toBe('fixed');
      expect(panel.style.right).toBe('0px');
      expect(panel.style.top).toBe('0px');
      expect(panel.style.height).toBe('100vh');
      expect(panel.style.width).toBe('380px');
    });

    it('closes the panel when close button is clicked', () => {
      render(<AiChat onSubmit={vi.fn()} isLoading={false} progress={null} />);
      fireEvent.click(screen.getByTestId('ai-chat-toggle'));
      expect(screen.getByTestId('ai-chat-panel')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('ai-chat-close'));
      expect(screen.queryByTestId('ai-chat-panel')).not.toBeInTheDocument();
    });

    it('closes the sidebar when Escape is pressed', () => {
      render(<AiChat onSubmit={vi.fn()} isLoading={false} progress={null} />);
      fireEvent.click(screen.getByTestId('ai-chat-toggle'));
      expect(screen.getByTestId('ai-chat-panel')).toBeInTheDocument();
      fireEvent.keyDown(screen.getByTestId('ai-chat-panel'), { key: 'Escape' });
      expect(screen.queryByTestId('ai-chat-panel')).not.toBeInTheDocument();
    });

    it('sidebar has left border and shadow', () => {
      render(<AiChat onSubmit={vi.fn()} isLoading={false} progress={null} />);
      fireEvent.click(screen.getByTestId('ai-chat-toggle'));
      const panel = screen.getByTestId('ai-chat-panel');
      expect(panel.style.borderLeft).toBeTruthy();
      expect(panel.style.boxShadow).toBeTruthy();
    });
  });

  // --- Story 2: Professional header with controls ---
  describe('header', () => {
    it('shows AI Assistant title', () => {
      render(<AiChat onSubmit={vi.fn()} isLoading={false} progress={null} />);
      fireEvent.click(screen.getByTestId('ai-chat-toggle'));
      expect(screen.getByText(/AI Assistant/)).toBeInTheDocument();
    });

    it('has + New button that clears conversation', () => {
      const onNewConversation = vi.fn();
      render(<AiChat onSubmit={vi.fn()} isLoading={false} progress={null} onNewConversation={onNewConversation} />);
      fireEvent.click(screen.getByTestId('ai-chat-toggle'));
      fireEvent.click(screen.getByTestId('ai-chat-new'));
      expect(onNewConversation).toHaveBeenCalled();
    });

    it('disables + New button while loading', () => {
      render(<AiChat onSubmit={vi.fn()} isLoading={true} progress={null} />);
      fireEvent.click(screen.getByTestId('ai-chat-toggle'));
      expect(screen.getByTestId('ai-chat-new')).toBeDisabled();
    });

    it('applies hover style to toggle button', () => {
      render(<AiChat onSubmit={vi.fn()} isLoading={false} progress={null} />);
      const toggle = screen.getByTestId('ai-chat-toggle');
      fireEvent.mouseEnter(toggle);
      expect(toggle.style.background).toBe('rgb(67, 56, 202)');
      fireEvent.mouseLeave(toggle);
      expect(toggle.style.background).toBe('rgb(79, 70, 229)');
    });

    it('applies hover style to close button', () => {
      render(<AiChat onSubmit={vi.fn()} isLoading={false} progress={null} />);
      fireEvent.click(screen.getByTestId('ai-chat-toggle'));
      const close = screen.getByTestId('ai-chat-close');
      fireEvent.mouseEnter(close);
      expect(close.style.background).toBe('rgb(243, 244, 246)');
      fireEvent.mouseLeave(close);
      expect(close.style.background).toBe('transparent');
    });

    it('applies hover style to + New button', () => {
      render(<AiChat onSubmit={vi.fn()} isLoading={false} progress={null} />);
      fireEvent.click(screen.getByTestId('ai-chat-toggle'));
      const newBtn = screen.getByTestId('ai-chat-new');
      fireEvent.mouseEnter(newBtn);
      expect(newBtn.style.background).toBe('rgb(238, 242, 255)');
      fireEvent.mouseLeave(newBtn);
      expect(newBtn.style.background).toBe('transparent');
    });
  });

  // --- Story 3: Polished message bubbles ---
  describe('messages', () => {
    it('shows placeholder hint when no messages', () => {
      render(<AiChat onSubmit={vi.fn()} isLoading={false} progress={null} />);
      fireEvent.click(screen.getByTestId('ai-chat-toggle'));
      expect(screen.getByText(/SWOT analysis/)).toBeInTheDocument();
    });

    it('shows messages passed as props', () => {
      const messages = [
        { role: 'user', text: 'Create a sticky note' },
        { role: 'assistant', text: 'Done! Created a note.' },
      ];
      render(<AiChat onSubmit={vi.fn()} isLoading={false} progress={null} messages={messages} />);
      fireEvent.click(screen.getByTestId('ai-chat-toggle'));
      expect(screen.getByText('Create a sticky note')).toBeInTheDocument();
      expect(screen.getByText('Done! Created a note.')).toBeInTheDocument();
    });

    it('user messages have indigo background', () => {
      const messages = [{ role: 'user', text: 'Test' }];
      render(<AiChat onSubmit={vi.fn()} isLoading={false} progress={null} messages={messages} />);
      fireEvent.click(screen.getByTestId('ai-chat-toggle'));
      const userMsg = screen.getByText('Test');
      expect(userMsg.style.background).toBe('rgb(79, 70, 229)');
      expect(userMsg.style.color).toBe('rgb(255, 255, 255)');
    });

    it('assistant messages have gray background', () => {
      const messages = [{ role: 'assistant', text: 'Reply' }];
      render(<AiChat onSubmit={vi.fn()} isLoading={false} progress={null} messages={messages} />);
      fireEvent.click(screen.getByTestId('ai-chat-toggle'));
      const assistantMsg = screen.getByText('Reply').closest('[style*="background"]');
      expect(assistantMsg.style.background).toBe('rgb(243, 244, 246)');
      expect(assistantMsg.style.color).toBe('rgb(31, 41, 55)');
    });

    it('auto-scrolls when messages change', () => {
      const { rerender } = render(<AiChat onSubmit={vi.fn()} isLoading={false} progress={null} messages={[]} />);
      fireEvent.click(screen.getByTestId('ai-chat-toggle'));
      Element.prototype.scrollIntoView.mockClear();
      const messages = [{ role: 'assistant', text: 'Response' }];
      rerender(<AiChat onSubmit={vi.fn()} isLoading={false} progress={null} messages={messages} />);
      expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    });
  });

  // --- Story 4: Enhanced input area ---
  describe('input area', () => {
    it('renders a textarea instead of a text input', () => {
      render(<AiChat onSubmit={vi.fn()} isLoading={false} progress={null} />);
      fireEvent.click(screen.getByTestId('ai-chat-toggle'));
      const textarea = screen.getByTestId('ai-chat-input');
      expect(textarea.tagName).toBe('TEXTAREA');
    });

    it('calls onSubmit with the input text and clears textarea', () => {
      const onSubmit = vi.fn();
      render(<AiChat onSubmit={onSubmit} isLoading={false} progress={null} />);
      fireEvent.click(screen.getByTestId('ai-chat-toggle'));
      const textarea = screen.getByTestId('ai-chat-input');
      fireEvent.change(textarea, { target: { value: 'Create a sticky note' } });
      fireEvent.click(screen.getByTestId('ai-chat-send'));
      expect(onSubmit).toHaveBeenCalledWith('Create a sticky note');
      expect(textarea.value).toBe('');
    });

    it('Enter key submits the form', () => {
      const onSubmit = vi.fn();
      render(<AiChat onSubmit={onSubmit} isLoading={false} progress={null} />);
      fireEvent.click(screen.getByTestId('ai-chat-toggle'));
      const textarea = screen.getByTestId('ai-chat-input');
      fireEvent.change(textarea, { target: { value: 'Test message' } });
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
      expect(onSubmit).toHaveBeenCalledWith('Test message');
    });

    it('Shift+Enter does NOT submit', () => {
      const onSubmit = vi.fn();
      render(<AiChat onSubmit={onSubmit} isLoading={false} progress={null} />);
      fireEvent.click(screen.getByTestId('ai-chat-toggle'));
      const textarea = screen.getByTestId('ai-chat-input');
      fireEvent.change(textarea, { target: { value: 'Line 1' } });
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('does not submit empty input', () => {
      const onSubmit = vi.fn();
      render(<AiChat onSubmit={onSubmit} isLoading={false} progress={null} />);
      fireEvent.click(screen.getByTestId('ai-chat-toggle'));
      fireEvent.click(screen.getByTestId('ai-chat-send'));
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('does not submit whitespace-only input', () => {
      const onSubmit = vi.fn();
      render(<AiChat onSubmit={onSubmit} isLoading={false} progress={null} />);
      fireEvent.click(screen.getByTestId('ai-chat-toggle'));
      const textarea = screen.getByTestId('ai-chat-input');
      fireEvent.change(textarea, { target: { value: '   ' } });
      fireEvent.click(screen.getByTestId('ai-chat-send'));
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('send button is hidden when input is empty', () => {
      render(<AiChat onSubmit={vi.fn()} isLoading={false} progress={null} />);
      fireEvent.click(screen.getByTestId('ai-chat-toggle'));
      const sendBtn = screen.getByTestId('ai-chat-send');
      expect(sendBtn.style.opacity).toBe('0');
    });

    it('send button is visible when input has text', () => {
      render(<AiChat onSubmit={vi.fn()} isLoading={false} progress={null} />);
      fireEvent.click(screen.getByTestId('ai-chat-toggle'));
      const textarea = screen.getByTestId('ai-chat-input');
      fireEvent.change(textarea, { target: { value: 'Hello' } });
      const sendBtn = screen.getByTestId('ai-chat-send');
      expect(sendBtn.style.opacity).toBe('1');
    });

    it('disables input and send button while loading', () => {
      render(<AiChat onSubmit={vi.fn()} isLoading={true} progress={null} />);
      fireEvent.click(screen.getByTestId('ai-chat-toggle'));
      expect(screen.getByTestId('ai-chat-input')).toBeDisabled();
      expect(screen.getByTestId('ai-chat-send')).toBeDisabled();
    });

    it('stops propagation of key events', () => {
      render(<AiChat onSubmit={vi.fn()} isLoading={false} progress={null} />);
      fireEvent.click(screen.getByTestId('ai-chat-toggle'));
      const textarea = screen.getByTestId('ai-chat-input');
      const event = new KeyboardEvent('keydown', { key: 'a', bubbles: true });
      const spy = vi.spyOn(event, 'stopPropagation');
      textarea.dispatchEvent(event);
      expect(spy).toHaveBeenCalled();
    });
  });

  // --- Story 5: Loading/progress indicators ---
  describe('loading and progress', () => {
    it('shows typing indicator when loading', () => {
      render(<AiChat onSubmit={vi.fn()} isLoading={true} progress={null} />);
      fireEvent.click(screen.getByTestId('ai-chat-toggle'));
      expect(screen.getByTestId('ai-chat-typing')).toBeInTheDocument();
    });

    it('shows Thinking… text when progress phase is calling', () => {
      render(<AiChat onSubmit={vi.fn()} isLoading={true} progress={{ phase: 'calling', round: 0 }} />);
      fireEvent.click(screen.getByTestId('ai-chat-toggle'));
      expect(screen.getByText('Thinking…')).toBeInTheDocument();
    });

    it('shows progress text when loading with executing phase', () => {
      render(<AiChat onSubmit={vi.fn()} isLoading={true} progress={{ phase: 'executing', tool: 'createObject' }} />);
      fireEvent.click(screen.getByTestId('ai-chat-toggle'));
      expect(screen.getByText('Creating…')).toBeInTheDocument();
    });

    it('shows rate limit text when rate limited', () => {
      render(<AiChat onSubmit={vi.fn()} isLoading={true} progress={{ phase: 'rate_limited', waitSec: 5 }} />);
      fireEvent.click(screen.getByTestId('ai-chat-toggle'));
      expect(screen.getByText(/Rate limited/)).toBeInTheDocument();
      expect(screen.getByText(/5s/)).toBeInTheDocument();
    });

    it('typing indicator has three dots', () => {
      render(<AiChat onSubmit={vi.fn()} isLoading={true} progress={null} />);
      fireEvent.click(screen.getByTestId('ai-chat-toggle'));
      const dots = screen.getByTestId('ai-chat-typing').querySelectorAll('[data-testid="typing-dot"]');
      expect(dots.length).toBe(3);
    });
  });

  // --- Story 6: Transitions and polish ---
  describe('transitions and polish', () => {
    it('+ New calls onNewConversation', () => {
      const messages = [
        { role: 'user', text: 'Hello' },
        { role: 'assistant', text: 'Reply' },
      ];
      const onNew = vi.fn();
      render(<AiChat onSubmit={vi.fn()} isLoading={false} progress={null} onNewConversation={onNew} messages={messages} />);
      fireEvent.click(screen.getByTestId('ai-chat-toggle'));
      expect(screen.getByText('Reply')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('ai-chat-new'));
      expect(onNew).toHaveBeenCalled();
    });

    it('sidebar has white background', () => {
      render(<AiChat onSubmit={vi.fn()} isLoading={false} progress={null} />);
      fireEvent.click(screen.getByTestId('ai-chat-toggle'));
      const panel = screen.getByTestId('ai-chat-panel');
      expect(panel.style.background).toBe('rgb(255, 255, 255)');
    });

    it('messages area is scrollable', () => {
      render(<AiChat onSubmit={vi.fn()} isLoading={false} progress={null} />);
      fireEvent.click(screen.getByTestId('ai-chat-toggle'));
      const messages = screen.getByTestId('ai-chat-messages');
      expect(messages.style.overflowY).toBe('auto');
    });
  });

  // --- Markdown rendering tests ---
  describe('markdown rendering', () => {
    it('renders bold text containing inline code correctly', () => {
      // Test the actual bug: bold text with inline code should be recognized
      // We'll test this by rendering the component with markdown content
      const messages = [{ role: 'assistant', text: '**bold with `code` inside**' }];
      render(<AiChat onSubmit={vi.fn()} isLoading={false} progress={null} messages={messages} />);
      fireEvent.click(screen.getByTestId('ai-chat-toggle'));
      
      // Look for the strong element within the message
      const strongElement = document.querySelector('strong');
      expect(strongElement).toBeTruthy();
      expect(strongElement.textContent).toContain('bold with');
      expect(strongElement.textContent).toContain('code');
      expect(strongElement.textContent).toContain('inside');
      
      // Look for the code element within the message
      const codeElement = document.querySelector('code');
      expect(codeElement).toBeTruthy();
      expect(codeElement.textContent).toBe('code');
      
      // Verify the code element is inside the strong element
      expect(strongElement.contains(codeElement)).toBe(true);
    });

    it('renders simple bold text correctly', () => {
      const messages = [{ role: 'assistant', text: '**simple bold**' }];
      render(<AiChat onSubmit={vi.fn()} isLoading={false} progress={null} messages={messages} />);
      fireEvent.click(screen.getByTestId('ai-chat-toggle'));
      
      const strongElement = document.querySelector('strong');
      expect(strongElement).toBeTruthy();
      expect(strongElement.textContent).toBe('simple bold');
    });

    it('renders inline code correctly', () => {
      const messages = [{ role: 'assistant', text: 'text with `code` here' }];
      render(<AiChat onSubmit={vi.fn()} isLoading={false} progress={null} messages={messages} />);
      fireEvent.click(screen.getByTestId('ai-chat-toggle'));
      
      const codeElement = document.querySelector('code');
      expect(codeElement).toBeTruthy();
      expect(codeElement.textContent).toBe('code');
    });
  });
});
