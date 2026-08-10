import type { FastifyReply, FastifyRequest } from "fastify";
import { cache } from "~/lib/cache";
import type { SessionData } from "~/types/session";
import {
	createSessionData,
	isSessionExpired,
	SESSION_COOKIE_NAME,
	SESSION_TTL_SECONDS,
} from "~/utils/session";

export class SessionService {
	/** Create a brand new session and set the cookie */
	static async create(reply: FastifyReply, email: string): Promise<SessionData> {
		const session = createSessionData(email);

		await Promise.all([
			cache.set(cache.KEYS.sessionKey(session.sessionId), session, SESSION_TTL_SECONDS),
			cache.set(cache.KEYS.emailToSession(email.toLowerCase()), session.sessionId, SESSION_TTL_SECONDS),
		]);

		reply.setCookie(SESSION_COOKIE_NAME, session.sessionId, {
			path: "/",
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax",
			maxAge: SESSION_TTL_SECONDS,
		});

		return session;
	}

	/** Get current session from cookie + Redis */
	static async get(request: FastifyRequest, reply: FastifyReply): Promise<SessionData | null> {
		const sessionId = request.cookies[SESSION_COOKIE_NAME];
		if (!sessionId) return null;

		const session = await cache.get<SessionData>(cache.KEYS.sessionKey(sessionId));
		if (!session) return null;

		if (isSessionExpired(session)) {
			await this.destroy(request, reply);
			return null;
		}

		return session;
	}

	/** Destroy session + all its emails */
	static async destroy(request: FastifyRequest, reply: FastifyReply): Promise<void> {
		const sessionId = request.cookies[SESSION_COOKIE_NAME];

		if (sessionId) {
			await this.destroyById(sessionId);
		}

		reply.clearCookie(SESSION_COOKIE_NAME, {
			path: "/",
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax",
		});
	}

	/** Internal helper – delete session + all emails by pattern */
	private static async destroyById(sessionId: string): Promise<void> {
		const session = await cache.get<SessionData>(cache.KEYS.sessionKey(sessionId));

		const tasks: Promise<any>[] = [
			cache.del(cache.KEYS.sessionKey(sessionId)),
			cache.delByPattern(cache.KEYS.emailPattern(sessionId)),
		];

		if (session?.email) {
			tasks.push(cache.del(cache.KEYS.emailToSession(session.email.toLowerCase())));
		}

		await Promise.all(tasks);
	}
}
