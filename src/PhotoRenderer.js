import * as THREE from 'three';
import TouchTexture from "./Texture";

function imageExists(url) {
    const img = new Image();
    img.onload = () => console.log(`Image exists and loaded: ${url}, size: ${img.width}x${img.height}`);
    img.onerror = () => console.error(`Image failed to load: ${url}`);
    img.src = url;
  }

const fragmentShader = `
        precision highp float;
        
        uniform sampler2D uTexture;
        
        varying vec2 vPUv;
        varying vec2 vUv;
        
        void main() {
          vec4 color = vec4(0.0);
          vec2 uv = vUv;
          vec2 puv = vPUv;
        
          // pixel color
          vec4 colA = texture2D(uTexture, puv);
        
          // greyscale
          float grey = colA.r * 0.21 + colA.g * 0.71 + colA.b * 0.07;
          vec4 colB = vec4(grey, grey, grey, 1.0);
        
          // circle
          float border = 0.3;
          float radius = 0.5;
          float dist = radius - distance(uv, vec2(0.5));
          float t = smoothstep(0.0, border, dist);
        
          // final color
          color = colB;
          color.a = t;
        
          gl_FragColor = color;
        }
        `;

const vertexShader =`
        // @author brunoimbrizi / http://brunoimbrizi.com
        
        precision highp float;
        
        attribute float pindex;
        attribute vec3 position;
        attribute vec3 offset;
        attribute vec2 uv;
        attribute float angle;
        
        uniform mat4 modelViewMatrix;
        uniform mat4 projectionMatrix;
        
        uniform float uTime;
        uniform float uRandom;
        uniform float uDepth;
        uniform float uSize;
        uniform vec2 uTextureSize;
        uniform sampler2D uTexture;
        uniform sampler2D uTouch;
        
        varying vec2 vPUv;
        varying vec2 vUv;
        
        // With this implementation:
        vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
        
        float snoise2(vec2 v) {
          const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                   -0.577350269189626, 0.024390243902439);
          vec2 i  = floor(v + dot(v, C.yy));
          vec2 x0 = v -   i + dot(i, C.xx);
          vec2 i1;
          i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
          vec4 x12 = x0.xyxy + C.xxzz;
          x12.xy -= i1;
          i = mod(i, 289.0);
          vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
          + i.x + vec3(0.0, i1.x, 1.0 ));
          vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
            dot(x12.zw,x12.zw)), 0.0);
          m = m*m;
          m = m*m;
          vec3 x = 2.0 * fract(p * C.www) - 1.0;
          vec3 h = abs(x) - 0.5;
          vec3 ox = floor(x + 0.5);
          vec3 a0 = x - ox;
          m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
          vec3 g;
          g.x  = a0.x  * x0.x  + h.x  * x0.y;
          g.yz = a0.yz * x12.xz + h.yz * x12.yw;
          return 130.0 * dot(m, g);
        }
        
        float random(float n) {
          return fract(sin(n) * 43758.5453123);
        }
        
        void main() {
          vUv = uv;
        
          // particle uv
          vec2 puv = offset.xy / uTextureSize;
          vPUv = puv;
        
          // pixel color
          vec4 colA = texture2D(uTexture, puv);
          float grey = colA.r * 0.21 + colA.g * 0.71 + colA.b * 0.07;
        
          // displacement
          vec3 displaced = offset;
          // randomise
          displaced.xy += vec2(random(pindex) - 0.5, random(offset.x + pindex) - 0.5) * uRandom;
          float rndz = (random(pindex) + snoise2(vec2(pindex * 0.1, uTime * 0.1)));
          displaced.z += rndz * (random(pindex) * 2.0 * uDepth);
          // center
          displaced.xy -= uTextureSize * 0.5;
        
          // touch
          float t = texture2D(uTouch, puv).r;
          displaced.z += t * 20.0 * rndz;
          displaced.x += cos(angle) * t * 20.0 * rndz;
          displaced.y += sin(angle) * t * 20.0 * rndz;
        
          // particle size
          float psize = (snoise2(vec2(uTime, pindex) * 0.5) + 2.0);
          psize *= max(grey, 0.2);
          psize *= uSize;
        
          // final position
          vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
          mvPosition.xyz += position * psize;
          vec4 finalPosition = projectionMatrix * mvPosition;
        
          gl_Position = finalPosition;
        }
        `;

class PhotoRenderer {
    constructor() {
        this.container = new THREE.Object3D();
        this.clock = new THREE.Clock();
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.textureLoaded = false;
        this.dimensions = { width: 0, height: 0 };
        this.initialized = false;
    }
    
