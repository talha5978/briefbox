import { randomUUID } from "crypto";
import { cache } from "~/lib/cache";
import type { IncomingEmail } from "~/types/email";
import { SESSION_TTL_SECONDS } from "~/utils/session";

export class EmailService {
	/**
	 * Store a new incoming email
	 */
	static async store(
		sessionId: string,
		data: Omit<IncomingEmail, "id" | "sessionId" | "receivedAt">,
	): Promise<IncomingEmail> {
		const email: IncomingEmail = {
			id: randomUUID(),
			sessionId,
			receivedAt: Date.now(),
			...data,
		};

		await cache.set(cache.KEYS.emailKey(sessionId, email.id), email, SESSION_TTL_SECONDS);

		return email;
	}

	/**
	 * Get all emails for a session (newest first)
	 */
	static async getBySession(sessionId: string): Promise<IncomingEmail[]> {
		const keys = await cache.scan(cache.KEYS.emailPattern(sessionId));

		if (keys.length === 0) return [];

		const emails = await Promise.all(keys.map((key) => cache.get<IncomingEmail>(key)));

		const validEmails = emails.filter((e): e is IncomingEmail => e !== null);

		// Newest first
		return validEmails.sort((a, b) => b.receivedAt - a.receivedAt);
	}

	/**
	 * Get a single email
	 */
	static async getById(sessionId: string, emailId: string): Promise<IncomingEmail | null> {
		return cache.get<IncomingEmail>(cache.KEYS.emailKey(sessionId, emailId));
	}

	/**
	 * Delete all emails belonging to a session
	 */
	static async deleteAllBySession(sessionId: string): Promise<number> {
		return cache.delByPattern(cache.KEYS.emailPattern(sessionId));
	}
}
