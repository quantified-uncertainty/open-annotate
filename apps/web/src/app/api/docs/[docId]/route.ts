import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { z } from "zod";

import { DocumentModel } from "@/models/Document";
import { authenticateRequest } from "@/lib/auth-helpers";
import { commonErrors } from "@/lib/api-response-helpers";
import { withSecurity } from "@/lib/security-middleware";
import { prisma } from "@roast/db";

const updateDocumentSchema = z.object({
  intendedAgentIds: z.array(z.string()).optional(),
});

// GET endpoint is public - matches existing document API patterns
export async function GET(req: NextRequest, context: { params: Promise<{ docId: string }> }) {
  const params = await context.params;
  const { docId } = params;

  try {
    // Use the DocumentModel to get a formatted document
    const document = await DocumentModel.getDocumentWithEvaluations(docId);

    if (!document) {
      return commonErrors.notFound("Document not found");
    }

    return NextResponse.json({ document });
  } catch (error) {
    logger.error('Error fetching document:', error);
    return commonErrors.serverError();
  }
}

export const PUT = withSecurity(
  async (req: NextRequest, context: { params: Promise<{ docId: string }> }) => {
    const params = await context.params;
    const { docId } = params;
    const userId = (await authenticateRequest(req))!;
    const body = (req as any).validatedBody;

    try {
      const { intendedAgentIds } = body;

    if (!intendedAgentIds) {
      return NextResponse.json({
        success: true,
        message: "No updates provided",
      });
    }

    // Use existing document update logic from the old API
    // Import the PUT logic from the existing documents API
    const { updateDocumentWithAgents } = await import("@/lib/document-operations");
    
    const result = await updateDocumentWithAgents(docId, intendedAgentIds, userId!);

      return NextResponse.json(result);
    } catch (error) {
      logger.error('Error updating document:', error);
      return commonErrors.serverError();
    }
  },
  {
    requireAuth: true,
    validateBody: updateDocumentSchema,
    checkOwnership: async (userId: string, request: NextRequest) => {
      // Extract docId from URL path - matches /api/docs/{docId}
      const url = new URL(request.url);
      const pathMatch = url.pathname.match(/\/api\/docs\/([^\/]+)/);
      const docId = pathMatch?.[1];
      
      if (!docId) {
        return false;
      }
      
      const document = await prisma.document.findUnique({
        where: { id: docId },
        select: { submittedById: true }
      });
      return document?.submittedById === userId;
    }
  }
);