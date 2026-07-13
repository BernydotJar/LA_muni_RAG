import type { DomainPack } from "../types.js";
import { commonFeedbackTypes, unknownAuthority } from "./common.js";

export const hrDomainPack: DomainPack = {
  id: "hr",
  name: "HR Procedure Assistant",
  description: "Evidence-first HR procedure assistant for handbook and policy workflows.",
  language: "en",
  branding: {
    productName: "Procedure Assistant",
    assistantName: "HR Workflow Advisor",
    organizationName: "HR",
    primaryLabel: "Policy-first",
  },
  workflowTypes: [
    { id: "employee_onboarding", label: "Employee onboarding", description: "New-hire onboarding workflow.", retrievalHints: ["employee onboarding new hire handbook role setup payroll benefits access"] },
    { id: "leave_request", label: "Leave request", description: "Leave and absence request workflow.", retrievalHints: ["leave request absence policy approval manager HR payroll"] },
    { id: "employee_offboarding", label: "Employee offboarding", description: "Exit and access closure workflow.", retrievalHints: ["offboarding termination exit checklist access return equipment final pay"] },
    { id: "disciplinary_process", label: "Disciplinary process", description: "Corrective action and documentation workflow.", retrievalHints: ["disciplinary policy corrective action warning investigation documentation"] },
    { id: "compensation_adjustment", label: "Compensation adjustment", description: "Compensation or salary change request.", retrievalHints: ["compensation adjustment salary change approval budget manager HR"] },
    { id: "unknown", label: "Unclassified HR workflow", description: "Generic HR policy workflow.", retrievalHints: ["HR policy procedure documents approval"] },
  ],
  sourceAuthorityClasses: [
    { id: "employee_handbook", label: "Employee handbook", description: "Employee handbook or core HR manual.", authorityLevel: "primary", titleKeywords: ["employee handbook", "handbook"], sourceTypes: ["handbook", "manual"] },
    { id: "onboarding_sop", label: "Onboarding SOP", description: "Onboarding procedure or checklist.", authorityLevel: "primary", titleKeywords: ["onboarding", "new hire"], sourceTypes: ["procedure", "sop"] },
    { id: "leave_policy", label: "Leave policy", description: "Leave, PTO, vacation, or absence policy.", authorityLevel: "primary", titleKeywords: ["leave policy", "pto", "absence", "vacation"], sourceTypes: ["policy"] },
    { id: "disciplinary_policy", label: "Disciplinary policy", description: "Corrective action or discipline policy.", authorityLevel: "primary", titleKeywords: ["disciplinary", "corrective action", "warning"], sourceTypes: ["policy"] },
    { id: "benefits_documentation", label: "Benefits documentation", description: "Benefits, payroll, or compensation documentation.", authorityLevel: "primary", titleKeywords: ["benefits", "payroll", "compensation", "salary"], sourceTypes: ["policy", "guide"] },
    { id: "role_description", label: "Role description", description: "Job or role description.", authorityLevel: "context", titleKeywords: ["job description", "role description"], sourceTypes: ["job_description"] },
    unknownAuthority,
  ],
  classifierRules: [
    { id: "onboarding", workflowType: "employee_onboarding", keywords: ["onboard", "onboarding", "new hire", "employee setup"], retrievalQueries: ["employee onboarding new hire handbook role setup payroll benefits access"] },
    { id: "leave", workflowType: "leave_request", keywords: ["leave", "pto", "vacation", "absence", "time off"], retrievalQueries: ["leave request absence policy approval manager HR payroll"] },
    { id: "offboarding", workflowType: "employee_offboarding", keywords: ["offboard", "offboarding", "termination", "exit"], retrievalQueries: ["offboarding termination exit checklist access return equipment final pay"] },
    { id: "discipline", workflowType: "disciplinary_process", keywords: ["disciplinary", "discipline", "corrective action", "warning"], retrievalQueries: ["disciplinary policy corrective action warning investigation documentation"] },
    { id: "compensation", workflowType: "compensation_adjustment", keywords: ["compensation", "salary", "raise", "adjustment"], retrievalQueries: ["compensation adjustment salary change approval budget manager HR"] },
    { id: "generic", workflowType: "unknown", keywords: ["policy", "procedure", "workflow", "documents"], retrievalQueries: ["HR policy procedure documents approval"] },
  ],
  workflowTemplates: [
    {
      workflowType: "employee_onboarding",
      title: "Employee onboarding workflow",
      defaultSummary: "I organized an evidence-first onboarding workflow from available HR sources.",
      validationWarning: "Validate against the current handbook, onboarding SOP, role requirements, payroll, benefits, and access-control owners.",
      steps: [
        { title: "Confirm hiring trigger", action: "Confirm accepted offer, role, start date, manager, and onboarding owner.", requiredDocuments: ["Offer acceptance", "Role description", "Start date"], outputDocuments: ["Onboarding case opened"], evidencePatterns: ["offer", "role", "start"] },
        { title: "Prepare access and equipment", action: "Coordinate accounts, systems, device, workspace, and security requirements.", requiredDocuments: ["Access request", "Equipment checklist"], outputDocuments: ["Access setup checklist"], evidencePatterns: ["access", "equipment", "security"] },
        { title: "Complete HR forms and benefits", action: "Collect required forms and benefits enrollment materials.", requiredDocuments: ["Employee forms", "Benefits documentation", "Payroll setup"], outputDocuments: ["Completed HR packet"], evidencePatterns: ["forms", "benefits", "payroll"] },
      ],
    },
    {
      workflowType: "leave_request",
      title: "Leave request workflow",
      defaultSummary: "I organized a leave request workflow based on available HR policy evidence.",
      validationWarning: "Validate leave eligibility, approvals, legal obligations, and payroll impact with HR before acting.",
      steps: [
        { title: "Check eligibility", action: "Confirm leave type, balance, notice, and policy criteria.", requiredDocuments: ["Leave policy", "Balance record"], outputDocuments: ["Eligibility check"], evidencePatterns: ["eligibility", "balance", "leave"] },
        { title: "Route approval", action: "Route the request to the manager or HR owner defined by policy.", requiredDocuments: ["Leave request", "Manager approval"], outputDocuments: ["Approval decision"], evidencePatterns: ["approval", "manager", "HR"] },
        { title: "Record and coordinate", action: "Record approved leave and coordinate payroll/team coverage.", requiredDocuments: ["Approved request", "Payroll note"], outputDocuments: ["Leave recorded"], evidencePatterns: ["record", "payroll", "coverage"] },
      ],
    },
    {
      workflowType: "unknown",
      title: "Preliminary HR workflow",
      defaultSummary: "I found an HR procedural question but need more policy evidence to make it specific.",
      validationWarning: "Treat this as a checklist until validated by HR and the governing policy.",
      steps: [
        { title: "Identify governing policy", action: "Find the handbook, policy, SOP, or role document that controls the request.", requiredDocuments: ["Policy or SOP"], outputDocuments: ["Governing source identified"], evidencePatterns: ["policy", "sop", "handbook"] },
        { title: "Identify owner and approval", action: "Confirm the responsible role and approval path.", requiredDocuments: ["Approval matrix", "Role owner"], outputDocuments: ["Owner identified"], evidencePatterns: ["approval", "owner", "manager"] },
      ],
    },
  ],
  governanceRules: [
    { id: "policy-first", label: "Policy-first", warning: "Do not present an HR step as required unless supported by handbook, policy, SOP, or authorized HR guidance." },
  ],
  feedbackTypes: commonFeedbackTypes,
  exampleQueries: ["How do we onboard a new employee?", "What documents are needed for a leave request?", "How do we offboard an employee?"],
  evaluationCases: [
    { id: "hr-onboarding", query: "How do we onboard a new employee?", expectedWorkflowType: "employee_onboarding", notes: "Must use HR policy language and avoid scoring employees." },
  ],
};
