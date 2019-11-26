let video;
let poseNet;
let poses = [];

let playing = false;
let loading = true;
let gameState = 0;
let score = 0;
let target;
let records = [];

let animationCount = 0;
let animationColor;
let animationPosition = { x: 50, y: 50 };

let nose = { x: -1000, y: -1000 };
let minRadius = 13;
let targetRadius = 60;
let radiusDecayRate = 0.97;

let minLimit = 1000;
let timeLimit = 5000;
let timeLimitDecayRate = 0.97;
let lastTimestamp;
let ratio = 1;

let timingWidth = 20;

let synth;
let player;

const playBtn = document.getElementById("play-btn");
const submitScoreDiv = document.getElementById("submit");
const leadersDiv = document.getElementById("leaders");
const submitButton = document.getElementById("submit-button");
const nopeButton = document.getElementById("nope-button");
const playAgainButton = document.getElementById("play-again-button");

StartAudioContext(Tone.context, "#play-btn").then(() => {
  console.log("audio context started.");
  playBtn.addEventListener("click", () => {
    if (loading) {
      return;
    }

    playBtn.style.display = "none";
    gameState = 1;
    lastTimestamp = millis();
    updateScore(0);

    // music
    synth.triggerAttackRelease("C4", "16n");
    player.start();
  });
  submitButton.addEventListener("click", async () => {
    submitButton.textContent = "sending...";
    const name = document.getElementById("name").value;

    const response = await fetch("https://whack-mole.glitch.me/scores", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ name, score })
    });
    records = await response.json();
    updateLeaders();

    submitButton.textContent = "Send";
    submitScoreDiv.style.display = "none";
    leadersDiv.style.display = "block";
    document.getElementById("name").value = "";
    gameState = 2;
  });
  playAgainButton.addEventListener("click", () => {
    leadersDiv.style.display = "none";
    gameState = 1;
    lastTimestamp = millis();
    updateScore(0);

    // music
    synth.triggerAttackRelease("C4", "16n");
    player.start();
  });
  nopeButton.addEventListener("click", () => {
    submitButton.textContent = "Send";
    submitScoreDiv.style.display = "none";
    leadersDiv.style.display = "block";
    document.getElementById("name").value = "";
    gameState = 2;
  });
});

function setup() {
  getRecords();
  target = { x: 0, y: 0 };

  const canvas = createCanvas(640, 480);
  resetTarget();
  canvas.parent("p5-canvas");
  fill(255, 255, 255);
  rect(-1, -1, width + 2, height + 2);

  // posenet & webcam
  video = createCapture(VIDEO);
  video.size(width, height);
  poseNet = ml5.poseNet(video, () => {
    playBtn.innerHTML = "play";
    loading = false;
  });
  poseNet.on("pose", results => {
    poses = results;
  });

  video.hide();

  // music
  synth = new Tone.Synth().toMaster();
  player = new Tone.Player({
    url: "./assets/FWDL.[mp3|ogg]",
    loop: true
  }).toMaster();
}

function draw() {
  translate(width, 0);
  scale(-1, 1);

  image(video, 0, 0, width, height);
  fill(255, 255, 255, 200);
  rect(-1, -1, width + 2, height + 2);

  if (gameState === 1) {
    drawNose();
    drawTarget();
    drawTiming();
    check();
  } else {
    fill(67, 174, 166, 200);
    rect(-1, -1, width + 2, height + 2);
  }
}

function check() {
  if (dist(target.x, target.y, nose.x, nose.y) < targetRadius * 0.5) {
    animationPosition.x = target.x;
    animationPosition.y = target.y;
    animationCount = 100;
    animationColor =
      ratio < 0.3
        ? color(255, 10, 10)
        : ratio < 0.6
        ? color(255, 154, 0)
        : color(67, 174, 112);

    let addedScore = ratio < 0.3 ? 1 : ratio < 0.6 ? 2 : 3;
    if (addedScore > 2) {
      synth.triggerAttackRelease("C5", "16n");
      synth.triggerAttackRelease("E5", "16n", "+0.1");
    } else if (addedScore > 1) {
      synth.triggerAttackRelease("A4", "32n");
    } else {
      synth.triggerAttackRelease("F4", "32n");
    }
    updateScore(score + addedScore);
    resetTarget();
    resetTiming();
  }
}

