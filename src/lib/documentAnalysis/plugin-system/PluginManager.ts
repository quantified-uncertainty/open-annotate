/**
 * Plugin Manager - Coordinates the entire document analysis process
 */

import { PromptBasedRouter, RouterConfig } from './PromptBasedRouter';
import { AnalysisPlugin, DocumentProfile, SynthesisResult } from './types';
import { TextChunk, createChunks } from './TextChunk';
import type { HeliconeSessionConfig } from '../../helicone/sessions';
import { sessionContext } from '../../helicone/sessionContext';

export interface DocumentAnalysisResult {
  summary: string;
  pluginResults: Map<string, SynthesisResult>;
  statistics: {
    totalChunks: number;
    totalFindings: number;
    findingsByType: Map<string, number>;
    tokensUsed: number;
    processingTime: number;
  };
  recommendations: string[];
}

export interface PluginManagerConfig {
  routerConfig?: RouterConfig;
  sessionConfig?: HeliconeSessionConfig;
}

export class PluginManager {
  private router: PromptBasedRouter;
  private startTime: number = 0;
  private sessionConfig?: HeliconeSessionConfig;

  constructor(config: PluginManagerConfig = {}) {
    this.router = new PromptBasedRouter(config.routerConfig);
    this.sessionConfig = config.sessionConfig;
  }

  registerPlugin(plugin: AnalysisPlugin): void {
    this.router.registerPlugin(plugin);
  }

  registerPlugins(plugins: AnalysisPlugin[]): void {
    plugins.forEach(plugin => this.registerPlugin(plugin));
  }

  async analyzeDocument(
    text: string,
    options: {
      chunkSize?: number;
      chunkByParagraphs?: boolean;
      documentProfile?: DocumentProfile;
    } = {}
  ): Promise<DocumentAnalysisResult> {
    this.startTime = Date.now();
    
    // Set global session context for plugins
    if (this.sessionConfig) {
      sessionContext.setSession(this.sessionConfig);
    }
    
    try {
      // Phase 1: Create chunks
    console.log('📄 Creating document chunks...');
    const chunks = createChunks(text, {
      chunkSize: options.chunkSize || 1000,
      chunkByParagraphs: options.chunkByParagraphs || false
    });
    console.log(`   Created ${chunks.length} chunks`);

    // Phase 2: Route chunks to plugins
    console.log('\n🔀 Routing chunks to appropriate plugins...');
    const routingPlan = await this.router.routeChunks(chunks);
    const routingStats = routingPlan.getStats();
    console.log(`   Routing complete:`, routingStats);

    // Phase 3: Process chunks
    console.log('\n⚙️  Processing chunks with plugins...');
    await this.processChunks(chunks, routingPlan);

    // Phase 4: Synthesize results
    console.log('\n📊 Synthesizing results...');
    const pluginResults = await this.synthesizeResults();

    // Phase 5: Create final analysis
    const analysis = this.createFinalAnalysis(pluginResults, chunks.length);

    console.log('\n✅ Analysis complete!');
    return analysis;
    } finally {
      // Clear session context
      if (this.sessionConfig) {
        sessionContext.clear();
      }
    }
  }

  async analyzeText(
    text: string,
    options?: {
      chunkSize?: number;
      chunkByParagraphs?: boolean;
    }
  ): Promise<DocumentAnalysisResult> {
    return this.analyzeDocument(text, options);
  }

  private async processChunks(
    chunks: TextChunk[],
    routingPlan: any
  ): Promise<void> {
    const maxConcurrency = 20; // Increased from 5 - parallel processing working well, can handle more load
    
    // Create processing tasks for all chunks
    const chunkTasks = chunks.map((chunk, i) => ({
      chunk,
      index: i,
      plugins: routingPlan.getPluginsForChunk(chunk.id)
    })).filter(task => task.plugins.length > 0);

    console.log(`   Processing ${chunkTasks.length} chunks with up to ${maxConcurrency} concurrent tasks...`);

    // Process chunks in batches with controlled concurrency
    for (let i = 0; i < chunkTasks.length; i += maxConcurrency) {
      const batch = chunkTasks.slice(i, i + maxConcurrency);
      
      const batchPromises = batch.map(async (task) => {
        try {
          console.log(`   Processing chunk ${task.index + 1}/${chunks.length} with ${task.plugins.length} plugins...`);
          
          // Process chunk with each assigned plugin in parallel
          const pluginPromises = task.plugins.map(async (pluginName: string) => {
            const plugin = this.router.getPlugin(pluginName);
            if (plugin) {
              try {
                await plugin.processChunk(task.chunk);
              } catch (error) {
                console.error(`     Error in ${pluginName} for chunk ${task.index + 1}:`, error);
              }
            }
          });
          
          await Promise.all(pluginPromises);
        } catch (error) {
          console.error(`     Error processing chunk ${task.index + 1}:`, error);
        }
      });

      // Wait for current batch to complete before starting next batch
      await Promise.all(batchPromises);
    }
  }

