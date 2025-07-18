import type { Agent } from "../../../types/agentSchema";
import { logger } from "@/lib/logger";
import type { Document } from "../../../types/documents";
import type { Comment } from "../../../types/documentSchema";
import type { LLMInteraction, LLMMessage, RichLLMInteraction } from "../../../types/llm";
import {
  DEFAULT_TEMPERATURE,
  withTimeout,
  HIGHLIGHT_EXTRACTION_TIMEOUT,
} from "../../../types/openai";
import { callClaudeWithTool, MODEL_CONFIG } from "@/lib/claude/wrapper";
import type { Anthropic } from '@anthropic-ai/sdk';
import { calculateLLMCost } from "../shared/costUtils";
import type { HighlightAnalysisOutputs, TaskResult } from "../shared/types";
import type { ComprehensiveAnalysisOutputs } from "../comprehensiveAnalysis";
import { getHighlightExtractionPrompts } from "./prompts";
import { createLogDetails } from "../shared/llmUtils";
import { validateAndConvertHighlights } from "../highlightGeneration/highlightValidator";
import type { LineBasedHighlight } from "../highlightGeneration/lineBasedHighlighter";
import { getDocumentFullContent } from "../../../utils/documentContentHelpers";

/**
 * Extract and format highlights from the comprehensive analysis
 */
