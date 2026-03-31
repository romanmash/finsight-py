import { useState } from 'react';

import { StatusClient } from '../status/status-client';
import { useActionFeedback } from './useActionFeedback';

interface AdminActionsProps {
  client: StatusClient;
}

export function AdminActions({ client }: AdminActionsProps): JSX.Element {
  const feedback = useActionFeedback();
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const runAction = async (actionName: string, action: () => Promise<unknown>): Promise<void> => {
    setBusyAction(actionName);
    feedback.clear();
    try {
      const result = await action();
      const details = JSON.stringify(result);
      feedback.setSuccess(`${actionName} succeeded: ${details}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown action error';
      if (message.toLowerCase().includes('timeout')) {
        feedback.setRetriableError(`${actionName} timed out. Retry is safe.`);
      } else {
        feedback.setTerminalError(`${actionName} failed: ${message}`);
      }
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <section className="panel">
      <h2>Admin Actions</h2>
      <div className="actions-grid">
        <button onClick={(): void => void runAction('Reload config', () => client.reloadConfig())} disabled={busyAction !== null}>
          Reload config
        </button>
        <button onClick={(): void => void runAction('Trigger screener', () => client.triggerScreener())} disabled={busyAction !== null}>
          Trigger screener
        </button>
        <button onClick={(): void => void runAction('Trigger watchdog', () => client.triggerWatchdog())} disabled={busyAction !== null}>
          Trigger watchdog
        </button>
      </div>
      {feedback.feedback !== null ? <p className={`feedback ${feedback.feedback.kind}`}>{feedback.feedback.message}</p> : null}
    </section>
  );
}
