
import { trimToEndSentence, trimToStartSentence } from "../../../utils.js";
import { getRequestHeaders, sendMessageAsUser } from "../../../../script.js";
import { getContext, extension_settings, getApiUrl, doExtrasFetch, modules } from "../../../extensions.js";

import {
    DEBUG_PREFIX,
    live2d,
    FALLBACK_EXPRESSION,
    CANVAS_ID,
    delay
  } from "./constants.js";

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
    setVisible
}

let models = {};
let app = null;
let is_talking = {}
let abortTalking = {};

async function onHitAreasClick(character, hitAreas) {
    const model_path = extension_settings.live2d.characterModelMapping[character];
    const model = models[character];
    const model_hit_areas = model.internalModel.hitAreas;
  
    console.debug(DEBUG_PREFIX,"Detected click on hit areas:", hitAreas, "of", model.tag);
    console.debug(DEBUG_PREFIX,"Checking priority from:", model_hit_areas);
  
    let selected_area;
    let selected_area_priority;
    for (const area in model_hit_areas) {
      if (!hitAreas.includes(area))
        continue;
      console.debug(DEBUG_PREFIX,"Checking",model_hit_areas[area]);
      if (selected_area === undefined || model_hit_areas[area].index < selected_area_priority) {
        selected_area = model_hit_areas[area].name;
        selected_area_priority = model_hit_areas[area].index;
        console.debug(DEBUG_PREFIX,"higher priority selected",selected_area);
      }
    }
    
    console.debug(DEBUG_PREFIX,"Selected area:", selected_area);
  
    const model_expression = extension_settings.live2d.characterModelsSettings[character][model_path]["hitAreas"][selected_area]["expression"];
    const model_motion = extension_settings.live2d.characterModelsSettings[character][model_path]["hitAreas"][selected_area]["motion"];
    const message = extension_settings.live2d.characterModelsSettings[character][model_path]["hitAreas"][selected_area]["message"];
  
    console.debug(DEBUG_PREFIX,"Mapping:", extension_settings.live2d.characterModelsSettings[character][model_path]["hitAreas"][selected_area])
    
    if (message != "") {
      $('#send_textarea').val("") // clear message area to avoid double message
      sendMessageAsUser(message);
      if (extension_settings.live2d.autoSendInteraction)
        await getContext().generate(); // TODO: check autosend
    }
  
    if (model_expression != "none") {
      playExpression(character, model_expression);
      console.debug(DEBUG_PREFIX,"Playing hit area expression", model_expression);
    }
  
    if (model_motion != "none") {
      const motion_label_split = model_motion.split("_id=")
      const motion_label = motion_label_split[0];
      const motion_id = motion_label_split[1];
  
      model.internalModel.motionManager.stopAllMotions();
  
      if (motion_id == "random")
        model.motion(motion_label);
      else
        model.motion(motion_label,motion_id);
  
      
      console.debug(DEBUG_PREFIX,"Playing hit area motion", model_motion);
    }
}
  
