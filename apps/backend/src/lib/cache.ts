import { redis } from "~/lib/redis";

export const cache = {
	// ---------- Basic ----------
	async get<T = any>(key: string): Promise<T | null> {
		const value = await redis.get(key);
		if (!value) return null;
		try {
			return JSON.parse(value) as T;
		} catch {
			return value as unknown as T; // fallback for plain strings
		}
	},

	async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
		const serialized = typeof value === "string" ? value : JSON.stringify(value);

		if (ttlSeconds && ttlSeconds > 0) {
			await redis.set(key, serialized, "EX", ttlSeconds);
		} else {
			await redis.set(key, serialized);
		}
	},

	async del(key: string | string[]): Promise<void> {
		if (Array.isArray(key)) {
			if (key.length > 0) await redis.del(...key);
		} else {
			await redis.del(key);
		}
	},

	/** Safer alternative to KEYS for large datasets */
	async scan(pattern: string, count = 100): Promise<string[]> {
		const found: string[] = [];
		let cursor = "0";

		do {
			const [nextCursor, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", count);
			cursor = nextCursor;
			found.push(...keys);
		} while (cursor !== "0");

		return found;
	},

	async delByPattern(pattern: string): Promise<number> {
		const keys = await this.scan(pattern);
		if (keys.length === 0) return 0;
		await redis.del(...keys);
		return keys.length;
	},

	KEYS: {
		sessionKey: (id: string) => `session:${id}`,
		emailKey: (sessionId: string, emailId: string) => `email:${sessionId}:${emailId}`,
		emailPattern: (sessionId: string) => `email:${sessionId}:*`,
		emailToSession: (email: string) => `email-to-session:${email.toLowerCase()}`,
	},
};
