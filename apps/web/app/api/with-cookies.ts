import { data } from "react-router";

export function withCookies<T>(api: any, payload: T) {
	const setCookies = api.getSetCookies();

	if (setCookies.length === 0) {
		return payload;
	}

	return data(payload, {
		headers: {
			"Set-Cookie": setCookies,
		},
	});
}