export async function extractHighlightsFromAnalysis(
  document: Document,
  agentInfo: Agent,
  analysisData: ComprehensiveAnalysisOutputs,
  targetHighlights: number = 5
): Promise<{ task: TaskResult; outputs: HighlightAnalysisOutputs }> {
  const startTime = Date.now();
  
  // If we have structured highlight insights from the analysis, we can use them directly
  if (analysisData.highlightInsights && analysisData.highlightInsights.length > 0) {
    // Convert insights to highlights format
    const highlights: Comment[] = [];
    const lineBasedHighlights: LineBasedHighlight[] = [];
    
    // Get the full content with prepend (same as what was shown to the LLM)
    const { content: fullContent } = getDocumentFullContent(document);
    const lines = fullContent.split('\n');
    
    // Take up to targetHighlights insights
    // Use all insights provided by the comprehensive analysis
    const insightsToUse = analysisData.highlightInsights;
    
    for (const insight of insightsToUse) {
      // Parse location to get line numbers
      const lineMatch = insight.location.match(/[Ll]ines?\s*(\d+)(?:\s*-\s*(\d+))?/);
      let startLine = 1;
      let endLine = 1;
      
      if (lineMatch) {
        startLine = parseInt(lineMatch[1]);
        endLine = lineMatch[2] ? parseInt(lineMatch[2]) : startLine;
      }
      
      // Get the actual line content to extract character snippets
      const startLineContent = lines[startLine - 1] || '';
      const endLineContent = lines[endLine - 1] || '';
      
      // Extract character snippets, ensuring we always have valid content
      let startCharacters = startLineContent.slice(0, 10).trim();
      let endCharacters = endLineContent.length > 10 
        ? endLineContent.slice(-10).trim() 
        : endLineContent.trim();
      
      // Fallback: if snippets are empty, use first/last non-empty content
      if (!startCharacters) {
        // Look for first non-empty content starting from the highlight
        for (let i = startLine - 1; i < Math.min(startLine + 2, lines.length); i++) {
          const line = lines[i];
          if (line && line.trim()) {
            startCharacters = line.slice(0, 10).trim();
            break;
          }
        }
        // Ultimate fallback
        if (!startCharacters) startCharacters = "...";
      }
      
      if (!endCharacters) {
        // Look for last non-empty content ending at the highlight
        for (let i = endLine - 1; i >= Math.max(endLine - 3, 0); i--) {
          const line = lines[i];
          if (line && line.trim()) {
            endCharacters = line.slice(-10).trim();
            break;
          }
        }
        // Ultimate fallback
        if (!endCharacters) endCharacters = "...";
      }
      
      const lineBasedHighlight: LineBasedHighlight = {
        description: insight.suggestedHighlight,
        importance: 5, // Default importance
        highlight: {
          startLineIndex: startLine - 1, // Convert to 0-based
          endLineIndex: endLine - 1,
          startCharacters: startCharacters,
          endCharacters: endCharacters,
        },
      };
      
      lineBasedHighlights.push(lineBasedHighlight);
    }
    
    // Convert to character-based highlights using the full content (with prepend)
    const convertedHighlights = await validateAndConvertHighlights(lineBasedHighlights, fullContent);
    highlights.push(...convertedHighlights);
    
    // Check for mismatch between highlights in markdown vs structured data
    const markdownHighlightMatches = analysisData.analysis.match(/### Highlight \[/g);
    const markdownHighlightCount = markdownHighlightMatches ? markdownHighlightMatches.length : 0;
    
    if (markdownHighlightCount > analysisData.highlightInsights.length) {
      logger.warn(
        `⚠️ Highlight count mismatch: ${markdownHighlightCount} highlights in markdown but only ${analysisData.highlightInsights.length} in structured data. ` +
        `Missing ${markdownHighlightCount - analysisData.highlightInsights.length} highlights.`
      );
      
      // If we're missing more than half the highlights, log additional details
      if (analysisData.highlightInsights.length < markdownHighlightCount * 0.5) {
        logger.error(
          `🚨 Critical mismatch: Only ${Math.round((analysisData.highlightInsights.length / markdownHighlightCount) * 100)}% of highlights were captured in structured data. ` +
          `Consider falling back to markdown parsing.`
        );
      }
    }
    
    const endTime = Date.now();
    const timeInSeconds = Math.round((endTime - startTime) / 1000);
    
    // Create a minimal task result since we didn't call the LLM
    const logDetails = createLogDetails(
      "extractHighlightsFromAnalysis",
      "EXTRACTION_ONLY",
      startTime,
      endTime,
      0, // No cost for extraction
      0,
      0,
      {
        targetHighlights,
        agentName: agentInfo.name,
        availableInsights: analysisData.highlightInsights.length,
      },
      {
        extractedHighlights: highlights.length,
      },
      `Extracted ${highlights.length} highlights from ${analysisData.highlightInsights.length} available insights`
    );
    
    return {
      task: {
        name: "extractHighlightsFromAnalysis",
        modelName: "EXTRACTION_ONLY",
        priceInDollars: 0,
        timeInSeconds,
        log: JSON.stringify(logDetails, null, 2),
        llmInteractions: [],
      },
      outputs: {
        highlights,
      },
    };
  }
  
  // Fallback: If no structured insights, use LLM to extract highlights from the analysis
  const { systemMessage, userMessage } = getHighlightExtractionPrompts(
    document,
    agentInfo,
    analysisData,
    targetHighlights
  );

  const messages: LLMMessage[] = [
    { role: "system", content: systemMessage },
    { role: "user", content: userMessage },
  ];

  let highlights: Comment[] = [];
  const richInteractions: RichLLMInteraction[] = [];

  try {
    const toolSchema: Anthropic.Messages.Tool.InputSchema = {
      type: "object",
      properties: {
        highlights: {
          type: "array",
          items: {
            type: "object",
            properties: {
              description: {
                type: "string",
                description: "Highlight text (100-300 words) starting with a clear, concise statement of the main point",
              },
              highlight: {
                type: "object",
                properties: {
                  startLineIndex: {
                    type: "number",
                    description: "Starting line number (0-based)",
                  },
                  endLineIndex: {
                    type: "number",
                    description: "Ending line number (0-based)",
                  },
                  startCharacters: {
                    type: "string",
                    description: "First ~6 characters of the highlighted text",
                  },
                  endCharacters: {
                    type: "string",
                    description: "Last ~6 characters of the highlighted text",
                  },
                },
                required: ["startLineIndex", "endLineIndex", "startCharacters", "endCharacters"],
              },
            },
            required: ["description", "highlight"],
          },
        },
      },
      required: ["highlights"],
    };

    const { response, interaction, toolResult } = await withTimeout(
      callClaudeWithTool<{ highlights: LineBasedHighlight[] }>({
        model: MODEL_CONFIG.analysis,
        system: systemMessage,
        messages: [
          {
            role: "user",
            content: userMessage,
          },
        ],
        max_tokens: 4000,
        temperature: DEFAULT_TEMPERATURE,
        toolName: "provide_highlights",
        toolDescription: "Extract and format highlights based on the comprehensive analysis",
        toolSchema,
        enablePromptCaching: true // Enable caching for highlight extraction system prompt and tools
      }, richInteractions),
      HIGHLIGHT_EXTRACTION_TIMEOUT,
      `Anthropic API request timed out after ${HIGHLIGHT_EXTRACTION_TIMEOUT / 60000} minutes`
    );
    
    // Convert line-based to character-based highlights
    // Get the full content with prepend (same as what was shown to the LLM)
    const { content: fullContent } = getDocumentFullContent(document);
    highlights = await validateAndConvertHighlights(toolResult.highlights, fullContent);

  } catch (error: any) {
    logger.error('Error in highlight extraction:', error);
    throw error;
  }

  // Convert RichLLMInteraction to legacy LLMInteraction format for backwards compatibility
  const legacyInteraction: LLMInteraction = {
    messages: [...messages, { role: "assistant", content: JSON.stringify({ highlights }) }],
    usage: {
      input_tokens: richInteractions[0]?.tokensUsed.prompt || 0,
      output_tokens: richInteractions[0]?.tokensUsed.completion || 0,
    },
  };

  const endTime = Date.now();
  const timeInSeconds = Math.round((endTime - startTime) / 1000);

  const cost = calculateLLMCost(MODEL_CONFIG.analysis, legacyInteraction.usage);

  const logDetails = createLogDetails(
    "extractHighlightsFromAnalysis",
    MODEL_CONFIG.analysis,
    startTime,
    endTime,
    cost,
    legacyInteraction.usage.input_tokens,
    legacyInteraction.usage.output_tokens,
    {
      targetHighlights,
      agentName: agentInfo.name,
    },
    {
      extractedHighlights: highlights.length,
    },
    `Extracted ${highlights.length} highlights from comprehensive analysis`
  );

  return {
    task: {
      name: "extractHighlightsFromAnalysis",
      modelName: MODEL_CONFIG.analysis,
      priceInDollars: cost / 100,
      timeInSeconds,
      log: JSON.stringify(logDetails, null, 2),
      llmInteractions: [legacyInteraction],
    },
    outputs: {
      highlights,
    },
  };
}