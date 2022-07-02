// ==UserScript==
// @name         Youtube chapter keyboard navigation
// @description  Navigate youtube's video chapters by using the keys 'p' and 'n'
// @version      2.0
// @author       dayvidKnows

// @namespace    https://github.com/DayvidKnows/Youtube-chapter-keyboard-navigation/
// @homepageURL  https://github.com/DayvidKnows/Youtube-chapter-keyboard-navigation/
// @downloadURL  https://raw.githubusercontent.com/DayvidKnows/Youtube-chapter-keyboard-navigation/Youtube-chapter-keyboard-navigation.user.js
// @updateURL    https://raw.githubusercontent.com/DayvidKnows/Youtube-chapter-keyboard-navigation/Youtube-chapter-keyboard-navigation.user.js

// @match        http*://www.youtube.com/watch?v=*
// @require      https://code.jquery.com/jquery-3.4.1.min.js
// @grant        none

// ==/UserScript==

function wait(t) {
    return new Promise(r => setTimeout(r, t));
}

async function getApp() {
    while (true) {
        const app = document.body.querySelector('#content ytd-watch-flexy');

        if (app !== null) {
            return app;
        }

        await wait(100);
    }
}

( function() {
    getApp().then(app => {

        async function descriptionLoaded() {
            while (true) {
                const description = app.querySelector('#description');

                if (description !== null && description.textContent.trim() !== '') {
                    return description;
                }
                await wait(100);
            }
        }

        async function chapterContainerLoaded() {
            while (true) {
                const chapterContainer = app.querySelector('.ytp-chapters-container');

                if (chapterContainer !== null && chapterContainer.childElementCount > 1) {
                    return chapterContainer;
                }
                await wait(100);
            }
        }

        async function totalDurationLoaded() {
            while (true) {
                const totalDuration = app.querySelector('.ytp-time-duration');

                if (totalDuration !== null && totalDuration.textContent.trim() !== '') {
                    return totalDuration;
                }
                await wait(100);
            }
        }

        function getDescriptionChapters(description){
            const id = new URL(location.href).searchParams.get('v');

            const chapters = Array
                .from(description.querySelectorAll('a.yt-simple-endpoint[href*="/watch"][href*="t="][href*="v=' + id + '"]'))
                .map(e => {
                    const u = new URL(e.href);
                    const time = u.searchParams.get('t');

                    return parseInt(time, 10);
                    })
                .filter(t => !isNaN(t) && t >= 0);

            return chapters;
        }

        function getContainerChapters(chapterContainer, totalDuration){
            const totalDurationInSeconds = timeToSeconds(totalDuration.textContent);

            const segmentWidths = Array
                .from(chapterContainer.querySelectorAll('.ytp-chapter-hover-container'))
                .map(e => parseInt(e.style.width ?? 0, 10));

            const totalWidth = segmentWidths.reduce((total, current) => total + current);

            const chapters = segmentWidths.map(e => Math.round((e / totalWidth) * totalDurationInSeconds));
            chapters.unshift(0);
            chapters.pop();

            for(var i = 1; i < chapters.length; i += 1){
                chapters[i] += chapters[i - 1];
            }

            return chapters;
        }

        function timeToSeconds(timeString){
            const timePattern = /((?<hours>\d+):)?(?<minutes>\d{1,2}):(?<seconds>\d{2})/;

            const match = timePattern.exec(timeString);

            if(match){
                const hours = parseInt(match.groups.hours ?? 0);
                const minutes = parseInt(match.groups.minutes);
                const seconds = parseInt(match.groups.seconds);

                return hours * 3600 + minutes * 60 + seconds;
            }

            return 0;
        }


        function nextChapterTime(times, currentTime){
            return Math.min(...times.filter(t => t > currentTime));
        }

        function previousChapterTime(times, currentTime){
            return Math.max(...times.filter(t => t < currentTime-1));
        }

        function changeChapterEventHandler(event, video, times){
                if (document.URL.match(/https?:\/\/www\.youtube\.com\/watch\?/) && document.activeElement.id != 'contenteditable-root' && document.activeElement.id != 'search') {
                    var blockDefaultAction = false;

                    if (event.key == 'n') {
                        const nextTime = nextChapterTime(times, video.currentTime);
                        if (nextTime > video.currentTime && nextTime < video.duration){
                            video.currentTime = nextTime;
                        }
                        blockDefaultAction = true;
                    } else if (event.key == 'p') {
                        const previousTime = previousChapterTime(times, video.currentTime);
                        if(previousTime < video.currentTime && previousTime >= 0) {
                            video.currentTime = previousTime;
                        }
                        blockDefaultAction = true;
                    }

                    if (blockDefaultAction) {
                        event.preventDefault();
                        event.stopPropagation();
                    }
                }
            }

        async function main(){

            const isWatchPage = app.hasAttribute('video-id') && !app.hidden;

            if (!isWatchPage) {
                window.onkeyup = null;
                return;
            }

            const description = await descriptionLoaded();
            const chapterContainer = await chapterContainerLoaded();
            const totalDuration = await totalDurationLoaded();

            const descriptionTimes = getDescriptionChapters(description);
            const containerTimes = getContainerChapters(chapterContainer, totalDuration);

            const times = containerTimes.length > descriptionTimes.length ? containerTimes : descriptionTimes;

            if (!times.length) {
                window.onkeyup = null;
                return;
            }

            const video = app.querySelector('#ytd-player video');

            window.onkeyup = (event) => { changeChapterEventHandler(event, video, times)};
        }

        main().catch(console.error);
        const mainObserver = new MutationObserver(main);
        mainObserver.observe(app, {attributeFilter: ['video-id', 'hidden']});
    })
})();
