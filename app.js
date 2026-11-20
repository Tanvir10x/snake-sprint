import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import {
  getAuth, RecaptchaVerifier, signInWithPhoneNumber,
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCHQfCIyU1ajg8HXnOY0fvbC2_Wi3XoHn8",
  authDomain: "snake-sprint-5e5d0.firebaseapp.com",
  projectId: "snake-sprint-5e5d0",
  storageBucket: "snake-sprint-5e5d0.firebasestorage.app",
  messagingSenderId: "235945002849",
  appId: "1:235945002849:web:0595bbddf90366d9996720",
  measurementId: "G-GHR8CMV130"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const $ = (id) => document.getElementById(id);
const authView = $("authView"), gameView = $("gameView");
let mode = "register";
let confirmationResult = null;
let recaptchaVerifier = null;
let currentPhone = "";
let resendAvailableAt = 0;
let resendTimer = null;

function status(message, isError=false) {
  const el = $("authStatus");
  el.textContent = message;
  el.classList.toggle("error", isError);
}
function setMode(nextMode) {
  mode = nextMode;
  $("registerTab").classList.toggle("active", mode === "register");
  $("loginTab").classList.toggle("active", mode === "login");
  $("sendOtpBtn").textContent = mode === "register" ? "Get OTP" : "Send login OTP";
}
$("registerTab").addEventListener("click", () => setMode("register"));
$("loginTab").addEventListener("click", () => setMode("login"));

function makeRecaptcha() {
  if (recaptchaVerifier) {
    recaptchaVerifier.clear();
    recaptchaVerifier = null;
  }
  recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
    size: "invisible",
    callback: () => {},
    "expired-callback": () => status("reCAPTCHA expired. Please request a new code.", true)
  });
  return recaptchaVerifier;
}
function formatPhone() {
  const digits = $("phone").value.replace(/\D/g, "");
  if (digits.length < 6 || digits.length > 15) throw new Error("Enter a valid phone number.");
  return $("countryCode").value + digits;
}
async function sendCode(isResend=false) {
  const now = Date.now();
  if (isResend && now < resendAvailableAt) {
    const seconds = Math.ceil((resendAvailableAt-now)/1000);
    status(`Please wait ${seconds} seconds before requesting another code.`, true);
    return;
  }
  try {
    $("sendOtpBtn").disabled = true;
    $("resendBtn").disabled = true;
    status("Preparing secure phone verification…");
    if (!isResend) currentPhone = formatPhone();
    const verifier = recaptchaVerifier || makeRecaptcha();
    confirmationResult = await signInWithPhoneNumber(auth, currentPhone, verifier);
    $("phoneForm").classList.add("hidden");
    $("otpForm").classList.remove("hidden");
    $("otpHint").textContent = `A verification code was requested for ${currentPhone}.`;
    status("Verification SMS requested. Check your phone.");
    resendAvailableAt = Date.now() + 30000;
    startResendCountdown();
  } catch (error) {
    console.error(error);
    status(friendlyAuthError(error), true);
    try { if (recaptchaVerifier) { recaptchaVerifier.clear(); recaptchaVerifier = null; } } catch {}
  } finally {
    $("sendOtpBtn").disabled = false;
    $("resendBtn").disabled = false;
  }
}
function startResendCountdown() {
  clearInterval(resendTimer);
  const button = $("resendBtn");
  const update = () => {
    const seconds = Math.max(0, Math.ceil((resendAvailableAt-Date.now())/1000));
    button.disabled = seconds > 0;
    button.textContent = seconds > 0 ? `Resend OTP (${seconds}s)` : "Resend OTP";
    if (!seconds) clearInterval(resendTimer);
  };
  update();
  resendTimer = setInterval(update, 1000);
}
function friendlyAuthError(error) {
  const code = error?.code || "";
  if (code.includes("invalid-phone-number")) return "That phone number is invalid. Include the correct country code.";
  if (code.includes("too-many-requests")) return "Firebase temporarily blocked requests. Please wait and try again later.";
  if (code.includes("quota-exceeded")) return "The SMS quota for this project has been reached. Try later.";
  if (code.includes("captcha-check-failed")) return "reCAPTCHA verification failed. Refresh the page and try again.";
  if (code.includes("operation-not-allowed")) return "Phone sign-in is not enabled in Firebase Authentication.";
  if (code.includes("unauthorized-domain")) return "This website domain is not authorized in Firebase Authentication settings.";
  return error?.message || "Could not send the verification code. Check Firebase settings and try again.";
}
$("phoneForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  await sendCode(false);
});
$("resendBtn").addEventListener("click", async () => {
  if (Date.now() < resendAvailableAt) return;
  // Rebuild reCAPTCHA for a fresh resend challenge.
  try { if (recaptchaVerifier) { recaptchaVerifier.clear(); recaptchaVerifier = null; } } catch {}
  await sendCode(true);
});
$("changeNumberBtn").addEventListener("click", () => {
  confirmationResult = null;
  $("otpForm").classList.add("hidden");
  $("phoneForm").classList.remove("hidden");
  $("otp").value = "";
  status("");
  try { if (recaptchaVerifier) { recaptchaVerifier.clear(); recaptchaVerifier = null; } } catch {}
});
$("otpForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!confirmationResult) { status("Request a verification code first.", true); return; }
  const code = $("otp").value.trim();
  if (!/^\d{6}$/.test(code)) { status("Enter the 6-digit verification code.", true); return; }
  $("verifyBtn").disabled = true;
  status("Verifying code…");
  try {
    await confirmationResult.confirm(code);
    status("Phone verified. Welcome!");
  } catch (error) {
    console.error(error);
    status(friendlyAuthError(error), true);
  } finally {
    $("verifyBtn").disabled = false;
  }
});
$("logoutBtn").addEventListener("click", async () => {
  stopGame();
  try { await signOut(auth); } catch (error) { status(friendlyAuthError(error), true); }
});
onAuthStateChanged(auth, (user) => {
  if (user) {
    authView.classList.add("hidden");
    gameView.classList.remove("hidden");
    $("gameMessage").textContent = `Signed in as ${user.phoneNumber || "verified user"}. Press Start to play.`;
  } else {
    gameView.classList.add("hidden");
    authView.classList.remove("hidden");
  }
});

