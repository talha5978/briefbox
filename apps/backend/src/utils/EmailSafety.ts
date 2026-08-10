import type { SafetyInput, SafetyResult, RiskLevel } from "~/types/email-safety";

type ReasonCode =
	| "phish_phrase_strong"
	| "urgent_subject"
	| "ip_link"
	| "shortener"
	| "suspicious_tld"
	| "credential_path"
	| "brand_link_mismatch"
	| "brand_free_mail_from"
	| "html_only_bait"
	| "empty_with_links"
	| "many_links"
	| "malformed_url";

const REASON_LABELS: Record<ReasonCode, string> = {
	phish_phrase_strong: "Strong phishing language",
	urgent_subject: "Urgent language in subject",
	ip_link: "Link uses a raw IP address",
	shortener: "Uses a URL shortener",
	suspicious_tld: "Suspicious link domain",
	credential_path: "Credential-related link path",
	brand_link_mismatch: "Brand mentioned but login link goes elsewhere",
	brand_free_mail_from: "Brand-like sender on a free email domain",
	html_only_bait: "HTML-heavy email with almost no text",
	empty_with_links: "Almost empty body with links",
	many_links: "Unusually many links",
	malformed_url: "Malformed URL",
};

/** Strong scam phrases — rare in normal product auth mail */
const STRONG_PHISH_PHRASES = [
	"seed phrase",
	"private key",
	"recovery phrase",
	"wallet password",
	"gift card",
	"wire transfer",
	"you have won",
	"claim your prize",
	"claim your reward",
	"crypto giveaway",
	"password expires today",
	"account will be closed",
	"account has been compromised",
	"unauthorized login from",
	"confirm your password now",
	"update your payment method immediately",
];

/** Common in legit product emails — weak alone */
const WEAK_AUTH_PHRASES = [
	"verify your email",
	"confirm your email",
	"verify your account",
	"security alert",
	"login attempt",
	"unusual activity",
	"reset your password",
];

const BRAND_KEYWORDS = [
	"paypal",
	"microsoft",
	"apple",
	"google",
	"amazon",
	"netflix",
	"facebook",
	"instagram",
	"whatsapp",
	"binance",
	"coinbase",
	"metamask",
	"chase",
	"wellsfargo",
];

const SHORTENER_DOMAINS = new Set([
	"bit.ly",
	"tinyurl.com",
	"t.co",
	"goo.gl",
	"ow.ly",
	"is.gd",
	"cutt.ly",
	"rebrand.ly",
	"rb.gy",
]);

const SUSPICIOUS_TLDS = [
	".zip",
	".mov",
	".tk",
	".ml",
	".ga",
	".cf",
	".gq",
	".xyz",
	".top",
	".club",
	".work",
	".click",
	".country",
	".support",
];

const CREDENTIAL_PATH_RE =
	/\/(login|signin|sign-in|verify|verification|account|secure|password|passwd|update-account|confirm)/i;

