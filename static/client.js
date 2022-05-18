let connectSocket;
let chatSocket;
let username;
let mapPeers = {};
let chatRoom;
// let channel_name;

let userInput = document.querySelector('#username')
let btnConnect = document.querySelector('#connectButton')
let btnCreateChat = document.querySelector('#btnCreateChat')
let btnCall = document.querySelector('#callButton')
let newUser = document.querySelector('#newUser')

let acceptButton = document.querySelector('#acceptButton')
let callName = document.querySelector('#calleeName')
let caller = document.querySelector('#callerName')
let acceptDiv = document.querySelector('#acceptDiv')

let btnCamera = document.querySelector('#getMedia')
const camera = document.querySelector('#myVideo');
let callVideo = document.querySelector('#callVideo');

const btnOffer = document.querySelector('#createOffer');


const offerOptions = {
    offerToReceiveAudio: 1,
    offerToReceiveVideo: 1,
    iceRestart: 1,
    voiceActivityDetection: 0
};

const config = {
    iceServers: [
        {urls: 'stun:178.250.157.153:3478'},
        {
            urls: "turn:178.250.157.153:3478",
            username: "test",
            credential: "test123"
        }
    ],
    // iceTransportPolicy: "all"
};

let localStream = new MediaStream()

const constraints = window.constraints = {
    audio: false,
    video: true
};


function stream(e) {
    navigator.mediaDevices.getUserMedia(constraints)
        .then(stream => {
            localStream = stream;
            camera.srcObject = localStream;
            camera.muted = true;

            let audioTrack = stream.getAudioTracks()
            let videoTrack = stream.getVideoTracks()
            audioTrack[0].enabled = true
            videoTrack[0].enabled = true

            console.log(stream);
        }).catch(error => {
        console.log('Error media', error)
    })
}


function setOnTrack(peer) {
    let remoteVideo = new MediaStream()
    callVideo.srcObject = remoteVideo

    peer.addEventListener('track', async (event) => {
        remoteVideo.addTrack(event.track)
    })
}


function createOffer(username, channel_name) {
    console.log("offer", channel_name)
    const peerConnection = new RTCPeerConnection(config);
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream)
    });

    let pc = peerConnection.createDataChannel('channel')
    pc.addEventListener('open', ev => {
        console.log('Peer connection opened')
    })

    setOnTrack(peerConnection)

    mapPeers[username] = [peerConnection, pc]

    peerConnection.addEventListener('iceconnectionstatechange', (e) => {
        let iceConnectionState = peerConnection.iceConnectionState
        if (iceConnectionState === 'field' ||
            iceConnectionState === 'disconnected' ||
            iceConnectionState === 'closed') {
            delete mapPeers[username]
            if (iceConnectionState !== 'closed') {
                peerConnection.close()
            }
            acceptDiv.style.display = 'none';
        }
    })

    peerConnection.addEventListener('icecandidate', (event) => {
        if (event.icecandidate) {
            console.log('New ICE candidate', JSON.stringify(peerConnection.localDescription))
            //return;
        }

        send('new_offer', {
            channel: channel_name,
            sdp: peerConnection.localDescription,
        })
    })

    peerConnection.createOffer(offerOptions)
        .then(offer => {
            peerConnection.setLocalDescription(offer);
            console.log('peerConnection.createOffer', offer);
        })
        .then(() => {
            console.log('Local Description set')
        })
}


function createAnswer(offer, channel_name) {
    console.log("answer")

    const peerConnection = new RTCPeerConnection(config);
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream)
    });

    peerConnection.addEventListener('datachannel', (e) => {
        peerConnection.pc = e.channel
        peerConnection.pc.addEventListener('open', ev => {
            console.log('Peer connection opened')
        })
        // peerConnection.pc.addEventListener('message', )
        mapPeers[username] = [peerConnection, peerConnection.pc]
    })

    setOnTrack(peerConnection)

    peerConnection.addEventListener('iceconnectionstatechange', () => {
        let iceConnectionState = peerConnection.iceConnectionState
        if (iceConnectionState === 'field' ||
            iceConnectionState === 'disconnected' ||
            iceConnectionState === 'closed') {
            delete mapPeers[username]
            if (iceConnectionState !== 'closed') {
                peerConnection.close()
            }

            acceptDiv.style.display = 'none';
        }
    })

    peerConnection.addEventListener('icecandidate', (event) => {
        if (event.icecandidate) {
            console.log('New ICE candidate', JSON.stringify(peerConnection.localDescription))
            return;
        }

        send('new_answer', {
            sdp: peerConnection.localDescription,
            channel: channel_name
        })
    })

    peerConnection.setRemoteDescription(offer)
        .then(() => {
            console.log('Set Remote Description', username);
            return peerConnection.createAnswer()
        })
        .then(answer => {
            console.log('Answer create');
            peerConnection.setLocalDescription(answer)
        })
}

