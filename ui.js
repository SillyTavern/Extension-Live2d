import { saveSettingsDebounced, getRequestHeaders, callPopup } from "../../../../script.js";
import { getContext, extension_settings, renderExtensionTemplate, } from "../../../extensions.js";

import {
  MODULE_NAME,
  DEBUG_PREFIX,
  CHARACTER_LIVE2D_FOLDER,
  CLASSIFY_EXPRESSIONS,
  live2d,
  TEST_MESSAGE,
  CANVAS_ID,
  delay
} from "./constants.js";

import {
  loadLive2d,
  rescaleModel,
  removeModel,
  moveModel,
  playExpression,
  playMotion,
  playTalk
} from "./live2d.js";

import {
  currentChatMembers,
  loadAnimationUi
} from "./utils.js"

export {
  onEnabledClick,
  onFollowCursorClick,
  onAutoSendInteractionClick,
  onShowFramesClick,
  onCharacterChange,
  onCharacterRefreshClick,
  onCharacterRemoveClick,
  onShowAllCharactersClick,
  onModelRefreshClick,
  onModelChange,
  onModelScaleChange,
  onModelCoordChange,
  onParamMouthOpenIdChange,
  onMouthOpenSpeedChange,
  onMouthTimePerCharacterChange,
  onAnimationMappingChange,
  updateCharactersModels,
  updateCharactersList,
  updateCharactersListOnce,
  playStarterAnimation
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
  const character = String($("#live2d_character_select").val());

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

async function onCharacterRemoveClick() {
  const character = String($("#live2d_character_select").val());

  if (character == "none")
    return;

  let nb_character_models = 0;
  if (extension_settings.live2d.characterModelsSettings[character] !== undefined)
    nb_character_models = Object.keys(extension_settings.live2d.characterModelsSettings[character]).length;
  const template = `<div class="m-b-1">Are you sure you want to remove all live2d model settings for character ${character}? (model settings: ${nb_character_models})</div>`;
  const confirmation = await callPopup(template, 'confirm');

  if (confirmation) {
    $("#live2d_model_select").val("none");
    $("#live2d_model_settings").hide();
    delete extension_settings.live2d.characterModelMapping[character];
    delete extension_settings.live2d.characterModelsSettings[character];
    saveSettingsDebounced();
    await removeModel(character);
    console.debug(DEBUG_PREFIX, "Deleted all settings for", character);
  }
  else {
    console.debug(DEBUG_PREFIX, "Connection refused by user");
  }
}

async function onModelRefreshClick() {
  updateCharactersModels(true);
  $("#live2d_model_select").val("none");
  $("#live2d_model_select").trigger("change");
}

async function onModelChange() {
  const character = String($("#live2d_character_select").val());
  const model_path = String($("#live2d_model_select").val());

  if (model_path == "none") {
    $("#live2d_model_settings").hide();
    delete extension_settings.live2d.characterModelMapping[character];
    saveSettingsDebounced();
    await removeModel(character);
    return;
  }

  extension_settings.live2d.characterModelMapping[character] = model_path;
  saveSettingsDebounced();

  await loadModelUi();
  await loadLive2d();
}

async function onModelScaleChange() {
  const character = String($("#live2d_character_select").val());
  const model_path = String($("#live2d_model_select").val());
  extension_settings.live2d.characterModelsSettings[character][model_path]["scale"] = Number($('#live2d_model_scale').val());
  $("#live2d_model_scale_value").text(extension_settings.live2d.characterModelsSettings[character][model_path]["scale"]);
  saveSettingsDebounced();
  rescaleModel(character);
}

async function onModelCoordChange() {
  const character = String($("#live2d_character_select").val());
  const model_path = String($("#live2d_model_select").val());
  extension_settings.live2d.characterModelsSettings[character][model_path]["x"] = Number($('#live2d_model_x').val());
  extension_settings.live2d.characterModelsSettings[character][model_path]["y"] = Number($('#live2d_model_y').val());
  $("#live2d_model_x_value").text(extension_settings.live2d.characterModelsSettings[character][model_path]["x"]);
  $("#live2d_model_y_value").text(extension_settings.live2d.characterModelsSettings[character][model_path]["y"]);
  saveSettingsDebounced();
  moveModel(character, extension_settings.live2d.characterModelsSettings[character][model_path]["x"], extension_settings.live2d.characterModelsSettings[character][model_path]["y"]);
}

async function onParamMouthOpenIdChange() {
  const character = String($("#live2d_character_select").val());
  const model_path = String($("#live2d_model_select").val());
  extension_settings.live2d.characterModelsSettings[character][model_path]["param_mouth_open_y_id"] = $('#live2d_param_mouth_open_y_id_select').val();
  saveSettingsDebounced();

  playTalk(character, TEST_MESSAGE);
}

async function onMouthOpenSpeedChange() {
  const character = String($("#live2d_character_select").val());
  const model_path = String($("#live2d_model_select").val());
  extension_settings.live2d.characterModelsSettings[character][model_path]["mouth_open_speed"] = Number($('#live2d_mouth_open_speed').val());
  $("#live2d_mouth_open_speed_value").text(extension_settings.live2d.characterModelsSettings[character][model_path]["mouth_open_speed"]);
  saveSettingsDebounced();

  playTalk(character, TEST_MESSAGE);
}

async function onMouthTimePerCharacterChange() {
  const character = String($("#live2d_character_select").val());
  const model_path = String($("#live2d_model_select").val());
  extension_settings.live2d.characterModelsSettings[character][model_path]["mouth_time_per_character"] = Number($('#live2d_mouth_time_per_character').val());
  $("#live2d_mouth_time_per_character_value").text(extension_settings.live2d.characterModelsSettings[character][model_path]["mouth_time_per_character"]);
  saveSettingsDebounced();

  playTalk(character, TEST_MESSAGE);
}

async function onAnimationMappingChange(type) {
  const character = String($("#live2d_character_select").val());
  const model_path = String($("#live2d_model_select").val());
  let expression;
  let motion;

  switch (type) {
    case "animation_override":
      expression = $("#live2d_expression_select_override").val();
      motion = $("#live2d_motion_select_override").val();

      extension_settings.live2d.characterModelsSettings[character][model_path]["animation_override"]["expression"] = expression;
      extension_settings.live2d.characterModelsSettings[character][model_path]["animation_override"]["motion"] = motion;
      console.debug(DEBUG_PREFIX,"Updated override animation of",character,":",extension_settings.live2d.characterModelsSettings[character][model_path]["animation_override"]);
      break;

    case "animation_starter":
      expression = $("#live2d_animation_starter_expression_select").val();
      motion = $("#live2d_animation_starter_motion_select").val();

      extension_settings.live2d.characterModelsSettings[character][model_path]["animation_starter"]["expression"] = expression;
      extension_settings.live2d.characterModelsSettings[character][model_path]["animation_starter"]["motion"] = motion;
      console.debug(DEBUG_PREFIX,"Updated override animation of",character,":",extension_settings.live2d.characterModelsSettings[character][model_path]["animation_starter"]);
      break;

    case "animation_default":
      expression = $("#live2d_expression_select_default").val();
      motion = $("#live2d_motion_select_default").val();

      extension_settings.live2d.characterModelsSettings[character][model_path]["animation_default"]["expression"] = expression;
      extension_settings.live2d.characterModelsSettings[character][model_path]["animation_default"]["motion"] = motion;
      console.debug(DEBUG_PREFIX,"Updated override animation of",character,":",extension_settings.live2d.characterModelsSettings[character][model_path]["animation_default"]);
      break;

    default:
      console.error(DEBUG_PREFIX,"Unexpected type:",type);
      
  }

  saveSettingsDebounced();
  
  if (expression != "none")
    playExpression(character, expression);
  if (motion != "none")
    playMotion(character, motion, true);
}

async function loadModelUi() {
  const character = String($("#live2d_character_select").val());
  const model_path = String($("#live2d_model_select").val());
  const expression_ui = $("#live2d_expression_mapping");
  const hit_areas_ui = $("#live2d_hit_areas_mapping");
  const model = await live2d.Live2DModel.from(model_path);

  expression_ui.empty();
  hit_areas_ui.empty();

  console.debug(DEBUG_PREFIX, "loading settings of model:", model);

  let model_expressions = model.internalModel.settings.expressions;
  let model_motions = model.internalModel.settings.motions;
  let model_hit_areas = model.internalModel.hitAreas;
  let model_parameter_ids = model.internalModel.coreModel._model?.parameters?.ids ?? []; // Some model have it there
  
  // Free memory
  model.destroy(true, true, true);

  // Default values
  if (model_expressions === undefined)
    model_expressions = [];

  if (model_motions === undefined)
    model_motions = {};

  if (model_hit_areas === undefined)
    model_hit_areas = {};

  if (model_parameter_ids === undefined)
    model_parameter_ids = [];

  model_expressions.sort();
  model_parameter_ids.sort();

  console.debug(DEBUG_PREFIX, "expressions:", model_expressions);
  console.debug(DEBUG_PREFIX, "motions:", model_motions);
  console.debug(DEBUG_PREFIX, "hit areas:", model_hit_areas);
  console.debug(DEBUG_PREFIX, "parameter ids:", model_parameter_ids);

  // Initialize new model
  if (extension_settings.live2d.characterModelsSettings[character] === undefined)
    extension_settings.live2d.characterModelsSettings[character] = {};

  if (extension_settings.live2d.characterModelsSettings[character][model_path] === undefined) {
    const default_scale = 1.0
    extension_settings.live2d.characterModelsSettings[character][model_path] = {
      "scale": default_scale,
      "x": 0.0,
      "y": 0.0,
      "param_mouth_open_y_id": "none",
      "mouth_open_speed": 1.0,
      "mouth_time_per_character": 30,
      "animation_starter": { "expression": "none", "motion": "none" },
      "animation_override": { "expression": "none", "motion": "none" },
      "animation_default": { "expression": "none", "motion": "none" },
      "hit_areas": {},
      "classify_mapping": {}
    };

    for (const expression of CLASSIFY_EXPRESSIONS) {
      extension_settings.live2d.characterModelsSettings[character][model_path]["classify_mapping"][expression] = { 'expression': 'none', 'motion': 'none' };
    }

    for (const area in model_hit_areas) {
      extension_settings.live2d.characterModelsSettings[character][model_path]["hit_areas"][area] = { 'expression': 'none', 'motion': 'none', 'message': '' }
    }

    saveSettingsDebounced();
  }

  $("#live2d_model_scale").val(extension_settings.live2d.characterModelsSettings[character][model_path]["scale"]);
  $("#live2d_model_scale_value").text(extension_settings.live2d.characterModelsSettings[character][model_path]["scale"]);

  $("#live2d_model_x").val(extension_settings.live2d.characterModelsSettings[character][model_path]["x"]);
  $("#live2d_model_x_value").text(extension_settings.live2d.characterModelsSettings[character][model_path]["x"]);
  $("#live2d_model_y").val(extension_settings.live2d.characterModelsSettings[character][model_path]["y"]);
  $("#live2d_model_y_value").text(extension_settings.live2d.characterModelsSettings[character][model_path]["y"]);

  $("#live2d_mouth_open_speed").val(extension_settings.live2d.characterModelsSettings[character][model_path]["mouth_open_speed"]);
  $("#live2d_mouth_open_speed_value").text(extension_settings.live2d.characterModelsSettings[character][model_path]["mouth_open_speed"]);

  $("#live2d_mouth_time_per_character").val(extension_settings.live2d.characterModelsSettings[character][model_path]["mouth_time_per_character"]);
  $("#live2d_mouth_time_per_character_value").text(extension_settings.live2d.characterModelsSettings[character][model_path]["mouth_time_per_character"]);

  // Param mouth open Y id candidates
  $("#live2d_param_mouth_open_y_id_select")
    .find('option')
    .remove()
    .end()
    .append('<option value="none">Select parameter id</option>');

  for (const i of model_parameter_ids) {
    $(`#live2d_param_mouth_open_y_id_select`).append(new Option(i, i));
  }
  
  $("#live2d_param_mouth_open_y_id_select").val(extension_settings.live2d.characterModelsSettings[character][model_path]["param_mouth_open_y_id"]);

  // Starter expression/motion
  loadAnimationUi(
    model_expressions,
    model_motions,
    "live2d_animation_starter_expression_select",
    "live2d_animation_starter_motion_select",
    extension_settings.live2d.characterModelsSettings[character][model_path]["animation_starter"]["expression"],
    extension_settings.live2d.characterModelsSettings[character][model_path]["animation_starter"]["motion"]);

  // Override expression/motion
  loadAnimationUi(
    model_expressions,
    model_motions,
    "live2d_expression_select_override",
    "live2d_motion_select_override",
    extension_settings.live2d.characterModelsSettings[character][model_path]["animation_override"]["expression"],
    extension_settings.live2d.characterModelsSettings[character][model_path]["animation_override"]["motion"]);

  // Default expression/motion
  loadAnimationUi(
    model_expressions,
    model_motions,
    "live2d_expression_select_default",
    "live2d_motion_select_default",
    extension_settings.live2d.characterModelsSettings[character][model_path]["animation_default"]["expression"],
    extension_settings.live2d.characterModelsSettings[character][model_path]["animation_default"]["motion"]);

  // Hit areas mapping
  for (const hit_area in model_hit_areas) {
    hit_areas_ui.append(`
    <div class="live2d-parameter">
        <div class="live2d-parameter-title">
            <label for="live2d_hit_area_${hit_area}">
              ${hit_area}
            </label>
        </div>
        <div>
            <div class="live2d-select-div">
                <select id="live2d_hit_area_expression_select_${hit_area}">
                </select>
                <div id="live2d_hit_area_expression_replay_${hit_area}" class="live2d_replay_button menu_button">
                    <i class="fa-solid fa-arrow-rotate-left"></i>
                </div>
            </div>
            <div class="live2d-select-div">
                <select id="live2d_hit_area_motion_select_${hit_area}">
                </select>
                <div id="live2d_hit_area_motion_replay_${hit_area}" class="live2d_replay_button menu_button">
                    <i class="fa-solid fa-arrow-rotate-left"></i>
                </div>
            </div>
            <textarea id="live2d_hit_area_message_${hit_area}" type="text" class="text_pole textarea_compact" rows="2"
        placeholder="Write message te send when clicking the area."></textarea>
        </div>
    </div>
    `)

    loadAnimationUi(
      model_expressions,
      model_motions,
      `live2d_hit_area_expression_select_${hit_area}`,
      `live2d_hit_area_motion_select_${hit_area}`,
      extension_settings.live2d.characterModelsSettings[character][model_path]["hit_areas"][hit_area]["expression"],
      extension_settings.live2d.characterModelsSettings[character][model_path]["hit_areas"][hit_area]["motion"]);

    $(`#live2d_hit_area_message_${hit_area}`).val(extension_settings.live2d.characterModelsSettings[character][model_path]["hit_areas"][hit_area]["message"]);

    $(`#live2d_hit_area_expression_select_${hit_area}`).on("change", function () { updateHitAreaMapping(hit_area) });
    $(`#live2d_hit_area_motion_select_${hit_area}`).on("change", function () { updateHitAreaMapping(hit_area) });
    $(`#live2d_hit_area_message_${hit_area}`).on("change", function () { updateHitAreaMapping(hit_area) });
    $(`#live2d_hit_area_expression_replay_${hit_area}`).on("click", function () { updateHitAreaMapping(hit_area) });
    $(`#live2d_hit_area_motion_replay_${hit_area}`).on("click", function () { updateHitAreaMapping(hit_area) });
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
        <div>
            <div class="live2d-select-div">
                <select id="live2d_expression_select_${expression}">
                </select>
                <div id="live2d_expression_replay_${expression}" class="live2d_replay_button menu_button">
                    <i class="fa-solid fa-arrow-rotate-left"></i>
                </div>
            </div>
            <div class="live2d-select-div">
                <select id="live2d_motion_select_${expression}">
                </select>
                <div id="live2d_motion_replay_${expression}" class="live2d_replay_button menu_button">
                    <i class="fa-solid fa-arrow-rotate-left"></i>
                </div>
            </div>
        </div>
    </div>
    `)

    loadAnimationUi(
      model_expressions,
      model_motions,
      `live2d_expression_select_${expression}`,
      `live2d_motion_select_${expression}`,
      extension_settings.live2d.characterModelsSettings[character][model_path]["classify_mapping"][expression]["expression"],
      extension_settings.live2d.characterModelsSettings[character][model_path]["classify_mapping"][expression]["motion"]);

    $(`#live2d_expression_select_${expression}`).on("change", function () { updateExpressionMapping(expression) });
    $(`#live2d_motion_select_${expression}`).on("change", function () { updateExpressionMapping(expression) });
    $(`#live2d_expression_replay_${expression}`).on("click", function () { updateExpressionMapping(expression) });
    $(`#live2d_motion_replay_${expression}`).on("click", function () { updateExpressionMapping(expression) });
  }

  $("#live2d_model_settings").show();
}


async function updateHitAreaMapping(hitArea) {
  const character = String($("#live2d_character_select").val());
  const model = String($("#live2d_model_select").val());
  const model_expression = $(`#live2d_hit_area_expression_select_${hitArea}`).val();
  const model_motion = $(`#live2d_hit_area_motion_select_${hitArea}`).val();
  const message = $(`#live2d_hit_area_message_${hitArea}`).val();

  extension_settings.live2d.characterModelsSettings[character][model]["hit_areas"][hitArea] = { "expression": model_expression, "motion": model_motion, "message": message };
  saveSettingsDebounced();

  console.debug(DEBUG_PREFIX, "Updated hit area mapping:", hitArea, extension_settings.live2d.characterModelsSettings[character][model]["hit_areas"][hitArea]);

  // Play new setting
  if (model_expression != "none")
    playExpression(character, model_expression);
  if (model_motion != "none")
    playMotion(character, model_motion, true);
}

async function updateExpressionMapping(expression) {
  const character = String($("#live2d_character_select").val());
  const model = String($("#live2d_model_select").val());
  const model_expression = $(`#live2d_expression_select_${expression}`).val();
  const model_motion = $(`#live2d_motion_select_${expression}`).val();

  extension_settings.live2d.characterModelsSettings[character][model]["classify_mapping"][expression] = { "expression": model_expression, "motion": model_motion };
  saveSettingsDebounced();

  // Play new setting
  if (model_expression != "none")
    playExpression(character, model_expression);
  if (model_motion != "none")
    playMotion(character, model_motion, true);

  console.debug(DEBUG_PREFIX, "Updated expression mapping:", expression, extension_settings.live2d.characterModelsSettings[character][model]["classify_mapping"][expression]);
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
    let chat_members = currentChatMembers();
    console.debug(DEBUG_PREFIX, "Chat members", chat_members)

    // Sort group character on top
    for (const i of chat_members) {
      let index = current_characters.indexOf(i);
      if (index != -1) {
        console.debug(DEBUG_PREFIX, "Moving to top", i)
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

async function updateCharactersModels(refreshButton = false) {
  const context = getContext();
  let chat_members = currentChatMembers();

  console.debug(DEBUG_PREFIX, "Updating models mapping");

  // Assets folder models
  const assets = await getAssetsLive2dFiles();

  console.debug(DEBUG_PREFIX, "Models from assets folder:",assets["live2d"]);

  for (const character of chat_members) {
    if (refreshButton || characters_models[character] === undefined) {
      const local_models = await getCharacterLive2dFiles(character);
      characters_models[character] = [];
      for (const entry of local_models)
        characters_models[character].push([entry[0]+" (char folder)",entry[1]])
      for (const entry of assets["live2d"])
        characters_models[character].push([entry[0]+" (assets folder)",entry[1]])
      console.debug(DEBUG_PREFIX, "Updated models of", character);
    }
  }

  console.debug(DEBUG_PREFIX, "Updated models to:", characters_models);
  $("#live2d_character_select").trigger("change");
}

async function updateCharactersListOnce() {
  console.debug(DEBUG_PREFIX, "UDPATING char list", characters_list)
  while (characters_list.length == 0) {
    console.debug(DEBUG_PREFIX, "UDPATING char list")
    updateCharactersList();
    await delay(1000);
  }
}

//#############################//
//  API Calls                  //
//#############################//

async function getAssetsLive2dFiles() {
  console.debug(DEBUG_PREFIX, "getting live2d model json file from assets folder");

  try {
    const result = await fetch(`/api/assets/get`, {
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

async function playStarterAnimation() {
  const context = getContext();
  const group_id = context.groupId;
  let chat_members = currentChatMembers();

  console.debug(DEBUG_PREFIX,"Starting live2d first time");
  await loadLive2d();
  //await delay(300); // security to avoid model glitch

  console.debug(DEBUG_PREFIX,"Playing starters animation");
  for (const character of chat_members) {
    const model_path = extension_settings.live2d.characterModelMapping[character];

    if (model_path === undefined)
      continue;

    const starter_animation = extension_settings.live2d.characterModelsSettings[character][model_path]["animation_starter"];
    console.debug(DEBUG_PREFIX,"Playing starter animation of",character);

    if (starter_animation.expression != "none")
      playExpression(character,starter_animation.expression);
    if (starter_animation.motion != "none")
      playMotion(character, starter_animation.motion);
  }
}