function convertRate(rateString) {
  let rate = parseFloat(rateString);
  if (isNaN(rate) || rate < 0.1 || rate > 10.0) {
    rate = 1.0;
  }
  return rate;
}

function decodeString(str) {
  return str.replace(/&#x([\dA-Fa-f]+);/g, function (match, hex) {
    return String.fromCharCode(parseInt(hex, 16));
  });
}

async function submitSummarizationRequest(url) {
  var api_endpoint = "https://labs.kagi.com/v1";

  const response = await fetch(
    api_endpoint + "/summary_status?url=" + encodeURIComponent(url)
  );
  // get the response
  // if response.status is not completed then wait for 5 seconds and call the function again till response.status is completed
  // if response.status is completed then return the summary
  const data = await response.json();
  var summaryStatusElement = document.getElementById("summary-status");
  var summaryTextArea = document.getElementById("summary");
  // set the summary status element to the status and color yellow if the status is not completed
  // add last updated time to the status
  summaryStatusElement.textContent =
    "Summary Status: " +
    data.status +
    " Last Updated: " +
    response.headers.get("Date");
  if (data.status !== "completed") {
    summaryStatusElement.style.color = "grey";
  } else {
    summaryStatusElement.style.color = "green";
  }
  if (data.status === "completed") {
    summaryTextArea.textContent = decodeString(data.summary);
    return data.summary;
  } else {
    await new Promise((r) => setTimeout(r, 5000));
    return submitSummarizationRequest(url);
  }
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
      submitSummarizationRequest(url).then((summary) => {
        if (summary !== "") {
          var voice = document.getElementById("voice-select").value;
          var rate = convertRate(document.getElementById("speed-slider").value);
          // split the summary into sentences
          // for each sentence call chrome.tts.speak enqueue: true
          // if the sentence is the last sentence then set onEvent to end the speaking
          // start speaking with the first sentence and enqueue the rest
          var sentences = summary.split(".");
          for (var i = 0; i < sentences.length; i++) {
            var sentence = decodeString(sentences[i]);

            if (i === sentences.length - 1) {
              chrome.tts.speak(sentence, {
                voiceName: voice,
                rate: rate,
                enqueue: true,
                onEvent: function (event) {
                  if (event.type === "start") {
                    speaking = true;
                  } else if (event.type === "end") {
                    speaking = false;
                  }
                },
              });
            } else {
              chrome.tts.speak(sentence, {
                voiceName: voice,
                rate: rate,
                enqueue: true,
                onEvent: function (event) {
                  if (event.type === "start") {
                    speaking = true;
                  } else if (event.type === "end") {
                    speaking = false;
                  } else if (
                    event.type === "word" ||
                    event.type === "sentence"
                  ) {
                    console.log(event.charIndex);
                  }
                },
              });
            }
          }
        }
      });
    });
  });
});
