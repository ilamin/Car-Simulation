/* global CANNON,THREE,Detector */
/*jshint esversion:8*/

CANNON = CANNON || {};

/**
 * Mechanics framework class. If you want to learn how to connect Cannon.js with Three.js, please look at the examples/ instead.
 * @class Mechanics
 * @constructor
 * @param {Object} options
 */


CANNON.Mechanics = function(options){

    var that = this;

    // API
    this.addScene = addScene;
    this.restartCurrentScene = restartCurrentScene;
    this.changeScene = changeScene;
    this.start = start;
    this.enableFol = enableFol;
    this.getCam = getCam;
    this.switchbackwardfollowcamera = switchbackwardfollowcamera;
    this.switchforwardfollowcamera = switchforwardfollowcamera;
    this.togglingcamera = togglingcamera;
    this.togglingcameraback = togglingcameraback;
    /* Add this line */
    this.getMeshProperty = this.getMeshProperty;
    //End of The line



    var sceneFolder;

    // Global settings
    var settings = this.settings = {
        stepFrequency: 60,
        quatNormalizeSkip: 2,
        quatNormalizeFast: true,
        gx: 0,
        gy: 0,
        gz: 0,
        iterations: 3,
        tolerance: 0.0001,
        k: 1e6,
        d: 3,
        scene: 0,
        paused: false,
        rendermode: "solid",
        constraints: false,
        contacts: false,  // Contact points
        cm2contact: false, // center of mass to contact points
        normals: false, // contact normals
        axes: false, // "local" frame axes
        particleSize: 0.1,
        shadows: true,
        aabbs: false,
        profiling: false,
        maxSubSteps:3
    };

    // Extend settings with options
    options = options || {};
    for(var key in options){
        if(key in settings){
            settings[key] = options[key];
        }
    }

    if(settings.stepFrequency % 60 !== 0){
        throw new Error("stepFrequency must be a multiple of 60.");
    }

    var bodies = this.bodies = [];
    var visuals = this.visuals = [];
    var curVisualID = this.curVisualID = -1;
    var scenes = [];
    var gui = null;
    var smoothie = null;
    var smoothieCanvas = null;
    var scenePicker = {};

    var three_contactpoint_geo = new THREE.SphereGeometry( 0.1, 6, 6);
    var particleGeo = this.particleGeo = new THREE.SphereGeometry( 1, 16, 8 );

    // Material
    var materialColor = 0xdddddd;
    var solidMaterial = new THREE.MeshLambertMaterial( { color: materialColor } );
    //THREE.ColorUtils.adjustHSV( solidMaterial.color, 0, 0, 0.9 );
    var wireframeMaterial = new THREE.MeshLambertMaterial( { color: 0xffffff, wireframe:true } );
    this.currentMaterial = solidMaterial;
    var contactDotMaterial = new THREE.MeshLambertMaterial( { color: 0xff0000 } );
    var particleMaterial = this.particleMaterial = new THREE.MeshLambertMaterial( { color: 0xff0000 } );

    // Geometry caches
    var contactMeshCache = new GeometryCache(function(){
        return new THREE.Mesh( three_contactpoint_geo, contactDotMaterial );
    });
    var cm2contactMeshCache = new GeometryCache(function(){
        var geometry = new THREE.Geometry();
        geometry.vertices.push(new THREE.Vector3(0,0,0));
        geometry.vertices.push(new THREE.Vector3(1,1,1));
        return new THREE.Line( geometry, new THREE.LineBasicMaterial( { color: 0xff0000 } ) );
    });
    var bboxGeometry = new THREE.BoxGeometry(1,1,1);
    var bboxMaterial = new THREE.MeshBasicMaterial({
        color: materialColor,
        wireframe:true
    });
    var bboxMeshCache = new GeometryCache(function(){
        return new THREE.Mesh(bboxGeometry,bboxMaterial);
    });
    var distanceConstraintMeshCache = new GeometryCache(function(){
        var geometry = new THREE.Geometry();
        geometry.vertices.push(new THREE.Vector3(0,0,0));
        geometry.vertices.push(new THREE.Vector3(1,1,1));
        return new THREE.Line( geometry, new THREE.LineBasicMaterial( { color: 0xff0000 } ) );
    });
    var p2pConstraintMeshCache = new GeometryCache(function(){
        var geometry = new THREE.Geometry();
        geometry.vertices.push(new THREE.Vector3(0,0,0));
        geometry.vertices.push(new THREE.Vector3(1,1,1));
        return new THREE.Line( geometry, new THREE.LineBasicMaterial( { color: 0xff0000 } ) );
    });
    var normalMeshCache = new GeometryCache(function(){
        var geometry = new THREE.Geometry();
        geometry.vertices.push(new THREE.Vector3(0,0,0));
        geometry.vertices.push(new THREE.Vector3(1,1,1));
        return new THREE.Line( geometry, new THREE.LineBasicMaterial({color:0x00ff00}));
    });
    var axesMeshCache = new GeometryCache(function(){
        var mesh = new THREE.Object3D();
        //mesh.useQuaternion = true;
        var origin = new THREE.Vector3(0,0,0);
        var gX = new THREE.Geometry();
        var gY = new THREE.Geometry();
        var gZ = new THREE.Geometry();
        gX.vertices.push(origin);
        gY.vertices.push(origin);
        gZ.vertices.push(origin);
        gX.vertices.push(new THREE.Vector3(1,0,0));
        gY.vertices.push(new THREE.Vector3(0,1,0));
        gZ.vertices.push(new THREE.Vector3(0,0,1));
        var lineX = new THREE.Line( gX, new THREE.LineBasicMaterial({color:0xff0000}));
        var lineY = new THREE.Line( gY, new THREE.LineBasicMaterial({color:0x00ff00}));
        var lineZ = new THREE.Line( gZ, new THREE.LineBasicMaterial({color:0x0000ff}));
        mesh.add(lineX);
        mesh.add(lineY);
        mesh.add(lineZ);
        return mesh;
    });
    function restartGeometryCaches(){
        contactMeshCache.restart();
        contactMeshCache.hideCached();

        cm2contactMeshCache.restart();
        cm2contactMeshCache.hideCached();

        distanceConstraintMeshCache.restart();
        distanceConstraintMeshCache.hideCached();

        normalMeshCache.restart();
        normalMeshCache.hideCached();
    }

    // Create physics world
    var world = this.world = new CANNON.World();
    world.broadphase = new CANNON.NaiveBroadphase();

    var renderModes = ["solid","wireframe"];

    function updategui(){
        if(gui){
            // First level
            for (var i in gui.__controllers){
                gui.__controllers[i].updateDisplay();
            }

            // Second level
            for (var f in gui.__folders){
                for (var i in gui.__folders[f].__controllers){
                    gui.__folders[f].__controllers[i].updateDisplay();
                }
            }
        }
    }

    var light, scene, ambient, stats, info;

    function setRenderMode(mode){
        if(renderModes.indexOf(mode) === -1){
            throw new Error("Render mode "+mode+" not found!");
        }

        switch(mode){
        case "solid":
            that.currentMaterial = solidMaterial;
            light.intensity = 1;
            ambient.color.setHex(0x222222);
            break;
        case "wireframe":
            that.currentMaterial = wireframeMaterial;
            light.intensity = 0;
            ambient.color.setHex(0xffffff);
            break;
        }

        function setMaterial(node,mat){
            if(node.material){
                node.material = mat;
            }
            for(var i=0; i<node.children.length; i++){
                setMaterial(node.children[i],mat);
            }
        }
        for(var i=0; i<visuals.length; i++){
            setMaterial(visuals[i],that.currentMaterial);
        }
        settings.rendermode = mode;
    }

    /**
     * Add a scene to the demo app
     * @method addScene
     * @param {String} title Title of the scene
     * @param {Function} initfunc A function that takes one argument, app, and initializes a physics scene. The function runs app.setWorld(body), app.addVisual(body), app.removeVisual(body) etc.
     */
    function addScene(title,initfunc){
        if(typeof(title) !== "string"){
            throw new Error("1st argument of Mechanics.addScene(title,initfunc) must be a string!");
        }
        if(typeof(initfunc)!=="function"){
            throw new Error("2nd argument of Mechanics.addScene(title,initfunc) must be a function!");
        }
        scenes.push(initfunc);
        var idx = scenes.length-1;
        scenePicker[title] = function(){
            changeScene(idx);
        };
        //sceneFolder.add(scenePicker,title);
    }

    /**
     * Restarts the current scene
     * @method restartCurrentScene
     */
    function restartCurrentScene(){
        var N = bodies.length;
        for(var i=0; i<N; i++){
            var b = bodies[i];
            b.position.copy(b.initPosition);
            b.velocity.copy(b.initVelocity);
            if(b.initAngularVelocity){
                b.angularVelocity.copy(b.initAngularVelocity);
                b.quaternion.copy(b.initQuaternion);
            }
        }
    }

    function makeSureNotZero(vec){
        if(vec.x===0.0){
            vec.x = 1e-6;
        }
        if(vec.y===0.0){
            vec.y = 1e-6;
        }
        if(vec.z===0.0){
            vec.z = 1e-6;
        }
    }


    function updateVisuals(){
        var N = bodies.length;

        // Read position data into visuals
        for(var i=0; i<N; i++){
            var b = bodies[i], visual = visuals[i];
            visual.position.copy(b.position);
            if(b.quaternion){
                visual.quaternion.copy(b.quaternion);
            }
        }

        // Render contacts
        contactMeshCache.restart();
        if(settings.contacts){
            // if ci is even - use body i, else j
            for(var ci=0; ci < world.contacts.length; ci++){
                for(var ij=0; ij < 2; ij++){
                    var  mesh = contactMeshCache.request(),
                    c = world.contacts[ci],
                    b = ij===0 ? c.bi : c.bj,
                    r = ij===0 ? c.ri : c.rj;
                    mesh.position.set( b.position.x + r.x , b.position.y + r.y , b.position.z + r.z );
                }
            }
        }
        contactMeshCache.hideCached();

        // Lines from center of mass to contact point
        cm2contactMeshCache.restart();
        if(settings.cm2contact){
            for(var ci=0; ci<world.contacts.length; ci++){
                for(var ij=0; ij < 2; ij++){
                    var line = cm2contactMeshCache.request(),
                        c = world.contacts[ci],
                        b = ij===0 ? c.bi : c.bj,
                        r = ij===0 ? c.ri : c.rj;
                    line.scale.set( r.x, r.y, r.z);
                    makeSureNotZero(line.scale);
                    line.position.copy(b.position);
                }
            }
        }
        cm2contactMeshCache.hideCached();

        distanceConstraintMeshCache.restart();
        p2pConstraintMeshCache.restart();
        if(settings.constraints){
            // Lines for distance constraints
            for(var ci=0; ci<world.constraints.length; ci++){
                var c = world.constraints[ci];
                if(!(c instanceof CANNON.DistanceConstraint)){
                    continue;
                }

                var nc = c.equations.normal;

                var bi=nc.bi, bj=nc.bj, line = distanceConstraintMeshCache.request();
                var i=bi.id, j=bj.id;

                // Remember, bj is either a Vec3 or a Body.
                var v;
                if(bj.position){
                    v = bj.position;
                } else {
                    v = bj;
                }
                line.scale.set( v.x-bi.position.x,
                                v.y-bi.position.y,
                                v.z-bi.position.z );
                makeSureNotZero(line.scale);
                line.position.copy(bi.position);
            }


            // Lines for distance constraints
            for(var ci=0; ci<world.constraints.length; ci++){
                var c = world.constraints[ci];
                if(!(c instanceof CANNON.PointToPointConstraint)){
                    continue;
                }
                var n = c.equations.normal;
                var bi=n.bi, bj=n.bj, relLine1 = p2pConstraintMeshCache.request(), relLine2 = p2pConstraintMeshCache.request(), diffLine = p2pConstraintMeshCache.request();
                var i=bi.id, j=bj.id;

                relLine1.scale.set( n.ri.x, n.ri.y, n.ri.z );
                relLine2.scale.set( n.rj.x, n.rj.y, n.rj.z );
                diffLine.scale.set( -n.penetrationVec.x, -n.penetrationVec.y, -n.penetrationVec.z );
                makeSureNotZero(relLine1.scale);
                makeSureNotZero(relLine2.scale);
                makeSureNotZero(diffLine.scale);
                relLine1.position.copy(bi.position);
                relLine2.position.copy(bj.position);
                n.bj.position.vadd(n.rj,diffLine.position);
            }
        }
        p2pConstraintMeshCache.hideCached();
        distanceConstraintMeshCache.hideCached();

        // Normal lines
        normalMeshCache.restart();
        if(settings.normals){
            for(var ci=0; ci<world.contacts.length; ci++){
                var c = world.contacts[ci];
                var bi=c.bi, bj=c.bj, line=normalMeshCache.request();
                var i=bi.id, j=bj.id;
                var n = c.ni;
                var b = bi;
                line.scale.set(n.x,n.y,n.z);
                makeSureNotZero(line.scale);
                line.position.copy(b.position);
                c.ri.vadd(line.position,line.position);
            }
        }
        normalMeshCache.hideCached();

        // Frame axes for each body
        axesMeshCache.restart();
        if(settings.axes){
            for(var bi=0; bi<bodies.length; bi++){
                var b = bodies[bi], mesh=axesMeshCache.request();
                mesh.position.copy(b.position);
                if(b.quaternion){
                    mesh.quaternion.copy(b.quaternion);
                }
            }
        }
        axesMeshCache.hideCached();

        // AABBs
        bboxMeshCache.restart();
        if(settings.aabbs){
            for(var i=0; i<bodies.length; i++){
                var b = bodies[i];
                if(b.computeAABB){

                    if(b.aabbNeedsUpdate){
                        b.computeAABB();
                    }

                    // Todo: cap the infinite AABB to scene AABB, for now just dont render
                    if( isFinite(b.aabb.lowerBound.x) &&
                        isFinite(b.aabb.lowerBound.y) &&
                        isFinite(b.aabb.lowerBound.z) &&
                        isFinite(b.aabb.upperBound.x) &&
                        isFinite(b.aabb.upperBound.y) &&
                        isFinite(b.aabb.upperBound.z) &&
                        b.aabb.lowerBound.x - b.aabb.upperBound.x != 0 &&
                        b.aabb.lowerBound.y - b.aabb.upperBound.y != 0 &&
                        b.aabb.lowerBound.z - b.aabb.upperBound.z != 0){
                            var mesh = bboxMeshCache.request();
                            mesh.scale.set( b.aabb.lowerBound.x - b.aabb.upperBound.x,
                                            b.aabb.lowerBound.y - b.aabb.upperBound.y,
                                            b.aabb.lowerBound.z - b.aabb.upperBound.z);
                            mesh.position.set(  (b.aabb.lowerBound.x + b.aabb.upperBound.x)*0.5,
                                                (b.aabb.lowerBound.y + b.aabb.upperBound.y)*0.5,
                                                (b.aabb.lowerBound.z + b.aabb.upperBound.z)*0.5);
                        }
                }
            }
        }
        bboxMeshCache.hideCached();
    }

    if (!Detector.webgl){
        Detector.addGetWebGLMessage();
    }

    var SHADOW_MAP_WIDTH = 512;
    var SHADOW_MAP_HEIGHT = 512;
    var MARGIN = 0;
    var SCREEN_WIDTH = window.innerWidth;
    var SCREEN_HEIGHT = window.innerHeight - 2 * MARGIN;
    //Edited camera
    var camera, camera1, camera2, camera3, camera4, renderer, enablefollowcamera, followcameratarget, offsetcam,camoffset;
    //offsetcam = new THREE.Vector3();
    camoffset = false;
    offsetcam = false;
    enablefollowcamera = false;
    var container;
    var NEAR = 5, FAR = 2000;
    var sceneHUD, cameraOrtho, hudMaterial;

    var mouseX = 0, mouseY = 0;

    var windowHalfX = window.innerWidth / 2;
    var windowHalfY = window.innerHeight / 2;

    init();
    animate();

    function init() {

        container = document.createElement( 'div' );
        document.body.appendChild( container );

        // Camera
        camera = new THREE.PerspectiveCamera( 24, SCREEN_WIDTH / SCREEN_HEIGHT, NEAR, FAR );

        camera.up.set(0,0,1);
        camera.position.set(0,0,0);

        camera1 = new THREE.PerspectiveCamera( 24, SCREEN_WIDTH / SCREEN_HEIGHT, NEAR, FAR );

        camera1.up.set(0,0,1);
        camera1.position.set(0,0,0);

        camera2 = new THREE.PerspectiveCamera( 24, SCREEN_WIDTH / SCREEN_HEIGHT, NEAR, FAR );

        camera2.up.set(0,0,1);
        camera2.position.set(0,0,0);

        camera3 = new THREE.PerspectiveCamera( 24, SCREEN_WIDTH / SCREEN_HEIGHT, NEAR, FAR );

        camera3.up.set(0,0,1);
        camera3.position.set(0,0,0);

        camera4 = new THREE.PerspectiveCamera( 24, SCREEN_WIDTH / SCREEN_HEIGHT, NEAR, FAR );

        camera4.up.set(0,0,1);
        camera4.position.set(0,0,0);
        //End camera
        // SCENE
        scene = that.scene = new THREE.Scene();
        const cubeloader = new THREE.CubeTextureLoader();
        const backtex = cubeloader.load([
            'https://res.cloudinary.com/dg4oldfw9/image/upload/v1561897972/threejs/atop-left.jpg',
            'https://res.cloudinary.com/dg4oldfw9/image/upload/v1561897973/threejs/atop-mid.jpg',
            'https://res.cloudinary.com/dg4oldfw9/image/upload/v1561897972/threejs/atop-right.jpg',
            'https://res.cloudinary.com/dg4oldfw9/image/upload/v1561897972/threejs/atop-left.jpg',
            'https://res.cloudinary.com/dg4oldfw9/image/upload/v1561897973/threejs/atop-mid.jpg',
            'https://res.cloudinary.com/dg4oldfw9/image/upload/v1561897972/threejs/atop-right.jpg',
        ]);
        scene.background = backtex;
        scene.fog = new THREE.Fog( 0x222222, 1000, FAR );

        // LIGHTS
        ambient = new THREE.AmbientLight( 0x222222 );
        scene.add( ambient );

        light = new THREE.SpotLight( 0xffffff );
        light.position.set( 30, 30, 90 );
        light.target.position.set( 0, 0, 0 );

        light.castShadow = true;

        light.shadowCameraNear = 10;
        light.shadowCameraFar = 1000;//camera.far;
        light.shadowCameraFov = 30;

        light.shadowMapBias = 0.0001;
        light.shadowMapDarkness = 0.5;
        light.shadowMapWidth = SHADOW_MAP_WIDTH;
        light.shadowMapHeight = SHADOW_MAP_HEIGHT;

        //light.shadowCameraVisible = true;

        scene.add( light );
        scene.add( camera );

        // RENDERER
        renderer = new THREE.WebGLRenderer( { clearColor: 0x000000, clearAlpha: 1, antialias: true } );
        renderer.setSize( SCREEN_WIDTH, SCREEN_HEIGHT );
        renderer.domElement.style.position = "relative";
        renderer.domElement.style.top = MARGIN + 'px';
        container.appendChild( renderer.domElement );

        // Add info
        info = document.createElement( 'div' );
        info.style.position = 'absolute';
        info.style.top = '10px';
        info.style.width = '100%';
        info.style.textAlign = 'center';
        container.appendChild( info );

        document.addEventListener('mousemove',onDocumentMouseMove);
        window.addEventListener('resize',onWindowResize);

        renderer.setClearColor( scene.fog.color, 1 );
        renderer.autoClear = false;

        renderer.shadowMapEnabled = true;
        renderer.shadowMapSoft = true;
        renderer.shadowMapType =THREE.PCFSoftShadowMap;

        // Smoothie
        smoothieCanvas = document.createElement("canvas");
        smoothieCanvas.width = SCREEN_WIDTH;
        smoothieCanvas.height = SCREEN_HEIGHT;
        smoothieCanvas.style.opacity = 0.5;
        smoothieCanvas.style.position = 'absolute';
        smoothieCanvas.style.top = '0px';
        smoothieCanvas.style.zIndex = 90;
        container.appendChild( smoothieCanvas );
        smoothie = new SmoothieChart({
            labelOffsetY:50,
            maxDataSetLength:100,
            millisPerPixel:2,
            grid: {
                strokeStyle:'none',
                fillStyle:'none',
                lineWidth: 1,
                millisPerLine: 250,
                verticalSections: 6
            },
            labels: {
                fillStyle:'rgb(180, 180, 180)'
            }
        });
        smoothie.streamTo(smoothieCanvas);
        // Create time series for each profile label
        var lines = {};
        var colors = [[255, 0, 0],[0, 255, 0],[0, 0, 255],[255,255,0],[255,0,255],[0,255,255]];
        var i=0;
        for(var label in world.profile){
            var c = colors[i%colors.length];
            lines[label] = new TimeSeries({
                label : label,
                fillStyle : "rgb("+c[0]+","+c[1]+","+c[2]+")",
                maxDataLength : 500,
            });
            i++;
        }

        // Add a random value to each line every second
        world.addEventListener("postStep",function(evt) {
            for(var label in world.profile)
                lines[label].append(world.time * 1000, world.profile[label]);
        });

        // Add to SmoothieChart
        var i=0;
        for(var label in world.profile){
            var c = colors[i%colors.length];
            smoothie.addTimeSeries(lines[label],{
                strokeStyle : "rgb("+c[0]+","+c[1]+","+c[2]+")",
                //fillStyle:"rgba("+c[0]+","+c[1]+","+c[2]+",0.3)",
                lineWidth:2
            });
            i++;
        }
        world.doProfiling = false;
        smoothie.stop();
        smoothieCanvas.style.display = "none";

        // STATS
        stats = new Stats();
        stats.domElement.style.position = 'absolute';
        stats.domElement.style.top = '0px';
        stats.domElement.style.zIndex = 100;
        container.appendChild( stats.domElement );

    }

    var t = 0, newTime, delta;

    function animate(){
        requestAnimationFrame( animate );
        if(!settings.paused){
            updateVisuals();
            updatePhysics();
        }
        render();
        stats.update();
    }

    var lastCallTime = 0;
    function updatePhysics(){
        // Step world
        var timeStep = 1 / settings.stepFrequency;

        var now = Date.now() / 1000;

        if(!lastCallTime){
            // last call time not saved, cant guess elapsed time. Take a simple step.
            world.step(timeStep);
            lastCallTime = now;
            return;
        }

        var timeSinceLastCall = now - lastCallTime;

        world.step(timeStep, timeSinceLastCall, settings.maxSubSteps);

        lastCallTime = now;
    }

    function onDocumentMouseMove( event ) {
        mouseX = ( event.clientX - windowHalfX );
        mouseY = ( event.clientY - windowHalfY );
    }

    function onWindowResize( event ) {
        SCREEN_WIDTH = window.innerWidth;
        SCREEN_HEIGHT = window.innerHeight;

        renderer.setSize( SCREEN_WIDTH, SCREEN_HEIGHT );

        camera.aspect = SCREEN_WIDTH / SCREEN_HEIGHT;
        camera.updateProjectionMatrix();


        camera.radius = ( SCREEN_WIDTH + SCREEN_HEIGHT ) / 4;
    }

    function render(){
        renderer.clear();
        renderer.render( that.scene, camera );
    }




    function changeScene(n){
        that.dispatchEvent({ type: 'destroy' });
        settings.paused = false;
        updategui();
        buildScene(n);
    }


    function start(){
        buildScene(0);
    }
    
    //Enabling follow camera
    function enableFol(idnum, zooming=20, heighting=2){

        followcameratarget = this.visuals[idnum];
        enablefollowcamera = true;
        camera1.position.x = followcameratarget.position.x - zooming;
        camera1.position.y = followcameratarget.position.y;
        camera1.position.z = followcameratarget.position.z + heighting;
        followcameratarget.add(camera1);
        camera1.lookAt(followcameratarget.position);
        camera1.updateProjectionMatrix();
        camera2.position.x = followcameratarget.position.x + zooming;
        camera2.position.y = followcameratarget.position.y;
        camera2.position.z = followcameratarget.position.z + heighting;
        followcameratarget.add(camera2);
        camera2.lookAt(followcameratarget.position);
        camera2.updateProjectionMatrix();

        camera3.position.x = followcameratarget.position.x - 1;
        camera3.position.y = followcameratarget.position.y;
        camera3.position.z = followcameratarget.position.z + 1;
        followcameratarget.add(camera3);
        camera3.lookAt(new THREE.Vector3(10,0,0));
        camera3.updateProjectionMatrix();
        
        camera4.position.x = followcameratarget.position.x + 1;
        camera4.position.y = followcameratarget.position.y;
        camera4.position.z = followcameratarget.position.z + 1;
        followcameratarget.add(camera4);
        camera4.lookAt(new THREE.Vector3(-10,0,0));
        camera4.updateProjectionMatrix();

        camera.copy(camera1);
        //camera.rotation.copy(camera1.rotation);
        followcameratarget.add(camera);
        camera.updateProjectionMatrix();
    }
    //Camera functions
    function getCam(){
        return camera;
    }

    function togglingcameraback(){
        if(offsetcam){
            if(camoffset)
            camera.copy(camera2);
            else
            camera.copy(camera1);
            camera.updateProjectionMatrix();
            offsetcam=false;
        }
    }

    function togglingcamera(){
        if(!offsetcam){
            if(camoffset)
            camera.copy(camera4);
            else
            camera.copy(camera3);
            camera.updateProjectionMatrix();
            offsetcam=true; 
        }
    }

    function switchbackwardfollowcamera(){
        if(enablefollowcamera && !camoffset){
            if(offsetcam)
            camera.copy(camera4);
            else
            camera.copy(camera2);
            
            camera.updateProjectionMatrix();
            camoffset = true;
        }
    }
    function switchforwardfollowcamera(){
        if(enablefollowcamera && camoffset){
            if(offsetcam)
            camera.copy(camera3);
            else
            camera.copy(camera1);
            camera.updateProjectionMatrix();
            camoffset=false;
        }
    }
    //End camera functions
    function buildScene(n){
        // Remove current bodies and visuals
        var num = visuals.length;
        for(var i=0; i<num; i++){
            world.remove(bodies.pop());
            var mesh = visuals.pop();
            that.scene.remove(mesh);
        }
        // Remove all constraints
        while(world.constraints.length){
            world.removeConstraint(world.constraints[0]);
        }

        // Run the user defined "build scene" function
        scenes[n]();

        // Read the newly set data to the gui
        settings.iterations = world.solver.iterations;
        settings.gx = world.gravity.x+0.0;
        settings.gy = world.gravity.y+0.0;
        settings.gz = world.gravity.z+0.0;
        settings.quatNormalizeSkip = world.quatNormalizeSkip;
        settings.quatNormalizeFast = world.quatNormalizeFast;
        //updategui();

        restartGeometryCaches();
    }



    function GeometryCache(createFunc){
        var that=this, geometries=[], gone=[];
        this.request = function(){
            if(geometries.length){
                geo = geometries.pop();
            } else{
                geo = createFunc();
            }
            scene.add(geo);
            gone.push(geo);
            return geo;
        };

        this.restart = function(){
            while(gone.length){
                geometries.push(gone.pop());
            }
        };

        this.hideCached = function(){
            for(var i=0; i<geometries.length; i++){
                scene.remove(geometries[i]);
            }
        };
    }
};
CANNON.Mechanics.prototype = new CANNON.EventTarget();
CANNON.Mechanics.constructor = CANNON.Mechanics;

