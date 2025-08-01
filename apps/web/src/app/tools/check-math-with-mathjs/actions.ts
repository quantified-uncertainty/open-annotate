'use server';

import { checkMathWithMathJsTool } from '@roast/ai';
import { auth } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function checkMathWithMathJs(text: string) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Not authenticated');
  }

  try {
    const result = await checkMathWithMathJsTool.execute(
      { statement: text },
      { userId: session.user.id, logger }
    );
    return result;
  } catch (error) {
    logger.error('Check math with MathJS error:', error);
    throw error;
  }
}
