/*
DONE:
- Features
  - Background transparent
  - Load character model from character folder
  - Update character model when chat change
  - Resize model option
  - model setting per character
  - UI to plug classify expression to live2d expression/motion
  - Update animations when new message received base on classify and ui mapping
  - Allow multiple models for one character / ability to switch / force animation
  - option to test expression/animation (use override menu)
  - add a default expression and fallback to it when mapping for classified expression is none
  - remove case sensitivy to expression name, some model have "name" and "Name" keys

TODO:
- Security
  - wait before sending interaction message if one is running
  - Resize model on resize window
- Features
  - button clear character mapping / all
  - Automatically load hit frames and animation list
  - UI for user to connect hit frames with animation
  - Play mouth animation when talking (message length dependant)
  - Group chat mode
  - activate/disable hitframes message + auto-send
  - option to delete a model mapping
  - option to detach live2d ui
  - option to hide sprite
*/

import { loadFileToDocument, trimToEndSentence, trimToStartSentence } from "../../../utils.js";
import { saveSettingsDebounced, getRequestHeaders, eventSource, event_types, sendMessageAsUser } from "../../../../script.js";
import { getContext, extension_settings, ModuleWorkerWrapper, getApiUrl, doExtrasFetch, modules } from "../../../extensions.js";
export { MODULE_NAME };

const extensionFolderPath = `scripts/extensions/third-party/Extension-Live2d`;

const MODULE_NAME = 'Live2d';
const DEBUG_PREFIX = "<Live2d extension> ";
const UPDATE_INTERVAL = 1000;
const CHARACTER_LIVE2D_FOLDER = "live2d";

const JS_LIBS = [
  "live2dcubismcore.min.js",
  "live2d.min.js",
  "pixi.min.js",
  "index.min.js",
  "extra.min.js"
]

// Load JS libraries
for(const i of JS_LIBS){
  await loadFileToDocument(
      `${extensionFolderPath}/lib/${i}`,
      "js"
  );
}

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

const live2d = PIXI.live2d;

let characters_list = []
let characters_models = {}
let models = {};
let app = null;

//#############################//s
//  Extension UI and Settings  //
//#############################//

const defaultSettings = {
    // Global settings
    enabled: false,
    followCursor: false,
    autoSendInteraction: false,

    // Debug
    showFrames: false,

    // Character model mapping
    characterModelMapping: {},
    characterModelsSettings: {},
}

function loadSettings() {
    if (extension_settings.live2d === undefined)
        extension_settings.live2d = {};

    // Ensure good format
    if (Object.keys(extension_settings.live2d).length === 0) {
        Object.assign(extension_settings.live2d, defaultSettings)
    }

    $("#live2d_enabled").prop('checked', extension_settings.live2d.enabled);
    $("#live2d_follow_cursor").prop('checked', extension_settings.live2d.followCursor);
    $("#live2d_auto_send_interaction").prop('checked', extension_settings.live2d.autoSendInteraction);
    
    $("#live2d_show_frames").prop('checked', extension_settings.live2d.showFrames);
}

async function onEnabledClick() {
    extension_settings.live2d.enabled = $('#live2d_enabled').is(':checked');
    saveSettingsDebounced();

    loadLive2d();
}

async function onFollowCursorClick() {
  extension_settings.live2d.followCursor = $('#live2d_follow_cursor').is(':checked');
  saveSettingsDebounced();

  loadLive2d();
}

async function onAutoSendInteractionClick() {
  extension_settings.live2d.autoSendInteraction = $('#live2d_auto_send_interaction').is(':checked');
  saveSettingsDebounced();
}

async function onShowFramesClick() {
  extension_settings.live2d.showFrames = $('#live2d_show_frames').is(':checked');
  saveSettingsDebounced();
  loadLive2d();
}

