import type { FastifyPluginAsync } from "fastify";
import { getRemainingSeconds } from "~/utils/session";
import { ApiError } from "~/utils/ApiError";

const sessionRoutes: FastifyPluginAsync = async (fastify) => {
	/**
	 * GET /session
	 * Returns the current temporary email + remaining time
	 */
	fastify.get("/", async (request, reply) => {
		const session = request.session;

		if (!session) {
			throw new ApiError("No active session", 401, "NO_SESSION");
		}

		return reply.success({
			session: {
				email: session.email,
				sessionId: session.sessionId,
				createdAt: session.createdAt,
				expiresAt: session.expiresAt,
				remainingSeconds: getRemainingSeconds(session),
			},
			isNewSession: request.isNewSession,
		});
	});
};

export default sessionRoutes;
