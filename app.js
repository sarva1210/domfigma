const canvas = document.getElementById("canvas");
const appRoot = document.getElementById("appRoot");
const viewport = document.getElementById("viewport");
const modeLabel = document.getElementById("mode-label");

// toggle panel
const toggleLeftBtn = document.getElementById("toggle-left");
const toggleRightBtn = document.getElementById("toggle-right");

// guide & marquee
const guideV = document.getElementById("guide-v");
const guideH = document.getElementById("guide-h");
const marquee = document.getElementById("marquee");

// left panel
const shapeSelect = document.getElementById("shape-select");
const ahapeToolBtn = document.getElementById("shape-tool-btn");
const addTextBtn = document.getElementById("add-text-btn");
const snapToggle = document.getElementById("snap-toggle");

// zoom ctrl
const zoomLabel = document.getElementById("zoom-label");
const zoomInBtn = document.getElementById("zoom-in");
const zoomOutBtn = document.getElementById("zoom-out");
const resetViewBtn = document.getElementById("reset-view");

// save/dlt/load/rename/select btns
const designNameInput = document.getElementById("design-name");
const designList = document.getElementById("design-list");
const renameBtn = document.getElementById("rename-btn");
const deleteSaveBtn = document.getElementById("delete-save-btn");
const saveBtn = document.getElementById("save-btn");
const quickSaveBtn = document.getElementById("quick-save-btn");
const loadBtn = document.getElementById("load-btn");
const clearBtn = document.getElementById("clear-btn");

// export
const exportJsonBtn = document.getElementById("export-json-btn");
const exportHtmlBtn = document.getElementById("export-html-btn");

// input properties "right panel"
const propX = document.getElementById("prop-x");
const propY = document.getElementById("prop-y");
const propW = document.getElementById("prop-w");
const propRot = document.getElementById("prop-rot");

const propOpacity = document.getElementById("prop-opacity");
const propStyle = document.getElementById("prop-style");
const propFillMode = document.getElementById("prop-fill-mode");
const propFillA = document.getElementById("prop-fill-a");
const propFillB = document.getElementById("prop-fill-b");
const propStroke = document.getElementById("prop-stroke");
const propStrokeW = document.getElementById("prop-stroke-w");
const propRadius = document.getElementById("prop-radius");
const propLocked = document.getElementById("prop-locked");
const propHidden = document.getElementById("prop-hidden");

const propText = document.getElementById("prop-text");
const propsNote = document.getElementById("props-note");
const textHint = document.getElementById("text-hint");

// layers
const layersList = document.getElementById("layers-list");
const layerUpBtn = document.getElementById("layer-up-btn");
const layerDownBtn = document.getElementById("layer-down-btn");

// context menu
const contextMenu = document.getElementById("context-menu");

// states
let elements = [];    // all objects on canvas
let selectedIds = [];    // multi-select support
let primarySelectedId = null;    // main element used for resize/rotate

let snapEnabled = false;
const GRID = 28;
const MIN_SIZE = 10;

// tools
let activeTool = "select";    //"drawshape & select"
let drawShapeType = "rect";

// resize/drag/rotate
let isDragging = false;
let dragOffsets = [];
let isResizing = false;
let resizeHandle = [];
let isRotating = false;

// drawing tools
let isDrawing = false;
let drawingId = null;
let drawStart = null;

// zoom & pan
let zoom = 1;
let panX = 0;
let panY = 0;
let spaceDown = false;
let panning = false;
let panStart = null;

// storage key
const STORE_KEY = "domfigma_designs_final"

