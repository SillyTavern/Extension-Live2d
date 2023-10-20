import { loadFileToDocument } from "../../../utils.js";
export {
    MODULE_NAME,
    DEBUG_PREFIX,
    CHARACTER_LIVE2D_FOLDER,
    CLASSIFY_EXPRESSIONS,
    FALLBACK_EXPRESSION,
    extensionFolderPath,
    live2d
}

const MODULE_NAME = 'Live2d';
const CHARACTER_LIVE2D_FOLDER = "live2d";
const DEBUG_PREFIX = "<Live2d extension ui.js> ";
const CLASSIFY_EXPRESSIONS = [
    "admiration",
    "amusement",
    "anger",
    "annoyance",
    "approval",
    "caring",
    "confusion",
    "curiosity",
    "desire",
    "disappointment",
    "disapproval",
    "disgust",
    "embarrassment",
    "excitement",
    "fear",
    "gratitude",
    "grief",
    "joy",
    "love",
    "nervousness",
    "optimism",
    "pride",
    "realization",
    "relief",
    "remorse",
    "sadness",
    "surprise",
    "neutral"
  ];
const FALLBACK_EXPRESSION = "joy"

const JS_LIBS = [
"live2dcubismcore.min.js",
"live2d.min.js",
"pixi.min.js",
"index.min.js",
"extra.min.js"
]

const extensionFolderPath = `scripts/extensions/third-party/Extension-Live2d`;
// Load JS libraries
for(const i of JS_LIBS){
    await loadFileToDocument(
        `${extensionFolderPath}/lib/${i}`,
        "js"
    );
}

const live2d = PIXI.live2d;