# BABYLON-STEERING

![](https://img.shields.io/badge/type-JS_Library-brightgreen.svg "Project type")
![](https://img.shields.io/github/repo-size/LorenzoCorbella74/tagsforobj "Repository size")
![](https://img.shields.io/github/package-json/v/LorenzoCorbella74/babylon-steering)

## What is
A basic steering behaviors library for [Babylon.js](https://www.babylonjs.com/) moving entities in the x/z plane.
[Steering Behaviors](https://gamedevelopment.tutsplus.com/series/understanding-steering-behaviors--gamedev-12732) are a set of common AI movement algorithms developed by [Craig Reynolds](https://en.wikipedia.org/wiki/Craig_Reynolds_(computer_graphics)) in a [paper](http://www.red3d.com/cwr/papers/1999/gdc99steer.html) published in 1999.

BABYLON-STEERING supports the following behavious:
* Seek, Seek with Arrive and Attract (Seek with intensity)
* Flee
* Arrive
* Pursue
* Evade
* Interpose
* Wander
* Collision Avoidance
* Follow Path
* Follow Leader
* Queue
* Cohesion, separation and alignment (Flocking)
* Hide
* Apply general force


Steering Entities can:
* look at a specific target with the .lookAt() method
* look where they are going with the .lookWhereGoing() method


## How to setup

Include ```babylon-steering``` library:
```javascript

import babylon-steering from 'babylon-steering;

```

Create a basic Babylon.js 3D scene with a `redSphere` mesh and simply instantiate a Steering Entity:

```javascript

const redSphere = new SteeringVehicle(redSphere, engine);

```

Add the behavior/s to the steering entity and the update method inside main render/animation loop:

```javascript

scene.executeWhenReady(function () {
        engine.runRenderLoop(function () {

            redSphere
                .seekWithArrive(greenBox, 50)
                .hasInConeOfView([blueSphere, yellowSphere])
                .avoid(obstacleIstances)
                .applyForce(new BABYLON.Vector3(1, 0, 0.75))
                .lookWhereGoing(true);

            redSphere.animate();

            scene.render();
        });
});

```

It is possible to combine more than one simultaneous steering force by passing the following parameters to the .animate function according to the four methods described in the following [bog post](https://alastaira.wordpress.com/2013/03/13/methods-for-combining-autonomous-steering-behaviours/):

```javascript

blueSphere.animate('blend');  // 'blend' 'priority' 'probability'  'truncated' 

```

## Examples

To test some example just:
```bash
# 1)istall dependencies
npm install
# 2)run development server serving static demo pages at localhost:3000
npm start

```

## Bugs
- Uhm...let me know!

## Built With

ES6 Javascript, [microbundle](https://github.com/developit/microbundle),

## Versioning

Versione 0.0.5

## License

This project is licensed under the ISC License.