import type { FastifyInstance } from "fastify";
import errorHandlerPlugin from "~/plugins/error-handler";
import sessionPlugin from "~/plugins/session";
import fastifyCookie from "@fastify/cookie";
import fastifyCors from "@fastify/cors";
import helmet from "@fastify/helmet";
import csrf from "@fastify/csrf-protection";
import rateLimit from "@fastify/rate-limit";
import sessionRoutes from "~/routes/session.routes";
import emailRoutes from "~/routes/email.routes";
import { webhookRoutes } from "~/routes/webhook";

export async function server(fastify: FastifyInstance) {
	await fastify.register(errorHandlerPlugin);

	await fastify.register(fastifyCors, {
		origin: [process.env.WEB_URL || "http://localhost:5170"],
		methods: ["GET", "POST", "OPTIONS"],
		credentials: true,
		allowedHeaders: ["Content-Type", "Authorization"],
		exposedHeaders: ["Set-Cookie"],
	});

	await fastify.register(helmet, {
		contentSecurityPolicy: {
			directives: {
				defaultSrc: ["'self'"],
				scriptSrc: ["'self'"],
				styleSrc: ["'self'", "'unsafe-inline'"],
				imgSrc: ["'self'", "data:", "https:"],
			},
		},
		crossOriginEmbedderPolicy: false,
	});

	await fastify.register(rateLimit, {
		global: true,
		max: 100,
		timeWindow: "1 minute",
		hook: "onRequest",
		keyGenerator: (request) => {
			return (
				(request.headers["cf-connecting-ip"] as string) ||
				(request.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
				request.ip
			);
		},
		errorResponseBuilder: (_request, context) => {
			return {
				success: false,
				error: {
					code: "RATE_LIMITED",
					message: `Too many requests. Retry in ${Math.ceil(context.ttl / 1000)}s`,
				},
			};
		},
	});

	await fastify.register(csrf, {
		cookieOpts: { httpOnly: true, secure: process.env.NODE_ENV === "production" },
	});

	await fastify.register(fastifyCookie);

	await fastify.register(sessionPlugin);

	await fastify.register(sessionRoutes, { prefix: "/api/session" });
	await fastify.register(emailRoutes, { prefix: "/api/emails" });
	await fastify.register(webhookRoutes, { prefix: "/api/webhook" });

	await fastify.get("/api/health", async () => {
		return { status: "ok" };
	});
}
