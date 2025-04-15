import * as THREE from 'three';

function easeOutSine(time, base, amplitude, period) {
    return amplitude * Math.sin(time / period * (Math.PI / 2)) + base;
}

export default class TouchTexture {
    constructor(size = 64) {
        this.size = 64;
        this.maxAge = 120;
        this.radius = 0.05;
        this.trail = [];
        
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.canvas.height = this.size;
        this.ctx = this.canvas.getContext('2d');
    
        if (!this.ctx) {
            console.error("TouchTexture constructor(): this.ctx is none");
            return;
        }
        this.ctx.fillStyle = 'black';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.texture = new THREE.Texture(this.canvas);
        this.texture.needsUpdate = true;
        this.texture.minFilter = THREE.LinearFilter;
        this.texture.magFilter = THREE.LinearFilter;
        this.texture.format = THREE.RGBAFormat;
        this.texture.generateMipmaps = false;

        this.canvas.id = 'touchTexture';
        
        this.addTouch(0.5, 0.5);
    }
    
    addTouch(x, y) {
        if (!x || !y) {
            console.warn("TouchTexture: AddTouch(): invalid x y", x, y);
            return;
        }
        let force = 0; 
        const last = this.trail[this.trail.length - 1];
        
        if (last) {
            const dx = last.x - x;
            const dy = last.y - y;
            const dd = dx * dx + dy * dy;
            force = Math.min(dd * 10000, 1);
        }
        
        this.trail.push({ x, y, age: 0, force });
    }
    
    update() {
        if (!this.ctx || !this.canvas) {
            console.warn("TouchTexture: update(): Canvas context not available for TouchTexture");
            return;
        }
        this.clear();
        
        this.trail.forEach((point, i) => {
            point.age++;
            if (point.age > this.maxAge) {
                this.trail.splice(i, 1);
            }
        });
            
        this.trail.forEach(point => {
            this.drawTouch(point);
        });
        
        if (this.texture) {
            this.texture.needsUpdate = true;
        } else {
            console.warn("TouchTexture: update(): this.texture is null");
        }
    }
    
    clear() {
        this.ctx.fillStyle = 'black';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    /**
     * Inputs the Raycasted touch based on the point's age and intensity
     * @param {*} point 
     */
    drawTouch(point) {
        if (!point || !isFinite(point.x) || !isFinite(point.y)) {
            console.warn("TouchTexture: drawTouch(): point");
            return;
        }
        const pos = {
            x: point.x * this.size,
            y: (1 - point.y) * this.size // inverted for whatever reason
        };
        
        let intensity = 0;
        let amplitude = 2;
        if (point.age < this.maxAge * 0.3) {
            intensity = easeOutSine(point.age / (this.maxAge * 0.3), 0, amplitude, 1) * point.force;
        } else {
            intensity = easeOutSine(1 - (point.age - this.maxAge * 0.3) / (this.maxAge * 0.7), 0, amplitude, 1) * point.force;
        }
        // ensure radius is a positive, finite number
        const radius = Math.max(0.1, this.size * this.radius * Math.abs(intensity) || 0.1);
        
        // check if all values are valid before creating gradient
        if (isFinite(pos.x) && isFinite(pos.y) && isFinite(radius)) {
            const grd = this.ctx.createRadialGradient(pos.x, pos.y, radius * 0.25, pos.x, pos.y, radius);
            grd.addColorStop(0, `rgba(255, 255, 255, 0.2)`);
            grd.addColorStop(1, 'rgba(0, 0, 0, 0.0)');

            this.ctx.beginPath();
            this.ctx.fillStyle = grd;
            this.ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
            this.ctx.fill();
        } else console.warn("TouchTexture: update(): point or radius");
    }
}