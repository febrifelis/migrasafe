import https from "https";
import http from "http";
import crypto from "crypto";
import { ScanResult } from "../types";

export interface NotificationConfig {
  slackWebhookUrl?: string;
  webhookUrl?: string;
  webhookSecret?: string;
  notifyOnUnsafe?: boolean;
  notifyAlways?: boolean;
}

interface SlackBlock {
  type: string;
  text?: { type: string; text: string; emoji?: boolean };
  fields?: { type: string; text: string }[];
}

function post(url: string, body: string, headers: Record<string, string> = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === "https:" ? https : http;
    const req = lib.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body), ...headers },
    }, (res) => {
      res.resume();
      if ((res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300) resolve();
      else reject(new Error(`HTTP ${res.statusCode}`));
    });
    req.on("error", (err: Error) => reject(new Error(`Webhook request failed: ${err.message}`)));
    req.write(body);
    req.end();
  });
}

function validateWebhookUrl(url: string, label: string): void {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") throw new Error("must use https://");
  } catch (e) {
    throw new Error(`Invalid ${label}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function sendSlackNotification(
  result: ScanResult,
  target: string,
  cfg: NotificationConfig
): Promise<void> {
  if (!cfg.slackWebhookUrl) return;
  validateWebhookUrl(cfg.slackWebhookUrl, "slackWebhookUrl");
  if (!cfg.notifyAlways && result.safe && !cfg.notifyOnUnsafe) return;
  if (cfg.notifyOnUnsafe && result.safe) return;

  const statusEmoji = result.safe ? ":white_check_mark:" : ":x:";
  const statusText = result.safe ? "SAFE" : "UNSAFE";
  const riskEmoji = result.risk.level === "CRITICAL" ? ":red_circle:" : result.risk.level === "HIGH" ? ":large_orange_circle:" : ":large_yellow_circle:";

  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: { type: "plain_text", text: `${statusEmoji} migrasafe — ${statusText}`, emoji: true },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Target:*\n${target}` },
        { type: "mrkdwn", text: `*Risk:*\n${riskEmoji} ${result.risk.score}/100 ${result.risk.level}` },
        { type: "mrkdwn", text: `*CRITICAL:*\n${result.criticalCount}` },
        { type: "mrkdwn", text: `*HIGH:*\n${result.highCount}` },
        { type: "mrkdwn", text: `*MEDIUM:*\n${result.mediumCount}` },
        { type: "mrkdwn", text: `*Total Issues:*\n${result.totalIssues}` },
      ],
    },
  ];

  if (!result.safe) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: ":warning: *Resolve CRITICAL/HIGH issues before deploying to production.*" },
    });
  }

  await post(cfg.slackWebhookUrl, JSON.stringify({ blocks }));
}

export async function sendWebhookNotification(
  result: ScanResult,
  target: string,
  cfg: NotificationConfig
): Promise<void> {
  if (!cfg.webhookUrl) return;
  validateWebhookUrl(cfg.webhookUrl, "webhookUrl");
  if (!cfg.notifyAlways && result.safe) return;

  const payload = {
    tool: "migrasafe",
    timestamp: new Date().toISOString(),
    target,
    safe: result.safe,
    risk: result.risk,
    summary: {
      critical: result.criticalCount,
      high: result.highCount,
      medium: result.mediumCount,
      total: result.totalIssues,
    },
  };

  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {};
  if (cfg.webhookSecret) {
    // Sign with HMAC-SHA256 — receiver should verify X-Migrasafe-Signature, not store the raw secret
    const sig = crypto.createHmac("sha256", cfg.webhookSecret).update(body).digest("hex");
    headers["X-Migrasafe-Signature"] = `sha256=${sig}`;
  }

  await post(cfg.webhookUrl, body, headers);
}
