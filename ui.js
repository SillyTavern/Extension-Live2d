import { saveSettingsDebounced, getRequestHeaders } from "../../../../script.js";
import { getContext, extension_settings, modules } from "../../../extensions.js";

import {
    DEBUG_PREFIX,
    CHARACTER_LIVE2D_FOLDER,
    CLASSIFY_EXPRESSIONS,
    live2d
} from "./constants.js";

import { loadLive2d } from "./live2d.js";

export {
    onEnabledClick,
    onFollowCursorClick,
    onAutoSendInteractionClick,
    onShowFramesClick,
    onModelScaleChange,
    onCharacterChange,
    onCharacterRefreshClick,
    onShowAllCharactersClick,
    onModelRefreshClick,
    onModelChange,
    onExpressionOverrideChange,
    onMotionOverrideChange,
    onExpressionDefaultChange,
    onMotionDefaultChange,
    updateCharactersModels,
    updateCharactersList,
    updateCharactersListOnce
}

let characters_list = [];
let characters_models = {};

async function onEnabledClick() {
    extension_settings.live2d.enabled = $('#live2d_enabled').is(':checked');
    saveSettingsDebounced();

    await loadLive2d();
}

async function onFollowCursorClick() {
  extension_settings.live2d.followCursor = $('#live2d_follow_cursor').is(':checked');
  saveSettingsDebounced();

  await loadLive2d();
}

async function onAutoSendInteractionClick() {
  extension_settings.live2d.autoSendInteraction = $('#live2d_auto_send_interaction').is(':checked');
  saveSettingsDebounced();
}

async function onShowFramesClick() {
  extension_settings.live2d.showFrames = $('#live2d_show_frames').is(':checked');
  saveSettingsDebounced();
  await loadLive2d();
}

async function onCharacterChange() {
  const character = $("#live2d_character_select").val();

  $("#live2d_model_div").hide();
  $("#live2d_model_settings").hide();

  if (character == "none") {
      return;
  }

  $('#live2d_model_select')
          .find('option')
          .remove()
          .end()
          .append('<option value="none">None</option>')
          .val('none')

  if (characters_models[character] !== undefined) {
    for (const i of characters_models[character]) {
        const model_folder = i[0] + " (" + i[1].replace(/^.*[\\\/]/, '') + ")";
        const model_settings_path = i[1];
        $("#live2d_model_select").append(new Option(model_folder, model_settings_path));
    }
  }

  if (extension_settings.live2d.characterModelMapping[character] !== undefined) {
    $("#live2d_model_select").val(extension_settings.live2d.characterModelMapping[character]);
    $("#live2d_model_settings").show();
    loadModelUi();
  }

  $("#live2d_model_div").show();
}

async function onCharacterRefreshClick() {
  updateCharactersList();
  $("#live2d_character_select").val("none");
  $("#live2d_character_select").trigger("change");
}

async function onShowAllCharactersClick() {
  extension_settings.live2d.showAllCharacters = $('#live2d_show_all_characters').is(':checked');
  saveSettingsDebounced();
  updateCharactersList();
}

async function onModelScaleChange() {
    const character = $("#live2d_character_select").val();
    const model_path = $("#live2d_model_select").val();
    extension_settings.live2d.characterModelsSettings[character][model_path]["scale"] = Number($('#live2d_model_scale').val());
    $("#live2d_model_scale_value").text(extension_settings.live2d.characterModelsSettings[character][model_path]["scale"]);
    saveSettingsDebounced();
    await loadLive2d();
}

async function onModelRefreshClick() {
  updateCharactersModels(true);
  $("#live2d_model_select").val("none");
  $("#live2d_model_select").trigger("change");
  await loadLive2d();
}

async function onModelChange() {
  const character = $("#live2d_character_select").val();
  const model_path = $("#live2d_model_select").val();

  if (model_path == "none") {
    $("#live2d_model_settings").hide();
    delete extension_settings.live2d.characterModelMapping[character];
    saveSettingsDebounced();
    await loadLive2d();
    return;
  }

  extension_settings.live2d.characterModelMapping[character] = model_path;
  saveSettingsDebounced();

  await loadLive2d();
  loadModelUi();
}

