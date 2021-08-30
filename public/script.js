const socket = io("/");
const videoGrid = document.getElementById("video-grid");
let isAudioOff = true;
let isVideoOff = true;
let peerVideoIDs = [];
const disableAudioButton = document.getElementById('disableAudio');
const disableVideoButton = document.getElementById('disableVideo');
const audioInputSelect = document.querySelector("select#audioSource");
const audioOutputSelect = document.querySelector("select#audioOutput");
const videoSelect = document.querySelector("select#videoSource");
const selectors = [audioInputSelect, audioOutputSelect, videoSelect];

const myPeer = new Peer({
  host: location.hostname,
  port: location.port || (location.protocol === "https:" ? 443 : 80),
  path: "/peerjs",
  config: {
    iceServers: [
      {
        urls: "turn:3.70.23.101:3478",
        username: "webrtctest",
        credential: "servicelinkr",
      },
      {
        urls: [
          "stun:stun1.l.google.com:19302",
          "stun:stun2.l.google.com:19302",
        ],
      },
    ],
    iceCandidatePoolSize: 10,
  },
});

const myVideo = document.createElement("video");
myVideo.muted = true;
let peers = {};
let localMediaTracks = {};
navigator.mediaDevices
  .getUserMedia({
    video: true,
    audio: true,
    frameRate: {
      max: "20",
    },
  })
  .then((stream) => {
    localMediaTracks["audio"] = stream.getAudioTracks()[0];
    localMediaTracks["video"] = stream.getVideoTracks()[0];
    addVideoStream(myVideo, stream);

    myPeer.on("call", (call) => {
      peers[call.peer] = call;
      console.log("incoming call");
      call.answer(stream);
      const video = document.createElement("video");
      setSinkID(video, audioOutputSelect.value)
      video.id = call.peer
      peerVideoIDs.push(video.id)
      call.on("stream", (userVideoStream) => {
        addVideoStream(video, userVideoStream);
      });
      call.on("close", () => {
        console.log("call closed, attempting to reconnect");
        peerVideoIDs.splice(peerVideoIDs.indexOf(video.id), 1)
        video.remove();
      });
    });

    socket.on("user-connected", (userId) => {
      console.log("Connected: ", userId);
      setTimeout(() => {
        connectToNewUser(userId, stream);
      }, 1000);
    });
  });

socket.on("user-disconnected", (userId) => {
  if (peers[userId]) {
    peers[userId].close();
    delete peers[userId]
  };
});

myPeer.on("open", (id) => {
  console.log("trying to join room");
  socket.emit("join-room", ROOM_ID, id);
});

function connectToNewUser(userId, stream) {
  const call = myPeer.call(userId, stream);
  const video = document.createElement("video");
  setSinkID(video, audioOutputSelect.value)
  video.id = userId;
  peerVideoIDs.push(video.id)
  call.on("stream", (userVideoStream) => {
    addVideoStream(video, userVideoStream);
  });
  call.on("close", () => {
    peerVideoIDs.splice(peerVideoIDs.indexOf(video.id), 1)
    video.remove();
  });

  peers[userId] = call;
}

function addVideoStream(video, stream) {
  video.srcObject = stream;
  video.addEventListener("loadedmetadata", () => {
    video.play();
  });
  videoGrid.append(video);
}

//testing
disableAudioButton.onclick = () => {
  isAudioOff = !isAudioOff;
  localMediaTracks.audio.enabled = isAudioOff
  document.getElementById("disableAudio").style.backgroundColor = isAudioOff
    ? "green"
    : "red";
};

disableVideoButton.onclick = () => {
  isVideoOff = !isVideoOff;
  localMediaTracks.video.enabled= isVideoOff
  document.getElementById("disableVideo").style.backgroundColor = isVideoOff
    ? "green"
    : "red";
};

function gotDevices(deviceInfos) {
  // Handles being called several times to update labels. Preserve values.
  const values = selectors.map((select) => select.value);
  selectors.forEach((select) => {
    while (select.firstChild) {
      select.removeChild(select.firstChild);
    }
  });
  for (let i = 0; i !== deviceInfos.length; ++i) {
    const deviceInfo = deviceInfos[i];
    const option = document.createElement("option");
    option.value = deviceInfo.deviceId;
    if (deviceInfo.kind === "audioinput") {
      option.text =
        deviceInfo.label || `microphone ${audioInputSelect.length + 1}`;
      audioInputSelect.appendChild(option);
    } else if (deviceInfo.kind === "audiooutput") {
      option.text =
        deviceInfo.label || `speaker ${audioOutputSelect.length + 1}`;
      audioOutputSelect.appendChild(option);
    } else if (deviceInfo.kind === "videoinput") {
      option.text = deviceInfo.label || `camera ${videoSelect.length + 1}`;
      videoSelect.appendChild(option);
    } else {
      console.log("Some other kind of source/device: ", deviceInfo);
    }
  }
  selectors.forEach((select, selectorIndex) => {
    if (
      Array.prototype.slice
        .call(select.childNodes)
        .some((n) => n.value === values[selectorIndex])
    ) {
      select.value = values[selectorIndex];
    }
  });
}

function setSinkID(remoteVideo, audioDestination) {
  remoteVideo
      .setSinkId(audioDestination)
      .then(() => {
        console.log(
          `Success, audio output device attached: ${audioDestination}`
        );
      })
      .catch((error) => {
        let errorMessage = error;
        if (error.name === "SecurityError") {
          errorMessage = `You need to use HTTPS for selecting audio output device: ${error}`;
        }
        console.error(errorMessage);
        // Jump back to first output device in the list as it's the default.
        audioOutputSelect.selectedIndex = 0;
      });
}

function changeAudioDestination() {
  const audioDestination = audioOutputSelect.value;
  peerVideoIDs.forEach(id => {
    let remoteVideo = document.getElementById(id)
    if (typeof remoteVideo.sinkId !== "undefined") {
    setSinkID(remoteVideo, audioDestination)
  } else {
    console.warn("Browser does not support output device selection.");
  }
  })
  
}

function changeVideoSource() {
  const videoSource = videoSelect.value;
  const constraints = {
    video: { deviceId: videoSource ? { exact: videoSource } : undefined }
  }
  navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
    myVideo.srcObject = stream;
    localMediaTracks.video = stream.getVideoTracks()[0]
    localMediaTracks.video.enabled = isVideoOff;
    for (const peer in peers) {
      peers[peer].peerConnection.getSenders()[1].replaceTrack(localMediaTracks.video);
    }
  });
}

function changeAudioSource() {
  const audioSource = audioInputSelect.value;
  const constraints = {
    audio: { deviceId: audioSource ? { exact: audioSource } : undefined },
  };
  navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
    localMediaTracks.audio= stream.getAudioTracks()[0]
    localMediaTracks.audio.enabled = isAudioOff;
    for (const peer in peers) {
      peers[peer].peerConnection.getSenders()[0].replaceTrack(localMediaTracks.audio);
    }
  });
}

function handleError(error) {
  console.log(
    "navigator.MediaDevices.getUserMedia error: ",
    error.message,
    error.name
  );
}

audioInputSelect.onchange = changeAudioSource;
audioOutputSelect.onchange = changeAudioDestination;
videoSelect.onchange = changeVideoSource;
navigator.mediaDevices.enumerateDevices().then(gotDevices).catch(handleError);