    init(mountelement, file="/image.png", skip=true, step=5, threshold=34,) {
        if (this.initialized) {
            console.warn("PhotoRenderer already initialized, skipping");
            return;
          }
          
        imageExists(file);
        this.mount = mountelement;
        if (!this.mount) {
            console.error("No mount element provided");
            return;
        } else if (this.mount.querySelector('canvas')) {
            console.warn("Canvas already exists in mount element, cleaning up first");
            this.dispose(); 
        }
        const textureLoader = new THREE.TextureLoader();
        
        // Load image
        textureLoader.load(
            // URL of the image - ensure this path is correct
            file, 
            (texture) => {
                this.texture = texture;
                this.texture.minFilter = THREE.LinearFilter;
                this.texture.magFilter = THREE.LinearFilter;
                this.texture.format = THREE.RGBAFormat;
                this.texture.generateMipmaps = false; // Disable mipmap generation

                if (texture.image) {
                    this.width = texture.image.width;
                    this.height = texture.image.height;
                    if (this.width <= 0 || this.height <= 0) {
                        console.error("Invalid texture dimensions:", this.width, this.height);
                        return;
                    } else console.log("Texture dimensions:", this.width, this.height);

                    this.initScene();
                    this.initPoints(skip, step, threshold);
                    this.initHitArea();
                    this.initTouch();
                    window.addEventListener('mousemove', this.handleMouseMove);
                    window.addEventListener('resize', this.handleResize);

                    this.textureLoaded = true;
                    this.initialized = true;
                        
                    this.handleResize();
                    this.animate();
                } else {
                    console.warn("photorenderer: init: no image");
                }
            },
            (progress) => {
                console.log("Texture loading progress:", progress);
            },
            (error) => {
                console.error("Error loading texture:", error, file);
            }
        );
    }
    