async function onExpressionOverrideChange() {
  const character = $("#live2d_character_select").val();
  const model_path = $("#live2d_model_select").val();
  const expression_override = $("#live2d_expression_select_override").val();

  extension_settings.live2d.characterModelsSettings[character][model_path]["override"]["expression"] = expression_override;
  saveSettingsDebounced();
  await loadLive2d();
}

async function onMotionOverrideChange() {
  const character = $("#live2d_character_select").val();
  const model_path = $("#live2d_model_select").val();
  const motion_override = $("#live2d_motion_select_override").val();

  extension_settings.live2d.characterModelsSettings[character][model_path]["override"]["motion"] = motion_override;
  saveSettingsDebounced();
  await loadLive2d();
}

async function onExpressionDefaultChange() {
  const character = $("#live2d_character_select").val();
  const model_path = $("#live2d_model_select").val();
  const expression_default = $("#live2d_expression_select_default").val();

  extension_settings.live2d.characterModelsSettings[character][model_path]["default"]["expression"] = expression_default;
  saveSettingsDebounced();
  //await loadLive2d();
}

async function onMotionDefaultChange() {
  const character = $("#live2d_character_select").val();
  const model_path = $("#live2d_model_select").val();
  const motion_default = $("#live2d_motion_select_default").val();

  extension_settings.live2d.characterModelsSettings[character][model_path]["default"]["motion"] = motion_default;
  saveSettingsDebounced();
  //await loadLive2d();
}