function normalize(s: string): string {
	return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function stripTags(html: string): string {
	return html
		.replace(/<style[\s\S]*?<\/style>/gi, " ")
		.replace(/<script[\s\S]*?<\/script>/gi, " ")
		.replace(/<[^>]+>/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

/** Clean trailing junk that regex often captures from HTML */
function cleanUrl(url: string): string {
	return url
		.replace(/&amp;/g, "&")
		.replace(/[)>,.;\]\}"'\\\s]+$/g, "")
		.trim();
}

function extractLinks(text = "", html = ""): string[] {
	const found = new Set<string>();

	// 1) Prefer real hrefs from HTML
	const hrefRe = /href\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi;
	let m: RegExpExecArray | null;
	while ((m = hrefRe.exec(html)) !== null) {
		const raw = cleanUrl(m[1] || m[2] || m[3] || "");
		if (/^https?:\/\//i.test(raw)) found.add(raw);
	}

	// 2) Plaintext URLs
	const urlRe = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
	const fromText = text.match(urlRe) || [];
	for (const u of fromText) found.add(cleanUrl(u));

	// 3) Fallback: URLs inside HTML text if no hrefs
	if (found.size === 0 && html) {
		const fromHtml = html.match(urlRe) || [];
		for (const u of fromHtml) found.add(cleanUrl(u));
	}

	return [...found];
}

function domainOf(url: string): string | null {
	try {
		return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
	} catch {
		return null;
	}
}

function isIpHost(hostname: string): boolean {
	return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
}

function mentionedBrands(...parts: string[]): string[] {
	const blob = normalize(parts.join(" "));
	return BRAND_KEYWORDS.filter((b) => blob.includes(b));
}

function toLevel(score: number): RiskLevel {
	if (score >= 51) return "dangerous";
	if (score >= 21) return "warning";
	return "safe";
}

export function scanEmailSafety(input: SafetyInput): SafetyResult {
	const codes = new Set<ReasonCode>();
	let score = 0;

	const subject = input.subject || "";
	const from = input.from || "";
	const text = input.text || "";
	const html = input.html || "";

	const textNorm = normalize(text);
	const fromNorm = normalize(from);
	const contentNorm = normalize([subject, text, html ? stripTags(html) : ""].filter(Boolean).join(" "));

	const links =
		input.links && input.links.length > 0 ? input.links.map(cleanUrl) : extractLinks(text, html);

	// ---------- 1) Language ----------
	let strongPhraseHits = 0;
	for (const p of STRONG_PHISH_PHRASES) {
		if (contentNorm.includes(p)) strongPhraseHits += 1;
	}
	if (strongPhraseHits > 0) {
		score += Math.min(36, 16 + (strongPhraseHits - 1) * 8);
		codes.add("phish_phrase_strong");
	}

	const weakAuthHits = WEAK_AUTH_PHRASES.filter((p) => contentNorm.includes(p)).length;
	// weak phrases alone do almost nothing; used later as multiplier context
	const hasWeakAuthLanguage = weakAuthHits > 0;

	if (/(urgent|immediately|action required|last chance|within 24 hours)/i.test(subject)) {
		score += 8;
		codes.add("urgent_subject");
	}

	// ---------- 2) Links ----------
	let credentialLinks = 0;
	let suspiciousLinkScore = 0;
	const brands = mentionedBrands(subject, from, text);

	for (const link of links) {
		const domain = domainOf(link);
		if (!domain) {
			suspiciousLinkScore += 6;
			codes.add("malformed_url");
			continue;
		}

		if (isIpHost(domain)) {
			suspiciousLinkScore += 22;
			codes.add("ip_link");
		}

		if (SHORTENER_DOMAINS.has(domain)) {
			suspiciousLinkScore += 12;
			codes.add("shortener");
		}

		if (SUSPICIOUS_TLDS.some((tld) => domain.endsWith(tld))) {
			suspiciousLinkScore += 10;
			codes.add("suspicious_tld");
		}

		const isCredentialLink = CREDENTIAL_PATH_RE.test(link);
		if (isCredentialLink) {
			credentialLinks += 1;
			suspiciousLinkScore += 6;
			codes.add("credential_path");
		}

		// Brand mismatch: only for credential-style links, once overall
		if (isCredentialLink && brands.length > 0) {
			const matchesBrand = brands.some((b) => domain.includes(b));
			if (!matchesBrand) {
				// single penalty, not per link
				if (!codes.has("brand_link_mismatch")) {
					suspiciousLinkScore += 20;
					codes.add("brand_link_mismatch");
				}
			}
		}
	}

	if (links.length >= 8) {
		suspiciousLinkScore += 5;
		codes.add("many_links");
	}

	score += Math.min(45, suspiciousLinkScore);

	// weak auth language only becomes meaningful with shady link signals
	if (
		hasWeakAuthLanguage &&
		(codes.has("brand_link_mismatch") ||
			codes.has("ip_link") ||
			codes.has("shortener") ||
			codes.has("suspicious_tld"))
	) {
		score += 10;
	}

	// ---------- 3) Structure / sender ----------
	if (html && textNorm.length < 40 && links.length > 0) {
		score += 10;
		codes.add("html_only_bait");
	}

	if (!html && textNorm.length < 25 && links.length > 0) {
		score += 12;
		codes.add("empty_with_links");
	}

	const brandInFrom = BRAND_KEYWORDS.some((b) => fromNorm.includes(b));
	if (brandInFrom && /(gmail\.com|yahoo\.com|outlook\.com|hotmail\.com|aol\.com)/i.test(fromNorm)) {
		score += 14;
		codes.add("brand_free_mail_from");
	}

	// credential links without any brand context still slightly risky if many
	if (credentialLinks >= 2 && brands.length === 0) {
		score += 6;
	}

	score = Math.max(0, Math.min(100, score));

	const reasonCodes = [...codes];
	const reasons = reasonCodes.map((c) => REASON_LABELS[c]);

	return {
		riskScore: score,
		riskLevel: toLevel(score),
		reasons,
		reasonCodes,
	};
}
