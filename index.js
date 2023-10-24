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
  - UI for user to connect hit area with animations and message
  - Refactored code into seperate files
  - Group chat mode
  - button clear all models settings for a character
  - Coordinate sliders
  - Play mouth animation when talking (message length dependant)
  - load models from assets folder
  - starting animation option
  - factorized the expression/motion selects
  - replay button for animation selection and factorise playtest
  - reset live2d button
  - Resize model on resize window
  - update model x/y when drag and drop
  - Default model click mapping
  - force reset model for each animation option (usefull for models without a stable state like konosuba game)
  - refactorise names
  - wait before sending interaction message if one is running
  - don't send hit area when moving
  - Hide sprite of character with active live2d model

TODO:
- reset mapping button
- Security
- Features
  - Cleanup useless imports and comments

IDEAS:
  - move event capture ?
  - Synchronize mouth with TTS audio (maybe can make it play through live2d with lip sync)
  - option to detach live2d ui
  - Look at speaker option
  - Flip Y option
  - change order of model
*/
import { eventSource, event_types } from "../../../../script.js";
import { extension_settings, ModuleWorkerWrapper } from "../../../extensions.js";
export { MODULE_NAME };

import {
  MODULE_NAME,
  DEBUG_PREFIX,
  extensionFolderPath,
} from "./constants.js";

import {
  onEnabledClick,
  onFollowCursorClick,
  onAutoSendInteractionClick,
  onShowFramesClick,
  onForceAnimationClick,
  onCharacterChange,
  onCharacterRefreshClick,
  onCharacterRemoveClick,
  onModelRefreshClick,
  onModelChange,
  onModelScaleChange,
  onModelCoordChange,
  onModelMouthChange,
  onAnimationMappingChange,
  updateCharactersModels,
  updateCharactersList,
  updateCharactersListOnce,
  playStarterAnimation
} from "./ui.js";

import {
  updateExpression,
  playMessage,
  loadLive2d,
  charactersWithModelLoaded
} from "./live2d.js";

const UPDATE_INTERVAL = 1000;


//#############################//s
//  Extension UI and Settings  //
//#############################//

const defaultSettings = {
    // Global settings
    enabled: false,
    followCursor: false,
    autoSendInteraction: false,
    force_animation: false,

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

    $("#live2d_enabled_checkbox").prop('checked', extension_settings.live2d.enabled);
    $("#live2d_follow_cursor_checkbox").prop('checked', extension_settings.live2d.followCursor);
    $("#live2d_auto_send_interaction_checkbox").prop('checked', extension_settings.live2d.autoSendInteraction);

    $("#live2d_force_animation_checkbox").prop('checked', extension_settings.live2d.force_animation);
    $("#live2d_show_frames_checkbox").prop('checked', extension_settings.live2d.showFrames);
}

//#############################//
//  Methods                    //
//#############################//



//#############################//
//  Module Worker              //
//#############################//

async function moduleWorker() {
    const moduleEnabled = extension_settings.live2d.enabled;
    // DBG
    // Show sprites of character without live2d model
    const characters_to_hide = charactersWithModelLoaded();
    const visual_novel_div = $("#visual-novel-wrapper");

    let sprite_divs = $("#visual-novel-wrapper").children();

    // Wait for wrapper to be populated
    if (sprite_divs.length > 0) {
      for (const element of sprite_divs) {
        let to_hide = false;
        for (const character of characters_to_hide) {
            if (element["id"].includes(character)) {
              to_hide = true;
              element.classList.add("live2d-hidden");
              break;
            }
          }
          if (!to_hide)
            element.classList.remove("live2d-hidden");
        }
      
      visual_novel_div.removeClass("live2d-hidden");
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
    $("#live2d_enabled_checkbox").on("click", onEnabledClick);
    $("#live2d_follow_cursor_checkbox").on("click", onFollowCursorClick);
    $('#live2d_auto_send_interaction_checkbox').on("click", onAutoSendInteractionClick);
    $("#live2d_force_animation_checkbox").on("click", onForceAnimationClick);
    $("#live2d_show_frames_checkbox").on("click", onShowFramesClick);
    $("#live2d_reload_button").on("click", () => {loadLive2d(); console.debug(DEBUG_PREFIX,"Reset clicked, reloading live2d")});

    $("#live2d_character_select").on("change", onCharacterChange);
    $("#live2d_character_refresh_button").on("click", onCharacterRefreshClick);
    $("#live2d_character_remove_button").on("click", onCharacterRemoveClick);
    
    $("#live2d_model_refresh_button").on("click", onModelRefreshClick);
    $("#live2d_model_select").on("change", onModelChange);

    $("#live2d_model_scale").on("input", onModelScaleChange);
    $("#live2d_model_x").on("input", onModelCoordChange);
    $("#live2d_model_y").on("input", onModelCoordChange);

    $("#live2d_model_param_mouth_open_y_id_select").on("change", onModelMouthChange);
    $("#live2d_model_mouth_open_speed").on("input", onModelMouthChange);
    $("#live2d_model_mouth_time_per_character").on("input", onModelMouthChange);

    $("#live2d_starter_expression_select").on("change", () => {onAnimationMappingChange("animation_starter")});
    $("#live2d_starter_motion_select").on("change", () => {onAnimationMappingChange("animation_starter")});
    $("#live2d_starter_expression_replay").on("click", () => {onAnimationMappingChange("animation_starter")});
    $("#live2d_starter_motion_replay").on("click", () => {onAnimationMappingChange("animation_starter")});
    $("#live2d_starter_delay").on("input", () => {onAnimationMappingChange("animation_starter")});

    $("#live2d_default_expression_select").on("change", () => {onAnimationMappingChange("animation_default")});
    $("#live2d_default_motion_select").on("change", () => {onAnimationMappingChange("animation_default")});
    $("#live2d_default_expression_replay").on("click", () => {onAnimationMappingChange("animation_default")});
    $("#live2d_default_motion_replay").on("click", () => {onAnimationMappingChange("animation_default")});
    
    $("#live2d_hit_area_default_expression_select").on("change", () => {onAnimationMappingChange("animation_click")});
    $("#live2d_hit_area_default_motion_select").on("change", () => {onAnimationMappingChange("animation_click")});
    $("#live2d_hit_area_default_expression_replay").on("click", () => {onAnimationMappingChange("animation_click")});
    $("#live2d_hit_area_default_motion_replay").on("click", () => {onAnimationMappingChange("animation_click")});
    $("#live2d_hit_area_default_message").on("change", () => {onAnimationMappingChange("animation_click")});
    

    // Module worker
    const wrapper = new ModuleWorkerWrapper(moduleWorker);
    setInterval(wrapper.update.bind(wrapper), UPDATE_INTERVAL);
    moduleWorker();

    // Events
    window.addEventListener("resize", () => {loadLive2d(); console.debug(DEBUG_PREFIX,"Window resized, reloading live2d")});

    eventSource.on(event_types.CHAT_CHANGED, updateCharactersList);
    eventSource.on(event_types.CHAT_CHANGED, updateCharactersModels);
    eventSource.on(event_types.CHAT_CHANGED, playStarterAnimation);

    eventSource.on(event_types.GROUP_UPDATED, updateCharactersList);
    eventSource.on(event_types.GROUP_UPDATED, updateCharactersModels);

    eventSource.on(event_types.MESSAGE_RECEIVED, (chat_id) => updateExpression(chat_id));
    eventSource.on(event_types.MESSAGE_RECEIVED, (chat_id) => playMessage(chat_id));
    updateCharactersListOnce();

    console.debug(DEBUG_PREFIX,"Finish loaded.");
});