
import { trimToEndSentence, trimToStartSentence } from '../../../utils.js';
import { getRequestHeaders, saveSettings, saveSettingsDebounced, sendMessageAsUser } from '../../../../script.js';
import { getContext, extension_settings, getApiUrl, doExtrasFetch, modules } from '../../../extensions.js';

import {
    DEBUG_PREFIX,
    live2d,
    FALLBACK_EXPRESSION,
    CANVAS_ID,
    delay,
    SPRITE_DIV,
    VN_MODE_DIV,
    ID_PARAM_PATCH,
} from './constants.js';

export {
    loadLive2d,
    updateExpression,
    rescaleModel,
    moveModel,
    removeModel,
    playExpression,
    playMotion,
    playTalk,
    playMessage,
    resetParameters,
    setParameter,
    setVisible,
    charactersWithModelLoaded,
    forceLoopAnimation,
};

let models = {};
let app = null;
let is_talking = {};
let abortTalking = {};
let previous_interaction = { 'character': '', 'message': '' };
let last_motion = {};

const EXPRESSION_API = {
    local: 0,
    extras: 1,
    llm: 2,
};

async function onHitAreasClick(character, hitAreas) {
    const model_path = extension_settings.live2d.characterModelMapping[character];
    const model = models[character];
    const model_hit_areas = model.internalModel.hitAreas;
    let model_expression;
    let model_motion;
    let message;

    if (model.is_dragged) {
        console.debug(DEBUG_PREFIX,'Model is being dragged cancel hit detection');
        return;
    }

    console.debug(DEBUG_PREFIX,'Detected click on hit areas:', hitAreas, 'of', model.tag);
    console.debug(DEBUG_PREFIX,'Checking priority from:', model_hit_areas);

    let selected_area;
    let selected_area_priority;
    for (const area in model_hit_areas) {
        if (!hitAreas.includes(area))
            continue;
        console.debug(DEBUG_PREFIX,'Checking',model_hit_areas[area]);

        // Check area mapping
        model_expression = extension_settings.live2d.characterModelsSettings[character][model_path]['hit_areas'][area]['expression'];
        model_motion = extension_settings.live2d.characterModelsSettings[character][model_path]['hit_areas'][area]['motion'];
        message = extension_settings.live2d.characterModelsSettings[character][model_path]['hit_areas'][area]['message'];

        if (model_expression == 'none' && model_motion == 'none' && message == '') {
            console.debug(DEBUG_PREFIX,'No animation or message mapped, ignored.');
            continue;
        }

        if (selected_area === undefined || model_hit_areas[area].index < selected_area_priority) {
            selected_area = model_hit_areas[area].name;
            selected_area_priority = model_hit_areas[area].index;
            console.debug(DEBUG_PREFIX,'higher priority selected',selected_area);
        }
    }


    // No hit area found with mapping, set click mapping
    if (selected_area === undefined) {
        console.debug(DEBUG_PREFIX,'No hit area with mapping found, fallback to default click behavior:',extension_settings.live2d.characterModelsSettings[character][model_path]['animation_click']);
        model_expression = extension_settings.live2d.characterModelsSettings[character][model_path]['animation_click']['expression'];
        model_motion = extension_settings.live2d.characterModelsSettings[character][model_path]['animation_click']['motion'];
        message = extension_settings.live2d.characterModelsSettings[character][model_path]['animation_click']['message'];
    }
    else {
        console.debug(DEBUG_PREFIX,'Highest priority area with mapping found:', selected_area,extension_settings.live2d.characterModelsSettings[character][model_path]['hit_areas'][selected_area]);
        model_expression = extension_settings.live2d.characterModelsSettings[character][model_path]['hit_areas'][selected_area]['expression'];
        model_motion = extension_settings.live2d.characterModelsSettings[character][model_path]['hit_areas'][selected_area]['motion'];
        message = extension_settings.live2d.characterModelsSettings[character][model_path]['hit_areas'][selected_area]['message'];
    }

    if (message != '') {
        console.debug(DEBUG_PREFIX,getContext());
        // Same interaction as last message
        if (getContext().chat[getContext().chat.length - 1].is_user && previous_interaction['character'] == character && previous_interaction['message'] == message) {
            console.debug(DEBUG_PREFIX,'Same as last interaction, nothing done');
        }
        else {
            previous_interaction['character'] = character;
            previous_interaction['message'] = message;

            $('#send_textarea').val(''); // clear message area to avoid double message
            sendMessageAsUser(message);
            if (extension_settings.live2d.autoSendInteraction) {
                await getContext().generate();
            }
        }
    }
    else
        console.debug(DEBUG_PREFIX,'Mapped message empty, nothing to send.');

    if (model_expression != 'none') {
        await playExpression(character, model_expression);
        console.debug(DEBUG_PREFIX,'Playing hit area expression', model_expression);
    }

    if (model_motion != 'none') {
        //model.internalModel.motionManager.stopAllMotions();
        await playMotion(character,model_motion);
        console.debug(DEBUG_PREFIX,'Playing hit area motion', model_motion);
    }
}

