# sdk for IoT Home Kit 

## Overview

```javascript
obniz.onconnect = async function () {
  
  var robot = obniz.wired("AIRobotKit");
  
  //robot.move("forward"); or "back"
  //robot.turn("right"); or "left"
  
  await robot.startCamWait();
  while(true) {
    // face detection
    console.log(robot.isFaceInside());
    
    // classify
    console.log(await robot.classify());
    
    // white line detection
    console.log(robot.positionOfWhiteline());
    
    await obniz.wait(1);
  }
}
```

## install

```html
<script src="https://unpkg.com/obniz@latest/obniz.js"></script>
<script src="https://unpkg.com/obniz-parts-kits@latest/airobot/index.js"></script>
```

