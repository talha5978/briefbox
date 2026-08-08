import "fastify";

declare module "fastify" {
	interface FastifyReply {
		success<D>(data: D, message?: string, statusCode?: number): FastifyReply;
	}
}