async function onClick(model, x, y) {
    const character = model.st_character;
    const hit_areas = await model.hitTest(x,y);
    console.debug(DEBUG_PREFIX, 'Click areas at',x,y,':',hit_areas);

    // Hit area will handle the click
    if (hit_areas.length > 0) {
        console.debug(DEBUG_PREFIX,'Hit areas function will handle the click.');
        return;
    }
    else
        onHitAreasClick(character,[]); // factorisation: will just play default
}

function draggable(model) {
    model.buttonMode = true;
    model.on('pointerdown', (e) => {
        model.dragging = true;
        model._pointerX = e.data.global.x - model.x;
        model._pointerY = e.data.global.y - model.y;
    });
    model.on('pointermove', (e) => {
        if (model.dragging) {
            const new_x = e.data.global.x - model._pointerX;
            const new_y = e.data.global.y - model._pointerY;
            model.is_dragged = (model.position.x != new_x ) || (model.position.y != new_y);
            console.debug(DEBUG_PREFIX,'Draging model',model.is_dragged);

            model.position.x = new_x;
            model.position.y = new_y;

            // Save new center relative location
            const character = model.st_character;
            const model_path = model.st_model_path;
            //console.debug(DEBUG_PREFIX,"Dragging",character,model_path, "to", model.position, "canvas", innerWidth,innerHeight);
            extension_settings.live2d.characterModelsSettings[character][model_path]['x'] = Math.round(((model.x + (model.width / 2)) - (innerWidth / 2)) / (innerWidth / 2 / 100));
            extension_settings.live2d.characterModelsSettings[character][model_path]['y'] = Math.round(((model.y + (model.height / 2)) - (innerHeight / 2)) / (innerHeight / 2 / 100));
            saveSettingsDebounced();
            $('#live2d_model_x').val(extension_settings.live2d.characterModelsSettings[character][model_path]['x']);
            $('#live2d_model_x').val(extension_settings.live2d.characterModelsSettings[character][model_path]['x']);
            $('#live2d_model_x_value').text(extension_settings.live2d.characterModelsSettings[character][model_path]['x']);
            $('#live2d_model_y_value').text(extension_settings.live2d.characterModelsSettings[character][model_path]['y']);
        //console.debug(DEBUG_PREFIX,"New offset to center",extension_settings.live2d.characterModelsSettings[character][model_path]["x"],extension_settings.live2d.characterModelsSettings[character][model_path]["y"]);
        }
    });
    model.on('pointerupoutside', async () => {model.dragging = false; await delay(100); model.is_dragged = false;}); // wait to cancel click detection
    model.on('pointerup', async () => {model.dragging = false; await delay(100); model.is_dragged = false;});
}

