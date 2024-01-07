import { loadFileToDocument } from '../../../utils.js';
export {
    MODULE_NAME,
    DEBUG_PREFIX,
    CHARACTER_LIVE2D_FOLDER,
    CLASSIFY_EXPRESSIONS,
    FALLBACK_EXPRESSION,
    extensionFolderPath,
    modelfolderPath,
    live2d,
    CANVAS_ID,
    delay,
    TEST_MESSAGE,
    SPRITE_DIV,
    VN_MODE_DIV,
    PARAM_MOUTH_OPEN_Y_DEFAULT,
    PARAM_MOUTH_OPEN_Y_PATCH,
    ID_PARAM_DEFAULT,
    ID_PARAM_PATCH,
    JS_LIBS,
};

const MODULE_NAME = 'Live2d';
const CHARACTER_LIVE2D_FOLDER = 'live2d';
const DEBUG_PREFIX = '<Live2d extension ui.js> ';
const CLASSIFY_EXPRESSIONS = [
    'admiration',
    'amusement',
    'anger',
    'annoyance',
    'approval',
    'caring',
    'confusion',
    'curiosity',
    'desire',
    'disappointment',
    'disapproval',
    'disgust',
    'embarrassment',
    'excitement',
    'fear',
    'gratitude',
    'grief',
    'joy',
    'love',
    'nervousness',
    'optimism',
    'pride',
    'realization',
    'relief',
    'remorse',
    'sadness',
    'surprise',
    'neutral',
];
const FALLBACK_EXPRESSION = 'joy';

const JS_LIBS = [
    'live2dcubismcore.min.js',
    'live2d.min.js',
    'pixi.min.js',
    'index.min.js',
    'extra.min.js',
];

const modelfolderPath = 'assets/live2d';
const extensionFolderPath = 'scripts/extensions/third-party/Extension-Live2d';
// Load JS libraries
for(const i of JS_LIBS){
    await loadFileToDocument(
        `${extensionFolderPath}/lib/${i}`,
        'js',
    );
}

const live2d = PIXI.live2d;
const CANVAS_ID = 'live2d-canvas';

const delay = ms => new Promise(res => setTimeout(res, ms));

const TEST_MESSAGE = 'TEST MESSAGE: ' + new Array(500 + 1).join( '#' );
const SPRITE_DIV = 'expression-wrapper';
const VN_MODE_DIV = 'visual-novel-wrapper';

const PARAM_MOUTH_OPEN_Y_DEFAULT = 'ParamMouthOpenY';

const PARAM_MOUTH_OPEN_Y_PATCH = ['PARAM_MOUTH_OPEN_Y', 'PARAM_MOUTH_OPEN'];

// Animations patches
const ID_PARAM_DEFAULT = {
    'idParamAngleX' : 'ParamAngleX',
    'idParamAngleY' : 'ParamAngleY',
    'idParamAngleZ' : 'ParamAngleZ',
    'idParamBodyAngleX' : 'ParamBodyAngleX',
    'idParamBreath' : 'ParamBreath',
    'idParamEyeBallX' : 'ParamEyeBallX',
    'idParamEyeBallY' : 'ParamEyeBallY',
};

// Animations patches
const ID_PARAM_PATCH = {
    'idParamAngleX' : ['PARAM_ANGLE_X'],
    'idParamAngleY' : ['PARAM_ANGLE_Y'],
    'idParamAngleZ' : ['PARAM_ANGLE_Z'],
    'idParamBodyAngleX' : ['PARAM_BODY_ANGLE_X'],
    'idParamBreath' : ['PARAM_BREATH'],
    'idParamEyeBallX' : ['PARAM_EYE_BALL_X'],
    'idParamEyeBallY' : ['PARAM_EYE_BALL_Y'],
};
