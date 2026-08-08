export function convertExpiresInToSeconds(expiresIn?: string): number {
	if (!expiresIn) return 7 * 24 * 60 * 60;

	const unit = expiresIn.slice(-1);
	const value = parseInt(expiresIn.slice(0, -1));

	switch (unit) {
		case "d":
			return value * 24 * 60 * 60;
		case "h":
			return value * 60 * 60;
		case "m":
			return value * 60;
		default:
			return 7 * 24 * 60 * 60;
	}
}
