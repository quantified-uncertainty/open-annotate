/**
 * Multi-Epistemic Evaluation workflow for document analysis
 */

import type { Agent } from "../../../types/agentSchema";
import type { Document } from "../../../types/documents";
import type { Comment } from "../../../types/documentSchema";
import type { TaskResult } from "../shared/types";
import { logger } from "@/lib/logger";
import { 
  PluginManager,
  MathPlugin,
  SpellingPlugin,
  FactCheckPlugin,
  ForecastPlugin
} from '../plugin-system';
import { extractHighlightsFromAnalysis } from "../highlightExtraction";
import { generateComprehensiveAnalysis } from "../comprehensiveAnalysis";
import { generateSelfCritique } from "../selfCritique";
import type { SelfCritiqueInput } from "../selfCritique";
import type { RichLLMInteraction, LLMInteraction } from "../../../types/llm";
import { convertFindingsToHighlights, filterFindingsWithLocationHints } from '../plugin-system/utils/findingToHighlight';
import { getDocumentFullContent } from "../../../utils/documentContentHelpers";
import type { HeliconeSessionConfig } from "../../helicone/sessions";

/**
 * Convert RichLLMInteraction to LLMInteraction format for TaskResult
 */
function convertRichLLMInteraction(richInteraction: RichLLMInteraction): LLMInteraction {
  return {
    messages: [
      { role: "system", content: richInteraction.prompt.split('\n\nUSER: ')[0].replace('SYSTEM: ', '') },
      { role: "user", content: richInteraction.prompt.split('\n\nUSER: ')[1] || richInteraction.prompt },
      { role: "assistant", content: richInteraction.response }
    ],
    usage: {
      input_tokens: richInteraction.tokensUsed.prompt,
      output_tokens: richInteraction.tokensUsed.completion
    }
  };
}

