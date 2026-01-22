const appRoot = document.getElementById("appRoot");
const canvas = document.getElementById("canvas");
const viewport = document.getElementById("viewport");
const modeLabel = document.getElementById("mode-label");

// open/close "left & right side"
const toggleLeftBtn = document.getElementById("toggle-left");
const toggleRightBtn = document.getElementById("toggle-right");

// shape tools
const shapeSelect = document.getElementById("shape-select");
const shapeToolBtn = document.getElementById("shape-tool-btn");
const addTextBtn = document.getElementById("add-text-btn");
const snapToggle = document.getElementById("snap-toggle");

// save/dlt/load/rename/clear/select btns
const saveBtn = document.getElementById("save-btn");
const quickSaveBtn = document.getElementById("quick-save-btn");
const loadBtn = document.getElementById("load-btn");
const renameBtn = document.getElementById("rename-btn");
const deleteSaveBtn = document.getElementById("delete-save-btn");
const clearBtn = document.getElementById("clear-btn");
const designNameInput = document.getElementById("design-name");
const designList = document.getElementById("design-list");

// export btns
const exportJsonBtn = document.getElementById("export-json-btn");
const exportHtmlBtn = document.getElementById("export-html-btn");

// zoom btns
const zoomOutBtn = document.getElementById("zoom-out");
const zoomInBtn = document.getElementById("zoom-in");
const resetViewBtn = document.getElementById("reset-view");
const zoomLabel = document.getElementById("zoom-label");

// layers
const layersList = document.getElementById("layers-list");
const layerUpBtn = document.getElementById("layer-up-btn");
const layerDownBtn = document.getElementById("layer-down-btn");

// Align tools
const alignLeftBtn = document.getElementById("align-left");
const alignCenterBtn = document.getElementById("align-center");
const alignRightBtn = document.getElementById("align-right");
const alignTopBtn = document.getElementById("align-top");
const alignMiddleBtn = document.getElementById("align-middle");
const alignBottomBtn = document.getElementById("align-bottom");

// Properties
const propX = document.getElementById("prop-x");
const propY = document.getElementById("prop-y");
const propW = document.getElementById("prop-w");
const propH = document.getElementById("prop-h");
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

// keys
const STORAGE_KEY = "domfigma_saved_designs_v1";
const QUICK_KEY = "domfigma_quick_autosave_v1";

const GRID = 20;
let snapEnabled = false;

// undo/redo
const HISTORY_LIMIT = 80;
let history = [];
let historyIndex = -1;
let historyLock = false; // prevents infinite loops

function deepClone(data) {
    return JSON.parse(JSON.stringify(data));
}

function pushHistory(reason = "") {
    if (historyLock) return;
    
    const snapshot = deepClone(elements);

  // cut future -> if user makes new change after undo
    if (historyIndex < history.length - 1) {
        history = history.slice(0, historyIndex + 1);
    }
    history.push(snapshot);

    // limit
    if (history.length > HISTORY_LIMIT) {
        history.shift();
    } else {
        historyIndex++;
    }
  // console.log("HISTORY PUSH:", reason, historyIndex, history.length);
}

function restoreHistory(index) {
    if (index < 0 || index >= history.length) return;
    historyLock = true;
    elements = deepClone(history[index]);
    historyLock = false;

    clearSelection();
    render();
    updateProps();
    saveQuick();
}

function undo() {
    if (historyIndex <= 0) return;
    historyIndex--;
    restoreHistory(historyIndex);
}

function redo() {
    if (historyIndex >= history.length - 1) return;
    historyIndex++;
    restoreHistory(historyIndex);
}

// viewport
let view = {
    zoom: 1,
    panX: 0,
    panY: 0,
};

function updateViewportTransform() {
    viewport.style.transform = `translate(${view.panX}px, ${view.panY}px) scale(${view.zoom})`;
    zoomLabel.textContent = Math.round(view.zoom * 100) + "%";
}

// state
let elements = [];    //all obj on canvas
let selectedIds = [];    //supports multiselect
let primaryId = null;    //main element resize/rotate
let mode = "select";
let drawShapeType = "rect";