async function onModelScaleChange() {
  const character = $("#live2d_character_select").val();
  const model_path = $("#live2d_model_select").val();
  extension_settings.live2d.characterModelsSettings[character][model_path]["scale"] = Number($('#live2d_model_scale').val());
  $("#live2d_model_scale_value").text(extension_settings.live2d.characterModelsSettings[character][model_path]["scale"]);
  saveSettingsDebounced();
  loadLive2d();
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

      for (const i of characters_models[character]) {
          const model_folder = i[0] + " (" + i[1].replace(/^.*[\\\/]/, '') + ")";
          const model_settings_path = i[1];
          $("#live2d_model_select").append(new Option(model_folder, model_settings_path));
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

async function onModelRefreshClick() {
  updateCharactersModels(true);
  $("#live2d_model_select").val("none");
  $("#live2d_model_select").trigger("change");
}

async function onModelChange() {
  const character = $("#live2d_character_select").val();
  const model_path = $("#live2d_model_select").val();

  if (model_path == "none") {
    $("#live2d_model_settings").hide();
    delete extension_settings.live2d.characterModelMapping[character];
    saveSettingsDebounced();
    loadLive2d();
    return;
  }

  extension_settings.live2d.characterModelMapping[character] = model_path;
  saveSettingsDebounced();

  loadModelUi();
  loadLive2d();
}

async function onExpressionOverrideChange() {
  const character = $("#live2d_character_select").val();
  const model_path = $("#live2d_model_select").val();
  const expression_override = $("#live2d_expression_select_override").val();

  extension_settings.live2d.characterModelsSettings[character][model_path]["override"]["expression"] = expression_override;
  saveSettingsDebounced();
  loadLive2d();
}

async function onMotionOverrideChange() {
  const character = $("#live2d_character_select").val();
  const model_path = $("#live2d_model_select").val();
  const motion_override = $("#live2d_motion_select_override").val();

  extension_settings.live2d.characterModelsSettings[character][model_path]["override"]["motion"] = motion_override;
  saveSettingsDebounced();
  loadLive2d();
}

async function onExpressionDefaultChange() {
  const character = $("#live2d_character_select").val();
  const model_path = $("#live2d_model_select").val();
  const expression_default = $("#live2d_expression_select_default").val();

  extension_settings.live2d.characterModelsSettings[character][model_path]["default"]["expression"] = expression_default;
  saveSettingsDebounced();
  loadLive2d();
}

async function onMotionDefaultChange() {
  const character = $("#live2d_character_select").val();
  const model_path = $("#live2d_model_select").val();
  const motion_default = $("#live2d_motion_select_default").val();

  extension_settings.live2d.characterModelsSettings[character][model_path]["default"]["motion"] = motion_default;
  saveSettingsDebounced();
  loadLive2d();
}

async function loadModelUi() {
  const character = $("#live2d_character_select").val();
  const model_path = $("#live2d_model_select").val();
  const expression_ui = $("#live2d_expression_mapping");
  const hit_frame_ui = $("#live2d_hit_frame_mapping");
  const model = await live2d.Live2DModel.from(model_path);

  expression_ui.empty();
  hit_frame_ui.empty();

  console.debug(DEBUG_PREFIX, "loading settings of model:",model);

  let model_expressions = model.internalModel.settings.expressions;
  let model_motions = model.internalModel.settings.motions;

  if (model_expressions === undefined)
    model_expressions = [];

  if (model_motions === undefined)
    model_motions = [];

  console.debug(DEBUG_PREFIX, "expressions:",model_expressions);
  console.debug(DEBUG_PREFIX, "motions:",model_motions);

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

  $("#live2d_expression_select_override").on("change", onExpressionOverrideChange);
  $("#live2d_motion_select_override").on("change", onMotionOverrideChange);

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

  $("#live2d_expression_select_default").on("change", onExpressionDefaultChange);
  $("#live2d_motion_select_default").on("change", onMotionDefaultChange);

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


  // load model settings
  const model_expression_mapping_dom = $("#live2d_expression_mapping");

  //for (const i in model.internalModel.)

  // Load mapped settings


  $("#live2d_model_settings").show();
}

async function updateExpressionMapping(expression) {
  const character = $("#live2d_character_select").val();
  const model = $("#live2d_model_select").val();
  const model_expression = $(`#live2d_expression_select_${expression}`).val();
  const model_motion = $(`#live2d_motion_select_${expression}`).val();

  extension_settings.live2d.characterModelsSettings[character][model]["expressions"][expression] = {"expression": model_expression, "motion": model_motion};
  saveSettingsDebounced();

  console.debug(DEBUG_PREFIX,"Updated:",expression,extension_settings.live2d.characterModelsSettings[character][model]["expressions"][expression]);
}

//#############################//
//  Methods                    //
//#############################//


async function onHitAreasClick(hitAreas) {
  $('#send_textarea').val("") // clear message area to avoid double message
  console.debug(DEBUG_PREFIX,"Detected click on hit areas:", hitAreas);

  //sendMessageAsUser(text);
  
  // TODO: auto-send option
  //getContext().generate();
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
  if(app !== null) {
    app.destroy();
    app = null;
  }

  document.getElementById("live2d-canvas").hidden = true;

  if (!extension_settings.live2d.enabled)
    return;

  const character = getContext().name2;

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

  // DBG
  //model.on("click", () => {model.expression();model.internalModel.motionManager.stopAllMotions(); model.motion("")}); // check stop motion

  // handle tapping
  model.on("hit", (hitAreas) => onHitAreasClick(hitAreas));
  /*
  model.on("hit", (hitAreas) => {

    if (hitAreas.includes("body")) {
      model.motion("tap_body");

      sendMessage("*Click on her body to make her talk about her uniform.*");
    }

    if (hitAreas.includes("mouth")) {
      //model.expression();
      model.motion("pinch_out");
      sendMessage("*Click on her mouth for testing animation and sound.*");
    }
    else {
      if (hitAreas.includes("head")) {
        model.motion("pinch_in");
        model.expression();

        sendMessage("*Click on her head to test other animation and gives her a headpat.*");
      }
    }
  });
  */

  // Set cursor behavior
  model._autoInteract = extension_settings.live2d.followCursor;

  console.debug(DEBUG_PREFIX,model);
  
}

async function updateCharactersModels(refreshButton=false) {
  const character = getContext().name2; // TODO group chat
  if (refreshButton || characters_models[character] === undefined){
    characters_models[character] = await getCharacterLive2dFiles(character);
    console.debug(DEBUG_PREFIX,"Updated models to:",characters_models);

    $("#live2d_character_select").trigger("change");
  }
  await loadLive2d();
}

function updateCharactersList() {
  let current_characters = new Set();
  const context = getContext();
  for (const i of context.characters) {
      current_characters.add(i.name);
  }

  current_characters = Array.from(current_characters);

  console.debug(DEBUG_PREFIX,context)

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

//#############################//
//  Module Worker              //
//#############################//

async function moduleWorker() {
    const moduleEnabled = extension_settings.live2d.enabled;

    if (moduleEnabled) {
      // DBG

    }
}

//#############################//
//  Extension load             //
//#############################//

// This function is called when the extension is loaded
jQuery(async () => {
    const windowHtml = $(await $.get(`${extensionFolderPath}/window.html`));

    $('#extensions_settings').append(windowHtml);
    loadSettings();

    // Set user interactions
    $("#live2d_enabled").on("click", onEnabledClick);
    $("#live2d_follow_cursor").on("click", onFollowCursorClick);

    $("#live2d_character_select").on("change", onCharacterChange);
    $("#live2d_character_refresh_button").on("click", onCharacterRefreshClick);
    $("#live2d_show_all_characters").on("click", onShowAllCharactersClick);

    
    $("#live2d_model_refresh_button").on("click", onModelRefreshClick);
    
    $("#live2d_model_select").on("change", onModelChange);

    $("#live2d_model_scale").on("input", onModelScaleChange);

    $("#live2d_show_frames").on("click", onShowFramesClick);
    
    // Module worker
    const wrapper = new ModuleWorkerWrapper(moduleWorker);
    setInterval(wrapper.update.bind(wrapper), UPDATE_INTERVAL);
    moduleWorker();

    // Events
    eventSource.on(event_types.CHAT_CHANGED, updateCharactersModels);
    eventSource.on(event_types.CHAT_CHANGED, updateCharactersList);
    eventSource.on(event_types.GROUP_UPDATED, updateCharactersList);

    eventSource.on(event_types.MESSAGE_RECEIVED, (chat_id) => updateExpression(chat_id));

    // DBG Tests

    var canvas = document.createElement('canvas');
    canvas.id = "live2d-canvas";
    document.getElementById("expression-wrapper").appendChild(canvas);

    updateCharactersListOnce();

    //await loadLive2d();
    console.debug(DEBUG_PREFIX,"Finish loaded.");
});

const delay = s => new Promise(res => setTimeout(res, s*1000));

async function updateCharactersListOnce() {
  console.debug(DEBUG_PREFIX,"UDPATING char list", characters_list)
  while (characters_list.length == 0) {
      console.debug(DEBUG_PREFIX,"UDPATING char list")
      updateCharactersList();
      await delay(1);
  }
}

// DBG
//-------------------

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