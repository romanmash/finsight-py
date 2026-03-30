import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import type { TraderConfig } from '../../../../../config/types/index.js';
import { createNotFoundError } from '../../shared/errors.js';
import type { McpAnyToolDefinition, McpToolDefinition } from '../../shared/tool-types.js';
import { assertApprovalForNonMock } from '../approval-guard.js';

const ticketStore = new Map<string, TicketState>();

type TicketStatus = 'created' | 'placed' | 'cancelled' | 'filled';

interface TicketState {
  ticketId: string;
  ticker: string;
  action: 'buy' | 'sell';
  quantity: number;
  status: TicketStatus;
  createdAt: string;
  filledPrice?: number;
  rationale: string;
  confidence: string;
}

const createTicketInputSchema = z.object({
  ticker: z.string().min(1),
  action: z.enum(['buy', 'sell']),
  quantity: z.number().positive(),
  rationale: z.string().min(1),
  confidence: z.enum(['low', 'medium', 'high'])
}).strict();

const ticketSchema = z.object({
  ticketId: z.string(),
  ticker: z.string(),
  action: z.enum(['buy', 'sell']),
  quantity: z.number(),
  status: z.enum(['created', 'placed', 'cancelled', 'filled']),
  createdAt: z.string(),
  filledPrice: z.number().optional(),
  rationale: z.string(),
  confidence: z.string()
}).strict();

const getTicketInputSchema = z.object({ ticketId: z.string().min(1) }).strict();

const placeOrderInputSchema = z.object({
  ticketId: z.string().min(1),
  approvalContext: z.object({ approvedByUserId: z.string().min(1) }).optional()
}).strict();

const cancelTicketInputSchema = z.object({
  ticketId: z.string().min(1),
  reason: z.string().optional()
}).strict();

function getTicketOrThrow(ticketId: string): TicketState {
  const ticket = ticketStore.get(ticketId);
  if (!ticket) {
    throw createNotFoundError(`Ticket not found: ${ticketId}`);
  }

  return ticket;
}

export function createTraderPlatformToolRegistry(traderConfig: TraderConfig, requireApprovalForNonMock: boolean): ReadonlyArray<McpToolDefinition<unknown, unknown>> {
  const isMockMode = (process.env.MCP_TRADER_PLATFORM_MODE ?? traderConfig.platform) === 'mock';

  const createTicket: McpToolDefinition<z.infer<typeof createTicketInputSchema>, z.infer<typeof ticketSchema>> = {
    name: 'create_ticket',
    description: 'Create a new trade ticket',
    inputSchema: createTicketInputSchema,
    outputSchema: ticketSchema,
    handler: async (input) => {
      const ticket: TicketState = {
        ticketId: randomUUID(),
        ticker: input.ticker,
        action: input.action,
        quantity: input.quantity,
        status: 'created',
        createdAt: new Date().toISOString(),
        rationale: input.rationale,
        confidence: input.confidence
      };

      ticketStore.set(ticket.ticketId, ticket);
      return ticket;
    }
  };

  const getTicket: McpToolDefinition<z.infer<typeof getTicketInputSchema>, z.infer<typeof ticketSchema>> = {
    name: 'get_ticket',
    description: 'Fetch an existing trade ticket',
    inputSchema: getTicketInputSchema,
    outputSchema: ticketSchema,
    handler: async (input) => getTicketOrThrow(input.ticketId)
  };

  const placeOrder: McpToolDefinition<z.infer<typeof placeOrderInputSchema>, z.infer<typeof ticketSchema>> = {
    name: 'place_order',
    description: 'Place an order for an existing ticket',
    inputSchema: placeOrderInputSchema,
    outputSchema: ticketSchema,
    handler: async (input) => {
      const ticket = getTicketOrThrow(input.ticketId);

      if (requireApprovalForNonMock) {
        assertApprovalForNonMock(isMockMode, input.approvalContext);
      }

      ticket.status = 'placed';
      if (isMockMode) {
        ticket.status = 'filled';
        ticket.filledPrice = Number((traderConfig.mockBasePrice * (1 + traderConfig.mockExecutionSlippagePct)).toFixed(2));
      }

      ticketStore.set(ticket.ticketId, ticket);
      return ticket;
    }
  };

  const cancelTicket: McpToolDefinition<z.infer<typeof cancelTicketInputSchema>, z.infer<typeof ticketSchema>> = {
    name: 'cancel_ticket',
    description: 'Cancel an existing trade ticket',
    inputSchema: cancelTicketInputSchema,
    outputSchema: ticketSchema,
    handler: async (input) => {
      const ticket = getTicketOrThrow(input.ticketId);
      ticket.status = 'cancelled';
      ticketStore.set(ticket.ticketId, ticket);
      return ticket;
    }
  };

  return [createTicket, getTicket, placeOrder, cancelTicket] as ReadonlyArray<McpAnyToolDefinition>;
}