function draggable(model) {
    model.buttonMode = true;
    model.on("pointerdown", (e) => {
        model.dragging = true;
        model._pointerX = e.data.global.x - model.x;
        model._pointerY = e.data.global.y - model.y;
    });
    model.on("pointermove", (e) => {
        if (model.dragging) {
        model.position.x = e.data.global.x - model._pointerX;
        model.position.y = e.data.global.y - model._pointerY;
        }
    });
    model.on("pointerupoutside", () => (model.dragging = false));
    model.on("pointerup", () => (model.dragging = false));
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
  
async function loadLive2d(invisible=false) {
    let model_coord = {}
    console.debug(DEBUG_PREFIX, "Updating live2d app.")
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
        model_coord[character] = {"x": models[character].x, "y": models[character].y}; // save coord
        models[character].destroy(true, true, true);
        delete models[character];
        console.debug(DEBUG_PREFIX,"Delete model from memory for", character);
    }
    
    if (!extension_settings.live2d.enabled)
        return;

    // Create new canvas and PIXI app
    var canvas = document.createElement('canvas');
    canvas.id = CANVAS_ID;

    // TODO: factorise
    const context = getContext();
    const group_id = context.groupId;
    let chat_members = [context.name2];

    if (group_id !== null) {
        chat_members = [];
        for(const i of context.groups) {
            if (i.id == context.groupId) {
                for(const j of i.members) {
                    let char_name = j.replace(/\.[^/.]+$/, "")
                    if (char_name.includes("default_"))
                        char_name = char_name.substring("default_".length);
                    
                    chat_members.push(char_name);
                }
            }
        }
    }
    
    $("body").append(canvas);
    if (invisible)
        $("#"+CANVAS_ID).hide();

    app = new PIXI.Application({
        view: document.getElementById(CANVAS_ID),
        autoStart: true,
        resizeTo: window,
        backgroundAlpha: 0
    });

    console.debug(DEBUG_PREFIX,"Loading models of",chat_members);

    // Load each character model
    let offset = 0;
    for (const character of chat_members) {
        console.debug(DEBUG_PREFIX,"Loading model of",character)

        if (extension_settings.live2d.characterModelMapping[character] === undefined)
            continue;

        console.debug(DEBUG_PREFIX,"Loading",extension_settings.live2d.characterModelMapping[character])

        const model_path = extension_settings.live2d.characterModelMapping[character];
        const model = await live2d.Live2DModel.from(model_path);
        
        /*/ Need to free memory ?
        if (models[character] !== undefined) {
            coord_x = models[character].x;
            coord_y = models[character].y;
            models[character].destroy(true, true, true);
        }*/

        models[character] = model;
        app.stage.addChild(model);

        const scaleY = ((innerHeight) / model.height) * extension_settings.live2d.characterModelsSettings[character][model_path]["scale"];

        // Scale to canvas
        model.scale.set(scaleY);

        /*/ Set previous coordinates
        if (model_coord[character] !== undefined) {
            model.x = model_coord[character].x;
            model.y = model_coord[character].y;
        }
        else { // center of canvas
            model.x = (innerWidth - model.width) / 2;
            model.y = 0;
        }
        //offset += model.width;
        */
        
        moveModel(character, extension_settings.live2d.characterModelsSettings[character][model_path]["x"], extension_settings.live2d.characterModelsSettings[character][model_path]["y"]);

        draggable(model);

        // Debug frames
        if (extension_settings.live2d.showFrames)
            showFrames(model);

        /*/ Override expression/motion
        const override_expression = extension_settings.live2d.characterModelsSettings[character][model_path]["override"]["expression"];
        const override_motion = extension_settings.live2d.characterModelsSettings[character][model_path]["override"]["motion"];

        if (override_expression != "none") {
            playExpression(character, override_expression)
            console.debug(DEBUG_PREFIX,"Playing override expression", override_expression);
        }

        if (override_motion != "none") {
            console.debug(DEBUG_PREFIX,"Applying override motion")
            playMotion(character, override_motion);
            console.debug(DEBUG_PREFIX,"Playing override expression", override_motion);
        }*/

        // handle tapping
        model.on("hit", (hitAreas) => onHitAreasClick(character, hitAreas));

        // Set cursor behavior
        model._autoInteract = extension_settings.live2d.followCursor;
        console.debug(DEBUG_PREFIX, "Finished loading model:", model);
    }
    console.debug(DEBUG_PREFIX, "Models:", models);
}

async function updateExpression(chat_id) {
    const message = getContext().chat[chat_id];
    const character = message.name;
    const model_path = extension_settings.live2d.characterModelMapping[character];
    const override_expression = extension_settings.live2d.characterModelsSettings[character][model_path]["override"]["expression"];
    const override_motion = extension_settings.live2d.characterModelsSettings[character][model_path]["override"]["motion"]

    console.debug(DEBUG_PREFIX,"received new message :", message);

    if (message.is_user)
        return;

    if (model_path === undefined) {
        console.debug(DEBUG_PREFIX, "No model assigned to", character);
        return;
    }

    const expression = await getExpressionLabel(message.mes);
    let model_expression = extension_settings.live2d.characterModelsSettings[character][model_path]["expressions"][expression]["expression"];
    let model_motion = extension_settings.live2d.characterModelsSettings[character][model_path]["expressions"][expression]["motion"];

    // Override animations
    if (override_expression != "none") {
        console.debug(DEBUG_PREFIX,"Applying override expression")
        model_expression = override_expression;
    }

    if (override_motion != "none") {
        console.debug(DEBUG_PREFIX,"Applying override motion")
        model_motion = override_motion;
    }

    // Fallback animations
    if (model_expression == "none") {
        console.debug(DEBUG_PREFIX,"Expression is none, applying default expression");
        model_expression = extension_settings.live2d.characterModelsSettings[character][model_path]["default"]["expression"];
    }

    if (model_motion == "none") {
        console.debug(DEBUG_PREFIX,"Motion is none, await loadLive2d();lying default motion");
        model_motion = extension_settings.live2d.characterModelsSettings[character][model_path]["default"]["motion"];
    }

    console.debug(DEBUG_PREFIX,"Playing expression",expression,":", model_expression, model_motion);

    if (model_expression != "none") {
        models[character].expression(model_expression);
    }

    if (model_motion != "none") {
        playMotion(character, model_motion);
    }
}
  
