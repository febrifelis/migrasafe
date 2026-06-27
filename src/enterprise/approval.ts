import fs from "fs";
import path from "path";
import { ScanResult } from "../types";

export interface ApprovalRequest {
  ticketId: string;
  createdAt: string;
  createdBy: string;
  target: string;
  riskScore: number;
  riskLevel: string;
  totalIssues: number;
  status: "pending" | "approved" | "rejected";
  approvedBy?: string;
  approvedAt?: string;
  notes?: string;
}

const APPROVAL_DIR = ".migrasafe-approvals";

function ensureDir(cwd: string): string {
  const dir = path.join(cwd, APPROVAL_DIR);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function generateApprovalRequest(
  ticketId: string,
  target: string,
  result: ScanResult,
  createdBy: string,
  cwd: string = process.cwd()
): string {
  const dir = ensureDir(cwd);
  const filePath = path.join(dir, `${ticketId}.json`);

  if (fs.existsSync(filePath)) {
    console.error(`Approval request ${ticketId} already exists.`);
    process.exit(1);
  }

  const request: ApprovalRequest = {
    ticketId,
    createdAt: new Date().toISOString(),
    createdBy,
    target,
    riskScore: result.risk.score,
    riskLevel: result.risk.level,
    totalIssues: result.totalIssues,
    status: "pending",
  };

  fs.writeFileSync(filePath, JSON.stringify(request, null, 2), "utf-8");
  return filePath;
}

export function approveRequest(
  ticketId: string,
  approvedBy: string,
  notes: string,
  cwd: string = process.cwd()
): void {
  const filePath = path.join(cwd, APPROVAL_DIR, `${ticketId}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Approval request not found: ${ticketId}`);
  }
  const req = JSON.parse(fs.readFileSync(filePath, "utf-8")) as ApprovalRequest;
  if (req.status !== "pending") {
    throw new Error(`Approval request ${ticketId} is already ${req.status}`);
  }
  req.status = "approved";
  req.approvedBy = approvedBy;
  req.approvedAt = new Date().toISOString();
  req.notes = notes;
  fs.writeFileSync(filePath, JSON.stringify(req, null, 2), "utf-8");
}

export function rejectRequest(
  ticketId: string,
  rejectedBy: string,
  notes: string,
  cwd: string = process.cwd()
): void {
  const filePath = path.join(cwd, APPROVAL_DIR, `${ticketId}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Approval request not found: ${ticketId}`);
  }
  const req = JSON.parse(fs.readFileSync(filePath, "utf-8")) as ApprovalRequest;
  req.status = "rejected";
  req.approvedBy = rejectedBy;
  req.approvedAt = new Date().toISOString();
  req.notes = notes;
  fs.writeFileSync(filePath, JSON.stringify(req, null, 2), "utf-8");
}

export function getApprovalStatus(ticketId: string, cwd: string = process.cwd()): ApprovalRequest | null {
  const filePath = path.join(cwd, APPROVAL_DIR, `${ticketId}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as ApprovalRequest;
}

export function listApprovals(cwd: string = process.cwd()): ApprovalRequest[] {
  const dir = path.join(cwd, APPROVAL_DIR);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")) as ApprovalRequest)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
