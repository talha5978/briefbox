export type RiskLevel = "safe" | "warning" | "dangerous";

export interface SafetyInput {
	from: string;
	to?: string;
	subject: string;
	text?: string;
	html?: string;
	links?: string[];
}

export interface SafetyResult {
	riskScore: number; // 0–100
	riskLevel: RiskLevel;
	reasons: string[]; // human labels for UI
	reasonCodes: string[]; // stable codes for debugging
}
