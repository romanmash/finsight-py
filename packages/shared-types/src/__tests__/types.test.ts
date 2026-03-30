import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { AgentName, MissionStatus, MissionType, TicketStatus } from '../index.js';

describe('shared types enums', () => {
  it('exports expected object value counts', () => {
    expect(Object.values(AgentName)).toHaveLength(9);
    expect(Object.values(MissionType)).toHaveLength(8);
    expect(Object.values(MissionStatus)).toHaveLength(4);
    expect(Object.values(TicketStatus)).toHaveLength(5);
  });

  it('exposes known literal values', () => {
    expect(AgentName.MANAGER).toBe('manager');
    expect(MissionType.OPERATOR_QUERY).toBe('operator_query');
  });

  it('has zero runtime dependencies in package.json', () => {
    const packageJsonPath = resolve(process.cwd(), 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      dependencies?: Record<string, string>;
    };

    expect(packageJson.dependencies).toBeUndefined();
  });
});
