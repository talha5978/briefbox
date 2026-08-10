import type { FastifyPluginAsync } from "fastify";
import { EmailService } from "~/services/email.service";
import { ApiError } from "~/utils/ApiError";

const emailRoutes: FastifyPluginAsync = async (fastify) => {
	/**
	 * GET /
	 * Returns all emails for the current session (newest first)
	 */
	fastify.get("/", async (request, reply) => {
		const session = request.session;

		if (!session) {
			throw new ApiError("No active session", 401, "NO_SESSION");
		}

		const emails = await EmailService.getBySession(session.sessionId);

		return reply.success({
			emails,
			count: emails.length,
		});
	});

	/**
	 * GET /:emailId
	 * Returns a single email
	 */
	fastify.get<{
		Params: { emailId: string };
	}>("/:emailId", async (request, reply) => {
		const session = request.session;

		if (!session) {
			throw new ApiError("No active session", 401, "NO_SESSION");
		}

		const email = await EmailService.getById(session.sessionId, request.params.emailId);

		if (!email) {
			throw new ApiError("Email not found", 404, "EMAIL_NOT_FOUND");
		}

		return reply.success(email);
	});
};

export default emailRoutes;
