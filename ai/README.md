# API Helper

## Overview

It inject global variable `_ai`

```javascript

// Say and weather
const weather = await _ai.getWeather('Tokyo');
_ai.say(weather);

// Vision
await _ai.startCamWait();
while(true) {
  // face detection
  console.log(_ai.isFaceInside());
  
  // classify
  console.log(await _ai.classify());
  
  // white line detection
  console.log(_ai.positionOfWhiteline());
  
  await obniz.wait(1);
}
```

## install

```html
<script src="https://unpkg.com/obniz-parts-kits@0.1.4/airobot/opencv3.4/opencv.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@0.13.5"> </script>
<script src="https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@0.2.2"> </script>

<script src="https://unpkg.com/obniz-parts-kits@latest/ai/index.js"></script>
```

