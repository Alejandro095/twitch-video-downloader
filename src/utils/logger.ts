import winston, { createLogger, transports, format } from "winston";

const longFormat = winston.format.combine(
    format.colorize(),
    format.timestamp(),
    format.align(),
    format.printf((info) => `${info.timestamp} ${info.level} ${info.message}`)
);

const logger = createLogger({
    format: longFormat,
    transports: [new transports.Console({ level: "debug" })]
});

export const log = (message: string) => {
    const isDebug = process.env.TWITCH_VIDEO_DOWNLOADER_DEBUG === "true";

    if (isDebug) {
        if (logger.transports.length < 2) {
            logger.add(new transports.File({ filename: "debug.log", level: "debug" }));
        }

        logger.log({ level: "debug", message });
    }
};
