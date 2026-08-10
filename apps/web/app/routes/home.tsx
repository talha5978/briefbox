import { useState } from "react";
import { RefreshCw, Inbox, Copy, Check, ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";
import useSession from "~/hooks/useSession";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "~/components/ui/accordion";
import { createApiClientFromRequest } from "~/api/client";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";

export const loader = async ({ request }: LoaderFunctionArgs) => {
	const api = createApiClientFromRequest(request);
	const emailsData = await api.getEmails();
	return { emailsData };
};

export default function Home() {
	const { session } = useSession();
	const [copied, setCopied] = useState(false);
	const { emailsData } = useLoaderData<typeof loader>();
	const emails = emailsData.emails ?? [];
	const emailAddress = session?.email;

	const handleCopy = () => {
		if (!emailAddress) return;
		navigator.clipboard.writeText(emailAddress);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const handleRefresh = () => {
		if (typeof window !== "undefined") window.location.reload();
	};

	const formatTimestamp = (ts: number) => {
		if (!ts) return "";
		return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
	};

	const renderRiskBadge = (level?: string) => {
		switch (level) {
			case "safe":
				return (
					<Badge
						variant="outline"
						className="flex items-center justify-center text-emerald-500 border-emerald-500/30 bg-emerald-500/10 gap-1 font-normal text-[11px] py-0 px-2"
					>
						<ShieldCheck className="w-3 h-3" />
						<span>Safe</span>
					</Badge>
				);
			case "warning":
				return (
					<Badge
						variant="outline"
						className="flex items-center justify-center text-amber-500 border-amber-500/30 bg-amber-500/10 gap-1 font-normal text-[11px] py-0 px-2"
					>
						<ShieldAlert className="w-3 h-3" />
						<span>Suspicious</span>
					</Badge>
				);
			case "dangerous":
				return (
					<Badge
						variant="outline"
						className="flex items-center justify-center text-destructive border-destructive/30 bg-destructive/10 gap-1 font-normal text-[11px] py-0 px-2"
					>
						<ShieldX className="w-3 h-3" />
						<span>Dangerous</span>
					</Badge>
				);
			default:
				return null;
		}
	};

	return (
		<div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4">
			<div className="w-full max-w-2xl space-y-8">
				{/* <pre>{JSON.stringify(emails)}</pre>
				---
				<pre>{JSON.stringify(session)}</pre> */}
				<div className="text-center space-y-2">
					<div className="flex items-center justify-center gap-2">
						<div className="w-8 h-8">
							<img src="/logo.png" alt="Logo" className="w-8 h-8" />
						</div>
						<h1 className="text-3xl font-bold tracking-tight">BriefBox</h1>
					</div>
					<p className="text-muted-foreground text-sm">
						Disposable temporary email for instant privacy.
					</p>
				</div>
				<Card className="rounded-2xl p-4 shadow-xl">
					<CardContent className="p-0">
						<div className="flex flex-col sm:flex-row items-center gap-2">
							<div className="relative w-full">
								<Input type="text" readOnly value={emailAddress ?? "Loading..."} />
								<div>
									<Button
										type="button"
										size="icon-sm"
										variant="ghost"
										onClick={handleCopy}
										className="absolute right-1.5 top-1/2 -translate-y-1/2"
									>
										{copied ? <Check className="text-primary" /> : <Copy />}
									</Button>
								</div>
							</div>

							<Button onClick={handleRefresh} className="w-full sm:w-auto group">
								<RefreshCw className="w-4 h-4 group-hover:rotate-45 transition-transform duration-150 ease-in" />
								Refresh
							</Button>
						</div>
					</CardContent>
				</Card>
				<Card className="rounded-2xl min-h-75 flex flex-col justify-center items-center">
					<CardContent className="w-full p-6 my-auto flex flex-col justify-center items-center">
						{emails.length === 0 ? (
							<div className="space-y-3 max-w-sm text-center">
								<div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center text-muted-foreground border border-border">
									<Inbox className="w-6 h-6" />
								</div>
								<h3 className="text-base font-semibold text-foreground">
									Your inbox is empty
								</h3>
								<p className="text-xs text-muted-foreground leading-relaxed">
									Waiting for incoming emails. Any messages sent to your temp address will
									show up here automatically.
								</p>
							</div>
						) : (
							<Accordion multiple={false} className="w-full space-y-2">
								{emails.map((email: any) => (
									<AccordionItem
										key={email.id}
										value={email.id}
										className="border border-border rounded-xl px-4 py-1 transition-colors hover:bg-muted/30"
									>
										<AccordionTrigger className="hover:no-underline py-3">
											<div className="flex items-center gap-3 text-left w-full pr-2 overflow-hidden">
												<div className="flex-1 min-w-0">
													<div className="flex items-center justify-between gap-2">
														<p className="text-sm font-semibold truncate text-foreground">
															{email.subject || "(No Subject)"}
														</p>
														<span className="text-[10px] text-muted-foreground shrink-0 font-mono">
															{formatTimestamp(email.receivedAt)}
														</span>
													</div>
													<div className="flex items-center gap-2 mt-0.5">
														<p className="text-xs text-muted-foreground truncate">
															{email.from}
														</p>
														{renderRiskBadge(email.riskLevel)}
													</div>
												</div>
											</div>
										</AccordionTrigger>
										<AccordionContent className="pt-2 pb-4 border-t border-border mt-2 space-y-4">
											<div className="bg-muted/40 p-3 rounded-lg text-xs">
												<p className="text-muted-foreground">
													<span className="font-semibold text-foreground">
														From:
													</span>{" "}
													{email.from}
												</p>
												<p className="text-muted-foreground">
													<span className="font-semibold text-foreground">To:</span>{" "}
													{email.to}
												</p>
											</div>
											<div className="whitespace-pre-wrap text-sm text-foreground leading-relaxed font-sans px-1">
												{email.text}
											</div>
										</AccordionContent>
									</AccordionItem>
								))}
							</Accordion>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
