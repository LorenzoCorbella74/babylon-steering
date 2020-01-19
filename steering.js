class SteeringVehicle {

    constructor(mesh, engine, options={}) {

        this.engine = engine;
        this.mesh = mesh;
        this.mesh.checkCollisions = true;
        this.steeringForce = new BABYLON.Vector3(0, 0, 0);
        this.velocity = new BABYLON.Vector3(0, 0, 0);

        this.maxSpeed = options.maxSpeed || 0.1;
        this.mass = options.mass || 1;

        this.velocitySamples = [];
        this.numSamplesForSmoothing = 20;

        // ARRIVAL
        this.arrivalThreshold = 150;

        // AVOID
        this.avoidDistance = 100;
        this.radius = 50;

        // FOLLOWPATH
        this.waypoints = [];
        this.pathIndex = 0;

        // WANDER
        this.wanderDistance = .05;
        this.wanderAngle = 0
        this.wanderRadius = .05;
        this.wanderRange = 100;

        // QUEUE
        this.inSightDistance = 200
        this.tooCloseDistance = 60
    }

    get dt () {
        return this.engine.getDeltaTime();
    }

    set dt (what) {
        this.dt = what;
    }

    vecToLocal (vector, actor) {
        var m = actor.mesh.getWorldMatrix();
        var v = BABYLON.Vector3.TransformCoordinates(vector, m);
        return v;
    }

    idle (target) {
        this.velocity.scaleInPlace(0);
        this.steeringForce.setAll(0, 0, 0);
        // this.lookAt(target)
    }

    // not used anymore
    lookAt (target) {
        if (!target.mesh) return;
        let targetPos = target.mesh.position.clone();
        let actorPos = this.mesh.position.clone();
        let direction = targetPos.subtract(actorPos).negateInPlace();
        let angle = -Math.atan2(direction.z, direction.x) - Math.PI / 2;
        // console.log(angle * 180 / Math.PI);
        this.mesh.rotation.y = angle;
    }

    lookTarget (target) {
        this.mesh.lookAt(target.mesh.position); // funzione nativa
        // this.lookAt(target)
    }

    lookWhereGoing (smoothing) {
        var direction = this.mesh.position.clone().add(this.velocity); // si punta alla somma della velocità e della posizione
        direction.y = this.mesh.position.y;
        if (smoothing) {
            if (this.velocitySamples.length == this.numSamplesForSmoothing) {
                this.velocitySamples.shift();
            }
            let c = this.velocity.clone();
            c.y = this.mesh.position.y
            this.velocitySamples.push(c);
            direction.setAll(0, 0, 0);
            for (var v = 0; v < this.velocitySamples.length; v++) {
                direction.addInPlace(this.velocitySamples[v])
            }
            direction.scaleInPlace(1 / this.velocitySamples.length)
            direction = this.mesh.position.clone().add(direction)
            direction.y = this.mesh.position.y;
        }
        this.mesh.lookAt(direction);
    }

    // se è sullo stesso lato ma non che è visibile...
    // TEST: vedere se new BABYLON.Vector3(0, 0, 1) funziona meglio
    inSight (target) {
        if (BABYLON.Vector3.Distance(this.mesh.position, target.mesh.position) > this.inSightDistance) {
            return false;
        }
        var heading = new BABYLON.Vector3(0, 0, 1); // target.velocity.clone().normalize();
        var difference = target.mesh.position.clone().subtract(this.mesh.position.clone());
        var dot = BABYLON.Vector3.Dot(difference, heading);
        console.log(`Dot:${dot}`)
        return dot < 0 ? false : true;
    }

    // https://forum.babylonjs.com/t/rotation-angle-of-camera-to-object/2603/21
    isInConeOfViewOf (target) {

        let targetPos = target.mesh.position.clone();
        let actorPos = this.mesh.position.clone();
        let distance = BABYLON.Vector3.Distance(targetPos, actorPos);

        /* var v0 = new BABYLON.Vector3(0, 0, 1);
        v0 = this.vecToLocal(v0, target);
        v0.normalize(); */

        let v0 = target.velocity.clone().normalize(); // new BABYLON.Vector3(0, 0, 1);
        // var ray = new BABYLON.Ray(target.mesh.position, v0, 100);
        // let rayHelper = new BABYLON.RayHelper(ray);
        // rayHelper.show(this.mesh.getScene());

        let v1 = this.mesh.position.clone().subtract(target.mesh.position.clone());
        // var ray2 = new BABYLON.Ray(target.mesh.position, v1, 100);
        // let rayHelper2 = new BABYLON.RayHelper(ray2);
        // rayHelper2.show(this.mesh.getScene());
        v1.normalize();

        let dot = BABYLON.Vector3.Dot(v0, v1)
        let angle = Math.acos(dot);
        let angleInDegree = BABYLON.Tools.ToDegrees(angle);
        // console.log(`Distance: ${distance}`, `Degree: ${angleInDegree}, Dot:${dot}`);
        if (distance < 170 && (angleInDegree < 60)) {
            this.mesh.material.emissiveColor = new BABYLON.Color3(1, 0.5, 0);
            return true;
        }
        this.mesh.material.emissiveColor = new BABYLON.Color3(0, 0, 1);
        return false;
    }

    randomRotate () {
        // TODO:
        // this.mesh.rotation.y = angle;
    }

    // si aggiorna in base a sistema di riferimento GLOBALE
    update () {
        let max = this.maxSpeed * this.dt;
        // if (!isNaN(max) && this.steeringForce.length() > 0) {
            this.steeringForce = this.steeringForce.minimizeInPlaceFromFloats(max, max, max); // TODO: convert Three.js clampLength method to BABYLON
            // this.steeringForce.multiplyByFloats(1 / this.mass,1 / this.mass,1 / this.mass); // TODO: convert  Three.js divedeScalar method to BABYLON
            /* this.steeringForce =  */this.steeringForce/* .clone().normalize() */.scaleInPlace(1 / this.mass); // FIXME: mass > 1  not working
            this.velocity.addInPlace(this.steeringForce);
            this.velocity.y = 0;
            this.steeringForce.setAll(0, 0, 0);
            this.mesh.moveWithCollisions(this.velocity);
        // }
    }

    // forza generica...
    applyForce (force) {
        this.steeringForce = this.steeringForce.add(force);
    }

    // seek with a specific strength
    attract (target, threshold = 0, strenght = 1) {
        let distance = BABYLON.Vector3.Distance(this.mesh.position, target.mesh.position);
        if (distance < threshold && distance > 20) {
            var desiredVelocity = (this.mesh.position.clone().subtract(target.mesh.position.clone())).normalize().scaleInPlace(this.maxSpeed * this.dt * strenght);
            target.steeringForce = target.steeringForce.add(desiredVelocity.subtractInPlace(target.velocity));
        } else {
            // senza di questo oscilla...
            target.flee(this);
        }
    }

    followActor (target, threshold = 50) {
        let targetPos = target.mesh.position.clone();
        let actorPos = this.mesh.position.clone();
        let distance = BABYLON.Vector3.Distance(targetPos, actorPos);
        let direction = targetPos.subtract(actorPos);
        let directionNormalized = BABYLON.Vector3.Normalize(direction);
        if (distance > threshold) {
            //this.mesh.translate(directionNormalized, this.maxSpeed, BABYLON.Space.WORLD);
            //this.mesh.moveWithCollisions(directionNormalized.scaleInPlace(this.maxSpeed));
            this.steeringForce = this.steeringForce.add(directionNormalized.scaleInPlace(this.maxSpeed * this.dt).subtractInPlace(this.velocity));
        } else {
            this.idle();
        }
    }

    fleeActor (target, threshold = 50) {
        let targetPos = target.mesh.position.clone();
        let actorPos = this.mesh.position.clone();
        let distance = BABYLON.Vector3.Distance(targetPos, actorPos);
        let direction = targetPos.subtract(actorPos);
        let directionNormalized = BABYLON.Vector3.Normalize(direction).negateInPlace();
        if (distance < threshold) {
            //this.mesh.translate(directionNormalized, this.maxSpeed, BABYLON.Space.WORLD);
            //this.mesh.moveWithCollisions(directionNormalized.scaleInPlace(this.maxSpeed));
            this.steeringForce = this.steeringForce.add(directionNormalized.scaleInPlace(this.maxSpeed * this.dt).subtractInPlace(this.velocity));
        } else {
            this.idle();
        }
    }

    seek (target, threshold = 0) {
        let distance = BABYLON.Vector3.Distance(this.mesh.position, target.mesh.position);
        if (distance > threshold) {
            var desiredVelocity = (target.mesh.position.clone().subtract(this.mesh.position.clone())).normalize().scaleInPlace(this.maxSpeed * this.dt);
            this.steeringForce = this.steeringForce.add(desiredVelocity.subtractInPlace(this.velocity));
        } else {
            this.idle(target);
        }
    }

    flee (target, threshold = 0) {
        let distance = BABYLON.Vector3.Distance(this.mesh.position, target.mesh.position);
        if (distance < threshold) {
            var desiredVelocity = (this.mesh.position.clone().subtract(target.mesh.position.clone())).normalize().scaleInPlace(this.maxSpeed * this.dt);
            this.steeringForce = this.steeringForce.add(desiredVelocity.subtractInPlace(this.velocity));
        } else {
            this.idle(target);
        }
    }

    arrive (target) {
        var desiredVelocity = target.mesh.position.clone().subtract(this.mesh.position.clone());
        desiredVelocity.normalize()
        var distance = BABYLON.Vector3.Distance(target.mesh.position, this.mesh.position)
        if (distance > this.arrivalThreshold) {
            desiredVelocity.scaleInPlace(this.maxSpeed * this.dt);
        } else {
            desiredVelocity.scaleInPlace(this.maxSpeed * this.dt * distance / this.arrivalThreshold)
        }
        desiredVelocity.subtractInPlace(this.velocity);
        this.steeringForce = this.steeringForce.add(desiredVelocity);
    }

    pursue (target, threshold = 0) {
        var lookAheadTime = BABYLON.Vector3.Distance(this.mesh.position, target.mesh.position) / (this.maxSpeed * this.dt);
        var predictedTarget = target.mesh.position.clone().add(target.velocity.clone().scaleInPlace(lookAheadTime));
        this.seek({
            mesh: {
                position: predictedTarget
            }
        }, threshold);
    }

    evade (target, threshold = 0) {
        var lookAheadTime = BABYLON.Vector3.Distance(this.mesh.position, target.mesh.position) / (this.maxSpeed * this.dt);
        var predictedTarget = target.mesh.position.clone().subtract(target.velocity.clone().scaleInPlace(lookAheadTime));
        this.flee({
            mesh: {
                position: predictedTarget
            }
        }, threshold);
    }

    // tramite un ray casting si vede se il target è visibile (non ci stanno ostacoli che lo nascondono)
    // FIXME: non funziona + !!!!
    canSee (target) {
        var forward = target.mesh.position.clone() // this.vecToLocal(new BABYLON.Vector3(0, 0, 1), target);
        var direction = forward.subtract(this.mesh.position);
        direction = BABYLON.Vector3.Normalize(direction);
        var length = 250;
        var ray = new BABYLON.Ray(this.mesh.position, direction, length);
        let rayHelper = new BABYLON.RayHelper(ray);
        rayHelper.show(this.mesh.getScene());
        var hit = target.mesh.getScene().pickWithRay(ray);
        return hit.pickedMesh && hit.pickedMesh.uniqueId === target.mesh.uniqueId ? true : false;
    }

    hide (target, obstacles, threshold = 300) {
        // si sceglie l'ostacolo più vicino all'elemento da nascondere
        let closestObstacle = new BABYLON.Vector3(0, 0, 0);
        let closestDistance = 10000;
        for (let i = 0; i < obstacles.length; i++) {
            const obstacle = obstacles[i];
            let distance = BABYLON.Vector3.Distance(this.mesh.position.clone(), obstacle.mesh.position);
            if (distance < closestDistance) {
                closestObstacle = obstacle.mesh.position.clone();
                closestDistance = distance;
            }
        }
        // si calcola il punto dove si andrà a nasconderci
        let distanceWithTarget = BABYLON.Vector3.Distance(this.mesh.position, target.mesh.position);
        var pointToReach = BABYLON.Vector3.Lerp(target.mesh.position.clone(), closestObstacle.clone(), 2);
        pointToReach.y = this.mesh.position.y;
        // ci si nasconde solo se il target non è troppo lontano
        if (distanceWithTarget < threshold) {
            this.seek({
                mesh: {
                    position: pointToReach
                }
            }, 10);
        } else {
            // this.idle();
            this.flee(target)
        }
    }

    // FIXME: NOT WORKING PROPERLY ???
    wander () {
        var center = this.velocity.clone().normalize().scaleInPlace(this.wanderDistance);
        var offset = new BABYLON.Vector3(0, 0, 0);
        offset.x = (center.x + Math.sin(this.wanderAngle)) * this.wanderRadius;
        offset.z = (center.z + Math.cos(this.wanderAngle)) * this.wanderRadius;
        offset.y = 0;
        this.wanderAngle = Math.random() * this.wanderRange - this.wanderRange * .5;

        this.steeringForce = this.steeringForce.add(offset); // TEST: offset.normalize().scaleInPlace(this.maxSpeed * this.dt)
    }

    // FIXME: NOT WORKING PROPERLY
    separation (entities, separationRadius = 50, maxSeparation = 40) {
        var force = new BABYLON.Vector3(0, 0, 0);
        var neighborCount = 0
        for (var i = 0; i < entities.length; i++) {
            if (entities[i] != this && BABYLON.Vector3.Distance(this.mesh.position, entities[i].mesh.position) <= separationRadius) {
                force.addInPlace(entities[i].mesh.position.clone().subtractInPlace(this.mesh.position));
                neighborCount++;
            }
        }
        if (neighborCount != 0) {
            force.scaleInPlace(1 / neighborCount)
            force.negateInPlace();
        }
        force.normalize().scaleInPlace(maxSeparation);
        this.steeringForce = this.steeringForce.add(force);
    }

    interpose (targetA, targetB) {
        var midPoint = targetA.mesh.position.clone().addInPlace(targetB.mesh.position.clone()).scaleInPlace(.5);
        var timeToMidPoint = BABYLON.Vector3.Distance(this.mesh.position, midPoint) / (this.maxSpeed * this.dt);
        var pointA = targetA.mesh.position.clone().addInPlace(targetA.velocity.clone().scaleInPlace(timeToMidPoint))
        var pointB = targetB.mesh.position.clone().addInPlace(targetB.velocity.clone().scaleInPlace(timeToMidPoint))
        midPoint = pointA.addInPlace(pointB).scaleInPlace(.5);
        this.seek({
            mesh: {
                position: midPoint
            }
        }, 10);
    }

    avoid (obstacles) {
        var dynamic_length = this.velocity.length() / (this.maxSpeed * this.dt);
        var ahead = this.mesh.position.clone().addInPlace(this.velocity.clone().normalize().scaleInPlace(dynamic_length))
        var ahead2 = this.mesh.position.clone().addInPlace(this.velocity.clone().normalize().scaleInPlace(this.avoidDistance * .5));
        var mostThreatening = null;
        for (var i = 0; i < obstacles.length; i++) {
            if (obstacles[i] === this)
                continue;
            var collision = BABYLON.Vector3.Distance(obstacles[i].mesh.position, ahead) <= this.radius || BABYLON.Vector3.Distance(obstacles[i].mesh.position, ahead2) <= this.radius;
            if (collision && (mostThreatening == null || BABYLON.Vector3.Distance(this.mesh.position, obstacles[i].mesh.position) < BABYLON.Vector3.Distance(this.mesh.position, mostThreatening.mesh.position))) {
                mostThreatening = obstacles[i];
            }
        }
        var avoidance = new BABYLON.Vector3(0, 0, 0);
        if (mostThreatening != null) {
            avoidance = ahead.clone().subtractInPlace(mostThreatening.mesh.position.clone()).normalize().scaleInPlace(this.maxSpeed * this.dt * .75); // MAX AVOID FORCE (<= maxSpeed)
        } else {
            avoidance.scaleInPlace(0); // nullify the avoidance force
        }
        this.steeringForce = this.steeringForce.add(avoidance);
    }

    followPath (path, loop, thresholdRadius = 10) {
        var wayPoint = path[this.pathIndex]
        if (wayPoint == null)
            return;
        if (BABYLON.Vector3.Distance(this.mesh.position, wayPoint) < thresholdRadius) {
            if (this.pathIndex >= path.length - 1) {
                if (loop)
                    this.pathIndex = 0;
            } else {
                this.pathIndex++
            }
        }
        if (this.pathIndex >= path.length - 1 && !loop) {
            this.arrive({
                mesh: {
                    position: wayPoint
                }
            });
        } else {
            this.seek({
                mesh: {
                    position: wayPoint
                }
            });
        }
    }

    isOnLeaderSight (leader, ahead, leaderSightRadius) {
        return (BABYLON.Vector3.Distance(ahead, this.mesh.position) <= leaderSightRadius ||
            BABYLON.Vector3.Distance(leader.mesh.position, this.mesh.position) <= leaderSightRadius);
    }

    followLeader (leader, entities, distance = 20, separationRadius = 40, maxSeparation = 10, leaderSightRadius = 50, arrivalThreshold = 100) {
        var tv = leader.velocity.clone();
        tv.normalize().scaleInPlace(distance)
        var ahead = leader.mesh.position.clone().add(tv);
        tv.negateInPlace()
        var behind = leader.mesh.position.clone().add(tv);

        if (this.isOnLeaderSight(leader, ahead, leaderSightRadius)) {
            this.flee(leader);
        }
        this.arrivalThreshold = arrivalThreshold;
        this.arrive({
            mesh: {
                position: behind
            }
        });
        this.separation(entities, separationRadius, maxSeparation);
    }

    getNeighborAhead (entities) {
        var maxQueueAhead = 100;
        var maxQueueRadius = 100;
        var res;
        var qa = this.velocity.clone().normalize().scaleInPlace(maxQueueAhead);
        var ahead = this.mesh.position.clone().add(qa);
        for (var i = 0; i < entities.length; i++) {
            var distance = BABYLON.Vector3.Distance(ahead, entities[i].mesh.position);
            if (entities[i] != this && distance <= maxQueueRadius) {
                res = entities[i]
                break;
            }
        }
        return res;
    }

    queue (entities, maxQueueRadius = 50) {
        var neighbor = this.getNeighborAhead(entities);
        var brake = new BABYLON.Vector3(0, 0, 0);
        var v = this.velocity.clone()
        if (neighbor != null) {
            brake = this.steeringForce.clone().negateInPlace().scaleInPlace(0.8);
            v.negateInPlace().normalize();
            brake.add(v)
            if (BABYLON.Vector3.Distance(this.mesh.position, neighbor.mesh.position) <= maxQueueRadius) {
                this.velocity.scaleInPlace(0.3)
            }
        }
        this.steeringForce = this.steeringForce.add(brake);
    }

    // NOT WORKING !!!
    flock (entities) {
        var averageVelocity = this.velocity.clone();
        var averagePosition = new BABYLON.Vector3(0, 0, 0);
        var inSightCount = 0;
        for (var i = 0; i < entities.length; i++) {
            if (entities[i] != this && this.inSight(entities[i])) {
                averageVelocity.add(entities[i].velocity)
                averagePosition.add(entities[i].mesh.position)
                if (BABYLON.Vector3.Distance(this.mesh.position, entities[i].mesh.position) < this.tooCloseDistance) {
                    this.flee(entities[i] /* .mesh.position */);
                }
                inSightCount++;
            }
        }
        if (inSightCount > 0) {
            averageVelocity.scaleInPlace(1 / inSightCount);
            averagePosition.scaleInPlace(1 / inSightCount);
            this.seek({
                mesh: {
                    position: averagePosition
                }
            });
            this.steeringForce = this.steeringForce.add(averageVelocity.subtractInPlace(this.velocity));
        }
    }
}


