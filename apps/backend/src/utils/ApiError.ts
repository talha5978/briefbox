export class ApiError extends Error {
	statusCode: number;
	code: string;
	details?: any;

	constructor(message: string, statusCode: number = 400, code: string = "BAD_REQUEST", details?: any) {
		super(message);
		this.name = "ApiError";
		this.statusCode = statusCode;
		this.code = code;
		this.details = details;
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, ApiError);
		}
	}
}