function showFrames(model) {
    const foreground = PIXI.Sprite.from(PIXI.Texture.WHITE);
    foreground.width = model.internalModel.width;
    foreground.height = model.internalModel.height;
    foreground.alpha = 0.2;
    foreground.visible = true;

    const hitAreaFrames = new live2d.HitAreaFrames();
    hitAreaFrames.visible = true;

    model.addChild(foreground);
    model.addChild(hitAreaFrames);
}

async function loadLive2d(visible = true) {
    console.debug(DEBUG_PREFIX, 'Updating live2d app.');
    // 1) Cleanup memory
    // Reset the PIXI app
    if(app !== null) {
        app.destroy();
        app = null;
    }

    // Delete the canvas
    if (document.getElementById(CANVAS_ID) !== null)
        document.getElementById(CANVAS_ID).remove();

    // Delete live2d models from memory
    for (const character in models) {
        models[character].destroy(true, true, true);
        delete models[character];
        console.debug(DEBUG_PREFIX,'Delete model from memory for', character);
    }

    if (!extension_settings.live2d.enabled) {
        // Show solo chat sprite
        $('#' + SPRITE_DIV).removeClass('live2d-hidden');
        $('#' + VN_MODE_DIV).removeClass('live2d-hidden');
        return;
    }

    // Hide sprite divs
    $('#' + SPRITE_DIV).addClass('live2d-hidden');
    $('#' + VN_MODE_DIV).addClass('live2d-hidden');

    // Create new canvas and PIXI app
    var canvas = document.createElement('canvas');
    canvas.id = CANVAS_ID;
    if (!visible)
        canvas.classList.add('live2d-hidden');


    // TODO: factorise
    const context = getContext();
    const group_id = context.groupId;
    let chat_members = [context.name2];

    if (group_id !== null) {
        chat_members = [];
        for(const i of context.groups) {
            if (i.id == context.groupId) {
                for(const j of i.members) {
                    let char_name = j.replace(/\.[^/.]+$/, '');
                    if (char_name.includes('default_'))
                        char_name = char_name.substring('default_'.length);

                    chat_members.push(char_name);
                }
            }
        }
    }

    $('body').append(canvas);

    app = new PIXI.Application({
        resolution: 2 * window.devicePixelRatio,
        view: document.getElementById(CANVAS_ID),
        autoStart: true,
        resizeTo: window,
        backgroundAlpha: 0,
    });

    console.debug(DEBUG_PREFIX,'Loading models of',chat_members);

    // Load each character model
    let offset = 0;
    for (const character of chat_members) {
        console.debug(DEBUG_PREFIX,'Loading model of',character);

        if (extension_settings.live2d.characterModelMapping[character] === undefined)
            continue;

        console.debug(DEBUG_PREFIX,'Loading',extension_settings.live2d.characterModelMapping[character]);

        const model_path = extension_settings.live2d.characterModelMapping[character];
        var m;
        try{
            m = await live2d.Live2DModel.from(model_path, null, extension_settings.live2d.characterModelsSettings[character][model_path]['eye']||45);
        }catch{
            m = await live2d.Live2DModel.from(model_path);
        }
        const model = m;
        model.st_character = character;
        model.st_model_path = model_path;
        model.is_dragged = false;
        console.debug(DEBUG_PREFIX,'loaded',model);

        // Apply basic cursor animations
        if (model.internalModel !== undefined) {
            try{
                for (const param in extension_settings.live2d.characterModelsSettings[character][model_path]['cursor_param']) {
                    model.internalModel[param] = extension_settings.live2d.characterModelsSettings[character][model_path]['cursor_param'][param];
                    console.debug(DEBUG_PREFIX,'Assigned parameter',param,'as',model.internalModel[param]);
                }
            }catch{
                continue;
            }
        }
        /*
            console.debug(DEBUG_PREFIX,"Checking model basic animations parameters:",model_parameter_ids);
            for (const param in ID_PARAM_PATCH) {
                let param_id = model.internalModel[param];
                if (param_id === undefined) {
                    console.debug(DEBUG_PREFIX,"Parameter does not exist maybe no animation possible for", param);
                    continue;
                }
                if (!model_parameter_ids.includes(param_id)) {
                    let patched = false;
                    console.debug(DEBUG_PREFIX,"Parameter not found:",param_id);
                    for (param_id of ID_PARAM_PATCH[param]){
                        if(model_parameter_ids.includes(param_id)) {
                            model.internalModel[param] = param_id
                            console.debug(DEBUG_PREFIX,"Found alternative param id:",param_id)
                            patched = true;
                            break
                        }
                    }

                    if (!patched)
                        console.log(DEBUG_PREFIX,"WARNING, cannot find corresponding parameter for",param);
                }
            }
        }*/

        models[character] = model;
        app.stage.addChild(model);

        const scaleY = ((innerHeight) / model.height) * extension_settings.live2d.characterModelsSettings[character][model_path]['scale'];

        // Scale to canvas
        model.scale.set(scaleY);

        moveModel(character, extension_settings.live2d.characterModelsSettings[character][model_path]['x'], extension_settings.live2d.characterModelsSettings[character][model_path]['y']);

        draggable(model);

        // Debug frames
        if (extension_settings.live2d.showFrames)
            showFrames(model);

        // handle tapping
        model.on('hit', (hitAreas) => onHitAreasClick(character, hitAreas));
        model.on('click', (e) => onClick(model, e.data.global.x,e.data.global.y));

        // Set cursor behavior
        model.autoInteract = extension_settings.live2d.followCursor;
        console.debug(DEBUG_PREFIX, 'Finished loading model:', model);
    }
    console.debug(DEBUG_PREFIX, 'Models:', models);
}