    initScene(){
        this.scene = new THREE.Scene();
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true});
        this.camera = new THREE.PerspectiveCamera(45, this.width / this.height, 0.1, 1000);
        
        this.camera.position.z = this.width / this.height * 450;

        this.camera.lookAt(0, 0, 0);

        this.renderer.setSize(this.width, this.height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.mount.appendChild(this.renderer.domElement);

        this.scene.add(this.container);        
    }

    initPoints(skip, skipFactor, threshold) {
        if (!this.texture || !this.texture.image) {
            console.error("Texture not loaded properly for initPoints");
            return;
        }

        this.numPoints = this.width * this.height;
		let numVisible = 0;

		const img = this.texture.image;
		const canvas = document.createElement('canvas'); 
		const ctx = canvas.getContext('2d');
        if (!ctx) {
            console.error("Could not get canvas context for pixel data extraction");
            return;
        }

		canvas.width = this.width;
		canvas.height = this.height;
		ctx.scale(1, -1);
		ctx.drawImage(img, 0, 0, this.width, this.height * -1);

		const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
		let originalColors = Float32Array.from(imgData.data);

        for (let i = 0; i < this.numPoints; i++) {
            if ((skip) && (i % skipFactor !== 0)) continue;
            
            const r = originalColors[i * 4 + 0];
            const g = originalColors[i * 4 + 1];
            const b = originalColors[i * 4 + 2];
            const brightness = (r + g + b) / 3;
            
            if (brightness > threshold) numVisible++;
        }
        console.log(numVisible);

        const uniforms = {
            uTime: { value: 0 },
            uRandom: { value: 2.0 },
            uDepth: { value: 4.0 }, // changes the Z value. Increases the 3D Effect.
            uSize: { value: 1.5 }, // size of pixels
            uTextureSize: { value: new THREE.Vector2(this.width, this.height) },
            uTexture: { value: this.texture },
            uTouch: { value: null }
        };
        this.uniforms = uniforms;

        
        const material = new THREE.RawShaderMaterial({
            uniforms,
            vertexShader,
            fragmentShader,
            depthTest: false,
            transparent: true
        });

        const geometry = new THREE.InstancedBufferGeometry();
		const positions = new THREE.BufferAttribute(new Float32Array([
            -0.5, 0.5, 0.0,
            0.5, 0.5, 0.0,
            -0.5, -0.5, 0.0,
            0.5, -0.5, 0.0
            ]), 3);
        geometry.setAttribute('position', positions);
        const uvs = new THREE.BufferAttribute(new Float32Array([
            0.0, 0.0,
            1.0, 0.0,
            0.0, 1.0,
            1.0, 1.0
            ]), 2);
        geometry.setAttribute('uv', uvs);

		// index
		geometry.setIndex(new THREE.BufferAttribute(new Uint16Array([ 0, 2, 1, 2, 3, 1 ]), 1));

		const indices = new Uint16Array(numVisible);
		const offsets = new Float32Array(numVisible * 3);
		const angles = new Float32Array(numVisible);

        let j = 0;
        for (let i = 0; i < this.numPoints; i++) {
            if ((skip) && (i % skipFactor !== 0)) continue;
            const r = originalColors[i * 4 + 0];
            const g = originalColors[i * 4 + 1];
            const b = originalColors[i * 4 + 2];
            const brightness = (r + g + b) / 3;
            if (brightness <= threshold) continue;
            
            offsets[j * 3 + 0] = i % this.width;
            offsets[j * 3 + 1] = Math.floor(i / this.width);
            offsets[j * 3 + 2] = 0;
            
            indices[j] = i;
            angles[j] = Math.random() * Math.PI;
            j++;
        }

            
        // Add instance attributes to geometry
        geometry.setAttribute('offset', new THREE.InstancedBufferAttribute(offsets, 3));
        geometry.setAttribute('pindex', new THREE.InstancedBufferAttribute(indices, 1));
        geometry.setAttribute('angle', new THREE.InstancedBufferAttribute(angles, 1));
        
        this.object3D = new THREE.Mesh(geometry, material);
		this.container.add(this.object3D);
    }
    
    initHitArea() {
        const geometry = new THREE.PlaneGeometry(this.width, this.height, 1, 1);
		const material = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, wireframe: true, depthTest: false });
		material.visible = false;
		this.hitArea = new THREE.Mesh(geometry, material);
		this.container.add(this.hitArea);
    };

    initTouch() {
		if (!this.touch) this.touch = new TouchTexture(64);
        if (this.object3D && this.object3D.material && this.object3D.material.uniforms) {
            this.object3D.material.uniforms.uTouch.value = this.touch.texture;
        } else {
            console.log("stuff not loaded yet");
        }
	};
    
    /// Handle mouse movement for raycasting
    handleMouseMove = (e) => {
        // Calculate normalized device coordinates (-1 to +1)
        this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        
        // Update touch texture with mouse position
        if (this.touch && this.hitArea && this.camera) {
            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersects = this.raycaster.intersectObject(this.hitArea);
            
            if (intersects.length > 0) {
                const uv = intersects[0].uv;
                this.touch.addTouch(uv.x, uv.y);
            }
        }
    };

    handleResize = () => {
        if (!this.initialized) {
            console.warn("handleresize(): this.initialized is false")
            return;
        }

        const width = window.innerWidth;
        const height = window.innerHeight;
        if (this.camera) {
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
        } else {
            console.warn("this.handleResize(): no camera");
        }
        
        if (this.renderer) {
            this.renderer.setSize(width, height);
        } else {
            console.warn("this.handleResize(): no renderer");
        }
    };

    animateold = () => {
        this.animation = requestAnimationFrame(this.animate);
        
        const delta = this.clock.getDelta();
        
        if (this.uniforms) {
            this.uniforms.uTime.value += delta;
        }
        
        if (this.touch) {
            this.touch.update();
        }
        
        this.renderer.render(this.scene, this.camera);
    };

    animate = () => {
        if (!this.initialized) {
            this.animation = requestAnimationFrame(this.animate);
            console.log("animate(): this,initialized is false")
            return;
        } 
        try {
            if (this.isDisposed) {
                console.log("this.animate(): this.isDisposed is true")
                return;
            }

            this.animation = requestAnimationFrame(this.animate);
                        
            // Update uniforms safely
            if (this.object3D && this.object3D.material && this.object3D.material.uniforms) {
                this.object3D.material.uniforms.uTime.value += this.clock.getDelta();
            } else {
                console.log("animate(): no this.object3D")
            }
            
            // Update touch texture
            if (this.touch && typeof this.touch.update === 'function') {
                this.touch.update();
            } else {
                console.log("animate(): no this.touch")
            }
            
            // Render scene
            if (this.renderer && this.scene && this.camera) {
                this.renderer.render(this.scene, this.camera);
            } else {
                console.log("animate(): no render")
            }
        } catch (error) {
                console.error("Error in animation loop:", error);
                cancelAnimationFrame(this.animation);
            }
        };
    
    dispose() {
        console.log("dispose()ing")
        
        if (this.animation) {
            cancelAnimationFrame(this.animation);
        }
        this.animation = null;
        this.isDesposed = true;
        window.removeEventListener('mousemove', this.handleMouseMove);
        window.removeEventListener('resize', this.handleResize);
        
        if (this.mount && this.renderer) {
            this.mount.removeChild(this.renderer.domElement);
        }
        if (this.object3D) {
            this.object3D.geometry.dispose();
            this.object3D.material.dispose();
        }
        if (this.hitArea) {
            this.hitArea.geometry.dispose();
            this.hitArea.material.dispose();
        }
        this.texture = null;
        this.touch = null;
        this.initialized = false;
        this.renderer = null;
    }
}

export default PhotoRenderer;
