import { z } from 'zod';

export const traderConfigSchema = z.object({
  ticketExpiryHours: z.number().int().positive(),
  minConfidenceToCreateTicket: z.enum(['high', 'medium', 'low']),
  maxPendingTicketsPerUser: z.number().int().positive(),
  mockExecutionSlippagePct: z.number().nonnegative(),
  mockBasePrice: z.number().positive(),
  allowedRoles: z.array(z.enum(['admin', 'analyst', 'viewer'])).min(1),
  requireTechnicianAlignment: z.boolean(),
  platform: z.enum(['mock', 'saxo'])
}).strict();

export type TraderConfig = z.infer<typeof traderConfigSchema>;
