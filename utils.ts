import * as del from 'del';
import * as fs from 'fs'
import * as ffmpeg from 'fluent-ffmpeg'

const Config = require('../config.json');
/*
The config.json file contain authToken, accountSid, sourcePhone, englishMsg, & FrenchMsg variables.  Structure as:
    {
        "productionURL" : "https://[production host here]/",
        "accountSid" : "[Twilio Account SID here]",
        "authToken" : "[Twilio Private API key here]",
        "sourcePhone": "[Twilio source Phone number in standard international format with leading + sign]",
        "englishMsg" : "[English Msg here in UTF-8. No HTML Entities]",
        "frenchMsg" : "[French Msg here in UTF-8. No HTML Entities]"
    }
*/

const client = require('twilio')(Config.accountSid, Config.authToken);

const exec = require('child_process').exec;
function execute(command, callback){
    exec(command, function(error, stdout, stderr){ callback(stdout); });
};

const fileFilter = function (req, file, cb) {
    // accept image only
    if (!file.originalname.match(/\.(mp4|mpeg4|flv|jpg|jpeg|png|gif)$/)) {
        return cb(new Error('Files type not allowed'), false);
    }
    cb(null, true);
};

const cleanFolder = function (folderPath) {
    // delete files inside folder but not the folder itself
    del.sync([`${folderPath}/**`, `!${folderPath}`]);
};

// bijective encoding into a base 54 string that excludes visually similar characters
const bijectiveEncode = function (val) {
    const alpha = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'.split('');
  
    let n = val.valueOf();
    if (n === 0) return alpha[0];
  
    let base = alpha.length, result = [];
  
    while (n > 0) {
      result.push(alpha[n % base]);
      n = Math.floor(n / base);
    }
  
    return result.reverse().join('');
}
  
// bijective decoding from a base 54 string that excludes visually similar characters
const bijectiveDecode = function (val) {
    const alpha = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'.split('');

    let value = val.valueOf().trim();
    if (value === '') return 0;

    let base = alpha.length, result = 0;
    for (let n of value) result = (result * base) + alpha.indexOf(n);

    return (result);
}

const padStart = function(text, max, mask) {
    const cur = text.length;
    if (max <= cur) {
        return text;
    }
    const masked = max - cur;
    let filler = String(mask) || ' ';
    while (filler.length < masked) {
        filler += filler;
    }
    const fillerSlice = filler.slice(0, masked);
    return fillerSlice + text;
}

const boomerangRender = function(x, body, sourceFPS = 3, uploadTime) {
    //Build listing of images frames
    let imageSet = [];                       
    let uploadFiles = fs.readdirSync('./uploads/');
    uploadFiles.forEach( function (file) {
        if (new RegExp((bijectiveEncode(uploadTime) + "[_]\\d{0,6}[\.]jpg")).test(file)) imageSet.push(file);
    });
    
    //Add reverse frames for boomerang effect
    imageSet.slice(0).reverse().map((row, ind) => {
        fs.createReadStream(x.destination+ row).pipe(fs.createWriteStream(x.destination+ "/" +  bijectiveEncode(uploadTime) + "_" + padStart((imageSet.length + ind + (/^video\b|mpeg/i.test(x.mimetype)?1:0)).toString(), 6, "0")+".jpg"));
    });

    //Render Video from image frames
    ffmpeg()
    .input('uploads/'+bijectiveEncode(uploadTime)+'_%06d.jpg')
    .inputFPS(sourceFPS)
    .noAudio()
    .videoCodec('libx264')   
    .outputOptions('-pix_fmt', 'yuv420p')
    .save('uploads/'+bijectiveEncode(uploadTime)+'_unbranded.mp4')
    .on('end', function() {
        watermark('uploads/'+bijectiveEncode(uploadTime)+'_unbranded.mp4', x.lang, '+1'+body.areaCode+body.prefix+body.suffix, "https://depcoca-cola.com/"+bijectiveEncode(x.$loki)+"-"+bijectiveEncode(x.timestamp.toString().slice(-4)), x.mimetype);

        //Remove temp/boomerang image frames
        if (/^video\b|mpeg/i.test(x.mimetype)) {
            let uploadFiles = fs.readdirSync('./uploads/');
            uploadFiles.forEach( function (file) {
                if (new RegExp((bijectiveEncode(uploadTime) + "[_]\\d{0,6}[\.]jpg")).test(file)) fs.unlink('uploads/'+file, function(err){if(err) return console.log(err);});
            });
        } else if (/^image\b/i.test(x.mimetype)) {
            imageSet.slice(0).reverse().map((row, ind) => {
                fs.unlink(x.destination + "/" +  bijectiveEncode(uploadTime) + "_" + padStart((imageSet.length + ind).toString(), 6, "0") + ".jpg", function(err){if(err) return console.log(err);});
            });
        }

        return true;
    })
}

const watermark = function(video, lang, number, link, type) {
    ffmpeg()
    .input(video)
    .input('assets/Coke_TQ_2018_ScreenLower3rd_Final-optimized.png')
    .outputOptions('-qscale', '1')
    .outputOptions('-filter_complex', "crop='if(gte(iw,ih),ih,iw):if(gte(ih,iw),iw,ih)',scale=640x640,overlay=(main_w-overlay_w):(main_h-overlay_h)")
    .save(video.replace(/_unbranded\.mp4$/, '.mp4'))
    .on('end', function() {
        let fileSize = 0;
        const filename = video.replace(/_unbranded\.mp4$/, '.mp4');
        if (fs.existsSync(filename)) {
            const stat = fs.statSync(filename)
            fileSize = stat.size;
        }

        //Send SMS Message
        sendSMS(lang, number, link, type, fileSize);
    })
}

const sendSMS = function(lang, number, link, mimetype, fileSize = 0) {
    let sms = {
        body: (lang==="en"?Config.englishMsg:Config.frenchMsg) + " " + link,
        from: Config.sourcePhone,
        to: number
    }

    if (/^video\b|mpeg/i.test(mimetype) && /^\+1/.test(number) && link.length > 0 && fileSize < 512000) {
        sms['mediaUrl'] = link;
    }

    client.messages
    .create(sms)
    .catch(err => (err))
    .done() 
}

export { fileFilter, cleanFolder, bijectiveEncode, bijectiveDecode, padStart, execute, boomerangRender }