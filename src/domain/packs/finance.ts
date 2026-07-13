import type { DomainPack } from "../types.js";
import { commonFeedbackTypes, unknownAuthority } from "./common.js";

export const financeDomainPack: DomainPack = {
  id: "finance",
  name: "Finance Procedure Assistant",
  description: "Evidence-first finance operations workflow assistant.",
  language: "en",
  branding: {
    productName: "Procedure Assistant",
    assistantName: "Finance Workflow Advisor",
    organizationName: "Finance",
    primaryLabel: "Control-first",
  },
  workflowTypes: [
    { id: "vendor_invoice_processing", label: "Vendor invoice processing", description: "Invoice intake, match, approval, and payment workflow.", retrievalHints: ["vendor invoice processing accounts payable purchase order approval payment"] },
    { id: "expense_approval", label: "Expense approval", description: "Employee expense review and reimbursement workflow.", retrievalHints: ["expense approval reimbursement receipt policy manager finance"] },
    { id: "month_end_close", label: "Month-end close", description: "Close checklist and reconciliation workflow.", retrievalHints: ["month end close reconciliation journal entry accrual review"] },
    { id: "audit_package_preparation", label: "Audit package preparation", description: "Audit request and evidence package workflow.", retrievalHints: ["audit package supporting documentation control evidence request"] },
    { id: "budget_transfer_request", label: "Budget transfer request", description: "Budget transfer or reallocation workflow.", retrievalHints: ["budget transfer request approval reallocation finance"] },
    { id: "unknown", label: "Unclassified finance workflow", description: "Generic finance procedure workflow.", retrievalHints: ["finance procedure policy approval documentation"] },
  ],
  sourceAuthorityClasses: [
    { id: "accounts_payable_sop", label: "Accounts payable SOP", description: "AP procedure or invoice processing SOP.", authorityLevel: "primary", titleKeywords: ["accounts payable", "invoice processing", "vendor invoice"], sourceTypes: ["sop", "procedure"] },
    { id: "expense_policy", label: "Expense policy", description: "Expense reimbursement or travel policy.", authorityLevel: "primary", titleKeywords: ["expense policy", "reimbursement", "travel"], sourceTypes: ["policy"] },
    { id: "approval_matrix", label: "Approval matrix", description: "Finance approval or delegation matrix.", authorityLevel: "primary", titleKeywords: ["approval matrix", "delegation", "authorization"], sourceTypes: ["matrix", "policy"] },
    { id: "close_checklist", label: "Close checklist", description: "Month-end close checklist or accounting close SOP.", authorityLevel: "primary", titleKeywords: ["month-end close", "month end close", "close checklist"], sourceTypes: ["checklist", "sop"] },
    { id: "audit_control", label: "Audit control", description: "Audit control, request, or evidence documentation.", authorityLevel: "primary", titleKeywords: ["audit", "control", "supporting documentation"], sourceTypes: ["control", "audit"] },
    unknownAuthority,
  ],
  classifierRules: [
    { id: "invoice", workflowType: "vendor_invoice_processing", keywords: ["invoice", "vendor invoice", "accounts payable", "ap"], retrievalQueries: ["vendor invoice processing accounts payable purchase order approval payment"] },
    { id: "expense", workflowType: "expense_approval", keywords: ["expense", "reimbursement", "receipt", "travel"], retrievalQueries: ["expense approval reimbursement receipt policy manager finance"] },
    { id: "close", workflowType: "month_end_close", keywords: ["month end", "month-end", "close", "reconciliation", "journal"], retrievalQueries: ["month end close reconciliation journal entry accrual review"] },
    { id: "audit", workflowType: "audit_package_preparation", keywords: ["audit", "supporting documentation", "evidence package"], retrievalQueries: ["audit package supporting documentation control evidence request"] },
    { id: "budget", workflowType: "budget_transfer_request", keywords: ["budget transfer", "reallocation", "budget request"], retrievalQueries: ["budget transfer request approval reallocation finance"] },
    { id: "generic", workflowType: "unknown", keywords: ["finance", "procedure", "approval", "policy"], retrievalQueries: ["finance procedure policy approval documentation"] },
  ],
  workflowTemplates: [
    {
      workflowType: "vendor_invoice_processing",
      title: "Vendor invoice processing workflow",
      defaultSummary: "I organized a control-first invoice workflow based on available finance evidence.",
      validationWarning: "Validate against current AP policy, approval matrix, tax requirements, and segregation-of-duties controls.",
      steps: [
        { title: "Receive and validate invoice", action: "Confirm vendor, invoice number, amount, tax fields, and required supporting documents.", requiredDocuments: ["Invoice", "Vendor record", "Supporting documentation"], outputDocuments: ["Validated invoice packet"], evidencePatterns: ["invoice", "vendor", "supporting"] },
        { title: "Match and code", action: "Match against purchase order or contract and assign accounting code.", requiredDocuments: ["PO or contract", "Coding guide"], outputDocuments: ["Matched and coded invoice"], evidencePatterns: ["purchase order", "contract", "code"] },
        { title: "Approve and schedule payment", action: "Route approval per matrix and schedule payment through authorized process.", requiredDocuments: ["Approval matrix", "Payment batch"], outputDocuments: ["Approved payment"], evidencePatterns: ["approval", "payment", "matrix"] },
      ],
    },
    {
      workflowType: "month_end_close",
      title: "Month-end close workflow",
      defaultSummary: "I organized a close workflow from available checklist and control evidence.",
      validationWarning: "Validate close deadlines, ownership, and controls with the finance close owner.",
      steps: [
        { title: "Confirm close calendar", action: "Identify close dates, owners, and required reconciliations.", requiredDocuments: ["Close calendar", "Owner list"], outputDocuments: ["Close plan"], evidencePatterns: ["calendar", "owner", "close"] },
        { title: "Complete reconciliations", action: "Prepare reconciliations, accruals, and journal entries.", requiredDocuments: ["Reconciliation templates", "Journal support"], outputDocuments: ["Reviewed reconciliations"], evidencePatterns: ["reconciliation", "journal", "accrual"] },
        { title: "Review and lock", action: "Complete review, resolve exceptions, and lock close package.", requiredDocuments: ["Review signoff", "Exception list"], outputDocuments: ["Closed period package"], evidencePatterns: ["review", "exception", "lock"] },
      ],
    },
    {
      workflowType: "unknown",
      title: "Preliminary finance workflow",
      defaultSummary: "I found a finance procedural question but need more control evidence to make it specific.",
      validationWarning: "Treat this as a checklist until validated by finance policy and control owners.",
      steps: [
        { title: "Identify policy and owner", action: "Find the policy, SOP, matrix, or control owner governing the request.", requiredDocuments: ["Policy or SOP", "Approval matrix"], outputDocuments: ["Control owner identified"], evidencePatterns: ["policy", "sop", "approval"] },
      ],
    },
  ],
  governanceRules: [
    { id: "control-first", label: "Control-first", warning: "Do not present a finance step as executable unless supported by current policy, approval matrix, SOP, or control documentation." },
  ],
  feedbackTypes: commonFeedbackTypes,
  exampleQueries: ["How do we process a vendor invoice?", "What is the month-end close workflow?", "How do we approve an employee expense?"],
  evaluationCases: [
    { id: "finance-invoice", query: "How do we process a vendor invoice?", expectedWorkflowType: "vendor_invoice_processing", notes: "Must preserve controls and approvals." },
  ],
};