  private async synthesizeResults(): Promise<Map<string, SynthesisResult>> {
    const results = new Map<string, SynthesisResult>();
    const plugins = this.router.getAllPlugins();

    for (const plugin of plugins) {
      try {
        console.log(`   Synthesizing ${plugin.name()} results...`);
        const result = await plugin.synthesize();
        results.set(plugin.name(), result);
      } catch (error) {
        console.error(`   Error synthesizing ${plugin.name()}:`, error);
      }
    }

    return results;
  }

  private createFinalAnalysis(
    pluginResults: Map<string, SynthesisResult>,
    totalChunks: number
  ): DocumentAnalysisResult {
    // Aggregate statistics
    let totalFindings = 0;
    let totalTokens = 0;
    const findingsByType = new Map<string, number>();
    const allRecommendations: string[] = [];

    // Collect all findings and stats
    for (const [pluginName, result] of Array.from(pluginResults.entries())) {
      totalFindings += result.findings.length;
      
      result.findings.forEach(finding => {
        const count = findingsByType.get(finding.type) || 0;
        findingsByType.set(finding.type, count + 1);
      });

      if (result.recommendations) {
        allRecommendations.push(...result.recommendations);
      }

      // Sum up tokens from LLM calls
      result.llmCalls.forEach(call => {
        totalTokens += call.tokensUsed.total;
      });
    }

    // Include router LLM interactions in token count
    const routerInteractions = this.router.getLLMInteractions();
    routerInteractions.forEach(interaction => {
      totalTokens += interaction.tokensUsed.total;
    });

    // Create summary
    const summaryParts: string[] = [];
    
    for (const [pluginName, result] of Array.from(pluginResults.entries())) {
      if (result.summary) {
        summaryParts.push(`${pluginName}: ${result.summary}`);
      }
    }

    const summary = summaryParts.join('\n\n');

    // Deduplicate recommendations
    const uniqueRecommendations = Array.from(new Set(allRecommendations));

    const processingTime = Date.now() - this.startTime;

    return {
      summary,
      pluginResults,
      statistics: {
        totalChunks,
        totalFindings,
        findingsByType,
        tokensUsed: totalTokens,
        processingTime
      },
      recommendations: uniqueRecommendations
    };
  }

  // Helper method to analyze a single chunk with specific plugins
  async analyzeChunk(
    chunk: TextChunk,
    pluginNames?: string[]
  ): Promise<Map<string, any>> {
    const results = new Map<string, any>();
    
    const plugins = pluginNames 
      ? pluginNames.map(name => this.router.getPlugin(name)).filter(p => p !== undefined)
      : this.router.getAllPlugins();

    for (const plugin of plugins) {
      try {
        const result = await plugin.processChunk(chunk);
        results.set(plugin.name(), result);
      } catch (error) {
        console.error(`Error in ${plugin.name()}:`, error);
        results.set(plugin.name(), { error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    return results;
  }

  // Clear all plugin states
  clearAllStates(): void {
    this.router.getAllPlugins().forEach(plugin => plugin.clearState());
  }

  // Get current state of a specific plugin
  getPluginState(pluginName: string): any {
    const plugin = this.router.getPlugin(pluginName);
    return plugin ? plugin.getState() : null;
  }

  // Configuration methods
  setRoutingBatchSize(size: number): void {
    this.router.setBatchSize(size);
  }

  setRoutingCacheSize(size: number): void {
    this.router.setCacheSize(size);
  }

  clearRoutingCache(): void {
    this.router.clearCache();
  }

  // Router LLM interaction methods for monitoring
  getRouterLLMInteractions() {
    return this.router.getLLMInteractions();
  }

  clearRouterLLMInteractions(): void {
    this.router.clearLLMInteractions();
  }

  getLastRouterLLMInteraction() {
    return this.router.getLastLLMInteraction();
  }
}