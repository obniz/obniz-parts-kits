class ObnizAIHelper {
  constructor() {
    this.tracker = new clm.tracker();
    this.tracker.init(pModel);
    this._emotionThreshold = 0.5;
    this._posenetThreshold = 0.6;
    this._posnetPos = [];

    this._emotion_classifier = new emotionClassifier();
    this._emotion_classifier.init(emotionModel);
    this._posenet = null;

    /* tfjs */
    this.tfModel = undefined;
    this.video = undefined;

    this.tfclassify = {
      time: null,
      name: 'unknown',
    };

    this.closestFace = {
      time: null,
      found: false,
      x: 0,
      y: 0,
      distance: 0,
    };

    this.detectedWhiteLine = {
      center_x: 0,
    };

    this.addWeatherList();

    let AudioContext = window.AudioContext || window.webkitAudioContext; //クロスブラウザ対応
    this.audioCtx = new AudioContext();

    this.accel = {
      x: null,
      y: null,
      z: null,
      logs: [],
    };
    this.gyro = {
      alpha: null,
      beta: null,
      gamma: null,
      logs: [],
    };
    this.orientation = {
      absolute: null,
      alpha: null,
      beta: null,
      gamma: null,
    };

    this.emotions = {
      angly: 0,
      sad: 0,
      disgusted: 0,
      fear: 0,
      surprised: 0,
      happy: 0,
    };
  }

  /* Cam Management */

  async startCamWait() {
    try {
      this._prepareDOM();
      await this._loadModel();
      this._posenet = await posenet.load();
      await this._startVideo();
      this.cap = new cv.VideoCapture(this.video);
      this.tracker.start(this.video);
    } catch (e) {
      console.error(e);
      let div = document.createElement('div');
      div.innerHTML = `Cannot start camera on your device.`;
      const viodeDOM = div.firstChild;
      let output = document.getElementById('OBNIZ_OUTPUT');
      output.appendChild(viodeDOM);
    }
  }

  _prepareDOM() {
    let div = document.createElement('div');
    div.innerHTML = `<video id="video_forairobotkit" width="320px" height="240px" autoplay playsinline style="background-color: #888"></video>`;
    const viodeDOM = div.firstChild;
    let output = document.getElementById('OBNIZ_OUTPUT');
    output.appendChild(viodeDOM);
    this.video = document.getElementById('video_forairobotkit');
  }

  async _loadCascadeModel() {
    const path = 'haarcascade_frontalface_default.xml';
    const url =
      'https://unpkg.com/obniz-parts-kits@0.2.0/ai/opencv3.4/haarcascade_frontalface_default.xml';
    const response = await fetch(url);
    const buf = await response.arrayBuffer();
    cv.FS_createDataFile('/', path, new Uint8Array(buf), true, false, false);
  }

  async _loadModel() {
    /* opencv */

    await this._loadCascadeModel();
    this._cv_classifier = new cv.CascadeClassifier();
    const loaded = this._cv_classifier.load(
      'haarcascade_frontalface_default.xml'
    );
    if (!loaded) {
      throw new Error('oepncv cascade not loaded');
    }
    /* tf */
    this._mobileNet = await mobilenet.load();
  }

  _startVideo() {
    const video = this.video;
    if (!navigator.mediaDevices) {
      navigator.mediaDevices =
        navigator.mozGetUserMedia || navigator.webkitGetUserMedia
          ? {
            getUserMedia: function (c) {
              return new Promise(function (y, n) {
                (
                  navigator.mozGetUserMedia || navigator.webkitGetUserMedia
                ).call(navigator, c, y, n);
              });
            },
          }
          : null;
    }
    return new Promise((resolve, reject) => {
      navigator.mediaDevices
        .getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        })
        .then((stream) => {
          video.srcObject = stream;
          video.onloadedmetadata = (e) => {
            video.play();
            resolve();
          };
        });
    });
  }

  /* opencv */

  _detectFace() {
    const video = this.video;
    if (this.closestFace.time !== this.video.currentTime) {
      this.closestFace.time = this.video.currentTime;
      if (!this.cap) {
        return;
      }
      const cap = this.cap;
      let src = new cv.Mat(video.height, video.width, cv.CV_8UC4);
      let gray = new cv.Mat();
      let faces = new cv.RectVector();

      cap.read(src);

      // detect faces.
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
      let msize = new cv.Size(0, 0);
      this._cv_classifier.detectMultiScale(
        gray,
        faces,
        1.1,
        3,
        0,
        msize,
        msize
      );

      this.closestFace.found = false;
      this.closestFace.distance = 101;
      for (let i = 0; i < faces.size(); ++i) {
        let face = faces.get(i);
        const distance = ((video.width - face.width) / video.width) * 100;
        if (distance < this.closestFace.distance) {
          this.closestFace.found = true;
          this.closestFace.x =
            (((face.x + face.width / 2) / video.width) * 2 - 1) * 100;
          this.closestFace.y =
            (((face.y + face.height / 2) / video.height) * 2 - 1) * 100;
          this.closestFace.distance = distance;
        }
      }

      src.delete();
      gray.delete();
      faces.delete();
    }
  }

  isAngry() {
    return this.isEmotionDetected('angly');
  }

  isSad() {
    return this.isEmotionDetected('sad');
  }

  isHappy() {
    return this.isEmotionDetected('happy');
  }

  isDisgusted() {
    return this.isEmotionDetected('disgusted');
  }

  isFear() {
    return this.isEmotionDetected('fear');
  }

  isSurprised() {
    return this.isEmotionDetected('surprised');
  }

  getEmotionValue(emotionType) {
    this._detectEmotion();
    return this.emotions[emotionType];
  }

  isEmotionDetected(emotionType) {
    return this.getEmotionValue(emotionType) > this._emotionThreshold;
  }

  _detectEmotion() {
    this._detectFace();

    // let positions = this.tracker.getCurrentPosition();
    let parameters = this.tracker.getCurrentParameters();
    let emotion = this._emotion_classifier.meanPredict(parameters);

    let emotions = {};
    for (let i = 0; i < emotion.length; i++) {
      emotions[emotion[i].emotion] = emotion[i].value;
    }

    this.emotions = emotions;
  }

  isFaceInside() {
    this._detectFace();
    this._detectEmotion();
    return this.closestFace.found;
  }

  positionOfFace() {
    //this._detectFace();
    if (this.closestFace.found) {
      return this.closestFace.x;
    } else {
      return 0;
    }
  }

  distanceOfFace() {
    //this._detectFace();
    if (this.closestFace.found) {
      return this.closestFace.distance;
    } else {
      return 101;
    }
  }

  async _detectPoseWait() {
    const video = this.video;
    if (!this._posenet) {
      return;
    }

    const imageScaleFactor = 0.2;
    const outputStride = 16;
    const flipHorizontal = true;
    if (this._posenetDetectTime !== this.video.currentTime) {
      this._posenetDetectTime = this.video.currentTime;

      const pose = await this._posenet.estimateSinglePose(
        video,
        imageScaleFactor,
        flipHorizontal,
        outputStride
      );
      this._posnetPos = pose;
      return pose;
    }
  }

  /**
   *
   * @param name
   * [
   // "nose",
   // "leftEye",
   // "rightEye",
   // "leftEar",
   // "rightEar",
   // "leftShoulder",
   // "rightShoulder",
   // "leftElbow",
   // "rightElbow",
   // "leftWrist",
   // "rightWrist",
   // "leftHip",
   // "rightHip",
   // "leftKnee",
   // "rightKnee",
   // "leftAnkle",
   // "rightAnkle"
   // ]
   * @return {Promise<void>}
   */
  async getPosetnetPosition(name) {
    await this._detectPoseWait();
    if (!this._posnetPos || !this._posnetPos.keypoints) {
      return null;
    }
    for (const pose of this._posnetPos.keypoints) {
      if (pose.part === name && pose.score >= this._posenetThreshold) {
        return pose.position;
      }
    }
    return null;
  }

  async isNormalPose() {
    return (
      !(await this.isRightHandsUpPose()) && !(await this.isLeftHandsUpPose())
    );
  }

  async isBothHandsUpPose() {
    return (
      (await this.isRightHandsUpPose()) && (await this.isLeftHandsUpPose())
    );
  }

  async isOneHandsUpPose() {
    const left = await this.isLeftHandsUpPose();
    const right = await this.isRightHandsUpPose();
    if ((left && !right) || (!left && right)) return true;
    return false;
  }

  async isRightHandsUpPose() {
    let nosePos = await this.getPosetnetPosition('nose');
    let rightWristPos = await this.getPosetnetPosition('rightWrist');
    if (nosePos && rightWristPos) {
      if (nosePos.y > rightWristPos.y) {
        return true;
      }
    }
    return false;
  }

  async isLeftHandsUpPose() {
    let nosePos = await this.getPosetnetPosition('nose');
    let leftWristPos = await this.getPosetnetPosition('leftWrist');
    if (nosePos && leftWristPos) {
      if (nosePos.y > leftWristPos.y) {
        return true;
      }
    }
    return false;
  }

  positionOfWhiteline() {
    // reutn -100 to 100. notfound=0

    const video = this.video;
    if (this.closestFace.time !== this.video.currentTime) {
      this.closestFace.time = this.video.currentTime;

      const cap = this.cap;
      let src = new cv.Mat(video.height, video.width, cv.CV_8UC4);
      let gray = new cv.Mat();

      cap.read(src);
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

      let window = parseInt(video.width * 0.05);

      // let boundary = [1, 1, 1];
      let max_bright = 0;
      let max_bright_x = 0;
      const roi_h = parseInt(video.height * 0.7);
      console.log('start');
      for (let col = 0; col < video.width - window; col++) {
        // let lastBoundary = 255;
        let pixel = 0;
        for (let w = 0; w < window; w++) {
          pixel += gray.ucharPtr(roi_h, col + w)[0];
        }
        pixel /= window;
        if (max_bright < pixel) {
          max_bright = pixel;
          max_bright_x = col;
        }
      }

      let center_x = max_bright_x + parseInt(window / 2);
      center_x = ((center_x / video.width) * 2 - 1) * 100;

      this.detectedWhiteLine.center_x = parseInt(center_x);

      gray.delete();
      src.delete();
    }

    return this.detectedWhiteLine.center_x;
  }

  /* tensorflow */

  async classify() {
    if (this.tfclassify.time !== this.video.currentTime) {
      // http://starpentagon.net/analytics/imagenet_ilsvrc2012_dataset/
      const predictions = await this._mobileNet.classify(this.video);
      for (let i = 0; i < predictions.length; i++) {
        const name = predictions[i].className;
        // const probability = predictions[i].probability;
        this.tfclassify.time = this.video.currentTime;
        this.tfclassify.name = name;
        break;
      }
    }
    return this.tfclassify.name;
  }

  /* speech */

  async say(mes, rate, pitch) {
    let ready = new Promise((resolve, reject) => {
      $(() => {
        resolve();
      });
    });
    await ready; // for "Remove SpeechSynthesis.speak without user activation".  https://www.chromestatus.com/feature/5687444770914304

    let p = new Promise((resolve, reject) => {
      const synth = window.speechSynthesis;
      let message = new SpeechSynthesisUtterance(mes);
      if (typeof rate === 'number') {
        message.rate = rate;
      }
      if (typeof pitch === 'number') {
        message.pitch = pitch;
      }
      message.onerror = (err) => {
        reject(err);
      };
      synth.speak(message);
      resolve();
    });
    let result = await p;
    return result;
  }

  /* API related */

  async getWeather(region) {
    const key = '4aa1a96a50432353baf849e808c112e5';
    const url = `https://api.openweathermap.org/data/2.5/forecast?q=${region}&APPID=${key}`;
    let response = await fetch(url);
    let json = await response.json();

    if (
      !json ||
      !json.list ||
      !json.list[0] ||
      !json.list[0].weather ||
      !json.list[0].weather[0]
    ) {
      return 'unknown';
    }
    return json.list[0].weather[0].main.toLowerCase();
  }

  addWeatherList() {
    this.sunny = ['clear (night)', 'clear', 'sunny'];

    this.cloudy = [
      'cloudy',
      'mostly cloudy (night)',
      'mostly cloudy (day)',
      'partly cloudy (night)',
      'partly cloudy (day)',
      'mostly cloudy',
      'partly cloudy',
      'clouds',
    ];

    this.rain = [
      'mixed rain and snow',
      'mixed rain and sleet',
      'freezing drizzle',
      'drizzle',
      'freezing rain',
      'showers',
      'mixed rain and hail',
      'scattered showers',
      'atmosphere',
      'rain',
      'thunderstorm',
    ];

    this.snow = [
      'mixed snow and sleet',
      'snow flurries',
      'light snow showers',
      'blowing snow',
      'snow',
      'heavy snow',
      'scattered snow showers',
      'snow showers',
    ];
  }

  playAudio(hz, ms) {
    return new Promise((resolve) => {
      //正弦波の音を作成
      let osciillator = this.audioCtx.createOscillator();

      //ヘルツ（周波数）指定
      osciillator.frequency.value = hz;

      //音の出力先
      let audioDestination = this.audioCtx.destination;

      //出力先のスピーカーに接続
      osciillator.connect(audioDestination);

      //音を出す
      osciillator.start = osciillator.start || osciillator.noteOn; //クロスブラウザ対応
      osciillator.start();

      //音を0.5秒後にストップ
      setTimeout(function () {
        osciillator.stop();
        resolve();
      }, ms);
    });
  }

  playMusic(url) {
    return new Promise((resolve) => {
      new Howl({
        src: [url],
        autoplay: true,
        loop: false,
        onend: resolve,
      });
    });
  }

  /* Accel */

  async startMotionWait() {
    try {
      await this._confirmPrompt(
        'This app request permission of device motions'
      );
      if (
        DeviceMotionEvent &&
        typeof DeviceMotionEvent.requestPermission === 'function'
      ) {
        let permissionState = await DeviceMotionEvent.requestPermission();
        if (permissionState === 'granted') {
          // 許可を得られた場合、devicemotionをイベントリスナーに追加
          window.addEventListener(
            'devicemotion',
            this.onDeviceMotion.bind(this)
          );
        } else {
          // 許可を得られなかった場合の処理
          throw new Error('Cannot get devicemotion permission');
        }

        permissionState = await DeviceOrientationEvent.requestPermission();
        if (permissionState === 'granted') {
          // 許可を得られた場合、deviceorientationをイベントリスナーに追加
          window.addEventListener(
            'deviceorientation',
            this.onDeviceOrientation.bind(this)
          );
        } else {
          throw new Error('Cannot get deviceorientation permission');
        }
      } else {
        window.addEventListener('devicemotion', this.onDeviceMotion.bind(this));
        window.addEventListener(
          'deviceorientation',
          this.onDeviceOrientation.bind(this)
        );
      }
    } catch (e) {
      console.error(e);
    }
  }

  _confirmPrompt(title, text) {
    if (title && !text) {
      text = title;
      title = undefined;
    }

    return new Promise((resolve, reject) => {
      let html = '';
      html += '<div class="modal fade" aria-hidden="true">';
      html +=
        '  <div class="modal-dialog modal-dialog-centered" role="document">\n';
      html += '    <div class="modal-content">\n';
      if (title) {
        html += '      <div class="modal-header">\n';
        html += '        <h5 class="modal-title" id="exampleModalLongTitle">';
        html += title;
        html += '        </h5>\n';
        html += '      </div>\n';
      }
      html += '      <div class="modal-body">\n';
      html += text;
      html += '      </div>\n';
      html += '      <div class="modal-footer">\n';
      html +=
        '        <button type="button" class="btn btn-primary">OK</button>\n';
      html += '      </div>\n';
      html += '    </div>\n';
      html += '  </div>\n';
      html += '</div>';

      let div = document.createElement('div');
      div.innerHTML = html;
      div.querySelector('button').addEventListener('click', () => {
        $(div.firstChild).modal('hide');
        resolve();
      });
      document.body.appendChild(div);

      $(div.firstChild).modal('show');
    });
  }

  onDeviceMotion(e) {
    // console.log("onDeviceMotion")

    let now = new Date();

    let accel = e.acceleration;
    accel.time = now;

    let gyro = e.rotationRate;
    gyro.time = now;

    this.accel.x = accel.x;
    this.accel.y = accel.y;
    this.accel.z = accel.z;
    this.accel.logs.push(accel);

    this.gyro.alpha = gyro.alpha;
    this.gyro.beta = gyro.beta;
    this.gyro.gamma = gyro.gamma;
    this.gyro.logs.push(gyro);

    this.deviceMotionLogFilter();
  }

  onDeviceOrientation(e) {
    this.orientation = {
      absolute: e.absolute,
      alpha: e.alpha,
      beta: e.beta,
      gamma: e.gamma,
    };
  }

  deviceMotionLogFilter() {
    let now = new Date();
    let time = 1000;

    this.accel.logs = this.accel.logs.filter((elm) => {
      return elm.time.getTime() + time > now.getTime();
    });

    this.gyro.logs = this.gyro.logs.filter((elm) => {
      return elm.time.getTime() + time > now.getTime();
    });
  }

  getAccelX() {
    return this.accel.x;
  }

  getAccelY() {
    return this.accel.y;
  }

  getAccelZ() {
    return this.accel.z;
  }

  getGyroAlpha() {
    return this.gyro.alpha;
  }

  getGyroBeta() {
    return this.gyro.beta;
  }

  getGyroGannma() {
    return this.gyro.gamma;
  }

  isShaked() {
    let maxX = this.accel.logs.reduce((a, b) => (a.x > b.x ? a : b), {}).x;
    let maxY = this.accel.logs.reduce((a, b) => (a.y > b.y ? a : b), {}).y;
    let maxZ = this.accel.logs.reduce((a, b) => (a.z > b.z ? a : b), {}).z;
    let minX = this.accel.logs.reduce((a, b) => (a.x < b.x ? a : b), {}).x;
    let minY = this.accel.logs.reduce((a, b) => (a.y < b.y ? a : b), {}).y;
    let minZ = this.accel.logs.reduce((a, b) => (a.z < b.z ? a : b), {}).z;

    // console.log({maxX, minX})

    if (maxX - minX > 6 || maxY - minY > 6 || maxZ - minZ > 6) {
      return true;
    }

    return false;
  }

  isDeviceFaceDirection(dir) {
    if (dir === 'sky') {
      return (
        Math.abs(this.orientation.beta) < 10 &&
        Math.abs(this.orientation.gamma) < 10
      );
    } else if (dir === 'earth') {
      return (
        Math.abs(this.orientation.beta) > 170 &&
        Math.abs(this.orientation.gamma) < 10
      );
    }
    return false;
  }
}

