# sdk for AI Robot Kit 

## Overview

```javascript
obniz.onconnect = async function () {

  var robot = obniz.wired("AIRobotKit");
  
  robot.move("forward");// or "back"
  await obniz.wait(2000);
  robot.turn("right");// or "left"
  await obniz.wait(2000);
  robot.move(60, 60);
  await obniz.wait(2000);
  robot.move(-60, -60);
}
```

## install

```html
<script src="https://unpkg.com/obniz@latest/obniz.js"></script>
<script src="https://unpkg.com/obniz-parts-kits@latest/airobot/index.js"></script>
```

