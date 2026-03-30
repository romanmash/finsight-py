import { z } from 'zod';

export const authConfigSchema = z.object({
  accessTokenExpiryMinutes: z.number().int().positive(),
  refreshTokenExpiryDays: z.number().int().positive(),
  bcryptRounds: z.number().int().positive()
}).strict();

export type AuthConfig = z.infer<typeof authConfigSchema>;