async function loadModelUi() {
    const character = $("#live2d_character_select").val();
    const model_path = $("#live2d_model_select").val();
    const expression_ui = $("#live2d_expression_mapping");
    const hit_areas_ui = $("#live2d_hit_areas_mapping");
    const model = await live2d.Live2DModel.from(model_path);
  
    expression_ui.empty();
    hit_areas_ui.empty();
  
    console.debug(DEBUG_PREFIX, "loading settings of model:",model);
  
    let model_expressions = model.internalModel.settings.expressions;
    let model_motions = model.internalModel.settings.motions;
    let model_hit_areas = model.internalModel.hitAreas;
  
    if (model_expressions === undefined)
      model_expressions = [];
  
    if (model_motions === undefined)
      model_motions = {};
  
    if (model_hit_areas === undefined)
      model_hit_areas = {};
  
    console.debug(DEBUG_PREFIX, "expressions:", model_expressions);
    console.debug(DEBUG_PREFIX, "motions:", model_motions);
    console.debug(DEBUG_PREFIX, "hit areas:", model_hit_areas);
  
    // Initialize new model
    if (extension_settings.live2d.characterModelsSettings[character] === undefined)
      extension_settings.live2d.characterModelsSettings[character] = {};
  
    if (extension_settings.live2d.characterModelsSettings[character][model_path] === undefined) {
      const default_scale = 1.0
      extension_settings.live2d.characterModelsSettings[character][model_path] = {
        "scale": default_scale,
        "override": {"expression": "none", "motion": "none"},
        "default": {"expression": "none", "motion": "none"}
      };
  
      extension_settings.live2d.characterModelsSettings[character][model_path]["expressions"] = {};
      for (const expression of CLASSIFY_EXPRESSIONS) {
        extension_settings.live2d.characterModelsSettings[character][model_path]["expressions"][expression] = {'expression': 'none', 'motion': 'none'};
      }
  
      extension_settings.live2d.characterModelsSettings[character][model_path]["hitAreas"] = {};
      for (const area in model_hit_areas) {
        extension_settings.live2d.characterModelsSettings[character][model_path]["hitAreas"][area] = {'expression': 'none', 'motion': 'none', 'message': ''}
      }
  
      saveSettingsDebounced();
    }
  
    $("#live2d_model_scale").val(extension_settings.live2d.characterModelsSettings[character][model_path]["scale"]);
    $("#live2d_model_scale_value").text(extension_settings.live2d.characterModelsSettings[character][model_path]["scale"]);
  
    // Override expression/motion
    $("#live2d_expression_select_override")
    .find('option')
    .remove()
    .end()
    .append('<option value="none">Select expression</option>');
  
    $("#live2d_motion_select_override")
    .find('option')
    .remove()
    .end()
    .append('<option value="none">Select motion</option>');
  
    for (const i of model_expressions) {
      const name = i[Object.keys(i).find(key => key.toLowerCase() === "name")];
      $(`#live2d_expression_select_override`).append(new Option(name, name));
    }
  
    for (const motion in model_motions) {
      if (model_motions[motion].length == 1) {
        $(`#live2d_motion_select_override`).append(new Option(motion, motion+"_id=random"));
      }
      else {
          $(`#live2d_motion_select_override`).append(new Option(motion+" random", motion+"_id=random"));
        for (const motion_id in model_motions[motion]) {
          $(`#live2d_motion_select_override`).append(new Option(motion+" "+motion_id, motion+"_id="+motion_id));
        }
      }
    }
  
    $(`#live2d_expression_select_override`).val(extension_settings.live2d.characterModelsSettings[character][model_path]["override"]["expression"]);
    $(`#live2d_motion_select_override`).val(extension_settings.live2d.characterModelsSettings[character][model_path]["override"]["motion"]);
  
    // Default expression/motion
    $("#live2d_expression_select_default")
    .find('option')
    .remove()
    .end()
    .append('<option value="none">Select expression</option>');
  
    $("#live2d_motion_select_default")
    .find('option')
    .remove()
    .end()
    .append('<option value="none">Select motion</option>');
  
    for (const i of model_expressions) {
      const name = i[Object.keys(i).find(key => key.toLowerCase() === "name")];
      $(`#live2d_expression_select_default`).append(new Option(name, name));
    }
  
    for (const motion in model_motions) {
      $(`#live2d_motion_select_default`).append(new Option(motion+" random", motion+"_id=random"));
      for (const motion_id in model_motions[motion]) {
        $(`#live2d_motion_select_default`).append(new Option(motion+" "+motion_id, motion+"_id="+motion_id));
      }
    }
  
    $(`#live2d_expression_select_default`).val(extension_settings.live2d.characterModelsSettings[character][model_path]["default"]["expression"]);
    $(`#live2d_motion_select_default`).val(extension_settings.live2d.characterModelsSettings[character][model_path]["default"]["motion"]);
  
    // Hit areas mapping
    // TODO: factorize
    for (const hit_area in model_hit_areas) {
      hit_areas_ui.append(`
      <div class="live2d-parameter">
          <div class="live2d-parameter-title">
              <label for="live2d_hit_area_${hit_area}">
                ${hit_area}
              </label>
          </div>
          <div class="live2d_hit_area_select_div" class="live2d-select-div">
          <select id="live2d_hit_area_expression_select_${hit_area}">
          </select>
          <select id="live2d_hit_area_motion_select_${hit_area}">
          </select>
          <textarea id="live2d_hit_area_message_${hit_area}" type="text" class="text_pole textarea_compact" rows="2"
          placeholder="Write message te send when clicking the area."></textarea>
          </div>
      </div>
      `)
  
      $(`#live2d_hit_area_expression_select_${hit_area}`).append('<option value="none">Select expression</option>');
    
      for (const i of model_expressions) {
        const name = i[Object.keys(i).find(key => key.toLowerCase() === "name")];
        $(`#live2d_hit_area_expression_select_${hit_area}`).append(new Option(name, name));
      }
  
      $(`#live2d_hit_area_motion_select_${hit_area}`)
        .append('<option value="none">Select motion</option>');
    
      for (const motion in model_motions) {
        $(`#live2d_hit_area_motion_select_${hit_area}`).append(new Option(motion+" random", motion+"_id=random"));
        for (const motion_id in model_motions[motion]) {
          $(`#live2d_hit_area_motion_select_${hit_area}`).append(new Option(motion+" "+motion_id, motion+"_id="+motion_id));
        }
      }
      
      // Loading saved settings
      $(`#live2d_hit_area_expression_select_${hit_area}`).val(extension_settings.live2d.characterModelsSettings[character][model_path]["hitAreas"][hit_area]["expression"])
      $(`#live2d_hit_area_motion_select_${hit_area}`).val(extension_settings.live2d.characterModelsSettings[character][model_path]["hitAreas"][hit_area]["motion"])
      $(`#live2d_hit_area_message_${hit_area}`).val(extension_settings.live2d.characterModelsSettings[character][model_path]["hitAreas"][hit_area]["message"]);
  
      $(`#live2d_hit_area_expression_select_${hit_area}`).on("change", function() {updateHitAreaMapping(hit_area)});
      $(`#live2d_hit_area_motion_select_${hit_area}`).on("change", function() {updateHitAreaMapping(hit_area)});
      $(`#live2d_hit_area_message_${hit_area}`).on("change", function() {updateHitAreaMapping(hit_area)});
    }
  
    // Classify expressions mapping
    for (const expression of CLASSIFY_EXPRESSIONS) {
      expression_ui.append(`
      <div class="live2d-parameter">
          <div class="live2d-parameter-title">
              <label for="live2d_expression_${expression}">
                ${expression}
              </label>
          </div>
          <div class="live2d_expression_select_div" class="live2d-select-div">
          <select id="live2d_expression_select_${expression}">
          </select>
          <select id="live2d_motion_select_${expression}">
          </select>
          </div>
      </div>
      `)
      
      $(`#live2d_expression_select_${expression}`).append('<option value="none">Select expression</option>');
    
      for (const i of model_expressions) {
        const name = i[Object.keys(i).find(key => key.toLowerCase() === "name")];
        $(`#live2d_expression_select_${expression}`).append(new Option(name, name));
      }
  
      $(`#live2d_expression_select_${expression}`).val(extension_settings.live2d.characterModelsSettings[character][model_path]["expressions"][expression]["expression"])
  
      $(`#live2d_motion_select_${expression}`)
        .append('<option value="none">Select motion</option>');
    
      for (const motion in model_motions) {
        $(`#live2d_motion_select_${expression}`).append(new Option(motion+" random", motion+"_id=random"));
        for (const motion_id in model_motions[motion]) {
          $(`#live2d_motion_select_${expression}`).append(new Option(motion+" "+motion_id, motion+"_id="+motion_id));
        }
      }
  
      $(`#live2d_motion_select_${expression}`).val(extension_settings.live2d.characterModelsSettings[character][model_path]["expressions"][expression]["motion"])
  
      $(`#live2d_expression_select_${expression}`).on("change", function() {updateExpressionMapping(expression)});
      $(`#live2d_motion_select_${expression}`).on("change", function() {updateExpressionMapping(expression)});
    }
  
    $("#live2d_model_settings").show();
  }

  
