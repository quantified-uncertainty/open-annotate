import type { EvaluationAgent } from '@/types/evaluationAgents';

export const agent: EvaluationAgent = {
  id: "bias-detector",
  name: "Bias Detector",
  version: "3.9",
  description: "Identifies potential biases in language, framing, representation, and reasoning. Analyzes content for fairness, inclusivity, and balanced perspective.",
  iconName: "MagnifyingGlassIcon",
  color: "bg-teal-100 text-teal-800",
  capabilities: [
    "Language bias detection",
    "Representation analysis",
    "Perspective diversity assessment",
    "Citation and reference diversity evaluation"
  ],
  use_cases: [
    "Media content analysis",
    "Policy document review",
    "Educational material assessment",
    "Organizational communication evaluation"
  ],
  limitations: [
    "May reflect training data biases",
    "Cultural context limitations",
    "Cannot assess all forms of subtle bias"
  ]
};