CANNON.Mechanics.prototype.setGlobalSpookParams = function(k,d,h){
    var world = this.world;

    // Set for all constraints
    for(var i=0; i<world.constraints.length; i++){
        var c = world.constraints[i];
        for(var j=0; j<c.equations.length; j++){
            var eq = c.equations[j];
            eq.setSpookParams(k,d,h);
        }
    }

    // Set for all contact materals
    for(var i=0; i<world.contactmaterials.length; i++){
        var cm = world.contactmaterials[i];
        cm.contactEquationStiffness = k;
        cm.frictionEquationStiffness = k;
        cm.contactEquationRelaxation = d;
        cm.frictionEquationRelaxation = d;
    }

    world.defaultContactMaterial.contactEquationStiffness = k;
    world.defaultContactMaterial.frictionEquationStiffness = k;
    world.defaultContactMaterial.contactEquationRelaxation = d;
    world.defaultContactMaterial.frictionEquationRelaxation = d;
};

CANNON.Mechanics.prototype.getWorld = function(){
    return this.world;
};

//Add this Function 
CANNON.Mechanics.prototype.getMeshProperty = function(idnumber){
    return this.visuals[idnumber];
};
//End of the Function

CANNON.Mechanics.prototype.addVisual = function(body, materialdata = this.currentMaterial){
    var s = this.settings;
    // What geometry should be used?
    var mesh;
    if(body instanceof CANNON.Body){
        mesh = this.shape2mesh(body, materialdata);
    }
    if(mesh) {
        // Add body
        this.bodies.push(body);
        this.visuals.push(mesh);
        this.curVisualID += 1;
        body.visualref = mesh;
        body.visualref.visualId = this.bodies.length - 1;
        //mesh.useQuaternion = true;
        this.scene.add(mesh);
        console.log(this.curVisualID);
        return this.curVisualID;
    }
};

