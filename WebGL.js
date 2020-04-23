let time = 0.0;
let pos = [0., 0.];
let zoom = 100000.;
let deltaPos = [0., 0.];
function initShaderProgram(gl, vsSource, fsSource) { // Initialize shaders from sources
  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

  const shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
    return null;
  }

  return shaderProgram;
}

function loadShader(gl, type, source) { // Compile shader
  const shader = gl.createShader(type);

  gl.shaderSource(shader, source);

  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

function initBuffers(gl) { // Initialize all buffers
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  const positions = [ // Two triangles vertices
    -1.0, 1.0,
     1.0, 1.0,
    -1.0, -1.0,
     1.0, -1.0];

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
  return {
    position: positionBuffer,
  };
}

 function resize(canvas) { // Resize canvas for adaptive page 
    var displayWidth  = canvas.clientWidth;
    var displayHeight = canvas.clientHeight;

    if (canvas.width  !== displayWidth || canvas.height !== displayHeight) {
      canvas.width  = displayWidth;
      canvas.height = displayHeight;
    };
  }

  function getMousePos(canvas, evt) { // Get current mouse position inside canvas
    var rect = canvas.getBoundingClientRect();
    return {
      x: evt.clientX - rect.left,
      y: evt.clientY - rect.top
    };
  }

function drawScene(gl, programInfo, buffers, deltaTime) { // Main draw function
  gl.clearColor(0.0, 0.0, 0.0, 1.0); 
  gl.clearDepth(1.0);                
  gl.enable(gl.DEPTH_TEST);          
  gl.depthFunc(gl.LEQUAL);            
  resize(gl.canvas);
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  time += deltaTime; // Update time 
  pos = [pos[0] + deltaPos[0], pos[1] + deltaPos[1]]; // Update camera position

  { // Adding two triangles to buffer in order to draw in fragment shader over them
    const numComponents = 2;  
    const type = gl.FLOAT;    
    const normalize = false;  
    const stride = 0;                                 
    const offset = 0;        
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
    gl.vertexAttribPointer(programInfo.attribLocations.vertexPosition, numComponents, type, normalize, stride, offset); 
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);
  }

  gl.useProgram(programInfo.program);

  gl.uniform1f(programInfo.uniformLocations.zoom, Math.abs(zoom % 1.4) + 0.5); console.log(Math.abs(zoom % 1.4) + 0.55); // Update zoom uniform
  gl.uniform2fv(programInfo.uniformLocations.cameraPosition, pos); // Update camera position uniform
  gl.uniform2fv(programInfo.uniformLocations.resolution, [gl.canvas.clientWidth,gl.canvas.clientHeight]); // Pass current canvas resolution in uniform

  { // Draw triangles
    const offset = 0;
    const vertexCount = 4;
    gl.drawArrays(gl.TRIANGLE_STRIP, offset, vertexCount);
  }
}

function handleMouse(canv) {// Obtain mouse position and check for mouse pressed
  var start = {x: 0., y: 0.};
  var isPressed = false;
  var cuMousePos = {x: 0., y: 0.};
  const c = 0.00006;

  canv.addEventListener('mousedown', function(event) {
    start = getMousePos(canv, event);
    isPressed = true;
  }, false);
  canv.addEventListener('mousemove', function(event) {
    if (isPressed) {
      cuMousePos = getMousePos(canv, event);
      deltaPos = [(cuMousePos.x-start.x)*-c,(cuMousePos.y-start.y)*c];
    }
  }, false);
  canv.addEventListener('mouseup', function(event) {
    isPressed = false;
    deltaPos = [0.,0.];
  }, false);
  canv.addEventListener('wheel', function(event) {
    event.preventDefault();
    zoom += event.deltaY*0.001;
  });
}

function main() {
  const canvas = document.querySelector('#glCanvas');
  const gl = canvas.getContext('webgl');
  if (gl === null) {
    alert('Sorry, no fun today!');
    return;
  }
  
  // Vertex shader GLSL code
  const vsSource = `
    attribute vec4 aVertexPosition;

    void main() {
      gl_Position = aVertexPosition;
    }
  `;
  
  // Fragment shader GLSL code
  const fsSource = `
precision highp float;
uniform vec2 cameraPosition;
uniform vec2 resolution;
uniform float zoom;

void main() {
  // Convert pixel coordinates to normal space coordinates
  vec2 co = gl_FragCoord.xy/resolution*2.0 - 1.0;
  co.y *= resolution.y/resolution.x;

  float eps_x = 2./resolution.x; // Precision for X axe
  float eps_y = (2.001*resolution.y)/(resolution.x*resolution.y); // Precision for Y axe
  vec3 gridColor = vec3(0.8);
  vec3 backgroundColor = vec3(0.3);
  vec2 cuCoord = co + cameraPosition;
  vec3 color = vec3(0.3);

  if (mod(cuCoord.x, zoom*1./20.) <= eps_x || mod(cuCoord.y, zoom*1./20.) <= eps_y)  // Draw grid
    color = gridColor;
  else color = backgroundColor;

  if (cuCoord.y >= -eps_y && cuCoord.y <= eps_y) // Draw axes
    color = vec3(0.9,0.,0.); 
  if (cuCoord.x >= -eps_x && cuCoord.x <= eps_x) 
    color = vec3(0.,0.9,0.);
  gl_FragColor = vec4(color,1.0);
}`; 

  const shaderProgram = initShaderProgram(gl, vsSource, fsSource);
  const programInfo = {
    program: shaderProgram,
    attribLocations: {
      vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
    },
    uniformLocations: {
      zoom: gl.getUniformLocation(shaderProgram, 'zoom'),
      cameraPosition: gl.getUniformLocation(shaderProgram, 'cameraPosition'),
      resolution: gl.getUniformLocation(shaderProgram, 'resolution'),
    },
  };
  
  const buffers = initBuffers(gl);
  
  handleMouse(canvas);

  function render(now) { // Animate frames
    now *= 0.001;
    const deltaTime = now - time;
    time = now;

    drawScene(gl, programInfo, buffers, deltaTime);
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

window.onload = main;