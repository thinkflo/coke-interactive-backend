# ExpressJS app for an Interactive CocaCola Kiosk as part of the #depcocacola campaign using NodeJS, ExpressJS, Mutler, LokiJS, Typescript, & Fluent-FFMPEG. 

The app processes form uploaded FLVs and applies a boomerang effect, crops, watermarks, and creates and hosts a downloadable permalink and then sends MMS/SMS message info via Twilio API. The application is served behind a reverse NGINX proxy and daemonized using PM2.  

**REQUIREMENT: FFMPEG must be compiled with the libx264 video codec and be accessible in the global search path.**



1. Install ffmpeg using `sudo yum install ffmpeg` on Centos 7 or `brew install ffmpeg` on OSX
2. Install [nodejs](https://nodejs.org/en/) (version 5+) and [npm].
3. Clone this repo `git clone https://github.com/thinkflo/coke-interactive-backend.git`
3. Go to project directory `cd coke-interactive-backend`, and run `npm install` to install dependancies.
4. Using an editor, add the mandatory `config.json` file in project directory with the following structure:
```
    {
        "productionURL" : "https://[production host here]/",
        "accountSid" : "[Twilio Account SID here]",
        "authToken" : "[Twilio Private API key here]",
        "sourcePhone": "[Twilio source Phone number in standard international format with leading + sign]",
        "englishMsg" : "[English Msg here in UTF-8. No HTML Entities]",
        "frenchMsg" : "[French Msg here in UTF-8. No HTML Entities]"
    }
```
5. Start the application, run `npm start`.
6. Go to `localhost:3000` in a webbrowser.

## API End Points

1. Upload video or multiple images via `localhost:3000/upload` field.
2. View list of generated files via `localhost:3000/files`.
3. Download transcoded video file via `localhost:3000/{permaLinkId}`.


