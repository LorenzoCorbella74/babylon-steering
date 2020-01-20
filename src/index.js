import * as BABYLON from 'babylonjs';

const defaultPriorities = {
    avoid: 10,
    queue: 9,
    separation: 7,
    flock: 6,
    flee: 6,
    seek: 5,
    idle: 0
};

const defaultProbabilities = {
    avoid: 0.66,
    queue: 0.66,
    separation: 0.66,
    flock: 0.66,
    flee: 0.66,
    seek: 0.66,
    idle: 0.66
};

export default class SteeringVehicle {

    constructor(mesh, engine, options = {}) {

        this.engine = engine;
        this.mesh = mesh;
        this.mesh.checkCollisions = true;
        this.steeringForce = new BABYLON.Vector3(0, 0, 0);
        this.maxForce = options.maxForce || 1;
        this.velocity = new BABYLON.Vector3(0, 0, 0);
        this.forces = [];

        this.maxSpeed = options.maxSpeed || 0.2;
        this.mass = options.mass || 1;

        this.velocitySamples = [];
        this.numSamplesForSmoothing = options.numSamplesForSmoothing || 20;

        // ARRIVAL
        this.arrivalThreshold = options.arrivalThreshold || 100;

        // AVOID
        this.avoidDistance = options.avoidDistance || 120;
        this.radius = options.radius || 100;

        // FOLLOWPATH
        this.waypoints = [];
        this.pathIndex = 0;

        // WANDER
        this.wanderDistance = options.wanderDistance || 10;
        this.wanderAngle = options.wanderAngle || 10;
        this.wanderRadius = options.wanderRadius || 5;
        this.wanderRange = options.wanderRange || 20;

        // QUEUE
        this.inSightDistance = options.inSightDistance || 200;
        this.tooCloseDistance = options.tooCloseDistance || 60;
    }

    get dt() {
        return this.engine.getDeltaTime();
    }

    set dt(what) {
        this.dt = what;
    }

    idle(target, configuration = {}) {
        this.velocity.scaleInPlace(0);
        this.steeringForce.setAll(0, 0, 0);
        let action = { force: this.steeringForce, name: this.idle.name };
        this.forces.push(Object.assign(configuration, action));
    }

    lookTarget(target) {
        this.mesh.lookAt(target.mesh.position); // native function
        return this;
    }

    lookWhereGoing(smoothing) {
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
        return this;
    }

    // se è sullo stesso lato ma non che è visibile...
    // TEST: vedere se new BABYLON.Vector3(0, 0, 1) funziona meglio
    inSight(target) {
        if (BABYLON.Vector3.Distance(this.mesh.position, target.mesh.position) > this.inSightDistance) {
            return false;
        }
        var heading = /* new BABYLON.Vector3(0, 0, 1); //  */target.velocity.clone().normalize().scaleInPlace(1);
        var difference = target.mesh.position.clone().subtract(this.mesh.position.clone());
        var dot = BABYLON.Vector3.Dot(difference, heading);
        // console.log(`Dot:${dot}`)
        return dot < 0 ? false : true;
    }

    // ACTIVE
    hasInConeOfView(targets) {
        for (let i = 0; i < targets.length; i++) {
            const target = targets[i];

            let targetPos = target.mesh.position.clone();
            let actorPos = this.mesh.position.clone();
            let distance = BABYLON.Vector3.Distance(targetPos, actorPos);

            let v0 = this.velocity.clone().normalize();
            let v1 = target.mesh.position.clone().subtract(this.mesh.position.clone());
            v1.normalize();
            let dot = BABYLON.Vector3.Dot(v0, v1)
            let angle = Math.acos(dot);
            let angleInDegree = BABYLON.Tools.ToDegrees(angle);
            // console.log(`Distance: ${distance}`, `Degree: ${angleInDegree}, Dot:${dot}`);
            if (distance < 170 && (angleInDegree < 60)) {
                target.mesh.material.emissiveColor = new BABYLON.Color3(1, 0.5, 0);
            } else {
                target.mesh.material.emissiveColor = target.mesh.color; // TODO: 
            }
        }
        return this;
    }

