export interface IncomingEmail {
	id: string;
	sessionId: string;
	from: string;
	to: string;
	subject: string;
	text?: string;
	html?: string;
	links: string[];
	riskScore: number; // 0-100
	riskLevel: "safe" | "warning" | "dangerous";
	receivedAt: number;
}