async function getExpressionLabel(text) {
    // Return if text is undefined, saving a costly fetch request
    if ((!modules.includes('classify') && !extension_settings.expressions.local) || !text) {
        return FALLBACK_EXPRESSION;
    }

    text = sampleClassifyText(text);

    try {
        if (extension_settings.expressions.local) {
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
        } else {
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
    model.x = ((innerWidth / 2) - (model.width / 2)) + (innerWidth / 2) * x;
    model.y = ((innerHeight / 2) - (model.height / 2)) + ((innerHeight / 2)) * y;
}

async function rescaleModel(character) {
    if (models[character] !== undefined) {
        const model_path = $("#live2d_model_select").val();
        const model = models[character];
        const scaleY = ((innerHeight) / model.internalModel.height) * extension_settings.live2d.characterModelsSettings[character][model_path]["scale"];
        model.scale.set(scaleY);
        moveModel(character, extension_settings.live2d.characterModelsSettings[character][model_path]["x"], extension_settings.live2d.characterModelsSettings[character][model_path]["y"]);
    }
}

async function removeModel(character) {
    if (models[character] !== undefined) {
        models[character].destroy(true, true, true);
        delete models[character];
        console.debug(DEBUG_PREFIX,"Delete model from memory for", character);
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

function playExpression(character, expression) {
    if (models[character] === undefined)
        return;

    const model = models[character];
    console.debug(DEBUG_PREFIX,character,"playing expression",expression);
    model.expression(expression);
}

function playMotion(character, motion, force=false) {
    if (models[character] === undefined)
        return;

    console.debug(DEBUG_PREFIX,character,"decoding motion",motion);

    const model = models[character];
    const motion_label_split = motion.split("_id=")
    const motion_label = motion_label_split[0];
    const motion_id = motion_label_split[1];
    
    if (force)
        models[character].internalModel.motionManager.stopAllMotions();

    console.debug(DEBUG_PREFIX,character,"playing motion",motion_label,motion_id);

    if (motion_id == "random")
        model.motion(motion_label);
    else
        model.motion(motion_label,motion_id);
}

async function playTalk(character, text) {
    console.debug(DEBUG_PREFIX,"Playing mouth animation for",character,"message:",text);
    // No model loaded for character
    if (models[character] === undefined)
        return;

    abortTalking[character] = false;

    // Character is already talking TODO: stop previous talk animation
    if (is_talking[character] !== undefined && is_talking[character] == true) {
        console.debug(DEBUG_PREFIX,"Character is already talking abort");
        while (is_talking[character]) {
            abortTalking[character] = true;
            await delay(100);
        }
        abortTalking[character] = false;
        //return;
    }

    const model = models[character];
    const model_path = extension_settings.live2d.characterModelMapping[character];
    const parameter_mouth_open_y_id = extension_settings.live2d.characterModelsSettings[character][model_path]["param_mouth_open_y_id"];
    const mouth_open_speed = extension_settings.live2d.characterModelsSettings[character][model_path]["mouth_open_speed"];
    const mouth_time_per_character = extension_settings.live2d.characterModelsSettings[character][model_path]["mouth_time_per_character"]

    is_talking[character] = true;
    let startTime = Date.now();
    const duration = text.length * mouth_time_per_character;
    let turns = 0;
    let mouth_y = 0
    while ((Date.now() - startTime) < duration) {
        if (abortTalking[character]) {
            console.debug(DEBUG_PREFIX,"Abort talking requested.")
            break;
        }

        // Model destroyed during animation
        if (model === undefined)
            break;

        mouth_y = Math.sin((Date.now() - startTime));
        model.internalModel.coreModel.addParameterValueById(parameter_mouth_open_y_id, mouth_y);
        //console.debug(DEBUG_PREFIX,"Mouth_y:", mouth_y, "VS",model.internalModel.coreModel.getParameterValueById(parameter_mouth_open_y_id), "remaining time", duration - (Date.now() - startTime));
        await delay(100 / mouth_open_speed);
        turns += 1;
    }

    if (model !== undefined)
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

async function setVisible(character, value) {
    const model = models[character];

    console.debug(DEBUG_PREFIX,model)

    if (model !== undefined)
        model.visible = value;
}