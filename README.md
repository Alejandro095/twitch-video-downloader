# TWICHT-VIDEO-DONWLOADER

Library to download the videos, videos for subs and comments from twitch.

## Installation

```bash
$ npm i twitch-video-downloader
```

## Requirements

The [FFMPEG](https://www.ffmpeg.org/) library is needed to transcode video files from m3u8 to mkv

## Usage

```js
import { join } from "path";
import { writeFileSync } from "fs";

import { VideoDownloader, ensureDirectoryExists } from "twitch-video-downloader";

(async () => {
    try {
        const downloader = new VideoDownloader("https://www.twitch.tv/videos/800558240");

        downloader.on("progress-download", (progress) => console.log(`Downloaded ${progress.toFixed(2)}%`));
        downloader.on("progress-transcode", (progress) => console.log(`Transcoded ${progress.toFixed(2)}%`));

        downloader.on("start-download", (e) => console.log(`Download started! on `, e));
        downloader.on("start-transcode", () => console.log(`Transcoded started!`));

        // Get all resolutions available for this video
        const resolutions = await downloader.getVideoResolutionsAvailable();

        // Donwload specific resolution
        const download = await downloader.download(resolutions[0]);

        // Information and path of downloaded hls files
        console.log(download);

        // Trancoded video, from HLS to MKV
        const transcode = await downloader.transcode(download);

        // Information and path of trancoded video
        console.log(transcode);

        // Download offline chat
        const comments = await downloader.downloadChat();

        // Verify that the directory exists, if not create it
        ensureDirectoryExists(join(__dirname, "./../downloads/chats"));

        // Save all comments
        writeFileSync(join(__dirname, `./../downloads/chats/${comments.vodID}.chat`), comments.content);
    } catch (error) {
        console.log(error);
    }
})();
```

This code can be very useful to have a quick overview of the library. If you clone the [repository](https://github.com/Alejandro095/twitch-video-downloader) you can find this same file in the following path.

```
twitch-video-downloader
│
└───example
    │   index.ts
```

Once the project dependencies are installed with

```bash
$ npm install
```

You can play with this file by modifying it and downloading the videos that interest you. To run the script run the following command

```bash
$ npm run start:watch
```

If you want to know everything the library is doing, execute the following command to run the script in debug mode

```bash
$ npm run dev:watch
```

Or you can pass the debug parameter in the options

```js
const downloader = new VideoDownloader("https://www.twitch.tv/videos/800558240", {
    debug: true
});
```

## API

VideoDownloader is the main class of the library, it is the entry point to start downloading videos or chat

```js
const defaultOptions = {
    clientID: "kimne78kx3ncx6brgo4mv6wki5h1ko",
    debug: false,
    downloadFolder: process.cwd(),
    oAuthToken: "",
    poolLimit: 20
};

const downloader = new VideoDownloader("https://www.twitch.tv/videos/800558240", defaultOptions);
```

| Option         | Definition                                                                                                                                                                                                          | Default                        |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| clientID       | This is a parameter used by the twitch platform, the value is the same no matter what account is used, so you probably shouldn't change it                                                                          | kimne78kx3ncx6brgo4mv6wki5h1ko |
| debug          | To start the library in debug mode, a debug.log file will be created where everything the library is doing will be saved.                                                                                           | false                          |
| downloadFolder | The folder where the videos will be saved. Default is the working directory                                                                                                                                         | process.cwd()                  |
| oAuthToken     | This parameter is very important because with this you can download videos only for subscribers. It is not magic, before you must already have access to the video in your twitch account to be able to download it | ""                             |
| poolLimit      | They are the maximum parallel downloads when downloading a video                                                                                                                                                    | 20                             |

### Where do I get my oAuthToken to download subscriber-only videos?

You have two options, you can extract it from Twitch cookies once you are logged in, the field is called auth-token. Here are the steps you must follow:

    * Sign in to your Twitch account
    * With the Twitch tab open, open the chrome devtools (press f12)
    * With the devtools window open, now go to the application tab
    * Select 'https://www.twitch.tv' in the Cookies section
    * And look in the 'name' column for the field that says 'auth-token' and copy what is in the 'value' column

The second option (It is still in development, it is not recommended) is to use the TwitchOAuth class

```js
import { TwitchOAuth, LoginOptions } from "twitch-video-downloader";

const loginDefaultOptions: LoginOptions = {
    authy_token: "", // This is the only useful option. Use it when you have the Two-factor activated, copy the code from the Authenticator application. Make sure the code is still valid when you run this method
    client_id: "kimne78kx3ncx6brgo4mv6wki5h1ko",
    remember_me: true,
}

const twitchOAuth = new TwitchOAuth();

twitchOAuth.login("<YOUR TWITCH USER>", "<YOUR PASSWORD>", loginDefaultOptions).then(async (oAuthToken) => {
    const downloader = new VideoDownloader("https://www.twitch.tv/videos/800558240", {
        oAuthToken: oAuthToken,
    });

    ...
});
```

    Warning: THIS CLASS IS NOT YET FINISHED DEVELOPING, so problems may arise. And we have not yet developed the option to solve the catchas when Twitch asks you to log in

    IT IS RECOMMENDED THAT YOU USE THE FIRST METHOD TO GET YOUR OAUTH TOKEN FROM COOKIES BEFORE THIS METHOD

## Events

| Event name         | Description                                                     | Arguments                                            |
| ------------------ | --------------------------------------------------------------- | ---------------------------------------------------- |
| progress-download  | The event is called each time the download progress is updated  | decimal                                              |
| progress-transcode | The event is called each time the transcode progress is updated | decimal                                              |
| start-download     | The event is called when the download starts                    | { vodID: string, quality: string, folderPath:string} |
| start-transcode    | The event is called when the transcode starts                   | void                                                 |

Example to register your listeners

```js
const downloader = new VideoDownloader("https://www.twitch.tv/videos/800558240");

downloader.on("<EVENT NAME>", (arg) => console.log(arg));
```

## Methods

### getVideoResolutionsAvailable: Asynchronous method to get all available resolutions

```js
const downloader = new VideoDownloader("https://www.twitch.tv/videos/800558240");

const resolutions = await downloader.getVideoResolutionsAvailable();
```

The function returns an array with the following information

```js
[
    {
        quality: '1080p60',
        resolution: '1920x1080',
        url: 'https://...index-dvr.m3u8'
    },
    {
        quality: '1080p',
        resolution: '1920x1080',
        url: 'https://...index-dvr.m3u8'
    },
    {
        quality: '720p60',
        resolution: '1080x720',
        url: 'https://...index-dvr.m3u8'
    },

    ...
]
```

### download: Asynchronous method to download a video

This function allows you to download a specific resolution, as a parameter you have to pass an object with the fields quality, resolution and url

```js
const downloader = new VideoDownloader("https://www.twitch.tv/videos/800558240");

const resolutions = await downloader.getVideoResolutionsAvailable();

// Donwload specific resolution
const download = await downloader.download(resolutions[0]);
```

Once the function is finished executing, it returns an object with the following information

```js
{
    vodID: '800558240',
    quality: '1080p60',
    folderPath: 'D:\\Projects\\twitch-video-downloader\\downloads\\videos\\800558240\\hls\\1080p60'
}
```

### transcode: Asynchronous method to transcode a video

This function allows you to transcode a video, as a parameter you have to pass an object with the fields quality, resolution and folderPath, this fields are return by downloader method

```js
const downloader = new VideoDownloader("https://www.twitch.tv/videos/800558240");

const resolutions = await downloader.getVideoResolutionsAvailable();

const download = await downloader.download(resolutions[0]);

// Trancoded video, from HLS to MKV
const transcode = await downloader.transcode(download);
```

Once the function is finished executing, it returns an object with the following information

```js
{
    vodID: '800558240',
    quality: '1080p60',
    filePath: 'D:\\Projects\\twitch-video-downloader\\downloads\\videos\\800558240\\mkv\\1080p60.mkv'
}
```

### downloadChat: Asynchronous method to download chat

This function allows you to download the chat of a video. The return of the function is the raw data from the twitch api

```js
const downloader = new VideoDownloader("https://www.twitch.tv/videos/800558240");

// Download offline chat
const comments = await downloader.downloadChat();
```

## Credits

Some of the code is from libraries like [twitch-m3u8](https://github.com/dudik/twitch-m3u8) and [twitch-tools](https://github.com/HugoJF/twitch-tools)
