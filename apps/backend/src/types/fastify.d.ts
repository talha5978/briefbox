import "fastify";
import type { SessionData } from "~/types/session";

declare module "fastify" {
	interface FastifyReply {
		success<D>(data: D, message?: string, statusCode?: number): FastifyReply;
	}

	interface FastifyRequest {
		session: SessionData | null;
	}
}