CANNON.Mechanics.prototype.addVisuals = function(bodies){
    for (var i = 0; i < bodies.length; i++) {
        this.addVisual(bodies[i]);
    }
};

CANNON.Mechanics.prototype.removeVisual = function(body){
    if(body.visualref){
        var bodies = this.bodies,
            visuals = this.visuals,
            old_b = [],
            old_v = [],
            n = bodies.length;

        for(var i=0; i<n; i++){
            old_b.unshift(bodies.pop());
            old_v.unshift(visuals.pop());
        }

        var id = body.visualref.visualId;
        for(var j=0; j<old_b.length; j++){
            if(j !== id){
                var i = j>id ? j-1 : j;
                bodies[i] = old_b[j];
                visuals[i] = old_v[j];
                bodies[i].visualref = old_b[j].visualref;
                bodies[i].visualref.visualId = i;
            }
        }
        body.visualref.visualId = null;
        this.scene.remove(body.visualref);
        body.visualref = null;
    }
};

CANNON.Mechanics.prototype.removeAllVisuals = function(){
    while(this.bodies.length) {
        this.removeVisual(this.bodies[0]);
    }
};

CANNON.Mechanics.prototype.shape2mesh = function(body, materialdata = this.currentMaterial){
    var wireframe = this.settings.renderMode === "wireframe";
    var obj = new THREE.Object3D();

    for (var l = 0; l < body.shapes.length; l++) {
        var shape = body.shapes[l];

        var mesh;

        let materialtype = materialdata;

        switch(shape.type){

        case CANNON.Shape.types.SPHERE:
            var sphere_geometry = new THREE.SphereGeometry( shape.radius, 8, 8);
            mesh = new THREE.Mesh( sphere_geometry, materialtype );
            break;

        case CANNON.Shape.types.PARTICLE:
            mesh = new THREE.Mesh( this.particleGeo, this.particleMaterial );
            var s = this.settings;
            mesh.scale.set(s.particleSize,s.particleSize,s.particleSize);
            break;

        case CANNON.Shape.types.PLANE:
            var geometry = new THREE.PlaneGeometry(10, 10, 4, 4);
            mesh = new THREE.Object3D();
            var submesh = new THREE.Object3D();
            var ground = new THREE.Mesh( geometry, materialtype );
            ground.scale.set(100, 100, 100);
            submesh.add(ground);

            ground.castShadow = true;
            ground.receiveShadow = true;

            mesh.add(submesh);
            break;

        case CANNON.Shape.types.BOX:
            var box_geometry = new THREE.BoxGeometry(  shape.halfExtents.x*2,
                                                        shape.halfExtents.y*2,
                                                        shape.halfExtents.z*2 );
            mesh = new THREE.Mesh( box_geometry, materialtype );
            break;

        case CANNON.Shape.types.CONVEXPOLYHEDRON:
            var geo = new THREE.Geometry();

            // Add vertices
            for (var i = 0; i < shape.vertices.length; i++) {
                var v = shape.vertices[i];
                geo.vertices.push(new THREE.Vector3(v.x, v.y, v.z));
            }

            for(var i=0; i < shape.faces.length; i++){
                var face = shape.faces[i];

                // add triangles
                var a = face[0];
                for (var j = 1; j < face.length - 1; j++) {
                    var b = face[j];
                    var c = face[j + 1];
                    geo.faces.push(new THREE.Face3(a, b, c));
                }
            }
            geo.computeBoundingSphere();
            geo.computeFaceNormals();
            mesh = new THREE.Mesh( geo, materialtype );
            break;

        case CANNON.Shape.types.HEIGHTFIELD:
            var geometry = new THREE.Geometry();

            var v0 = new CANNON.Vec3();
            var v1 = new CANNON.Vec3();
            var v2 = new CANNON.Vec3();
            for (var xi = 0; xi < shape.data.length - 1; xi++) {
                for (var yi = 0; yi < shape.data[xi].length - 1; yi++) {
                    for (var k = 0; k < 2; k++) {
                        shape.getConvexTrianglePillar(xi, yi, k===0);
                        v0.copy(shape.pillarConvex.vertices[0]);
                        v1.copy(shape.pillarConvex.vertices[1]);
                        v2.copy(shape.pillarConvex.vertices[2]);
                        v0.vadd(shape.pillarOffset, v0);
                        v1.vadd(shape.pillarOffset, v1);
                        v2.vadd(shape.pillarOffset, v2);
                        geometry.vertices.push(
                            new THREE.Vector3(v0.x, v0.y, v0.z),
                            new THREE.Vector3(v1.x, v1.y, v1.z),
                            new THREE.Vector3(v2.x, v2.y, v2.z)
                        );
                        var i = geometry.vertices.length - 3;
                        geometry.faces.push(new THREE.Face3(i, i+1, i+2));
                    }
                }
            }
            geometry.computeBoundingSphere();
            geometry.computeFaceNormals();
            mesh = new THREE.Mesh(geometry, materialtype);
            break;

        case CANNON.Shape.types.TRIMESH:
            var geometry = new THREE.Geometry();

            var v0 = new CANNON.Vec3();
            var v1 = new CANNON.Vec3();
            var v2 = new CANNON.Vec3();
            for (var i = 0; i < shape.indices.length / 3; i++) {
                shape.getTriangleVertices(i, v0, v1, v2);
                geometry.vertices.push(
                    new THREE.Vector3(v0.x, v0.y, v0.z),
                    new THREE.Vector3(v1.x, v1.y, v1.z),
                    new THREE.Vector3(v2.x, v2.y, v2.z)
                );
                var j = geometry.vertices.length - 3;
                geometry.faces.push(new THREE.Face3(j, j+1, j+2));
            }
            geometry.computeBoundingSphere();
            geometry.computeFaceNormals();
            mesh = new THREE.Mesh(geometry, materialtype);
            break;

        default:
            throw "Visual type not recognized: "+shape.type;
        }

        mesh.receiveShadow = true;
        mesh.castShadow = true;
        if(mesh.children){
            for(var i=0; i<mesh.children.length; i++){
                mesh.children[i].castShadow = true;
                mesh.children[i].receiveShadow = true;
                if(mesh.children[i]){
                    for(var j=0; j<mesh.children[i].length; j++){
                        mesh.children[i].children[j].castShadow = true;
                        mesh.children[i].children[j].receiveShadow = true;
                    }
                }
            }
        }

        var o = body.shapeOffsets[l];
        var q = body.shapeOrientations[l];
        mesh.position.set(o.x, o.y, o.z);
        mesh.quaternion.set(q.x, q.y, q.z, q.w);

        obj.add(mesh);
    }

    return obj;
};
