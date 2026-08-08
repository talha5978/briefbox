import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import type { ErrorResponse, SuccessResponse } from "~/types/response";
import { ApiError } from "~/utils/ApiError";

class ErrorHandlerPlugin {
	async register(fastify: FastifyInstance) {
		/** Global error handler */
		fastify.setErrorHandler(async (error: any, request: FastifyRequest, reply: FastifyReply) => {
			let statusCode = 500;
			let errorCode = "INTERNAL_SERVER_ERROR";
			let message = "Something went wrong";
			let details: any = null;

			if (error instanceof ApiError || error.name === "ApiError") {
				statusCode = error.statusCode || 400;
				errorCode = error.code || "BAD_REQUEST";
				message = error.message;
				details = error.details || null;
			} else {
				statusCode = 500;
				errorCode = error.code || "INTERNAL_SERVER_ERROR";
				message = error.statusText || "Something went wrong";
			}

			request.log.error({
				error: error.message,
				reqId: request.id,
				url: request.url,
				method: request.method,
			});

			const errorResponse: ErrorResponse = {
				success: false,
				error: {
					code: errorCode,
					message,
					...(details && { details }),
				},
			};

			return reply.status(statusCode).send(errorResponse);
		});

		/** Success response decorator */
		fastify.decorateReply("success", function <
			T,
		>(this: FastifyReply, data: T, message?: string, statusCode = 200) {
			if (statusCode >= 300) {
				throw new ApiError(
					"Invalid status code for success response",
					statusCode,
					"INVALID_STATUS_CODE",
					{ url: this.routeOptions.url },
				);
			}

			return this.status(statusCode).send({
				success: true,
				data,
				...(message && { message }),
			} as SuccessResponse<T>);
		});
	}
}

const errorHandlerInternal = async (fastify: FastifyInstance) => {
	const pluginInstance = new ErrorHandlerPlugin();
	await pluginInstance.register(fastify);
};

export default fp(errorHandlerInternal, {
	name: "error-handler-plugin",
});
