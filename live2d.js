
import { trimToEndSentence, trimToStartSentence } from "../../../utils.js";
import { getRequestHeaders, sendMessageAsUser } from "../../../../script.js";
import { getContext, extension_settings, getApiUrl, doExtrasFetch, modules } from "../../../extensions.js";

import {
    DEBUG_PREFIX,
    live2d,
    FALLBACK_EXPRESSION
  } from "./constants.js";

export {
    loadLive2d,
    updateExpression
}

let models = {};
let app = null;

async function onHitAreasClick(character, model, hitAreas) {
    const model_path = extension_settings.live2d.characterModelMapping[character];
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
      model.expression(model_expression);
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
  
async function loadLive2d() {
    // Reset the PIXI app
    if(app !== null) {
        app.destroy();
        app = null;
    }

    document.getElementById("live2d-canvas").hidden = true;
    const character = getContext().name2;

    // Free memory
    if (!extension_settings.live2d.enabled) {
        if (models[character] !== undefined) {
        models[character].destroy(true, true, true);
        delete models[character];
        }
        return;
    }

    if (extension_settings.live2d.characterModelMapping[character] == undefined)
        return;

    document.getElementById("live2d-canvas").hidden = false;

    const model_path = extension_settings.live2d.characterModelMapping[character];
    let model = await live2d.Live2DModel.from(model_path);// TODO: multiple models

    let coord_x = (innerWidth - model.width) / 2;
    let coord_y = innerHeight * 0.1;
    // Need to free memory ?
    if (models[character] !== undefined) {
        coord_x = models[character].x;
        coord_y = models[character].y;
        models[character].destroy(true, true, true);
    }

    models[character] = model;

    app = new PIXI.Application({
        view: document.getElementById("live2d-canvas"),
        autoStart: true,
        resizeTo: window,
        backgroundAlpha: 0
    });

    app.stage.addChild(model);

    console.debug(DEBUG_PREFIX,innerWidth, " ", innerHeight)

    const scaleX = ((innerWidth) / model.width) * extension_settings.live2d.characterModelsSettings[character][model_path]["scale"];
    const scaleY = ((innerHeight) / model.height) * extension_settings.live2d.characterModelsSettings[character][model_path]["scale"];

    // Scale to canvas
    model.scale.set(Math.min(scaleX, scaleY));

    model.x = coord_x;
    model.y = coord_y;

    draggable(model);

    // Debug frames
    if (extension_settings.live2d.showFrames)
        showFrames(model);

    // Override expression/motion
    const override_expression = extension_settings.live2d.characterModelsSettings[character][model_path]["override"]["expression"];
    const override_motion = extension_settings.live2d.characterModelsSettings[character][model_path]["override"]["motion"];

    if (override_expression != "none") {
        model.expression(override_expression);
        console.debug(DEBUG_PREFIX,"Playing override expression", override_expression);
    }

    if (override_motion != "none") {
        console.debug(DEBUG_PREFIX,"Applying override motion")

        const motion_label_split = override_motion.split("_id=")
        const motion_label = motion_label_split[0];
        const motion_id = motion_label_split[1];

        if (motion_id == "random")
        models[character].motion(motion_label);
        else
        models[character].motion(motion_label,motion_id);

        
        console.debug(DEBUG_PREFIX,"Playing override expression", override_motion);
    }

    // handle tapping
    model.on("hit", (hitAreas) => onHitAreasClick(character, model, hitAreas));

    // Set cursor behavior
    model._autoInteract = extension_settings.live2d.followCursor;

    console.debug(DEBUG_PREFIX, "Finished loading model:", model);
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
        console.debug(DEBUG_PREFIX,"Motion is none, applying default motion");
        model_motion = extension_settings.live2d.characterModelsSettings[character][model_path]["default"]["motion"];
    }

    console.debug(DEBUG_PREFIX,"Playing expression",expression,":", model_expression, model_motion);
    //console.debug(DEBUG_PREFIX,models)
    //console.debug(DEBUG_PREFIX,models[character]);

    if (model_expression != "none") {
        models[character].expression(model_expression);
    }

    if (model_motion != "none") {
        const motion_label_split = model_motion.split("_id=")
        const motion_label = motion_label_split[0];
        const motion_id = motion_label_split[1];
        
        //models[character].internalModel.motionManager.stopAllMotions();

        console.debug(DEBUG_PREFIX,motion_label,motion_id);

        if (motion_id == "random")
        models[character].motion(motion_label);
        else
        models[character].motion(motion_label,motion_id);
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