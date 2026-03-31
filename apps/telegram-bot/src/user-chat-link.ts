import { PrismaClient } from '@prisma/client';

export interface UserChatLinkStore {
  persistChatIdOnFirstSuccess(userId: string, chatId: number): Promise<void>;
}

export function createUserChatLinkStore(prisma: PrismaClient): UserChatLinkStore {
  return {
    async persistChatIdOnFirstSuccess(userId: string, chatId: number): Promise<void> {
      await prisma.user.updateMany({
        where: {
          id: userId,
          telegramChatId: null
        },
        data: {
          telegramChatId: BigInt(chatId)
        }
      });
    }
  };
}