// Snake game
const canvas=$("board"), ctx=canvas.getContext("2d"), cell=20, cells=20;
let snake, food, direction, nextDirection, score, timer, running=false;
let best=Number(localStorage.getItem("snakeBest")||0);
$("best").textContent=best;
function resetGame(){
  snake=[{x:9,y:10},{x:8,y:10},{x:7,y:10}];
  direction={x:1,y:0}; nextDirection={x:1,y:0}; score=0;
  $("score").textContent="0"; placeFood(); draw();
}
function placeFood(){
  do { food={x:Math.floor(Math.random()*cells),y:Math.floor(Math.random()*cells)}; }
  while(snake.some(p=>p.x===food.x&&p.y===food.y));
}
function draw(){
  ctx.fillStyle="#0a1422";ctx.fillRect(0,0,400,400);ctx.strokeStyle="#14243a";ctx.lineWidth=1;
  for(let i=0;i<=400;i+=cell){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,400);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(400,i);ctx.stroke();}
  ctx.fillStyle="#ffcf70";ctx.beginPath();ctx.arc(food.x*cell+10,food.y*cell+10,7,0,Math.PI*2);ctx.fill();
  snake.forEach((p,i)=>{ctx.fillStyle=i===0?"#8cf0bd":"#39c98c";ctx.beginPath();ctx.roundRect(p.x*cell+2,p.y*cell+2,16,16,5);ctx.fill();});
}
function tick(){
  direction=nextDirection;const head={x:snake[0].x+direction.x,y:snake[0].y+direction.y};
  if(head.x<0||head.y<0||head.x>=cells||head.y>=cells||snake.some(p=>p.x===head.x&&p.y===head.y)){
    stopGame();$("gameMessage").textContent=`Game over — score ${score}. Press Start to try again.`;return;
  }
  snake.unshift(head);
  if(head.x===food.x&&head.y===food.y){score+=10;$("score").textContent=score;placeFood();if(score>best){best=score;localStorage.setItem("snakeBest",best);$("best").textContent=best;}}
  else snake.pop();
  draw();
}
function startGame(){if(running)return;if(!snake)resetGame();running=true;$("gameMessage").textContent="Game on!";$("startBtn").textContent="Restart";timer=setInterval(tick,125);}
function stopGame(){running=false;clearInterval(timer);}
$("startBtn").addEventListener("click",()=>{stopGame();resetGame();startGame();});
$("pauseBtn").addEventListener("click",()=>{if(running){stopGame();$("gameMessage").textContent="Paused";}else if(snake)startGame();});
function setDirection(name){
  const dirs={up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}};
  const d=dirs[name];if(d&&(d.x!==-direction.x||d.y!==-direction.y))nextDirection=d;
}
document.addEventListener("keydown",(e)=>{const map={ArrowUp:"up",ArrowDown:"down",ArrowLeft:"left",ArrowRight:"right"};if(map[e.key]){e.preventDefault();setDirection(map[e.key]);}});
document.querySelectorAll("[data-dir]").forEach(b=>b.addEventListener("click",()=>setDirection(b.dataset.dir)));
resetGame();
