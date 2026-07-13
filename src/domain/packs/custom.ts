import type { DomainPack } from "../types.js";
import { commonFeedbackTypes, unknownAuthority } from "./common.js";

export const customDomainPack: DomainPack = {
  id: "custom",
  name: "Custom Procedure Assistant",
  description: "Minimal starter pack for a custom evidence-first workflow assistant.",
  language: "en",
  branding: {
    productName: "Procedure Assistant",
    assistantName: "Workflow Advisor",
    primaryLabel: "Evidence-first",
  },
  workflowTypes: [
    { id: "custom_workflow", label: "Custom workflow", description: "Placeholder custom workflow.", retrievalHints: ["procedure workflow policy SOP evidence"] },
    { id: "unknown", label: "Unclassified workflow", description: "Generic workflow until configured.", retrievalHints: ["procedure workflow documents approval"] },
  ],
  sourceAuthorityClasses: [
    { id: "policy", label: "Policy", description: "Domain policy or rule.", authorityLevel: "primary", titleKeywords: ["policy"], sourceTypes: ["policy"] },
    { id: "sop", label: "SOP", description: "Standard operating procedure.", authorityLevel: "primary", titleKeywords: ["sop", "standard operating procedure", "procedure"], sourceTypes: ["sop", "procedure"] },
    { id: "reference", label: "Reference", description: "Comparative or contextual reference.", authorityLevel: "comparative", externalReference: true, titleKeywords: ["reference", "example"], sourceTypes: ["reference"] },
    unknownAuthority,
  ],
  classifierRules: [
    { id: "custom", workflowType: "custom_workflow", keywords: ["procedure", "workflow", "sop", "policy"], retrievalQueries: ["procedure workflow policy SOP evidence"] },
  ],
  workflowTemplates: [
    {
      workflowType: "custom_workflow",
      title: "Custom evidence-first workflow",
      defaultSummary: "I organized a preliminary workflow from available evidence.",
      validationWarning: "Validate every step against authoritative domain documents before use.",
      steps: [
        { title: "Identify governing source", action: "Find the authoritative policy, SOP, or document controlling the request.", requiredDocuments: ["Policy or SOP"], outputDocuments: ["Governing source identified"], evidencePatterns: ["policy", "sop", "procedure"] },
        { title: "Extract steps and owners", action: "List steps, responsible roles, required documents, outputs, deadlines, and decisions.", requiredDocuments: ["Procedure text"], outputDocuments: ["Draft workflow"], evidencePatterns: ["step", "owner", "approval"] },
        { title: "Validate with domain owner", action: "Confirm the workflow before treating it as operational guidance.", requiredDocuments: ["Draft workflow", "Citations"], outputDocuments: ["Validated workflow"], evidencePatterns: ["validate", "approval"] },
      ],
    },
  ],
  governanceRules: [
    { id: "evidence-first", label: "Evidence-first", warning: "Do not present a custom workflow as authoritative until configured with source authority rules and validated evidence." },
  ],
  feedbackTypes: commonFeedbackTypes,
  exampleQueries: ["What is the process for this SOP?", "Which documents are required for this workflow?"],
  evaluationCases: [
    { id: "custom-generic", query: "What is the process for this SOP?", expectedWorkflowType: "custom_workflow", notes: "Starter case for custom pack." },
  ],
};