// interactions drag/resize/draw
let isDragging = false;
let dragOffsets = new Map();

let isResizing = false;
let resizeHandle = null;

let isRotating = false;

let isDrawing = false;
let drawingId = null;
let drawStart = null;


// clamp/snap/canvas/mouse fncs
function uid(prefix = "el") {
    return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
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

function screenToWorld(sx, sy) {
    return {
        x: (sx - view.panX) / view.zoom,
        y: (sy - view.panY) / view.zoom,
    };
}

function getMouseWorld(e) {
    const rect = getCanvasRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    return screenToWorld(sx, sy);
}

function getElementById(id) {
    return elements.find((el) => el.id === id);
}

function isSelected(id) {
    return selectedIds.includes(id);
}

function setModeSelect() {
    mode = "select";
    modeLabel.textContent = "Mode: Select";
    canvas.style.cursor = "default";
}

function setModeDraw(shapeType) {
    mode = "draw";
    drawShapeType = shapeType;
    modeLabel.textContent = `Mode: Draw (${shapeType})`;
    canvas.style.cursor = "crosshair";
}

// shapes (clip paths)
function getShapeClipPath(type) {
    switch (type) {
        case "triangle": 
            return "polygon(50% 0%, 0% 100%, 100% 100%)";
        case "right-triangle":
            return "polygon(0% 0%, 0% 100%, 100% 100%)";
        case "pentagon":
            return "polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)";
        case "hexagon":
            return "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)";
        case "octagon":
            return "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)";
        case "rhombus":
            return "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)";
        case "trapezoid":
            return "polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)";
        case "parallelogram":
            return "polygon(20% 0%, 100% 0%, 80% 100%, 0% 100%)";
        case "kite":
            return "polygon(50% 0%, 80% 35%, 50% 100%, 20% 35%)";
        default:
            return null;
    }
}

// default elements  h/w/axis/fill/stroke/rad/locked/hidden
function createElementMeta(type, x, y, w, h) {
    const base = {
        id: uid(type),
        type,
        name: type.toUpperCase(),
        x: snap(x),
        y: snap(y),
        w: Math.max(10, snap(w)),
        h: Math.max(10, snap(h)),
        rotation: 0,
        opacity: 1,
        style: "fill",
        fillMode: "solid",
        fillA: "#B79A86",
        fillB: "#6B4B3E",
        stroke: "#B79A86",
        strokeW: 2,
        radius: 14,
        locked: false,
        hidden: false,
        zIndex: elements.length + 1,
    };

    if (type === "text") {
        base.name = "TEXT";
        base.text = "Type here...";
        base.strokeW = 1;
    }

    if (type === "line") {
        base.name = "LINE";
        base.h = Math.max(10, snap(12));
        base.radius = 999;
        base.strokeW = 0;
        base.style = "fill";
    }

    return base;
}

// styles
function applyFill(dom, el) {
    if (el.style === "outline") {
        dom.style.background = "transparent";
        dom.style.border = `${el.strokeW}px solid ${el.stroke}`;
        return;
    }
    
    dom.style.border = "none";

    if (el.fillMode === "solid") {
        dom.style.background = el.fillA;
    } else if (el.fillMode === "linear") {
        dom.style.background = `linear-gradient(135deg, ${el.fillA}, ${el.fillB})`;
    } else {
        dom.style.background = `radial-gradient(circle at 30% 30%, ${el.fillA}, ${el.fillB})`;
    }
}

// features right panel 
function applyElementStyles(dom, el) {
    dom.style.left = el.x + "px";
    dom.style.top = el.y + "px";
    dom.style.width = el.w + "px";
    dom.style.height = el.h + "px";
    dom.style.opacity = el.opacity;
    dom.style.zIndex = el.zIndex;

    dom.style.transform = `rotate(${el.rotation}deg)`;
    dom.style.transformOrigin = "center";

    dom.style.borderRadius = el.radius + "px";

    const clip = getShapeClipPath(el.type);
    dom.style.clipPath = clip ? clip : "none";

    if (el.type === "circle" || el.type === "oval") dom.style.borderRadius = "999px";
    applyFill(dom, el);

    if (el.type === "text") {
        dom.style.border = `${Math.max(1, el.strokeW)}px solid rgba(183,154,134,0.20)`;
        dom.style.background = "rgba(11,9,8,0.45)";
        dom.style.padding = "12px";
        dom.style.color = "rgba(255,245,238,0.92)";
        dom.style.overflow = "hidden";
        dom.style.clipPath = "none";
    }

    if (el.type === "line") {
        dom.style.borderRadius = "999px";
        dom.style.clipPath = "none";
        dom.style.background = el.fillA;
    }

    dom.style.display = el.hidden ? "none" : "block";
}

function createDomElement(el) {
    const node = document.createElement("div");
    node.className = "element";
    node.dataset.id = el.id;
    node.style.userSelect = "none";
    node.style.position = "absolute";

    if (el.type === "text") {
        node.classList.add("text");
        node.contentEditable = "true";
        node.spellcheck = false;
       node.innerText = el.text || "";
    }

    applyElementStyles(node, el);
    return node;
}

// handles/rotator 
function addHandles(node) {
    const handles = ["tl", "tr", "bl", "br"];
    handles.forEach((pos) => {
        const h = document.createElement("div");
        h.className = `handle ${pos}`;
        h.dataset.handle = pos;
        node.appendChild(h);
    });
}

function addRotator(node) {
    const r = document.createElement("div");
    r.className = "rotator";
    r.dataset.rotator = "true";
    node.appendChild(r);
}

function setSelection(ids, primary = null) {
    selectedIds = [...new Set(ids)];
    primaryId = primary ?? (selectedIds[0] || null);
    render();
    updateProps();
}

function clearSelection() {
    selectedIds = [];
    primaryId = null;
    render();
    updateProps();
}

// inside canvas
function keepInsideCanvas(el) {
    const rect = viewport.getBoundingClientRect();
    const maxX = rect.width / view.zoom - el.w;
    const maxY = rect.height / view.zoom - el.h;
    const MARGIN = 2000;
    
    el.x = clamp(el.x, -MARGIN, maxX + MARGIN);
    el.y = clamp(el.y, -MARGIN, maxY + MARGIN);
}



// render
function render() {
    viewport.innerHTML = "";

    elements.forEach((el) => {
        const node = createDomElement(el);
        
        if (isSelected(el.id)) {
            node.classList.add("selected");
            if (el.id === primaryId && !el.locked && !el.hidden) {
                addHandles(node);
                addRotator(node);
            }
        }
        viewport.appendChild(node);
    });
    renderLayers();
}

function renderLayers() {
    layersList.innerHTML = "";
    const sorted = elements.slice().sort((a, b) => b.zIndex - a.zIndex);

    sorted.forEach((el) => {
        const item = document.createElement("div");
        item.className = "layer-item" + (isSelected(el.id) ? " active" : "");

        item.innerHTML = `
            <span>${el.name || el.type.toUpperCase()}</span>
            <span style="opacity:.55; font-size:12px;">${el.type}</span>`;
            
        item.addEventListener("click", (e) => {
            if (e.shiftKey) {
                if (isSelected(el.id)) {
                    setSelection(selectedIds.filter((x) => x !== el.id), primaryId === el.id ? null : primaryId);
                } else {
                    setSelection([...selectedIds, el.id], primaryId || el.id);
                }
            } else {
                setSelection([el.id], el.id);
            }
        });
        
        item.addEventListener("dblclick", () => {
            const newName = prompt("Rename layer:", el.name || el.type.toUpperCase());
            if (newName && newName.trim()) {
                el.name = newName.trim();
                saveQuick();
                pushHistory("Rename layer");
                renderLayers();
            }
        });
        layersList.appendChild(item);
    });
}

// properties right/left panel 
function disableProps(disabled) {
    const inputs = [ propX, propY, propW, propH, propRot, propOpacity, propStyle, propFillMode, propFillA, propFillB, propStroke, propStrokeW, propRadius, propLocked, propHidden, propText];
    inputs.forEach((inp) => inp && (inp.disabled = disabled));
}

function updateProps() {
    const el = primaryId ? getElementById(primaryId) : null;
    if (!el) {
        disableProps(true);
        return;
    }
    disableProps(false);

    propX.value = Math.round(el.x);
    propY.value = Math.round(el.y);
    propW.value = Math.round(el.w);
    propH.value = Math.round(el.h);
    propRot.value = Math.round(el.rotation);

    propOpacity.value = el.opacity;
    propStyle.value = el.style;
    propFillMode.value = el.fillMode;

    propFillA.value = el.fillA;
    propFillB.value = el.fillB;

    propStroke.value = el.stroke;
    propStrokeW.value = el.strokeW;

    propRadius.value = el.radius;
    propLocked.value = el.locked ? "yes" : "no";
    propHidden.value = el.hidden ? "yes" : "no";

    if (el.type === "text") {
        propText.disabled = false;
        propText.value = el.text || "";
    } else {
        propText.disabled = true;
        propText.value = "";
    }
}

function bindNumberInput(input, cb, reason) {
    input.addEventListener("input", () => {
        if (!primaryId) return;
        const el = getElementById(primaryId);
        if (!el || el.locked) return;

        cb(el, Number(input.value));
        keepInsideCanvas(el);
        saveQuick();
        pushHistory(reason);
        render();
        updateProps();
    });
}

bindNumberInput(propX, (el, v) => (el.x = snap(v)), "Change X");
bindNumberInput(propY, (el, v) => (el.y = snap(v)), "Change Y");
bindNumberInput(propW, (el, v) => (el.w = Math.max(10, snap(v))), "Change W");
bindNumberInput(propH, (el, v) => (el.h = Math.max(10, snap(v))), "Change H");
bindNumberInput(propRot, (el, v) => (el.rotation = v), "Change Rotation");
bindNumberInput(propStrokeW, (el, v) => (el.strokeW = Math.max(0, v)), "Change Stroke W");
bindNumberInput(propRadius, (el, v) => (el.radius = Math.max(0, v)), "Change Radius");

propOpacity.addEventListener("input", () => {
    if (!primaryId) return;
    const el = getElementById(primaryId);
    if (!el || el.locked) return;
    el.opacity = Number(propOpacity.value);
    saveQuick();
    pushHistory("Change Opacity");
    render();
});

propStyle.addEventListener("change", () => {
    if (!primaryId) return;
    const el = getElementById(primaryId);
    if (!el || el.locked) return;
    el.style = propStyle.value;
    saveQuick();
    pushHistory("Change Style");
    render();
});

propFillMode.addEventListener("change", () => {
    if (!primaryId) return;
    const el = getElementById(primaryId);
    if (!el || el.locked) return;
    el.fillMode = propFillMode.value;
    saveQuick();
    pushHistory("Change Fill Mode");
    render();
});

propFillA.addEventListener("input", () => {
    if (!primaryId) return;
    const el = getElementById(primaryId);
    if (!el || el.locked) return;
    el.fillA = propFillA.value;
    saveQuick();
    pushHistory("Change Fill A");
    render();
});

propFillB.addEventListener("input", () => {
    if (!primaryId) return;
    const el = getElementById(primaryId);
    if (!el || el.locked) return;
    el.fillB = propFillB.value;
    saveQuick();
    pushHistory("Change Fill B");
    render();
});

propStroke.addEventListener("input", () => {
    if (!primaryId) return;
    const el = getElementById(primaryId);
    if (!el || el.locked) return;
    el.stroke = propStroke.value;
    saveQuick();
    pushHistory("Change Stroke");
    render();
});

propLocked.addEventListener("change", () => {
    if (!primaryId) return;
    const el = getElementById(primaryId);
    if (!el) return;
    el.locked = propLocked.value === "yes";
    saveQuick();
    pushHistory("Toggle Lock");
    render();
    updateProps();
});

propHidden.addEventListener("change", () => {
    if (!primaryId) return;
    const el = getElementById(primaryId);
    if (!el) return;
    el.hidden = propHidden.value === "yes";
    saveQuick();
    pushHistory("Toggle Hidden");
    render();
    updateProps();
});

propText.addEventListener("input", () => {
    if (!primaryId) return;
    const el = getElementById(primaryId);
    if (!el || el.type !== "text") return;
    el.text = propText.value;
    saveQuick();
    pushHistory("Edit Text");
    render();
});

// saved designs
function getSavedDesigns() {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
}

function setSavedDesigns(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function refreshDesignDropdown() {
    const saved = getSavedDesigns();
    designList.innerHTML = `<option value="">Select saved design</option>`;
    saved.forEach((d, idx) => {
        const opt = document.createElement("option");
        opt.value = idx;
        opt.textContent = d.name;
        designList.appendChild(opt);
    });
}

function saveQuick() {
    localStorage.setItem(QUICK_KEY, JSON.stringify(elements));
}

function loadQuick() {
    const raw = localStorage.getItem(QUICK_KEY);
    if (!raw) return false;
    elements = JSON.parse(raw) || [];
    clearSelection();
    render();
    return true;
}

function saveDesignToDropdown() {
    const name = (designNameInput.value || "").trim() || "Untitled Design";
    const saved = getSavedDesigns();

    saved.push({
        name,
        data: elements,
        time: Date.now(),
    });

    setSavedDesigns(saved);
    refreshDesignDropdown();
    saveQuick();
    pushHistory("Save Design");
    alert("✅ Design saved successfully!");
}

saveBtn.addEventListener("click", saveDesignToDropdown);

quickSaveBtn.addEventListener("click", () => {
    saveQuick();
    pushHistory("Quick Save");
    alert("✅ Quick Saved!");
});

loadBtn.addEventListener("click", () => {
    const idx = Number(designList.value);
    const saved = getSavedDesigns();
    if (Number.isNaN(idx) || !saved[idx]) {
        alert("Select a design to load!");
       return;
    }

    elements = saved[idx].data || [];
    clearSelection();
    render();
    saveQuick();
    pushHistory("Load Design");
});

renameBtn.addEventListener("click", () => {
    const idx = Number(designList.value);
    const saved = getSavedDesigns();
    if (Number.isNaN(idx) || !saved[idx]) {
        alert("Select a design to rename!");
        return;
    }

    const newName = prompt("New design name:", saved[idx].name);
    if (!newName || !newName.trim()) return;

    saved[idx].name = newName.trim();
    setSavedDesigns(saved);
    refreshDesignDropdown();
    pushHistory("Rename Saved Design");
});

deleteSaveBtn.addEventListener("click", () => {
    const idx = Number(designList.value);
    const saved = getSavedDesigns();

    if (Number.isNaN(idx) || !saved[idx]) {
        alert("Select a design to delete!");
        return;
    }

    const ok = confirm(`Delete design "${saved[idx].name}" ?`);
    if (!ok) return;

    saved.splice(idx, 1);
    setSavedDesigns(saved);
    refreshDesignDropdown();
    pushHistory("Delete Saved Design");
});

clearBtn.addEventListener("click", () => {
    const ok = confirm("Clear canvas?");
    if (!ok) return;
    elements = [];
    clearSelection();
    render();
    saveQuick();
    pushHistory("Clear Canvas");
});

// export html/json
exportJsonBtn.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(elements, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "domfigma_design.json";
    a.click();
    URL.revokeObjectURL(url);
});

exportHtmlBtn.addEventListener("click", () => {
    const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><title>Exported Design</title></head>
    <body style="margin:0; background:#090706;">
    <div style="position:relative; width:100vw; height:100vh;">
    ${elements.map((el) => {
        const style = `
        position:absolute;
        left:${el.x}px;
        top:${el.y}px;
        width:${el.w}px;
        height:${el.h}px;
        transform: rotate(${el.rotation}deg);
        transform-origin:center;
        opacity:${el.opacity};
        z-index:${el.zIndex};
        border-radius:${el.type === "circle" || el.type === "oval" ? "999px" : (el.radius || 0) + "px"};
        `;

        const clip = getShapeClipPath(el.type);
        const extra = clip ? `clip-path:${clip};` : "";

        if (el.type === "text") {
            return `<div style="${style} padding:12px; color:rgba(255,245,238,0.92); border:1px solid rgba(183,154,134,0.25); background:rgba(11,9,8,0.45); ${extra}">${(el.text || "").replaceAll("<","&lt;")}</div>`;
        }

        if (el.style === "outline") {
            return `<div style="${style} background:transparent; border:${el.strokeW}px solid ${el.stroke}; ${extra}"></div>`;
        }

        let bg = el.fillA;
        if (el.fillMode === "linear") bg = `linear-gradient(135deg, ${el.fillA}, ${el.fillB})`;
        if (el.fillMode === "radial") bg = `radial-gradient(circle at 30% 30%, ${el.fillA}, ${el.fillB})`;

        return `<div style="${style} background:${bg}; ${extra}"></div>`;
    })
    .join("\n")}
    </div>
    </body>
    </html>`.trim();

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "domfigma_export.html";
    a.click();
    URL.revokeObjectURL(url);

    pushHistory("Export HTML");
});

// alignment tools
function getSelectedElements() {
    return selectedIds.map(getElementById).filter((el) => el && !el.locked && !el.hidden);
}

function getSelectionBounds(list) {
    if (!list.length) return null;

    let left = Infinity,
     top = Infinity,
     right = -Infinity,
     bottom = -Infinity;
        
    list.forEach((el) => {
        left = Math.min(left, el.x);
        top = Math.min(top, el.y);
        right = Math.max(right, el.x + el.w);
        bottom = Math.max(bottom, el.y + el.h);
    });
        
    return {
         left, top, right, bottom, cx: (left + right) / 2, cy: (top + bottom) / 2,
    };
}

function alignSelection(type) {
    const list = getSelectedElements();
    if (list.length < 2) {
        alert("Select 2+ elements (Shift+Click) to align");
        return;
    }

    const b = getSelectionBounds(list);
    if (!b) return;

    list.forEach((el) => {
        if (type === "left") el.x = b.left;
        if (type === "right") el.x = b.right - el.w;
        if (type === "center") el.x = b.cx - el.w / 2;
        if (type === "top") el.y = b.top;
        if (type === "bottom") el.y = b.bottom - el.h;
        if (type === "middle") el.y = b.cy - el.h / 2;

        keepInsideCanvas(el);
    });

    saveQuick();
    pushHistory("Align");
    render();
    updateProps();
}

alignLeftBtn.addEventListener("click", () => alignSelection("left"));
alignCenterBtn.addEventListener("click", () => alignSelection("center"));
alignRightBtn.addEventListener("click", () => alignSelection("right"));
alignTopBtn.addEventListener("click", () => alignSelection("top"));
alignMiddleBtn.addEventListener("click", () => alignSelection("middle"));
alignBottomBtn.addEventListener("click", () => alignSelection("bottom"));

// left/right "open & close"
toggleLeftBtn.addEventListener("click", () => {
    appRoot.classList.toggle("left-collapsed");
});

toggleRightBtn.addEventListener("click", () => {
    appRoot.classList.toggle("right-collapsed");
});

// snap toggle
snapToggle.addEventListener("change", (e) => {
    snapEnabled = e.target.checked;
});

// zoom ctrl
function zoomTo(newZoom, pivot = null) {
    const oldZoom = view.zoom;
    const rect = canvas.getBoundingClientRect();

    const pivotScreen = pivot || {
        x: rect.width / 2,
        y: rect.height / 2,
    }; // default center of canvas

    const worldX = (pivotScreen.x - view.panX) / oldZoom;
    const worldY = (pivotScreen.y - view.panY) / oldZoom;

    // update zoom
    view.zoom = clamp(newZoom, 0.3, 3);
    view.panX = pivotScreen.x - worldX * view.zoom;
    view.panY = pivotScreen.y - worldY * view.zoom;

    updateViewportTransform();
}


function getSelectedCenter() {
    if (!primaryId) return null;
    const el = getElementById(primaryId);
    if (!el) return null;

    return {
        x: el.x + el.w / 2,
        y: el.y + el.h / 2,
    };
}

function worldToScreen(worldX, worldY) {
    return {
        x: worldX * view.zoom + view.panX,
        y: worldY * view.zoom + view.panY,
    };
}

zoomInBtn.addEventListener("click", () => {
    const center = getSelectedCenter();

    if (center) {
        const pivot = worldToScreen(center.x, center.y);
        zoomTo(view.zoom + 0.1, pivot);
    } else {
        zoomTo(view.zoom + 0.1);
    }
});

zoomOutBtn.addEventListener("click", () => {
    const center = getSelectedCenter();

    if (center) {
        const pivot = worldToScreen(center.x, center.y);
        zoomTo(view.zoom - 0.1, pivot);
    } else {
        zoomTo(view.zoom - 0.1);
    }
});


resetViewBtn.addEventListener("click", () => {
    view.zoom = 1;
    view.panX = 0;
    view.panY = 0;
    updateViewportTransform();
});

canvas.addEventListener(
    "wheel",
    (e) => {
        if (!e.ctrlKey) return;
        e.preventDefault();

        const rect = canvas.getBoundingClientRect();
        const pivot = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        };

        const delta = e.deltaY > 0 ? -0.08 : 0.08;
        zoomTo(view.zoom + delta, pivot);
    },
    { passive: false }
);


// draw tool
shapeToolBtn.addEventListener("click", () => {
    setModeDraw(shapeSelect.value);
});

addTextBtn.addEventListener("click", () => {
    const el = createElementMeta("text", 80, 80, 220, 80);
    elements.push(el);
    saveQuick();
    pushHistory("Add Text");
    setModeSelect();
    setSelection([el.id], el.id);
});

// interaction "mouse"
canvas.addEventListener("mousedown", (e) => {
    const mouse = getMouseWorld(e);

    const elementNode = e.target.closest(".element");

    // click & drag
    if (!elementNode && mode === "draw") {
        isDrawing = true;
        drawStart = { x: mouse.x, y: mouse.y };

        let realType = drawShapeType;
        if (drawShapeType === "square") realType = "rect";

        const el = createElementMeta(realType, mouse.x, mouse.y, 10, 10);

        if (drawShapeType === "square") el.name = "SQUARE";
        if (drawShapeType === "circle") el.type = "circle";
        if (drawShapeType === "oval") el.type = "oval";
        if (drawShapeType === "line") el.type = "line";

        elements.push(el);
        drawingId = el.id;
        setSelection([el.id], el.id);
        pushHistory("Draw Shape Start");
        render();
        return;
    }

    if (!elementNode) {
        clearSelection();
        return;
    }

    const id = elementNode.dataset.id;
    const el = getElementById(id);
    if (!el) return;

    const handleNode = e.target.closest(".handle");
    if (handleNode && id === primaryId) {
        isResizing = true;
        resizeHandle = handleNode.dataset.handle;
        pushHistory("Resize Start");
        return;
    }

    const rotNode = e.target.closest(".rotator");
    if (rotNode && id === primaryId) {
        isRotating = true;
        pushHistory("Rotate Start");
        return;
    }

    if (e.shiftKey) {
        if (isSelected(id)) {
            setSelection(selectedIds.filter((x) => x !== id), primaryId === id ? null : primaryId);
        } else {
            setSelection([...selectedIds, id], primaryId || id);
        }
    } else {
        setSelection([id], id);
    }

    if (!el.locked) {
        isDragging = true;
        dragOffsets.clear();
        selectedIds.forEach((sid) => {
            const item = getElementById(sid);
            if (!item || item.locked) return;
            dragOffsets.set(sid, { dx: mouse.x - item.x, dy: mouse.y - item.y });
        });
        pushHistory("Drag Start");
    }
});

document.addEventListener("mousemove", (e) => {
    const mouse = getMouseWorld(e);

    // drawing drag
    if (isDrawing && drawingId) {
        const el = getElementById(drawingId);
        if (!el) return;
        
        const x1 = drawStart.x;
        const y1 = drawStart.y;
        const x2 = mouse.x;
        const y2 = mouse.y;
        
        el.x = snap(Math.min(x1, x2));
        el.y = snap(Math.min(y1, y2));
        el.w = Math.max(10, snap(Math.abs(x2 - x1)));
        el.h = Math.max(10, snap(Math.abs(y2 - y1)));

        if (el.type === "circle") {
            const s = Math.max(el.w, el.h);
            el.w = s;
            el.h = s;
        }
        
        saveQuick();
        render();
        updateProps();
        return;
    }

    // drag
    if (isDragging && selectedIds.length) {
        selectedIds.forEach((sid) => {
            const el = getElementById(sid);
            if (!el || el.locked) return;
            
            const off = dragOffsets.get(sid);
            if (!off) return;

            el.x = snap(mouse.x - off.dx);
            el.y = snap(mouse.y - off.dy);
            keepInsideCanvas(el);
        });
        
        saveQuick();
        render();
        updateProps();
        return;
    }

    // resize
    if (isResizing && primaryId) {
        const el = getElementById(primaryId);
        if (!el || el.locked) return;
        const minSize = 10;

        let newX = el.x;
        let newY = el.y;
        let newW = el.w;
        let newH = el.h;

        const dx = mouse.x - el.x;
        const dy = mouse.y - el.y;

        if (resizeHandle === "br") {
            newW = dx;
            newH = dy;
        }
        if (resizeHandle === "tr") {
            newW = dx;
            newH = el.h + (el.y - mouse.y);
            newY = mouse.y;
        }
        if (resizeHandle === "bl") {
            newW = el.w + (el.x - mouse.x);
            newH = dy;
            newX = mouse.x;
        }
        if (resizeHandle === "tl") {
            newW = el.w + (el.x - mouse.x);
            newH = el.h + (el.y - mouse.y);
            newX = mouse.x;
            newY = mouse.y;
        }

        newW = Math.max(minSize, snap(newW));
        newH = Math.max(minSize, snap(newH));
        newX = snap(newX);
        newY = snap(newY);

        if (el.type === "circle") {
            const s = Math.max(newW, newH);
            newW = s;
            newH = s;
        }

        el.x = newX;
        el.y = newY;
        el.w = newW;
        el.h = newH;

        keepInsideCanvas(el);
        saveQuick();
        render();
        updateProps();
        return;
    }

    // rotate
    if (isRotating && primaryId) {
        const el = getElementById(primaryId);
        if (!el || el.locked) return;

        const cx = el.x + el.w / 2;
        const cy = el.y + el.h / 2;

        const angleRad = Math.atan2(mouse.y - cy, mouse.x - cx);
        let deg = (angleRad * 180) / Math.PI;
        if (deg < 0) deg += 360;

        if (e.shiftKey) deg = Math.round(deg / 15) * 15;

        el.rotation = Math.round(deg);
        saveQuick();
        render();
        updateProps();
    }
});

document.addEventListener("mouseup", () => {
    if (isDrawing) {
        isDrawing = false;
        drawingId = null;
        drawStart = null;
        setModeSelect();
        pushHistory("Draw Shape End");
    }

    if (isDragging) pushHistory("Drag End");
    if (isResizing) pushHistory("Resize End");
    if (isRotating) pushHistory("Rotate End");

    isDragging = false;
    dragOffsets.clear();

    isResizing = false;
    resizeHandle = null;

    isRotating = false;
});

// text edit
viewport.addEventListener("input", (e) => {
    const node = e.target.closest(".element.text");
    if (!node) return;
    const id = node.dataset.id;
    const el = getElementById(id);
    if (!el) return;
    el.text = node.innerText;
    saveQuick();
    pushHistory("Edit Text (DOM)");
    if (id === primaryId) propText.value = el.text;
});

// undo/redo/save design
document.addEventListener("keydown", (e) => {
    // Ctrl+Z -> Undo
    if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
       return;
    }

    // Ctrl+Shift+Z -> Redo "standard"
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        redo();
        return;
    }

    // Ctrl+Y -> Redo
    if (e.ctrlKey && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
    }

    // Ctrl+S -> Save Design
    if (e.ctrlKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveDesignToDropdown();
        return;
    }
});

// init
function init() {
    snapEnabled = snapToggle.checked;

    refreshDesignDropdown();
    updateViewportTransform();
    loadQuick();
    pushHistory("Initial Load");    // Start history with initial state
    render();
    updateProps();
}

init();