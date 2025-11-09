import { Response } from "express";
import { ZodError } from "zod";
import { DatabaseError } from "pg";
import monitoring from "../monitoring";
import ERRORS from "@/constants/error_types";
import SlackService from "@/services/slack";

interface IHandleError {
    res: Response;
    message?: string;
    code?: number;
    error?: any;
}

const handleError = ({
    res,
    message = "An error occurred",
    code = 500,
    error,
}: IHandleError): Response => {
    monitoring.error(message, error);

    let errorCode = code;
    let errorMessage = message;

    if (error instanceof ZodError) {
        errorCode = 400;
        errorMessage = ERRORS.FORM_VALIDATION_ERROR;

        const validationErrors = error.errors.map((err) => ({
            path: err.path,
            message: err.message,
        }));

        return res.status(errorCode).json({
            message: errorMessage,
            code: errorCode,
            validationErrors,
        });
    }

    if (error instanceof DatabaseError) {
        const dbErrorCode = error.code || "DB_ERROR";

        monitoring.error(
            `Database error: Code ${dbErrorCode}, Detail: ${error.detail}`,
            Error(
                JSON.stringify(
                    {
                        code: dbErrorCode,
                        detail: error.detail,
                        constraint: error.constraint,
                        severity: error.severity,
                        schema: error.schema,
                        table: error.table,
                        column: error.column,
                        position: error.position,
                    },
                    null,
                    2,
                ),
            ),
        );

        switch (dbErrorCode) {
            case "23505":
                errorCode = 409;
                errorMessage =
                    ERRORS.DUPLICATE_ENTRY || "A duplicate entry was found";
                break;
            case "23503":
                errorCode = 400;
                errorMessage =
                    ERRORS.INVALID_REFERENCE ||
                    "Invalid reference to another resource";
                break;
            case "42P01":
            case "42703":
                errorCode = 500;
                errorMessage = ERRORS.SCHEMA_ERROR || "Database schema error";
                break;
            case "57014":
                errorCode = 504;
                errorMessage =
                    ERRORS.QUERY_TIMEOUT || "Database query timed out";
                break;
            default:
                errorCode = 500;
                errorMessage =
                    ERRORS.DATABASE_ERROR || "Database error occurred";
        }
    }

    if (error?.message && !errorMessage) {
        errorMessage = error.message;
    }

    // Send Slack alert for 500 errors
    if (errorCode >= 500) {
        const slackService = new SlackService();
        const slackMessage = `🚨 *500 Error Alert* 🚨
        
*Error:* ${errorMessage}
*Code:* ${errorCode}
*Timestamp:* ${new Date().toISOString()}
*Environment:* ${process.env.NODE_ENV || "unknown"}

${
    error?.stack
        ? `*Stack Trace:*
\`\`\`
${error.stack}
\`\`\``
        : ""
}`;

        slackService.sendWebhookMessage({
            message: slackMessage,
            webhookUrl: process.env.SLACK_ERROR_WEBHOOK_URL,
        });
    }

    return res.status(errorCode).json({
        message: errorMessage,
        code: errorCode,
    });
};

export default handleError;
