import https from "https";
import { EventEmitter } from "events";
import { createWriteStream, existsSync, unlink, renameSync } from "fs";

import { retry } from "@lifeomic/attempt";

import { log } from "./utils/logger";

export class Downloader extends EventEmitter {
    private _url: string;
    private _path: string;

    private _tries: number = 0;
    private _maxTries: number = 4;

    constructor(url: string, path: string) {
        super();

        this._url = url;
        this._path = path;
    }

    async download() {
        try {
            await this._init();
        } catch (error) {
            await this._handlerError(error);
        }
    }

    private async _handlerError(error?: any, reject?: (msg: string) => void) {
        this._tries = ++this._tries;

        log(`[Downloader] [handlerError] ${error}`);

        if (this._tries > this._maxTries) {
            const errorMessage = `Failed to download fragment with url ${this._url}`;
            log(errorMessage);
            if (reject) reject(errorMessage);
        } else {
            const errorMessage = `Retrying fragment: ${this._url}, attempts made: ${this._tries}`;
            log(errorMessage);

            await this.download();
        }
    }

    private _init() {
        return new Promise((resolve, reject) => {
            const filePathTemp = `${this._path}.progress`;
            const filePath = this._path;

            const fileExist = existsSync(filePath);

            if (fileExist) {
                this.emit("fragment-downloaded", filePath);
                log(`[Downloader] Fragment download completed ${this._url}`);
                resolve(filePath);
            } else {
                const file = createWriteStream(filePathTemp);

                const handlerError = (error: any) => {
                    file.close();
                    unlink(filePathTemp, () => {
                        this._handlerError(error, reject);
                    });
                };

                const request = https.get(this._url, (response) => {
                    if (response.statusCode != 200) {
                        handlerError(response.statusMessage);
                    }

                    response.pipe(file);
                });

                request.on("error", handlerError);

                file.on("error", handlerError);
                file.on("finish", () => {
                    handlerFinishFile();
                });

                const handlerFinishFile = async () => {
                    try {
                        await retry(async () => renameSync(filePathTemp, filePath), {
                            delay: 500,
                            factor: 4,
                            maxDelay: 1000
                        });
                    } catch (error) {
                        this._handlerError(error, reject);
                    }

                    this.emit("fragment-downloaded", filePath);
                    log(`[Downloader] Fragment download completed ${this._url}`);
                    resolve(filePath);
                };
            }
        });
    }
}
