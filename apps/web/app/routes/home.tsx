import { useState, useEffect } from "react";
import { RefreshCw, Inbox, Copy, Check, ShieldCheck, ShieldAlert, ShieldX, Clock } from "lucide-react";
import useSession from "~/hooks/useSession";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "~/components/ui/accordion";
import { createApiClientFromRequest } from "~/api/client";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { useRevalidator } from "react-router";
import DOMPurify from "dompurify";

export const loader = async ({ request }: LoaderFunctionArgs) => {
	const api = createApiClientFromRequest(request);
	const emailsData = await api.getEmails();
	return { emailsData };
};

export default function Home() {
	const { session } = useSession();
	const revalidator = useRevalidator();
	const [copied, setCopied] = useState(false);
	const { emailsData } = useLoaderData<typeof loader>();
	const emails = emailsData.emails ?? [];
	const emailAddress = session?.email;

	const [timeLeft, setTimeLeft] = useState<number>(0);

	useEffect(() => {
		if (!session?.expiresAt) return;

		const updateTimer = () => {
			const now = Date.now();
			const diffInSeconds = Math.max(0, Math.floor((session.expiresAt - now) / 1000));
			setTimeLeft(diffInSeconds);

			if (diffInSeconds === 0 && typeof window !== "undefined") {
				window.location.reload();
			}
		};

		updateTimer();
		const interval = setInterval(updateTimer, 1000);

		return () => clearInterval(interval);
	}, [session?.expiresAt]);

	useEffect(() => {
		const id = setInterval(() => {
			if (document.hidden) return;
			if (revalidator.state === "loading") return;
			// revalidator.revalidate();
		}, 10000);

		return () => clearInterval(id);
	}, [revalidator]);

	const isRefreshing = revalidator.state === "loading";

	const formatCountdown = (seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
	};

	const handleCopy = () => {
		if (!emailAddress) return;
		navigator.clipboard.writeText(emailAddress);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const handleRefresh = () => {
		if (typeof window !== "undefined") revalidator.revalidate();
	};

	const formatTimestamp = (ts: number) => {
		if (!ts) return "";
		return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
	};

	const renderRiskBadge = (level?: string) => {
		switch (level) {
			case "safe":
				return (
					<span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
						<ShieldCheck className="w-3 h-3" />
						Safe
					</span>
				);
			case "warning":
				return (
					<span className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
						<ShieldAlert className="w-3 h-3" />
						Suspicious
					</span>
				);
			case "dangerous":
				return (
					<span className="inline-flex items-center gap-1 text-[11px] text-red-600 dark:text-red-400">
						<ShieldX className="w-3 h-3" />
						Dangerous
					</span>
				);
			default:
				return null;
		}
	};

	return (
		<div className="min-h-screen bg-background text-foreground">
			<div className="mx-auto max-w-lg px-4 py-10 sm:py-16">
				{/* Header */}
				<header className="mb-10">
					<div className="flex items-center gap-2 mb-1">
						<img src="/logo.png" alt="" className="w-7 h-7" />
						<h1 className="text-2xl font-bold tracking-tight">BriefBox</h1>
					</div>
					<p className="text-sm text-muted-foreground">Temporary email. Dies in one hour.</p>
				</header>

				{/* Address */}
				<section className="mb-8">
					<label className="block text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
						Your address
					</label>
					<div className="flex gap-2">
						<div className="relative flex-1">
							<Input
								type="text"
								readOnly
								value={emailAddress ?? "…"}
								className="font-mono text-sm h-10 pr-10"
							/>
							<button
								type="button"
								onClick={handleCopy}
								className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
								aria-label="Copy"
							>
								{copied ? (
									<Check className="w-4 h-4 text-emerald-500" />
								) : (
									<Copy className="w-4 h-4" />
								)}
							</button>
						</div>
						<Button
							variant="outline"
							size="icon"
							onClick={handleRefresh}
							disabled={isRefreshing}
							className="h-10 w-10 shrink-0"
						>
							<RefreshCw
								className={`w-4 h-4 ${isRefreshing ? "animate-spin animation-duration-[700ms]" : ""}`}
							/>
						</Button>
					</div>

					{session?.expiresAt && (
						<div className="mt-3 flex items-center gap-2 text-sm">
							<Clock className="w-3.5 h-3.5 text-muted-foreground" />
							<span className="text-muted-foreground">Expires in</span>
							<span className="font-mono font-medium tabular-nums">
								{formatCountdown(timeLeft)}
							</span>
						</div>
					)}
				</section>

				{/* Inbox */}
				<section>
					<div className="flex items-baseline gap-1 mb-3">
						<h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
							Inbox
						</h2>
						<span className="text-xs text-muted-foreground">({emails.length || 0})</span>
					</div>

					{emails.length === 0 ? (
						<div className="border border-dashed border-border rounded-lg py-14 text-center">
							<Inbox className="w-5 h-5 text-muted-foreground mx-auto mb-3" />
							<p className="text-sm text-muted-foreground">No messages yet</p>
						</div>
					) : (
						<Accordion
							multiple={false}
							className="border border-border rounded-lg divide-y divide-border overflow-hidden"
						>
							{emails.map((email) => (
								<AccordionItem key={email.id} value={email.id} className="border-0 px-0">
									<AccordionTrigger className="hover:no-underline px-4 py-3 hover:bg-muted/40 transition-colors">
										<div className="flex flex-col gap-0.5 text-left w-full min-w-0 pr-2">
											<div className="flex items-center justify-between gap-3">
												<span className="text-sm font-medium truncate">
													{email.subject || "(No Subject)"}
												</span>
												<span className="text-[11px] text-muted-foreground font-mono shrink-0">
													{formatTimestamp(email.receivedAt)}
												</span>
											</div>
											<div className="flex items-center gap-2">
												<span className="text-xs text-muted-foreground truncate">
													{email.from}
												</span>
												{renderRiskBadge(email.riskLevel)}
											</div>
										</div>
									</AccordionTrigger>
									<AccordionContent className="px-4 pb-4">
										<div className="text-xs text-muted-foreground space-y-1 mb-3 pt-1 border-t border-border">
											<p>
												<span className="text-foreground/70">From:</span> {email.from}
											</p>
											<p>
												<span className="text-foreground/70">To:</span> {email.to}
											</p>
										</div>
										<div className="max-h-64 overflow-y-auto text-sm leading-relaxed">
											{email.html && typeof window !== "undefined" ? (
												<div
													className="email-html prose prose-sm dark:prose-invert max-w-none wrap-break-word"
													dangerouslySetInnerHTML={{
														__html: DOMPurify.sanitize(email.html, {
															USE_PROFILES: { html: true },
														}),
													}}
												/>
											) : email.text ? (
												<div className="whitespace-pre-wrap">{email.text}</div>
											) : (
												<span className="text-muted-foreground">No content</span>
											)}
										</div>
									</AccordionContent>
								</AccordionItem>
							))}
						</Accordion>
					)}
				</section>

				<p className="mt-10 text-center text-[11px] text-muted-foreground">
					Everything disappears when the timer ends.
				</p>
			</div>
		</div>
	);
}
