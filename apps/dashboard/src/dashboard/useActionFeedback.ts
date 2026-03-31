import { useState } from 'react';

import type { ActionFeedback } from '../status/status-types';

export function useActionFeedback(): {
  feedback: ActionFeedback | null;
  setSuccess: (message: string) => void;
  setRetriableError: (message: string) => void;
  setTerminalError: (message: string) => void;
  clear: () => void;
} {
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null);

  return {
    feedback,
    setSuccess: (message: string): void => setFeedback({ kind: 'success', message, at: new Date().toISOString() }),
    setRetriableError: (message: string): void =>
      setFeedback({ kind: 'retriable_error', message, at: new Date().toISOString() }),
    setTerminalError: (message: string): void => setFeedback({ kind: 'terminal_error', message, at: new Date().toISOString() }),
    clear: (): void => setFeedback(null)
  };
}
