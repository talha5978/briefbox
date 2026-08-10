import type { SessionData } from "~/types/session";
import { convertExpiresInToSeconds } from "~/utils/time";

export const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "briefbox_session";

export const SESSION_TTL_SECONDS = convertExpiresInToSeconds(process.env.SESSION_TTL || "1h");

export function createSessionData(email: string): SessionData {
	const now = Date.now();
	const sessionId = crypto.randomUUID();

	return {
		sessionId,
		email,
		createdAt: now,
		expiresAt: now + SESSION_TTL_SECONDS * 1000,
	};
}

export function isSessionExpired(session: SessionData): boolean {
	return Date.now() >= session.expiresAt;
}

export function getRemainingSeconds(session: SessionData): number {
	return Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000));
}
