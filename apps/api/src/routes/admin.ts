import bcrypt from 'bcryptjs';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { z } from 'zod';

import { buildAdminStatusSnapshot } from '../lib/status-aggregation.js';
import { badRequest, conflict, unauthorized } from '../lib/errors.js';
import { getConfig, reloadConfig } from '../lib/config.js';
import { db } from '../lib/db.js';
import type { AppEnv } from '../types/hono-context.js';

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  role: z.enum(['admin', 'analyst', 'viewer']),
  telegramHandle: z.string().min(1).optional(),
  active: z.boolean().optional()
}).strict();

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(['admin', 'analyst', 'viewer']).optional(),
  telegramHandle: z.string().min(1).nullable().optional(),
  active: z.boolean().optional()
}).strict();

function requirePrincipal(c: Context<AppEnv>): { userId: string } {
  const principal = c.get('principal');
  if (principal === null) {
    throw unauthorized('Missing authenticated principal');
  }

  return principal;
}

function sanitizeUser(user: {
  id: string;
  email: string;
  name: string;
  role: string;
  telegramHandle: string | null;
  active: boolean;
  createdAt: Date;
  createdBy: string | null;
}): {
  id: string;
  email: string;
  name: string;
  role: string;
  telegramHandle: string | null;
  active: boolean;
  createdAt: string;
  createdBy: string | null;
} {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    telegramHandle: user.telegramHandle,
    active: user.active,
    createdAt: user.createdAt.toISOString(),
    createdBy: user.createdBy
  };
}

export async function adminStatusHandler(c: Context<AppEnv>): Promise<Response> {
  const status = await buildAdminStatusSnapshot();
  return c.json(status);
}

export function createAdminRouter(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.post('/users', async (c) => {
    const principal = requirePrincipal(c);
    const parsed = createUserSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      throw badRequest('Invalid user payload');
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, getConfig().auth.bcryptRounds);

    try {
      const createData = {
        email: parsed.data.email,
        passwordHash,
        name: parsed.data.name,
        role: parsed.data.role,
        telegramHandle: parsed.data.telegramHandle ?? null,
        active: parsed.data.active ?? true,
        createdBy: principal.userId
      };

      const created = await db.user.create({
        data: createData,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          telegramHandle: true,
          active: true,
          createdAt: true,
          createdBy: true
        }
      });

      return c.json({ user: sanitizeUser(created) }, 201);
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw conflict('User identity already exists');
      }

      throw error;
    }
  });

  router.get('/users', async (c) => {
    const _ = requirePrincipal(c);

    const users = await db.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        telegramHandle: true,
        active: true,
        createdAt: true,
        createdBy: true
      }
    });

    return c.json({ users: users.map((user: { id: string; email: string; name: string; role: string; telegramHandle: string | null; active: boolean; createdAt: Date; createdBy: string | null }) => sanitizeUser(user)) });
  });

  router.patch('/users/:id', async (c) => {
    const _ = requirePrincipal(c);
    const userId = c.req.param('id');
    const parsed = updateUserSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      throw badRequest('Invalid user update payload');
    }

    try {
      const updateData: {
        name?: string;
        role?: 'admin' | 'analyst' | 'viewer';
        active?: boolean;
        telegramHandle?: string | null;
      } = {};

      if (parsed.data.name !== undefined) {
        updateData.name = parsed.data.name;
      }
      if (parsed.data.role !== undefined) {
        updateData.role = parsed.data.role;
      }
      if (parsed.data.active !== undefined) {
        updateData.active = parsed.data.active;
      }
      if (parsed.data.telegramHandle !== undefined) {
        updateData.telegramHandle = parsed.data.telegramHandle;
      }

      const updated = await db.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          telegramHandle: true,
          active: true,
          createdAt: true,
          createdBy: true
        }
      });

      return c.json({ user: sanitizeUser(updated) });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw conflict('User identity already exists');
      }

      throw error;
    }
  });

  router.get('/config', async (c) => {
    const _ = requirePrincipal(c);
    return c.json({ config: getConfig() });
  });

  router.post('/config/reload', async (c) => {
    const _ = requirePrincipal(c);
    const result = await reloadConfig();
    return c.json(result);
  });

  return router;
}



