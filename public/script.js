const socket = io('/')
const videoGrid = document.getElementById('video-grid')
const myPeer = new Peer(undefined, {
config: {'iceServers': [
    {
      urls: "turn:3.67.189.176:3478",
      username: "webrtctest",
      credential: "servicelinkr",
    },
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
  iceCandidatePoolSize: 10
}})
const myVideo = document.createElement('video')
myVideo.muted = true
const peers = {}
navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true,
  frameRate: {
    "max": "20"
}
}).then(stream => {
  addVideoStream(myVideo, stream)

  myPeer.on('call', call => {
    console.log('incoming call')
    call.answer(stream)
    const video = document.createElement('video')
    call.on('stream', userVideoStream => {
      addVideoStream(video, userVideoStream)
    })
  })

  socket.on('user-connected', userId => {
    console.log("Connected: ", userId)
    setTimeout(() => {
      connectToNewUser(userId, stream)  
    }, 1000);
  })
})

socket.on('user-disconnected', userId => {
  if (peers[userId]) peers[userId].close()
})

myPeer.on('open', id => {
  console.log('trying to join room')
  socket.emit('join-room', ROOM_ID, id)
})

myPeer.on('disconnected', function (){
  console.log('disconnected from signaling server')
})

myPeer.on('close', function (){
  console.log('peer destroyed')
})

myPeer.on('error', function (err){
  console.log(err)
})


function connectToNewUser(userId, stream) {
  const call = myPeer.call(userId, stream)
  const video = document.createElement('video')
  call.on('stream', userVideoStream => {
    addVideoStream(video, userVideoStream)
  })
  call.on('close', () => {
    video.remove()
  })

  peers[userId] = call
}

function addVideoStream(video, stream) {
  video.srcObject = stream
  video.addEventListener('loadedmetadata', () => {
    video.play()
  })
  videoGrid.append(video)
}
