const express = require('express');
const fetch = require('node-fetch');

function fetchData(i) {
    return fetch('https://jsonplaceholder.typicode.com/todos/1');
}

(async () => {
    const promises = []
    console.log("Start")

    const max = 2000
    let results = []
    let failedIds = []
    for (var i = 0; i < max; i++) {
        results.push(null)
        promises.push((i => fetchData(i).then((res) => {
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
    }
    console.log("Done")
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
                failedRequests.push(((i) => (
                    fetchData(i).then((res) => {
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
            console.log(`Failed: ${(1 - status / max) * 100}% (${max - status}) @Attempt ${count}`)
        }
        console.log(`[Final] Failed: ${(1 - status / max) * 100}% (${max - status})`)
    } catch(e) {
        console.log(e)
    }
    console.log("Done processing")
})()