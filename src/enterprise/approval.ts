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

function validateTicketId(ticketId: string): void {
  if (!/^[\w\-]{1,64}$/.test(ticketId)) {
    throw new Error(`Invalid ticket ID "${ticketId}": use only letters, digits, hyphens, underscores (max 64 chars)`);
  }
}

export function generateApprovalRequest(
  ticketId: string,
  target: string,
  result: ScanResult,
  createdBy: string,
  cwd: string = process.cwd()
): string {
  validateTicketId(ticketId);
  const dir = ensureDir(cwd);
  const filePath = path.join(dir, `${ticketId}.json`);

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

  // Use 'wx' flag for atomic exclusive create — fails if file already exists
  try {
    fs.writeFileSync(filePath, JSON.stringify(request, null, 2), { encoding: "utf-8", flag: "wx" });
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "EEXIST") {
      console.error(`Approval request ${ticketId} already exists.`);
      process.exit(1);
    }
    throw err;
  }
  return filePath;
}

export function approveRequest(
  ticketId: string,
  approvedBy: string,
  notes: string,
  cwd: string = process.cwd()
): void {
  validateTicketId(ticketId);
  const filePath = path.join(cwd, APPROVAL_DIR, `${ticketId}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Approval request not found: ${ticketId}`);
  }
  let req: ApprovalRequest;
  try {
    req = JSON.parse(fs.readFileSync(filePath, "utf-8").replace(/^﻿/, "")) as ApprovalRequest;
  } catch {
    throw new Error(`Approval request file is corrupt: ${ticketId}`);
  }
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
  validateTicketId(ticketId);
  const filePath = path.join(cwd, APPROVAL_DIR, `${ticketId}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Approval request not found: ${ticketId}`);
  }
  let req: ApprovalRequest;
  try {
    req = JSON.parse(fs.readFileSync(filePath, "utf-8").replace(/^﻿/, "")) as ApprovalRequest;
  } catch {
    throw new Error(`Approval request file is corrupt: ${ticketId}`);
  }
  req.status = "rejected";
  req.approvedBy = rejectedBy;
  req.approvedAt = new Date().toISOString();
  req.notes = notes;
  fs.writeFileSync(filePath, JSON.stringify(req, null, 2), "utf-8");
}

export function getApprovalStatus(ticketId: string, cwd: string = process.cwd()): ApprovalRequest | null {
  validateTicketId(ticketId);
  const filePath = path.join(cwd, APPROVAL_DIR, `${ticketId}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8").replace(/^﻿/, "")) as ApprovalRequest;
}

export function listApprovals(cwd: string = process.cwd()): ApprovalRequest[] {
  const dir = path.join(cwd, APPROVAL_DIR);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .flatMap((f) => {
      try {
        return [JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8").replace(/^﻿/, "")) as ApprovalRequest];
      } catch {
        process.stderr.write(`Warning: skipped corrupt approval file: ${f}\n`);
        return [];
      }
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
