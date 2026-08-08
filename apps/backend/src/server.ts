import type { FastifyInstance } from "fastify";
import errorHandlerPlugin from "~/plugins/error-handler";
import fastifyCookie from "@fastify/cookie";
import fastifyCors from "@fastify/cors";
import helmet from "@fastify/helmet";
import csrf from "@fastify/csrf-protection";

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

	await fastify.register(csrf, {
		cookieOpts: { httpOnly: true, secure: process.env.NODE_ENV === "production" },
	});

	await fastify.register(fastifyCookie);

	// await fastify.register(emailRoutes, { prefix: "/api/email" });
}
