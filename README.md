# Corin Edwards - Portfolio CV Website

An interactive portfolio website featuring a stunning 3D header with rotating letter shapes spelling "CORIN".

## Features

- **Interactive 3D Header**: Each letter (C, O, R, I, N) is rendered as a rotating 3D shape
- **Shape Variations**: 5+ unique shape variations per letter, randomly selected on page load
- **Responsive Design**: 
  - Desktop: Letters displayed horizontally (C O R I N)
  - Mobile: Letters stacked in rows (CO / RI / N)
- **Custom 3D Models**: Support for loading custom GLTF/GLB 3D models
- **SVG Extrusion**: Convert flat SVG files into 3D extruded shapes

## Tech Stack

- **Vite** - Fast build tool and dev server
- **Three.js** - 3D graphics library
- **Vanilla JavaScript** - No framework bloat

## Getting Started

### Install Dependencies

```bash
npm install
```

### Run Development Server

```bash
npm run dev
```

The site will open automatically in your browser at `http://localhost:5173`

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Project Structure

```
├── src/
│   ├── main.js              # Entry point
│   ├── style.css            # Global styles
│   └── three/
│       ├── scene.js         # Three.js scene setup
│       ├── letterManager.js # Letter creation & management
│       └── shapeFactory.js  # 5+ shape variations per letter
├── index.html               # HTML entry point
├── package.json             # Dependencies
└── vite.config.js           # Vite configuration
```

## Customization

### Adding Custom 3D Models

To use your own 3D models (GLTF/GLB format), use the `loadCustomModel` method in `letterManager.js`:

```javascript
await letterManager.loadCustomModel('C', '/path/to/model.glb')
```

### Creating Shapes from SVG

To extrude SVG files into 3D shapes, use the `createFromSVG` method:

```javascript
const shape = await letterManager.createFromSVG('/path/to/letter.svg')
```

### Adding More Shape Variations

Edit [src/three/shapeFactory.js](src/three/shapeFactory.js) and add new shape creation methods to the corresponding letter array.

## License

MIT
