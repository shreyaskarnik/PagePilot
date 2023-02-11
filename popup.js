const API_ENDPOINT = "https://labs.kagi.com/v1";
function splitText(text) {
  // this function splits the text into sentences preserving the punctuation marks
  // it returns an array of sentences split using regex
  return text.match(/[^\.!\?]+[\.!\?]+/g);
}

function convertRate(rateString) {
  let rate = parseFloat(rateString);
  if (isNaN(rate) || rate < 0.1 || rate > 10.0) {
    rate = 1.0;
  }
  return rate;
}
function decodeString(str) {
  // replace &quot with "
  str = str.replace(/&quot;/g, '"');
  return str.replace(/&#x([\dA-Fa-f]+);/g, function (match, hex) {
    return String.fromCharCode(parseInt(hex, 16));
  });
}
function renderSummary(summary) {
  summary = decodeString(summary);
  var summaryElement = document.getElementById("summary");
  // clear any existing summary
  summaryElement.innerHTML = "";
  // for each sentence in the summary create a div and append it to the summary element
  // set the div text to the sentence
  // set the div class to "sentence"
  var re = /\b(\w\.\w\.)|([.?!])\s+(?=[A-Za-z])/g;
  var result = summary.replace(re, function (m, g1, g2) {
    return g1 ? g1 : g2 + "\r";
  });
  var sentences = result.split("\r");
  for (var i = 0; i < sentences.length; i++) {
    var sentence = sentences[i];
    var div = document.createElement("div");
    div.className = "sentence";
    div.textContent = sentence;
    summaryElement.appendChild(div);
  }
}

async function submitSummarizationRequest(url) {
  var payload = JSON.stringify({
    url: url,
  });
  const response = await fetch(API_ENDPOINT + "/summarization", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: payload,
  });
  const data = await response.json();
  console.log(data);
  return data;
}
async function checkStatus(url) {
  var summaryStatusElement = document.getElementById("summary-status");
  const response = await fetch(
    API_ENDPOINT + "/summary_status?url=" + encodeURIComponent(url)
  );
  const data = await response.json();
  summaryStatusElement.textContent =
    "Status: " + data.status + " Last Updated: " + response.headers.get("Date");
  if (data.status !== "completed" && data.status !== "failed") {
    summaryStatusElement.style.color = "grey";
  }
  if (data.status === "failed") {
    summaryStatusElement.textContent = "Summary Status: " + data.status;
    summaryStatusElement.style.color = "red";
    var summaryElement = document.getElementById("summary");
    summaryElement.innerHTML = data.summary;
  }
  if (data.status === "completed") {
    summaryStatusElement.style.color = "green";
  }
  return data;
}

async function getSummary(url) {
  var summaryElement = document.getElementById("summary");
  summaryElement.innerHTML = "";
  const summaryRequest = await submitSummarizationRequest(url);
  console.log("sent summary request");
  // while checkStatus response is not completed or failed keep checking when conditions are met return the summary
  var summaryStatus = await checkStatus(url);
  while (
    summaryStatus.status !== "completed" &&
    summaryStatus.status !== "failed"
  ) {
    await new Promise((r) => setTimeout(r, 1000));
    console.log("checking status");
    summaryStatus = await checkStatus(url);
  }
  return summaryStatus;
}

window.addEventListener("load", function () {
  chrome.tts.getVoices(function (voices) {
    var voiceSelect = document.getElementById("voice-select");
    for (var i = 0; i < voices.length; i++) {
      var option = document.createElement("option");
      option.textContent = voices[i].voiceName;
      option.value = voices[i].voiceName;
      voiceSelect.appendChild(option);
    }
  });

  chrome.storage.sync.get(["selectedVoice", "selectedRate"], function (result) {
    if (result.selectedVoice) {
      document.getElementById("voice-select").value = result.selectedVoice;
    }
    if (result.selectedRate) {
      document.getElementById("speed-slider").value = result.selectedRate;
    }
  });

  document
    .getElementById("voice-select")
    .addEventListener("change", function () {
      console.log("voice changed to " + this.value);
      chrome.storage.sync.set({ selectedVoice: this.value });
    });

  document
    .getElementById("speed-slider")
    .addEventListener("change", function () {
      console.log("speed changed to " + this.value + "x");
      chrome.storage.sync.set({ selectedRate: this.value });
    });

  var sampleButton = document.getElementById("play-button");
  var pauseButton = document.getElementById("pause-button");
  var stopButton = document.getElementById("stop-button");
  var summarizeButton = document.getElementById("summarize-button");
  var speaking = false;

  sampleButton.addEventListener("click", function () {
    if (speaking) {
      chrome.tts.stop();
      speaking = false;
      return;
    }

    var voice = document.getElementById("voice-select").value;
    var rate = convertRate(document.getElementById("speed-slider").value);
    chrome.tts.speak("This is a sample text.", {
      voiceName: voice,
      rate: rate,
      onEvent: function (event) {
        if (event.type === "start") {
          speaking = true;
        } else if (event.type === "end") {
          speaking = false;
        }
      },
    });
  });

  pauseButton.addEventListener("click", function () {
    if (speaking) {
      chrome.tts.pause();
      speaking = false;
    } else {
      chrome.tts.resume();
      speaking = true;
    }
  });
  stopButton.addEventListener("click", function () {
    if (speaking) {
      chrome.tts.stop();
      speaking = false;
    }
  });

  summarizeButton.addEventListener("click", function () {
    // log the current url
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      var activeTab = tabs[0];
      var url = activeTab.url;
      getSummary(url).then((summary) => {
        if (summary.summary !== "" && summary.status === "completed") {
          renderSummary(summary.summary);
          var summaryElement = document.getElementById("summary");
          // get each sentence from the summary
          var sentences = summaryElement.getElementsByClassName("sentence");
          var highlightedSentence = 0;
          function speechCallback(event) {
            console.log(event);
            if (event.type === "start") {
              speaking = true;
            } else if (event.type === "end") {
              sentences[highlightedSentence].className = "sentence highlighted";
              speaking = false;
              highlightedSentence++;
            } else if (event.type === "word" || event.type === "sentence") {
              console.log(event.charIndex);
            }
          }
          var voice = document.getElementById("voice-select").value;
          var rate = convertRate(document.getElementById("speed-slider").value);
          // split the summary into sentences
          // for each sentence call chrome.tts.speak enqueue: true
          // if the sentence is the last sentence then set onEvent to end the speaking
          // start speaking with the first sentence and enqueue the rest
          for (var i = 0; i < sentences.length; i++) {
            // set the class of sentence to highlight
            var sentence = sentences[i].innerText;
            if (i === sentences.length - 1) {
              chrome.tts.speak(sentence, {
                voiceName: voice,
                rate: rate,
                enqueue: true,
                onEvent: speechCallback,
              });
            } else {
              chrome.tts.speak(sentence, {
                voiceName: voice,
                rate: rate,
                enqueue: true,
                onEvent: speechCallback,
              });
            }
          }
        }
      });
    });
  });
});
