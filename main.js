/*jshint esversion:8*/
window.onload = function(){
//Audio files
    var mainaudio = document.getElementById('mainaudio');
    var moveforward = document.getElementById('moveforward');
    var moverotate = document.getElementById('rotating');
    var matrie = new THREE.MeshStandardMaterial( { overdraw: true } );
    // var urlto = 'grs.jpg';
    var urlto = 'body.jpg';


    let onLoader = function(texture){
        matrie.map = texture;
        matrie.needsUpdate = true;
    }
    var loader = new THREE.TextureLoader();
    loader.load(urlto, onLoader);
      // set the "color space" of the texture
    matrie.encoding = THREE.sRGBEncoding;

  // reduce blurring at glancing angles
    matrie.anisotropy = 16;

    moveforward.loop = true;
    moverotate.loop = true;
    mainaudio.autoplay = true;
    mainaudio.loop=true;
    mainaudio.volume = 0.1;
    mainaudio.load();

    var mecanis = new CANNON.Mechanics();
    //const loader = new THREE.TextureLoader();
    var mass = 150;
    var vehicle;
    var chassisBody = new CANNON.Body({ mass: mass });
    var cam;
    var indic = false;
    
    mecanis.addScene("car",function(){
        var world = mecanis.getWorld();
        world.broadphase = new CANNON.SAPBroadphase(world);
        world.gravity.set(0, 0, -10);
        world.defaultContactMaterial.friction = 0;

        var groundMaterial = new CANNON.Material("groundMaterial");
        var wheelMaterial = new CANNON.Material("wheelMaterial");
        var wheelGroundContactMaterial = window.wheelGroundContactMaterial = new CANNON.ContactMaterial(wheelMaterial, groundMaterial, {
            friction: 10,
            restitution: 0,
            contactEquationStiffness: 1000
        });

        // We must add the contact materials to the world
        world.addContactMaterial(wheelGroundContactMaterial);

        var chassisShape;
        chassisShape = new CANNON.Box(new CANNON.Vec3(3, 1.5,0.5));
        
        let chassisShape2 = new CANNON.Box(new CANNON.Vec3(1.5, 0.25,0.5));
        let chassisShape3 = new CANNON.Box(new CANNON.Vec3(1.5, 1.5,0.1));
        chassisBody.addShape(chassisShape);
        chassisBody.addShape(chassisShape2,new CANNON.Vec3(-1,-1.25,1));
        chassisBody.addShape(chassisShape2,new CANNON.Vec3(-1,1.25,1));
        chassisBody.addShape(chassisShape3,new CANNON.Vec3(-1,0,1.5));
        chassisBody.position.set(0, 0, 4);
        let outing = mecanis.addVisual(chassisBody, matrie);

        var options = {
            radius: 0.6,
            directionLocal: new CANNON.Vec3(0, 0, -1),
            suspensionStiffness: 30,
            suspensionRestLength: 0.3,
            frictionSlip: 5,
            dampingRelaxation: 2.3,
            dampingCompression: 4.4,
            maxSuspensionForce: 10000,
            rollInfluence:  0.01,
            axleLocal: new CANNON.Vec3(0, 1, 0),
            chassisConnectionPointLocal: new CANNON.Vec3(1, 1, 0),
            maxSuspensionTravel: 0.3,
            customSlidingRotationalSpeed: -30,
            useCustomSlidingRotationalSpeed: true,
            friction:1
        };

        // Create the vehicle
        vehicle = new CANNON.RaycastVehicle({
            chassisBody: chassisBody,
        });
        
        options.chassisConnectionPointLocal.set(2, 1.5, 0);
        vehicle.addWheel(options);

        options.chassisConnectionPointLocal.set(2, -1.5, 0);
        vehicle.addWheel(options);

        options.chassisConnectionPointLocal.set(-2, 1.5, 0);
        vehicle.addWheel(options);

        options.chassisConnectionPointLocal.set(-2, -1.5, 0);
        vehicle.addWheel(options);

        vehicle.addToWorld(world);

        var wheelBodies = [];
        for(var i=0; i<vehicle.wheelInfos.length; i++){
            var wheel = vehicle.wheelInfos[i];
            var cylinderShape = new CANNON.Cylinder(wheel.radius, wheel.radius, 0.5, 40);
            var wheelBody = new CANNON.Body({ mass: 1 });
            var q = new CANNON.Quaternion();
            q.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2);
            wheelBody.addShape(cylinderShape, new CANNON.Vec3(), q);
            wheelBodies.push(wheelBody);
            mecanis.addVisual(wheelBody,new THREE.MeshPhongMaterial( { color: 0xDDDDDD } ));
        }
        world.addEventListener('postStep', function(){
            for (var i = 0; i < vehicle.wheelInfos.length; i++) {
                vehicle.updateWheelTransform(i);
                var t = vehicle.wheelInfos[i].worldTransform;
                wheelBodies[i].position.copy(t.position);
                wheelBodies[i].quaternion.copy(t.quaternion);
            }
        });

        var matrix = [];
        var sizeX = 256,
            sizeY = 256;
/*
        for (var i = 0; i < sizeX; i++) {
            matrix.push([]);
            for (var j = 0; j < sizeY; j++) {
                  var  height = 3;
                  matrix[i].push(height);
            }
        }
        for(let onto=0;onto<sizeX;onto++)
          {
              matrix[0][onto]= 10;
              matrix[sizeX-1][onto]= 10;
              matrix[onto][0]= 10;
              matrix[onto][sizeX-1]= 10;

          }
        
        var theGroundShape = new CANNON.Heightfield(matrix, {
            elementSize: 100 / sizeX
        });
        */
//////////////////////////Start Here For Whole Static Ground Objects
       texture_loader= new THREE.TextureLoader();
      //Shapes For All Static Objects
       var theGroundShape = new CANNON.Box(new CANNON.Vec3(sizeX, sizeY,0.5));
       var theWallShapeY = new CANNON.Box(new CANNON.Vec3(1, 256,10));
       var theWallShapeX = new CANNON.Box(new CANNON.Vec3(256, 1,10));
       var towering = new CANNON.Box(new CANNON.Vec3(10, 10, 10));
        
       //Start Ground Bodies
       var theGroundBody = new CANNON.Body({ mass: 0 });
        //Add Ground
        theGroundBody.addShape(theGroundShape);
        //Add Wall
        theGroundBody.addShape(theWallShapeY,new CANNON.Vec3(256,0,5));
        theGroundBody.addShape(theWallShapeY,new CANNON.Vec3(-256,0,5));
        theGroundBody.addShape(theWallShapeX,new CANNON.Vec3(0,256,5));
        theGroundBody.addShape(theWallShapeX,new CANNON.Vec3(0,-256,5));
        //Add Ramp
        theGroundBody.addShape(towering,new CANNON.Vec3(-50,-50,0.25),new CANNON.Quaternion(0.3826834, 0, 0, 0.9238795));
        theGroundBody.position.set(0, 0, -1);
        world.add(theGroundBody);
        mecanis.addVisual(theGroundBody,new THREE.MeshStandardMaterial({map:texture_loader.load('brick.jpg')}));
//////////////////////////End Here

        //Auto Generate objects randomly
        let limiter = 1;
        var theShape = new CANNON.Box(new CANNON.Vec3(1,1,1));
        for(let iterating = 0;iterating < limiter; iterating++){
            setInterval(function(){
                let theBody = new CANNON.Body({ mass: 150, friction:1 });
                theBody.addShape(theShape);
                theBody.position.set((Math.random()-0.5)*128,(Math.random()-0.5)*128,(Math.random()-0.5)*10);
                world.addBody(theBody);
                mecanis.addVisual(theBody,  new THREE.MeshStandardMaterial({map:texture_loader.load('obj-body.jpg')}));
            },3000);
        }
        mecanis.enableFol(0);
        /*
        //Add Physical Object to the game
        var theShape = new CANNON.Box(new CANNON.Vec3(3,3,3));
        var theBody = new CANNON.Body({ mass: 150 });
        theBody.addShape(theShape);
        theBody.position.set(10,10,30);
        world.addBody(theBody);
        mecanis.addVisual(theBody);
        */



        
      //Add These Lines
      //Change Materials for wall
       mecanis.getMeshProperty(5).children[1].material = new THREE.MeshStandardMaterial({color:0xFFFFFF});
       mecanis.getMeshProperty(5).children[2].material = new THREE.MeshStandardMaterial({color:0xFFFFFF});
       mecanis.getMeshProperty(5).children[3].material = new THREE.MeshStandardMaterial({color:0xFFFFFF});
       mecanis.getMeshProperty(5).children[4].material = new THREE.MeshStandardMaterial({color:0xFFFFFF});
       //End of Lines
        


    });
    
    mecanis.start();
    cam = mecanis.getCam();
    console.log(cam.getWorldDirection());


    document.onkeydown = handler;
    document.onkeyup = handler;

    var maxSteerVal = 0.5;
    var maxForce = 1000;
    var brakeForce = 1000000;
    function handler(event){
        var up = (event.type == 'keyup');

        if(!up && event.type !== 'keydown'){
            return;
        }

        vehicle.setBrake(0, 0);
        vehicle.setBrake(0, 1);
        vehicle.setBrake(0, 2);
        vehicle.setBrake(0, 3);

        switch(event.keyCode){

        case 38:
        case 87: // forward
              mecanis.switchforwardfollowcamera(true);
              vehicle.applyEngineForce(up ? 0 : -maxForce, 2);
              vehicle.applyEngineForce(up ? 0 : -maxForce, 3);

              break;

        case 40: 
        case 83: // backward
              mecanis.switchbackwardfollowcamera(true);
              vehicle.applyEngineForce(up ? 0 : maxForce, 2);
              vehicle.applyEngineForce(up ? 0 : maxForce, 3);
              break;

        case 32: // brake
              mecanis.switchforwardfollowcamera(true);
              vehicle.setBrake(brakeForce, 0);
              vehicle.setBrake(brakeForce, 1);
              vehicle.setBrake(brakeForce, 2);
              vehicle.setBrake(brakeForce, 3);
              break;

        case 39:
        case 68: // right
            vehicle.setSteeringValue(up ? 0 : -maxSteerVal, 0);
            vehicle.setSteeringValue(up ? 0 : -maxSteerVal, 1);
            break;

        case 37:
        case 65: // left
            vehicle.setSteeringValue(up ? 0 : maxSteerVal, 0);
            vehicle.setSteeringValue(up ? 0 : maxSteerVal, 1);
            break;
          case 72:
              chassisBody.position.z=10;
              chassisBody.angularVelocity.set(0.5,0,0);
              break;
      case 81:
          mecanis.togglingcamera();
          break;
      case 69:
          mecanis.togglingcameraback();
          break;
      }

    }
    

    document.addEventListener('keydown', function(e) {
      if (e.keyCode == 87 || e.keyCode == 38) {
        moveforward.volume = 0.4;
        moveforward.play();
      }
      if (e.keyCode == 83 || e.keyCode == 40) {
        moveforward.volume = 0.1;
        moveforward.play();
      }
      if (e.keyCode == 39 || e.keyCode == 68) {
        moverotate.volume = 0.2;
        moverotate.play();
      }
      if (e.keyCode == 37 || e.keyCode == 65) {
        moverotate.volume = 0.2;
        moverotate.play();
      }
    });
    document.addEventListener('keyup', function(e) {
      if (e.keyCode == 87 || e.keyCode == 38) {
        moveforward.pause();
        moveforward.currentTime = 0;
      }
      if (e.keyCode == 83 || e.keyCode == 40) {
        moveforward.pause();
        moveforward.currentTime = 0;
      }
      if (e.keyCode == 39 || e.keyCode == 68) {
        moverotate.pause();
        moverotate.currentTime = 0;
      }
      if (e.keyCode == 37 || e.keyCode == 65) {
        moverotate.pause();
        moverotate.currentTime = 0;
      }
    });
   

      
} 