// clap/snap/some helpers
function uid(prefix = "el") {
  return prefix + "_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
}
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
function snap(v) {
  if (!snapEnabled) return v;
  return Math.round(v / GRID) * GRID;
}
function getCanvasRect() {
  return canvas.getBoundingClientRect();
}
function getMouseCanvasPos(e) {
  const rect = getCanvasRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

// screen coords "pan/zoom"
function screenToWorld(sx, sy) {
  return { x: (sx - panX) / zoom, y: (sy - panY) / zoom };
}

function getElementById(id) {
  return elements.find((e) => e.id === id);
}
function isSelected(id) {
  return selectedIds.includes(id);
}

// elements kept under visible area
function keepInsideCanvas(el) {
    const rect = getCanvasRect();
    const worldW = rect.width / zoom;
    const worldH = rect.height / zoom;

    el.x = clamp(el.x, 0, worldW - el.w);
    el.y = clamp(el.y, 0, worldH - el.h);
}

// viewport
function applyViewportTransform() {
  viewport.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
}

function setZoom(next) {
    zoom = clamp(next, 0.4, 2.2);
    applyViewportTransform();
    zoomLabel.innerText = Math.round(zoom * 100) + "%";
}


// toast
function showToast(msg) {
    const toast = document.createElement("div");
    toast.innerText = msg;

    toast.style.position = "fixed";
    toast.style.right = "18px";
    toast.style.bottom = "18px";
    toast.style.padding = "12px 14px";
    toast.style.borderRadius = "14px";
    toast.style.background = "rgba(21,18,18,0.85)";
    toast.style.border = "1px solid rgba(183,154,134,0.18)";
    toast.style.color = "rgba(255,245,238,0.92)";
    toast.style.boxShadow = "0 18px 50px rgba(0,0,0,0.65)";
    toast.style.zIndex = "999999";
    toast.style.backdropFilter = "blur(10px)";
    toast.style.fontSize = "13px";

    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 1100);
}


// panels 
let leftCollapsed = false;
let rightCollapsed = false;

toggleLeftBtn?.addEventListener("click", () => {
    leftCollapsed = !leftCollapsed;
    appRoot.classList.toggle("left-collapsed", leftCollapsed);
    toggleLeftBtn.innerText = leftCollapsed ? "⟩" : "⟨";
});

toggleRightBtn?.addEventListener("click", () => {
    rightCollapsed = !rightCollapsed;
    appRoot.classList.toggle("right-collapsed", rightCollapsed);
});


// shapes
function getShapeStyle(shape) {
    switch (shape) {
        case "circle": 
        case "oval":
            return { clipPath: "none", radiusMode: "circle" };
        
        case "rect":
        case "square":
            return { clipPath: "none", radiusMode: "rounded" };

        case "triangle":
            return { clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)", radiusMode: "none" };

        case "right-triangle":
            return { clipPath: "polygon(0% 0%, 100% 100%, 0% 100%)", radiusMode: "none" };

        case "pentagon":
            return { clipPath: "polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)", radiusMode: "none" };

        case "hexagon":
            return { clipPath: "polygon(25% 5%, 75% 5%, 100% 50%, 75% 95%, 25% 95%, 0% 50%)", radiusMode: "none" };

        case "octagon":
            return { clipPath: "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)", radiusMode: "none" };

        case "rhombus":
            return { clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)", radiusMode: "none" };

        case "trapezoid":
            return { clipPath: "polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)", radiusMode: "none" };

        case "parallelogram":
            return { clipPath: "polygon(20% 0%, 100% 0%, 80% 100%, 0% 100%)", radiusMode: "none" };

        case "kite":
            return { clipPath: "polygon(50% 0%, 80% 35%, 50% 100%, 20% 35%)", radiusMode: "none" };

        case "line":
            return { clipPath: "none", radiusMode: "pill" };

        default:
            return { clipPath: "none", radiusMode: "rounded" };
    }
}


// new shape creation witgh default color/height/ width/stroke width/corner radius
function createShape(shape, x = 60, y = 60, w = 160, h = 120) {
    const el = {
        id: uid(shape),
        type: "shape",
        shape, name: shape.toUpperCase(), x, y, w, h,
        rotation: 0,
        zIndex: elements.length + 1,
        locked: false,
        hidden: false,
        styleMode: "fill",
        fillMode: "solid",
        fillA: "#B79A86",
        fillB: "#6B4B3E",
        strokeColor: "#FFF5EE",
        strokeWidth: 2,
        cornerRadius: 12,
        opacity: 1,
    };
    
    if (shape === "line") {
        el.w = 240;
        el.h = 12;
        el.strokeWidth = 0;
    }
    
    return el;
}

// text element
function createText(x = 90, y = 90) {
    return {
        id: uid("text"),
        type: "text",
        name: "TEXT", x, y,
        w: 260,
        h: 80,
        rotation: 0,
        zIndex: elements.length + 1,
        locked: false,
        hidden: false,
        opacity: 1,
        text: "Type here...",
    };
}