    // https://forum.babylonjs.com/t/rotation-angle-of-camera-to-object/2603/21
    // PASSIVA
    isInConeOfViewOf(target) {

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
        } else {
            this.mesh.material.emissiveColor = new BABYLON.Color3(0, 0, 1);
        }
        return this;
    }

    // TODO: convert Three.js clampLength method to BABYLON
    truncate(vector, max) {
        let i = max / vector.length();
        return vector.scaleInPlace(i < 1.0 ? i : 1.0);
    }

    // si aggiorna in base a sistema di riferimento GLOBALE
    update() {
        this.steeringForce = this.truncate(this.steeringForce, this.maxForce);
        this.steeringForce.scaleInPlace(1 / this.mass);
        this.velocity.addInPlace(this.steeringForce);
        this.velocity = this.truncate(this.velocity, this.maxSpeed* this.dt);
        this.velocity.y = 0;
        this.steeringForce.setAll(0, 0, 0);
        this.mesh.moveWithCollisions(this.velocity);
        this.forces = [];
    }

    // forza generica...(ES: wind...)
    applyForce(force, configuration = {}) {
        let action = { force: force, name: this.applyForce.name };
        this.forces.push(Object.assign(configuration, action));
        return this;
    }

    // seek with a specific strength
    // PASSIVE
    attract(target, threshold = 0, strenght = 1, configuration = {}) {
        let distance = BABYLON.Vector3.Distance(this.mesh.position, target.mesh.position);
        if (distance < threshold && distance > 20) {
            var desiredVelocity = (this.mesh.position.clone().subtract(target.mesh.position.clone())).normalize().scaleInPlace(this.maxSpeed * this.dt * strenght);
            let action = { force: desiredVelocity.subtractInPlace(target.velocity), name: this.attract.name };
            target.forces.push(Object.assign(configuration, action));
        } else {
            // senza di questo oscilla...
            target.flee(this);
        }
        return this;
    }

    seek(target, threshold = 0, configuration = {}) {
        let distance = BABYLON.Vector3.Distance(this.mesh.position, target.mesh.position);
        if (distance > threshold) {
            var desiredVelocity = (target.mesh.position.clone().subtract(this.mesh.position.clone())).normalize().scaleInPlace(this.maxSpeed * this.dt);
            let action = { force: desiredVelocity.subtractInPlace(this.velocity), name: this.seek.name };
            this.forces.push(Object.assign(configuration, action));
        } else {
            this.idle(target, configuration);
        }
        return this;
    }

    seekWithArrive(target, threshold, configuration = {}) {
        var desiredVelocity = target.mesh.position.clone().subtract(this.mesh.position.clone());
        desiredVelocity.normalize()
        var distance = BABYLON.Vector3.Distance(target.mesh.position, this.mesh.position);
        // si procede normalmente
        if (distance > this.arrivalThreshold) {
            desiredVelocity.scaleInPlace(this.maxSpeed * this.dt);
            // si decellera
        } else if (distance > threshold && distance < this.arrivalThreshold) {
            desiredVelocity.scaleInPlace(this.maxSpeed * this.dt * (distance - threshold) / (this.arrivalThreshold - threshold))
            // ci si ferma
        } else {
            this.idle(target, configuration);
        }
        let action = { force: desiredVelocity.subtractInPlace(this.velocity), name: this.seekWithArrive.name };
        this.forces.push(Object.assign(configuration, action));
        return this;
    }

    flee(target, threshold = 0, configuration = {}) {
        let distance = BABYLON.Vector3.Distance(this.mesh.position, target.mesh.position);
        if (distance < threshold) {
            var desiredVelocity = (this.mesh.position.clone().subtract(target.mesh.position.clone())).normalize().scaleInPlace(this.maxSpeed * this.dt);
            let action = { force: desiredVelocity.subtractInPlace(this.velocity), name: this.flee.name };
            this.forces.push(Object.assign(configuration, action));
        } else {
            this.idle(target, configuration);
        }
        return this;
    }

    arrive(target, configuration = {}) {
        var desiredVelocity = target.mesh.position.clone().subtract(this.mesh.position.clone());
        desiredVelocity.normalize()
        var distance = BABYLON.Vector3.Distance(target.mesh.position, this.mesh.position)
        if (distance > this.arrivalThreshold) {
            desiredVelocity.scaleInPlace(this.maxSpeed * this.dt);
        } else {
            desiredVelocity.scaleInPlace(this.maxSpeed * this.dt * distance / this.arrivalThreshold)
        }
        let action = { force: desiredVelocity.subtractInPlace(this.velocity), name: this.flee.name };
        this.forces.push(Object.assign(configuration, action));
        return this;
    }

    pursue(target, threshold = 0) {
        var lookAheadTime = BABYLON.Vector3.Distance(this.mesh.position, target.mesh.position) / (this.maxSpeed * this.dt);
        var predictedTarget = target.mesh.position.clone().add(target.velocity.clone().scaleInPlace(lookAheadTime));
        this.seek({
            mesh: {
                position: predictedTarget
            }
        }, threshold);
    }

    evade(target, threshold = 0) {
        var lookAheadTime = BABYLON.Vector3.Distance(this.mesh.position, target.mesh.position) / (this.maxSpeed * this.dt);
        var predictedTarget = target.mesh.position.clone().subtract(target.velocity.clone().scaleInPlace(lookAheadTime));
        this.flee({
            mesh: {
                position: predictedTarget
            }
        }, threshold);
    }

    // tramite un ray casting si vede se il target è visibile (non ci stanno ostacoli che lo nascondono)
    canSee(target) {
        var forward = target.mesh.position.clone();
        var direction = forward.subtract(this.mesh.position).normalize();
        var length = 350;
        let start = BABYLON.Vector3.Lerp(target.mesh.position.clone(), this.mesh.position.clone(), 0.66);
        var ray = new BABYLON.Ray(start, direction, length);
        // let rayHelper = new BABYLON.RayHelper(ray);
        // rayHelper.show(this.mesh.getScene());
        var hit = target.mesh.getScene().pickWithRay(ray);
        let output = hit.pickedMesh && hit.pickedMesh.uniqueId === target.mesh.uniqueId ? true : false;
        // console.log('Can see: ', output);
        return output;
    }

    hide(target, obstacles, threshold = 250) {
        if (this.canSee(target)) {
            this.lookTarget(target);
            // si sceglie l'ostacolo più vicino all'elemento da nascondere
            let closestObstacle = new BABYLON.Vector3(0, 0, 0);
            let closestDistance = 10000;
            for (let i = 0; i < obstacles.length; i++) {
                const obstacle = obstacles[i];
                let distance = BABYLON.Vector3.Distance(this.mesh.position, obstacle.mesh.position);
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
                this.flee(target)
            }
        } else {
            this.lookWhereGoing(true);
            this.idle();
        }
        return this;
    }

    // FIXME: NOT WORKING PROPERLY ???
    wander(configuration = {}) {
        var center = this.velocity.clone().normalize().scaleInPlace(this.wanderDistance);
        var offset = new BABYLON.Vector3(1, 1, 1).scaleInPlace(this.wanderRadius);
        offset.x = Math.sin(this.wanderAngle) * offset.length();
        offset.z = - Math.cos(this.wanderAngle) * offset.length();
        offset.y = 0;
        this.wanderAngle = Math.random() * this.wanderRange - this.wanderRange * .5;
        center.addInPlace(offset);
        center.y = this.mesh.position.y;
        let action = { force: center, name: this.wander.name };
        this.forces.push(Object.assign(configuration, action));
        return this;
    }

    separation(entities, separationRadius = 50, maxSeparation = 40, configuration = {}) {
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
        let action = { force: force, name: this.separation.name };
        this.forces.push(Object.assign(configuration, action));
        return this;
    }

    interpose(targetA, targetB) {
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

    avoid(obstacles, configuration = {}) {
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
        let action = { force: avoidance, name: this.avoid.name };
        this.forces.push(Object.assign(configuration, action));
        return this;
    }

    followPath(path, loop, thresholdRadius = 10) {
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

    isOnLeaderSight(leader, ahead, leaderSightRadius) {
        return (BABYLON.Vector3.Distance(ahead, this.mesh.position) <= leaderSightRadius ||
            BABYLON.Vector3.Distance(leader.mesh.position, this.mesh.position) <= leaderSightRadius);
    }

    followLeader(leader, entities, distance = 20, separationRadius = 40, maxSeparation = 10, leaderSightRadius = 50, arrivalThreshold = 100) {
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
        return this;
    }

    getNeighborAhead(entities) {
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

    queue(entities, maxQueueRadius = 50, configuration = {}) {
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
        let action = { force: brake, name: this.queue.name };
        this.forces.push(Object.assign(configuration, action));
        return this;
    }

    // NOT WORKING !!!
    flock(entities, configuration = {}) {
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
            let action = { force: averageVelocity.subtractInPlace(this.velocity), name: this.flock.name };
            this.forces.push(Object.assign(configuration, action));
        }
        return this;
    }

    sortByPriority(arr) {
        return arr.sort(function (a, b) {
            return (b.priority || defaultPriorities[b.name]) - (a.priority || defaultPriorities[a.name]);
        });
    }

    animate(mode) {
        if (mode === "blend") {
            this.forces.forEach(a => {
                this.steeringForce = this.steeringForce.add(a.force).scaleInPlace(a.weigth || 0.5);
            });
        } else if (mode === "priority") {
            // order for priority
            this.forces = this.sortByPriority(this.forces);
            let output = this.forces[0].force;
            this.steeringForce = this.steeringForce.add(output);
        } else if (mode === "probability") {
            let output = new BABYLON.Vector3(0, 0, 0);
            this.forces = this.sortByPriority(this.forces);
            for (let i = 0; i < this.forces.length; i++) {
                let ele = this.forces[i];
                if ((ele.probability || defaultProbabilities[ele.name]) > Math.random()) {
                    output = ele.force;
                    break;
                }
            }
            this.steeringForce = this.steeringForce.add(output);
        } else if (mode === "truncated") {
            this.forces = this.sortByPriority(this.forces);
            for (let i = 0; i < this.forces.length; i++) {
                let ele = this.forces[i];
                this.steeringForce = this.steeringForce.add(ele.force).scaleInPlace(ele.weigth || 0.5);
                if (this.steeringForce.length() > 0.005) {
                    break;
                }
            }
        } else {
            this.forces.forEach(a => {
                this.steeringForce = this.steeringForce.add(a.force)
            });
        }
        this.update();
    }

}
