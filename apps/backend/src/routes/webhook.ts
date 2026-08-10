import type { FastifyPluginAsync } from "fastify";
import { simpleParser } from "mailparser";
import { cache } from "~/lib/cache";
import { EmailService } from "~/services/email.service";
import { ApiError } from "~/utils/ApiError";
import { scanEmailSafety } from "~/utils/EmailSafety";

interface WebhookPayload {
	from: string;
	to: string;
	subject: string;
	raw: string;
	headers?: Record<string, string>;
	receivedAt?: string;
}

export const webhookRoutes: FastifyPluginAsync = async (fastify) => {
	fastify.post<{ Body: WebhookPayload }>("/email", async (request, reply) => {
		const secret = request.headers["x-webhook-secret"];
		if (process.env.WEBHOOK_SECRET && secret !== process.env.WEBHOOK_SECRET) {
			throw new ApiError("Invalid webhook secret", 401, "UNAUTHORIZED");
		}

		const { from, to, subject, raw } = request.body;

		if (!to || !from) {
			throw new ApiError("Missing from/to", 400, "BAD_REQUEST");
		}

		const sessionId = await cache.get<string>(cache.KEYS.emailToSession(to.toLowerCase()));

		if (!sessionId) {
			return reply.success({ stored: false, reason: "unknown_address" });
		}

		// Parse full MIME email
		const parsed = await simpleParser(raw);

		const text = parsed.text?.trim() || "";
		const html = typeof parsed.html === "string" ? parsed.html : undefined;

		const links = extractLinks([text, html, raw].filter(Boolean).join(" "));

		const safety = scanEmailSafety({
			from: parsed.from?.text || from,
			to,
			subject: parsed.subject || subject || "(no subject)",
			text,
			html,
			links,
		});

		const email = await EmailService.store(sessionId, {
			from: parsed.from?.text || from,
			to,
			subject: parsed.subject || subject || "(no subject)",
			text: text || stripHtml(html || ""),
			html,
			links,
			riskScore: safety.riskScore,
			riskLevel: safety.riskLevel,
		});

		return reply.success({ stored: true, emailId: email.id });
	});
};

function extractLinks(content: string): string[] {
	const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
	const matches = content.match(urlRegex) || [];
	return [...new Set(matches)];
}

function stripHtml(html: string): string {
	return html
		.replace(/<style[\s\S]*?<\/style>/gi, "")
		.replace(/<script[\s\S]*?<\/script>/gi, "")
		.replace(/<[^>]+>/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}