function send(action, message) {
    chatSocket.send(JSON.stringify({
            peer: username,
            action: action,
            message: message,
        }
    ));
}

function message(e) {
    const data = JSON.parse(e.data)
    console.log('data', data)

    // let action =
    // let peer = data['receive_data']['peer']

    console.log('data[\'receive_data\'][\'peer\']', data['receive_data']['peer'])
    console.log('data[\'receive_data\'][\'action\']', data['receive_data']['action'])
    console.log('data[\'receive_data\'][\'message\'][\'channel\']', data['receive_data']['message']['channel'])
    console.log('data[\'receive_data\'][\'message\'][\'sdp\']', data['receive_data']['message']['sdp'])
    console.log('mapPeers[data[\'receive_data\'][\'peer\']]', mapPeers[data['receive_data']['peer']])

    if (data['receive_data']['peer'] === username) {
        console.log('data[\'receive_data\'][\'peer\'] === username', username)
        return;
    }

    if (data['receive_data']['action'] === 'new_peer') {
        createOffer(data['receive_data']['peer'], data['receive_data']['message']['channel'])
        return;
    }

    if (data['receive_data']['action'] === 'new_offer') {
        createAnswer(data['receive_data']['message']['sdp'], data['receive_data']['message']['channel'])
        return;
    }

    if (data['receive_data']['action'] === 'new_answer') {

        let peer = mapPeers[data['receive_data']['peer']][0]
        peer.setRemoteDescription(data['receive_data']['message']['sdp'])

    }
}


function create_or_connect_room(room) {
    console.log("USERNAME", username)
    btnCreateChat.style.display = 'none'

    chatSocket = new WebSocket('ws://127.0.0.1:8000/chat/' + room)
    chatSocket.addEventListener('open', (e) => {
        console.log("ChatSocket connection opened")
        send('new_peer', {})
    })
    chatSocket.addEventListener('close', (e) => {
        console.log("ChatSocket connection close")
    })
    chatSocket.addEventListener('message', message)
    chatSocket.addEventListener('error', (e) => {
        console.log(e)
    })

}


btnConnect.addEventListener('click', () => {
    username = userInput.value
    if (username === '') {
        return;
    }

    userInput.style.display = 'none'
    btnConnect.style.display = 'none'
    btnCreateChat.style.display = 'block'
    newUser.innerHTML = username

    connectSocket = new WebSocket('ws://127.0.0.1:8000/' + username)
    connectSocket.addEventListener('open', (e) => {
        console.log("WebSocket connection opened")
    })
    connectSocket.addEventListener('close', (e) => {
        console.log("WebSocket connection close")
    })
    connectSocket.addEventListener('message', (e) => {
        const data = JSON.parse(e.data)
        if (data.calling === 'ok' && username === data.callee) {
            // caller.value = data.caller;
            acceptDiv.style.display = 'block';
            chatRoom = data.room
        }
    })
    connectSocket.addEventListener('error', (e) => {
    })
})


btnCreateChat.addEventListener('click', () => {
    let room = 'test'// Math.random().toString(36).substr(10, 17);
    connectSocket.close()
    create_or_connect_room(room)
})


btnCall.addEventListener('click', (e) => {
    send('call', {login: callName.value})
})

acceptButton.addEventListener('click', () => {
    connectSocket.close()
    create_or_connect_room(chatRoom)
})

btnCamera.addEventListener('click', (e) => {
    stream(e);
})

// btnOffer.addEventListener('click', (e) => {
//     offer(e);
// })

