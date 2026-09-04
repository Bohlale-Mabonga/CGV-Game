import * as THREE from 'three';

export function createTextTexture(text, options = {}) {
    const canvas = document.createElement('canvas');
    canvas.width = options.width || 512;
    canvas.height = options.height || 128;

    const context = canvas.getContext('2d');

    context.fillStyle = options.background || '#101820';
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.strokeStyle = options.border || '#37c8ff';
    context.lineWidth = 8;
    context.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);

    context.fillStyle = options.color || '#ffffff';
    context.font = `bold ${options.fontSize || 42}px Arial`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    context.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    return texture;
}

export function createSign(text, position, rotationY = 0, options = {}) {
    const texture = createTextTexture(text, options);

    const material = new THREE.MeshBasicMaterial({
        map: texture
    });

    const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(
            options.widthWorld || 1.8,
            options.heightWorld || 0.45
        ),
        material
    );

    sign.position.copy(position);
    sign.rotation.y = rotationY;

    sign.userData.setText = (newText, newOptions = {}) => {
        const nextTexture = createTextTexture(newText, {
            ...options,
            ...newOptions
        });

        sign.material.map.dispose();
        sign.material.map = nextTexture;
        sign.material.needsUpdate = true;
    };

    return sign;
}