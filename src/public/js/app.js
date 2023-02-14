//프론트 엔드
const socket = io(); //Socket IO 프레임워크 적용

/**
 * 이하는 통화(카메라 송출) 관련 코드
 */

const call = document.getElementById("call");
const myFace = document.getElementById("myFace");
const muteBtn = document.getElementById("mute");
const cameraBtn = document.getElementById("camera");
const cameraSelect = document.getElementById("cameras");

let myStream;
let muted = true;
let cameraOff = true;
let roomName;
let myPeerConnection;

call.hidden = true; //방 생성 전 통화 화면 감추기

//카메라 송출하기
async function getCameras() {
  try {
    //유저의 물리적 기기들의 정보를 가져오는 enumerateDevices()
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter((device) => device.kind === "videoinput"); //가져온 정보 중 카메라 정보만 필터링
    const currentCamera = myStream.getVideoTracks()[0]; //최초 접속 시 선택된 카메라 정보

    //가져온 카메라 정보를 화면에 select-option으로 표기
    cameras.forEach((camera) => {
      const option = document.createElement("option");
      option.value = camera.deviceId;
      option.innerText = camera.label;
      //첫 접속 시 사용중인 카메라로 셀렉트박스 옵션 설정
      if (currentCamera.label === camera.label) {
        option.selected = true;
      }
      cameraSelect.appendChild(option);
    });
  } catch (e) {
    console.log(e);
  }
}

async function getMedia(deviceId) {
  //오버로딩1. 인자값 없을 때
  const initialConstrains = {
    audio: true,
    video: { facingMode: "user" },
  };
  //오버로딩2. 인자값 deviceId를 받았을 때
  const cameraConstrain = {
    audio: true,
    video: { deviceId: { exact: deviceId } },
  };
  try {
    //유저의 미디어 인풋 사용을 허가받아 오디오나 비디오와 같은 미디어스트림을 돌려주는 메소드
    myStream = await navigator.mediaDevices.getUserMedia(
      deviceId ? cameraConstrain : initialConstrains
    );
    //웹페이지에 myStream에서 얻은 데이터 출력
    myFace.srcObject = myStream;
    //카메라 정보가 없다면 카메라 정보 가져오기(최초 접속 시 실행될 것)
    if (!deviceId) {
      await getCameras();
    }
  } catch (e) {
    console.log(e);
  }
}

function handleMuteClick() {
  //사용중인 오디오 트랙 정보 가져오기
  myStream
    .getAudioTracks()
    .forEach((track) => (track.enabled = !track.enabled));
  if (!muted) {
    muteBtn.innerHTML = "음소거 하기";
    muted = true;
  } else {
    muteBtn.innerHTML = "음소거 해제";
    muted = false;
  }
}
function handleCameraClick() {
  //사용중인 비디오 트랙 정보 가져오기
  myStream
    .getVideoTracks()
    .forEach((track) => (track.enabled = !track.enabled));
  if (cameraOff) {
    cameraBtn.innerHTML = "카메라 OFF";
    cameraOff = false;
  } else {
    cameraBtn.innerHTML = "카메라 ON";
    cameraOff = true;
  }
}

//사용자의 카메라 변경
async function handleCameraChange() {
  await getMedia(cameraSelect.value);
  if (myPeerConnection) {
    //변경한 비디오 트랙(카메라) 정보 가져오기
    const videoTrack = myStream.getVideoTracks()[0];
    //웹에서 스트리밍을 수행하는 객체 가져오기
    const videoSender = myPeerConnection
      .getSenders()
      .find((sender) => sender.track.kind === "video");
    videoSender.replaceTrack(videoTrack); //카메라 변경 적용하고 새로고침
  }
}

muteBtn.addEventListener("click", handleMuteClick);
cameraBtn.addEventListener("click", handleCameraClick);
cameraSelect.addEventListener("input", handleCameraChange);

/**
 * 이하 코드는 방 생성, 참가에 대한 WelcomeFrom 관련
 */

const welcome = document.getElementById("welcome");
const welcomeForm = welcome.querySelector("form");

//통화방 접속 시 실행
async function initCall() {
  welcome.hidden = true;
  call.hidden = false;
  await getMedia();
  makeConnection();
}

//통화방 생성, 참가 요청
async function handleWelcomeSubmit(event) {
  event.preventDefault();
  const input = welcomeForm.querySelector("input");
  await initCall();
  socket.emit("join_room", input.value); //백에 통화방 생성, 참가 요청
  roomName = input.value; //방 이름 저장해두기
  input.value = "";
}

welcomeForm.addEventListener("submit", handleWelcomeSubmit);

/**
 * 소켓 코드
 */

//통화방 생성 후 P2P 커넥션 수행
socket.on("welcome", async () => {
  //offer는 P2P 커넥션에서 필요한 구성요소를 전달하기 위한 설정값을 세팅
  const offer = await myPeerConnection.createOffer();
  myPeerConnection.setLocalDescription(offer);
  console.log("offer 송신");
  socket.emit("offer", offer, roomName); //offer를 백으로 전송
});

//백에서 넘어온 offer 수신
socket.on("offer", async (offer) => {
  console.log("offer 수신");
  myPeerConnection.setRemoteDescription(offer); //offer 수신
  const answer = await myPeerConnection.createAnswer();
  myPeerConnection.setLocalDescription(answer); //answer 송신
  socket.emit("answer", answer, roomName); //answer 백으로 전송
  console.log("answer 송신");
});

//백에서 넘어온 answer 수신
socket.on("answer", (answer) => {
  console.log("answer 수신");
  myPeerConnection.setRemoteDescription(answer); //answer 수신
});

//candidate 수신
socket.on("ice", (ice) => {
  console.log("candidate 수신");
  myPeerConnection.addIceCandidate(ice);
});

/**
 * RTC(Real Time Connect) 코드
 */

function makeConnection() {
  myPeerConnection = new RTCPeerConnection({
    //서로 다른 네트워크에서 IP 주소를 공유하기 위한 xirsys API
    iceServers: [
      {
        urls: ["stun:ntk-turn-2.xirsys.com"],
      },
      {
        username:
          "fNKNVVdXm8dzgqQmfAh16gNpm1R1-kXHE4PyNV4DrtNgUDvCjZ7G-1SbQUWUsJ3fAAAAAGN0V4Jla2RkbDIzNjU=",
        credential: "ee9863ae-655d-11ed-a6cf-0242ac120004",
        urls: [
          "turn:ntk-turn-2.xirsys.com:80?transport=udp",
          "turn:ntk-turn-2.xirsys.com:3478?transport=udp",
          "turn:ntk-turn-2.xirsys.com:80?transport=tcp",
          "turn:ntk-turn-2.xirsys.com:3478?transport=tcp",
          "turns:ntk-turn-2.xirsys.com:443?transport=tcp",
          "turns:ntk-turn-2.xirsys.com:5349?transport=tcp",
        ],
      },
    ],
  });
  //P2P 통신 방법을 서로에게 알리는 icecandidate
  myPeerConnection.addEventListener("icecandidate", handleIce);
  //
  myPeerConnection.addEventListener("addstream", handleAddstream);
  //접속 브라우저의 형태 구성
  myStream
    .getTracks()
    .forEach((track) => myPeerConnection.addTrack(track, myStream));
}

//candidate 전송
function handleIce(data) {
  console.log("candidate 전송");
  socket.emit("ice", data.candidate, roomName);
}

//상대방 카메라 출력
function handleAddstream(data) {
  const peerFace = document.getElementById("peerFace");
  peerFace.srcObject = data.stream;
}