/*

var A = new BABYLON.Vector3(2, 0, 2);
    var B = new BABYLON.Vector3(1, 0, 1);

    // somma i vettori mettendolo in un nuovo vettore
    let position3 = A.add(B);
    console.log('add: ', A, B, position3);

    // somma i vettori mettendolo in quello di partenza
    A.addInPlace(B);
    console.log('addInPlace: ', A);

    // moltiplica tutto per uno scalare mettendolo in un nuovo vettore
    let position4 = A.scale(2)
    console.log('scale :', position4, A);

    // motiplica tutto per uno scalare mettendo nel vettore di partenza
    A.scaleInPlace(.5);
    console.log('scaleInPlace: ', A);

    // sottrae un vettore mettendolo in un nuovo
    let position5 = A.subtract(B);
    console.log('subtract: ', position5, A);

    // sottrae un vettore mettendolo nel vettore di partenza
    A.subtractInPlace(B);
    console.log('subtractInPlace: ', A);

    // DISTANZA
    let distance1 = BABYLON.Vector3.Distance(A, B);
    let distance2 = A.subtract(B).length();
    console.log('Distance', distance1, distance2);

    console.log('A: ', A, 'B: ', B)
    let C = A.add(B).scale(0.5);            // PUNTO CENTRALE
    let D = BABYLON.Vector3.Lerp(A, C, 0.5); // INTERPOLAZIONE
    console.log('Centrale: ', C);
    console.log('Interpolato con Lerp: ', D);

    var E = new BABYLON.Vector3(0.5, 0, -0.5);  // la z è < !!!
    let F = new BABYLON.Vector3(2, 0, 2).add(E);
    console.log('F: ', F)

    let forward = BABYLON.Vector3.Forward();
    let backword = BABYLON.Vector3.Backward();
    let right = BABYLON.Vector3.Right();
    let left = BABYLON.Vector3.Left();

    COMBINAZIONI DI FORZE (behaviours)
    1) Priority arbitration: si sceglie la steering force >0 a priorità + alta
    2) Weighted Blending: si applica tutte le forse miscelandole in base a pesi
    3)  Prioritised Dithering: si assegna una priorità ed una priorità
        se ad ogni giro si estrae un numero a caso se questo è > della prob della priorità più alta
        si applica solo quello altrimenti si scende la scala delle priorità
    4) Weighted Prioritised Truncated Sum: si considerano le forse per priorità
        si moltiplica la 1° forza per il proprio peso: se questo è > della forza totale consentita
        ci si ferma altrimenti si considera la 2° forza in base alla priorità e si somma la forza
        e si ricontrolla che sia inferiore a quella consentita, etc


    Esempio di API:
    entity
    .seek(target1, 50)
    .flee(target2,100)
    .avoid(target3)
    .combine()

    ogni metodo ritorna una forza che è messa dentro una mappa
    per poi essere usata singolarmente o miscelata secondo i 4 metodi sopra

    Priorità
    http://www.lagers.org.uk/ai4g/libguides/lg15-force-calc.html

    Icone per game development gratis:
    https://game-icons.net/


*/