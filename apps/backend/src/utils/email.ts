export function generateTempEmail(domain = process.env.EMAIL_DOMAIN || "briefbox.local"): string {
	const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
	let local = "";

	for (let i = 0; i < 10; i++) {
		local += chars[Math.floor(Math.random() * chars.length)];
	}

	return `${local}@${domain}`;
}