async function updateHitAreaMapping(hitArea) {
    const character = $("#live2d_character_select").val();
    const model = $("#live2d_model_select").val();
    const model_expression = $(`#live2d_hit_area_expression_select_${hitArea}`).val();
    const model_motion = $(`#live2d_hit_area_motion_select_${hitArea}`).val();
    const message = $(`#live2d_hit_area_message_${hitArea}`).val();

    extension_settings.live2d.characterModelsSettings[character][model]["hitAreas"][hitArea] = {"expression": model_expression, "motion": model_motion, "message": message};
    saveSettingsDebounced();

    console.debug(DEBUG_PREFIX,"Updated hit area mapping:",hitArea,extension_settings.live2d.characterModelsSettings[character][model]["hitAreas"][hitArea]);
    }

    async function updateExpressionMapping(expression) {
    const character = $("#live2d_character_select").val();
    const model = $("#live2d_model_select").val();
    const model_expression = $(`#live2d_expression_select_${expression}`).val();
    const model_motion = $(`#live2d_motion_select_${expression}`).val();

    extension_settings.live2d.characterModelsSettings[character][model]["expressions"][expression] = {"expression": model_expression, "motion": model_motion};
    saveSettingsDebounced();

    console.debug(DEBUG_PREFIX,"Updated expression mapping:",expression,extension_settings.live2d.characterModelsSettings[character][model]["expressions"][expression]);
}

