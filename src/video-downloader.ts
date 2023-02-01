import { EventEmitter } from "events";
import { writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";

import asyncPool from "tiny-async-pool";
import ffmpeg from "fluent-ffmpeg";

import { ChatDownloader } from "./chat-downloader";
import { Downloader } from "./downloader";
import { VideoFragmentsFetcher } from "./video-fragments";
import { VideoManifiest } from "./video-manifiest";

import { ensureDirectoryExists } from "./utils/filesystem";
import { log } from "./utils/logger";
import { parseURL } from "./utils/parse-url";

import { MkvVideo } from "./interfaces/mkv-video";
import { HslVideo } from "./interfaces/hls-video";
import { VideoDownloadInformation } from "./interfaces/video-download-information";
import { VideoDownloaderOptions } from "./interfaces/video-downloader-options";
import { TranscodeOptions } from "./interfaces/transcode-options";

import { ERRORS } from "./enums/errors";

export class VideoDownloader extends EventEmitter {
    private _clientID: string = "kimne78kx3ncx6brgo4mv6wki5h1ko";
    private _oAuthToken: string = "";

    private _pathFolder: string = "";
    private _poolLimit: number = 20;
    private _quality: string = "";
    private _rootProjectPath: string = process.cwd();

    private _totalVideoFragments: number = 0;
    private _videoFragmentsDownloaded: number[] = [];

    private _videoURL: string;
    private _vodID: string;

    constructor(videoURL: string, options?: VideoDownloaderOptions) {
        super();

        if (options) {
            this._poolLimit = options.poolLimit ? options.poolLimit : this._poolLimit;
            this._rootProjectPath = options.downloadFolder ? options.downloadFolder : this._rootProjectPath;
            this._clientID = options.clientID ? options.clientID : this._clientID;
            this._oAuthToken = options.oAuthToken ? options.oAuthToken : this._oAuthToken;

            // Environment variable for debug logs
            if (process.env.TWITCH_VIDEO_DOWNLOADER_DEBUG == null) {
                process.env.TWITCH_VIDEO_DOWNLOADER_DEBUG = options.debug ? "true" : "false";
            }

            log(`[VideoDownloader] Options:
                    ${JSON.stringify(options, undefined, 2)}`);
        }

        this._videoURL = videoURL;
        this._vodID = parseURL(this._videoURL);

        log(`[VideoDownloader] VodID is ${this._vodID}.`);
    }

    public async getVideoResolutionsAvailable() {
        const manifiests = new VideoManifiest(this._vodID, this._clientID, this._oAuthToken);
        const resolutions = await manifiests.getVideoResolutions();

        return resolutions;
    }

    public async download(video: VideoDownloadInformation): Promise<HslVideo> {
        if (!video || !video.quality || !video.resolution || !video.url) {
            log(`[VideoDownloader] Video download request failed, invalid video information, object must have quality, resolution, and url fields`);
            log(JSON.stringify(video, undefined, 2));

            throw new Error(ERRORS.INVALID_VIDEO_METADATA);
        }

        log(`[VideoDownloader] Video download request, with information`);
        log(JSON.stringify(video, undefined, 2));

        const videoFragmentsFetcher = new VideoFragmentsFetcher();
        const { rawContent, fragments } = await videoFragmentsFetcher.getFragments(video);

        this._quality = video.quality;
        this._pathFolder = join(this._rootProjectPath, `downloads/videos/${this._vodID}/hls/${video.quality}`);

        ensureDirectoryExists(this._pathFolder);
        log(`[VideoDownloader] Path of downloading ${this._pathFolder}`);

        // Save de M3U8
        writeFileSync(`${this._pathFolder}/index.m3u8`, rawContent);

        if (fragments.length > 0) {
            this._videoFragmentsDownloaded = []; // Reset the array for new downloads
            this._totalVideoFragments = fragments.length;
            log(`[VideoDownloader] Total fragments of video is ${this._totalVideoFragments}.`);
            this.emit("start-download", {
                vodID: this._vodID,
                quality: this._quality,
                folderPath: this._pathFolder
            });
            await this._downloadFragments(fragments);
        } else {
            log(`[VideoDownloader] Not found fragments of VodID ${this._vodID}.`);
            throw new Error(ERRORS.NOT_FOUND_FRAGMENTS);
        }

        return {
            vodID: this._vodID,
            quality: this._quality,
            folderPath: this._pathFolder
        };
    }

    private async _downloadFragments(fragments: [string, string][]): Promise<void> {
        await asyncPool<[string, string], string>(this._poolLimit, fragments, this._downloadFragment.bind(this));
    }

    private async _downloadFragment(fragmentData: [string, string]): Promise<string> {
        const [name, url] = fragmentData;

        const path = `${this._pathFolder}/${name}`;

        const downloader = new Downloader(url, path);

        downloader.on("fragment-downloaded", (fragment) => {
            this._videoFragmentsDownloaded.push(fragment);
            const percentage = (this._videoFragmentsDownloaded.length / this._totalVideoFragments) * 100;

            if (percentage) this.emit("progress-download", percentage);
        });

        await downloader.download();

        return name;
    }

    public async downloadChat() {
        const chatDownloader = new ChatDownloader(this._vodID, this._clientID);

        return chatDownloader.download();
    }

    public transcode(videoSaved: HslVideo, options?: TranscodeOptions): Promise<MkvVideo> {
        log("[VideoDownloader] Video transcode, with options");
        if (options) log(JSON.stringify(options, undefined, 2));

        const m3u8FilePath = join(videoSaved.folderPath, "index.m3u8");

        if (!existsSync(m3u8FilePath)) {
            throw new Error(ERRORS.M3U8_DOES_NOT_EXISTS);
        }

        const outputPathFolder = join(this._rootProjectPath, `downloads/videos/${videoSaved.vodID}/mkv`);
        const outputPath = options?.outputPath
                                ? join(options.outputPath, `${videoSaved.vodID}-${videoSaved.quality}.mkv`)
                                : join(outputPathFolder, `${videoSaved.quality}.mkv`);

        log(`[VideoDownloader] Transcode output path: ${outputPath}`);

        ensureDirectoryExists(outputPathFolder);

        return new Promise((resolve, reject) => {
            const transcoder = ffmpeg();

            transcoder
                .addInput(m3u8FilePath)
                .outputOptions(["-codec copy", "-preset ultrafast"])
                .output(outputPath)
                .on("start", (commands) => {
                    log(`[VideoDownloader] Transcode start, commands: ${commands}`);
                    this.emit("start-transcode", commands);
                })
                .on("end", (err, stdout, stderr) => {
                    if (err) {
                        log(`[VideoDownloader] Transcode error: ${err}`);
                        return reject(err);
                    }

                    if (options?.deleteHslFiles) {
                        log(`[VideoDownloader] Delete HLS files`);
                        rmSync(videoSaved.folderPath, { recursive: true, force: true });
                    }

                    log(`[VideoDownloader] Transcode end`);

                    return resolve({
                        vodID: videoSaved.vodID,
                        quality: videoSaved.quality,
                        filePath: outputPath
                    });
                })
                .on("progress", (progress) => {
                    if (progress.percent) {
                        log(`[VideoDownloader] Transcode progress: ${progress.percent}%`);
                        this.emit("progress-transcode", progress.percent);
                    }
                })
                .on("error", (error) => {
                    log(`[VideoDownloader] Transcode error: ${error}`);
                    reject(error);
                })
                .run();
        });
    }
}