export async function analyzeWithMultiEpistemicEval(
  document: Document,
  agentInfo: Agent,
  options: {
    targetHighlights?: number;
    enableForecasting?: boolean;
    sessionConfig?: HeliconeSessionConfig;
  } = {}
): Promise<{
  thinking: string;
  analysis: string;
  summary: string;
  grade?: number;
  selfCritique?: string;
  highlights: Comment[];
  tasks: TaskResult[];
}> {
  const tasks: TaskResult[] = [];
  const targetHighlights = options.targetHighlights || 5;
  
  try {
    // Step 1: Run plugin-based analysis
    logger.info(`Starting multi-epistemic evaluation...`);
    const pluginStartTime = Date.now();
    
    const manager = new PluginManager({
      sessionConfig: options.sessionConfig
    });
    
    // Register plugins
    const plugins: any[] = [
      new MathPlugin(),
      new SpellingPlugin(),
      new FactCheckPlugin()
    ];
    
    // Only add ForecastPlugin if explicitly enabled (it's expensive)
    if (options.enableForecasting) {
      plugins.push(new ForecastPlugin());
    }
    
    manager.registerPlugins(plugins);
    
    // Get full document content with prepend (same as comprehensive analysis)
    const { content: fullContent, prependLineCount } = getDocumentFullContent(document);
    
    // Run analysis on full content
    const pluginResults = await manager.analyzeDocument(fullContent, {
      chunkSize: 1000,
      chunkByParagraphs: true
    });
    
    const pluginDuration = Date.now() - pluginStartTime;
    logger.info(`Plugin analysis completed in ${pluginDuration}ms`);
    
    // Get router LLM interactions for accurate tracking
    const routerInteractions = manager.getRouterLLMInteractions();
    const routerTokens = routerInteractions.reduce((sum, interaction) => sum + interaction.tokensUsed.total, 0);
    
    tasks.push({
      name: 'Plugin Analysis',
      modelName: 'claude-3-haiku-20240307',
      priceInDollars: pluginResults.statistics.tokensUsed * 0.00000025, // Approximate cost based on total tokens
      timeInSeconds: pluginDuration / 1000,
      log: `Analyzed ${pluginResults.statistics.totalChunks} chunks, found ${pluginResults.statistics.totalFindings} findings. Router used ${routerTokens} tokens in ${routerInteractions.length} routing calls.`,
      llmInteractions: routerInteractions.map(convertRichLLMInteraction)
    });
    
    // Step 2: Extract plugin-generated highlights
    logger.info(`Converting plugin findings to highlights...`);
    const pluginHighlights: Comment[] = [];
    
    // Collect all findings from all plugins
    const allFindings: any[] = [];
    
    // First check if we have SPELLING plugin results
    if (pluginResults.pluginResults instanceof Map) {
      const spellingResult = pluginResults.pluginResults.get('SPELLING');
      if (spellingResult) {
        logger.info(`SPELLING plugin has ${spellingResult.findings.length} findings`);
        
        // The SpellingPlugin stores detailed error info in its state
        // but only returns high-level findings in synthesize()
        // For now, we'll need to use what's available in the synthesis
        allFindings.push(...spellingResult.findings);
      }
      
      // Also collect from other plugins
      for (const [pluginName, pluginResult] of pluginResults.pluginResults.entries()) {
        if (pluginName !== 'SPELLING') {
          allFindings.push(...pluginResult.findings);
        }
      }
    }
    
    logger.info(`Total findings from all plugins: ${allFindings.length}`);
    
    // Filter findings with location hints and convert to highlights
    const findingsWithLocation = filterFindingsWithLocationHints(allFindings);
    logger.info(`Findings with location hints: ${findingsWithLocation.length}`);
    
    const convertedHighlights = convertFindingsToHighlights(
      findingsWithLocation,
      fullContent
    );
    pluginHighlights.push(...convertedHighlights);
    logger.info(`Converted ${pluginHighlights.length} plugin findings to highlights`);
    
    // Step 3: Format results into structured findings
    const structuredFindings = formatPluginFindings(pluginResults);
    
    // Step 4: Create enhanced agent with plugin findings
    const enhancedAgent = {
      ...agentInfo,
      primaryInstructions: `${agentInfo.primaryInstructions}\n\nPlugin Analysis Results:\n${structuredFindings}`
    };
    
    // Step 5: Generate comprehensive analysis using the findings
    logger.info(`Generating comprehensive analysis from plugin findings...`);
    
    // Create session config for comprehensive analysis phase
    const analysisSessionConfig = options.sessionConfig ? {
      ...options.sessionConfig,
      sessionPath: `${options.sessionConfig.sessionPath}/comprehensive-analysis`
    } : undefined;
    
    const analysisResult = await generateComprehensiveAnalysis(
      document,
      enhancedAgent,
      500, // targetWordCount
      targetHighlights,
      analysisSessionConfig
    );
    
    logger.info(
      `Comprehensive analysis generated, length: ${analysisResult.outputs.analysis.length}`
    );
    tasks.push(analysisResult.task);
    
    // Step 5: Extract highlights from the analysis
    logger.info(`Extracting highlights...`);
    const highlightResult = await extractHighlightsFromAnalysis(
      document,
      agentInfo,
      analysisResult.outputs,
      targetHighlights
    );
    
    logger.info(
      `Extracted ${highlightResult.outputs.highlights.length} highlights`
    );
    tasks.push(highlightResult.task);
    
    // Step 6: Generate self-critique if enabled
    let selfCritique: string | undefined;
    if (agentInfo.selfCritiqueInstructions) {
      logger.info(`Generating self-critique...`);
      try {
        const critiqueInput: SelfCritiqueInput = {
          summary: analysisResult.outputs.summary,
          analysis: analysisResult.outputs.analysis,
          grade: analysisResult.outputs.grade,
          highlights: highlightResult.outputs.highlights.map((h) => ({
            title: h.description || "Highlight",
            text: h.highlight.quotedText
          }))
        };
        const critiqueResult = await generateSelfCritique(critiqueInput, agentInfo);
        selfCritique = critiqueResult.outputs.selfCritique;
        tasks.push(critiqueResult.task);
      } catch (error) {
        logger.error("Self-critique generation failed:", error);
        tasks.push({
          name: 'Self-Critique',
          modelName: 'claude-3-sonnet-20241022',
          priceInDollars: 0.005,
          timeInSeconds: 5,
          log: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          llmInteractions: []
        });
      }
    }
    
    // Merge plugin highlights with LLM-generated highlights
    // Plugin highlights come first as they are more precise
    const allHighlights = [...pluginHighlights, ...highlightResult.outputs.highlights];
    
    // Deduplicate highlights that might overlap
    const uniqueHighlights = deduplicateHighlights(allHighlights);
    
    logger.info(
      `Final highlights: ${uniqueHighlights.length} (${pluginHighlights.length} from plugins, ${highlightResult.outputs.highlights.length} from LLM)`
    );
    
    return {
      thinking: "", // Comprehensive analysis doesn't provide thinking
      analysis: analysisResult.outputs.analysis,
      summary: analysisResult.outputs.summary,
      grade: analysisResult.outputs.grade,
      selfCritique,
      highlights: uniqueHighlights,
      tasks
    };
    
  } catch (error) {
    logger.error("Multi-epistemic evaluation failed:", error);
    throw error;
  }
}

