import * as express from 'express'
import * as multer from 'multer'
import * as cors from 'cors'
import * as fs from 'fs'
import * as path from 'path'
import * as Loki from 'lokijs'
const lfsa = require('lokijs/src/loki-fs-structured-adapter');
var adapter = new lfsa();

import { fileFilter, cleanFolder, bijectiveEncode, bijectiveDecode, padStart, execute, boomerangRender } from './utils'
import * as ffmpeg from 'fluent-ffmpeg'

const { exec } = require('child_process');
exec('ffmpeg -loglevel panic -codecs | grep libx264', (err) => {
  if (err) {
    console.log("ERROR: Application halted.  ffmpeg is not in the search path, or the libx264 codec is not bundled with it.  Please correct and relaunch.")
    process.exit();
  }
});

// setup
const Config = require('../config.json');
const DB_NAME = 'db.json';
const COLLECTION_NAME = 'images';
const UPLOAD_PATH = 'uploads';
const upload = multer({ dest: `${UPLOAD_PATH}/`, fileFilter: fileFilter });
const db = new Loki(`${UPLOAD_PATH}/${DB_NAME}`, { 
    adapter : adapter,
    autoload: true,
    autoloadCallback : databaseInitialize,
    autosave: true, 
    autosaveInterval: 4000
});

function databaseInitialize() {
    var log = db.getCollection(COLLECTION_NAME);
  
    if (log === null) {
      db.addCollection(COLLECTION_NAME);
    }
  }

// optional: clean all data before start
//cleanFolder(UPLOAD_PATH);

process.on('SIGINT', function() {
    console.log("flushing database");
    db.close();
    process.exit();
});

// app
const app = express();
app.use('/assets', express.static(__dirname + "/assets"));
app.use(cors());

app.get('/', async (req, res) => {
    // default route
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <title>Coke Dépanneur API</title>
    <link href="https://fonts.googleapis.com/css?family=Heebo:300|Heebo:500" rel="stylesheet">
    <style>
        html {
            background-color: #7b7a7a;
            font-family: "Heebo", sans-serif;
            color: white;
            word-break: break-word;
        }

        body {
            width: 80%;
            margin: 50px 10%;
            font-weight: 300;
        }

        main {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            min-width: 300px;
        }

        h1 {
            margin: 0;
            font-weight: 500;
        }

        h3 {
            font-weight: 300;
        }

        img.bubbles {
            height: 200px;
            float: right;
            padding: 0 0 0 30px;
        }
    </style>
</head>
<body>
    <main>
        <img class="bubbles" src="assets/bubbles.gif" alt="Bubble Logo" />
        <h1>Coke Dépanneur API</h1>
        <h3>Merci d’avoir participé à l’expérience du Dep Coca-Cola! N’oublie pas de partager avec #DepCocaCola</h3>
        <h3>Thank you for taking part in the Dep Coca-Cola Experience! Don’t forget to share your video online using #DepCocaCola</h3>
    </main>
</body>
</html>
`);
})

app.get('/upload', async (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="ie=edge">
        <title>Coke Dépanneur API</title>
        <link href="https://fonts.googleapis.com/css?family=Heebo:300|Heebo:500" rel="stylesheet">
        <style>
            html {
                background-color: #7b7a7a;
                font-family: "Heebo", sans-serif;
                color: white;
                word-break: break-word;
            }
    
            body {
                width: 80%;
                margin: 50px 10%;
                font-weight: 300;
            }
    
            main {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                min-width: 300px;
            }
    
            h1 {
                margin: 0;
                font-weight: 500;
            }
    
            h3 {
                font-weight: 300;
            }
    
            img.bubbles {
                height: 200px;
                float: right;
                padding: 0 0 0 30px;
            }
    
            form {
                position: relative;
                display: block;
                min-width: 55vw;
            }
    
            div > input { width: 20%; padding: 0 0.5em; }
            input[type="file"] {width: 62%; padding: 0em;line-height: 0;font-size: 1em; margin-top: 1em;}
            div > input, select {
                line-height: 2em;
                font-size: 1.2em;
                border: none;
                }
            input[type="submit"] { padding: 0.5em 1em;
                background: none;
                display: block;
                margin: 1em 0;
                background-color: #aaa;
                color: white;
                font-size: 1.4em;
                cursor: pointer;
                border: none;
            }
    
            input[type="submit"]:hover {
                background-color: black;
                color: white;
            }
        </style>
    </head>
    <body>
        <main>
          <img class="bubbles" src="assets/bubbles.gif" alt="Bubble Logo" />
            <h1>Coke Dépanneur API</h1>
            <h3>Upload area to simulate a video or imageset upload. Ensure that all fields are fully populated and that you are providing a minimum of 3 images or 1 video file or the API will return a 400 Bad Request error.</h3>
            <form action="/upload" method="post" enctype="multipart/form-data">
                <div>
                    <input type="text" name="areaCode" maxlength="3" placeholder="Area Code" />
                    <input type="text" name="prefix" maxlength="3" placeholder="Phone Prefix" />
                    <input type="text" name="suffix" maxlength="4" placeholder="Phone Suffix" />
                </div>
                <input type="file" name="files" multiple>
                <select name="lang">
                    <option>en</option>
                    <option>fr</option>
                </select>
                <input type="submit" value="Upload">
            </form>
        </main>
    </body>
</html>
`);
})