function resetTarget() {
  targetRadius = Math.max(minRadius, targetRadius * radiusDecayRate);
  const { x, y } = target;
  while (dist(x, y, target.x, target.y) < width * 0.3) {
    target.x = map(Math.random(), 0, 1, 0.1 * width, 0.95 * width);
    target.y = map(Math.random(), 0, 1, 0.05 * height, 0.95 * height);
  }
}

function drawTarget() {
  push();

  stroke(159, 112, 208);
  strokeWeight(4);
  noFill();
  translate(target.x, target.y);
  const radius = targetRadius * (1 + 0.08 * Math.sin(frameCount * 0.2));
  ellipse(0, 0, radius, radius);

  pop();

  if (animationCount > 0) {
    push();
    const progress = pow((100 - animationCount) * 0.01, 0.1);
    const alpha = 255 * (1 - progress);
    animationColor.setAlpha(alpha);
    fill(animationColor);
    noStroke();
    translate(animationPosition.x, animationPosition.y);
    ellipse(0, 0, 50 * progress, 50 * progress);
    pop();
    animationCount--;
  }
}

function drawTiming() {
  push();
  const shrink = 0.9;
  const barH = height * shrink;
  const alpha = 180;

  translate(timingWidth, height * (1 - shrink) * 0.5);

  noStroke();
  fill(255, 255, 255);
  rect(0, 0, timingWidth, barH);

  const timeElapsed = millis() - lastTimestamp;
  if (timeElapsed > timeLimit) {
    fail();
  }
  ratio = 1 - timeElapsed / timeLimit;
  const h = barH * ratio;

  if (ratio < 0.3) {
    fill(255, 10, 10, alpha);
  } else if (ratio < 0.6) {
    fill(255, 154, 0, alpha);
  } else {
    fill(67, 174, 112, alpha);
  }
  noStroke();
  rect(0, barH, timingWidth, -h);

  push();
  translate(timingWidth * 1.5, barH - h);

  beginShape();
  vertex(0, 0);
  vertex(20, 10);
  vertex(20, -10);
  endShape(CLOSE);
  pop();

  stroke(67, 174, 112);
  // stroke(255, 255, 255);
  strokeWeight(4);
  noFill();
  rect(0, 0, timingWidth, barH);

  pop();
}

function resetTiming() {
  lastTimestamp = millis();
  timeLimit = Math.max(minLimit, timeLimit * timeLimitDecayRate);
}

function fail() {
  timeLimit = 5000;
  targetRadius = 40;

  gameState = 2;
  submitScoreDiv.style.display = "block";

  synth.triggerAttackRelease("C3", "16n");
  player.stop();
}

function updateScore(s) {
  score = s;
  document.getElementById("score").innerHTML = `score: ${s}`;
  document.getElementById("submit-score").innerHTML = s;
}

function drawNose() {
  if (poses.length > 0) {
    nose = poses[0].pose.keypoints[0].position;
    fill(255, 154, 0);
    noStroke();
    ellipse(nose.x, nose.y, 15, 15);
  }
}

function drawKeypoints() {
  for (let i = 0; i < poses.length; i++) {
    let pose = poses[i].pose;
    for (let j = 0; j < pose.keypoints.length; j++) {
      let keypoint = pose.keypoints[j];
      if (keypoint.score > 0.2) {
        fill(255, 0, 0);
        noStroke();
        ellipse(keypoint.position.x, keypoint.position.y, 10, 10);
      }
    }
  }
}

function drawSkeleton() {
  for (let i = 0; i < poses.length; i++) {
    let skeleton = poses[i].skeleton;
    for (let j = 0; j < skeleton.length; j++) {
      let partA = skeleton[j][0];
      let partB = skeleton[j][1];
      stroke(255, 0, 0);
      line(
        partA.position.x,
        partA.position.y,
        partB.position.x,
        partB.position.y
      );
    }
  }
}

// api

async function getRecords() {
  const response = await fetch("https://whack-mole.glitch.me/leaders");
  records = await response.json();
  updateLeaders();
}

function updateLeaders() {
  const ol = document.getElementById("leaders-ol");
  // clear children
  while (ol.firstChild) {
    ol.removeChild(ol.firstChild);
  }

  records.forEach(record => {
    const li = document.createElement("li");
    ol.appendChild(li);
    li.innerHTML = `${record.name} <span class="score">${record.score}</span>`;
  });
}
