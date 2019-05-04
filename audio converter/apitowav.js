#!/usr/bin/env node
process.env.UV_THREADPOOL_SIZE = 128;

const Lame = require("node-lame").Lame;
const fetch = require ('node-fetch');
const Promise = require("bluebird");
const csv=require('csvtojson')

const mkdirp = require('mkdirp');

mkdirp('./raw', function (err) {
    if (err) console.error(err)
});

// const birdclass = [
//     'Spilopelia chinensis',
//     'Geopelia striata',
//     'Acridotheres tristis',
//     'Vanellus indicus',
//     'Passer montanus',
//     'Eudynamys scolopaceus',
//     'Cinnyris jugularis',
//     'Psilopogon haemacephalus',
//     'Egretta garzetta',
//     'Corvus macrorhynchos',
//     'Cacomantis merulinus'
// ];

function decode(mp3Url, filename='test') {

    var mp3Buffer;

    var res = fetch(mp3Url)
    .then(res => res.buffer())
    .then(buffer => {
        mp3Buffer = buffer;

        const decoder = new Lame({
            'output': './raw/' + filename + '.wav'
        }).setBuffer(mp3Buffer);
        
        decoder
            .decode()
            // .catch(error => {
            //     console.log(error)
            // });
    })
    // .catch((err) => console.log(err));

    return res;
}

function fetchclass(cname, c) {
    fetch('https://www.xeno-canto.org/api/2/recordings?query=' + cname)
    .then(res => res.json())
    .then(json => {

        (async () => {
            const promises = []
            console.log("Start " + c)
        
            var records = json.recordings;

            const max = records.length;
            let results = []
            let failedIds = []
            for (var i = 0; i < max; i++) {

                var r = records[i]
                var qq = (r.q.length == 1) ? r.q : 'F';
                var filename = qq + ("00" + (c)).slice(-3) + '_' + r.id;
                var mp3Url = 'https:' + r.file;

                try {

                    results.push(null)
                    promises.push((i => decode(mp3Url, filename).then((res) => {
                        let idx = Number(i)
                        results[idx] = "Ye"
                        return true;
                    }).catch(async (e) => {
                        // failed silently
                        let idx = Number(i)
                        results[idx] = "Nah"
                        failedIds.push(idx)
                        return false;
                    }))(i))

                } catch(e) {
                    continue
                }
            }
            console.log("Done " + c)
            async function evaluate(p) {
                return (await Promise.all(p)).reduce((acc, result) => (acc + ((result) ? 1 : 0)), 0)
            }
            try {
                let status = await evaluate(promises)
                console.log(`Failed: ${(1 - status / max) * 100}% (${max - status})`)
                let count = 1;
                let consecutiveFailedAttempt = 0;
                while (status < max && failedIds.length > 0) {
                    console.log(`Attempt ${count++}, try after 3000ms`)
                    await new Promise((resolve) => setTimeout(() => resolve(1), 3000))
                    let failedRequests = []
                    let oldFailedIds = failedIds.slice()
                    failedIds = []
                    for (let i = 0; i < oldFailedIds.length; i++) {
                        var idx = oldFailedIds[i]
                        var r = records[idx]
                        var qq = (r.q.length == 1) ? r.q : 'F';
                        var filename = qq + ("00" + (c)).slice(-3) + '_' + r.id;
                        var mp3Url = 'https:' + r.file;

                        failedRequests.push(((i) => (
                            decode(mp3Url, filename).then((res) => {
                                let idx = Number(i)
                                results[idx] = "Ye"
                                return true;
                            }).catch(async (e) => {
                                // failed silently
                                let idx = Number(i)
                                results[idx] = "Nah"
                                failedIds.push(idx)
                                return false;
                            })
                        ))(oldFailedIds[i]))
                    }
                    additional = await evaluate(failedRequests)
                    if(additional == 0) {
                        consecutiveFailedAttempt++;
                        if (consecutiveFailedAttempt > 10) {
                            console.log("Nothing works!")
                            break;
                        }
                    }
                    status += additional
                    console.log(`Class ${cname} Failed: ${(1 - status / max) * 100}% (${max - status}) @Attempt ${count}`)
                }
                console.log(`[Final] Class ${cname} Failed: ${(1 - status / max) * 100}% (${max - status})`)
            } catch(e) {
                console.log(e)
            }
            console.log(`Class ${cname}: Done processing`)
        })()


    })
    .catch((err) => console.log(err));
}

const csvFilePath='../tm_birdclass.csv'

csv()
.fromFile(csvFilePath)
.then((jsonObj)=>{

    // i = 51 74 76
    i = 76
    console.log(jsonObj[i]);
    fetchclass(jsonObj[i].name_sc, jsonObj[i].id)

})