async function updateExpression(chat_id) {
    const message = getContext().chat[chat_id];
    const character = message.name;
    const model_path = extension_settings.live2d.characterModelMapping[character];

    console.debug(DEBUG_PREFIX,'received new message :', message.mes);

    if (message.is_user)
        return;

    if (model_path === undefined) {
        console.debug(DEBUG_PREFIX, 'No model assigned to', character);
        return;
    }

    const expression = await getExpressionLabel(message.mes);
    let model_expression = extension_settings.live2d.characterModelsSettings[character][model_path]['classify_mapping'][expression]['expression'];
    let model_motion = extension_settings.live2d.characterModelsSettings[character][model_path]['classify_mapping'][expression]['motion'];

    console.debug(DEBUG_PREFIX,'Detected expression in message:',expression);

    // Fallback animations
    if (model_expression == 'none') {
        console.debug(DEBUG_PREFIX,'Expression is none, applying default expression', model_expression);
        model_expression = extension_settings.live2d.characterModelsSettings[character][model_path]['animation_default']['expression'];
    }

    if (model_motion == 'none') {
        console.debug(DEBUG_PREFIX,'Motion is none, playing default motion',model_motion);
        model_motion = extension_settings.live2d.characterModelsSettings[character][model_path]['animation_default']['motion'];
    }

    console.debug(DEBUG_PREFIX,'Playing expression',expression,':', model_expression, model_motion);

    if (model_expression != 'none') {
        models[character].expression(model_expression);
    }

    if (model_motion != 'none') {
        await playMotion(character, model_motion);
    }
}

