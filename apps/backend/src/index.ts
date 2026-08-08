import Fastify from "fastify";
import { server } from "~/server";

const app = Fastify({
	logger: {
		transport: {
			target: "pino-pretty",
			options: {
				translateTime: "HH:MM:ss Z",
				colorize: true,
				ignore: "pid,hostname",
			},
		},
	},
	disableRequestLogging: false,
});

const startServer = async () => {
	try {
		await server(app);
		const port = process.env.BACKEND_PORT || 3000;

		process.on("SIGINT", async () => {
			console.log("Shutting down...");
			await app.close();
			process.exit(0);
		});

		await app.listen({ port: Number(port), host: "0.0.0.0" }, (err, address) => {
			if (err) {
				app.log.error(err);
				process.exit(1);
			}

			console.log(`Server running at ${address}`);
		});
	} catch (error) {
		app.log.error(error);
		process.exit(1);
	}
};

startServer();