function updateCharactersList() {
    let current_characters = new Set();
    const context = getContext();
    for (const i of context.characters) {
        current_characters.add(i.name);
    }

    current_characters = Array.from(current_characters);

    if (current_characters.length == 0)
        return;

    if (!extension_settings.live2d.showAllCharacters) {
        let chat_members = [];

        // group mode
        if (context.name2 == "") {
            for(const i of context.groups) {
                if (i.id == context.groupId) {
                    for(const j of i.members) {
                        let char_name = j.replace(/\.[^/.]+$/, "")
                        if (char_name.includes("default_"))
                            char_name = char_name.substring("default_".length);
                        
                        chat_members.push(char_name);
                        console.debug(DEBUG_PREFIX,"New group member:",j.replace(/\.[^/.]+$/, ""))
                    }
                }
            }
        }
        else
            chat_members = [context.name2];
        
        chat_members.sort();

        console.debug(DEBUG_PREFIX,"Chat members",chat_members)

        // Sort group character on top
        for (const i of chat_members) {
            let index = current_characters.indexOf(i);
            if (index != -1) {
                console.debug(DEBUG_PREFIX,"Moving to top",i)
                current_characters.splice(index, 1);
            }
        }
        
        current_characters = chat_members;
    }

    if (JSON.stringify(characters_list) !== JSON.stringify(current_characters)) {
        characters_list = current_characters

        $('#live2d_character_select')
            .find('option')
            .remove()
            .end()
            .append('<option value="none">Select Character</option>')
            .val('none')

        for (const charName of characters_list) {
            $("#live2d_character_select").append(new Option(charName, charName));
        }

        console.debug(DEBUG_PREFIX, "Updated character list to:", characters_list);
    }
}

async function updateCharactersModels(refreshButton=false) {
    const context = getContext();
    //const character = context.name2; // TODO group chat
    const is_group = context.groupId !== null;
    let chat_members = [];

    console.debug(DEBUG_PREFIX,"Updating models mapping");

    // TODO: replace using group-chat funct
    if (is_group) {
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
    else
        chat_members = [context.name2];

    for (const character of chat_members) {
      if (refreshButton || characters_models[character] === undefined){
        characters_models[character] = await getCharacterLive2dFiles(character);
        console.debug(DEBUG_PREFIX,"Updated models of",character);
      }
    }

    console.debug(DEBUG_PREFIX,"Updated models to:",characters_models);
    $("#live2d_character_select").trigger("change");
    await loadLive2d();
}

const delay = s => new Promise(res => setTimeout(res, s*1000));

async function updateCharactersListOnce() {
    console.debug(DEBUG_PREFIX,"UDPATING char list", characters_list)
    while (characters_list.length == 0) {
        console.debug(DEBUG_PREFIX,"UDPATING char list")
        updateCharactersList();
        await delay(1);
    }
  }

//#############################//
//  API Calls                  //
//#############################//

async function getCharacterLive2dFiles(name) {
    console.debug(DEBUG_PREFIX, "getting live2d model json file for", name);
  
    try {
        const result = await fetch(`/api/assets/character?name=${encodeURIComponent(name)}&category=${CHARACTER_LIVE2D_FOLDER}`, {
            method: 'POST',
            headers: getRequestHeaders(),
        });
        let files = result.ok ? (await result.json()) : [];
        return files;
    }
    catch (err) {
        console.log(err);
        return [];
    }
  }