/**
 * Format plugin findings into a structured summary
 */
function formatPluginFindings(results: any): string {
  const sections: string[] = [];
  
  // Overall statistics
  sections.push(`OVERALL STATISTICS:
- Total chunks analyzed: ${results.statistics.totalChunks}
- Total findings: ${results.statistics.totalFindings}
- Critical findings: ${countCriticalFindings(results)}`);
  
  // Findings by type
  const findingsByType: string[] = [];
  if (results.statistics.findingsByType instanceof Map) {
    for (const [type, count] of results.statistics.findingsByType.entries()) {
      findingsByType.push(`  - ${type}: ${count}`);
    }
  }
  if (findingsByType.length > 0) {
    sections.push(`\nFINDINGS BY TYPE:\n${findingsByType.join('\n')}`);
  }
  
  // Plugin summaries
  if (results.pluginResults instanceof Map) {
    for (const [pluginName, pluginResult] of results.pluginResults.entries()) {
      const criticalFindings = pluginResult.findings
        .filter((f: any) => f.severity === 'high' || f.severity === 'medium')
        .slice(0, 5);
      
      let pluginSection = `\n${pluginName.toUpperCase()} ANALYSIS:\n${pluginResult.summary}`;
      
      if (criticalFindings.length > 0) {
        pluginSection += '\nKey findings:';
        criticalFindings.forEach((f: any) => {
          pluginSection += `\n  - [${f.severity}] ${f.message}`;
        });
      }
      
      sections.push(pluginSection);
    }
  }
  
  // Recommendations
  if (results.recommendations.length > 0) {
    sections.push(`\nRECOMMENDATIONS:\n${results.recommendations.map((r: string) => `- ${r}`).join('\n')}`);
  }
  
  return sections.join('\n\n');
}

/**
 * Count critical (high/medium severity) findings
 */
function countCriticalFindings(results: any): number {
  let count = 0;
  if (results.pluginResults instanceof Map) {
    for (const [_, pluginResult] of results.pluginResults.entries()) {
      count += pluginResult.findings.filter((f: any) => 
        f.severity === 'high' || f.severity === 'medium'
      ).length;
    }
  }
  return count;
}

/**
 * Deduplicate highlights based on overlapping positions
 */
function deduplicateHighlights(highlights: Comment[]): Comment[] {
  if (highlights.length <= 1) return highlights;
  
  // Sort by start offset
  const sorted = [...highlights].sort((a, b) => 
    a.highlight.startOffset - b.highlight.startOffset
  );
  
  const unique: Comment[] = [];
  
  for (const highlight of sorted) {
    // Check if this highlight overlaps with any existing unique highlight
    const overlaps = unique.some(existing => {
      const existingStart = existing.highlight.startOffset;
      const existingEnd = existing.highlight.endOffset;
      const currentStart = highlight.highlight.startOffset;
      const currentEnd = highlight.highlight.endOffset;
      
      // Check for overlap (fixed off-by-one error)
      return (currentStart >= existingStart && currentStart < existingEnd) ||
             (currentEnd > existingStart && currentEnd <= existingEnd) ||
             (currentStart < existingStart && currentEnd > existingEnd);
    });
    
    if (!overlaps) {
      unique.push(highlight);
    }
  }
  
  return unique;
}