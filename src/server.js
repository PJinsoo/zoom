import { doesNotMatch } from "assert";
import express from "express";
import http from "http";
import { Server } from "socket.io"; //socketIO 프레임워크

//백엔드 node.js
//nodeJS의 프레임워크 express의 기본 사용 설정
const app = express();

app.set("view engine", "pug"); //탬플릿 엔진 pug 사용
app.set("views", __dirname + "/views"); //view단
app.use("/public", express.static(__dirname + "/public")); //프론트 설정
app.get("/", (req, res) => res.render("home"));
app.get("/wow", (req, res) => res.render("wow"));
app.get("/*", (req, res) => res.redirect("/")); //사용하지 않는 url로의 접근을 차단

const server = http.createServer(app); //HTTP 서버 생성
const io = new Server(server); //Socket IO 프레임워크를 통해 소켓 서버 생성

//소켓 연결
io.on("connection", (socket) => {
  socket.on("join_room", (roomName) => {
    socket.join(roomName); //통화방 생성, 참가
    socket.to(roomName).emit("welcome");
  });
  //p2p커넥션 정보가 담긴 offer를 프론트에서 받고, 다른 유저들에게 뿌려주기
  socket.on("offer", (offer, roomName) => {
    socket.to(roomName).emit("offer", offer);
  });
  //받은 offer에 대한 응답인 answer 전송
  socket.on("answer", (answer, roomName) => {
    socket.to(roomName).emit("answer", answer);
  });
  //icecandidate
  socket.on("ice", (ice, roomName) => {
    socket.to(roomName).emit("ice", ice);
  });
});

const handleListen = () => console.log(`Listening on http://localhost:3000`);
server.listen(3000, handleListen); //node.JS 포트연결
