export type SuccessResponse<T = any> = {
	success: true;
	data: T;
	message?: string;
};

export type ErrorResponse = {
	success: false;
	error: {
		code: string;
		message: string;
	};
};

export type ApiResponse<T = any> = SuccessResponse<T> | ErrorResponse;
