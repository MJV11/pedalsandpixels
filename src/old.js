const setupScene = (texture) => {
    if (rendererRef.current && mountRef.current) {
        mountRef.current.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
        rendererRef.current = null;
    }
    const width = texture.image.width;
    const height = texture.image.height;
    const threshold = 34;  // Brightness threshold for showing particles
    
    // Setup scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    
    // Setup camera
    const camera = new THREE.PerspectiveCamera(
    75, 
    window.innerWidth / window.innerHeight, 
    0.1, 
    1000
    );
    camera.position.z = 300;
    cameraRef.current = camera;
    
    // Setup renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000);
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    
    // Process image data to find visible particles
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(texture.image, 0, 0, width, height);
    const imgData = ctx.getImageData(0, 0, width, height);
    const originalColors = Float32Array.from(imgData.data);        

    
    
    
    // Create and add mesh to scene
    // LEFT OFF HERE
    scene.add(mesh);
    
    // Create invisible plane for raycasting
    // Make it cover the entire visible area
    const aspect = width / height;
    const planeSize = Math.max(width, height);
    const planeGeometry = new THREE.PlaneGeometry(planeSize, planeSize / aspect);
    
    // Material for the plane (invisible)
    const planeMaterial = new THREE.MeshBasicMaterial({ 
    transparent: true,
    opacity: 0
    });
    
    // Create the plane and add to scene
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    scene.add(plane);
    planeRef.current = plane;
    
    // Set up animation
    clockRef.current = new THREE.Clock();
    
        
    // Start animation
    animate();
    
    function animate() {
    animationRef.current = requestAnimationFrame(animate);
    
    // Set raycaster from mouse position
    raycasterRef.current.setFromCamera(mouseRef.current, camera);
    
    // Calculate intersections with the invisible plane
    const intersects = raycasterRef.current.intersectObject(plane);
    
    if (intersects.length > 0) {
        // Get intersection point
        const point = intersects[0].point;
        
        // Convert to uv coordinates (0-1 range)
        // Adjust based on plane size and position
        const touchX = (point.x / planeSize) + 0.5;
        const touchY = (point.y / (planeSize / aspect)) + 0.5;
        
        // Add touch at intersection point
        if (touchTextureRef.current) {
        touchTextureRef.current.addTouch(touchX, touchY);
        touchTextureRef.current.update();
        }
    }
    
    // Update time uniform
    uniformsRef.current.uTime.value = clockRef.current.getElapsedTime();
    
    // Render scene
    renderer.render(scene, camera);
    }
};

///////////////////////////