class TMModel {

  /**
   * @type {string}
   */
  url ;

  /**
   * @type {null|tmImage.ClassificationModel}
   */
  model = null;

  /**
   * @type {number | null}
   */
  maxPredictions= null;

  /**
   *
   * @type {number}
   */
  lastPredictTime = 0;

  /**
   *
   * @type {null|Object}
   */
  lastPredictResult = null;


  /**
   * @param {string} url
   */
  constructor(url) {
    this.url = url;
    this._init();
  }

  async _init() {
    const modelURL = this.url + "model.json";
    const metadataURL = this.url + "metadata.json";

    // load the model and metadata
    // Refer to tmImage.loadFromFiles() in the API to support files from a file picker
    // or files from your local hard drive
    // Note: the pose library adds "tmImage" object to your window (window.tmImage)
    this.model = await tmImage.load(modelURL, metadataURL);
    this.maxPredictions = this.model.getTotalClasses();
  }


  async waitForInit() {
    for (let i= 0; i < 100; i++) {
      if(this.model !== null){return;}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    //10秒立ってもだめならNG
    throw new Error("Teachable Machine Model load failed");
  }

  async predict(image) {
    await this.waitForInit();
    if(new Date().getTime() < this.lastPredictTime + 100){
      return this.lastPredictResult;
    }
    const prediction = await this.model.predict(image);
    this.lastPredictTime = new Date().getTime();
    this.lastPredictResult = prediction;
    return prediction;
  }

  async predictClassName(image) {
    const predict = await this.predict(image);
    const result = predict.reduce((a, b) => a.probability > b.probability ? a : b);
    return result.className;
  }

  async predictProbability(image, className) {
    const predict = await this.predict(image);
    if(predict.map(a => a.className).indexOf(className) === -1){
      throw new Error(`Cannot find class name. ${className} is not in ${predict.map(a => a.className).join(", ")}`);
    }
    const result = predict.find((a) => a.className === className);
    if(!result){
      return null;
    }

    return result.probability;
  }

}

if (typeof module === 'object') {
  module.exports = ObnizAIHelper;
} else {
  _ai = new ObnizAIHelper();
}
