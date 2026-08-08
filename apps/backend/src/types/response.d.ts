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
		details?: any;
	};
};

export type ServiceResponse<T = any> = SuccessResponse<T> | ErrorResponse;
