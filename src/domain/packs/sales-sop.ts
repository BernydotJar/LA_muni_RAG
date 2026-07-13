import type { DomainPack } from "../types.js";
import { commonFeedbackTypes, unknownAuthority } from "./common.js";

export const salesSopDomainPack: DomainPack = {
  id: "sales-sop",
  name: "Sales SOP Assistant",
  description: "Evidence-first sales SOP workflow assistant.",
  language: "en",
  branding: {
    productName: "Procedure Assistant",
    assistantName: "Sales SOP Advisor",
    organizationName: "Sales",
    primaryLabel: "Playbook-first",
  },
  workflowTypes: [
    { id: "lead_qualification", label: "Lead qualification", description: "Lead qualification and routing workflow.", retrievalHints: ["lead qualification discovery criteria ICP sales playbook"] },
    { id: "price_objection_handling", label: "Price objection handling", description: "Pricing objection response workflow.", retrievalHints: ["price objection pricing playbook value proof discount"] },
    { id: "discount_approval", label: "Discount approval", description: "Discount approval and exception workflow.", retrievalHints: ["discount approval matrix pricing exception deal desk"] },
    { id: "opportunity_handoff", label: "Opportunity handoff", description: "Sales to success or implementation handoff.", retrievalHints: ["opportunity handoff customer success implementation checklist"] },
    { id: "proposal_preparation", label: "Proposal preparation", description: "Proposal preparation workflow.", retrievalHints: ["proposal preparation template pricing scope legal review"] },
    { id: "contract_closure", label: "Contract closure", description: "Contract close and signature workflow.", retrievalHints: ["contract closure legal redline signature procurement"] },
    { id: "unknown", label: "Unclassified sales workflow", description: "Generic sales SOP workflow.", retrievalHints: ["sales SOP playbook approval documentation"] },
  ],
  sourceAuthorityClasses: [
    { id: "qualification_playbook", label: "Qualification playbook", description: "Qualification criteria and discovery playbook.", authorityLevel: "primary", titleKeywords: ["qualification", "discovery", "icp"], sourceTypes: ["playbook"] },
    { id: "pricing_policy", label: "Pricing policy", description: "Pricing, discount, or approval policy.", authorityLevel: "primary", titleKeywords: ["pricing", "discount", "approval matrix"], sourceTypes: ["policy"] },
    { id: "handoff_sop", label: "Handoff SOP", description: "Opportunity or customer handoff process.", authorityLevel: "primary", titleKeywords: ["handoff", "customer success", "implementation"], sourceTypes: ["sop"] },
    { id: "proposal_process", label: "Proposal process", description: "Proposal creation or review process.", authorityLevel: "primary", titleKeywords: ["proposal", "scope", "template"], sourceTypes: ["procedure"] },
    { id: "contracting_checklist", label: "Contracting checklist", description: "Contract, redline, or signature checklist.", authorityLevel: "primary", titleKeywords: ["contract", "redline", "signature"], sourceTypes: ["checklist"] },
    unknownAuthority,
  ],
  classifierRules: [
    { id: "qualification", workflowType: "lead_qualification", keywords: ["lead", "qualification", "qualify", "discovery"], retrievalQueries: ["lead qualification discovery criteria ICP sales playbook"] },
    { id: "price-objection", workflowType: "price_objection_handling", keywords: ["price objection", "pricing objection", "too expensive"], retrievalQueries: ["price objection pricing playbook value proof discount"] },
    { id: "discount", workflowType: "discount_approval", keywords: ["discount", "approval", "exception", "deal desk"], retrievalQueries: ["discount approval matrix pricing exception deal desk"] },
    { id: "handoff", workflowType: "opportunity_handoff", keywords: ["handoff", "customer success", "implementation"], retrievalQueries: ["opportunity handoff customer success implementation checklist"] },
    { id: "proposal", workflowType: "proposal_preparation", keywords: ["proposal", "scope", "quote"], retrievalQueries: ["proposal preparation template pricing scope legal review"] },
    { id: "contract", workflowType: "contract_closure", keywords: ["contract", "redline", "signature", "close"], retrievalQueries: ["contract closure legal redline signature procurement"] },
    { id: "generic", workflowType: "unknown", keywords: ["sales", "sop", "playbook", "workflow"], retrievalQueries: ["sales SOP playbook approval documentation"] },
  ],
  workflowTemplates: [
    {
      workflowType: "lead_qualification",
      title: "Lead qualification workflow",
      defaultSummary: "I organized a playbook-first qualification workflow from available sales evidence.",
      validationWarning: "Validate against the current qualification playbook and avoid using this as punitive rep scoring.",
      steps: [
        { title: "Confirm fit criteria", action: "Check ICP, use case, buyer role, urgency, and disqualification criteria.", requiredDocuments: ["Qualification playbook", "ICP criteria"], outputDocuments: ["Qualified/disqualified decision"], evidencePatterns: ["icp", "criteria", "fit"] },
        { title: "Capture discovery evidence", action: "Record pain, impact, stakeholders, timeline, and next step.", requiredDocuments: ["Discovery notes", "Opportunity record"], outputDocuments: ["Discovery summary"], evidencePatterns: ["discovery", "pain", "stakeholder"] },
        { title: "Route next action", action: "Move to nurture, AE handoff, or disqualification according to playbook.", requiredDocuments: ["Routing rule", "Handoff note"], outputDocuments: ["Next-action owner"], evidencePatterns: ["handoff", "route", "next"] },
      ],
    },
    {
      workflowType: "discount_approval",
      title: "Discount approval workflow",
      defaultSummary: "I organized a discount approval workflow based on available pricing evidence.",
      validationWarning: "Validate against current pricing policy, approval matrix, and deal desk rules.",
      steps: [
        { title: "Document discount rationale", action: "Capture business reason, competitive context, deal value, and requested exception.", requiredDocuments: ["Pricing policy", "Opportunity context"], outputDocuments: ["Discount rationale"], evidencePatterns: ["discount", "rationale", "pricing"] },
        { title: "Route approval", action: "Route to the required approver or deal desk path.", requiredDocuments: ["Approval matrix", "Requested discount"], outputDocuments: ["Approval decision"], evidencePatterns: ["approval", "deal desk", "matrix"] },
        { title: "Update proposal and audit trail", action: "Update customer-facing proposal and internal record after approval.", requiredDocuments: ["Approval record", "Proposal"], outputDocuments: ["Approved proposal"], evidencePatterns: ["proposal", "record", "approval"] },
      ],
    },
    {
      workflowType: "unknown",
      title: "Preliminary sales SOP workflow",
      defaultSummary: "I found a sales procedural question but need more playbook evidence to make it specific.",
      validationWarning: "Treat this as a checklist until validated by the current sales SOP owner.",
      steps: [
        { title: "Identify governing playbook", action: "Find the sales playbook, SOP, policy, or approval matrix that controls the request.", requiredDocuments: ["Playbook or SOP"], outputDocuments: ["Governing source identified"], evidencePatterns: ["playbook", "sop", "policy"] },
      ],
    },
  ],
  governanceRules: [
    { id: "playbook-first", label: "Playbook-first", warning: "Do not present a sales step as required unless supported by a current playbook, SOP, policy, or approval matrix." },
  ],
  feedbackTypes: commonFeedbackTypes,
  exampleQueries: ["How do we qualify a lead?", "What is the discount approval workflow?", "How should we prepare a proposal?"],
  evaluationCases: [
    { id: "sales-discount", query: "What is the discount approval workflow?", expectedWorkflowType: "discount_approval", notes: "Must preserve approval guardrails." },
  ],
};