app.post('/upload', upload.array('files', 12), async (req, res) => {
    try {
        let data = [].concat(req.files);
        const uploadTime = new Date().getTime();
        const formFields = ["areaCode", "prefix", "suffix", "lang"];

        //Form Validation
        if (
            /^\d{3}$/.test(req.body["areaCode"]) &&
            /^\d{3}$/.test(req.body["prefix"]) &&
            /^\d{4}$/.test(req.body["suffix"]) &&
            /^en|fr$/.test(req.body["lang"]) &&
            /^image\b/i.test(data[0]["mimetype"])?(data.length>2?true:false):/^video\b|mpeg/i.test(data[0]["mimetype"])?(data.length>0?true:false):false
        ) {
            let col = db.getCollection(COLLECTION_NAME);
            if (col === null) {
                col = db.addCollection(COLLECTION_NAME);
            }

            data.map((x, i) => {
                formFields.map(field => {x[field] = req.body[field]});
                x.timestamp = new Date().getTime();

                try {
                    col.insert(x);

                    //Handle uploaded video
                    if (/^video\b|mpeg/i.test(x.mimetype)) {
                        try { 
                            let record = col.findOne({$loki: x.$loki});
                            record.downloadLink = Config.productionURL+bijectiveEncode(x.$loki)+"-"+ bijectiveEncode(x.timestamp.toString().slice(-4));
                            record.fileset = bijectiveEncode(uploadTime);
                            col.update(record);

                            execute('ffmpeg -i "'+UPLOAD_PATH+"/"+ x.filename+'" 2>&1 | sed -n "s/.*, \\(.*\\) fp.*/\\1/p"', function(response){
                                const sourceFPS = response.trim();

                                //Break video into image frames
                                ffmpeg()
                                .input(UPLOAD_PATH+"/"+ x.filename)
                                .inputFormat(/.*\.(.*)/.exec(x.originalname)[1])
                                .noAudio()
                                .outputOptions('-qscale', '1')
                                .save(UPLOAD_PATH+'/'+bijectiveEncode(uploadTime)+'_%06d.jpg')
                                .on('end', function(event) {
                                    boomerangRender(x, req.body, sourceFPS, uploadTime);
                                })
                            });

                        } catch (err) {
                            res.json(err);
                        }    
                    }

                    //Handle uploaded series of images
                    if (/^image\b/i.test(x.mimetype)) {
                        let record = col.findOne({$loki: x.$loki});
                        if (i+1 === data.length) {
                            record.downloadLink = Config.productionURL +bijectiveEncode(x.$loki)+"-"+ bijectiveEncode(x.timestamp.toString().slice(-4));
                        }
                        record.imagename = bijectiveEncode(uploadTime)+"_"+padStart(i.toString(), 6, "0")+"."+/.*\.(.*)/.exec(x.originalname)[1];
                        record.fileset = bijectiveEncode(uploadTime);
                        col.update(record);

                        fs.rename(x.destination + x.filename, x.destination + bijectiveEncode(uploadTime)+"_"+padStart(i.toString(), 6, "0")+"."+/.*\.(.*)/.exec(x.originalname)[1] , function(err){
                            if (err) res.json(err);
                            
                            //Video processing when reached the last image of fileset
                            if (i+1 === data.length) {
                                boomerangRender(x, req.body, 3, uploadTime);                              
                            }
                        });
                    }
                                        
                    //db.saveDatabase();
                    res.send('{"Message": "Your Upload was received and is being processed."}');
                } catch (err) {
                    res.json(err);
                }
            });
        } else {
            //Failed Form Validation
            res.sendStatus(400);
        }
    } catch (err) {
        res.sendStatus(400);
    }
})

app.get('/files', async (req, res) => {
    try {
        let col = db.getCollection(COLLECTION_NAME);
        if (col === null) {
            col = db.addCollection(COLLECTION_NAME);
        }

        let results = []
        col.data.forEach( function (row) {
            if (row.downloadLink !== undefined && row.downloadLink.length > 0) results.push({"downloadLink": row.downloadLink, "fileset": row.fileset, "$loki": row.$loki, "filename": row.filename })
        });
        res.send(results);
    } catch (err) {
        res.sendStatus(400);
    }
})

app.get('/:id', async (req, res) => {
    try {
        let col = db.getCollection(COLLECTION_NAME);
        if (col === null) {
            col = db.addCollection(COLLECTION_NAME);
        }
        const result = col.get(bijectiveDecode(req.params.id.split("-")[0]));

        if (!result) {
            res.sendStatus(404);
            return;
        };

        if (padStart(bijectiveDecode(req.params.id.split("-")[1]).toString(), 4, "0") === result.timestamp.toString().slice(-4)) {

            const filename = path.join(UPLOAD_PATH, result['fileset'] + '.mp4');
            if (fs.existsSync(filename)) {
                const stat = fs.statSync(filename)
                const fileSize = stat.size
                const range = req.headers.range

                if (range) {
                    const parts = range.toString().replace(/bytes=/, "").split("-")
                    const start = parseInt(parts[0], 10)
                    const end = parts[1] 
                    ? parseInt(parts[1], 10)
                    : fileSize-1
                    const chunksize = (end-start)+1
                    const file = fs.createReadStream(filename, {start, end})
                    const head = {
                        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                        'Accept-Ranges': 'bytes',
                        'Content-Length': chunksize,
                        'Content-Type': 'video/mp4',
                    }
                    res.writeHead(206, head);
                    file.pipe(res);
                } else {
                    const head = {
                        'Content-Length': fileSize,
                        'Content-Type': 'video/mp4',
                        'Content-disposition': 'attachment; filename=depCoke_' + bijectiveEncode(result.$loki)+"-"+ bijectiveEncode(result.timestamp.toString().slice(-4)) + '.mp4'
                    }
                    res.writeHead(200, head)
                    fs.createReadStream(filename).pipe(res)
                }
            } else {
                res.sendStatus(404);
                return;
            }
        } else {
            res.sendStatus(404);
            return;
        }
    } catch (err) {
        res.sendStatus(400);
    }
})

app.listen(3000, "localhost", function () {
    console.log('listening on port 3000!');
})