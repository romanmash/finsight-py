import { PrismaClient } from '@prisma/client';

import type { TelegramPrincipal } from './types.js';

export interface IdentityResolver {
  resolveByUsername(username: string): Promise<TelegramPrincipal | null>;
}

export function createIdentityResolver(prisma: PrismaClient): IdentityResolver {
  return {
    async resolveByUsername(username: string): Promise<TelegramPrincipal | null> {
      const normalizedHandle = username.startsWith('@') ? username : `@${username}`;
      const user = await prisma.user.findUnique({
        where: { telegramHandle: normalizedHandle },
        select: {
          id: true,
          role: true,
          telegramHandle: true,
          active: true,
          telegramChatId: true
        }
      });

      if (user === null || !user.active || user.telegramHandle === null) {
        return null;
      }

      return {
        userId: user.id,
        role: user.role as 'admin' | 'analyst' | 'viewer',
        telegramHandle: user.telegramHandle,
        active: user.active,
        telegramChatId: user.telegramChatId
      };
    }
  };
}
