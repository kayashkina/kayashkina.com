let draw_i = 0;
let timeSinceLastBeat = 0;
let heartbeatReceived = false;
let isConnected = false;
let heart;
let ecg;
let osc;
let socket;

class Heart {
  constructor(adDuration, vdDuration, vrDuration) {
    this.adDuration = adDuration;
    this.vdDuration = vdDuration;
    this.vrDuration = vrDuration;
    this.beatDuration = adDuration + vdDuration + vrDuration;
    this.bpm = [];
    this.voltage = 0;
  }

  setVoltage(voltage) {
    this.voltage = voltage;
    ecg.addValue({ y: this.voltage });
  }

  atriaDepolarization(time) {
    let y = randomGaussian(5, 1) * sin(time * (360 / this.adDuration));
    y = y > 0 ? -y : 0.2 * (1 - y);
    this.setVoltage(y + noise(time));
  }

  ventricleDepolarization(time) {
    let y;
    if (time <= this.vdDuration / 3) {
      y = randomGaussian(8, 2) * (this.vdDuration - time) / 6;
    } else if (time < 2 * this.vdDuration / 3) {
      osc.amp(0.5, 0.01);
      y = randomGaussian(70, 2) * abs(1.5 - (this.vdDuration - time)) / 3;
      y = -y;
    } else {
      y = randomGaussian(20, 2) * (this.vdDuration - time) / 3;
      osc.amp(0, 0.01);
    }
    this.setVoltage(y);
  }

  ventricleRepolarization(time) {
    let y = randomGaussian(8, 2) * sin(180 + time * (360 / this.vrDuration));
    y = y < 0 ? 0.2 * (1 - y) : -y;
    this.setVoltage(y + noise(time));
  }

  updateBPM() {
    this.bpm.push(3600 / this.nextBeat);
    if (this.bpm.length > 5) this.bpm.splice(0, 1);
    ecg.drawBPM(round(this.bpm.reduce((p, c) => p + c, 0) / this.bpm.length));
  }

  beat(time) {
    if (time <= this.adDuration) {
      this.atriaDepolarization(time);
    } else if (time <= this.adDuration + this.vdDuration) {
      this.ventricleDepolarization(time - this.adDuration);
    } else if (time < this.beatDuration) {
      this.ventricleRepolarization(time - this.adDuration - this.vdDuration);
    } else {
      this.setVoltage(0 + noise(draw_i * 0.5) * 5);
    }
  }
}

class ECG {
  constructor(graphZero, values, maxValuesHistory) {
    this.graphZero = graphZero;
    this.values = values;
    this.maxValuesHistory = maxValuesHistory;
    this.maximumX = maxValuesHistory;
  }

  addValue(value) {
    if (this.values.length >= this.maxValuesHistory) this.values.splice(0, 1);
    if (value.x === undefined) {
      value.x = (this.values[this.values.length - 1].x + 1) % this.maximumX;
    }
    this.values.push(value);
  }

  plotValues() {
    push();
    for (let i = 1; i < this.values.length; i++) {
      if (this.values[i - 1].x > this.values[i].x) continue;
      let alpha = i / this.values.length;
      stroke(121, 239, 150, alpha);
      fill(121, 239, 150, alpha);
      line(
        this.graphZero.x + this.values[i - 1].x,
        this.graphZero.y + this.values[i - 1].y,
        this.graphZero.x + this.values[i].x,
        this.graphZero.y + this.values[i].y
      );
      if (i + 5 > this.values.length) {
        circle(
          this.graphZero.x + this.values[i].x,
          this.graphZero.y + this.values[i].y,
          this.values.length / i
        );
      }
    }
    pop();
  }

  updateInfo() {
    this.updateDate();
  }

  updateDate() {
    let date = new Date();
    date =
      "" +
      date.getFullYear() +
      "-" +
      date.getMonth() +
      "-" +
      date.getDate() +
      " " +
      date.getHours() +
      ":" +
      date.getMinutes() +
      ":" +
      date.getSeconds();
    document.getElementById("date-value").innerHTML = date;
  }
  drawBPM(bpm) {
    document.getElementById("heart-rate-value").innerHTML = bpm;
  }
}

function connectWebSocket() {
  socket = new WebSocket('wss://kayashkina.com/heartbeat/');
  socket.onopen = function(event) {
    isConnected = true;
  };
  socket.onmessage = function(event) {
    if (event.data === 'heartbeat') {
      heartbeatReceived = true;
    }
  };
  socket.onclose = function(event) {
    isConnected = false;
    heartbeatReceived = false;
    setTimeout(connectWebSocket, 5000);
  };
  socket.onerror = function(error) {
    isConnected = false;
    heartbeatReceived = false;
  };
}

function setup() {
  let myCanvas = createCanvas(600, 150);
  myCanvas.parent("ecg");
  heart = new Heart(12, 8, 12);
  ecg = new ECG({ x: 0, y: 110 }, [{ x: 0, y: 0 }], 600);
  connectWebSocket();
  colorMode(RGB, 255, 255, 255, 1);
  angleMode(DEGREES);
  osc = new p5.Oscillator();
  osc.setType("sine");
  osc.freq(445);
  osc.amp(0);
  osc.start();
}

function drawECGScreenBackground() {
  push();
  fill("#201D1D");
  stroke(121, 239, 150, 1);
  rect(0, 0, 599, 149);
  pop();
}

function draw() {
  draw_i++;
  drawECGScreenBackground();

  if (isConnected) {
    if (heartbeatReceived) {
      heartbeatReceived = false;
      timeSinceLastBeat = 0;
      heart.beat(timeSinceLastBeat);
    } else if (timeSinceLastBeat < heart.beatDuration) {
      heart.beat(timeSinceLastBeat);
      timeSinceLastBeat++;
    } else {
      heart.setVoltage(0 + noise(draw_i * 0.5) * 5);
    }
  } else {
    heart.setVoltage(0);
  }

  ecg.plotValues();
  ecg.updateInfo();
}

function touchStarted() {
  getAudioContext().resume();
}
