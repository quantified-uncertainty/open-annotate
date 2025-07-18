"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface RerunButtonProps {
  agentId: string;
  documentId: string;
  isOwner: boolean;
  hasExistingEvaluation: boolean;
  rerunAction: (agentId: string, documentId: string) => Promise<{ success: boolean; error?: string }>;
  createOrRerunAction: (agentId: string, documentId: string) => Promise<{ success: boolean; error?: string }>;
}

export function RerunButton({ 
  agentId, 
  documentId, 
  isOwner, 
  hasExistingEvaluation,
  rerunAction,
  createOrRerunAction
}: RerunButtonProps) {
  const [isTriggered, setIsTriggered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  if (!isOwner) {
    return null;
  }

  const handleRerun = async () => {
    setIsLoading(true);
    try {
      let result;
      if (hasExistingEvaluation) {
        result = await rerunAction(agentId, documentId);
      } else {
        result = await createOrRerunAction(agentId, documentId);
      }

      if (result.success) {
        setIsTriggered(true);
        // Refresh the page after a short delay
        setTimeout(() => {
          router.refresh();
        }, 1000);
      } else {
        console.error("Failed to trigger rerun:", result.error);
      }
    } catch (error) {
      console.error("Error triggering rerun:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isTriggered) {
    return (
      <span className="text-sm text-green-600 font-medium">
        Rerun triggered
      </span>
    );
  }

  return (
    <button
      onClick={handleRerun}
      disabled={isLoading}
      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {isLoading ? "Triggering..." : "Rerun"}
    </button>
  );
}