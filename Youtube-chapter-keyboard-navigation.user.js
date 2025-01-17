// ==UserScript==
// @name         Youtube chapter keyboard navigation
// @description  Navigate youtube's video chapters by using the keys 'p' and 'n'
// @version      4.0.0
// @author       dayvidKnows

// @namespace    https://github.com/DayvidKnows/Youtube-chapter-keyboard-navigation/
// @homepageURL  https://github.com/DayvidKnows/Youtube-chapter-keyboard-navigation/
// @downloadURL  https://github.com/DayvidKnows/Youtube-chapter-keyboard-navigation/raw/master/Youtube-chapter-keyboard-navigation.user.js
// @updateURL    https://github.com/DayvidKnows/Youtube-chapter-keyboard-navigation/raw/master/Youtube-chapter-keyboard-navigation.user.js

// @match        *://www.youtube.com/*
// ==/UserScript==


const enableDebugLogging = false;

let times = [];
let descriptionTimes = [];
let structuredDescriptionTimes = [];
let timelineTimes = [];
let currentTime = 0;
let duration = 0;

function logDebug(message) {
  if (enableDebugLogging) {
    console.debug(`[Youtube chapter keyboard navigation] ${message}`);
  }
}

function wait(t) {
  return new Promise(r => setTimeout(r, t));
}

async function getApp() {
  while (true) {
    const selector = '#content ytd-watch-flexy';
    const element = document.body.querySelector(selector);

    if (element !== null) {
      logDebug(`found ${selector}`);
      return element;
    }

    await wait(100);
  }
}

async function getElement(selector) {
  for (let i = 0; i < 20; i++) {
    const element = document.body.querySelector(selector);

    if (element !== null) {
      logDebug(`found ${selector}`);
      return element;
    }

    await wait(100);
  }

  logDebug(`can't find ${selector}`);
}

async function getProgressBar() {
  return getElement('.ytp-progress-bar');
}

async function getDuration() {
  return getElement('.ytp-time-duration');
}

async function getStructuredDescription() {
  return getElement('#secondary #panels ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-macro-markers-description-chapters"] #contents.ytd-macro-markers-list-renderer');
}

async function getDescription() {
  return getElement('#secondary #panels ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-structured-description"] #content.ytd-expander #description yt-attributed-string span');
}

async function getVideoContainer() {
  return getElement('.html5-video-container');
}

function removeOneSecondSegments(array){
  return array.reduce((acc, current, index, array) => { if (index === 0 || array[index - 1] + 1 !== current) { acc.push(current) } else if (array[index - 1] + 1 === current) { acc[acc.length - 1] = current; } return acc }, []);
}

function extractSegmentFromLink(container, selector) {
  logDebug(`searching for link '${selector}'`);

  const links = Array.from(container.querySelectorAll(selector));
  logDebug(`link count: ${links.length}`);

  let absoluteSegments = links.map(element => parseInt(new URL(element.href).searchParams.get('t'), 10)).filter(time => !isNaN(time) && time > 0);
  absoluteSegments = removeOneSecondSegments(absoluteSegments);
  absoluteSegments = [0].concat(absoluteSegments);

  return [...new Set(absoluteSegments)].sort((a, b) => (a - b));
}

function extractSegmentsFromTimeline(timelineElement) {
  logDebug(`duration: ${duration}`);

  const segmentWidths = Array.from(timelineElement.querySelectorAll('.ytp-chapter-hover-container'))
    .map(element => element.offsetWidth)
    .filter(width => !isNaN(width) && width > 0);
  logDebug(`segmentWidths: [${segmentWidths}]`);

  const totalWidth = Math.max(segmentWidths.reduce((total, current) => total + current, 0), 1);
  logDebug(`totalWidth: ${totalWidth}`);

  const timedSegments = segmentWidths.map(segmentWidth => Math.round((segmentWidth / totalWidth) * duration));
  let absoluteSegments = timedSegments.map((sum = 0, current => sum += current));
  absoluteSegments = [0].concat(absoluteSegments);

  const distinctSegments = [...new Set(absoluteSegments)].sort((a, b) => (a - b));

  return distinctSegments.slice(0, -1);
}

function timeToSeconds(timeString) {
  const timePattern = /(((?<days>\d+):)?((?<hours>\d{1,2}):))?(?<minutes>\d{1,2}):(?<seconds>\d{2})/;

  const match = timePattern.exec(timeString);

  if (match) {
    const days = parseInt(match.groups.days ?? 0);
    const hours = parseInt(match.groups.hours ?? 0);
    const minutes = parseInt(match.groups.minutes);
    const seconds = parseInt(match.groups.seconds);

    return days * 86400 + hours * 3600 + minutes * 60 + seconds;
  }

  return 0;
}

function secondsToTime(totalSeconds) {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor(totalSeconds % 86400 / 3600);
  const minutes = Math.floor(totalSeconds % 3600 / 60);
  const seconds = Math.floor(totalSeconds % 60);

  const doubleDigitSeconds = seconds.toString().padStart(2, '0');
  let timeString = `${minutes}:${doubleDigitSeconds}`;

  if (hours > 0) {
    const doubleDigitMinutes = minutes.toString().padStart(2, '0');

    timeString = `${hours}:${doubleDigitMinutes}:${doubleDigitSeconds}`;

    if (days > 0) {
      const doubleDigitHours = hours.toString().padStart(2, '0');

      timeString = `${doubleDigitHours}:${doubleDigitMinutes}:${doubleDigitSeconds}`;
    }
  }

  return timeString;
}