async function getExpressionLabel(text) {
    // Return if text is undefined, saving a costly fetch request
    if ((!modules.includes('classify') && extension_settings.expressions.api === EXPRESSION_API.extras) || !text) {
        return FALLBACK_EXPRESSION;
    }

    text = sampleClassifyText(text);

    try {
        // TODO: proper LLM classification
        if (extension_settings.expressions.api === EXPRESSION_API.local || extension_settings.api === EXPRESSION_API.llm) {
            // Local transformers pipeline
            const apiResult = await fetch('/api/extra/classify', {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({ text: text }),
            });

            if (apiResult.ok) {
                const data = await apiResult.json();
                return data.classification[0].label;
            }
        } else if (extension_settings.expressions.api === EXPRESSION_API.extras) {
            // Extras
            const url = new URL(getApiUrl());
            url.pathname = '/api/classify';

            const apiResult = await doExtrasFetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Bypass-Tunnel-Reminder': 'bypass',
                },
                body: JSON.stringify({ text: text }),
            });

            if (apiResult.ok) {
                const data = await apiResult.json();
                return data.classification[0].label;
            }
        } else {
            return FALLBACK_EXPRESSION;
        }
    } catch (error) {
        console.log(error);
        return FALLBACK_EXPRESSION;
    }
}

function moveModel(character, x, y) {
    if (models[character] === undefined)
        return;

    const model = models[character];
    model.x = ((innerWidth / 2) - (model.width / 2)) + (innerWidth / 2) * x / 100;
    model.y = ((innerHeight / 2) - (model.height / 2)) + (innerHeight / 2) * y / 100;
}

async function rescaleModel(character) {
    if (models[character] !== undefined) {
        const model_path = $('#live2d_model_select').val();
        const model = models[character];
        const scaleY = ((innerHeight) / model.internalModel.height) * extension_settings.live2d.characterModelsSettings[character][model_path]['scale'];
        model.scale.set(scaleY);
        moveModel(character, extension_settings.live2d.characterModelsSettings[character][model_path]['x'], extension_settings.live2d.characterModelsSettings[character][model_path]['y']);
    }
}

async function removeModel(character) {
    if (models[character] !== undefined) {
        models[character].destroy(true, true, true);
        delete models[character];
        console.debug(DEBUG_PREFIX,'Delete model from memory for', character);
    }
}

/**
 * Processes the classification text to reduce the amount of text sent to the API.
 * Quotes and asterisks are to be removed. If the text is less than 300 characters, it is returned as is.
 * If the text is more than 300 characters, the first and last 150 characters are returned.
 * The result is trimmed to the end of sentence.
 * @param {string} text The text to process.
 * @returns {string}
 */
