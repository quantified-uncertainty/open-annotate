"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ClipboardDocumentIcon, CheckIcon } from "@heroicons/react/24/outline";

const agentDocumentationForHumans = `# Agent Documentation for Humans

Learn how to create and use AI agents to evaluate your documents in Roast My Post.

## What Are Agents?

Agents are AI-powered evaluators that analyze your documents from specific perspectives. Think of them as expert reviewers, each with their own specialty and approach to providing feedback.

## Types of Agents

We have four types of agents, each serving a different purpose:

### 🎯 ASSESSOR
**Purpose**: Critical evaluation and quality assessment
- Points out flaws and weaknesses
- Evaluates against specific criteria
- Provides grades and scores
- Best for: Academic papers, technical documentation, grant proposals

**Example**: "Academic Rigor Assessor" checks research papers for methodology flaws, citation quality, and logical consistency.

### 💡 ADVISOR
**Purpose**: Constructive suggestions and improvements
- Offers actionable recommendations
- Suggests enhancements and alternatives
- Focuses on how to make things better
- Best for: Draft documents, business plans, creative writing

**Example**: "Startup Pitch Advisor" helps refine your pitch deck with suggestions for clearer messaging and stronger value propositions.

### 📚 ENRICHER
**Purpose**: Adding context and supplementary information
- Provides additional references
- Adds historical or cultural context
- Connects to related concepts
- Best for: Educational content, research summaries, wiki articles

**Example**: "Historical Context Enricher" adds relevant historical background and connects your content to broader trends.

### 🔍 EXPLAINER
**Purpose**: Clarification and simplification
- Breaks down complex concepts
- Provides analogies and examples
- Makes content more accessible
- Best for: Technical content, academic papers, policy documents

**Example**: "Jargon Translator" identifies technical terms and provides plain-language explanations.

## How to Use Existing Agents

1. **Browse Available Agents**
   - Go to the [Agents page](/agents)
   - Read agent descriptions to find ones matching your needs
   - Check the "purpose" tag to understand their approach

2. **Submit Your Document**
   - Upload or paste your document
   - Select one or more agents for evaluation
   - Click "Start Evaluation"

3. **Review Feedback**
   - **Summary**: Quick overview of the evaluation
   - **Highlighted Comments**: Specific feedback on document sections
   - **Analysis**: Detailed evaluation narrative
   - **Grades**: Numerical scores (if provided by the agent)

## Creating Your Own Agent

### Step 1: Define Your Agent's Identity

Start with the basics:
- **Name**: Clear, descriptive title (e.g., "SEO Content Optimizer")
- **Purpose**: Choose from ASSESSOR, ADVISOR, ENRICHER, or EXPLAINER
- **Description**: 1-2 sentences explaining what your agent does

### Step 2: Write Primary Instructions

This is where you define your agent's behavior. Structure your instructions clearly:

\`\`\`markdown
## Role
You are a [specific type of expert] with experience in [relevant domains].
You specialize in [specific skills or knowledge areas].

## Your Task
When evaluating documents, you will:
1. [First key responsibility]
2. [Second key responsibility]
3. [Third key responsibility]

## Evaluation Framework
[Describe the criteria or methodology your agent uses]

## Output Guidelines
- Summary: [What to include in the 2-3 paragraph summary]
- Comments: [Types of issues to highlight and comment on]
- Analysis: [Structure and focus areas for detailed analysis]
\`\`\`

### Step 3: Add Examples

Include 2-3 concrete examples showing:
- Sample document excerpts
- How your agent would comment on them
- What text to highlight
- The type of feedback to provide

### Step 4: Set Up Grading (Optional)

If your agent provides grades:
- Define what scores mean (e.g., "90-100 = Excellent")
- List specific criteria and their weights
- Explain how to calculate overall scores

### Step 5: Write Self-Critique Instructions (Optional)

Help your agent evaluate its own performance:
\`\`\`markdown
Rate your evaluation quality:
- 90-100: Comprehensive, actionable, well-evidenced
- 70-89: Good coverage, mostly helpful
- 50-69: Basic evaluation, some gaps
- Below 50: Significant issues missed
\`\`\`

## Best Practices

### DO:
✅ Be specific about your agent's expertise and perspective
✅ Include detailed examples in your instructions
✅ Define clear evaluation criteria
✅ Keep comments constructive and actionable
✅ Test your agent on various document types

### DON'T:
❌ Make instructions too brief (aim for 1,000+ words)
❌ Create agents that are too general
❌ Forget to specify output format requirements
❌ Use overly critical or harsh language
❌ Duplicate existing agents without adding value

## Advanced Features

### Highlight Guidelines
- Keep highlights short and focused (under 1000 characters)
- Select the most relevant portion of text
- Ensure highlights support your comments

### Multi-Domain Agents
Create agents that evaluate from multiple perspectives:
\`\`\`markdown
<expertise_areas>
  <technical_accuracy>
    Evaluate code examples and technical claims
  </technical_accuracy>
  <readability>
    Assess clarity and accessibility
  </readability>
  <completeness>
    Check for missing information
  </completeness>
</expertise_areas>
\`\`\`

### Conditional Logic
Make your agent adaptive:
\`\`\`markdown
If the document is a research paper:
  - Focus on methodology and evidence
  - Check citation quality
  
If the document is a blog post:
  - Prioritize readability and engagement
  - Evaluate SEO elements
\`\`\`

## Examples of Great Agents

### "Grant Proposal Assessor"
- **Purpose**: ASSESSOR
- **Strengths**: Detailed scoring rubric, checks against funder requirements
- **Instructions**: 8,000 words with examples from successful grants

### "Plain Language Advisor"
- **Purpose**: ADVISOR
- **Strengths**: Specific rewriting suggestions, readability metrics
- **Instructions**: 5,000 words with before/after examples

### "Academic Literature Enricher"
- **Purpose**: ENRICHER
- **Strengths**: Adds relevant citations, connects to current research
- **Instructions**: 6,000 words with citation formatting examples

## Getting Help

- **Examples**: Check out [popular agents](/agents) for inspiration
- **Community**: Join our [Discord](https://discord.gg/nsTmQqHRnV) to discuss agent creation
- **Support**: Email us at contact@quantifieduncertainty.org

Remember: The best agents are specialized, detailed, and provide actionable feedback. Start simple and refine based on results!`;

export default function AgentsHumansPage() {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(agentDocumentationForHumans);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  return (
    <div className="rounded-lg bg-white p-8 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          Agent Documentation for Humans
        </h1>
        <button
          onClick={copyToClipboard}
          className="inline-flex items-center rounded-md bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
        >
          {copied ? (
            <>
              <CheckIcon className="mr-2 h-4 w-4" />
              Copied!
            </>
          ) : (
            <>
              <ClipboardDocumentIcon className="mr-2 h-4 w-4" />
              Copy as MD
            </>
          )}
        </button>
      </div>
      
      <div className="prose prose-gray max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{agentDocumentationForHumans}</ReactMarkdown>
      </div>
    </div>
  );
}