function updateVideoCurrentTime(key, video){

  currentTime = video.currentTime || currentTime;

  const noSegments = times.length <= 1;

  let nextTime = Math.min(...times.filter(time => time > currentTime), duration);
  let previousTime = Math.max(0, ...times.filter(time => time < currentTime - 1));

  const segmentLength = nextTime - previousTime;
  const isLargeSegment = segmentLength > 600; // larger than 10 minutes
  const largeSegmentJump = noSegments ? segmentLength / 10 : segmentLength / 6;

  if (key === 'n') {

    if (noSegments || isLargeSegment && (nextTime - currentTime > largeSegmentJump || nextTime === duration)) {
      nextTime = Math.min(currentTime + largeSegmentJump, duration);
    }

    logDebug(`next segment at ${secondsToTime(nextTime)}`);

    if (nextTime <= duration) {
      currentTime = nextTime;
    }
  }
  else if (key === 'p') {

    if (noSegments || isLargeSegment && currentTime - previousTime > largeSegmentJump) {
      previousTime = Math.max(0, currentTime - largeSegmentJump);
    }

    logDebug(`previous segment at ${secondsToTime(previousTime)}`);

    if (previousTime >= 0) {
      currentTime = previousTime;
    }
  }

  video.currentTime = currentTime;
}


function keyPressEventHandler(event, video) {
  const activeElement = document.activeElement;

  console.debug(activeElement);

  const isFocusOnSearchBar = activeElement.id === 'search' || activeElement.className.match("search");
  const isFocusOnComment = activeElement.id === 'contenteditable-root';

  if(!isFocusOnSearchBar && !isFocusOnComment) {

    const key = event.key;

    if (key === 'n' || key === 'p') {
      logDebug(`${key} key press`);

      updateVideoCurrentTime(key, video)

      event.preventDefault();
      event.stopPropagation();
    }
  }
  else {
    logDebug('Wrong focus');
  }
}

function updateTimes() {
  if (structuredDescriptionTimes.length >= timelineTimes.length && structuredDescriptionTimes.length >= descriptionTimes.length) {
    times = structuredDescriptionTimes;
    logDebug(`using structured description: [${structuredDescriptionTimes}]`);
  }
  else if (timelineTimes.length >= descriptionTimes.length) {
    times = timelineTimes;
    logDebug(`using timeline: [${timelineTimes}]`);
  }
  else if (descriptionTimes.length > 0) {
    times = descriptionTimes;
    logDebug(`using description: [${descriptionTimes}]`);
  }
}

async function progressBarChanged(progressBar) {
  const timeline = progressBar.querySelector('.ytp-chapters-container');

  durationElement = await getDuration();
  duration = timeToSeconds(durationElement.textContent);

  if (timeline.childElementCount > 0) {
    timelineTimes = extractSegmentsFromTimeline(timeline) ?? [];

    logDebug(`timeline times: [${timelineTimes}]`);

    updateTimes();
  }
}

function structuredDescriptionChanged(structuredDescription) {
  structuredDescriptionTimes = extractSegmentFromLink(structuredDescription, 'ytd-macro-markers-list-item-renderer > a#endpoint') ?? [];

  logDebug(`structured description times: [${structuredDescriptionTimes}]`);

  updateTimes();
}

async function descriptionChanged(description) {
  const app = await getApp();
  const videoId = app.getAttribute('video-id');

  descriptionTimes = extractSegmentFromLink(description, `yt-attributed-string a[href^="/watch?v=${videoId}&t="]`) ?? [];

  logDebug(`description times: [${descriptionTimes}]`);

  updateTimes();
}

function videoContainerChanged(videoContainer){
    const video = videoContainer.querySelector('.video-stream');

    window.onkeypress = (event) => keyPressEventHandler(event, video);
}

function appChanged(app) {
  const isWatchPage = app.hasAttribute('video-id') && !app.hidden;
  if (!isWatchPage) {
    window.onkeyup = null;
    return;
  }

  logDebug('is watch page');

  getProgressBar().then(progressBar => {
    logDebug('progressBar found. attaching observer');

    progressBarChanged(progressBar);

    const observer = new MutationObserver(() => progressBarChanged(progressBar));
    observer.observe(progressBar, { childList: true });
  });


  getStructuredDescription().then(structuredDescription => {
    if (structuredDescription) {
      logDebug('structuredDescription found. attaching observer');

      structuredDescriptionChanged(structuredDescription);

      const observer = new MutationObserver(() => structuredDescriptionChanged(structuredDescription));
      observer.observe(structuredDescription, { childList: true });
    }
  });

  getDescription().then(description => {
    if (description) {
      logDebug('description found. attaching observer');

      descriptionChanged(description);

      const observer = new MutationObserver(() => descriptionChanged(description));
      observer.observe(description, { childList: true });
    }
  });

  getVideoContainer().then(videoContainer => {
    logDebug('videoContainer found. attaching observer');

    videoContainerChanged(videoContainer);

    const observer = new MutationObserver(() => videoContainerChanged(videoContainer));
    observer.observe(videoContainer, { childList: true });
  });

}

(function () {
  getApp().then(app => {
    logDebug('app found. attaching observer');

    appChanged(app);

    const observer = new MutationObserver(() => appChanged(app));
    observer.observe(app, { attributeFilter: ['video-id', 'hidden'] });
  });
})();
