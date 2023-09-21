// ==UserScript==
// @name         Youtube chapter keyboard navigation
// @description  Navigate youtube's video chapters by using the keys 'p' and 'n'
// @version      3.0
// @author       dayvidKnows

// @namespace    https://github.com/DayvidKnows/Youtube-chapter-keyboard-navigation/
// @homepageURL  https://github.com/DayvidKnows/Youtube-chapter-keyboard-navigation/
// @downloadURL  https://github.com/DayvidKnows/Youtube-chapter-keyboard-navigation/raw/master/Youtube-chapter-keyboard-navigation.user.js
// @updateURL    https://github.com/DayvidKnows/Youtube-chapter-keyboard-navigation/raw/master/Youtube-chapter-keyboard-navigation.user.js

// @match        http*://www.youtube.com/watch*
// @require      https://code.jquery.com/jquery-3.4.1.min.js
// @grant        none

// @run-at       document-end

// ==/UserScript==

const enableDebugLogging = true;

function logDebug(message) {
  if (enableDebugLogging) {
    console.debug(`[Youtube chapter keyboard navigation] ${message}`);
  }
}

function wait(t) {
  return new Promise(r => setTimeout(r, t));
}

function selectAllWithShadyFallback(container, selector) {

  var element = container.querySelectorAll(selector);

  if (element === null || element.length === 0) {
    element = container.__shady_querySelectorAll(selector);
  }

  if (element === null || element.length === 0) {
    element = container.__shady_native_querySelectorAll(selector);
  }

  return element;
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

async function searchInApp(app, selector, check) {
  logDebug(`searching for ${selector}`);

  for (let i = 0; i < 20; i++) {
    const element = app.querySelector(selector);

    if (element !== null && check) {
      logDebug(`found: ${element}`);
      return element;
    }

    await wait(100);
  }
}

async function searchInAppForText(app, selector) {
  return await searchInApp(app, selector, (element) => element.textContent.trim() !== '');
}

async function searchInAppForParentWithChildren(app, selector) {
  return await searchInApp(app, selector, (element) => element.childElementCount > 1);
}

function extractChapterFromLink(container, selector) {
  logDebug(`searching in ${container} for '${selector}'`);

  return Array.from(container.querySelectorAll(selector))
    .map(element => parseInt(new URL(element.href).searchParams.get('t'), 10))
    .filter(time => !isNaN(time) && time >= 0);
}

function timeToSeconds(timeString) {
  const timePattern = /((?<hours>\d+):)?(?<minutes>\d{1,2}):(?<seconds>\d{2})/;

  const match = timePattern.exec(timeString);

  if (match) {
    const hours = parseInt(match.groups.hours ?? 0);
    const minutes = parseInt(match.groups.minutes);
    const seconds = parseInt(match.groups.seconds);

    return hours * 3600 + minutes * 60 + seconds;
  }

  return 0;
}

function extractChaptersFromTimeline(timeline, totalDuration) {
  const totalDurationInSeconds = timeToSeconds(totalDuration.textContent);

  const segmentWidths = Array.from(timeline.querySelectorAll('.ytp-chapter-hover-container'))
    .map(element => parseInt(element.offsetWidth, 10))
    .filter(time => !isNaN(time) && time >= 0);

  const totalWidth = segmentWidths.reduce((total, current) => total + current);

  return [0].concat(segmentWidths.map(segmentWidth => Math.round((segmentWidth / totalWidth) * totalDurationInSeconds))
    .map((sum = 0, current => sum += current)))
    .slice(0, -1);
}


(function () {
  getApp().then(app => {

    let lock = false;
    let times = [];

    function changeChapterEventHandler(event, video) {
      if (document.activeElement.id != 'contenteditable-root' && document.activeElement.id != 'search') {

        var blockDefaultAction = false;

        if (event.key == 'n') {

          const nextTime = Math.min(...times.filter(t => t > video.currentTime));

          logDebug(`trying to skip to next chapter at ${nextTime}`);

          if (nextTime > video.currentTime && nextTime < video.duration) {
            video.currentTime = nextTime;
          }

          blockDefaultAction = true;

        }
        else if (event.key == 'p') {

          const previousTime = Math.max(...times.filter(t => t < video.currentTime - 1));

          logDebug(`trying to skip to previous chapter at ${previousTime}`);
          if (previousTime < video.currentTime && previousTime >= 0) {
            video.currentTime = previousTime;
          }

          blockDefaultAction = true;

        }

        if (blockDefaultAction) {
          event.preventDefault();
          event.stopPropagation();

          if (!lock) {

            lock = true;

            logDebug('looking for times update');

            wait(4000).then(() => {
              const timelineLoader = searchInAppForParentWithChildren(app, '.ytp-chapters-container');
              const totalDurationLoader = searchInAppForText(app, '.ytp-time-duration');

              Promise.allSettled([timelineLoader, totalDurationLoader])
                .then(([timeline, totalDuration]) => {
                  const timelineTimes = extractChaptersFromTimeline(timeline.value, totalDuration.value);
                  logDebug(`timeline found ${timelineTimes.length} times [${timelineTimes}]`);

                  if (timelineTimes.length > times.length) {
                    times = timelineTimes;
                    logDebug('updating times from timeline');
                  }

                  logDebug('complete');

                  lock = false;
                });
            });

          }
        }
      }
    }

    async function main() {

      logDebug('start');

      const isWatchPage = app.hasAttribute('video-id') && !app.hidden;
      if (!isWatchPage) {
        window.onkeyup = null;
        return;
      }

      const videoId = app.getAttribute('video-id');

      const descriptionLoader = searchInAppForText(app, '#meta #description');
      const structuredDescriptionLoader = searchInAppForText(app, '#panels ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-macro-markers-description-chapters"]');
      const timelineLoader = searchInAppForParentWithChildren(app, '.ytp-chapters-container');
      const totalDurationLoader = searchInAppForText(app, '.ytp-time-duration');

      const [description, structuredDescription, timeline, totalDuration] = await Promise.allSettled([descriptionLoader, structuredDescriptionLoader, timelineLoader, totalDurationLoader]);

      const descriptionTimes = extractChapterFromLink(description.value, `.yt-core-attributed-string--link-inherit-color > a.yt-core-attributed-string__link--call-to-action-color[href^="/watch?v=${videoId}&t="]`);
      const structuredDescriptionTimes = extractChapterFromLink(structuredDescription.value, 'ytd-macro-markers-list-item-renderer > a#endpoint');
      timelineTimes = extractChaptersFromTimeline(timeline.value, totalDuration.value);

      logDebug(`description found ${descriptionTimes.length} times [${descriptionTimes}]`);
      logDebug(`structured description found ${structuredDescriptionTimes.length} times [${structuredDescriptionTimes}]`);
      logDebug(`timeline found ${timelineTimes.length} times [${timelineTimes}]`);


      if (timelineTimes.length >= structuredDescriptionTimes.length) {
        times = timelineTimes;
        logDebug('using timeline');
      }
      else if (structuredDescriptionTimes.length >= descriptionTimes.length) {
        times = structuredDescriptionTimes;
        logDebug('using structured description');
      }
      else if (descriptionTimes.length > 0) {
        times = descriptionTimes;
        logDebug('using description');
      }

      if (times.length === 0) {
        window.onkeyup = null;
        return;
      }

      const video = app.querySelector('#ytd-player video');

      window.onkeyup = (event) => { changeChapterEventHandler(event, video) };

      logDebug('complete');

    }

    main().catch(console.error);
    const mainObserver = new MutationObserver(main);
    mainObserver.observe(app, { attributeFilter: ['video-id', 'hidden'] });
  })
})();
