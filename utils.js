import { getContext, extension_settings } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../script.js";
import {
    DEBUG_PREFIX,
    ID_PARAM_DEFAULT,
    PARAM_MOUTH_OPEN_Y_DEFAULT,
    PARAM_MOUTH_OPEN_Y_PATCH,
    ID_PARAM_PATCH
 } from "./constants.js";

export {
    currentChatMembers,
    loadModelParamUi,
    loadAnimationUi
}

function currentChatMembers() {
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

    chat_members.sort();

    return chat_members;
}

function loadModelParamUi(character, model_path, model_parameter_ids, param_select_id, param_id, user_settings_exists, force=false) {
    $(`#${param_select_id}`)
    .find('option')
    .remove()
    .end()
    .append('<option value="none">Select parameter id</option>');

    for (const i of model_parameter_ids) {
        $(`#${param_select_id}`).append(new Option(i, i));
    }

    // Mouth parameter
    if (param_id == "ParamMouthOpenY") {
        // Default mouth open Y parameter detection
        if (force || (!user_settings_exists && extension_settings.live2d.characterModelsSettings[character][model_path]["param_mouth_open_y_id"] == "none") ) {
            console.debug(DEBUG_PREFIX,"Searching for parameter", param_id)
            let found = false;
            if (model_parameter_ids.includes(PARAM_MOUTH_OPEN_Y_DEFAULT)) {
                console.debug(DEBUG_PREFIX,"Found default parameter",PARAM_MOUTH_OPEN_Y_DEFAULT)
                extension_settings.live2d.characterModelsSettings[character][model_path]["param_mouth_open_y_id"] = PARAM_MOUTH_OPEN_Y_DEFAULT;
                saveSettingsDebounced();
            }

            // Try known alternatives
            if (!found) {
                for (const value of PARAM_MOUTH_OPEN_Y_PATCH) {
                    if (model_parameter_ids.includes(value)) {
                        console.debug(DEBUG_PREFIX,"Found alternative parameter", value)
                        extension_settings.live2d.characterModelsSettings[character][model_path]["param_mouth_open_y_id"] = value;
                        saveSettingsDebounced();
                        found = true
                        break;
                    }
                }
            }

            if (!found) {
                console.log(DEBUG_PREFIX,"None of the known parameter value are present in the model:",PARAM_MOUTH_OPEN_Y_PATCH);
                console.log(DEBUG_PREFIX,"Set it manually via the UI.");
            }
        }

        $(`#${param_select_id}`).val(extension_settings.live2d.characterModelsSettings[character][model_path]["param_mouth_open_y_id"]);
        return;
    }

    // Cursor tacking parameter
    if (force || (!user_settings_exists && extension_settings.live2d.characterModelsSettings[character][model_path]["cursor_param"][param_id] == "none")) {
        console.debug(DEBUG_PREFIX,"Searching for parameter", param_id)
        let found = false;

        // Try default value
        if (model_parameter_ids.includes(ID_PARAM_DEFAULT[param_id])) {
            console.debug(DEBUG_PREFIX,"Found default parameter", ID_PARAM_DEFAULT[param_id])
            extension_settings.live2d.characterModelsSettings[character][model_path]["cursor_param"][param_id] = ID_PARAM_DEFAULT[param_id];
            saveSettingsDebounced();
            found = true
        }

        // Try known alternatives
        if (!found) {
            for (const value of ID_PARAM_PATCH[param_id]) {
                if (model_parameter_ids.includes(value)) {
                    console.debug(DEBUG_PREFIX,"Found alternative parameter", value)
                    extension_settings.live2d.characterModelsSettings[character][model_path]["cursor_param"][param_id] = value;
                    saveSettingsDebounced();
                    found = true
                    break;
                }
            }
        }

        if (!found) {
            console.log(DEBUG_PREFIX,"None of the known parameter value are present in the model:",ID_PARAM_DEFAULT[param_id],ID_PARAM_PATCH[param_id]);
            console.log(DEBUG_PREFIX,"Set it manually via the UI.");
        }
    }

    $(`#${param_select_id}`).val(extension_settings.live2d.characterModelsSettings[character][model_path]["cursor_param"][param_id]);
}
 
function loadAnimationUi(model_expressions, model_motions, expression_select_id, motion_select_id, expression_select_value, motion_select_value) {
    $(`#${expression_select_id}`)
    .find('option')
    .remove()
    .end()
    .append('<option value="none">Select expression</option>');

  $(`#${motion_select_id}`)
    .find('option')
    .remove()
    .end()
    .append('<option value="none">Select motion</option>');

    for (const i of model_expressions) {
        const name = i[Object.keys(i).find(key => key.toLowerCase() === "name")];
        const file = i[Object.keys(i).find(key => key.toLowerCase() === "file")];
        $(`#${expression_select_id}`).append(new Option(name+" ("+file+")", name));
    }

    for (const motion in model_motions) {
        if (model_motions[motion].length == 1) {
            $(`#${motion_select_id}`).append(new Option(motion, motion + "_id=random"));
        }
        else {
            $(`#${motion_select_id}`).append(new Option(motion + " random", motion + "_id=random"));
            for (const motion_id in model_motions[motion]) {
                const file = model_motions[motion][motion_id][Object.keys(model_motions[motion][motion_id]).find(key => key.toLowerCase() === "file")];
                $(`#${motion_select_id}`).append(new Option(motion + " " + motion_id + " ("+file+")", motion + "_id=" + motion_id));
            }
            }
        }

    $(`#${expression_select_id}`).val(expression_select_value);
    $(`#${motion_select_id}`).val(motion_select_value);
}