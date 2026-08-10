import fp from "fastify-plugin";
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { SessionService } from "~/services/session.service";
import { generateTempEmail } from "~/utils/email";

const sessionPlugin: FastifyPluginAsync = async (fastify) => {
	fastify.decorateRequest("session", null);

	fastify.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
		let session = await SessionService.get(request, reply);

		if (!session) {
			const email = generateTempEmail();
			session = await SessionService.create(reply, email);
		}

		request.session = session;
	});
};

export default fp(sessionPlugin, {
	name: "session-plugin",
	dependencies: ["@fastify/cookie"],
});
