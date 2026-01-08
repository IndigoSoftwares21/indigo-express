import express from "express";
import { disconnect } from "@/database";
import { handleMulterError } from "@/middlewares/multer";
import appRoutes from "@/routes/app.routes";

import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import monitoring from "./utils/monitoring";
const corsOptions = {
    origin: [process.env.CORS_ORIGIN || "http://localhost:5173"],
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    preflightContinue: false,
};

class App {
    public express: express.Application;

    constructor() {
        this.express = express();
        this.initializeMiddlewares();
        this.initializeRoutes();
        this.express.set("trust proxy", 1);
    }

    private initializeMiddlewares(): void {
        this.express.use(cors(corsOptions));
        this.express.use(express.json());
        this.express.use(helmet());
        this.express.use(helmet.xssFilter());
        this.express.use(express.urlencoded({ extended: true }));
        this.express.use((req, res, next) => {
            res.setHeader("Content-Security-Policy", "default-src 'self'");
            res.setHeader("Strict-Transport-Security", "max-age=31536000");
            next();
        });
        this.express.use(handleMulterError);

        this.express.use((req, res, next) => {
            monitoring.info(`${req.method} ${req.path}`);
            next();
        });

        if (process.env.APP_ENVIRONMENT === "PRODUCTION") {
            // 30 requests per minute per IP
            const limiter = rateLimit({
                windowMs: 1 * 60 * 1000, // 1 minute
                max: 60, // limit each IP to 30 requests per windowMs
            });
            this.express.use(limiter);
        }
    }

    private initializeRoutes(): void {
        monitoring.info("Initializing routes");
        
        const apiVersion = process.env.API_VERSION || 'v1';
        
        // Register route modules here
        this.express.use(`/api/${apiVersion}/app`, appRoutes);
        monitoring.info(`Registered route: /api/${apiVersion}/app`);
    }

    public async start(port: number): Promise<void> {
        try {
            dotenv.config();
            this.express.listen(port, () => {
                monitoring.info(`Server running on port ${port}`);
            });
        } catch (error) {
            monitoring.error("Failed to start server:", error as Error);
            await disconnect();
            process.exit(1);
        }
    }
}

const PORT = parseInt(process.env.PORT || "6969", 10);
const app = new App();
app.start(PORT);

export default app;