function sampleClassifyText(text) {
    if (!text) {
        return text;
    }

    // Remove asterisks and quotes
    let result = text.replace(/[\*\"]/g, '');

    const SAMPLE_THRESHOLD = 300;
    const HALF_SAMPLE_THRESHOLD = SAMPLE_THRESHOLD / 2;

    if (text.length < SAMPLE_THRESHOLD) {
        result = trimToEndSentence(result);
    } else {
        result = trimToEndSentence(result.slice(0, HALF_SAMPLE_THRESHOLD)) + ' ' + trimToStartSentence(result.slice(-HALF_SAMPLE_THRESHOLD));
    }

    return result.trim();
}

async function playExpression(character, expression) {
    if (models[character] === undefined)
        return;

    const model = models[character];
    console.debug(DEBUG_PREFIX,character,'playing expression',expression);
    await model.expression(expression);
}

async function playMotion(character, motion, force = false) {
    if (models[character] === undefined)
        return;

    console.debug(DEBUG_PREFIX,character,'decoding motion',motion);

    // Reset model to force animation
    if (force || extension_settings.live2d.force_animation) {
        console.debug(DEBUG_PREFIX,'force model reloading models');
        await loadLive2d();
        //models[character].internalModel.motionManager.stopAllMotions();
    }

    const model = models[character];
    const motion_label_split = motion.split('_id=');
    const motion_label = motion_label_split[0];
    const motion_id = motion_label_split[1];


    console.debug(DEBUG_PREFIX,character,'playing motion',motion_label,motion_id);

    if (motion_id == 'random')
        await model.motion(motion_label);
    else
        await model.motion(motion_label,motion_id);

    last_motion[character] = motion;
}

async function playTalk(character, text) {
    console.debug(DEBUG_PREFIX,'Playing mouth animation for',character,'message:',text);
    // No model loaded for character
    if (models[character] === undefined)
        return;

    abortTalking[character] = false;

    // Character is already talking TODO: stop previous talk animation
    if (is_talking[character] !== undefined && is_talking[character] == true) {
        console.debug(DEBUG_PREFIX,'Character is already talking abort');
        while (is_talking[character]) {
            abortTalking[character] = true;
            await delay(100);
        }
        abortTalking[character] = false;
        console.debug(DEBUG_PREFIX,'Start new talk');
        //return;
    }

    const model = models[character];
    const model_path = extension_settings.live2d.characterModelMapping[character];
    const parameter_mouth_open_y_id = extension_settings.live2d.characterModelsSettings[character][model_path]['param_mouth_open_y_id'];
    const mouth_open_speed = extension_settings.live2d.characterModelsSettings[character][model_path]['mouth_open_speed'];
    const mouth_time_per_character = extension_settings.live2d.characterModelsSettings[character][model_path]['mouth_time_per_character'];

    // No mouth parameter set
    if (parameter_mouth_open_y_id == 'none') {
        return;
    }

    if (typeof model.internalModel.coreModel.addParameterValueById !== 'function') {
        console.debug(DEBUG_PREFIX,'Model has no addParameterValueById function cannot animate mouth');
        return;
    }

    is_talking[character] = true;
    let startTime = Date.now();
    const duration = text.length * mouth_time_per_character;
    let turns = 0;
    let mouth_y = 0;
    while ((Date.now() - startTime) < duration) {
        if (abortTalking[character]) {
            console.debug(DEBUG_PREFIX,'Abort talking requested.');
            break;
        }

        // Model destroyed during animation
        if (model?.internalModel?.coreModel === undefined) {
            console.debug(DEBUG_PREFIX,'Model destroyed during talking animation, abort');
            break;
        }

        mouth_y = Math.sin((Date.now() - startTime));
        model.internalModel.coreModel.addParameterValueById(parameter_mouth_open_y_id, mouth_y);
        //console.debug(DEBUG_PREFIX,"Mouth_y:", mouth_y, "VS",model.internalModel.coreModel.getParameterValueById(parameter_mouth_open_y_id), "remaining time", duration - (Date.now() - startTime));
        await delay(100 / mouth_open_speed);
        turns += 1;
    }

    if (model?.internalModel?.coreModel !== undefined)
        model.internalModel.coreModel.addParameterValueById(parameter_mouth_open_y_id, -100); // close mouth
    is_talking[character] = false;
}

async function playMessage(chat_id) {
    const character = getContext().chat[chat_id].name;

    // No model for user or system
    if (getContext().chat[chat_id].is_user || getContext().chat[chat_id].is_system)
        return;

    const message = getContext().chat[chat_id].mes;
    playTalk(character, message);
}

// Sets a parameter value using an ID
async function setParameter(character, paramId, paramValue) {
    const model = models[character];
    model.internalModel.coreModel.setParameterValueById(paramId, paramValue);
}

// Resets all parameters to default
async function resetParameters(character) {
    const model = models[character];
    model.internalModel.coreModel._model.parameters.defaultValues.forEach((defaultValue, paramIndex) => {
        model.internalModel.coreModel.setParameterValueByIndex(paramIndex, defaultValue);
    });
}

function setVisible() {
    $('#' + CANVAS_ID).removeClass('live2d-hidden');
}

function charactersWithModelLoaded() {
    return Object.keys(models);
}

function forceLoopAnimation() {
    for (const character in models) {
        const model = models[character];
        model.internalModel.motionManager.playing;

        if (model.internalModel.motionManager.playing) {
            //console.debug(DEBUG_PREFIX,"Already playing motion wating for looping");
            continue;
        }

        if (last_motion[character] !== undefined) {
            playMotion(character, last_motion[character]);
            //console.debug(DEBUG_PREFIX,"Force looping of motion",motion);
        }
    }
}
