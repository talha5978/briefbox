import type { FastifyPluginAsync } from "fastify";
import { cache } from "~/lib/cache";
import { EmailService } from "~/services/email.service";
import { ApiError } from "~/utils/ApiError";

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
		console.log(request.body);

		if (!to || !from) {
			throw new ApiError("Missing from/to", 400, "BAD_REQUEST");
		}

		// Find which session owns this temporary address
		const sessionId = await cache.get<string>(cache.KEYS.emailToSession(to.toLowerCase()));

		if (!sessionId) {
			// Unknown address – just ignore (or log)
			return reply.success({ stored: false, reason: "unknown_address" });
		}

		// For now we store the raw content and a simple text version
		const text = extractTextFromRaw(raw);

		// Extract links (simple regex for MVP)
		const links = extractLinks(text + " " + (raw || ""));

		// Basic risk score
		const riskScore = 0;
		const riskLevel = "safe" as const;

		// Store the email
		const email = await EmailService.store(sessionId, {
			from,
			to,
			subject: subject || "(no subject)",
			text,
			html: undefined,
			links,
			riskScore,
			riskLevel,
		});

		return reply.success({ stored: true, emailId: email.id });
	});
};

function extractTextFromRaw(raw: string): string {
	// A real solution should use a proper MIME parser (mailparser)
	const match = raw.match(
		/Content-Type: text\/plain[\s\S]*?\r?\n\r?\n([\s\S]*?)(?=\r?\n--|\r?\nContent-Type:|$)/i,
	);
	if (match?.[1]) return match[1].trim();
	return raw.slice(0, 2000);
}

function extractLinks(content: string): string[] {
	const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
	const matches = content.match(urlRegex) || [];
	return [...new Set(matches)];
}
