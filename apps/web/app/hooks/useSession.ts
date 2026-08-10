import { useRouteLoaderData } from "react-router";
import type { loader } from "~/root";

export default function useSession() {
	const rootLoaderData = useRouteLoaderData<typeof loader>("root");
	return {
		session: rootLoaderData?.session ?? null,
	};
}
