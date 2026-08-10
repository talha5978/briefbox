import type { IncomingEmail } from "~/types/email";
import type { ApiResponse } from "~/types/response";

const API_BASE = (process.env.API_BASE_URL || "http://localhost:4000") + "/api";

export function createApiClient(cookie?: string) {
	// This will collect every Set-Cookie we receive during this request
	const collectedCookies: string[] = [];

	async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
		const isFormData = options.body instanceof FormData;

		const headers: HeadersInit = {
			...(cookie ? { Cookie: cookie } : {}),
			...options.headers,
		};

		if (!isFormData && options.body && !("Content-Type" in headers) && !("content-type" in headers)) {
			(headers as Record<string, string>)["Content-Type"] = "application/json";
		}

		const url = `${API_BASE}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

		const res = await fetch(url, {
			...options,
			credentials: "include",
			headers,
		});

		// Collect Set-Cookie headers
		const setCookies = res.headers.getSetCookie?.() || [];
		collectedCookies.push(...setCookies);

		if (res.status === 204) {
			return null as T;
		}

		const json = (await res.json()) as ApiResponse<T>;

		if (!json.success) {
			const error = new Error(json.error.message);
			(error as any).code = json.error.code;
			(error as any).status = res.status;
			throw error;
		}

		return json.data;
	}

	return {
		getSession: () =>
			request<{
				email: string;
				sessionId: string;
				createdAt: number;
				expiresAt: number;
				remainingSeconds: number;
			}>("/session"),

		getEmails: () =>
			request<{
				emails: IncomingEmail[];
				count: number;
			}>("/emails"),

		getEmail: (emailId: string) => request<IncomingEmail>(`/emails/${emailId}`),

		request,

		/** Returns all Set-Cookie headers collected during this client lifetime */
		getSetCookies: () => collectedCookies,
	};
}

export function createApiClientFromRequest(request: Request) {
	const cookie = request.headers.get("Cookie") || "";
	return createApiClient(cookie);
}
